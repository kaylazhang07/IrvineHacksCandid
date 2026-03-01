import os
import chromadb
from .embed import embed_text

_client = None
_collection = None


def get_collection():
    global _client, _collection
    if _collection is None:
        _client = chromadb.PersistentClient(
            path=os.path.join(os.path.dirname(__file__), "..", "chroma_db")
        )
        _collection = _client.get_or_create_collection(
            name="candid-legislation",
            metadata={"hnsw:space": "cosine"},
        )
    return _collection


def retrieve_chunks(
    measure_text: str,
    jurisdiction: str,
    state: str,
    top_k: int = 8,
) -> list[dict]:
    collection = get_collection()
    query_embedding = embed_text(measure_text)

    results = None
    if state and jurisdiction:
        where_filter = {
            "$and": [
                {"state": {"$in": [state, "US"]}},
                {"jurisdiction": {"$in": [jurisdiction, "state", "federal"]}},
            ]
        }
        try:
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=top_k,
                where=where_filter,
                include=["metadatas", "distances", "documents"],
            )
        except Exception:
            pass

    if not results or not results["ids"] or not results["ids"][0]:
        results = collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            include=["metadatas", "distances", "documents"],
        )

    chunks = []
    if results and results["ids"] and results["ids"][0]:
        for i, chunk_id in enumerate(results["ids"][0]):
            meta = results["metadatas"][0][i] if results["metadatas"] else {}
            distance = results["distances"][0][i] if results["distances"] else 1.0
            score = 1.0 - distance

            chunks.append({
                "chunk_id": chunk_id,
                "chunk_text": meta.get("chunk_text", results["documents"][0][i] if results["documents"] else ""),
                "source_url": meta.get("source_url", ""),
                "score": max(score, 0.0),
                "category": meta.get("category", "other"),
                "state": meta.get("state", ""),
                "measure_id": meta.get("measure_id", ""),
                "jurisdiction": meta.get("jurisdiction", ""),
            })

    return chunks
