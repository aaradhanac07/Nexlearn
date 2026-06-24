# NexLearn - Complete Setup & Troubleshooting Guide
cd server
node dev-with-memdb.mjs

cd ai-service
venv\Scripts\activate
uvicorn app.main:app --reload

cd client
npm run dev
## 📋 Overview

DEPLOYMENT
server  https://nexlearn-backend-rc3c.onrender.com
AI_SERVICE_URL=https://nexlearn-ai.onrender.com
VITE_API_URL=https://nexlearn-backend-rc3c.onrender.com

NexLearn is a full-stack learning platform with:
- **Frontend**: React + Vite + Clerk Auth
- **Backend**: Node.js/Express + MongoDB + Redis
- **AI Service**: Python/FastAPI + Gemini API + Pinecone + Sentence Transformers

This document covers all setup issues and their fixes.

## 🚦 Troubleshooting: "Too Many Requests" (HTTP 429)

If you see a "Too many requests" or 429 error while generating quizzes, flashcards, or knowledge graphs, you are hitting the **Groq API Rate Limits**.

**Why it happens:**
Groq's free tier is incredibly fast but enforces strict limits on:
1. **Requests per Minute (RPM):** Typically ~30 requests per minute.
2. **Tokens per Minute (TPM):** Generating large outputs (like full quizzes) quickly consumes token limits.
3. **Tokens per Day:** A hard cap per day (usually ~14,400 requests or equivalent tokens).

**How to fix it:**
- **Wait a minute:** Most limits reset every 60 seconds. Wait 1-2 minutes and try clicking generate again.
- **Check the Terminal:** Look at the `ai-service` terminal logs. Groq usually provides a clear message about exactly how long you need to wait before making another request.
- **Space out actions:** Avoid rapidly generating multiple quizzes or graphs back-to-back.
- **Change API Keys (If needed):** If you hit the daily limit, you'll need to wait 24 hours, or create a new API key on [console.groq.com](https://console.groq.com).

---

## ✅ Issues Fixed

### 1. **Python Import Error** ✓
**Problem**: `from google import genai` - incorrect import statement
**Solution**: Changed to `import google.genai as genai`
**Files Modified**:
- `ai-service/app/services/card_gen.py`
- `ai-service/app/services/rag.py`

### 2. **Missing Environment Variables** ✓
**Problem**: Redis URL and Pinecone environment variables were commented out
**Solution**: Uncommented and configured in `ai-service/.env`:
```
REDIS_URL=redis://localhost:6379
PINECONE_API_KEY=pcsk_6uwn3s_...
PINECONE_INDEX=nexlearn-local
```
**File Modified**: `ai-service/.env`

### 3. **Inadequate Error Logging** ✓
**Problem**: Generic error messages made debugging difficult
**Solution**: Enhanced error logging in:
- `ai-service/app/api/ingest.py` - Added detailed logging for each step
- `server/src/controllers/course.controller.js` - Added request/response logging
- `server/src/services/ai.service.js` - Added service call debugging

### 4. **Poor Error Handling in Frontend** ✓
**Problem**: User couldn't see actual error messages from backend
**Solution**: Improved error extraction in `client/src/components/course/IngestForm.jsx`:
- Checks multiple error response formats
- Shows upload progress percentage
- Displays detailed error messages to user

---

## 🔧 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (5173)                       │
│                  React + Vite + Clerk Auth                  │
└─────────────┬──────────────────────────────────────────────┘
              │
              │ HTTP
              │
┌─────────────▼──────────────────────────────────────────────┐
│                     Backend API (5000)                       │
│              Node.js/Express + MongoDB + Redis              │
│  • Auth Routes (Clerk verification)                         │
│  • Course Routes (upload, list, get)                        │
│  • Calls AI Service for PDF processing                      │
└─────────────┬──────────────────────────────────────────────┘
              │
              │ HTTP (axios)
              │
┌─────────────▼──────────────────────────────────────────────┐
│                   AI Service (8000)                          │
│              Python/FastAPI + Gemini + Pinecone            │
│  • /ingest/pdf - Parse PDF, chunk, embed                    │
│  • /chat - RAG-based query answering                        │
│  • Uses Sentence Transformers for embeddings               │
│  • Uses Pinecone as vector database                         │
└─────────────┬──────────────────────────────────────────────┘
              │
    ┌─────────┴────────────────┐
    │                          │
┌───▼──────────────┐  ┌────────▼──────────┐
│   Pinecone       │  │  Gemini API       │
│  (Vector DB)     │  │  (LLM/Chat)       │
└──────────────────┘  └───────────────────┘

