# GestureAI: Sign Language Interpreter

<div align="center">
  <img src="/placeholder.svg?height=200&width=200&query=sign language interpretation with AI" alt="GestureAI Logo" />
  <h3>AI-Powered Gesture Recognition & Sign Language Interpretation</h3>
</div>

## 📋 Overview

GestureAI is a comprehensive web application that combines real-time gesture recognition with advanced sign language interpretation capabilities. Using TensorFlow.js for hand tracking and Google's Gemini AI for interpretation, this application bridges communication gaps by translating sign language into text and providing learning resources for sign language.

## ✨ Features

### 🖐️ Gesture Recognition
- Real-time hand tracking and gesture detection
- Recognition of common gestures (thumbs up, peace sign)
- Visual feedback with color-coded hand landmarks
- Gesture history tracking

### 🤟 Sign Language Interpretation
- Record and interpret sign language videos
- Real-time sign language detection and translation
- Learning modules for ASL (American Sign Language)
- Practice mode with feedback

### 📷 Image Processing
- QR code-based phone-to-computer image transfer
- Text extraction from images using OCR
- PDF generation from extracted text
- AI-powered content analysis

## 🛠️ Technologies

- **Frontend**: React.js
- **AI Models**: 
  - TensorFlow.js & Handpose for gesture recognition
  - Google Gemini AI for interpretation
  - Tesseract.js for OCR
- **Video Processing**: MediaRecorder API, Canvas
- **PDF Generation**: jsPDF
- **Styling**: Tailwind CSS, shadcn/ui components

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/gesture-ai.git
   cd gesture-ai
   ```

2. **Install dependencies**
```bash
    npm install
```

3. **Set up environment variable**
```bash
    REACT_APP_GEMINI_API_KEY=your_gemini_api_key_here
```
4. **Start development server**
```bash
    npm start
```
## 📁 Project Structure

```bash


gesture-ai/
├── public/
│   └── images/
├── src/
│   ├── components/
│   │   ├── ui/
│   │   ├── SignLanguageDetector.js
│   │   ├── SignInterpreterOptimized.js
│   │   ├── VideoRecorder.js
│   │   └── ...
│   ├── pages/
│   │   ├── SignLanguagePage.js
│   │   └── ImageProcessorPage.js
│   ├── services/
│   │   ├── GeminiService.js
│   │   ├── HandTrackingService.js
│   │   └── ...
│   ├── utils/
│   │   ├── videoUtils.js
│   │   └── ...
│   ├── styles/
│   ├── App.js
│   └── index.js
├── package.json
└── README.md
```

# Usage
### Gesture Recognition

```bash
    - Navigate to the Gesture Recognition tab
    - Allow camera access when prompted
    - Click "Start Detection" to begin tracking hand gestures
    - Make a thumbs up or peace sign gesture to trigger automatic capture
    - View the AI's interpretation of your gesture
```

### Sign Language Interpreter
```bash
Navigate to the Sign Language tab
Choose between "Communicate", "Learn Sign Language", or "Record & Interpret"
For recording:

- Click "Start Recording"
- Perform sign language gestures
- Click "Stop Recording"
- View the interpretation
```

## 🧠 How It Works

### Hand Tracking Pipeline

1. **Detection**: TensorFlow.js and Handpose model detect hand landmarks
2. **Gesture Recognition**: Fingerpose library identifies specific gestures
3. **Visualization**: Canvas overlay draws color-coded landmarks and connections
4. **Analysis**: Detected gestures are sent to Gemini AI for interpretation


### Sign Language Interpretation

1. **Video Recording**: Capture sign language video using MediaRecorder API
2. **Frame Extraction**: Extract key frames from the video
3. **AI Analysis**: Send frames to Gemini Vision API with specialized prompts
4. **Interpretation**: Process and display the AI's interpretation