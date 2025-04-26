import * as tf from "@tensorflow/tfjs"
import * as handpose from "@tensorflow-models/handpose"

class HandTrackingService {
  constructor() {
    this.handpose = null
    this.isInitialized = false
    this.processingEnabled = false
    this.lastVideoTime = -1
    this.onResultsCallbacks = []
    this.detectionInterval = null
  }

  async initialize(gpuAcceleration = true) {
    if (this.isInitialized) return true

    try {
      console.log("Initializing hand tracking service...")

      // Initialize TensorFlow.js with WebGL backend if GPU acceleration is enabled
      if (gpuAcceleration) {
        await tf.setBackend("webgl")
        console.log("Using WebGL acceleration for TensorFlow.js")
      } else {
        await tf.setBackend("cpu")
        console.log("Using CPU for TensorFlow.js")
      }
      await tf.ready()

      // Initialize handpose model
      this.handpose = await handpose.load({
        detectionConfidence: 0.8,
        maxContinuousChecks: 10,
        iouThreshold: 0.3,
        scoreThreshold: 0.75,
      })
      console.log("Handpose model loaded")

      this.isInitialized = true
      console.log("Hand tracking service initialized successfully")
      return true
    } catch (error) {
      console.error("Failed to initialize hand tracking service:", error)
      return false
    }
  }

  startProcessing(videoElement) {
    if (!this.isInitialized) {
      console.error("Hand tracking service not initialized")
      return false
    }

    if (!videoElement) {
      console.error("No video element provided")
      return false
    }

    this.processingEnabled = true
    this.videoElement = videoElement

    // Start detection loop
    this.detectionInterval = setInterval(() => {
      this.detectHands()
    }, 100) // Run detection every 100ms

    console.log("Hand tracking processing started")
    return true
  }