External Services:
├─ MongoDB (27017) - Document store
├─ Redis (6379) - Caching
├─ Pinecone - Vector embeddings storage
└─ Gemini API - LLM for generation
```

---

## 🚀 Complete Setup Instructions

### Step 1: Clone & Configure Environment

```bash
cd c:\Users\aashe\nexlearn
```

**Create/Verify `server/.env`:**
```bash
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/nexlearn
CLERK_SECRET_KEY=sk_test_jxKPGKXgXqZGOXnFBMsOcHqefqKRTdJPwaa3EUGrJx
CLIENT_URL=http://localhost:5173
AI_SERVICE_URL=http://localhost:8000
REDIS_URL=redis://localhost:6379
```

**Create/Verify `ai-service/.env`:**
```bash
GEMINI_API_KEY=AIzaSyD1I-G3IjfGu-yJ5QfCSjcAgIVxJEU8JNQ
PINECONE_API_KEY=pcsk_6uwn3s_LcgrH51pcLiSLn58c25h1WKBaQfwdmkKKAEwB2SbLz8pQXzJGRrY3f96KRGGwjq
PINECONE_INDEX=nexlearn-local
NODE_API_URL=http://localhost:5000
REDIS_URL=redis://localhost:6379
```

**Create/Verify `client/.env`:**
```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_test_Y2hlZXJmdWwtb2FyZmlzaC03MC5jbGVyay5hY2NvdW50cy5kZXYk
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

### Step 2: Start Docker Services

```bash
# Terminal 1: Docker (MongoDB + Redis)
docker compose up -d mongo redis

# Verify
docker compose logs -f
# Should see:
# mongo:  ... waiting for connections on port 27017
# redis:  * Ready to accept connections
```

### Step 3: Start Backend Services

```bash
# Terminal 2: Node.js Server
cd server
npm install
npm start
# Expected output:
# > server@1.0.0 start
# Server running on port 5000

# Terminal 3: Python AI Service
cd ai-service

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start server
uvicorn app.main:app --reload
# Expected output:
# INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
# INFO:     Application startup complete
```

### Step 4: Start Frontend

```bash
# Terminal 4: React Frontend
cd client
npm install
npm run dev
# Expected output:
#   VITE v4.x.x  ready in 123 ms
#   ➜  Local:   http://localhost:5173/
```

### Step 5: Verify All Services

```bash
# Test in new terminal
curl http://localhost:5000/health      # Node.js
curl http://localhost:8000/health      # Python
curl http://localhost:27017/           # MongoDB
redis-cli ping                         # Redis
```

---

## 🐛 Debugging PDF Upload Error (500)

### Flow Diagram

```
Client (React)
    ↓
    POST /api/courses/upload (with PDF file)
    ↓
Server (Node.js) [port 5000]
    ├─ Validates file exists
    ├─ Creates Course document in MongoDB
    ├─ Calls AI Service: POST http://localhost:8000/ingest/pdf
    │   ↓
    │   AI Service (Python) [port 8000]
    │   ├─ Reads file bytes
    │   ├─ Parse PDF → extract text
    │   ├─ Chunk text → create chunks
    │   ├─ Embed chunks → send to Pinecone
    │   ├─ Generate summary (Gemini API)
    │   ├─ Generate flashcards (Gemini API)
    │   └─ Return results
    │
    ├─ Updates Course with AI results
    ├─ Creates Card documents for flashcards
    └─ Returns Course (201)

Error can occur at ANY step above.
```

### Check Each Component

#### 1. **Client Console (F12)**
```javascript
// Should see request
POST http://localhost:5000/api/courses/upload
```

#### 2. **Server Logs (Terminal 2)**
```
[uploadCourse] Starting PDF upload...
[uploadCourse] File: document.pdf, Size: 524288 bytes
[uploadCourse] Course created with ID: 507f1f77bcf86cd799439011
[uploadCourse] Calling AI service at http://localhost:8000/ingest/pdf
[uploadCourse] AI service response received
[uploadCourse] Course metadata updated
[uploadCourse] PDF upload complete - Success!
```

If error at AI service call:
```
[uploadCourse] AI service error: connect ECONNREFUSED 127.0.0.1:8000
[uploadCourse] AI service details: { code: 'ECONNREFUSED', status: null, ... }
```

**Solution**: Start Python service on port 8000

#### 3. **AI Service Logs (Terminal 3)**
```
INFO:     127.0.0.1:52789 - "POST /ingest/pdf HTTP/1.1" 200 OK

[INGEST START] courseId=507f1f77bcf86cd799439011, userId=user_123, filename=document.pdf
[FILE READ] File size: 524288 bytes
[PDF PARSED] Extracted 45234 characters
[CHUNKING COMPLETE] Created 42 chunks
[EMBEDDING COMPLETE] Stored in Pinecone
[METADATA GENERATED] dict_keys(['title', 'description', 'summary', 'concepts'])
[FLASHCARDS GENERATED] 10 cards
[INGEST COMPLETE] Success
```

