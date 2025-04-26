"use client"

import { useEffect, useState, useRef } from "react"
import { extractFramesFromVideo } from "../utils/videoUtils"
import geminiService from "../services/GeminiService"

const SignInterpreterOptimized = ({ videoBlob, onInterpretation, autoProcess = false }) => {
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)
  const [apiKey, setApiKey] = useState(
    localStorage.getItem("geminiApiKey") || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "",
  )
  const [offlineMode, setOfflineMode] = useState(false)
  const processingLockRef = useRef(false)
  const videoKey = useRef(0)

  // Initialize Gemini service when API key changes
  useEffect(() => {
    if (apiKey) {
      geminiService.initialize(apiKey)
    }
  }, [apiKey])

  // Process video when it changes
  useEffect(() => {
    if (videoBlob && autoProcess && !isProcessing) {
      processVideo()
    }
  }, [videoBlob, autoProcess])

  const processVideo = async () => {
    if (isProcessing || !videoBlob) return

    try {
      setIsProcessing(true)
      setProgress(0)
      setError(null)

      // Extract frames from video
      console.log("Extracting frames from video...")
      const frames = await extractFramesFromVideo(videoBlob, 5, setProgress)
      console.log(`Extracted ${frames.length} frames from video`)

      if (frames.length === 0) {
        throw new Error("No frames could be extracted from the video")
      }

      // Select key frames
      const keyFrames = selectKeyFrames(frames, Math.min(5, frames.length))
      setProgress(70)

      // Interpret sign language
      const interpretation = await interpretSignLanguage(keyFrames)
      setProgress(100)

      onInterpretation(interpretation)
    } catch (err) {
      console.error("Error processing video:", err)
      setError(`Error processing video: ${err.message}`)
      onInterpretation("")
    } finally {
      setIsProcessing(false)
    }
  }

  // Select key frames from all extracted frames
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

  // Interpret sign language from frames
  const interpretSignLanguage = async (frames) => {
    if (!apiKey) {
      return "Please enter your Gemini API key to interpret sign language."
    }

    if (offlineMode) {
      return "I can see you're using sign language, but I'm currently in offline mode and can't provide a detailed interpretation."
    }

    try {
      // Convert frames to base64
      const processedFrames = frames.map((frame) => ({
        inlineData: {
          mimeType: "image/jpeg",
          data: frame.replace("data:image/jpeg;base64,", ""),
        },
      }))

      // Create prompt for Gemini
      const prompt = `
      Analyze these images showing sign language gestures and provide a clear, concise interpretation.
      
      Focus on:
      1. The specific signs being made
      2. The overall meaning of the message
      3. Any important context or nuance
      
      Format your response in simple, direct language that would be easy for anyone to understand.
      Keep your interpretation brief (2-3 sentences maximum) unless the signing is clearly complex.
      Do NOT include phrases like "The images show..." or "The person is signing..." - just provide the interpretation.
      `

      // Use Gemini service for API calls
      const result = await geminiService.request({
        type: "vision",
        prompt,
        images: processedFrames.map((frame) => ({
          data: frame.inlineData.data,
          mimeType: frame.inlineData.mimeType,
        })),
        temperature: 0.2,
      })

      // Clean up the response
      let cleanedResponse = result.text.trim()

      // Remove common prefixes
      const prefixesToRemove = [
        "The images show ",
        "The person is signing ",
        "The person is making ",
        "In these images, ",
        "Based on the images, ",
        "The individual is signing ",
        "The signer is ",
        "These images depict ",
        "I can see ",
        "This appears to be ",
      ]

      for (const prefix of prefixesToRemove) {
        if (cleanedResponse.startsWith(prefix)) {
          cleanedResponse = cleanedResponse.substring(prefix.length)
          // Capitalize first letter if needed
          cleanedResponse = cleanedResponse.charAt(0).toUpperCase() + cleanedResponse.slice(1)
          break
        }
      }

      return cleanedResponse
    } catch (error) {
      console.error("Error interpreting sign language:", error)
      throw new Error(`Failed to interpret sign language: ${error.message}`)
    }
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

  const clearCacheAndProcess = () => {
    // Clear the Gemini service cache before processing
    geminiService.clearCache()
    // Reset the current video blob reference to force processing
    currentVideoBlobRef.current = null
    processVideo()
  }

  const handleManualProcess = () => {
    clearCacheAndProcess()
  }

  const [lastProcessedBlobSize, setLastProcessedBlobSize] = useState(0)
  const lastProcessedBlobSizeRef = useRef(0)
  const currentVideoBlobRef = useRef(null)
  const processingTimeoutRef = useRef(null)

  useEffect(() => {
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
      // Clear cache before processing new video
      geminiService.clearCache()
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
          <button className="retry-button" onClick={processVideo}>
            Retry
          </button>
        </div>
      )}
    </div>
  )
}

export default SignInterpreterOptimized
