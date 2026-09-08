import os
import chromadb
from sentence_transformers import SentenceTransformer

_client = None
_collection = None
_model = None


def _get_client():
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(path=os.path.join(os.path.dirname(__file__), "../chroma_db"))
    return _client


def _get_model():
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def get_collection():
    global _collection
    if _collection is None:
        client = _get_client()
        _collection = client.get_or_create_collection("legislation")
    return _collection


def retrieve_chunks(query: str, state: str, jurisdiction: str = "state",
                    top_k: int = 8, measure_id: str = "") -> list:
    try:
        collection = get_collection()
        model = _get_model()
        embedding = model.encode(query).tolist()

        where = {"state": state} if state else None
        results = collection.query(
            query_embeddings=[embedding],
            n_results=top_k,
            where=where,
            include=["documents", "metadatas", "distances"],
        )

        chunks = []
        for i, doc in enumerate(results["documents"][0]):
            meta = results["metadatas"][0][i] or {}
            chunks.append({
                "chunk_id": results["ids"][0][i],
                "chunk_text": doc,
                "source_url": meta.get("source_url", ""),
                "state": meta.get("state", ""),
                "category": meta.get("category", ""),
                "measure_id": meta.get("measure_id", ""),
                "score": 1 - results["distances"][0][i],
            })

        return filter_federal(chunks, measure_id)
    except Exception as e:
        print(f"retrieve error: {e}")
        return []


def filter_federal(chunks: list, measure_id: str) -> list:
    if not measure_id or measure_id.upper().startswith("HR-") or measure_id.upper().startswith("S-"):
        return chunks
    state_only = [c for c in chunks if "congress.gov" not in c.get("source_url", "")]
    return state_only if len(state_only) >= 1 else chunks