If error with imports:
```
ImportError: cannot import name 'genai' from 'google'
```
**Solution**: Already fixed - reinstall packages
```bash
pip install --upgrade google-genai
pip install -r requirements.txt
```

#### 4. **MongoDB Check**
```bash
# Verify course was created
mongosh
> use nexlearn
> db.courses.find().pretty()
```

#### 5. **Pinecone Check**
```bash
# Test connection (in Python)
python3
>>> from pinecone import Pinecone
>>> pc = Pinecone(api_key="YOUR_API_KEY")
>>> pc.list_indexes()
# Should show: nexlearn-local

>>> idx = pc.Index("nexlearn-local")
>>> idx.describe_index_stats()
# Should show namespace with vectors
```

---

## 📊 Common Error Messages & Solutions

### **❌ "Request failed with status code 500"**

| Error | Cause | Solution |
|-------|-------|----------|
| `[uploadCourse] AI service error: ECONNREFUSED` | Python service not running | Start: `uvicorn app.main:app --reload` |
| `[INGEST FATAL ERROR] No module named 'google'` | Missing dependencies | `pip install -r requirements.txt` |
| `[EMBEDDING ERROR] Invalid API key` | Pinecone API key wrong | Check `PINECONE_API_KEY` in `.env` |
| `[METADATA ERROR] 403 Forbidden` | Gemini API key invalid | Check `GEMINI_API_KEY` in `.env` |
| `[PDF PARSE ERROR] No text extracted` | PDF is image-based | Use OCR or text-based PDF |
| `ECONNREFUSED 127.0.0.1:27017` | MongoDB not running | `docker compose up -d mongo` |

### **❌ "CORS Error"**
```
Access to XMLHttpRequest blocked by CORS policy
```
**Solution**: Verify in `server/.env`:
```
CLIENT_URL=http://localhost:5173
```

### **❌ "UserNotFound"**
```
{"error":"UserNotFound","message":"Call /auth/sync first"}
```
**Solution**: Sign up via Clerk, sync user to MongoDB first

### **❌ "Port already in use"**
```bash
# Find process using port
lsof -i :5000    # Find process on 5000
kill -9 <PID>    # Kill process
```

---

## 🔐 Environment Variables Checklist

### Frontend (`client/.env`)
- [ ] `VITE_CLERK_PUBLISHABLE_KEY` - Get from https://dashboard.clerk.com
- [ ] `VITE_API_URL=http://localhost:5000`
- [ ] `VITE_SOCKET_URL=http://localhost:5000`

### Backend (`server/.env`)
- [ ] `PORT=5000`
- [ ] `NODE_ENV=development`
- [ ] `MONGODB_URI=mongodb://localhost:27017/nexlearn`
- [ ] `CLERK_SECRET_KEY` - Get from https://dashboard.clerk.com
- [ ] `CLIENT_URL=http://localhost:5173`
- [ ] `AI_SERVICE_URL=http://localhost:8000`
- [ ] `REDIS_URL=redis://localhost:6379`

### AI Service (`ai-service/.env`)
- [ ] `GEMINI_API_KEY` - Get from https://makersuite.google.com/app/apikey
- [ ] `PINECONE_API_KEY` - Get from https://app.pinecone.io
- [ ] `PINECONE_INDEX=nexlearn-local` (must exist in Pinecone)
- [ ] `NODE_API_URL=http://localhost:5000`
- [ ] `REDIS_URL=redis://localhost:6379`

---

## 📈 Performance Monitoring

### Monitor Pinecone Vectors
```python
from pinecone import Pinecone

pc = Pinecone(api_key="YOUR_KEY")
idx = pc.Index("nexlearn-local")

# Check stats
stats = idx.describe_index_stats()
print(f"Total vectors: {stats['total_vector_count']}")
print(f"Dimensions: {stats['dimension']}")
print(f"Namespaces: {list(stats['namespaces'].keys())}")
```

### Monitor MongoDB
```bash
mongosh
> db.courses.countDocuments()
> db.cards.countDocuments()
> db.courses.find({}, {title: 1, status: 1}).pretty()
```

### Monitor Redis
```bash
redis-cli
> INFO
> KEYS *
```

---

## 🧪 Testing PDF Upload

### Test with Sample PDF

