# NexLearn Setup Verification Guide

## Quick Start - What You Need to Check

### 1. Environment Variables Setup

#### Server (.env)
```
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/nexlearn
CLERK_SECRET_KEY=sk_test_jxKPGKXgXqZGOXnFBMsOcHqefqKRTdJPwaa3EUGrJx
CLIENT_URL=http://localhost:5173
AI_SERVICE_URL=http://localhost:8000
REDIS_URL=redis://localhost:6379
```

#### AI Service (.env)
```
GEMINI_API_KEY=AIzaSyD1I-G3IjfGu-yJ5QfCSjcAgIVxJEU8JNQ
PINECONE_API_KEY=pcsk_6uwn3s_LcgrH51pcLiSLn58c25h1WKBaQfwdmkKKAEwB2SbLz8pQXzJGRrY3f96KRGGwjq
PINECONE_INDEX=nexlearn-local
NODE_API_URL=http://localhost:5000
REDIS_URL=redis://localhost:6379
```

#### Client (.env)
```
VITE_CLERK_PUBLISHABLE_KEY=pk_test_Y2hlZXJmdWwtb2FyZmlzaC03MC5jbGVyay5hY2NvdW50cy5kZXYk
VITE_API_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

### 2. Services Status Check

Run these commands in separate terminals:

```bash
# Terminal 1: Docker Services
docker compose up -d mongo redis
docker compose logs -f

# Terminal 2: Node Server
cd server
npm install
npm start
# Expected: Server running on port 5000

# Terminal 3: Python AI Service
cd ai-service
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn app.main:app --reload
# Expected: Application startup complete on http://0.0.0.0:8000

# Terminal 4: Client
cd client
npm install
npm run dev
# Expected: VITE v... ready in ... ms
```

### 3. Verify All Services Are Running

```bash
# Check MongoDB
curl http://localhost:27017/
# Should show: It looks like you are trying to access MongoDB

# Check Redis
redis-cli ping
# Should show: PONG

# Check Node Server
curl http://localhost:5000/health
# Should show: {"status":"ok"}

# Check AI Service
curl http://localhost:8000/health
# Should show: {"status":"ok"}

# Check Client
curl http://localhost:5173/
# Should show: HTML content
```

### 4. Common Issues & Fixes

#### Issue: Request failed with status code 500 (PDF Upload)

**Possible Causes:**

1. **AI Service not running**
   - Solution: Start Python service on port 8000
   
2. **Gemini API Key invalid**
   - Check: `AIzaSyD1I-G3IjfGu-yJ5QfCSjcAgIVxJEU8JNQ` is valid
   - Get new key: https://makersuite.google.com/app/apikey
   
3. **Pinecone connection failed**
   - Check API key: `pcsk_6uwn3s_LcgrH51pcLiSLn58c25h1WKBaQfwdmkKKAEwB2SbLz8pQXzJGRrY3f96KRGGwjq`
   - Check index exists: `nexlearn-local`
   - Verify Pinecone dashboard: https://app.pinecone.io
   
4. **MongoDB not connected**
   - Check: Docker container is running
   - Solution: `docker compose up -d mongo`
   
5. **Python package issues**
   - Check dependencies installed:
     ```bash
     cd ai-service
     pip install --upgrade google-genai
     pip install -r requirements.txt
     ```

#### Issue: CORS Error

**Solution:** Ensure `CLIENT_URL` in server .env matches your client URL:
```
CLIENT_URL=http://localhost:5173
```

#### Issue: Clerk Authentication Failing

**Solution:** Verify keys in both server and client .env:
- Server: `CLERK_SECRET_KEY`
- Client: `VITE_CLERK_PUBLISHABLE_KEY`

### 5. Testing PDF Upload Flow

1. **Frontend**: Navigate to "Upload PDF" page
2. **Select** a PDF file
3. **Click** Upload
4. **Monitor** these logs:
   ```
   Frontend: Console logs (F12)
   Server: Terminal 2 - should show axios call to AI service
   AI Service: Terminal 3 - should show [INGEST START] logs
   ```

### 6. Debug PDF Upload - Check Logs in This Order

**Client Console (F12):**
```javascript
// Should see request details
POST /api/courses/upload
```

**Server Logs:**
```
[ai.service] Call to http://localhost:8000/ingest/pdf
AI service response: ...
```

**AI Service Logs:**
```
[INGEST START] courseId=... userId=...
[FILE READ] File size: ...
[PDF PARSED] Extracted ...
[CHUNKING COMPLETE] Created ...
[EMBEDDING COMPLETE] Stored in Pinecone
[METADATA GENERATED] ...
[FLASHCARDS GENERATED] ...
[INGEST COMPLETE] Success
```

### 7. Port Summary

| Service | Port | URL |
|---------|------|-----|
| Frontend | 5173 | http://localhost:5173 |
| Backend (Node) | 5000 | http://localhost:5000 |
| AI Service (Python) | 8000 | http://localhost:8000 |
| MongoDB | 27017 | mongodb://localhost:27017 |
| Redis | 6379 | redis://localhost:6379 |

### 8. Quick Restart

```bash
# Kill all services
pkill -f "uvicorn"  # AI Service
pkill -f "node"     # Node Server
pkill -f "vite"     # Client

# Restart Docker
docker compose down
docker compose up -d mongo redis

# Restart in new terminals as shown in Step 2
```

### 9. Troubleshooting Commands

```bash
# Check if ports are in use
lsof -i :5173   # Client
lsof -i :5000   # Server
lsof -i :8000   # AI Service
lsof -i :27017  # MongoDB
lsof -i :6379   # Redis

# View Docker logs
docker compose logs mongo
docker compose logs redis

# Check Python packages
pip list | grep -E "fastapi|pinecone|google|sentence"

# Test Pinecone connection (in Python)
python3
>>> from pinecone import Pinecone
>>> pc = Pinecone(api_key="YOUR_KEY")
>>> pc.list_indexes()
```

### 10. Success Indicators

✅ All services started without errors
✅ All health checks return 200 OK
✅ PDF uploads complete in 30-60 seconds
✅ Flashcards and summary appear in response
✅ Data stored in Pinecone successfully
✅ Chat queries return streamed responses

## Next Steps

Once all services are running, test the complete flow:
1. Sign up / Sign in with Clerk
2. Upload a PDF document
3. View generated flashcards
4. Chat with the course content
5. Take quiz based on extracted concepts
