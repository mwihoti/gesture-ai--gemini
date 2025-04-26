// Web Worker for processing hand tracking data
// This runs in a separate thread to avoid blocking the UI

// Cache for temporal coherence
let previousHands = []
const gestureCache = new Map()

// Process incoming hand data
self.onmessage = (e) => {
  if (e.data.type === "processHands") {
    const results = e.data.results

    // Process the hand landmarks
    const processedResults = processHandLandmarks(results)

    // Send the processed results back to the main thread
    self.postMessage({
      type: "processedHands",
      results: processedResults,
    })
  }
}

// Process hand landmarks to extract gestures
function processHandLandmarks(results) {
  const { multiHandLandmarks, multiHandedness, timestamp } = results

  // If no hands detected, return empty result
  if (!multiHandLandmarks || multiHandLandmarks.length === 0) {
    previousHands = []
    return {
      hands: [],
      gestures: [],
      timestamp,
    }
  }

  // Process each detected hand
  const processedHands = multiHandLandmarks.map((landmarks, index) => {
    const handedness = multiHandedness[index]
    const isRightHand = handedness.label === "Right"

    // Calculate hand features
    const features = extractHandFeatures(landmarks)

    // Detect gestures based on features
    const gestures = detectGestures(features, isRightHand)

    return {
      landmarks,
      handedness: handedness.label,
      confidence: handedness.score,
      features,
      gestures,
      id: index,
    }
  })

  // Apply temporal coherence
  const smoothedHands = applyTemporalCoherence(processedHands, previousHands)
  previousHands = smoothedHands

  // Extract gestures from all hands
  const allGestures = smoothedHands.flatMap((hand) =>
    hand.gestures.map((g) => ({
      ...g,
      handId: hand.id,
      handedness: hand.handedness,
    })),
  )

  return {
    hands: smoothedHands,
    gestures: allGestures,
    timestamp,
  }
}

// Extract features from hand landmarks
function extractHandFeatures(landmarks) {
  // Calculate various hand features

  // Finger states (extended or curled)
  const fingerStates = calculateFingerStates(landmarks)

  // Hand orientation
  const orientation = calculateHandOrientation(landmarks)

  // Palm center
  const palmCenter = calculatePalmCenter(landmarks)

  // Distances between key points
  const keyDistances = calculateKeyDistances(landmarks)

  return {
    fingerStates,
    orientation,
    palmCenter,
    keyDistances,
  }
}

// Calculate if fingers are extended or curled
function calculateFingerStates(landmarks) {
  // Define finger indices
  const fingerIndices = {
    thumb: [0, 1, 2, 3, 4],
    index: [0, 5, 6, 7, 8],
    middle: [0, 9, 10, 11, 12],
    ring: [0, 13, 14, 15, 16],
    pinky: [0, 17, 18, 19, 20],
  }

  const states = {}

  // For each finger
  for (const [finger, indices] of Object.entries(fingerIndices)) {
    if (finger === "thumb") {
      // Special case for thumb
      states[finger] = isThumbExtended(landmarks, indices) ? "extended" : "curled"
    } else {
      // For other fingers
      states[finger] = isFingerExtended(landmarks, indices) ? "extended" : "curled"
    }
  }

  return states
}

// Check if thumb is extended
function isThumbExtended(landmarks, indices) {
  const [wrist, cmc, mcp, ip, tip] = indices.map((i) => landmarks[i])

  // Calculate the angle between the thumb and the palm
  const thumbDirection = [tip.x - mcp.x, tip.y - mcp.y]
  const palmDirection = [wrist.x - mcp.x, wrist.y - mcp.y]

  // Normalize vectors
  const thumbLength = Math.sqrt(thumbDirection[0] ** 2 + thumbDirection[1] ** 2)
  const palmLength = Math.sqrt(palmDirection[0] ** 2 + palmDirection[1] ** 2)

  const thumbNorm = [thumbDirection[0] / thumbLength, thumbDirection[1] / thumbLength]
  const palmNorm = [palmDirection[0] / palmLength, palmDirection[1] / palmLength]

  // Calculate dot product
  const dotProduct = thumbNorm[0] * palmNorm[0] + thumbNorm[1] * palmNorm[1]

  // If dot product is negative, vectors point in opposite directions
  return dotProduct < 0
}