```bash
# Create simple test PDF (using Python)
python3
>>> from reportlab.pdfgen import canvas
>>> c = canvas.Canvas("test.pdf")
>>> c.drawString(100, 750, "Machine Learning Introduction")
>>> c.drawString(100, 730, "Machine learning is a subset of AI...")
>>> c.save()
```

### Upload Steps
1. Open http://localhost:5173
2. Sign in with Clerk
3. Navigate to "Upload PDF"
4. Select test PDF
5. Click "Upload PDF"
6. Monitor logs in all terminals
7. Check success in browser

### Verify Results
```bash
# Check course created
mongosh
> use nexlearn
> db.courses.findOne({}, {title: 1, status: 1, concepts: 1})

# Check cards created
> db.cards.find({}).limit(5).pretty()

# Check Pinecone vectors
python3
>>> from pinecone import Pinecone
>>> pc = Pinecone(api_key="YOUR_KEY")
>>> idx = pc.Index("nexlearn-local")
>>> idx.describe_index_stats()["namespaces"]["COURSE_ID"]["vector_count"]
```

---

## 🚨 Emergency Troubleshooting

### Full Reset

```bash
# 1. Stop all services
docker compose down
pkill -f "uvicorn"
pkill -f "npm"

# 2. Clean data
rm -rf server/node_modules client/node_modules ai-service/venv

# 3. Clean databases
docker volume rm nexlearn_mongo_data
# or
docker compose down -v

# 4. Restart fresh
docker compose up -d mongo redis
cd server && npm install && npm start
cd ai-service && pip install -r requirements.txt && uvicorn app.main:app --reload
cd client && npm install && npm run dev
```

### Check All Ports in Use
```bash
lsof -i -P -n | grep LISTEN
# Look for: 5173, 5000, 8000, 27017, 6379
```

### Verify Network Connectivity
```bash
# From Server to AI Service
curl http://localhost:8000/health

# From AI Service to Pinecone
python3 -c "from pinecone import Pinecone; print('OK')"

# From Frontend to Server
curl http://localhost:5000/health
```

---

## 📚 File Structure Reference

```
nexlearn/
├── docker-compose.yml          # MongoDB, Redis config
├── SETUP_VERIFICATION.md       # This setup guide
├── verify-setup.sh            # Auto verification script
│
├── client/                     # React Frontend
│   ├── .env                   # Frontend config
│   ├── src/
│   │   ├── components/
│   │   │   └── course/
│   │   │       └── IngestForm.jsx  # PDF upload form [FIXED]
│   │   └── hooks/
│   │       └── useAxios.js    # API client
│   └── package.json
│
├── server/                     # Node.js Backend  
│   ├── .env                   # Backend config
│   ├── src/
│   │   ├── index.js           # Express app
│   │   ├── controllers/
│   │   │   └── course.controller.js  # Upload handler [FIXED]
│   │   ├── services/
│   │   │   └── ai.service.js  # AI service caller [FIXED]
│   │   ├── routes/
│   │   │   └── course.routes.js
│   │   ├── models/
│   │   │   ├── Course.js
│   │   │   └── Card.js
│   │   └── middleware/
│   │       ├── attachUser.js
│   │       └── errorHandler.js
│   └── package.json
│
└── ai-service/                # Python FastAPI
    ├── .env                   # AI config [FIXED]
    ├── requirements.txt       # Python dependencies
    ├── app/
    │   ├── main.py           # FastAPI app
    │   ├── api/
    │   │   └── ingest.py    # PDF upload endpoint [FIXED - ENHANCED LOGGING]
    │   ├── services/
    │   │   ├── pdf_parser.py
    │   │   ├── chunker.py
    │   │   ├── embedder.py
    │   │   ├── rag.py       # [FIXED IMPORT]
    │   │   └── card_gen.py  # [FIXED IMPORT]
    │   ├── models/
    │   │   └── schemas.py
    │   └── core/
    │       └── config.py    # Config loader
    └── Dockerfile
```

---

## ✨ Next Steps

1. ✅ **Verify setup** using `verify-setup.sh`
2. ✅ **Test PDF upload** with sample document
3. ✅ **Check logs** at each step
4. ✅ **Monitor performance** with dashboard
5. ✅ **Scale deployment** when ready

---

## 📞 Support Commands

```bash
# View logs
docker compose logs -f mongo
docker compose logs -f redis

# Python logs with timestamps
tail -f /var/log/app.log

# Check service status
systemctl status docker
ps aux | grep uvicorn
ps aux | grep node

# Network diagnostics
netstat -an | grep LISTEN
tcpdump -i lo port 8000  # Monitor localhost traffic
```

---

**Last Updated**: 2024-05-24
**Status**: ✅ All critical issues fixed and documented
