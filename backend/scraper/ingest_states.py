"""All-50-states legislation ingestion into ChromaDB."""

import os, sys, time, gc, requests
from dotenv import load_dotenv
load_dotenv()

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from rag.embed import embed_batch
from rag.retrieve import get_collection
from scraper.openstates import STATE_ABBR, ALL_STATES

BASE_URL = "https://v3.openstates.org"
API_KEY = os.environ.get("OPENSTATES_API_KEY")

CATEGORY_KEYWORDS = {
    "housing": ["housing", "rent", "tenant", "mortgage", "home", "shelter", "affordable", "eviction", "landlord"],
    "education": ["education", "school", "student", "university", "college", "teacher", "literacy", "tuition"],
    "transportation": ["transport", "transit", "highway", "road", "rail", "bridge", "traffic", "airport", "bike"],
    "public_safety": ["police", "safety", "crime", "fire", "emergency", "gun", "violence", "security", "prison"],
    "environment": ["environment", "climate", "energy", "water", "pollution", "emission", "conservation", "solar", "wildlife"],
    "healthcare": ["health", "medical", "hospital", "mental", "drug", "pharmacy", "insurance", "medicaid", "medicare"],
    "economy": ["tax", "business", "wage", "worker", "employ", "labor", "budget", "economic", "small business"],
}


def classify(title):
    t = title.lower()
    for cat, words in CATEGORY_KEYWORDS.items():
        if any(w in t for w in words):
            return cat
    return "other"


def api_get(params, max_retries=8):
    for attempt in range(max_retries):
        try:
            resp = requests.get(
                f"{BASE_URL}/bills",
                headers={"X-API-KEY": API_KEY} if API_KEY else {},
                params=params,
                timeout=30,
            )
            if resp.status_code == 200:
                return resp.json()
            wait = min(2 ** (attempt + 1), 60)
            print(f"  [HTTP {resp.status_code}] wait {wait}s ({attempt+1})...", flush=True)
            time.sleep(wait)
        except Exception as e:
            wait = min(2 ** (attempt + 1), 60)
            print(f"  [{e}] wait {wait}s ({attempt+1})...", flush=True)
            time.sleep(wait)
    return None


def fetch_bills(state, per_page=20, max_pages=5):
    abbr = STATE_ABBR.get(state, state[:2].upper())
    bills = []
    seen_ids = set()
    nl = chr(10)
    for page in range(1, max_pages + 1):
        data = api_get({
            "jurisdiction": state,
            "sort": "updated_desc",
            "per_page": per_page,
            "page": page,
            "include": "abstracts",
        })
        if not data:
            break
        results = data.get("results", [])
        if not results:
            break
        for b in results:
            title = b.get("title", "")
            identifier = b.get("identifier", "UNK")
            measure_id = abbr + "-" + identifier
            if measure_id in seen_ids:
                continue
            seen_ids.add(measure_id)
            abstracts = b.get("abstracts", [])
            abstract = abstracts[0].get("abstract", "") if abstracts else ""
            if abstract:
                text = title + nl + nl + abstract
            else:
                text = title
            if len(text.strip()) < 20:
                continue
            bills.append({
                "measure_id": measure_id,
                "title": title,
                "text": text,
                "source_url": b.get("openstates_url", ""),
                "state": abbr,
                "category": classify(title),
            })
        if len(results) < per_page:
            break
        time.sleep(3)
    return bills


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--start", type=int, default=0)
    args = parser.parse_args()

    collection = get_collection()
    before = collection.count()
    start = args.start
    remaining = ALL_STATES[start:]

    print(f"STATE INGESTION from #{start+1}: {remaining[0]}")
    print(f"ChromaDB before: {before:,} chunks")
    print()

    total_bills = 0
    total_chunks = 0
    stats = {}

    for i, state in enumerate(remaining):
        idx = start + i + 1
        abbr = STATE_ABBR.get(state, "??")
        print(f"[{idx:>2}/50] {state} ({abbr})...", end=" ", flush=True)
        try:
            bills = fetch_bills(state, per_page=20, max_pages=5)
        except Exception as e:
            print(f"FETCH ERROR: {e}")
            stats[abbr] = 0
            time.sleep(15)
            continue
        if not bills:
            print("0 bills")
            stats[abbr] = 0
            time.sleep(15)
            continue

        ids, texts, metas = [], [], []
        for bill in bills:
            cid = bill["measure_id"] + "_c0"
            ids.append(cid)
            texts.append(bill["text"])
            metas.append({
                "measure_id": bill["measure_id"],
                "state": bill["state"],
                "jurisdiction": "state",
                "category": bill["category"],
                "chunk_text": bill["text"][:1500],
                "source_url": bill["source_url"],
            })

        all_embs = []
        for j in range(0, len(texts), 64):
            all_embs.extend(embed_batch(texts[j:j + 64]))

        try:
            for j in range(0, len(ids), 100):
                e = j + 100
                collection.upsert(
                    ids=ids[j:e],
                    embeddings=all_embs[j:e],
                    metadatas=metas[j:e],
                    documents=texts[j:e],
                )
        except Exception as e:
            print(f"UPSERT ERROR: {e}")
            stats[abbr] = 0
            time.sleep(15)
            continue

        added = len(ids)
        total_bills += len(bills)
        total_chunks += added
        stats[abbr] = added
        print(f"{len(bills)} bills -> {added} chunks")
        time.sleep(10)

        if idx % 10 == 0:
            gc.collect()
            print(f"  --- checkpoint: {total_chunks:,} new ---")

    after = collection.count()
    covered = sum(1 for v in stats.values() if v > 0)
    print()
    print(f"DONE! Bills: {total_bills:,} | Chunks: {total_chunks:,}")
    print(f"Before: {before:,} | After: {after:,} | States: {covered}/{len(remaining)}")
    for abbr in sorted(stats.keys()):
        print(f"  {abbr}: {stats[abbr]}")


if __name__ == "__main__":
    main()