// Check if finger is extended
function isFingerExtended(landmarks, indices) {
  const [wrist, mcp, pip, dip, tip] = indices.map((i) => landmarks[i])

  // Calculate the distance from fingertip to wrist
  const tipToWristDistance = Math.sqrt((tip.x - wrist.x) ** 2 + (tip.y - wrist.y) ** 2)

  // Calculate the distance from MCP to wrist
  const mcpToWristDistance = Math.sqrt((mcp.x - wrist.x) ** 2 + (mcp.y - wrist.y) ** 2)

  // If the fingertip is further from the wrist than the MCP, the finger is likely extended
  return tipToWristDistance > mcpToWristDistance * 1.5
}

// Calculate hand orientation
function calculateHandOrientation(landmarks) {
  // Use wrist and middle finger MCP to determine orientation
  const wrist = landmarks[0]
  const middleMCP = landmarks[9]

  // Calculate angle
  const dx = middleMCP.x - wrist.x
  const dy = middleMCP.y - wrist.y
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI

  return {
    angle,
    // Classify orientation into cardinal directions
    direction: classifyOrientation(angle),
  }
}

// Classify orientation angle into cardinal direction
function classifyOrientation(angle) {
  // Convert angle to 0-360 range
  const normalizedAngle = (angle + 360) % 360

  if (normalizedAngle >= 337.5 || normalizedAngle < 22.5) return "right"
  if (normalizedAngle >= 22.5 && normalizedAngle < 67.5) return "up-right"
  if (normalizedAngle >= 67.5 && normalizedAngle < 112.5) return "up"
  if (normalizedAngle >= 112.5 && normalizedAngle < 157.5) return "up-left"
  if (normalizedAngle >= 157.5 && normalizedAngle < 202.5) return "left"
  if (normalizedAngle >= 202.5 && normalizedAngle < 247.5) return "down-left"
  if (normalizedAngle >= 247.5 && normalizedAngle < 292.5) return "down"
  if (normalizedAngle >= 292.5 && normalizedAngle < 337.5) return "down-right"
  return "right"
}

// Calculate palm center
function calculatePalmCenter(landmarks) {
  // Use the average of wrist and MCP joints
  const points = [0, 5, 9, 13, 17].map((i) => landmarks[i])

  const sumX = points.reduce((sum, p) => sum + p.x, 0)
  const sumY = points.reduce((sum, p) => sum + p.y, 0)
  const sumZ = points.reduce((sum, p) => sum + (p.z || 0), 0)

  return {
    x: sumX / points.length,
    y: sumY / points.length,
    z: sumZ / points.length,
  }
}

// Calculate key distances for gesture recognition
function calculateKeyDistances(landmarks) {
  const distances = {}

  // Fingertip to palm distances
  const palmCenter = calculatePalmCenter(landmarks)
  const fingertips = [4, 8, 12, 16, 20].map((i) => landmarks[i])
  const fingerNames = ["thumb", "index", "middle", "ring", "pinky"]

  fingerNames.forEach((name, i) => {
    const tip = fingertips[i]
    distances[`${name}ToPalm`] = Math.sqrt(
      (tip.x - palmCenter.x) ** 2 + (tip.y - palmCenter.y) ** 2 + ((tip.z || 0) - palmCenter.z) ** 2,
    )
  })

  // Distances between fingertips
  for (let i = 0; i < fingerNames.length; i++) {
    for (let j = i + 1; j < fingerNames.length; j++) {
      const tip1 = fingertips[i]
      const tip2 = fingertips[j]
      distances[`${fingerNames[i]}To${fingerNames[j].charAt(0).toUpperCase() + fingerNames[j].slice(1)}`] = Math.sqrt(
        (tip1.x - tip2.x) ** 2 + (tip1.y - tip2.y) ** 2 + ((tip1.z || 0) - (tip2.z || 0)) ** 2,
      )
    }
  }

  return distances
}

