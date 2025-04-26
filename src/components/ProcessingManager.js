"use client"

import { useState, useEffect, useRef } from "react"

/**
 * ProcessingManager handles multi-phase processing with state management
 * and error handling
 */
const ProcessingManager = ({ phases = [], onComplete, onError, onProgress, autoStart = false, data = null }) => {
  const [currentPhase, setCurrentPhase] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState({})
  const processingLockRef = useRef(false)
  const abortControllerRef = useRef(null)
  const dataRef = useRef(data)

  // Update data reference when data changes
  useEffect(() => {
    dataRef.current = data
  }, [data])

  // Start processing when autoStart is true and data changes
  useEffect(() => {
    if (autoStart && data && !processingLockRef.current) {
      startProcessing()
    }

    return () => {
      // Clean up any ongoing processing
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [data, autoStart])

  // Start the processing pipeline
  const startProcessing = async () => {
    if (processingLockRef.current) {
      console.log("Processing already in progress")
      return
    }

    if (!phases || phases.length === 0) {
      console.error("No processing phases defined")
      return
    }

    if (!dataRef.current) {
      console.error("No data to process")
      return
    }

    try {
      processingLockRef.current = true
      setIsProcessing(true)
      setError(null)
      setCurrentPhase(0)
      setProgress(0)
      setResults({})

      // Create a new abort controller
      abortControllerRef.current = new AbortController()

      // Process each phase sequentially
      const phaseResults = {}
      let phaseData = dataRef.current

      for (let i = 0; i < phases.length; i++) {
        const phase = phases[i]
        setCurrentPhase(i)

        // Calculate progress based on phase
        const phaseStartProgress = (i / phases.length) * 100
        const phaseEndProgress = ((i + 1) / phases.length) * 100

        // Update progress at the start of the phase
        updateProgress(phaseStartProgress)

        try {
          // Execute the phase with the current data and signal
          const result = await phase.execute({
            data: phaseData,
            signal: abortControllerRef.current.signal,
            onProgress: (phaseProgress) => {
              // Scale the phase progress to the overall progress
              const scaledProgress =
                phaseStartProgress + (phaseProgress / 100) * (phaseEndProgress - phaseStartProgress)
              updateProgress(scaledProgress)
            },
            previousResults: phaseResults,
          })

          // Store the result
          phaseResults[phase.id] = result

          // Use the result as input for the next phase if needed
          if (phase.outputAsNextInput) {
            phaseData = result
          }

          // Update progress at the end of the phase
          updateProgress(phaseEndProgress)
        } catch (err) {
          if (err.name === "AbortError") {
            console.log(`Phase ${phase.id} aborted`)
            throw err
          }

          console.error(`Error in phase ${phase.id}:`, err)

          // If the phase is critical, stop processing
          if (phase.critical !== false) {
            throw err
          }

          // Otherwise, continue to the next phase
          console.log(`Continuing to next phase after non-critical error in ${phase.id}`)
        }
      }

      // All phases completed successfully
      setProgress(100)
      setResults(phaseResults)

      // Call the completion callback
      if (onComplete) {
        onComplete(phaseResults)
      }
    } catch (err) {
      console.error("Processing error:", err)

      // Only set error if not aborted
      if (err.name !== "AbortError") {
        setError(err.message || "An error occurred during processing")

        // Call the error callback
        if (onError) {
          onError(err)
        }
      }
    } finally {
      setIsProcessing(false)
      processingLockRef.current = false
      abortControllerRef.current = null
    }
  }

  // Update progress and call the progress callback
  const updateProgress = (value) => {
    setProgress(Math.round(value))

    if (onProgress) {
      onProgress(Math.round(value))
    }
  }

  // Cancel the current processing
  const cancelProcessing = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      console.log("Processing cancelled")
    }
  }

  return {
    startProcessing,
    cancelProcessing,
    isProcessing,
    progress,
    currentPhase,
    error,
    results,
    currentPhaseName: phases[currentPhase]?.id || "",
  }
}

export default ProcessingManager
