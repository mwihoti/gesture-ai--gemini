/**
 * Extracts frames from a video blob at the specified frame rate
 * @param {Blob} videoBlob - The video blob to extract frames from
 * @param {number} framesPerSecond - Number of frames to extract per second (default: 1)
 * @returns {Promise<string[]>} - Promise resolving to an array of frame data URLs
 */
export const extractFramesFromVideo = (videoBlob, framesPerSecond = 1) => {
  return new Promise((resolve, reject) => {
    // Create a unique ID for this extraction to avoid conflicts
    const extractionId = Date.now().toString() + Math.random().toString(36).substring(2, 9)
    console.log(`Starting frame extraction ${extractionId}`)

    // Create a video element
    const video = document.createElement("video")
    video.muted = true
    video.playsInline = true
    video.crossOrigin = "anonymous"

    // Create a canvas for frame extraction
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")

    // Create object URL for the video blob
    const videoUrl = URL.createObjectURL(videoBlob)

    // Set up error handling
    video.onerror = (error) => {
      console.error(`[${extractionId}] Error loading video:`, error)
      cleanupResources()
      reject(new Error(`Error loading video: ${error}`))
    }

    // Set up timeout to prevent hanging
    const timeoutId = setTimeout(() => {
      console.warn(`[${extractionId}] Frame extraction timed out after 15 seconds`)
      cleanupResources()

      // If we have at least one frame, resolve with what we have
      if (frames.length > 0) {
        resolve(frames)
      } else {
        reject(new Error("Frame extraction timed out"))
      }
    }, 15000)

    // Array to store extracted frames
    const frames = []

    // Function to clean up resources
    function cleanupResources() {
      clearTimeout(timeoutId)
      URL.revokeObjectURL(videoUrl)
      video.removeAttribute("src")
      video.load()
    }

    // Handle metadata loaded
    video.onloadedmetadata = () => {
      console.log(`[${extractionId}] Video metadata loaded. Dimensions: ${video.videoWidth}x${video.videoHeight}`)

      // Set canvas dimensions
      canvas.width = video.videoWidth > 0 ? video.videoWidth : 640
      canvas.height = video.videoHeight > 0 ? video.videoHeight : 480

      // Determine video duration
      let duration
      if (!video.duration || video.duration === Number.POSITIVE_INFINITY || isNaN(video.duration)) {
        duration = Math.max(1, Math.min(10, videoBlob.size / (100 * 1024)))
        console.log(`[${extractionId}] Estimated duration: ${duration}s (based on file size)`)
      } else {
        duration = video.duration
        console.log(`[${extractionId}] Actual duration: ${duration}s`)
      }

      // Use a simpler approach - capture frames using requestAnimationFrame
      video.onloadeddata = () => {
        // Determine how many frames to extract (max 10)
        const targetFrameCount = Math.min(10, Math.ceil(duration * framesPerSecond))
        console.log(`[${extractionId}] Will extract ${targetFrameCount} frames`)

        // Play the video
        video
          .play()
          .then(() => {
            captureFrames(targetFrameCount, duration)
          })
          .catch((err) => {
            console.error(`[${extractionId}] Error playing video:`, err)

            // Fall back to static frame extraction
            extractStaticFrames(targetFrameCount, duration)
          })
      }
    }

    // Function to capture frames while video is playing
    function captureFrames(targetFrameCount, duration) {
      const frameInterval = duration / targetFrameCount
      let lastCaptureTime = -frameInterval // Ensure we capture the first frame

      function capture() {
        // Check if we've captured enough frames
        if (frames.length >= targetFrameCount) {
          console.log(`[${extractionId}] Captured all ${frames.length} frames`)
          video.pause()
          cleanupResources()
          resolve(frames)
          return
        }

        // Check if enough time has passed to capture another frame
        if (video.currentTime - lastCaptureTime >= frameInterval) {
          try {
            // Draw the current frame
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

            // Convert to data URL
            const dataUrl = canvas.toDataURL("image/jpeg", 0.8)
            frames.push(dataUrl)

            lastCaptureTime = video.currentTime
            console.log(
              `[${extractionId}] Captured frame ${frames.length}/${targetFrameCount} at ${video.currentTime.toFixed(2)}s`,
            )
          } catch (err) {
            console.error(`[${extractionId}] Error capturing frame:`, err)
          }
        }

        // Continue capturing if video is still playing
        if (!video.ended && !video.paused) {
          requestAnimationFrame(capture)
        } else {
          // Video ended or paused
          console.log(`[${extractionId}] Video playback ended with ${frames.length} frames`)
          cleanupResources()

          // If we have at least one frame, resolve
          if (frames.length > 0) {
            resolve(frames)
          } else {
            // Try static extraction as fallback
            extractStaticFrames(targetFrameCount, duration)
          }
        }
      }

      // Start capturing
      requestAnimationFrame(capture)
    }

    // Function to extract frames statically (fallback)
    function extractStaticFrames(targetFrameCount, duration) {
      console.log(`[${extractionId}] Using static frame extraction method`)

      // Minimum number of frames we need
      const minFrames = Math.min(5, targetFrameCount)

      // Extract frames at fixed intervals
      const capturePoints = []
      for (let i = 0; i < targetFrameCount; i++) {
        capturePoints.push(i * (duration / (targetFrameCount - 1)))
      }

      let currentIndex = 0

      function captureNextFrame() {
        if (currentIndex >= capturePoints.length || frames.length >= targetFrameCount) {
          console.log(`[${extractionId}] Static extraction complete with ${frames.length} frames`)
          cleanupResources()

          if (frames.length > 0) {
            resolve(frames)
          } else {
            reject(new Error("Could not extract any frames"))
          }
          return
        }

        const timePoint = capturePoints[currentIndex]
        console.log(
          `[${extractionId}] Setting time to ${timePoint.toFixed(2)}s (frame ${currentIndex + 1}/${targetFrameCount})`,
        )

        try {
          // Set the current time
          video.currentTime = timePoint

          // Wait for seeking to complete
          video.onseeked = () => {
            try {
              // Draw the frame
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

              // Convert to data URL
              const dataUrl = canvas.toDataURL("image/jpeg", 0.8)
              frames.push(dataUrl)

              console.log(`[${extractionId}] Captured static frame ${frames.length}/${targetFrameCount}`)

              // If we have enough frames, resolve early
              if (frames.length >= minFrames && currentIndex >= Math.floor(capturePoints.length / 2)) {
                console.log(`[${extractionId}] Collected enough frames (${frames.length}), resolving early`)
                cleanupResources()
                resolve(frames)
                return
              }

              // Move to next frame
              currentIndex++
              captureNextFrame()
            } catch (err) {
              console.error(`[${extractionId}] Error capturing static frame:`, err)
              currentIndex++
              captureNextFrame()
            }
          }
        } catch (err) {
          console.error(`[${extractionId}] Error setting current time:`, err)
          currentIndex++
          captureNextFrame()
        }
      }

      // Start capturing frames
      captureNextFrame()
    }

    // Set the video source
    video.src = videoUrl
    video.load()
  })
}
