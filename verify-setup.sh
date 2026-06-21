#!/bin/bash
# NexLearn Setup Verification Script

set -e

echo "╔════════════════════════════════════════╗"
echo "║   NexLearn Setup Verification Tool     ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter
PASSED=0
FAILED=0

# Helper functions
check_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# 1. Check Environment Files
echo "1️⃣  Checking Environment Files..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -f "server/.env" ]; then
    check_pass "server/.env exists"
    if grep -q "MONGODB_URI" server/.env; then
        check_pass "server/.env has MONGODB_URI"
    else
        check_fail "server/.env missing MONGODB_URI"
    fi
    if grep -q "AI_SERVICE_URL" server/.env; then
        check_pass "server/.env has AI_SERVICE_URL"
    else
        check_fail "server/.env missing AI_SERVICE_URL"
    fi
else
    check_fail "server/.env not found"
fi

if [ -f "ai-service/.env" ]; then
    check_pass "ai-service/.env exists"
    if grep -q "GEMINI_API_KEY" ai-service/.env; then
        check_pass "ai-service/.env has GEMINI_API_KEY"
    else
        check_fail "ai-service/.env missing GEMINI_API_KEY"
    fi
    if grep -q "PINECONE_API_KEY" ai-service/.env; then
        check_pass "ai-service/.env has PINECONE_API_KEY"
    else
        check_fail "ai-service/.env missing PINECONE_API_KEY"
    fi
else
    check_fail "ai-service/.env not found"
fi

if [ -f "client/.env" ]; then
    check_pass "client/.env exists"
    if grep -q "VITE_CLERK_PUBLISHABLE_KEY" client/.env; then
        check_pass "client/.env has VITE_CLERK_PUBLISHABLE_KEY"
    else
        check_fail "client/.env missing VITE_CLERK_PUBLISHABLE_KEY"
    fi
else
    check_fail "client/.env not found"
fi

echo ""
# 2. Check Port Availability
echo "2️⃣  Checking Port Availability..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_port() {
    if lsof -Pi :$2 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        check_pass "Port $2 ($1) is in use"
    else
        check_warn "Port $2 ($1) is available (service may not be running)"
    fi
}

check_port "Client" 5173
check_port "Server" 5000
check_port "AI Service" 8000
check_port "MongoDB" 27017
check_port "Redis" 6379

echo ""
# 3. Check Docker Containers
echo "3️⃣  Checking Docker Services..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v docker &> /dev/null; then
    if docker ps | grep -q mongo; then
        check_pass "MongoDB Docker container is running"
    else
        check_fail "MongoDB Docker container is not running"
    fi
    
    if docker ps | grep -q redis; then
        check_pass "Redis Docker container is running"
    else
        check_fail "Redis Docker container is not running"
    fi
else
    check_warn "Docker is not installed or not in PATH"
fi

echo ""
# 4. Check Node.js Dependencies
echo "4️⃣  Checking Node.js Dependencies..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -d "server/node_modules" ]; then
    check_pass "server/node_modules exists"
else
    check_warn "server/node_modules not found - run 'cd server && npm install'"
fi

if [ -d "client/node_modules" ]; then
    check_pass "client/node_modules exists"
else
    check_warn "client/node_modules not found - run 'cd client && npm install'"
fi

echo ""
# 5. Check Python Dependencies
echo "5️⃣  Checking Python Dependencies..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v python3 &> /dev/null; then
    check_pass "Python 3 is installed"
    
    if [ -d "ai-service/venv" ]; then
        check_pass "ai-service/venv exists"
    else
        check_warn "ai-service/venv not found - run setup"
    fi
    
    # Check key packages
    if python3 -c "import fastapi" 2>/dev/null; then
        check_pass "fastapi is installed"
    else
        check_warn "fastapi is not installed - install with: pip install -r requirements.txt"
    fi
else
    check_fail "Python 3 is not installed"
fi

echo ""
# 6. Health Check Endpoints
echo "6️⃣  Checking Service Health..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

check_health() {
    local port=$1
    local name=$2
    if curl -s http://localhost:$port/health > /dev/null 2>&1; then
        check_pass "$name health check passed"
    else
        check_warn "$name health check failed (service may not be running)"
    fi
}

check_health 5000 "Server (Node.js)"
check_health 8000 "AI Service (Python)"

echo ""
# 7. Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Results Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}Passed:${NC} $PASSED"
echo -e "${RED}Failed:${NC} $FAILED"

if [ $FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ All checks passed! Your setup is ready.${NC}"
    exit 0
else
    echo ""
    echo -e "${YELLOW}⚠ Some checks failed. Please review the issues above.${NC}"
    exit 1
fi
