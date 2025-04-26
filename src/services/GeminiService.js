import { GoogleGenerativeAI } from "@google/generative-ai"

class GeminiService {
  constructor() {
    this.apiKey = null
    this.genAI = null
    this.model = null
    this.modelName = "gemini-1.5-flash"
    this.isInitialized = false
    this.requestQueue = []
    this.processingQueue = false
    this.cache = new Map()
    this.cacheSize = 50
    this.offlineMode = false
    this.fallbackResponses = new Map()

    // Rate limiting
    this.requestsPerMinute = 10 // Conservative limit (free tier is 15)
    this.requestTimestamps = []
    this.retryDelays = [1000, 2000, 5000, 10000, 30000] // Increasing backoff delays in ms

    // Request deduplication
    this.pendingRequests = new Map()
  }

  // Initialize the service with API key
  initialize(apiKey) {
    // If already initialized with this key, don't reinitialize
    if (this.isInitialized && this.apiKey === apiKey) {
      console.log("Gemini service already initialized with this key")
      return true
    }

    if (!apiKey) {
      console.error("No API key provided")
      return false
    }

    try {
      this.apiKey = apiKey
      this.genAI = new GoogleGenerativeAI(apiKey)
      this.model = this.genAI.getGenerativeModel({ model: this.modelName })
      this.isInitialized = true
      console.log("Gemini service initialized successfully")

      // Set up fallback responses
      this.setupFallbackResponses()

      // Process any queued requests
      if (this.requestQueue.length > 0) {
        this.processQueue()
      }

      return true
    } catch (error) {
      console.error("Failed to initialize Gemini service:", error)
      return false
    }
  }

  // Set up fallback responses for offline mode
  setupFallbackResponses() {
    this.fallbackResponses.set("greeting", "Hello! I'm using sign language.")
    this.fallbackResponses.set("question", "I have a question.")
    this.fallbackResponses.set("thank_you", "Thank you!")
    this.fallbackResponses.set("yes", "Yes.")
    this.fallbackResponses.set("no", "No.")
    this.fallbackResponses.set("help", "I need help.")
    this.fallbackResponses.set("understand", "I understand.")
    this.fallbackResponses.set("not_understand", "I don't understand.")
    this.fallbackResponses.set("repeat", "Please repeat that.")
    this.fallbackResponses.set("name", "My name is [Name].")
  }

  // Toggle offline mode
  setOfflineMode(enabled) {
    this.offlineMode = enabled
    console.log(`Offline mode ${enabled ? "enabled" : "disabled"}`)
  }

  // Check if we're within rate limits
  checkRateLimit() {
    const now = Date.now()

    // Remove timestamps older than 1 minute
    this.requestTimestamps = this.requestTimestamps.filter((timestamp) => now - timestamp < 60000)

    // Check if we've exceeded our rate limit
    return this.requestTimestamps.length < this.requestsPerMinute
  }

  // Add a timestamp for rate limiting
  addRequestTimestamp() {
    this.requestTimestamps.push(Date.now())
  }

  // Get delay time for rate limiting
  getRateLimitDelay() {
    const now = Date.now()
    if (this.requestTimestamps.length === 0) return 0

    // Sort timestamps in ascending order
    const sortedTimestamps = [...this.requestTimestamps].sort((a, b) => a - b)

    // Find the earliest timestamp that will expire
    const oldestTimestamp = sortedTimestamps[0]
    const timeUntilExpiry = 60000 - (now - oldestTimestamp)

    return Math.max(0, timeUntilExpiry + 1000) // Add 1 second buffer
  }

