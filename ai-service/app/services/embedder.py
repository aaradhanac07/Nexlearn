from sentence_transformers import SentenceTransformer
from pinecone import Pinecone
from app.core.config import settings

embed_model = SentenceTransformer('all-MiniLM-L6-v2')

pc = Pinecone(api_key=settings.pinecone_api_key)
index = pc.Index(settings.pinecone_index)


def get_embedding(text: str) -> list:
    return embed_model.encode(text).tolist()   # ← .tolist() not convert_to_list


def embed_and_store(chunks: list, course_id: str, user_id: str):
    if not chunks:
        return
    # Batch-encode all chunks with a smaller batch size to prevent OOM
    embeddings = embed_model.encode(chunks, batch_size=8, show_progress_bar=False).tolist()
    vectors = [
        {
            "id": f"{course_id}_{i}",
            "values": embeddings[i],
            "metadata": {
                "text": chunk,
                "courseId": course_id,
                "userId": user_id,
                "chunkIndex": i,
                "sourceType": "pdf",
            },
        }
        for i, chunk in enumerate(chunks)
    ]
    for i in range(0, len(vectors), 100):
        index.upsert(vectors=vectors[i:i+100], namespace=course_id)


def embed_and_store_with_meta(chunks_with_meta: list, course_id: str, user_id: str):
    """
    Like embed_and_store but accepts rich chunk dicts:
      {text, sourceType, videoId?, startTimestamp?, endTimestamp?, sourceName?}
    All extra keys are stored as Pinecone metadata for later retrieval.
    """
    if not chunks_with_meta:
        return
    EXTRA_KEYS = ("sourceType", "videoId", "startTimestamp", "endTimestamp", "sourceName")
    texts    = [c["text"] for c in chunks_with_meta]
    # Batch-encode all texts with a smaller batch size to prevent OOM
    embeddings = embed_model.encode(texts, batch_size=8, show_progress_bar=False).tolist()

    vectors = []
    for i, chunk_data in enumerate(chunks_with_meta):
        src_type = chunk_data.get("sourceType", "unknown")
        meta = {
            "text":       chunk_data["text"],
            "courseId":   course_id,
            "userId":     user_id,
            "chunkIndex": i,
        }
        for key in EXTRA_KEYS:
            if key in chunk_data:
                meta[key] = chunk_data[key]
        vectors.append({
            "id":       f"{course_id}_{src_type}_{i}",
            "values":   embeddings[i],
            "metadata": meta,
        })

    for i in range(0, len(vectors), 100):
        index.upsert(vectors=vectors[i:i+100], namespace=course_id)


def delete_course_vectors(course_id: str):
    index.delete(delete_all=True, namespace=course_id)