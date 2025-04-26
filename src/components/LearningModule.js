"use client"

import { useState, useEffect } from "react"
import SignLanguageDetector from "./SignLanguageDetector"
import { GoogleGenerativeAI } from "@google/generative-ai"

const LearningModule = () => {
  const [currentLesson, setCurrentLesson] = useState(null)
  const [lessonList, setLessonList] = useState([])
  const [userProgress, setUserProgress] = useState(0)
  const [feedback, setFeedback] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [apiKey, setApiKey] = useState(
    localStorage.getItem("geminiApiKey") || process.env.REACT_APP_GEMINI_API_KEY || "",
  )
  const [detectedSigns, setDetectedSigns] = useState([])
  const [practiceMode, setPracticeMode] = useState(false)
  const [currentSignIndex, setCurrentSignIndex] = useState(0)

  // Load lessons on component mount
  useEffect(() => {
    loadLessons()
  }, [])

  const loadLessons = async () => {
    // In a real app, these would come from an API or database
    const lessons = [
      {
        id: 1,
        title: "Basic Greetings",
        signs: ["Hello", "Goodbye", "Thank you", "Please"],
        signImages: {
          Hello: "/asl-hello-hand.png",
          Goodbye: "/ASL-goodbye.png",
          "Thank you": "/asl-thank-you.png",
          Please: "/ASL_Please.png",
        },
      },
      {
        id: 2,
        title: "Common Questions",
        signs: ["What", "Where", "When", "Why", "How"],
        signImages: {
          What: "/ASL-what-sign.png",
          Where: "/ASL_Where.png",
          When: "/ASL-sign-when.png",
          Why: "/placeholder.svg?height=200&width=200&query=ASL sign for why",
          How: "/placeholder.svg?height=200&width=200&query=ASL sign for how",
        },
      },
      {
        id: 3,
        title: "Numbers 1-10",
        signs: ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"],
        signImages: {
          One: "/placeholder.svg?height=200&width=200&query=ASL sign for number one",
          Two: "/placeholder.svg?height=200&width=200&query=ASL sign for number two",
          Three: "/placeholder.svg?height=200&width=200&query=ASL sign for number three",
          Four: "/placeholder.svg?height=200&width=200&query=ASL sign for number four",
          Five: "/placeholder.svg?height=200&width=200&query=ASL sign for number five",
          Six: "/placeholder.svg?height=200&width=200&query=ASL sign for number six",
          Seven: "/placeholder.svg?height=200&width=200&query=ASL sign for number seven",
          Eight: "/placeholder.svg?height=200&width=200&query=ASL sign for number eight",
          Nine: "/placeholder.svg?height=200&width=200&query=ASL sign for number nine",
          Ten: "/placeholder.svg?height=200&width=200&query=ASL sign for number ten",
        },
      },
      {
        id: 4,
        title: "Family Members",
        signs: ["Mother", "Father", "Sister", "Brother", "Family"],
        signImages: {
          Mother: "/placeholder.svg?height=200&width=200&query=ASL sign for mother",
          Father: "/placeholder.svg?height=200&width=200&query=ASL sign for father",
          Sister: "/placeholder.svg?height=200&width=200&query=ASL sign for sister",
          Brother: "/placeholder.svg?height=200&width=200&query=ASL sign for brother",
          Family: "/placeholder.svg?height=200&width=200&query=ASL sign for family",
        },
      },
      {
        id: 5,
        title: "Emotions",
        signs: ["Happy", "Sad", "Angry", "Excited", "Tired"],
        signImages: {
          Happy: "/placeholder.svg?height=200&width=200&query=ASL sign for happy",
          Sad: "/placeholder.svg?height=200&width=200&query=ASL sign for sad",
          Angry: "/placeholder.svg?height=200&width=200&query=ASL sign for angry",
          Excited: "/placeholder.svg?height=200&width=200&query=ASL sign for excited",
          Tired: "/placeholder.svg?height=200&width=200&query=ASL sign for tired",
        },
      },
    ]

    setLessonList(lessons)
  }

  const handleSignsDetected = (signs) => {
    setDetectedSigns(signs)

    if (practiceMode && currentLesson) {
      checkPractice(signs)
    }
  }

  const selectLesson = async (lesson) => {
    setIsLoading(true)
    setCurrentLesson(lesson)
    setPracticeMode(false)
    setCurrentSignIndex(0)

    try {
      // Get detailed sign instructions from Gemini
      if (apiKey) {
        const genAI = new GoogleGenerativeAI(apiKey)
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

        const prompt = `Provide detailed instructions for the following American Sign Language (ASL) signs: ${lesson.signs.join(", ")}. 
        For each sign, describe the hand shape, movement, and position. Include any facial expressions that are important.
        Format the response with clear headings for each sign and step-by-step instructions.`

        const result = await model.generateContent(prompt)
        const response = await result.response
        const instructions = response.text()

        setCurrentLesson({
          ...lesson,
          instructions,
        })
      }
    } catch (error) {
      console.error("Error getting sign instructions:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const startPractice = () => {
    setPracticeMode(true)
    setFeedback(`Show the sign for "${currentLesson.signs[currentSignIndex]}". I will try to recognize it.`)
    setUserProgress(0)
  }

  const checkPractice = async (detectedSigns) => {
    if (!apiKey || !currentLesson) return

    try {
      setIsLoading(true)

      // Extract sign names
      const signNames = detectedSigns.map((sign) => sign.sign)

      // Initialize Gemini
      const genAI = new GoogleGenerativeAI(apiKey)
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

      // Get the current sign to practice
      const currentSignToPractice = currentLesson.signs[currentSignIndex]

      // Create prompt
      const prompt = `I'm practicing American Sign Language (ASL) for the sign "${currentSignToPractice}".
      The system detected these signs: ${signNames.join(", ")}.
      
      Please analyze if I'm correctly signing "${currentSignToPractice}". Provide feedback on my signing accuracy and any tips for improvement.
      If the detected signs don't match the expected sign, suggest how I can improve.`

      // Generate content
      const result = await model.generateContent(prompt)
      const response = await result.response
      const feedbackText = response.text()

      setFeedback(feedbackText)

      // Check if the current sign was detected
      const correctSignDetected = signNames.some(
        (detected) => detected.toLowerCase() === currentSignToPractice.toLowerCase(),
      )

      if (correctSignDetected) {
        // Move to the next sign or complete the lesson
        if (currentSignIndex < currentLesson.signs.length - 1) {
          setTimeout(() => {
            setCurrentSignIndex((prevIndex) => prevIndex + 1)
            setFeedback(`Great job! Now show the sign for "${currentLesson.signs[currentSignIndex + 1]}".`)
          }, 3000)
        } else {
          // Completed all signs in the lesson
          setTimeout(() => {
            setFeedback("Congratulations! You've completed all signs in this lesson.")
            setUserProgress(100)
          }, 3000)
        }

        // Update progress
        const progressPerSign = 100 / currentLesson.signs.length
        setUserProgress((prevProgress) => {
          const newProgress = Math.min((currentSignIndex + 1) * progressPerSign, 100)
          return newProgress
        })
      }
    } catch (error) {
      console.error("Error checking practice:", error)
      setFeedback("Error analyzing your signs. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleApiKeyChange = (e) => {
    const key = e.target.value
    setApiKey(key)
    localStorage.setItem("geminiApiKey", key)
  }

  const nextSign = () => {
    if (currentSignIndex < currentLesson.signs.length - 1) {
      setCurrentSignIndex((prevIndex) => prevIndex + 1)
      setFeedback(`Show the sign for "${currentLesson.signs[currentSignIndex + 1]}".`)
    }
  }

  const previousSign = () => {
    if (currentSignIndex > 0) {
      setCurrentSignIndex((prevIndex) => prevIndex - 1)
      setFeedback(`Show the sign for "${currentLesson.signs[currentSignIndex - 1]}".`)
    }
  }

  return (
    <div className="learning-module">
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
        </div>
      )}

      <div className="learning-container">
        {!currentLesson ? (
          <div className="lesson-selection">
            <h3>Select a Lesson</h3>
            <div className="lesson-list">
              {lessonList.map((lesson) => (
                <div key={lesson.id} className="lesson-card" onClick={() => selectLesson(lesson)}>
                  <h4>{lesson.title}</h4>
                  <p>Signs: {lesson.signs.join(", ")}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="active-lesson">
            <div className="lesson-header">
              <h3>{currentLesson.title}</h3>
              <button className="back-button" onClick={() => setCurrentLesson(null)}>
                Back to Lessons
              </button>
            </div>

            {isLoading && !practiceMode ? (
              <div className="loading">
                <div className="spinner"></div>
                <p>Loading lesson content...</p>
              </div>
            ) : (
              <>
                {!practiceMode ? (
                  <div className="lesson-content">
                    <div className="sign-list">
                      <h4>Signs in this lesson:</h4>
                      <ul>
                        {currentLesson.signs.map((sign, index) => (
                          <li key={index}>{sign}</li>
                        ))}
                      </ul>
                    </div>

                    {currentLesson.instructions && (
                      <div className="sign-instructions">
                        <h4>How to sign:</h4>
                        <pre>{currentLesson.instructions}</pre>
                      </div>
                    )}

                    <button className="practice-button" onClick={startPractice}>
                      Practice These Signs
                    </button>
                  </div>
                ) : (
                  <div className="practice-mode">
                    <div className="practice-video">
                      {/* Display the current sign to practice */}
                      <div className="current-sign-display">
                        <h4>Current Sign to Practice:</h4>
                        <div className="sign-to-practice">
                          <h3>{currentLesson.signs[currentSignIndex]}</h3>
                          {currentLesson.signImages && (
                            <img
                              src={
                                currentLesson.signImages[currentLesson.signs[currentSignIndex]] || "/placeholder.svg"
                              }
                              alt={`ASL sign for ${currentLesson.signs[currentSignIndex]}`}
                              className="sign-image"
                            />
                          )}
                        </div>
                        <div className="sign-navigation">
                          <button onClick={previousSign} disabled={currentSignIndex === 0} className="sign-nav-button">
                            ← Previous
                          </button>
                          <span>
                            {currentSignIndex + 1} of {currentLesson.signs.length}
                          </span>
                          <button
                            onClick={nextSign}
                            disabled={currentSignIndex === currentLesson.signs.length - 1}
                            className="sign-nav-button"
                          >
                            Next →
                          </button>
                        </div>
                      </div>

                      <SignLanguageDetector onSignsDetected={handleSignsDetected} />
                    </div>

                    <div className="practice-feedback">
                      <h4>Practice Progress</h4>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${userProgress}%` }}></div>
                      </div>
                      <p>{Math.round(userProgress)}% complete</p>

                      <h4>Feedback</h4>
                      <div className="feedback-content">
                        {isLoading ? (
                          <div className="loading-feedback">
                            <div className="spinner"></div>
                            <p>Analyzing your signing...</p>
                          </div>
                        ) : (
                          <p>{feedback}</p>
                        )}
                      </div>

                      <div className="detected-signs">
                        <h4>Detected Signs</h4>
                        <ul>
                          {detectedSigns.map((item, index) => (
                            <li key={index}>
                              {item.sign} ({Math.round(item.confidence * 100)}%)
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default LearningModule
