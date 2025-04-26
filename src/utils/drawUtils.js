export const drawHand = (hands, ctx) => {
    // Loop through each hand
    for (let i = 0; i < hands.length; i++) {
      const hand = hands[i]
      const landmarks = hand.landmarks
  
      // Draw joints
      for (let j = 0; j < landmarks.length; j++) {
        const [x, y, z] = landmarks[j]
  
        ctx.beginPath()
        ctx.arc(x, y, 5, 0, 3 * Math.PI)
  
        // Color-code different parts of the hand
        if (j === 0) {
          // Palm base
          ctx.fillStyle = "#FF5733" // Orange-red
        } else if (j >= 1 && j <= 4) {
          // Thumb
          ctx.fillStyle = "#33FF57" // Green
        } else if (j >= 5 && j <= 8) {
          // Index finger
          ctx.fillStyle = "#3357FF" // Blue
        } else if (j >= 9 && j <= 12) {
          // Middle finger
          ctx.fillStyle = "#FF33F5" // Pink
        } else if (j >= 13 && j <= 16) {
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
        for (let j = 0; j < points.length - 1; j++) {
          const firstJointIndex = points[j]
          const secondJointIndex = points[j + 1]
  
          ctx.beginPath()
          ctx.moveTo(landmarks[firstJointIndex][0], landmarks[firstJointIndex][1])
          ctx.lineTo(landmarks[secondJointIndex][0], landmarks[secondJointIndex][1])
          ctx.strokeStyle = fingerColors[finger]
          ctx.lineWidth = 2
          ctx.stroke()
        }
      }
  
      // Add hand label
      ctx.font = "16px Arial"
      ctx.fillStyle = "white"
      ctx.fillText(`Hand ${i + 1}`, landmarks[0][0], landmarks[0][1] - 10)
    }
  }
  