"""
Knowledge Graph generation — extracts concept nodes and relationships from
course content using Groq, returns a graph structure for visualization.
"""
import json
import logging
from app.services.groq_client import groq_complete, strip_code_fences, SMART_MODEL

logger = logging.getLogger(__name__)


def extract_knowledge_graph(full_text: str, course_id: str) -> dict:
    """
    Uses Groq to extract concept nodes and 'related-to' edges from course text.
    Returns a graph dict suitable for react-force-graph.
    """
    prompt = f"""You are a knowledge graph builder. Analyze the document and extract:
1. Up to 20 key concept NODES (topics, ideas, terms)
2. Meaningful EDGES between them showing relationships

Return ONLY valid raw JSON (no markdown, no code blocks):
{{
  "nodes": [
    {{"id": "unique_slug", "label": "Human Readable Name", "conceptTag": "category", "description": "one sentence"}}
  ],
  "edges": [
    {{"source": "node_id_1", "target": "node_id_2", "relation": "relates to|depends on|part of|leads to|contrasts with"}}
  ]
}}

Rules:
- Node IDs must be lowercase with underscores, unique
- Every edge source/target must match an existing node id
- Max 20 nodes, max 30 edges
- Be selective — only meaningful relationships

Document (first 4000 chars):
{full_text[:4000]}"""

    raw = groq_complete(prompt, model=SMART_MODEL, temperature=0.2)
    raw = strip_code_fences(raw)

    try:
        data = json.loads(raw.strip())
        nodes = data.get("nodes", [])
        edges = data.get("edges", [])

        # Validate edges reference existing nodes
        node_ids = {n["id"] for n in nodes}
        valid_edges = [
            e for e in edges
            if e.get("source") in node_ids and e.get("target") in node_ids
        ]

        logger.info(f"Knowledge graph: {len(nodes)} nodes, {len(valid_edges)} edges for course {course_id}")
        return {
            "courseId": course_id,
            "nodes": nodes,
            "edges": valid_edges
        }

    except (json.JSONDecodeError, KeyError) as e:
        logger.error(f"Knowledge graph parse error: {e}\nRaw: {raw[:500]}")
        return {"courseId": course_id, "nodes": [], "edges": []}
