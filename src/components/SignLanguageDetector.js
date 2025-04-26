"use client"

import { useRef, useState, useEffect } from "react"
import handTrackingService from "../services/HandTrackingService"
import signLanguageProcessor from "../services/SignLanguageProcessor"

const SignLanguageDetector = ({ onSignsDetected, onInterpretation }) => {
  const webcamRef = useRef(null)
  const canvasRef = useRef(null)
  const [isDetecting, setIsDetecting] = useState(false)
  const [detectedSigns, setDetectedSigns] = useState([])
  const [modelLoading, setModelLoading] = useState(true)
  const [deviceCapabilities, setDeviceCapabilities] = useState(null)
  const [brightness, setBrightness] = useState(1.2)
  const [contrast, setContrast] = useState(1.1)
  const [apiKey, setApiKey] = useState(
    localStorage.getItem("geminiApiKey") || process.env.REACT_APP_GEMINI_API_KEY || "",
  )
  const [cameraError, setCameraError] = useState(false)

  // Initialize services
  useEffect(() => {
    const initialize = async () => {
      try {
        setModelLoading(true)

        // Check device capabilities
        const capabilities = await handTrackingService.getDeviceCapabilities()
        setDeviceCapabilities(capabilities)

        // Initialize sign language processor
        await signLanguageProcessor.initialize(apiKey, {
          gpuAcceleration: capabilities.webgl2 || capabilities.webgl,
          offlineMode: !apiKey,
        })

        // Register callbacks
        signLanguageProcessor.onTokens((tokens) => {
          if (tokens && tokens.tokens) {
            const signs = tokens.tokens.map((token) => ({
              sign: token.value,
              confidence: token.confidence,
            }))
            setDetectedSigns(signs)
            onSignsDetected && onSignsDetected(signs)
          }
        })

        signLanguageProcessor.onInterpretation((interpretation) => {
          onInterpretation && onInterpretation(interpretation.interpretation)
        })

        setModelLoading(false)
      } catch (error) {
        console.error("Error initializing sign language detector:", error)
        setModelLoading(false)
      }
    }

    initialize()

    // Cleanup
    return () => {
      signLanguageProcessor.dispose()
    }
  }, [apiKey, onSignsDetected, onInterpretation])

  // Start/stop detection
  useEffect(() => {
    if (isDetecting && webcamRef.current) {
      signLanguageProcessor.startProcessing(webcamRef.current)
    } else if (!isDetecting) {
      signLanguageProcessor.stopProcessing()
    }

    return () => {
      signLanguageProcessor.stopProcessing()
    }
  }, [isDetecting])

  // Set up camera - IMPORTANT: This is where we need to fix the camera issue
  useEffect(() => {
    const setupCamera = async () => {
      if (!webcamRef.current) return

      try {
        // Check if there's already a stream
        if (webcamRef.current.srcObject) {
          console.log("Camera already set up, skipping initialization")
          return
        }

        console.log("Setting up camera for SignLanguageDetector")
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: 640,
            height: 480,
            facingMode: "user",
            advanced: [{ exposureMode: "continuous" }, { focusMode: "continuous" }],
          },
        })

        webcamRef.current.srcObject = stream
        webcamRef.current.onloadedmetadata = () => {
          webcamRef.current.play().catch((e) => {
            console.error("Error playing video:", e)
            setCameraError(true)
          })
        }
        setCameraError(false)
      } catch (error) {
        console.error("Error accessing camera:", error)
        setCameraError(true)
      }
    }

    // Call setupCamera immediately when component mounts
    setupCamera()

    // Cleanup function
    return () => {
      // Don't stop the camera here, as it might be used by other components
      // We'll handle camera cleanup at the application level
    }
  }, [])

  const toggleDetection = () => {
    setIsDetecting((prev) => !prev)
  }

  const handleBrightnessChange = (e) => {
    const value = Number.parseFloat(e.target.value)
    setBrightness(value)
    if (webcamRef.current) {
      webcamRef.current.style.filter = `brightness(${value}) contrast(${contrast})`
    }
  }

  const handleContrastChange = (e) => {
    const value = Number.parseFloat(e.target.value)
    setContrast(value)
    if (webcamRef.current) {
      webcamRef.current.style.filter = `brightness(${brightness}) contrast(${value})`
    }
  }

  const enhanceVisibility = () => {
    const newBrightness = 1.5
    const newContrast = 1.2
    setBrightness(newBrightness)
    setContrast(newContrast)
    if (webcamRef.current) {
      webcamRef.current.style.filter = `brightness(${newBrightness}) contrast(${newContrast})`
    }
  }

  return (
    <div className="sign-language-detector">
      {modelLoading ? (
        <div className="loading-model">
          <div className="spinner"></div>
          <p>Loading sign language detection model...</p>
          {deviceCapabilities && !deviceCapabilities.webgl && (
            <p className="warning">WebGL not detected. Performance may be limited.</p>
          )}
        </div>
      ) : (
        <>
          <div className="webcam-container">
            <video
              ref={webcamRef}
              className="webcam"
              autoPlay
              playsInline
              muted
              style={{ filter: `brightness(${brightness}) contrast(${contrast})` }}
            />
            <canvas ref={canvasRef} className="canvas-overlay" />

            {detectedSigns.length > 0 && (
              <div className="detected-sign-overlay">
                <span>{detectedSigns[0].sign}</span>
              </div>
            )}

            <div className="camera-controls">
              <label>
                <span>Brightness:</span>
                <input type="range" min="0.5" max="2" step="0.1" value={brightness} onChange={handleBrightnessChange} />
              </label>
              <label>
                <span>Contrast:</span>
                <input type="range" min="0.5" max="2" step="0.1" value={contrast} onChange={handleContrastChange} />
              </label>
            </div>
          </div>

          {cameraError && (
            <div className="error-message">
              <p>Camera access error. Please check your camera permissions and refresh the page.</p>
              <button className="retry-button" onClick={() => window.location.reload()}>
                Retry Camera Access
              </button>
            </div>
          )}

          <div className="video-controls">
            <button className="enhance-visibility-btn" onClick={enhanceVisibility}>
              💡 Enhance Visibility
            </button>
          </div>

          <div className="controls">
            <button className={`detection-toggle ${isDetecting ? "active" : ""}`} onClick={toggleDetection}>
              {isDetecting ? "Pause Detection" : "Start Detection"}
            </button>

            <div className="detected-signs">
              <h3>Detected Signs:</h3>
              <ul>
                {detectedSigns.map((item, index) => (
                  <li key={index}>
                    <span className="sign">{item.sign}</span>
                    <span className="confidence">({Math.round(item.confidence * 100)}%)</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

export default SignLanguageDetector
