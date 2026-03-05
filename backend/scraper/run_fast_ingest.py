"""Fast parallel bill ingestion — 5 workers + batch embedding."""
import sys, os, time
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv
load_dotenv()

from scraper.congress import fetch_bills_paginated, fetch_bill_text
from rag.retrieve import get_collection
from sentence_transformers import SentenceTransformer

CHUNK_SIZE = 800
CHUNK_OVERLAP = 100
WORKERS = 5
BATCH = 500

def chunk_text(text):
    words = text.split()
    chunks, step = [], CHUNK_SIZE - CHUNK_OVERLAP
    for i in range(0, len(words), step):
        c = " ".join(words[i:i + CHUNK_SIZE])
        if len(c.strip()) > 50:
            chunks.append(c)
    return chunks

def fetch_one(bill):
    try:
        text = fetch_bill_text(bill["congress"], bill["bill_type"], bill["bill_number"])
        if text and len(text) > 200:
            bill["text"] = text
            return bill
    except:
        pass
    return None

print("Loading model...", flush=True)
model = SentenceTransformer("all-MiniLM-L6-v2")
collection = get_collection()

print("Scanning existing data...", flush=True)
existing_measures = set()
existing_cids = set()
if collection.count() > 0:
    data = collection.get(include=["metadatas"])
    existing_cids = set(data.get("ids", []))
    for m in data.get("metadatas", []):
        if m and "measure_id" in m:
            existing_measures.add(m["measure_id"])

print(f"DB: {collection.count()} chunks | {len(existing_measures)} bills already done", flush=True)

start = time.time()
CONGRESSES = [111, 112, 113, 114, 115, 116, 117, 118, 119]
BILL_TYPES = ["hr", "s", "hjres", "sjres", "hconres", "sconres", "hres", "sres"]

for congress in CONGRESSES:
    for bt in BILL_TYPES:
        tag = f"{bt.upper()} {congress}"
        print(f"\n[{tag}] Fetching listings...", flush=True)
        listings = fetch_bills_paginated(congress, bt, max_pages=40, per_page=250)
        new = [b for b in listings if b["measure_id"] not in existing_measures]
        print(f"  {len(listings)} total, {len(new)} new", flush=True)
        if not new:
            continue

        # Parallel text fetch
        with_text = []
        with ThreadPoolExecutor(max_workers=WORKERS) as pool:
            futs = {pool.submit(fetch_one, b): b for b in new}
            done = 0
            for f in as_completed(futs):
                done += 1
                r = f.result()
                if r:
                    with_text.append(r)
                if done % 100 == 0:
                    print(f"    Fetched: {done}/{len(new)} ({len(with_text)} got text)", flush=True)
        
        print(f"  {len(with_text)} bills with text. Embedding...", flush=True)

        buf_ids, buf_docs, buf_metas = [], [], []
        for bill in with_text:
            for j, chunk in enumerate(chunk_text(bill["text"])):
                cid = f"{bill['measure_id']}-chunk-{j}"
                if cid in existing_cids:
                    continue
                buf_ids.append(cid)
                buf_docs.append(chunk)
                buf_metas.append({
                    "chunk_text": chunk[:500],
                    "source_url": bill.get("source_url", ""),
                    "measure_id": bill["measure_id"],
                    "category": bill.get("category", "other"),
                    "jurisdiction": "federal",
                    "state": "US",
                })
                if len(buf_ids) >= BATCH:
                    embs = model.encode(buf_docs).tolist()
                    collection.add(ids=buf_ids, documents=buf_docs, embeddings=embs, metadatas=buf_metas)
                    existing_cids.update(buf_ids)
                    print(f"    +{BATCH} | DB: {collection.count()}", flush=True)
                    buf_ids, buf_docs, buf_metas = [], [], []

        if buf_ids:
            embs = model.encode(buf_docs).tolist()
            collection.add(ids=buf_ids, documents=buf_docs, embeddings=embs, metadatas=buf_metas)
            existing_cids.update(buf_ids)
            print(f"    +{len(buf_ids)} | DB: {collection.count()}", flush=True)

        for b in with_text:
            existing_measures.add(b["measure_id"])
        print(f"  [{tag}] Done | DB: {collection.count()}", flush=True)

print(f"\nFederal: {(time.time()-start)/60:.1f} min | DB: {collection.count()}", flush=True)

print("\n=== State Bills ===", flush=True)
from scraper.ingest_states import main as ingest_states_main
sys.argv = ["ingest_states"]
ingest_states_main()

print(f"\n=== ALL DONE ===", flush=True)
print(f"Chunks: {collection.count()}", flush=True)
print(f"Time: {(time.time()-start)/60:.1f} min", flush=True)
