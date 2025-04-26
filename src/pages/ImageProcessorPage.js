"use client"

import { useState, useRef, useEffect } from "react"
import { Camera, RefreshCw, ImageIcon, Sliders } from "lucide-react"

const ImageProcessorPage = () => {
  const [activeTab, setActiveTab] = useState("upload")
  const [selectedImage, setSelectedImage] = useState(null)
  const [processedImage, setProcessedImage] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [filterSettings, setFilterSettings] = useState({
    brightness: 0,
    contrast: 1,
    saturation: 1,
    blur: 0,
  })
  const fileInputRef = useRef(null)
  const canvasRef = useRef(null)
  const webcamRef = useRef(null)

  // Handle file upload
  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file && file.type.match("image.*")) {
      const reader = new FileReader()
      reader.onload = (event) => {
        setSelectedImage(event.target.result)
        setProcessedImage(null)
      }
      reader.readAsDataURL(file)
    }
  }

  // Handle webcam capture
  const captureFromWebcam = () => {
    if (webcamRef.current) {
      const canvas = document.createElement("canvas")
      canvas.width = webcamRef.current.videoWidth
      canvas.height = webcamRef.current.videoHeight
      const ctx = canvas.getContext("2d")
      ctx.drawImage(webcamRef.current, 0, 0)
      setSelectedImage(canvas.toDataURL("image/jpeg"))
      setProcessedImage(null)
    }
  }

  // Process the image with TensorFlow.js
  const processImage = async () => {
    if (!selectedImage) return

    setIsProcessing(true)
    setProgress(0)

    try {
      // Load the image into a tensor
      const img = new Image()
      img.src = selectedImage
      await new Promise((resolve) => (img.onload = resolve))

      // Progress simulation
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          const newProgress = prev + 5
          if (newProgress >= 100) {
            clearInterval(progressInterval)
            return 100
          }
          return newProgress
        })
      }, 100)

      // Apply filters using canvas
      const canvas = document.createElement("canvas")
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext("2d")

      // Draw the original image
      ctx.drawImage(img, 0, 0)

      // Apply filters
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data

      for (let i = 0; i < data.length; i += 4) {
        // Apply brightness
        data[i] = Math.min(255, Math.max(0, data[i] + filterSettings.brightness * 255))
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + filterSettings.brightness * 255))
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + filterSettings.brightness * 255))

        // Apply contrast
        data[i] = Math.min(255, Math.max(0, ((data[i] / 255 - 0.5) * filterSettings.contrast + 0.5) * 255))
        data[i + 1] = Math.min(255, Math.max(0, ((data[i + 1] / 255 - 0.5) * filterSettings.contrast + 0.5) * 255))
        data[i + 2] = Math.min(255, Math.max(0, ((data[i + 2] / 255 - 0.5) * filterSettings.contrast + 0.5) * 255))

        // Apply saturation (simplified)
        const gray = 0.2989 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
        data[i] = Math.min(255, Math.max(0, gray + (data[i] - gray) * filterSettings.saturation))
        data[i + 1] = Math.min(255, Math.max(0, gray + (data[i + 1] - gray) * filterSettings.saturation))
        data[i + 2] = Math.min(255, Math.max(0, gray + (data[i + 2] - gray) * filterSettings.saturation))
      }

      ctx.putImageData(imageData, 0, 0)

      // Apply blur if needed (this is a simple implementation)
      if (filterSettings.blur > 0) {
        ctx.filter = `blur(${filterSettings.blur * 10}px)`
        ctx.drawImage(canvas, 0, 0)
        ctx.filter = "none"
      }

      // Get the processed image
      const processedDataUrl = canvas.toDataURL("image/jpeg")

      // Simulate processing delay
      setTimeout(() => {
        setProcessedImage(processedDataUrl)
        setIsProcessing(false)
        setProgress(100)
      }, 1000)
    } catch (error) {
      console.error("Error processing image:", error)
      setIsProcessing(false)
      setProgress(0)
    }
  }

  // Initialize webcam
  useEffect(() => {
    if (activeTab === "webcam" && !webcamRef.current?.srcObject) {
      navigator.mediaDevices
        .getUserMedia({ video: true })
        .then((stream) => {
          if (webcamRef.current) {
            webcamRef.current.srcObject = stream
          }
        })
        .catch((err) => {
          console.error("Error accessing webcam:", err)
        })
    }

    // Cleanup
    return () => {
      if (webcamRef.current?.srcObject) {
        const tracks = webcamRef.current.srcObject.getTracks()
        tracks.forEach((track) => track.stop())
      }
    }
  }, [activeTab])

  // Handle filter changes
  const handleFilterChange = (filter, value) => {
    setFilterSettings((prev) => ({
      ...prev,
      [filter]: Number.parseFloat(value),
    }))
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gray-100 p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-800">Image Processor</h2>
          <p className="text-gray-600">Upload, capture, and process images with TensorFlow.js</p>
        </div>

        {/* Tabs */}
        <div className="p-4 border-b">
          <div className="flex space-x-1 rounded-lg bg-gray-100 p-1">
            <button
              className={`flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium ${
                activeTab === "upload" ? "bg-white text-gray-900 shadow" : "text-gray-700 hover:bg-gray-200"
              }`}
              onClick={() => setActiveTab("upload")}
            >
              <ImageIcon className="mr-2 h-4 w-4" />
              Upload
            </button>
            <button
              className={`flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium ${
                activeTab === "webcam" ? "bg-white text-gray-900 shadow" : "text-gray-700 hover:bg-gray-200"
              }`}
              onClick={() => setActiveTab("webcam")}
            >
              <Camera className="mr-2 h-4 w-4" />
              Webcam
            </button>
            <button
              className={`flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium ${
                activeTab === "settings" ? "bg-white text-gray-900 shadow" : "text-gray-700 hover:bg-gray-200"
              }`}
              onClick={() => setActiveTab("settings")}
            >
              <Sliders className="mr-2 h-4 w-4" />
              Settings
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Upload Tab */}
          <div className={activeTab === "upload" ? "block" : "hidden"}>
            <div className="flex flex-col items-center justify-center space-y-4">
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:bg-gray-50"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600">Click to upload an image or drag and drop</p>
                <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
              </div>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
              <button
                className={`px-4 py-2 rounded-md text-white font-medium ${
                  selectedImage && !isProcessing ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-400 cursor-not-allowed"
                }`}
                disabled={!selectedImage || isProcessing}
                onClick={processImage}
              >
                {isProcessing ? (
                  <span className="flex items-center">
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </span>
                ) : (
                  "Process Image"
                )}
              </button>
            </div>
          </div>

          {/* Webcam Tab */}
          <div className={activeTab === "webcam" ? "block" : "hidden"}>
            <div className="flex flex-col items-center justify-center space-y-4">
              <div className="relative w-full max-w-md overflow-hidden rounded-lg border border-gray-300">
                <video ref={webcamRef} autoPlay playsInline className="w-full h-auto" />
              </div>
              <div className="flex space-x-4">
                <button
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  onClick={captureFromWebcam}
                >
                  <Camera className="mr-2 h-4 w-4 inline" />
                  Capture
                </button>
                <button
                  className={`px-4 py-2 rounded-md text-white font-medium ${
                    selectedImage && !isProcessing ? "bg-blue-600 hover:bg-blue-700" : "bg-gray-400 cursor-not-allowed"
                  }`}
                  disabled={!selectedImage || isProcessing}
                  onClick={processImage}
                >
                  {isProcessing ? (
                    <span className="flex items-center">
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </span>
                  ) : (
                    "Process Image"
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Settings Tab */}
          <div className={activeTab === "settings" ? "block" : "hidden"}>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Brightness ({filterSettings.brightness.toFixed(2)})
                </label>
                <input
                  type="range"
                  min="-1"
                  max="1"
                  step="0.01"
                  value={filterSettings.brightness}
                  onChange={(e) => handleFilterChange("brightness", e.target.value)}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Contrast ({filterSettings.contrast.toFixed(2)})
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.01"
                  value={filterSettings.contrast}
                  onChange={(e) => handleFilterChange("contrast", e.target.value)}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Saturation ({filterSettings.saturation.toFixed(2)})
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.01"
                  value={filterSettings.saturation}
                  onChange={(e) => handleFilterChange("saturation", e.target.value)}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Blur ({filterSettings.blur.toFixed(2)})
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={filterSettings.blur}
                  onChange={(e) => handleFilterChange("blur", e.target.value)}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 w-full"
                onClick={() => {
                  setFilterSettings({
                    brightness: 0,
                    contrast: 1,
                    saturation: 1,
                    blur: 0,
                  })
                }}
              >
                Reset Filters
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          {isProcessing && (
            <div className="mt-6">
              <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300 ease-in-out"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <p className="text-center text-sm text-gray-600 mt-2">Processing: {progress}%</p>
            </div>
          )}

          {/* Image Preview */}
          {(selectedImage || processedImage) && (
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
              {selectedImage && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-4 py-2 border-b">
                    <h3 className="font-medium">Original Image</h3>
                  </div>
                  <div className="p-4">
                    <img src={selectedImage || "/placeholder.svg"} alt="Original" className="w-full h-auto rounded" />
                  </div>
                </div>
              )}
              {processedImage && (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-gray-100 px-4 py-2 border-b">
                    <h3 className="font-medium">Processed Image</h3>
                  </div>
                  <div className="p-4">
                    <img src={processedImage || "/placeholder.svg"} alt="Processed" className="w-full h-auto rounded" />
                  </div>
                  <div className="bg-gray-50 px-4 py-3 border-t">
                    <a
                      href={processedImage}
                      download="processed-image.jpg"
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      Download Processed Image
                    </a>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ImageProcessorPage
