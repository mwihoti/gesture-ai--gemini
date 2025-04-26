// GestureTokenizer.js - Converts detected gestures into structured tokens

class GestureTokenizer {
    constructor() {
      this.gestureBuffer = []
      this.tokenSequence = []
      this.lastProcessedTimestamp = 0
      this.processingInterval = 500 // ms
      this.segmentationThreshold = 1000 // ms pause to consider a segment boundary
      this.currentSegment = []
      this.lastGestureTimestamp = 0
      this.confidenceThreshold = 0.6
      this.contextWindow = [] // Store recent context
      this.maxContextSize = 10 // Maximum number of tokens to keep in context
    }
  
    // Process new gestures
    processGestures(gestures, timestamp) {
      if (!gestures || gestures.length === 0) {
        // Check for segmentation based on time gap
        if (this.lastGestureTimestamp > 0 && timestamp - this.lastGestureTimestamp > this.segmentationThreshold) {
          this.finalizeSegment()
        }
        return null
      }
  
      // Update last gesture timestamp
      this.lastGestureTimestamp = timestamp
  
      // Filter gestures by confidence
      const validGestures = gestures.filter((g) => g.confidence >= this.confidenceThreshold)
  
      // Add to buffer
      this.gestureBuffer.push(...validGestures.map((g) => ({ ...g, timestamp })))
  
      // Process buffer at intervals
      if (timestamp - this.lastProcessedTimestamp >= this.processingInterval) {
        this.processBuffer()
        this.lastProcessedTimestamp = timestamp
        return this.getLatestTokens()
      }
  
      return null
    }
  
    // Process the gesture buffer
    processBuffer() {
      if (this.gestureBuffer.length === 0) return
  
      // Group gestures by timestamp to handle multiple gestures at once
      const groupedGestures = this.groupGesturesByTimestamp()
  
      // Convert gesture groups to tokens
      const newTokens = this.convertGestureGroupsToTokens(groupedGestures)
  
      // Add to current segment
      this.currentSegment.push(...newTokens)
  
      // Clear buffer
      this.gestureBuffer = []
  
      // Check for natural segment boundaries
      this.detectSegmentBoundaries()
    }
  
    // Group gestures by timestamp
    groupGesturesByTimestamp() {
      const groups = {}
  
      this.gestureBuffer.forEach((gesture) => {
        const timeKey = gesture.timestamp.toString()
        if (!groups[timeKey]) {
          groups[timeKey] = []
        }
        groups[timeKey].push(gesture)
      })
  
      return Object.values(groups)
    }
  
    // Convert gesture groups to tokens
    convertGestureGroupsToTokens(gestureGroups) {
      return gestureGroups.map((group) => {
        // Sort by confidence
        const sortedGestures = [...group].sort((a, b) => b.confidence - a.confidence)
  
        // Get primary and alternative interpretations
        const primary = sortedGestures[0]
        const alternatives = sortedGestures.slice(1)
  
        return {
          type: "sign",
          value: primary.sign,
          confidence: primary.confidence,
          alternatives: alternatives.map((alt) => ({
            value: alt.sign,
            confidence: alt.confidence,
          })),
          timestamp: primary.timestamp,
          handedness: primary.handedness || "unknown",
        }
      })
    }
  
    // Detect natural segment boundaries
    detectSegmentBoundaries() {
      if (this.currentSegment.length === 0) return
  
      // Simple rule: if we see a pause or a specific ending gesture, finalize the segment
      const lastToken = this.currentSegment[this.currentSegment.length - 1]
      const secondLastToken = this.currentSegment.length > 1 ? this.currentSegment[this.currentSegment.length - 2] : null
  
      // Check for ending gestures (like a period in ASL)
      const isEndingGesture = lastToken.value === "period" || lastToken.value === "question"
  
      // Check for repeated gestures (might indicate emphasis rather than a new segment)
      const isRepeat = secondLastToken && lastToken.value === secondLastToken.value
  
      if (isEndingGesture && !isRepeat) {
        this.finalizeSegment()
      }
    }
  
    // Finalize the current segment and add to token sequence
    finalizeSegment() {
      if (this.currentSegment.length === 0) return
  
      // Apply grammatical prediction and correction
      const processedSegment = this.applyGrammaticalProcessing(this.currentSegment)
  
      // Create a segment token
      const segmentToken = {
        type: "segment",
        tokens: processedSegment,
        timestamp: Date.now(),
      }
  
      // Add to token sequence
      this.tokenSequence.push(segmentToken)
  
      // Add to context window
      this.updateContextWindow(segmentToken)
  
      // Clear current segment
      this.currentSegment = []
  
      console.log("Segment finalized:", segmentToken)
      return segmentToken
    }
  
    // Apply grammatical processing to improve token sequence
    applyGrammaticalProcessing(tokens) {
      // This would be more sophisticated in a full implementation
      // Here we'll do some basic corrections
  
      // Filter out low confidence tokens
      let processed = tokens.filter((token) => token.confidence > 0.4)
  
      // Remove duplicates (unless they appear to be intentional)
      processed = this.removeUnintentionalDuplicates(processed)
  
      // Apply basic ASL grammar rules
      processed = this.applyASLGrammarRules(processed)
  
      return processed
    }
  
    // Remove unintentional duplicates
    removeUnintentionalDuplicates(tokens) {
      const result = []
      let lastToken = null
  
      tokens.forEach((token) => {
        // If it's the same as the last token, check if it's likely intentional
        if (lastToken && token.value === lastToken.value) {
          // If high confidence and time gap is significant, might be intentional repeat
          const timeGap = token.timestamp - lastToken.timestamp
          const isIntentional = token.confidence > 0.8 && timeGap > 300
  
          if (isIntentional) {
            // Mark as intentional repeat
            result.push({
              ...token,
              isRepeat: true,
            })
          }
          // Otherwise skip as likely unintentional
        } else {
          result.push(token)
        }
  
        lastToken = token
      })
  
      return result
    }
  
    // Apply basic ASL grammar rules
    applyASLGrammarRules(tokens) {
      // This is a simplified implementation
      // In a real system, this would be much more sophisticated
  
      // Example: In ASL, time indicators often come first
      const timeIndicators = ["yesterday", "today", "tomorrow", "before", "after", "now"]
  
      // Check if we need to reorder tokens based on ASL grammar
      const timeTokens = tokens.filter((token) => timeIndicators.includes(token.value.toLowerCase()))
      const otherTokens = tokens.filter((token) => !timeIndicators.includes(token.value.toLowerCase()))
  
      // If we found time indicators, move them to the front
      if (timeTokens.length > 0) {
        return [...timeTokens, ...otherTokens]
      }
  
      return tokens
    }
  
    // Update context window with new segment
    updateContextWindow(segment) {
      this.contextWindow.push(segment)
  
      // Keep only the most recent segments
      if (this.contextWindow.length > this.maxContextSize) {
        this.contextWindow.shift()
      }
    }
  
    // Get the latest tokens
    getLatestTokens() {
      if (this.currentSegment.length === 0) return null
  
      return {
        type: "partial_segment",
        tokens: this.currentSegment,
        timestamp: Date.now(),
      }
    }
  
    // Get the full context for API calls
    getContext() {
      return {
        segments: this.contextWindow,
        currentSegment: this.currentSegment,
        timestamp: Date.now(),
      }
    }
  
    // Clear all state
    clear() {
      this.gestureBuffer = []
      this.tokenSequence = []
      this.lastProcessedTimestamp = 0
      this.currentSegment = []
      this.lastGestureTimestamp = 0
      this.contextWindow = []
    }
  }
  
  export default GestureTokenizer
  