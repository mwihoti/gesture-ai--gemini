"use client"

import { useEffect, useState, useRef } from "react"
import { extractFramesFromVideo } from "../utils/videoUtils"
import geminiService from "../services/GeminiService"

const SignInterpreter = ({ videoBlob, onInterpretation, autoProcess = false }) => {
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)
  const [apiKey, setApiKey] = useState(
    localStorage.getItem("geminiApiKey") || process.env.REACT_APP_GEMINI_API_KEY || "",
  )
  const [processingStarted, setProcessingStarted] = useState(false)
  const [offlineMode, setOfflineMode] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const maxRetries = 3

  // Use refs to track the current video being processed
  const currentVideoBlobRef = useRef(null)
  const processingTimeoutRef = useRef(null)
  const lastProcessedBlobSizeRef = useRef(null)
  const processingLockRef = useRef(false)

  useEffect(() => {
    // Initialize Gemini service
    if (apiKey) {
      geminiService.initialize(apiKey)
    }

    // Only process if we have a new video and aren't already processing
    if (
      videoBlob &&
      autoProcess &&
      !processingLockRef.current &&
      (!currentVideoBlobRef.current || currentVideoBlobRef.current.size !== videoBlob.size)
    ) {
      console.log("Auto-processing video:", videoBlob.size, "bytes, type:", videoBlob.type)
      currentVideoBlobRef.current = videoBlob
      lastProcessedBlobSizeRef.current = videoBlob.size
      processVideo()
    }

    // Cleanup function
    return () => {
      if (processingTimeoutRef.current) {
        clearTimeout(processingTimeoutRef.current)
      }
    }
  }, [videoBlob, autoProcess, apiKey])

  const processVideo = async () => {
    // Prevent multiple simultaneous processing
    if (processingLockRef.current) {
      console.log("Already processing a video, skipping")
      return
    }

    // Clear cache to ensure fresh analysis
    geminiService.clearCache()

    if (!videoBlob) {
      setError("No video to process")
      return
    }

    try {
      processingLockRef.current = true
      setIsProcessing(true)
      setProgress(0)
      setError(null)
      console.log("Starting video processing...")

      // Phase 1: Validate video
      setProgress(10)
      const isValid = await validateVideo(videoBlob)
      if (!isValid) {
        throw new Error("Invalid video format or corrupted video file")
      }
      console.log("Video validated, duration:", isValid)
      setProgress(20)

      // Phase 2: Extract frames from the video
      console.log("Extracting frames from video...")
      const frames = await extractFramesFromVideo(videoBlob, 5) // Extract 5 frames per second
      console.log(`Extracted ${frames.length} frames from video`)
      setProgress(50)

      if (frames.length === 0) {
        throw new Error("No frames could be extracted from the video")
      }

      // Phase 3: Process the frames with Gemini AI
      console.log("Interpreting sign language...")
      const interpretation = await interpretSignLanguage(frames)
      setProgress(100)

      console.log("Interpretation complete:", interpretation.substring(0, 50) + "...")
      onInterpretation(interpretation)
    } catch (err) {
      console.error("Error processing video:", err)

      // Retry logic for API rate limit errors
      if (retryCount < maxRetries && isRateLimitError(err)) {
        const delay = Math.pow(2, retryCount) * 1000 // Exponential backoff
        setError(`Rate limit reached. Retrying in ${delay / 1000} seconds... (${retryCount + 1}/${maxRetries})`)

        processingTimeoutRef.current = setTimeout(() => {
          setRetryCount(retryCount + 1)
          processingLockRef.current = false
          processVideo()
        }, delay)
        return
      }

      setError(`Error processing video: ${err.message}`)
      onInterpretation("")
    } finally {
      // Add a small delay before allowing new processing to prevent rapid reprocessing
      processingTimeoutRef.current = setTimeout(() => {
        setIsProcessing(false)
        processingLockRef.current = false
      }, 1000)
    }
  }

  // Check if error is a rate limit error
  const isRateLimitError = (error) => {
    return (
      error.message &&
      (error.message.includes("429") ||
        error.message.includes("exceeded your current quota") ||
        error.message.includes("rate limit"))
    )
  }

  // Validate video before processing
  const validateVideo = (blob) => {
    return new Promise((resolve) => {
      const video = document.createElement("video")
      video.preload = "metadata"

      video.onloadedmetadata = () => {
        URL.revokeObjectURL(video.src)
        resolve(video.duration)
      }

      video.onerror = () => {
        URL.revokeObjectURL(video.src)
        resolve(false)
      }

      // Set a timeout to prevent hanging
      const timeoutId = setTimeout(() => {
        URL.revokeObjectURL(video.src)
        resolve(3) // Default to 3 seconds if metadata loading times out
      }, 2000)

      video.onloadedmetadata = () => {
        clearTimeout(timeoutId)
        URL.revokeObjectURL(video.src)
        resolve(video.duration)
      }

      video.src = URL.createObjectURL(blob)
    })
  }

  const interpretSignLanguage = async (frames) => {
    try {
      // Select key frames (beginning, middle, end)
      const keyFrames = selectKeyFrames(frames, Math.min(5, frames.length))
      console.log(`Selected ${keyFrames.length} key frames for analysis`)
      setProgress(70)

      // Convert frames to base64
      const framePromises = keyFrames.map(async (frame) => {
        return {
          inlineData: {
            mimeType: "image/jpeg",
            data: frame.replace("data:image/jpeg;base64,", ""),
          },
        }
      })

      const processedFrames = await Promise.all(framePromises)
      setProgress(80)

      // Create prompt for Gemini
      const prompt =
        "These images show a sequence of sign language gestures. Please interpret what is being communicated in sign language. Provide a detailed interpretation of the signs and their meaning. If you recognize specific ASL (American Sign Language) signs, please mention them. If you're not sure about some signs, make your best guess but indicate uncertainty. Provide a single coherent interpretation that summarizes all the frames."

      // Use Gemini service for API calls with rate limiting
      console.log("Sending request to Gemini...")

      if (offlineMode || !apiKey) {
        // Fallback response if offline or no API key
        setProgress(100)
        return "I can see you're using sign language, but I'm currently in offline mode and can't provide a detailed interpretation."
      }

      // Use the Gemini service for API calls with rate limiting
      const result = await geminiService.request({
        type: "vision",
        prompt,
        images: processedFrames.map((frame) => ({
          data: frame.inlineData.data,
          mimeType: frame.inlineData.mimeType,
        })),
        temperature: 0.2,
      })

      setProgress(95)
      return result.text
    } catch (error) {
      console.error("Error interpreting sign language:", error)
      throw new Error(`Failed to interpret sign language: ${error.message}`)
    }
  }

  const selectKeyFrames = (frames, count) => {
    if (frames.length <= count) return frames

    const result = []
    const step = Math.floor(frames.length / (count - 1))

    // Always include first and last frame
    result.push(frames[0])

    // Add evenly spaced frames in between
    for (let i = 1; i < count - 1; i++) {
      result.push(frames[i * step])
    }

    result.push(frames[frames.length - 1])
    return result
  }

  const handleApiKeyChange = (e) => {
    const key = e.target.value
    setApiKey(key)
    localStorage.setItem("geminiApiKey", key)

    if (key) {
      geminiService.initialize(key)
      setOfflineMode(false)
    }
  }

  const toggleOfflineMode = () => {
    setOfflineMode(!offlineMode)
    geminiService.setOfflineMode(!offlineMode)
  }

  const handleManualProcess = () => {
    // Reset the current video blob reference to force processing
    currentVideoBlobRef.current = null
    processVideo()
  }

  return (
    <div className="sign-interpreter">
      {!apiKey && (
        <div className="api-key-input">
          <label htmlFor="gemini-api-key">Gemini API Key:</label>
          <input
            type="password"
            id="gemini-api-key"
            value={apiKey}
            onChange={handleApiKeyChange}
            placeholder="Enter your Gemini API Key"
          />
          <div className="offline-toggle">
            <label>
              <input type="checkbox" checked={offlineMode} onChange={toggleOfflineMode} />
              Use offline mode (limited functionality)
            </label>
          </div>
        </div>
      )}

      {!autoProcess && (
        <button
          className="process-button"
          onClick={handleManualProcess}
          disabled={isProcessing || !videoBlob || (!apiKey && !offlineMode)}
        >
          {isProcessing ? `Processing... ${progress}%` : "Process Video"}
        </button>
      )}

      {isProcessing && (
        <div className="processing-status">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }}></div>
          </div>
          <p>Processing video: {progress}%</p>
        </div>
      )}

      {error && (
        <div className="error-message">
          <p>{error}</p>
          {isRateLimitError(new Error(error)) && (
            <button className="offline-mode-btn" onClick={toggleOfflineMode}>
              Switch to Offline Mode
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default SignInterpreter
