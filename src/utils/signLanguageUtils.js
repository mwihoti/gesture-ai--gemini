// Import fingerpose correctly
import { Finger, FingerCurl, FingerDirection, GestureDescription } from "fingerpose"

// This is a simplified version - in a real app, you would use a trained model
export const classifyHandpose = async (hands) => {
  if (!hands || hands.length === 0) return []

  // Extract landmarks from the first hand
  const landmarks = hands[0].landmarks

  // In a real application, you would use a trained model to classify the hand pose
  // For this example, we'll use a simplified approach based on finger positions

  // Calculate finger states (curled or extended)
  const fingerStates = calculateFingerStates(landmarks)

  // Identify common ASL signs based on finger states
  const signs = identifyASLSigns(fingerStates, landmarks)

  return signs
}

const calculateFingerStates = (landmarks) => {
  // Define finger indices
  const fingerIndices = {
    thumb: [0, 1, 2, 3, 4],
    index: [0, 5, 6, 7, 8],
    middle: [0, 9, 10, 11, 12],
    ring: [0, 13, 14, 15, 16],
    pinky: [0, 17, 18, 19, 20],
  }

  // Calculate finger states
  const fingerStates = {}

  // For each finger
  for (const [finger, indices] of Object.entries(fingerIndices)) {
    if (finger === "thumb") {
      // Special case for thumb
      const extended = isThumbExtended(landmarks, indices)
      fingerStates[finger] = extended ? "extended" : "curled"
    } else {
      // For other fingers
      const extended = isFingerExtended(landmarks, indices)
      fingerStates[finger] = extended ? "extended" : "curled"
    }
  }

  return fingerStates
}

const isThumbExtended = (landmarks, indices) => {
  const [wrist, cmc, mcp, ip, tip] = indices.map((i) => landmarks[i])

  // Calculate the angle between the thumb and the palm
  const thumbDirection = [tip[0] - mcp[0], tip[1] - mcp[1]]
  const palmDirection = [wrist[0] - mcp[0], wrist[1] - mcp[1]]

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

const isFingerExtended = (landmarks, indices) => {
  const [wrist, mcp, pip, dip, tip] = indices.map((i) => landmarks[i])

  // Calculate the distance from fingertip to wrist
  const tipToWristDistance = Math.sqrt((tip[0] - wrist[0]) ** 2 + (tip[1] - wrist[1]) ** 2)

  // Calculate the distance from MCP to wrist
  const mcpToWristDistance = Math.sqrt((mcp[0] - wrist[0]) ** 2 + (mcp[1] - wrist[1]) ** 2)

  // If the fingertip is further from the wrist than the MCP, the finger is likely extended
  return tipToWristDistance > mcpToWristDistance * 1.5
}

const identifyASLSigns = (fingerStates, landmarks) => {
  const signs = []

  // Check for common ASL signs based on finger states

  // A - All fingers curled except thumb
  if (
    fingerStates.index === "curled" &&
    fingerStates.middle === "curled" &&
    fingerStates.ring === "curled" &&
    fingerStates.pinky === "curled" &&
    fingerStates.thumb === "extended"
  ) {
    signs.push({ sign: "A", confidence: 0.9 })
  }

  // B - All fingers extended, thumb curled
  if (
    fingerStates.index === "extended" &&
    fingerStates.middle === "extended" &&
    fingerStates.ring === "extended" &&
    fingerStates.pinky === "extended" &&
    fingerStates.thumb === "curled"
  ) {
    signs.push({ sign: "B", confidence: 0.9 })
  }

  // C - Curved hand
  if (
    fingerStates.index === "extended" &&
    fingerStates.middle === "extended" &&
    fingerStates.ring === "extended" &&
    fingerStates.pinky === "extended" &&
    fingerStates.thumb === "extended"
  ) {
    // Check if fingers are curved (simplified)
    const isCurved = areFingersCurved(landmarks)
    if (isCurved) {
      signs.push({ sign: "C", confidence: 0.8 })
    }
  }

  // I - Pinky extended, others curled
  if (
    fingerStates.index === "curled" &&
    fingerStates.middle === "curled" &&
    fingerStates.ring === "curled" &&
    fingerStates.pinky === "extended" &&
    fingerStates.thumb === "curled"
  ) {
    signs.push({ sign: "I", confidence: 0.9 })
  }

  // L - Index extended, thumb extended, others curled
  if (
    fingerStates.index === "extended" &&
    fingerStates.middle === "curled" &&
    fingerStates.ring === "curled" &&
    fingerStates.pinky === "curled" &&
    fingerStates.thumb === "extended"
  ) {
    signs.push({ sign: "L", confidence: 0.9 })
  }

  // Y - Thumb and pinky extended, others curled
  if (
    fingerStates.index === "curled" &&
    fingerStates.middle === "curled" &&
    fingerStates.ring === "curled" &&
    fingerStates.pinky === "extended" &&
    fingerStates.thumb === "extended"
  ) {
    signs.push({ sign: "Y", confidence: 0.9 })
  }

  return signs
}

const areFingersCurved = (landmarks) => {
  // This is a simplified check - in a real app, you would use more sophisticated methods
  // Check if the fingertips are closer to the palm than they would be if fully extended

  const wrist = landmarks[0]
  const indexTip = landmarks[8]
  const middleTip = landmarks[12]

  // Calculate distances
  const indexDistance = Math.sqrt((indexTip[0] - wrist[0]) ** 2 + (indexTip[1] - wrist[1]) ** 2)

  const middleDistance = Math.sqrt((middleTip[0] - wrist[0]) ** 2 + (middleTip[1] - wrist[1]) ** 2)

  // If distances are moderate (not too short as in curled, not too long as in extended)
  return indexDistance > 50 && indexDistance < 150 && middleDistance > 50 && middleDistance < 150
}

// Create predefined gesture descriptions for common ASL signs
export const createGestureDescriptions = () => {
  // A sign
  const aSign = new GestureDescription("A")
  aSign.addCurl(Finger.Thumb, FingerCurl.NoCurl, 1.0)
  for (const finger of [Finger.Index, Finger.Middle, Finger.Ring, Finger.Pinky]) {
    aSign.addCurl(finger, FingerCurl.FullCurl, 1.0)
  }

  // B sign
  const bSign = new GestureDescription("B")
  bSign.addCurl(Finger.Thumb, FingerCurl.HalfCurl, 1.0)
  for (const finger of [Finger.Index, Finger.Middle, Finger.Ring, Finger.Pinky]) {
    bSign.addCurl(finger, FingerCurl.NoCurl, 1.0)
    bSign.addDirection(finger, FingerDirection.VerticalUp, 1.0)
  }

  // C sign
  const cSign = new GestureDescription("C")
  for (const finger of [Finger.Thumb, Finger.Index, Finger.Middle, Finger.Ring, Finger.Pinky]) {
    cSign.addCurl(finger, FingerCurl.HalfCurl, 0.8)
  }

  return [aSign, bSign, cSign]
}
