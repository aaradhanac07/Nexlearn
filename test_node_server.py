"""
Phase 3 - Node Server Tests
Checks that all routes exist and return the right HTTP codes.
No auth token needed — we just verify routes are registered (401 = route exists, 404 = missing).
"""
import json
import urllib.request
import urllib.error
import sys

NODE = "http://localhost:5000"
PASS = "[PASS]"
FAIL = "[FAIL]"

results = []

def req(method, url, body=None, timeout=8):
    data = json.dumps(body).encode() if body else None
    headers = {"Content-Type": "application/json"} if body else {}
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(r, timeout=timeout)
        return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, {}
    except Exception as ex:
        return 0, {"error": str(ex)}

def check(label, ok, detail=""):
    icon = PASS if ok else FAIL
    msg = label + ("  (" + detail + ")" if detail else "")
    print("  " + icon + " " + msg)
    results.append((label, ok))

print()
print("=" * 55)
print("  NexLearn Phase 3 -- Node Server Tests")
print("=" * 55)

# Health
print()
print("[1] Server health")
s, d = req("GET", NODE + "/health")
up = s == 200
check("/health endpoint", up, "status=" + str(s) + (" -> " + str(d.get("status","")) if up else " (server down?)"))

if not up:
    print()
    print("  Node server is not responding.")
    print("  Make sure Docker Desktop is running (for MongoDB),")
    print("  then run: npm run dev  (in the /server directory)")
    print()
    sys.exit(1)

# Card routes (expect 401 Unauthorized - means route exists, auth is working)
print()
print("[2] Card routes (expect 401 - route exists, auth required)")
card_routes = [
    ("GET",  "/api/cards",              "List due cards"),
    ("GET",  "/api/cards/due-count",    "Count due cards"),
    ("POST", "/api/cards/test123/review", "SM-2 review"),
]
for method, path, label in card_routes:
    s, _ = req(method, NODE + path, body={"rating": 2} if method == "POST" else None)
    check(method + " " + path + "  -- " + label, s == 401, "got " + str(s))

# Quiz routes
print()
print("[3] Quiz routes (expect 401)")
quiz_routes = [
    ("POST", "/api/quiz/generate",                  "Generate quiz"),
    ("POST", "/api/quiz/submit",                    "Submit answers"),
    ("GET",  "/api/quiz/progress",                  "Get progress"),
    ("GET",  "/api/quiz/time-to-mastery",           "Time to mastery"),
    ("GET",  "/api/quiz/knowledge-graph/test123",   "Get knowledge graph"),
    ("POST", "/api/quiz/knowledge-graph/test123",   "Generate knowledge graph"),
]
for method, path, label in quiz_routes:
    s, _ = req(method, NODE + path, body={"fullText": "test"} if method == "POST" else None)
    check(method + " " + path + "  -- " + label, s == 401, "got " + str(s))

# Auth routes
print()
print("[4] Auth route")
s, _ = req("POST", NODE + "/api/auth/sync")
check("POST /api/auth/sync -- Clerk sync", s in (401, 400, 200), "got " + str(s))

# Summary
print()
print("=" * 55)
passed = sum(1 for _, ok in results if ok)
total = len(results)
print("  Result: " + str(passed) + "/" + str(total) + " passed")
if passed == total:
    print("  ALL NODE ROUTES CONFIRMED!")
elif passed >= total * 0.7:
    print("  Most routes working - check failures above")
else:
    print("  Issues found - see above")
print("=" * 55)
print()
