"use client"

import { useState, useEffect, useRef } from "react"
import signLanguageProcessor from "../services/SignLanguageProcessor"
import geminiService from "../services/GeminiService"
import SignLanguageDetector from "./SignLanguageDetector"

const CommunicationInterface = ({ onSignsDetected, onInterpretation }) => {
  const [detectedSigns, setDetectedSigns] = useState([])
  const [conversation, setConversation] = useState([])
  const [isInterpreting, setIsInterpreting] = useState(false)
  const [apiKey, setApiKey] = useState(
    localStorage.getItem("geminiApiKey") || process.env.REACT_APP_GEMINI_API_KEY || "",
  )
  const [textInput, setTextInput] = useState("")
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [offlineMode, setOfflineMode] = useState(false)
  const conversationEndRef = useRef(null)

  // Initialize services
  useEffect(() => {
    if (apiKey) {
      geminiService.initialize(apiKey)
    } else {
      setOfflineMode(true)
      geminiService.setOfflineMode(true)
    }
  }, [apiKey])

  // Scroll to bottom of conversation
  useEffect(() => {
    if (conversationEndRef.current) {
      conversationEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [conversation])

  const handleSignsDetected = (signs) => {
    setDetectedSigns(signs)
    onSignsDetected && onSignsDetected(signs)

    // If we have detected signs, try to interpret them
    if (signs && signs.length > 0) {
      interpretSigns(signs)
    }
  }

  const interpretSigns = async (signs) => {
    if (!apiKey || isInterpreting || signs.length === 0) return

    setIsInterpreting(true)

    try {
      // Create a simple prompt for Gemini
      const signNames = signs.map((sign) => sign.sign).join(", ")

      const result = await geminiService.request({
        type: "text",
        prompt: `Interpret the following sign language signs into a natural sentence: ${signNames}`,
        temperature: 0.3,
      })

      const interpretation = result.text

      // Add to conversation
      const newMessage = {
        type: "sign",
        signs: signs.map((sign) => sign.sign),
        interpretation,
        timestamp: new Date().toLocaleTimeString(),
      }

      setConversation((prev) => [...prev, newMessage])
      onInterpretation && onInterpretation(interpretation)

      // Speak the interpretation
      speakText(interpretation)
    } catch (error) {
      console.error("Error interpreting signs:", error)
    } finally {
      setIsInterpreting(false)
    }
  }

  const handleInterpretation = (interpretation) => {
    if (!interpretation) return

    setIsInterpreting(false)

    // Add to conversation
    const newMessage = {
      type: "sign",
      signs: detectedSigns.map((sign) => sign.sign),
      interpretation,
      timestamp: new Date().toLocaleTimeString(),
    }

    setConversation((prev) => [...prev, newMessage])
    onInterpretation && onInterpretation(interpretation)

    // Speak the interpretation
    speakText(interpretation)
  }

  const handleTextSubmit = async (e) => {
    e.preventDefault()

    if (!textInput.trim() || !apiKey) return

    try {
      // Add text message to conversation
      const newTextMessage = {
        type: "text",
        text: textInput,
        timestamp: new Date().toLocaleTimeString(),
      }

      setConversation((prev) => [...prev, newTextMessage])

      // Get sign language instructions for the text
      const result = await signLanguageProcessor.textToSignInstructions(textInput, "high")

      // Add sign instructions to conversation
      const newInstructionMessage = {
        type: "instruction",
        text: textInput,
        instructions: result.instructions,
        timestamp: new Date().toLocaleTimeString(),
      }

      setConversation((prev) => [...prev, newInstructionMessage])
      setTextInput("")
    } catch (error) {
      console.error("Error generating sign instructions:", error)
    }
  }

  const speakText = (text) => {
    if ("speechSynthesis" in window) {
      setIsSpeaking(true)

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.onend = () => setIsSpeaking(false)

      window.speechSynthesis.speak(utterance)
    }
  }

  const handleApiKeyChange = (e) => {
    const key = e.target.value
    setApiKey(key)
    localStorage.setItem("geminiApiKey", key)

    if (key) {
      geminiService.initialize(key)
      setOfflineMode(false)
    } else {
      setOfflineMode(true)
      geminiService.setOfflineMode(true)
    }
  }

  const toggleOfflineMode = () => {
    const newMode = !offlineMode
    setOfflineMode(newMode)
    geminiService.setOfflineMode(newMode)
  }

  return (
    <div className="communication-interface">
      <div className="interface-container">
        <div className="video-section">
          <SignLanguageDetector onSignsDetected={handleSignsDetected} onInterpretation={handleInterpretation} />

          {isInterpreting && (
            <div className="interpreting-indicator">
              <div className="spinner"></div>
              <p>Interpreting signs...</p>
            </div>
          )}

          <div className="video-controls">
            <button
              className="enhance-visibility-btn"
              onClick={() => {
                const videos = document.querySelectorAll(".video-section video")
                videos.forEach((video) => {
                  const currentFilter = video.style.filter || ""
                  if (currentFilter.includes("brightness(1.5)")) {
                    video.style.filter = "brightness(1.0) contrast(1.0)"
                  } else {
                    video.style.filter = "brightness(1.5) contrast(1.2)"
                  }
                })
              }}
            >
              💡 Toggle Enhanced Visibility
            </button>

            <button className={`offline-mode-btn ${offlineMode ? "active" : ""}`} onClick={toggleOfflineMode}>
              {offlineMode ? "🔴 Offline Mode (On)" : "🟢 Offline Mode (Off)"}
            </button>
          </div>
        </div>

        <div className="conversation-section">
          <div className="conversation-header">
            <h3>Conversation</h3>
            {isSpeaking && <span className="speaking-indicator">Speaking...</span>}
          </div>

          <div className="conversation-messages">
            {conversation.length === 0 ? (
              <div className="empty-conversation">
                <p>Your conversation will appear here.</p>
                <p>Start signing or type a message below.</p>
              </div>
            ) : (
              conversation.map((message, index) => (
                <div key={index} className={`message ${message.type}`}>
                  <div className="message-header">
                    <span className="message-type">
                      {message.type === "sign"
                        ? "🤲 Sign Language"
                        : message.type === "text"
                          ? "💬 Text"
                          : "📝 Sign Instructions"}
                    </span>
                    <span className="message-time">{message.timestamp}</span>
                  </div>

                  <div className="message-content">
                    {message.type === "sign" && (
                      <>
                        <div className="detected-signs">
                          <strong>Detected signs:</strong> {message.signs.join(", ")}
                        </div>
                        <div className="interpretation">
                          <strong>Interpretation:</strong> {message.interpretation}
                        </div>
                      </>
                    )}

                    {message.type === "text" && <div className="text-message">{message.text}</div>}

                    {message.type === "instruction" && (
                      <>
                        <div className="original-text">
                          <strong>Original text:</strong> {message.text}
                        </div>
                        <div className="sign-instructions">
                          <strong>How to sign this:</strong>
                          <pre>{message.instructions}</pre>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={conversationEndRef} />
          </div>

          <form className="text-input-form" onSubmit={handleTextSubmit}>
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type a message to get sign language instructions..."
              disabled={!apiKey && !offlineMode}
            />
            <button type="submit" disabled={!textInput.trim() || (!apiKey && !offlineMode)}>
              Send
            </button>
          </form>
        </div>
      </div>

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
          <button className="save-key-button" onClick={() => localStorage.setItem("geminiApiKey", apiKey)}>
            Save API Key
          </button>
          <div className="offline-toggle">
            <label>
              <input type="checkbox" checked={offlineMode} onChange={toggleOfflineMode} />
              Use offline mode (limited functionality)
            </label>
          </div>
        </div>
      )}
    </div>
  )
}

export default CommunicationInterface
