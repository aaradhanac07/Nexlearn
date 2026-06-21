"""
NexLearn Phase 3 — Automated Endpoint Test Script
Runs against the live AI service (port 8000) and Node server (port 5000).

Usage (from repo root):
  python test_phase3.py

Requirements: both servers must be running.
"""
import json, sys, time
import urllib.request
import urllib.error

AI_URL   = "http://localhost:8000"
NODE_URL = "http://localhost:5000"

PASS = "\033[92m✓\033[0m"
FAIL = "\033[91m✗\033[0m"
SKIP = "\033[93m~\033[0m"

results = []

def request(method, url, body=None, headers=None):
    data = json.dumps(body).encode() if body else None
    h = {"Content-Type": "application/json", **(headers or {})}
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return e.code, {}
    except Exception as ex:
        return 0, {"error": str(ex)}

def test(name, ok, detail=""):
    icon = PASS if ok else FAIL
    print(f"  {icon}  {name}", f"({detail})" if detail else "")
    results.append((name, ok))

# ─────────────────────────────────────────
print("\n🔍  NexLearn Phase 3 — Test Suite")
print("=" * 50)

# ── 1. Health checks ─────────────────────
print("\n[1] Health checks")

s, d = request("GET", f"{AI_URL}/health")
test("AI service health", s == 200, f"status={s}")

s, d = request("GET", f"{NODE_URL}/health")
test("Node server health", s == 200, f"status={s}")

# ── 2. SM-2 algorithm ────────────────────
print("\n[2] SM-2 Algorithm  (POST /cards/review)")

cases = [
    ("Again (rating=0)", 0, lambda d: d.get("interval", 99) <= 1 and d.get("repetitions", 99) == 0),
    ("Hard  (rating=1)", 1, lambda d: d.get("easeFactor", 99) < 2.5),
    ("Good  (rating=2)", 2, lambda d: d.get("repetitions", 0) >= 1),
    ("Easy  (rating=3)", 3, lambda d: d.get("interval", 0) >= 4),
]
for label, rating, check in cases:
    s, d = request("POST", f"{AI_URL}/cards/review", {
        "easeFactor": 2.5, "interval": 1, "repetitions": 0, "rating": rating
    })
    ok = s == 200 and check(d)
    test(label, ok, f"interval={d.get('interval')} ef={d.get('easeFactor')}")

# ── 3. Quiz generation ───────────────────
print("\n[3] Quiz Generation  (POST /quiz/generate)")

DUMMY_COURSE_ID = "000000000000000000000000"   # doesn't exist in Pinecone — uses fallback context
s, d = request("POST", f"{AI_URL}/quiz/generate", {
    "courseId": DUMMY_COURSE_ID,
    "userId":   "test_user",
    "topic":    "machine learning",
    "count":    3,
    "difficulty": "mixed"
})
test("Quiz endpoint returns 200",   s == 200, f"status={s}")
test("Questions array present",     isinstance(d.get("questions"), list), f"keys={list(d.keys())}")
test("At least 1 question returned", len(d.get("questions", [])) >= 1, f"count={len(d.get('questions', []))}")

if d.get("questions"):
    q = d["questions"][0]
    test("Question has 'type' field",        "type" in q)
    test("Question has 'question' field",    "question" in q)
    test("Question has 'conceptTag' field",  "conceptTag" in q)
    test("Question has 'difficulty' field",  "difficulty" in q)
    test("Question has 'difficultyScore'",   "difficultyScore" in q)

    mc_qs = [x for x in d["questions"] if x.get("type") == "multiple_choice"]
    if mc_qs:
        test("MCQ has 'options' array",      isinstance(mc_qs[0].get("options"), list))
        test("MCQ has 'correctAnswer'",      "correctAnswer" in mc_qs[0])

# ── 4. Short-answer scoring ──────────────
print("\n[4] Short-answer scoring  (POST /quiz/score-short-answer)")

s, d = request("POST", f"{AI_URL}/quiz/score-short-answer", {
    "userAnswer":  "neural networks learn from data using backpropagation",
    "modelAnswer": "Neural networks use backpropagation to learn from training data",
    "keywords":    ["neural", "backpropagation", "learn"]
})
test("Score endpoint returns 200",  s == 200, f"status={s}")
test("Score is a float 0-1",        0.0 <= d.get("score", -1) <= 1.0, f"score={d.get('score')}")
test("Score > 0 for matching answer", d.get("score", 0) > 0)

# ── 5. Knowledge Graph ───────────────────
print("\n[5] Knowledge Graph  (POST /cards/knowledge-graph)")

sample_text = """
Machine Learning is a subset of Artificial Intelligence.
Neural Networks are inspired by the human brain.
Deep Learning uses multiple layers in neural networks.
Supervised Learning trains on labeled data.
Unsupervised Learning finds patterns without labels.
Backpropagation is the algorithm used to train neural networks.
Gradient Descent optimizes model parameters.
Overfitting occurs when a model memorizes training data.
Regularization techniques like dropout help prevent overfitting.
"""

s, d = request("POST", f"{AI_URL}/cards/knowledge-graph", {
    "courseId": DUMMY_COURSE_ID,
    "fullText": sample_text
})
test("Knowledge graph endpoint 200", s == 200, f"status={s}")
test("Nodes array present",          isinstance(d.get("nodes"), list))
test("Edges array present",          isinstance(d.get("edges"), list))
test("At least 3 nodes returned",    len(d.get("nodes", [])) >= 3, f"count={len(d.get('nodes', []))}")

if d.get("nodes"):
    n = d["nodes"][0]
    test("Node has 'id' field",          "id" in n)
    test("Node has 'label' field",       "label" in n)
    test("Node has 'conceptTag' field",  "conceptTag" in n)

if d.get("edges"):
    e = d["edges"][0]
    test("Edge has 'source' field",  "source" in e)
    test("Edge has 'target' field",  "target" in e)
    test("Edge has 'relation' field","relation" in e)

    # Validate edges reference real nodes
    node_ids = {n["id"] for n in d["nodes"]}
    bad_edges = [e for e in d["edges"] if e["source"] not in node_ids or e["target"] not in node_ids]
    test("All edges reference valid nodes", len(bad_edges) == 0, f"{len(bad_edges)} invalid")

# ── 6. Node server routes (unauthenticated) ──
print("\n[6] Node server route availability (auth will 401 — that's correct)")

routes = [
    ("GET",  "/api/cards",                    401),
    ("GET",  "/api/cards/due-count",          401),
    ("GET",  "/api/quiz/progress",            401),
    ("GET",  "/api/quiz/time-to-mastery",     401),
    ("POST", "/api/quiz/generate",            401),
    ("POST", "/api/quiz/submit",              401),
]
for method, path, expected_status in routes:
    s, _ = request(method, f"{NODE_URL}{path}")
    test(f"{method} {path}  → {expected_status}", s == expected_status, f"got {s}")

# ── Summary ──────────────────────────────
print("\n" + "=" * 50)
passed = sum(1 for _, ok in results if ok)
total  = len(results)
pct    = round(passed / total * 100)

if passed == total:
    print(f"\n🏆  All {total} tests passed!\n")
elif pct >= 70:
    print(f"\n👍  {passed}/{total} tests passed ({pct}%) — a few things to check above\n")
else:
    print(f"\n⚠️   {passed}/{total} tests passed ({pct}%) — servers may not be running\n")
