"use client"

import { useRef, useState, useEffect } from "react"
import * as tf from "@tensorflow/tfjs"
import * as handpose from "@tensorflow-models/handpose"
import { Finger, FingerCurl, FingerDirection, GestureDescription, GestureEstimator } from "fingerpose"
import { GoogleGenerativeAI } from "@google/generative-ai"
import SignLanguagePage from "./pages/SignLanguagePage"
import ImageProcessorPage from "./pages/ImageProcessorPage"
import "./App.css"

// Define the thumbs up gesture
const THUMBS_UP = new GestureDescription("thumbs_up")
THUMBS_UP.addCurl(Finger.Thumb, FingerCurl.NoCurl, 1.0)
THUMBS_UP.addDirection(Finger.Thumb, FingerDirection.VerticalUp, 1.0)
for (const finger of [Finger.Index, Finger.Middle, Finger.Ring, Finger.Pinky]) {
  THUMBS_UP.addCurl(finger, FingerCurl.FullCurl, 1.0)
  THUMBS_UP.addDirection(finger, FingerDirection.VerticalDown, 1.0)
}

// Define the victory/peace sign gesture
const VICTORY = new GestureDescription("victory")
VICTORY.addCurl(Finger.Index, FingerCurl.NoCurl, 1.0)
VICTORY.addCurl(Finger.Middle, FingerCurl.NoCurl, 1.0)
for (const finger of [Finger.Ring, Finger.Pinky]) {
  VICTORY.addCurl(finger, FingerCurl.FullCurl, 1.0)
}
VICTORY.addCurl(Finger.Thumb, FingerCurl.HalfCurl, 0.5)

