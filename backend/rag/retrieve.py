import chromadb

_client = None
_collection = None

def _get_collection():
    global _client, _collection
    if _collection is None:
        _client = chromadb.PersistentClient(path="chroma_db")
        _collection = _client.get_or_create_collection("candid-legislation")
    return _collection

def get_collection():
    return _get_collection()

def retrieve_chunks(query: str, state: str, jurisdiction: str = "state", top_k: int = 8, measure_id: str = "") -> list:
    col = _get_collection()
    try:
        res = col.query(query_texts=[query], n_results=top_k)
        chunks = _parse(res)
        return filter_federal(chunks, measure_id)
    except Exception as e:
        print(f"retrieve error: {e}")
        return []

def filter_federal(chunks: list, measure_id: str) -> list:
    if not measure_id or measure_id.upper().startswith("HR-") or measure_id.upper().startswith("S-"):
        return chunks
    state_only = [c for c in chunks if "congress.gov" not in c.get("source_url", "")]
    return state_only if len(state_only) >= 1 else chunks

def _parse(res) -> list:
    chunks = []
    if not res or not res.get("ids"):
        return chunks
    for i, doc_id in enumerate(res["ids"][0]):
        meta = res["metadatas"][0][i] if res.get("metadatas") else {}
        score = res["distances"][0][i] if res.get("distances") else 0.5
        chunks.append({
            "chunk_id": doc_id,
            "chunk_text": res["documents"][0][i] if res.get("documents") else "",
            "source_url": meta.get("source_url", ""),
            "state": meta.get("state", ""),
            "category": meta.get("category", ""),
            "measure_id": meta.get("measure_id", ""),
            "score": 1 - score,
        })
    return chunks
