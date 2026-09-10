"""One-time migration: ChromaDB → Pinecone."""
import os, sys, time
sys.path.insert(0, ".")
from dotenv import load_dotenv
load_dotenv(dotenv_path=".env")

import chromadb
from pinecone import Pinecone

PINECONE_API_KEY = os.environ["PINECONE_API_KEY"]
PINECONE_HOST = os.environ["PINECONE_HOST"]
BATCH_SIZE = 100

print("Connecting to ChromaDB...")
client = chromadb.PersistentClient(path="chroma_db")
collection = client.get_collection("legislation")
total = collection.count()
print(f"ChromaDB: {total} chunks")

print("Connecting to Pinecone...")
pc = Pinecone(api_key=PINECONE_API_KEY)
index = pc.Index(host=PINECONE_HOST)
print(f"Pinecone index ready")

offset = 0
uploaded = 0

while offset < total:
    result = collection.get(
        limit=BATCH_SIZE,
        offset=offset,
        include=["embeddings", "documents", "metadatas"],
    )
    ids = result["ids"]
    if not ids:
        break

    vectors = []
    for i, vid in enumerate(ids):
        emb = result["embeddings"][i]
        meta = result["metadatas"][i] or {}
        doc = result["documents"][i] or ""
        vectors.append({
            "id": vid,
            "values": emb,
            "metadata": {
                "text": doc[:1000],
                "measure_id": meta.get("measure_id", ""),
                "category": meta.get("category", "other"),
                "state": meta.get("state", "US"),
                "jurisdiction": meta.get("jurisdiction", "federal"),
                "source_url": meta.get("source_url", ""),
            },
        })

    index.upsert(vectors=vectors)
    uploaded += len(vectors)
    offset += BATCH_SIZE
    print(f"Uploaded {uploaded}/{total}", flush=True)
    time.sleep(0.1)

print(f"\nDone! {uploaded} vectors uploaded to Pinecone.")
