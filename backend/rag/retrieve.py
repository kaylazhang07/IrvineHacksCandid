import os
from dotenv import load_dotenv
from pinecone import Pinecone
from sentence_transformers import SentenceTransformer

load_dotenv()

_index = None
_model = None


def _get_index():
    global _index
    if _index is None:
        pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))
        _index = pc.Index(host=os.getenv("PINECONE_HOST"))
    return _index


def _get_model():
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def get_collection():
    return _get_index()


def retrieve_chunks(query: str, state: str, jurisdiction: str = "state",
                    top_k: int = 8, measure_id: str = "") -> list:
    try:
        index = _get_index()
        model = _get_model()
        embedding = model.encode(query).tolist()

        filter_dict = {"state": {"$in": [state, "US"]}} if state else None
        res = index.query(
            vector=embedding,
            top_k=top_k,
            include_metadata=True,
            filter=filter_dict,
        )

        chunks = []
        for match in res.matches:
            meta = match.metadata or {}
            chunks.append({
                "chunk_id": match.id,
                "chunk_text": meta.get("text", ""),
                "source_url": meta.get("source_url", ""),
                "state": meta.get("state", ""),
                "category": meta.get("category", ""),
                "measure_id": meta.get("measure_id", ""),
                "score": match.score,
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
