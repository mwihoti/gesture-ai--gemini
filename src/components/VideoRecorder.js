"use client"

import { useRef, useState, useEffect } from "react"

const VideoRecorder = ({ onVideoRecorded }) => {
  const videoRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [recordedChunks, setRecordedChunks] = useState([])
  const [cameraReady, setCameraReady] = useState(false)
  const [error, setError] = useState(null)
  const [cameraPermission, setCameraPermission] = useState("pending") // "pending", "granted", "denied"

  // Set up camera
  useEffect(() => {
    const setupCamera = async () => {
      try {
        setCameraPermission("pending")
        console.log("Requesting camera access...")

        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: 640,
            height: 480,
            facingMode: "user",
            advanced: [{ exposureMode: "auto" }, { focusMode: "continuous" }],
          },
          audio: true,
        })

        console.log("Camera access granted")
        setCameraPermission("granted")

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          streamRef.current = stream
          setCameraReady(true)
          setError(null)

          // Ensure video is playing
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play().catch((e) => console.error("Error playing video:", e))
          }
        }
      } catch (err) {
        console.error("Error accessing camera and microphone:", err)
        setCameraPermission("denied")
        setError("Could not access camera or microphone. Please check permissions.")
        setCameraReady(false)
      }
    }

    setupCamera()

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  // Handle recording timer
  useEffect(() => {
    let interval

    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime((prevTime) => prevTime + 1)
      }, 1000)
    } else {
      setRecordingTime(0)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isRecording])

  const startRecording = () => {
    if (!streamRef.current) {
      console.error("No stream available for recording")
      setError("Camera stream not available. Please refresh and try again.")
      return
    }

    console.log("Starting recording...")
    setRecordedChunks([])

    try {
      // Try different MIME types for better browser compatibility
      let options = { mimeType: "video/webm;codecs=vp9,opus" }

      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        console.log(`${options.mimeType} is not supported, trying video/webm;codecs=vp8,opus`)
        options = { mimeType: "video/webm;codecs=vp8,opus" }

        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          console.log(`${options.mimeType} is not supported, trying video/webm`)
          options = { mimeType: "video/webm" }

          if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            console.log(`${options.mimeType} is not supported, trying video/mp4`)
            options = { mimeType: "video/mp4" }
          }
        }
      }

      // Create a new MediaRecorder instance
      const recorder = new MediaRecorder(streamRef.current, options)
      mediaRecorderRef.current = recorder

      // Set up more frequent data collection with shorter timeslice
      const chunks = []

      recorder.ondataavailable = (event) => {
        console.log("Data available event:", event.data?.size || 0, "bytes")
        if (event.data && event.data.size > 0) {
          chunks.push(event.data)
          setRecordedChunks((prev) => [...prev, event.data])
        }
      }

      recorder.onstop = () => {
        console.log("Recording stopped, chunks:", chunks.length)
        if (chunks.length) {
          const blob = new Blob(chunks, {
            type: chunks[0].type || "video/webm",
          })
          console.log("Created video blob:", blob.size, "bytes, type:", blob.type)
          onVideoRecorded(blob)
        } else {
          console.warn("No recorded chunks available")
          setError("No video data was captured. Please try recording again.")
        }
      }

      recorder.onerror = (event) => {
        console.error("MediaRecorder error:", event)
        setError("Recording error occurred. Please try again.")
        setIsRecording(false)
      }

      // Start recording with a timeslice of 100ms for more frequent ondataavailable events
      recorder.start(100)
      setIsRecording(true)
      console.log("Recording started")
    } catch (e) {
      console.error("MediaRecorder error:", e)
      setError(`Recording not supported in this browser: ${e.message}`)
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      console.log("Stopping recording...")
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    } else {
      console.warn("Tried to stop recording, but no active recording found")
    }
  }

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
  }

  const retryCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
    }
    setError(null)
    setCameraPermission("pending")

    // Re-initialize camera
    const setupCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: 640,
            height: 480,
            facingMode: "user",
            advanced: [{ exposureMode: "auto" }, { focusMode: "continuous" }],
          },
          audio: true,
        })

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          streamRef.current = stream
          setCameraReady(true)
          setCameraPermission("granted")
          setError(null)

          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play().catch((e) => console.error("Error playing video:", e))
          }
        }
      } catch (err) {
        console.error("Error accessing camera and microphone:", err)
        setCameraPermission("denied")
        setError("Could not access camera or microphone. Please check permissions.")
        setCameraReady(false)
      }
    }

    setupCamera()
  }

  return (
    <div className="video-recorder">
      {error && (
        <div className="error-message">
          <p>{error}</p>
          <button className="retry-button" onClick={retryCamera}>
            Retry Camera Access
          </button>
        </div>
      )}

      {cameraPermission === "pending" && (
        <div className="camera-loading">
          <div className="spinner"></div>
          <p>Requesting camera access...</p>
        </div>
      )}

      {cameraPermission === "denied" && !error && (
        <div className="permission-denied">
          <p>Camera access was denied. Please allow camera access to use this feature.</p>
          <button className="retry-button" onClick={retryCamera}>
            Retry Camera Access
          </button>
        </div>
      )}

      <div className="video-preview">
        <video
          ref={videoRef}
          className={cameraReady ? "active" : "inactive"}
          autoPlay
          playsInline
          muted
          style={{ filter: "brightness(1.2) contrast(1.1)" }}
        />

        {isRecording && (
          <div className="recording-indicator">
            <span className="recording-dot"></span>
            <span className="recording-time">{formatTime(recordingTime)}</span>
          </div>
        )}

        {!cameraReady && !error && cameraPermission !== "denied" && (
          <div className="camera-placeholder">
            <div className="camera-icon">📹</div>
            <p>Camera initializing...</p>
          </div>
        )}

        <div className="camera-controls">
          <label>
            <span>Brightness:</span>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              defaultValue="1.2"
              onChange={(e) => {
                if (videoRef.current) videoRef.current.style.filter = `brightness(${e.target.value}) contrast(1.1)`
              }}
            />
          </label>
        </div>
      </div>

      <div className="recording-controls">
        {!isRecording ? (
          <button className="start-recording" onClick={startRecording} disabled={!cameraReady}>
            <span className="button-icon">🎥</span> Start Recording
          </button>
        ) : (
          <button className="stop-recording" onClick={stopRecording}>
            <span className="button-icon">⏹️</span> Stop Recording
          </button>
        )}
      </div>

      <div className="recording-instructions">
        <h4>Recording Tips:</h4>
        <ul>
          <li>Make sure you're well lit and visible in the camera</li>
          <li>Sign clearly and at a moderate pace</li>
          <li>Keep your hands within the frame</li>
          <li>Record for at least 3-5 seconds for best results</li>
        </ul>
      </div>
    </div>
  )
}

export default VideoRecorder
