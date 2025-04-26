import handTrackingService from "./HandTrackingService"
import GestureTokenizer from "./GestureTokenizer"
import geminiService from "./GeminiService"

class SignLanguageProcessor {
  constructor() {
    this.tokenizer = new GestureTokenizer()
    this.isProcessing = false
    this.onInterpretationCallbacks = []
    this.onTokensCallbacks = []
    this.processingInterval = null
    this.processingIntervalMs = 2000 // Process every 2 seconds
    this.lastProcessedTime = 0
    this.minProcessingGap = 500 // Minimum ms between processing
    this.bufferTimeout = null
    this.bufferTimeoutMs = 3000 // Wait for 3s of inactivity before processing
    this.lastActivityTime = 0
    this.apiKey = null
    this.offlineMode = false
  }

  // Initialize the processor
  async initialize(apiKey, options = {}) {
    try {
      this.apiKey = apiKey
      this.offlineMode = options.offlineMode || false

      // Initialize hand tracking service
      const handTrackingInitialized = await handTrackingService.initialize(options.gpuAcceleration !== false)
      if (!handTrackingInitialized) {
        console.error("Failed to initialize hand tracking service")
        return false
      }

      // Initialize Gemini service if not in offline mode
      if (!this.offlineMode && apiKey) {
        const geminiInitialized = geminiService.initialize(apiKey)
        if (!geminiInitialized) {
          console.warn("Failed to initialize Gemini service, falling back to offline mode")
          this.offlineMode = true
          geminiService.setOfflineMode(true)
        }
      } else if (this.offlineMode) {
        geminiService.setOfflineMode(true)
      }

      // Register callback for hand tracking results
      handTrackingService.registerCallback(this.handleHandTrackingResults.bind(this))

      console.log("Sign language processor initialized successfully")
      return true
    } catch (error) {
      console.error("Failed to initialize sign language processor:", error)
      return false
    }
  }

  // Start processing
  startProcessing(videoElement) {
    if (this.isProcessing) return false

    // Start hand tracking
    const trackingStarted = handTrackingService.startProcessing(videoElement)
    if (!trackingStarted) {
      console.error("Failed to start hand tracking")
      return false
    }

    this.isProcessing = true
    this.lastProcessedTime = Date.now()
    this.lastActivityTime = Date.now()

    // Set up processing interval
    this.processingInterval = setInterval(() => {
      this.processTokenBuffer()
    }, this.processingIntervalMs)

    console.log("Sign language processing started")
    return true
  }

  // Stop processing
  stopProcessing() {
    if (!this.isProcessing) return false

    // Stop hand tracking
    handTrackingService.stopProcessing()

    // Clear intervals and timeouts
    if (this.processingInterval) {
      clearInterval(this.processingInterval)
      this.processingInterval = null
    }

    if (this.bufferTimeout) {
      clearTimeout(this.bufferTimeout)
      this.bufferTimeout = null
    }

    this.isProcessing = false
    console.log("Sign language processing stopped")
    return true
  }

  // Handle results from hand tracking service
  handleHandTrackingResults(results) {
    if (!this.isProcessing) return

    // Update last activity time
    this.lastActivityTime = Date.now()

    // Extract gestures from results
    const gestures = this.extractGestures(results)

    // Process gestures with tokenizer
    const tokens = this.tokenizer.processGestures(gestures, this.lastActivityTime)

    // Notify token callbacks
    if (tokens) {
      this.notifyTokenCallbacks(tokens)
    }

    // Reset buffer timeout
    this.resetBufferTimeout()
  }

  // Extract gestures from hand tracking results
  extractGestures(results) {
    if (!results || !results.hands || results.hands.length === 0) {
      return []
    }

    // Flatten gestures from all hands
    return results.gestures || []
  }

  // Reset the buffer timeout
  resetBufferTimeout() {
    // Clear existing timeout
    if (this.bufferTimeout) {
      clearTimeout(this.bufferTimeout)
    }

    // Set new timeout
    this.bufferTimeout = setTimeout(() => {
      // If no activity for a while, process the buffer
      const timeSinceLastActivity = Date.now() - this.lastActivityTime
      if (timeSinceLastActivity >= this.bufferTimeoutMs) {
        this.processTokenBuffer(true) // Force processing
      }
    }, this.bufferTimeoutMs)
  }

  // Process the token buffer
  async processTokenBuffer(force = false) {
    const now = Date.now()
    const timeSinceLastProcess = now - this.lastProcessedTime

    // Skip if processed recently and not forced
    if (!force && timeSinceLastProcess < this.minProcessingGap) {
      return
    }

    // Finalize current segment
    const segment = this.tokenizer.finalizeSegment()
    if (!segment) return

    this.lastProcessedTime = now

    // Get context for interpretation
    const context = this.tokenizer.getContext()

    // Interpret the segment
    try {
      const interpretation = await this.interpretSegment(segment, context)
      this.notifyInterpretationCallbacks(interpretation)
    } catch (error) {
      console.error("Error interpreting segment:", error)
    }
  }

  // Interpret a segment
  async interpretSegment(segment, context) {
    // Skip empty segments
    if (!segment || !segment.tokens || segment.tokens.length === 0) {
      return { interpretation: "", confidence: 0 }
    }

    try {
      // Use Gemini service to interpret
      const result = await geminiService.request({
        type: "sign_interpretation",
        gestures: segment,
        context,
      })

      return result
    } catch (error) {
      console.error("Error in sign interpretation:", error)
      return {
        interpretation: "Error interpreting signs.",
        confidence: 0,
      }
    }
  }

  // Register callback for interpretations
  onInterpretation(callback) {
    if (typeof callback === "function") {
      this.onInterpretationCallbacks.push(callback)
      return true
    }
    return false
  }

  // Register callback for tokens
  onTokens(callback) {
    if (typeof callback === "function") {
      this.onTokensCallbacks.push(callback)
      return true
    }
    return false
  }

  // Notify interpretation callbacks
  notifyInterpretationCallbacks(interpretation) {
    this.onInterpretationCallbacks.forEach((callback) => {
      try {
        callback(interpretation)
      } catch (error) {
        console.error("Error in interpretation callback:", error)
      }
    })
  }

  // Notify token callbacks
  notifyTokenCallbacks(tokens) {
    this.onTokensCallbacks.forEach((callback) => {
      try {
        callback(tokens)
      } catch (error) {
        console.error("Error in token callback:", error)
      }
    })
  }

  // Convert text to sign language instructions
  async textToSignInstructions(text, detail = "medium") {
    try {
      const result = await geminiService.request({
        type: "text_to_sign",
        text,
        detail,
      })

      return result
    } catch (error) {
      console.error("Error converting text to sign instructions:", error)
      return {
        instructions: "Error generating sign language instructions.",
      }
    }
  }

  // Get device capabilities
  async getDeviceCapabilities() {
    return handTrackingService.getDeviceCapabilities()
  }

  // Clean up resources
  dispose() {
    this.stopProcessing()
    this.tokenizer.clear()
    this.onInterpretationCallbacks = []
    this.onTokensCallbacks = []
    console.log("Sign language processor disposed")
  }
}

// Create singleton instance
const signLanguageProcessor = new SignLanguageProcessor()
export default signLanguageProcessor
