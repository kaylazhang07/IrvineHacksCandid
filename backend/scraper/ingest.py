"""Bulk chunking pipeline: scrape -> chunk -> embed -> store in ChromaDB.

Target: 30,000+ chunks across federal + all 50 states.
Designed to avoid memory crashes by processing in small batches.
"""

import re
import sys
import os
import gc
import time
from bs4 import BeautifulSoup

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from rag.embed import embed_batch
from rag.retrieve import get_collection
from scraper.congress import fetch_bills_paginated, fetch_bill_text
from scraper.openstates import fetch_all_states


def strip_html(text: str) -> str:
    soup = BeautifulSoup(text, "html.parser")
    clean = soup.get_text(separator="\n")
    clean = re.sub(r'\n{3,}', '\n\n', clean)
    return clean.strip()


def chunk_text(text: str, max_tokens: int = 800, overlap: int = 100) -> list[str]:
    section_pattern = r"(?=\n(?:SECTION|SEC\.|TITLE|ARTICLE|CHAPTER|\d+\.\s))"
    sections = re.split(section_pattern, text)
    sections = [s.strip() for s in sections if s.strip()]

    chunks = []
    for section in sections:
        words = section.split()
        if len(words) < 20:
            continue
        if len(words) <= max_tokens:
            chunks.append(section)
        else:
            for i in range(0, len(words), max_tokens - overlap):
                chunk_words = words[i : i + max_tokens]
                if len(chunk_words) >= 20:
                    chunks.append(" ".join(chunk_words))
    return chunks


def ingest_bills_streaming(bills: list[dict], flush_every: int = 25):
    """Embed and store bills, flushing to ChromaDB every flush_every chunks."""
    collection = get_collection()
    total = 0
    buf_ids, buf_embs, buf_docs, buf_metas = [], [], [], []

    for bill in bills:
        text = bill.get("text", "")
        if not text or len(text) < 100:
            continue
        text = strip_html(text)
        if len(text) < 100:
            continue

        raw_chunks = chunk_text(text)
        if not raw_chunks:
            continue

        # Embed in micro-batches of 8
        for micro_start in range(0, len(raw_chunks), 8):
            micro = raw_chunks[micro_start:micro_start + 8]
            prefixed = [f"[{bill['measure_id']}] [{bill['category']}]: {c[:1000]}" for c in micro]
            embs = embed_batch(prefixed)

            for i, (chunk, emb) in enumerate(zip(micro, embs)):
                idx = micro_start + i
                buf_ids.append(f"{bill['measure_id']}_c{idx}")
                buf_embs.append(emb)
                buf_docs.append(chunk[:1500])
                buf_metas.append({
                    "chunk_text": chunk[:1500],
                    "source_url": bill.get("source_url", ""),
                    "measure_id": bill["measure_id"],
                    "category": bill.get("category", "other"),
                    "jurisdiction": bill.get("jurisdiction", "federal"),
                    "state": bill.get("state", "US"),
                })

            # Flush when buffer is big enough
            if len(buf_ids) >= flush_every:
                collection.upsert(ids=buf_ids, embeddings=buf_embs, documents=buf_docs, metadatas=buf_metas)
                total += len(buf_ids)
                buf_ids, buf_embs, buf_docs, buf_metas = [], [], [], []
                gc.collect()

    # Flush remaining
    if buf_ids:
        collection.upsert(ids=buf_ids, embeddings=buf_embs, documents=buf_docs, metadatas=buf_metas)
        total += len(buf_ids)

    gc.collect()
    return total


def ingest_federal(congresses=None, bill_types=None, max_pages=10):
    if congresses is None:
        congresses = [113, 114, 115, 116, 117, 118]
    if bill_types is None:
        bill_types = ["hr", "s"]

    total = 0
    for congress in congresses:
        for bt in bill_types:
            print(f"  [{bt.upper()} Congress {congress}] Fetching listings...")
            bills_meta = fetch_bills_paginated(congress, bt, max_pages=max_pages)
            print(f"    {len(bills_meta)} listings found")

            # Fetch text and ingest in small groups to limit memory
            group = []
            for i, bill in enumerate(bills_meta):
                text = fetch_bill_text(congress, bill["bill_type"], bill["bill_number"])
                if text and len(text) > 200:
                    bill["text"] = text
                    group.append(bill)

                # Ingest every 20 bills to keep memory low
                if len(group) >= 20:
                    chunks = ingest_bills_streaming(group)
                    total += chunks
                    count = get_collection().count()
                    print(f"    Ingested {i+1}/{len(bills_meta)} bills | +{chunks} chunks | DB total: {count}")
                    group = []
                    gc.collect()

                time.sleep(0.15)

            # Remaining
            if group:
                chunks = ingest_bills_streaming(group)
                total += chunks
                group = []
                gc.collect()

            count = get_collection().count()
            print(f"  [{bt.upper()} Congress {congress}] Done — DB total: {count}")

    return total


def ingest_states(per_state=100, max_pages=5):
    print("  Fetching bills from all 50 states...")
    all_bills = fetch_all_states(per_state=per_state, max_pages=max_pages)
    print(f"  {len(all_bills)} state bills fetched")

    # Ingest in groups of 20
    total = 0
    for i in range(0, len(all_bills), 20):
        group = all_bills[i:i+20]
        chunks = ingest_bills_streaming(group)
        total += chunks
        if (i + 20) % 100 == 0:
            count = get_collection().count()
            print(f"    State bills {i+20}/{len(all_bills)} | DB total: {count}")
        gc.collect()

    return total


def main():
    collection = get_collection()
    print(f"Starting ingestion. Current chunks: {collection.count()}")
    start = time.time()

    print("\n=== Federal Bills ===")
    fed = ingest_federal()
    print(f"Federal total: {fed} chunks")

    print("\n=== State Bills ===")
    state = ingest_states()
    print(f"State total: {state} chunks")

    elapsed = time.time() - start
    print(f"\n=== Done ===")
    print(f"Total chunks in DB: {collection.count()}")
    print(f"Time: {elapsed/60:.1f} minutes")


if __name__ == "__main__":
    main()