function App() {
  const [activeView, setActiveView] = useState("gesture") // "gesture", "signLanguage", or "imageProcessor"
  const webcamRef = useRef(null)
  const canvasRef = useRef(null)
  const [message, setMessage] = useState("👋 Show a gesture to Gemini!")
  const [isDetecting, setIsDetecting] = useState(false)
  const [capturedImage, setCapturedImage] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [handposeModel, setHandposeModel] = useState(null)
  const [gestureEstimator, setGestureEstimator] = useState(null)
  const [apiKey, setApiKey] = useState("")
  const [modelLoading, setModelLoading] = useState(true)
  const [detectedGesture, setDetectedGesture] = useState(null)
  const [gestureHistory, setGestureHistory] = useState([])
  const [cameraError, setCameraError] = useState(false)

  // Initialize models and camera
  useEffect(() => {
    const loadModels = async () => {
      try {
        setModelLoading(true)
        // Load TensorFlow.js and handpose model
        await tf.ready()
        console.log("TensorFlow.js loaded")

        const net = await handpose.load()
        setHandposeModel(net)
        console.log("Handpose model loaded")

        // Initialize gesture estimator with multiple gestures
        const GE = new GestureEstimator([THUMBS_UP, VICTORY])
        setGestureEstimator(GE)
        console.log("Gesture estimator initialized")

        setModelLoading(false)
      } catch (error) {
        console.error("Failed to load models:", error)
        setMessage("Error loading models. Please refresh and try again.")
        setModelLoading(false)
      }
    }

    const setupCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: 640,
            height: 480,
            facingMode: "user",
          },
        })

        if (webcamRef.current) {
          webcamRef.current.srcObject = stream
          webcamRef.current.onloadedmetadata = () => {
            webcamRef.current.play()
          }
        }

        console.log("Camera setup complete")
        setCameraError(false)
      } catch (error) {
        console.error("Failed to access camera:", error)
        setMessage("Error accessing camera. Please check permissions and try again.")
        setCameraError(true)
      }
    }

    // Check for API key in localStorage or environment
    const storedApiKey = localStorage.getItem("geminiApiKey") || process.env.REACT_APP_GEMINI_API_KEY
    if (storedApiKey) {
      setApiKey(storedApiKey)
      console.log("API key loaded successfully")
    }

    if (activeView === "gesture") {
      loadModels()
      setupCamera()
    }

    // Cleanup function
    return () => {
      if (webcamRef.current && webcamRef.current.srcObject) {
        const tracks = webcamRef.current.srcObject.getTracks()
        tracks.forEach((track) => track.stop())
      }
    }
  }, [activeView])

  // Start/stop gesture detection
  useEffect(() => {
    let detectionInterval

    if (isDetecting && handposeModel && gestureEstimator) {
      detectionInterval = setInterval(detectGestures, 500)
    }

    return () => {
      if (detectionInterval) clearInterval(detectionInterval)
    }
  }, [isDetecting, handposeModel, gestureEstimator])

  // Detect hand gestures
  const detectGestures = async () => {
    if (webcamRef.current && webcamRef.current.readyState === 4 && handposeModel && gestureEstimator) {
      try {
        // Get video properties
        const video = webcamRef.current

        // Make hand predictions
        const predictions = await handposeModel.estimateHands(video)

        // Draw hands on canvas if available
        if (canvasRef.current) {
          const ctx = canvasRef.current.getContext("2d")
          ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height)

          // Draw video frame
          ctx.drawImage(video, 0, 0, canvasRef.current.width, canvasRef.current.height)

          // Draw hand landmarks
          if (predictions.length > 0) {
            drawHand(predictions[0].landmarks, ctx)

            // Estimate gestures
            const est = gestureEstimator.estimate(predictions[0].landmarks, 7.5)

            if (est.gestures.length > 0) {
              // Find gesture with highest confidence
              const gesture = est.gestures.reduce((prev, current) => (prev.score > current.score ? prev : current))

              console.log("Detected gesture:", gesture.name, "with confidence:", gesture.score)

              // Update the detected gesture state
              setDetectedGesture({
                name: gesture.name,
                confidence: gesture.score.toFixed(2),
              })

              // Process specific gestures
              if (gesture.score > 8) {
                if (gesture.name === "thumbs_up") {
                  setMessage("👍 Thumbs up detected!")
                  captureImage("thumbs_up")
                } else if (gesture.name === "victory") {
                  setMessage("✌️ Peace sign detected!")
                  captureImage("victory")
                }
              }
            } else {
              setDetectedGesture(null)
            }
          } else {
            setDetectedGesture(null)
          }
        }
      } catch (error) {
        console.error("Error in gesture detection:", error)
      }
    }
  }

  // Draw hand landmarks on canvas
  const drawHand = (landmarks, ctx) => {
    // Draw joints
    for (let i = 0; i < landmarks.length; i++) {
      const [x, y] = landmarks[i]
      ctx.beginPath()
      ctx.arc(x, y, 5, 0, 3 * Math.PI)

      // Color-code different parts of the hand
      if (i === 0) {
        // Palm base
        ctx.fillStyle = "#FF5733" // Orange-red
      } else if (i >= 1 && i <= 4) {
        // Thumb
        ctx.fillStyle = "#33FF57" // Green
      } else if (i >= 5 && i <= 8) {
        // Index finger
        ctx.fillStyle = "#3357FF" // Blue
      } else if (i >= 9 && i <= 12) {
        // Middle finger
        ctx.fillStyle = "#FF33F5" // Pink
      } else if (i >= 13 && i <= 16) {
        // Ring finger
        ctx.fillStyle = "#F5FF33" // Yellow
      } else {
        // Pinky
        ctx.fillStyle = "#33FFF5" // Cyan
      }

      ctx.fill()
    }

    // Draw connections
    const fingerJoints = {
      thumb: [0, 1, 2, 3, 4],
      indexFinger: [0, 5, 6, 7, 8],
      middleFinger: [0, 9, 10, 11, 12],
      ringFinger: [0, 13, 14, 15, 16],
      pinky: [0, 17, 18, 19, 20],
    }

    // Draw paths with different colors for each finger
    const fingerColors = {
      thumb: "#33FF57", // Green
      indexFinger: "#3357FF", // Blue
      middleFinger: "#FF33F5", // Pink
      ringFinger: "#F5FF33", // Yellow
      pinky: "#33FFF5", // Cyan
    }

    // Draw paths
    for (const finger in fingerJoints) {
      const points = fingerJoints[finger]
      for (let i = 0; i < points.length - 1; i++) {
        const firstJointIndex = points[i]
        const secondJointIndex = points[i + 1]

        ctx.beginPath()
        ctx.moveTo(landmarks[firstJointIndex][0], landmarks[firstJointIndex][1])
        ctx.lineTo(landmarks[secondJointIndex][0], landmarks[secondJointIndex][1])
        ctx.strokeStyle = fingerColors[finger]
        ctx.lineWidth = 3
        ctx.stroke()
      }
    }
  }

  // Capture image from webcam
  const captureImage = (gestureName) => {
    if (webcamRef.current && canvasRef.current) {
      const canvas = canvasRef.current
      const context = canvas.getContext("2d")

      // Draw the current video frame to the canvas
      context.drawImage(webcamRef.current, 0, 0, canvas.width, canvas.height)

      // Convert canvas to data URL
      const imageDataUrl = canvas.toDataURL("image/jpeg")
      setCapturedImage(imageDataUrl)

      // Analyze the image with Gemini
      analyzeImageWithGemini(imageDataUrl, gestureName)
    }
  }

  // Analyze image with Gemini Vision
  const analyzeImageWithGemini = async (imageDataUrl, gestureName) => {
    if (!apiKey) {
      setMessage("Please enter your Gemini API key first")
      return
    }

    try {
      setIsLoading(true)
      setMessage(`Analyzing ${gestureName || "gesture"} with Gemini...`)

      // Initialize Gemini
      const genAI = new GoogleGenerativeAI(apiKey)

      // Convert data URL to blob
      const blob = dataURLtoBlob(imageDataUrl)

      // Get the Gemini Vision model - UPDATED to use the newer model
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

      // Create prompt parts with the image
      const prompt = gestureName
        ? `This is a ${gestureName} hand gesture. Describe what this gesture typically means in human communication and different cultural contexts. Be concise but informative.`
        : "Describe the hand gesture in this image in detail. What does this gesture typically mean in human communication?"

      // Convert blob to base64 data
      const imageData = await blobToBase64(blob)

      // Prepare parts for the model
      const parts = [
        { text: prompt },
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: imageData,
          },
        },
      ]

      // Generate content
      const result = await model.generateContent({ contents: [{ parts }] })
      const response = await result.response
      const text = response.text()

      // Add to gesture history
      const timestamp = new Date().toLocaleTimeString()
      setGestureHistory((prev) => [
        {
          gesture: gestureName || "unknown",
          timestamp,
          response: text,
          image: imageDataUrl,
        },
        ...prev.slice(0, 4), // Keep only the 5 most recent entries
      ])

      setMessage(text)

      // Optional: Read the response aloud
      if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(text)
        utterance.rate = 1.0
        window.speechSynthesis.speak(utterance)
      }
    } catch (error) {
      console.error("Error analyzing image with Gemini:", error)
      setMessage(`Error analyzing image: ${error.message}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Helper function to convert data URL to blob
  const dataURLtoBlob = (dataURL) => {
    const arr = dataURL.split(",")
    const mime = arr[0].match(/:(.*?);/)[1]
    const bstr = atob(arr[1])
    let n = bstr.length
    const u8arr = new Uint8Array(n)

    while (n--) {
      u8arr[n] = bstr.charCodeAt(n)
    }

    return new Blob([u8arr], { type: mime })
  }

  // Helper function to convert blob to base64
  const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64String = reader.result.split(",")[1]
        resolve(base64String)
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  // Save API key
  const handleApiKeyChange = (e) => {
    const key = e.target.value
    setApiKey(key)
    localStorage.setItem("geminiApiKey", key)
  }

  // Toggle gesture detection
  const toggleDetection = () => {
    setIsDetecting((prev) => !prev)
    if (!isDetecting) {
      setMessage("Gesture detection started. Show a thumbs up or peace sign to capture!")
    } else {
      setMessage("Gesture detection paused.")
    }
  }

  // Clear gesture history
  const clearHistory = () => {
    setGestureHistory([])
  }

  // Toggle between views
  const toggleView = (view) => {
    setActiveView(view)
  }

  // Render the gesture recognition UI
  const renderGestureRecognition = () => {
    return (
      <div
        className="App"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "20px",
          fontFamily: "Arial, sans-serif",
          maxWidth: "1200px",
          margin: "0 auto",
          backgroundColor: "#f8f9fa",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            width: "100%",
            marginBottom: "20px",
            alignItems: "center",
          }}
        >
          <h1 style={{ fontSize: "28px", color: "#333" }}>🖐️ GestureAI + Gemini 🤖</h1>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              onClick={() => toggleView("signLanguage")}
              style={{
                padding: "10px 15px",
                backgroundColor: "#4caf50",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <span>🤟</span> Sign Language Page
            </button>
            <button
              onClick={() => toggleView("imageProcessor")}
              style={{
                padding: "10px 15px",
                backgroundColor: "#9c27b0",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
                display: "flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              <span>📷</span> Image Processor
            </button>
          </div>
        </div>

        {/* API Key Input */}
        <div style={{ width: "100%", maxWidth: "640px", marginBottom: "20px" }}>
          <input
            type="password"
            value={apiKey}
            onChange={handleApiKeyChange}
            placeholder="Enter your Gemini API Key"
            style={{
              width: "100%",
              padding: "10px",
              border: "1px solid #ccc",
              borderRadius: "4px",
              fontSize: "14px",
            }}
          />
        </div>

        {/* Loading indicator for model */}
        {modelLoading && (
          <div
            style={{
              padding: "20px",
              backgroundColor: "#e9f5ff",
              borderRadius: "8px",
              marginBottom: "20px",
              width: "100%",
              maxWidth: "640px",
              textAlign: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span
                style={{
                  display: "inline-block",
                  animation: "spin 1s linear infinite",
                  marginRight: "10px",
                  fontSize: "20px",
                }}
              >
                ⟳
              </span>
              <span>Loading handpose model... This may take a moment.</span>
            </div>
          </div>
        )}

        {/* Camera error message */}
        {cameraError && (
          <div
            style={{
              padding: "20px",
              backgroundColor: "#ffebee",
              borderRadius: "8px",
              marginBottom: "20px",
              width: "100%",
              maxWidth: "640px",
              textAlign: "center",
              color: "#c62828",
            }}
          >
            <p>Camera access error. Please check your camera permissions and refresh the page.</p>
          </div>
        )}

        <div
          style={{
            display: "flex",
            flexDirection: "row",
            flexWrap: "wrap",
            gap: "20px",
            width: "100%",
            justifyContent: "center",
          }}
        >
          {/* Left column - Camera and controls */}
          <div style={{ flex: "1", minWidth: "300px", maxWidth: "640px" }}>
            <div style={{ position: "relative", width: "100%", marginBottom: "20px" }}>
              {/* Webcam */}
              <video
                ref={webcamRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={() => webcamRef.current.play()}
                style={{
                  width: "100%",
                  height: "auto",
                  border: "2px solid #ccc",
                  borderRadius: "8px",
                  transform: "scaleX(-1)",
                  backgroundColor: "#000",
                }}
              />

              {/* Canvas overlay for drawing hand landmarks */}
              <canvas
                ref={canvasRef}
                width={640}
                height={480}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: "100%",
                  height: "100%",
                  transform: "scaleX(-1)",
                }}
              />

              {/* Gesture label overlay */}
              {detectedGesture && (
                <div
                  style={{
                    position: "absolute",
                    top: "10px",
                    left: "10px",
                    backgroundColor: "rgba(0,0,0,0.6)",
                    color: "white",
                    padding: "5px 10px",
                    borderRadius: "4px",
                    fontSize: "14px",
                  }}
                >
                  {detectedGesture.name === "thumbs_up"
                    ? "👍 Thumbs Up"
                    : detectedGesture.name === "victory"
                      ? "✌️ Peace Sign"
                      : detectedGesture.name}{" "}
                  ({detectedGesture.confidence})
                </div>
              )}
            </div>

            {/* Controls */}
            <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
              <button
                onClick={toggleDetection}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 16px",
                  backgroundColor: isDetecting ? "#ef4444" : "#3b82f6",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                {isDetecting ? (
                  <>
                    <span style={{ display: "inline-block", animation: "spin 1s linear infinite" }}>⟳</span>
                    Stop Detection
                  </>
                ) : (
                  <>✋ Start Detection</>
                )}
              </button>

              <button
                onClick={() => captureImage()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 16px",
                  backgroundColor: "white",
                  color: "#333",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  cursor: "pointer",
                  fontWeight: "bold",
                }}
              >
                📷 Capture Now
              </button>
            </div>

            {/* Instructions */}
            <div
              style={{
                padding: "15px",
                backgroundColor: "#f0f4f8",
                borderRadius: "8px",
                marginBottom: "20px",
                fontSize: "14px",
              }}
            >
              <h3 style={{ marginTop: 0, marginBottom: "10px" }}>Instructions:</h3>
              <ol style={{ margin: 0, paddingLeft: "20px" }}>
                <li>Click "Start Detection" to begin tracking hand gestures</li>
                <li>Show a thumbs up 👍 or peace sign ✌️ to automatically capture</li>
                <li>Or click "Capture Now" to manually take a picture</li>
                <li>Gemini will analyze and interpret your gesture</li>
              </ol>
              <div style={{ marginTop: "15px", textAlign: "center" }}>
                <button
                  onClick={() => toggleView("signLanguage")}
                  style={{
                    padding: "12px 20px",
                    backgroundColor: "#6200ea",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontWeight: "bold",
                    display: "flex",
                    alignItems: "center",
                    margin: "0 auto",
                    gap: "8px",
                  }}
                >
                  <span style={{ fontSize: "20px" }}>🤟</span> Visit Sign Language Interpreter
                </button>
              </div>
            </div>

            {/* Message display */}
            <div
              style={{
                width: "100%",
                padding: "16px",
                backgroundColor: "white",
                border: "1px solid #ccc",
                borderRadius: "8px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                marginBottom: "20px",
              }}
            >
              <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "8px" }}>Gemini's Response:</h2>
              {isLoading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
                  <span style={{ display: "inline-block", animation: "spin 1s linear infinite", marginRight: "8px" }}>
                    ⟳
                  </span>
                  Analyzing...
                </div>
              ) : (
                <p style={{ whiteSpace: "pre-line", lineHeight: "1.5" }}>{message}</p>
              )}
            </div>
          </div>

          {/* Right column - Captured image and history */}
          <div style={{ flex: "1", minWidth: "300px", maxWidth: "500px" }}>
            {/* Captured image display */}
            {capturedImage && (
              <div style={{ marginBottom: "20px" }}>
                <h2 style={{ fontSize: "18px", fontWeight: "600", marginBottom: "8px" }}>Captured Image:</h2>
                <img
                  src={capturedImage || "/placeholder.svg"}
                  alt="Captured gesture"
                  style={{
                    width: "100%",
                    height: "auto",
                    border: "1px solid #ccc",
                    borderRadius: "8px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                  }}
                />
              </div>
            )}

            {/* Gesture history */}
            {gestureHistory.length > 0 && (
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "10px",
                  }}
                >
                  <h2 style={{ fontSize: "18px", fontWeight: "600", margin: 0 }}>Gesture History:</h2>
                  <button
                    onClick={clearHistory}
                    style={{
                      padding: "5px 10px",
                      backgroundColor: "#f1f1f1",
                      border: "1px solid #ccc",
                      borderRadius: "4px",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                  >
                    Clear History
                  </button>
                </div>

                <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                  {gestureHistory.map((item, index) => (
                    <div
                      key={index}
                      style={{
                        marginBottom: "15px",
                        padding: "10px",
                        backgroundColor: "white",
                        borderRadius: "8px",
                        border: "1px solid #eee",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                        <span style={{ fontWeight: "bold" }}>
                          {item.gesture === "thumbs_up"
                            ? "👍 Thumbs Up"
                            : item.gesture === "victory"
                              ? "✌️ Peace Sign"
                              : item.gesture}
                        </span>
                        <span style={{ fontSize: "12px", color: "#666" }}>{item.timestamp}</span>
                      </div>
                      <div style={{ display: "flex", gap: "10px" }}>
                        <img
                          src={item.image || "/placeholder.svg"}
                          alt={`${item.gesture} gesture`}
                          style={{
                            width: "80px",
                            height: "60px",
                            objectFit: "cover",
                            borderRadius: "4px",
                          }}
                        />
                        <p
                          style={{
                            margin: 0,
                            fontSize: "12px",
                            flex: 1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            display: "-webkit-box",
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: "vertical",
                          }}
                        >
                          {item.response}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <style>
          {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
        </style>
      </div>
    )
  }

  return (
    <div className="app-container">
      {activeView === "gesture" ? (
        renderGestureRecognition()
      ) : activeView === "signLanguage" ? (
        <div className="sign-language-container">
          <div className="view-toggle" style={{ padding: "10px", textAlign: "right" }}>
            <button
              onClick={() => toggleView("gesture")}
              style={{
                padding: "10px 15px",
                backgroundColor: "#6200ea",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
                marginRight: "10px",
              }}
            >
              Switch to Gesture Recognition
            </button>
            <button
              onClick={() => toggleView("imageProcessor")}
              style={{
                padding: "10px 15px",
                backgroundColor: "#9c27b0",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Switch to Image Processor
            </button>
          </div>
          <SignLanguagePage />
        </div>
      ) : (
        <div className="image-processor-container">
          <div className="view-toggle" style={{ padding: "10px", textAlign: "right" }}>
            <button
              onClick={() => toggleView("gesture")}
              style={{
                padding: "10px 15px",
                backgroundColor: "#6200ea",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
                marginRight: "10px",
              }}
            >
              Switch to Gesture Recognition
            </button>
            <button
              onClick={() => toggleView("signLanguage")}
              style={{
                padding: "10px 15px",
                backgroundColor: "#4caf50",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              Switch to Sign Language
            </button>
          </div>
          <ImageProcessorPage />
        </div>
      )}
    </div>
  )
}

export default App