// Detect gestures based on hand features
function detectGestures(features, isRightHand) {
  const { fingerStates, orientation, keyDistances } = features
  const gestures = []

  // Check for common ASL signs

  // A sign - All fingers curled except thumb
  if (
    fingerStates.index === "curled" &&
    fingerStates.middle === "curled" &&
    fingerStates.ring === "curled" &&
    fingerStates.pinky === "curled" &&
    fingerStates.thumb === "extended"
  ) {
    gestures.push({ sign: "A", confidence: 0.9 })
  }

  // B sign - All fingers extended, thumb curled
  if (
    fingerStates.index === "extended" &&
    fingerStates.middle === "extended" &&
    fingerStates.ring === "extended" &&
    fingerStates.pinky === "extended" &&
    fingerStates.thumb === "curled"
  ) {
    gestures.push({ sign: "B", confidence: 0.9 })
  }

  // C sign - Curved hand
  if (
    fingerStates.index === "extended" &&
    fingerStates.middle === "extended" &&
    fingerStates.ring === "extended" &&
    fingerStates.pinky === "extended" &&
    fingerStates.thumb === "extended" &&
    // Check if thumb and index are close
    keyDistances.thumbToIndex < 0.2
  ) {
    gestures.push({ sign: "C", confidence: 0.8 })
  }

  // I sign - Pinky extended, others curled
  if (
    fingerStates.index === "curled" &&
    fingerStates.middle === "curled" &&
    fingerStates.ring === "curled" &&
    fingerStates.pinky === "extended" &&
    fingerStates.thumb === "curled"
  ) {
    gestures.push({ sign: "I", confidence: 0.9 })
  }

  // L sign - Index extended, thumb extended, others curled
  if (
    fingerStates.index === "extended" &&
    fingerStates.middle === "curled" &&
    fingerStates.ring === "curled" &&
    fingerStates.pinky === "curled" &&
    fingerStates.thumb === "extended"
  ) {
    gestures.push({ sign: "L", confidence: 0.9 })
  }

  // Y sign - Thumb and pinky extended, others curled
  if (
    fingerStates.index === "curled" &&
    fingerStates.middle === "curled" &&
    fingerStates.ring === "curled" &&
    fingerStates.pinky === "extended" &&
    fingerStates.thumb === "extended"
  ) {
    gestures.push({ sign: "Y", confidence: 0.9 })
  }

  return gestures
}

// Apply temporal coherence to smooth detection
function applyTemporalCoherence(currentHands, previousHands) {
  if (!previousHands || previousHands.length === 0) {
    return currentHands
  }

  return currentHands.map((currentHand) => {
    // Find matching hand in previous frame
    const matchingPreviousHand = findMatchingHand(currentHand, previousHands)

    if (!matchingPreviousHand) {
      return currentHand
    }

    // Smooth landmarks
    const smoothedLandmarks = currentHand.landmarks.map((landmark, i) => {
      const prevLandmark = matchingPreviousHand.landmarks[i]
      return {
        x: landmark.x * 0.7 + prevLandmark.x * 0.3,
        y: landmark.y * 0.7 + prevLandmark.y * 0.3,
        z: (landmark.z || 0) * 0.7 + (prevLandmark.z || 0) * 0.3,
      }
    })

    // Smooth gestures
    const smoothedGestures = smoothGestures(currentHand.gestures, matchingPreviousHand.gestures)

    return {
      ...currentHand,
      landmarks: smoothedLandmarks,
      gestures: smoothedGestures,
    }
  })
}

// Find matching hand between frames
function findMatchingHand(currentHand, previousHands) {
  // Match based on handedness and position
  return previousHands.find(
    (prevHand) => prevHand.handedness === currentHand.handedness && isHandPositionSimilar(currentHand, prevHand),
  )
}

// Check if hand positions are similar
function isHandPositionSimilar(hand1, hand2) {
  const center1 = calculatePalmCenter(hand1.landmarks)
  const center2 = calculatePalmCenter(hand2.landmarks)

  const distance = Math.sqrt((center1.x - center2.x) ** 2 + (center1.y - center2.y) ** 2)

  // Consider hands similar if palm centers are close
  return distance < 0.2
}

// Smooth gestures between frames
function smoothGestures(currentGestures, previousGestures) {
  // If current frame has no gestures, return previous ones with reduced confidence
  if (currentGestures.length === 0) {
    return previousGestures
      .map((g) => ({
        ...g,
        confidence: g.confidence * 0.8, // Reduce confidence
      }))
      .filter((g) => g.confidence > 0.5) // Keep only high confidence gestures
  }

  // For each current gesture, check if it existed in previous frame
  return currentGestures.map((currentGesture) => {
    const matchingPreviousGesture = previousGestures.find((pg) => pg.sign === currentGesture.sign)

    if (matchingPreviousGesture) {
      // Smooth confidence
      return {
        ...currentGesture,
        confidence: currentGesture.confidence * 0.7 + matchingPreviousGesture.confidence * 0.3,
      }
    }

    return currentGesture
  })
}