  // Process the request queue
  async processQueue() {
    if (this.processingQueue) return

    this.processingQueue = true

    while (this.requestQueue.length > 0) {
      const { request, resolve, reject, retryCount } = this.requestQueue[0]

      try {
        // Check rate limit before processing
        if (!this.checkRateLimit() && !this.offlineMode) {
          const delay = this.getRateLimitDelay()
          console.log(`Rate limit reached, waiting ${delay}ms before next request`)
          await new Promise((r) => setTimeout(r, delay))
          continue // Check again after waiting
        }

        // Remove the request from the queue before processing
        this.requestQueue.shift()

        const result = await this.executeRequest(request)
        resolve(result)
      } catch (error) {
        console.error("Error processing queued request:", error)

        // Check if we should retry
        const maxRetries = this.retryDelays.length
        if (retryCount < maxRetries && this.shouldRetry(error)) {
          const delay = this.retryDelays[retryCount]
          console.log(`Retrying request after ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`)

          // Put the request back in the queue with increased retry count
          this.requestQueue.unshift({
            request,
            resolve,
            reject,
            retryCount: retryCount + 1,
          })

          // Wait before retrying
          await new Promise((r) => setTimeout(r, delay))
        } else {
          // Remove from queue and reject if max retries reached
          this.requestQueue.shift()
          reject(error)
        }
      }
    }

    this.processingQueue = false
  }

  // Check if an error is retryable
  shouldRetry(error) {
    // Retry on rate limit errors (429) or temporary server errors (5xx)
    return (
      error.message &&
      (error.message.includes("429") ||
        error.message.includes("exceeded your current quota") ||
        error.message.includes("500") ||
        error.message.includes("503") ||
        error.message.includes("504"))
    )
  }

  // Execute a request to the Gemini API
  async executeRequest(request) {
    if (!this.isInitialized && !this.offlineMode) {
      throw new Error("Gemini service not initialized")
    }

    // Check cache first
    const cacheKey = this.getCacheKey(request)
    if (this.cache.has(cacheKey)) {
      console.log("Using cached response")
      return this.cache.get(cacheKey)
    }

    // If in offline mode, use fallback responses
    if (this.offlineMode) {
      return this.getFallbackResponse(request)
    }

    // Check if there's already a pending request for this exact data
    if (this.pendingRequests.has(cacheKey)) {
      console.log("Reusing pending request")
      return this.pendingRequests.get(cacheKey)
    }

    try {
      // Create a promise for this request
      const requestPromise = (async () => {
        // Add timestamp for rate limiting
        this.addRequestTimestamp()

        let result

        switch (request.type) {
          case "text":
            result = await this.generateText(request)
            break
          case "vision":
            result = await this.generateVisionResponse(request)
            break
          case "sign_interpretation":
            result = await this.interpretSignLanguage(request)
            break
          case "sign_to_text":
            result = await this.convertSignToText(request)
            break
          case "text_to_sign":
            result = await this.convertTextToSign(request)
            break
          default:
            throw new Error(`Unknown request type: ${request.type}`)
        }

        // Cache the result
        this.cacheResult(cacheKey, result)

        // Remove from pending requests
        this.pendingRequests.delete(cacheKey)

        return result
      })()

      // Store the promise in pending requests
      this.pendingRequests.set(cacheKey, requestPromise)

      return requestPromise
    } catch (error) {
      console.error("Gemini API error:", error)

      // Remove from pending requests
      this.pendingRequests.delete(cacheKey)

      // If API fails with a non-retryable error, try to use fallback
      if (!this.shouldRetry(error)) {
        return this.getFallbackResponse(request)
      }

      // Otherwise, rethrow for retry logic
      throw error
    }
  }

  // Generate text response
  async generateText(request) {
    const { prompt, system, temperature = 0.7, topK = 40, topP = 0.95, maxTokens } = request

    const generationConfig = {
      temperature,
      topK,
      topP,
      maxOutputTokens: maxTokens,
    }

    const result = await this.model.generateContent({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig,
      systemInstruction: system ? { text: system } : undefined,
    })

    return {
      text: result.response.text(),
      usage: {
        promptTokens: 0, // Not provided by the API
        completionTokens: 0, // Not provided by the API
        totalTokens: 0, // Not provided by the API
      },
    }
  }

