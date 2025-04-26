"use client"

import { useState, useEffect, useRef } from "react"
import VideoRecorder from "../components/VideoRecorder"
import SignInterpreterOptimized from "../components/SignInterpreterOptimized"
import LearningModule from "../components/LearningModule"
import CommunicationInterface from "../components/CommunicationInterface"
import "../styles/SignLanguagePage.css"

const SignLanguagePage = () => {
  const [activeTab, setActiveTab] = useState("record")
  const [recordedVideo, setRecordedVideo] = useState(null)
  const [detectedSigns, setDetectedSigns] = useState([])
  const [interpretation, setInterpretation] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showTutorial, setShowTutorial] = useState(false)
  const videoKey = useRef(0)
  const videoPlayerRef = useRef(null)

  // Handle video recorded from VideoRecorder component
  const handleVideoRecorded = (videoBlob) => {
    // Increment the key to force re-render of the SignInterpreterOptimized component
    videoKey.current += 1

    // Set the recorded video
    setRecordedVideo(videoBlob)

    // Set the video source for the player
    if (videoPlayerRef.current) {
      // Revoke any existing object URL to prevent memory leaks
      if (videoPlayerRef.current.src) {
        URL.revokeObjectURL(videoPlayerRef.current.src)
      }
      const url = URL.createObjectURL(videoBlob)
      videoPlayerRef.current.src = url
    }

    // Clear Gemini service cache to ensure fresh analysis
    if (window.geminiService) {
      window.geminiService.clearCache()
    }

    // Automatically start interpretation
    setIsLoading(true)

    console.log("Video recorded, size:", videoBlob.size, "bytes, type:", videoBlob.type)
  }

  const handleSignsDetected = (signs) => {
    setDetectedSigns(signs)
  }

  const handleInterpretation = (text) => {
    setInterpretation(text)
    setIsLoading(false)
  }

  // Manually trigger interpretation
  const handleInterpretVideo = () => {
    if (recordedVideo) {
      // Increment the key to force re-render
      videoKey.current += 1
      // Clear cache before reinterpreting
      if (window.geminiService) {
        window.geminiService.clearCache()
      }
      setIsLoading(true)
    }
  }

  // Clean up object URLs when component unmounts
  useEffect(() => {
    return () => {
      if (videoPlayerRef.current && videoPlayerRef.current.src) {
        URL.revokeObjectURL(videoPlayerRef.current.src)
      }
    }
  }, [])

  return (
    <div className="sign-language-page">
      <header className="header">
        <h1>Sign Language Interpreter</h1>
        <div className="tab-navigation">
          <button className={activeTab === "communicate" ? "active" : ""} onClick={() => setActiveTab("communicate")}>
            <span className="tab-icon">💬</span> Communicate
          </button>
          <button className={activeTab === "learn" ? "active" : ""} onClick={() => setActiveTab("learn")}>
            <span className="tab-icon">📚</span> Learn Sign Language
          </button>
          <button className={activeTab === "record" ? "active" : ""} onClick={() => setActiveTab("record")}>
            <span className="tab-icon">🎥</span> Record & Interpret
          </button>
        </div>
        <button className="help-button" onClick={() => setShowTutorial(true)}>
          <span className="help-icon">❓</span> How to Use
        </button>
      </header>

      <main className="main-content">
        {activeTab === "communicate" && (
          <div className="communicate-section">
            <h2>
              <span className="section-icon">🤲</span> Real-time Communication
            </h2>
            <p>
              Use sign language in front of your camera to communicate. The AI will interpret your signs in real-time.
            </p>
            <div className="communication-interface-container">
              <CommunicationInterface onSignsDetected={handleSignsDetected} onInterpretation={handleInterpretation} />
            </div>
          </div>
        )}

        {activeTab === "learn" && (
          <div className="learn-section">
            <h2>
              <span className="section-icon">📚</span> Learn Sign Language
            </h2>
            <p>Practice sign language with feedback from our AI interpreter.</p>
            <LearningModule />
          </div>
        )}

        {activeTab === "record" && (
          <div className="record-section">
            <h2>
              <span className="section-icon">🎥</span> Record & Interpret Sign Language
            </h2>
            <p>Record a video of sign language and get an interpretation.</p>

            <div className="video-recorder-container">
              <VideoRecorder onVideoRecorded={handleVideoRecorded} />
            </div>

            {recordedVideo && (
              <div className="recorded-video-container">
                <h3>Recorded Video</h3>
                <video ref={videoPlayerRef} controls width="100%" height="auto" />
                <button className="interpret-button" onClick={handleInterpretVideo} disabled={isLoading}>
                  {isLoading ? "Interpreting..." : "Interpret Sign Language"}
                </button>

                {isLoading && (
                  <div className="loading-indicator">
                    <div className="spinner"></div>
                    <p>Analyzing sign language...</p>
                  </div>
                )}

                {interpretation && (
                  <div className="interpretation-result">
                    <h3>Interpretation</h3>
                    <p>{interpretation}</p>
                  </div>
                )}

                {/* Use key to force re-render when a new video is recorded */}
                <SignInterpreterOptimized
                  key={videoKey.current}
                  videoBlob={recordedVideo}
                  onInterpretation={handleInterpretation}
                  autoProcess={true}
                />
              </div>
            )}
          </div>
        )}
      </main>

      {showTutorial && (
        <div className="tutorial-overlay">
          <div className="tutorial-content">
            <button className="close-tutorial" onClick={() => setShowTutorial(false)}>
              ×
            </button>
            <h2>How to Use Sign Language Interpreter</h2>

            <div className="tutorial-section">
              <h3>
                <span className="tutorial-icon">🎥</span> Record & Interpret
              </h3>
              <p>Record sign language videos and get interpretations:</p>
              <ol>
                <li>Click "Start Recording" to begin</li>
                <li>Perform your sign language message</li>
                <li>Click "Stop Recording" when finished</li>
                <li>The video will be automatically analyzed</li>
                <li>View the interpretation of your sign language</li>
              </ol>
            </div>

            <button className="tutorial-button" onClick={() => setShowTutorial(false)}>
              Got it!
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default SignLanguagePage
