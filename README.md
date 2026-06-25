<div align="center">
  <h1>🚀 NexLearn</h1>
  <p>An intelligent, AI-powered learning platform with PDF processing, video transcript extraction, and automated flashcard generation.</p>
</div>

## 🚀 Overview

NexLearn is a comprehensive full-stack learning management and ed-tech platform. It leverages state-of-the-art AI (via **Groq**) to enhance the learning experience by extracting knowledge from PDFs and YouTube videos, providing an interactive AI tutor, and generating smart flashcards to boost retention. 

---

## ✨ Key Features

- 🔐 **Secure Authentication**: Robust user authentication and session management powered by Clerk.
- 📄 **Smart Document Processing**: Upload PDFs and automatically extract, parse, and analyze content for learning.
- 🎥 **Video Transcript Analysis**: Seamlessly fetch and process YouTube transcripts for video-based learning.
- 🤖 **AI Learning Assistant**: An interactive AI tutor powered by **Groq** and LangChain for real-time Q&A, content summarization, and concept explanations.
- 🃏 **Automated Flashcards**: Generate Anki-compatible flashcards automatically from your learning materials using NLP.
- 📊 **Interactive Analytics Dashboard**: Track your learning progress with beautiful, real-time charts powered by Recharts.
- ⚡ **Real-Time Collaboration**: Live updates and notifications powered by WebSockets (Socket.io).
- 💳 **Seamless Payments**: Integrated payment gateways using Razorpay.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 19, Vite
- **Styling**: TailwindCSS
- **State Management & Routing**: React Router
- **Data Visualization**: Recharts, React Force Graph 2D
- **Real-time**: Socket.io Client
- **Authentication**: Clerk

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB (Mongoose)
- **Caching & Pub/Sub**: Redis (ioredis)
- **Real-time**: Socket.io
- **Emails**: Resend
- **Payments**: Razorpay

### ML / AI Service
- **Framework**: FastAPI, Uvicorn
- **AI Models & Inference**: **Groq** (Fast LLM Inference), Sentence Transformers (HuggingFace)
- **Orchestration**: LangChain
- **Vector Database**: Pinecone
- **Processing**: PyPDF, YouTube Transcript API, GenAnki (Flashcards)

---

## 📁 Project Structure

```text
nexlearn/
├── client/                # React Frontend application
├── server/                # Node.js/Express Backend server
├── ai-service/            # Python/FastAPI service for ML and AI features
├── docker-compose.yml     # Docker configuration for Redis & MongoDB
└── README.md              # Project documentation
```

---

## 🚀 How to run the repository?

### Prerequisites
Before you begin, ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Python](https://www.python.org/) (v3.9 or higher)
- [Docker](https://www.docker.com/) (optional, for running Redis/MongoDB locally)
- Git

### Installation & Setup

#### 1️⃣ Clone the Repository
```bash
git clone https://github.com/yourusername/nexlearn.git
cd nexlearn
```

#### 2️⃣ Backend Setup
```bash
cd server
npm install
# Create a .env file based on the required API keys below
npm run dev
```

#### 3️⃣ ML Service Setup
```bash
cd ../ai-service
python -m venv venv
# Activate the virtual environment:
# Windows: venv\Scripts\activate
# Mac/Linux: source venv/bin/activate

pip install -r requirements.txt
# Create a .env file based on the required API keys below
uvicorn app.main:app --reload --port 8000
```

#### 4️⃣ Frontend Setup
```bash
cd ../client
npm install
# Create a .env file based on the required API keys below
npm run dev
```

---

## 🔑 API Keys Required

You will need to set up the following environment variables in their respective `.env` files:

**Frontend (`client/.env`):**
- `VITE_CLERK_PUBLISHABLE_KEY`: Clerk Auth Public Key
- `VITE_API_URL`: Backend URL (e.g., `http://localhost:5000`)

**Backend (`server/.env`):**
- `PORT`: Server Port (default: 5000)
- `MONGO_URI`: MongoDB Connection String
- `REDIS_URL`: Redis Connection String
- `CLERK_SECRET_KEY`: Clerk Auth Secret Key
- `RAZORPAY_KEY_ID` & `RAZORPAY_KEY_SECRET`: Razorpay Payment Keys
- `RESEND_API_KEY`: Resend Email API Key
- `AI_SERVICE_URL`: URL to your local ML Service (e.g., `http://localhost:8000`)

**ML Service (`ai-service/.env`):**
- `GROQ_API_KEY`: Groq API Key for LLM Inference
- `PINECONE_API_KEY`: Pinecone Vector DB Key
- `PINECONE_ENVIRONMENT`: Pinecone Environment Region

---

## 🤝 Contributors

Contributions are always welcome! Feel free to open an issue or submit a Pull Request if you'd like to improve the project.

---

## 📝 License

This project is licensed under the **ISC License**.

---

## 🌟 Future Roadmap

- [ ] Implement Mobile-first Responsive UI enhancements
- [ ] Add support for more document types (DOCX, PPTX)
- [ ] Implement peer-to-peer study rooms using WebRTC
- [ ] Multi-language support for AI summaries
- [ ] Automated quiz generation from videos