  // Generate vision response
  async generateVisionResponse(request) {
    const { prompt, images, temperature = 0.7, maxTokens } = request

    const parts = [{ text: prompt }]

    // Add images to parts
    if (images && images.length > 0) {
      for (const image of images) {
        parts.push({
          inlineData: {
            mimeType: image.mimeType || "image/jpeg",
            data: image.data,
          },
        })
      }
    }

    const generationConfig = {
      temperature,
      maxOutputTokens: maxTokens,
    }

    const result = await this.model.generateContent({
      contents: [{ role: "user", parts }],
      generationConfig,
    })

    return {
      text: result.response.text(),
      usage: {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
    }
  }

  // Interpret sign language
  async interpretSignLanguage(request) {
    const { gestures, context, temperature = 0.3 } = request

    // Format the gesture data for the prompt
    const gestureData = this.formatGestureData(gestures)

    // Create a prompt that includes context and gesture data
    const prompt = this.createSignInterpretationPrompt(gestureData, context)

    // Generate the interpretation
    const result = await this.generateText({
      prompt,
      temperature,
      system:
        "You are an expert sign language interpreter. Translate the detected signs into natural, fluent language. Consider context and grammar to produce accurate interpretations.",
    })

    return {
      interpretation: result.text,
      confidence: this.calculateInterpretationConfidence(gestures),
      usage: result.usage,
    }
  }

  // Format gesture data for the prompt
  formatGestureData(gestures) {
    if (!gestures || !gestures.tokens) {
      return "No gestures detected."
    }

    // Format the tokens
    const formattedTokens = gestures.tokens
      .map((token) => {
        const alternatives = token.alternatives
          ? ` (alternatives: ${token.alternatives.map((alt) => `${alt.value} (${(alt.confidence * 100).toFixed(0)}%)`).join(", ")})`
          : ""
        return `${token.value} (${(token.confidence * 100).toFixed(0)}%)${alternatives}`
      })
      .join(", ")

    return `Detected signs: ${formattedTokens}`
  }

  // Create a prompt for sign language interpretation
  createSignInterpretationPrompt(gestureData, context) {
    let prompt = "Interpret the following sign language gestures into natural language:\n\n"
    prompt += gestureData + "\n\n"

    if (context && context.segments && context.segments.length > 0) {
      prompt += "Previous context:\n"
      context.segments.forEach((segment, index) => {
        prompt += `[${index + 1}] ${this.formatSegmentForPrompt(segment)}\n`
      })
      prompt += "\n"
    }

    prompt +=
      "Provide a natural language interpretation that considers ASL grammar and context. If the signs form a question, format it as a question. If they're a statement, format it as a statement."

    return prompt
  }

  // Format a segment for inclusion in a prompt
  formatSegmentForPrompt(segment) {
    if (!segment || !segment.tokens) return ""

    // For simplicity, just extract the values
    return segment.tokens.map((token) => token.value).join(" ")
  }

  // Calculate confidence score for the interpretation
  calculateInterpretationConfidence(gestures) {
    if (!gestures || !gestures.tokens || gestures.tokens.length === 0) {
      return 0
    }

    // Average the confidence of all tokens
    const sum = gestures.tokens.reduce((acc, token) => acc + token.confidence, 0)
    return sum / gestures.tokens.length
  }

  // Convert sign language to text
  async convertSignToText(request) {
    const { gestures, context, temperature = 0.3 } = request

    // Similar to interpretSignLanguage but optimized for text output
    const gestureData = this.formatGestureData(gestures)
    const prompt = this.createSignToTextPrompt(gestureData, context)

    const result = await this.generateText({
      prompt,
      temperature,
      system:
        "You are an expert sign language translator. Convert the detected signs into clear, grammatically correct text. Focus on accuracy and natural language.",
    })

    return {
      text: result.text,
      confidence: this.calculateInterpretationConfidence(gestures),
      usage: result.usage,
    }
  }

  // Create a prompt for sign-to-text conversion
  createSignToTextPrompt(gestureData, context) {
    let prompt = "Convert the following sign language gestures to text:\n\n"
    prompt += gestureData + "\n\n"

    if (context && context.segments && context.segments.length > 0) {
      prompt += "Previous context:\n"
      context.segments.forEach((segment, index) => {
        prompt += `[${index + 1}] ${this.formatSegmentForPrompt(segment)}\n`
      })
      prompt += "\n"
    }

    prompt += "Provide a clear, grammatically correct text translation of these signs."

    return prompt
  }

  // Convert text to sign language instructions
  async convertTextToSign(request) {
    const { text, detail = "medium", temperature = 0.3 } = request

    const detailLevel = {
      low: "Provide basic instructions for the main signs.",
      medium: "Provide step-by-step instructions for each sign, including hand shapes and movements.",
      high: "Provide detailed instructions for each sign, including precise hand shapes, movements, positions, and any facial expressions.",
    }

    const prompt = `Convert the following text to American Sign Language (ASL) instructions:
    
"${text}"

${detailLevel[detail] || detailLevel.medium}
Format the response as a list of steps.`

    const result = await this.generateText({
      prompt,
      temperature,
      system:
        "You are an expert ASL instructor. Convert text to clear, accurate sign language instructions that anyone can follow.",
    })

    return {
      instructions: result.text,
      usage: result.usage,
    }
  }

  // Get a fallback response when offline or API fails
  getFallbackResponse(request) {
    console.log("Using fallback response for", request.type)

    switch (request.type) {
      case "sign_interpretation":
      case "sign_to_text": {
        // Try to match gestures to fallback responses
        const gestures = request.gestures
        if (!gestures || !gestures.tokens || gestures.tokens.length === 0) {
          return { interpretation: "I didn't catch that sign.", confidence: 0.5 }
        }

        // Look for known signs in the gestures
        for (const token of gestures.tokens) {
          const lowerValue = token.value.toLowerCase()
          for (const [key, response] of this.fallbackResponses.entries()) {
            if (lowerValue.includes(key)) {
              return { interpretation: response, confidence: 0.7 }
            }
          }
        }

        // Default fallback
        return { interpretation: "I see you're using sign language.", confidence: 0.5 }
      }
      case "text_to_sign":
        return {
          instructions:
            "1. Use basic hand gestures to communicate.\n2. Try using common signs like 'hello', 'thank you', or 'please'.",
        }
      default:
        return { text: "I'm currently in offline mode and can't process this request." }
    }
  }

  // Generate cache key for a request
  getCacheKey(request) {
    // For vision requests, include a hash of the image data to ensure uniqueness
    if (request.type === "vision" && request.images && request.images.length > 0) {
      // Include timestamp to ensure each video gets a fresh analysis
      const timestamp = Date.now()
      // Include the first few characters of the first image data as a simple hash
      const imageHash = request.images[0].data.substring(0, 20)
      return `${request.type}_${timestamp}_${imageHash}`
    }

    // For other request types, use the previous approach but add timestamp
    return JSON.stringify({
      type: request.type,
      timestamp: Date.now(), // Add timestamp to ensure uniqueness
      prompt: request.prompt,
      text: request.text,
      gestures: request.gestures ? request.gestures.tokens.map((t) => t.value).join(",") : null,
    })
  }

  // Cache a result
  cacheResult(key, result) {
    // Implement LRU cache
    if (this.cache.size >= this.cacheSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }

    this.cache.set(key, result)
  }

  // Clear the cache
  clearCache() {
    this.cache.clear()
    console.log("Cache cleared")
  }

  // Make a request to the Gemini API
  async request(requestData) {
    // If not initialized and not in offline mode, queue the request
    if (!this.isInitialized && !this.offlineMode) {
      return new Promise((resolve, reject) => {
        this.requestQueue.push({
          request: requestData,
          resolve,
          reject,
          retryCount: 0,
        })
      })
    }

    return this.executeRequest(requestData)
  }
}

// Create singleton instance
const geminiService = new GeminiService()
export default geminiService