  stopProcessing() {
    this.processingEnabled = false
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval)
      this.detectionInterval = null
    }
    console.log("Hand tracking processing stopped")
  }

  async detectHands() {
    if (!this.processingEnabled || !this.videoElement || !this.handpose) return

    try {
      // Check if video is ready
      if (this.videoElement.readyState === 4) {
        // Detect hands
        const hands = await this.handpose.estimateHands(this.videoElement)

        if (hands && hands.length > 0) {
          // Process hands
          const processedResults = this.processHandResults(hands)
          this.notifyCallbacks(processedResults)
        } else {
          // No hands detected
          this.notifyCallbacks({ hands: [], gestures: [], timestamp: Date.now() })
        }
      }
    } catch (error) {
      console.error("Error detecting hands:", error)
    }
  }

  processHandResults(hands) {
    // Extract landmarks and detect gestures
    const processedHands = hands.map((hand, index) => {
      // Extract hand features
      const features = this.extractHandFeatures(hand.landmarks)

      // Detect gestures based on features
      const gestures = this.detectGestures(features)

      return {
        landmarks: hand.landmarks,
        handedness: hand.handedness?.label || "Right",
        confidence: hand.handedness?.score || 0.5,
        features,
        gestures,
        id: index,
      }
    })

    // Extract gestures from all hands
    const allGestures = processedHands.flatMap((hand) =>
      hand.gestures.map((g) => ({
        ...g,
        handId: hand.id,
        handedness: hand.handedness,
      })),
    )

    return {
      hands: processedHands,
      gestures: allGestures,
      timestamp: Date.now(),
    }
  }

  extractHandFeatures(landmarks) {
    // Calculate finger states (extended or curled)
    const fingerStates = this.calculateFingerStates(landmarks)

    // Calculate palm center
    const palmCenter = this.calculatePalmCenter(landmarks)

    return {
      fingerStates,
      palmCenter,
    }
  }

  calculateFingerStates(landmarks) {
    // Define finger indices
    const fingerIndices = {
      thumb: [0, 1, 2, 3, 4],
      index: [0, 5, 6, 7, 8],
      middle: [0, 9, 10, 11, 12],
      ring: [0, 13, 14, 15, 16],
      pinky: [0, 17, 18, 19, 20],
    }

    const states = {}

    // For each finger
    for (const [finger, indices] of Object.entries(fingerIndices)) {
      if (finger === "thumb") {
        // Special case for thumb
        states[finger] = this.isThumbExtended(landmarks, indices) ? "extended" : "curled"
      } else {
        // For other fingers
        states[finger] = this.isFingerExtended(landmarks, indices) ? "extended" : "curled"
      }
    }

    return states
  }

  isThumbExtended(landmarks, indices) {
    const [wrist, cmc, mcp, ip, tip] = indices.map((i) => landmarks[i])

    // Calculate the angle between the thumb and the palm
    const thumbDirection = [tip[0] - mcp[0], tip[1] - mcp[1]]
    const palmDirection = [wrist[0] - mcp[0], wrist[1] - mcp[1]]

    // Normalize vectors
    const thumbLength = Math.sqrt(thumbDirection[0] ** 2 + thumbDirection[1] ** 2)
    const palmLength = Math.sqrt(palmDirection[0] ** 2 + palmDirection[1] ** 2)

    const thumbNorm = [thumbDirection[0] / thumbLength, thumbDirection[1] / thumbLength]
    const palmNorm = [palmDirection[0] / palmLength, palmDirection[1] / palmLength]

    // Calculate dot product
    const dotProduct = thumbNorm[0] * palmNorm[0] + thumbNorm[1] * palmNorm[1]

    // If dot product is negative, vectors point in opposite directions
    return dotProduct < 0
  }

  isFingerExtended(landmarks, indices) {
    const [wrist, mcp, pip, dip, tip] = indices.map((i) => landmarks[i])

    // Calculate the distance from fingertip to wrist
    const tipToWristDistance = Math.sqrt((tip[0] - wrist[0]) ** 2 + (tip[1] - wrist[1]) ** 2)

    // Calculate the distance from MCP to wrist
    const mcpToWristDistance = Math.sqrt((mcp[0] - wrist[0]) ** 2 + (mcp[1] - wrist[1]) ** 2)

    // If the fingertip is further from the wrist than the MCP, the finger is likely extended
    return tipToWristDistance > mcpToWristDistance * 1.5
  }

  calculatePalmCenter(landmarks) {
    // Use the average of wrist and MCP joints
    const points = [0, 5, 9, 13, 17].map((i) => landmarks[i])

    const sumX = points.reduce((sum, p) => sum + p[0], 0)
    const sumY = points.reduce((sum, p) => sum + p[1], 0)
    const sumZ = points.reduce((sum, p) => sum + (p[2] || 0), 0)

    return {
      x: sumX / points.length,
      y: sumY / points.length,
      z: sumZ / points.length,
    }
  }

  detectGestures(features) {
    const { fingerStates } = features
    const gestures = []

    // Check for common ASL signs

    // A sign - All fingers curled except thumb
    if (
      fingerStates.index === "curled" &&
      fingerStates.middle === "curled" &&
      fingerStates.ring === "curled" &&
      fingerStates.pinky === "curled" &&
      fingerStates.thumb === "extended"
    ) {
      gestures.push({ sign: "A", confidence: 0.9 })
    }

    // B sign - All fingers extended, thumb curled
    if (
      fingerStates.index === "extended" &&
      fingerStates.middle === "extended" &&
      fingerStates.ring === "extended" &&
      fingerStates.pinky === "extended" &&
      fingerStates.thumb === "curled"
    ) {
      gestures.push({ sign: "B", confidence: 0.9 })
    }

    // C sign - Curved hand (simplified detection)
    if (
      fingerStates.index === "extended" &&
      fingerStates.middle === "extended" &&
      fingerStates.ring === "extended" &&
      fingerStates.pinky === "extended" &&
      fingerStates.thumb === "extended"
    ) {
      gestures.push({ sign: "C", confidence: 0.8 })
    }

    // I sign - Pinky extended, others curled
    if (
      fingerStates.index === "curled" &&
      fingerStates.middle === "curled" &&
      fingerStates.ring === "curled" &&
      fingerStates.pinky === "extended" &&
      fingerStates.thumb === "curled"
    ) {
      gestures.push({ sign: "I", confidence: 0.9 })
    }

    // L sign - Index extended, thumb extended, others curled
    if (
      fingerStates.index === "extended" &&
      fingerStates.middle === "curled" &&
      fingerStates.ring === "curled" &&
      fingerStates.pinky === "curled" &&
      fingerStates.thumb === "extended"
    ) {
      gestures.push({ sign: "L", confidence: 0.9 })
    }

    // Y sign - Thumb and pinky extended, others curled
    if (
      fingerStates.index === "curled" &&
      fingerStates.middle === "curled" &&
      fingerStates.ring === "curled" &&
      fingerStates.pinky === "extended" &&
      fingerStates.thumb === "extended"
    ) {
      gestures.push({ sign: "Y", confidence: 0.9 })
    }

    return gestures
  }

  registerCallback(callback) {
    if (typeof callback === "function") {
      this.onResultsCallbacks.push(callback)
      return true
    }
    return false
  }

  unregisterCallback(callback) {
    const index = this.onResultsCallbacks.indexOf(callback)
    if (index !== -1) {
      this.onResultsCallbacks.splice(index, 1)
      return true
    }
    return false
  }

  notifyCallbacks(results) {
    this.onResultsCallbacks.forEach((callback) => {
      try {
        callback(results)
      } catch (error) {
        console.error("Error in hand tracking callback:", error)
      }
    })
  }

  // Get device capabilities to optimize performance
  async getDeviceCapabilities() {
    const capabilities = {
      webgl: false,
      webgl2: false,
      worker: !!window.Worker,
      videoConstraints: {},
    }

    // Check WebGL support
    try {
      const canvas = document.createElement("canvas")
      const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl")
      capabilities.webgl = !!gl
      if (gl) {
        gl.getExtension("WEBGL_lose_context")?.loseContext()
      }
    } catch (e) {
      console.warn("WebGL detection failed:", e)
    }

    // Check WebGL2 support
    try {
      const canvas = document.createElement("canvas")
      capabilities.webgl2 = !!canvas.getContext("webgl2")
    } catch (e) {
      console.warn("WebGL2 detection failed:", e)
    }

    // Get video capabilities
    if (navigator.mediaDevices && navigator.mediaDevices.getSupportedConstraints) {
      const supportedConstraints = navigator.mediaDevices.getSupportedConstraints()
      capabilities.videoConstraints = supportedConstraints
    }

    return capabilities
  }

  // Clean up resources
  dispose() {
    this.stopProcessing()
    this.onResultsCallbacks = []
    this.isInitialized = false
    console.log("Hand tracking service disposed")
  }
}

// Create singleton instance
const handTrackingService = new HandTrackingService()
export default handTrackingService
