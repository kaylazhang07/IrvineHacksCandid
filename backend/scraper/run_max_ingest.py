"""Production ingest - federal gap-fill + smart state."""
import sys, os, time, requests
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from concurrent.futures import ThreadPoolExecutor, as_completed
from dotenv import load_dotenv
load_dotenv()

from scraper.congress import fetch_bills_paginated, fetch_bill_text
from rag.retrieve import get_collection
from sentence_transformers import SentenceTransformer

CHUNK_SIZE = 800
CHUNK_OVERLAP = 100
FED_WORKERS = 5
EMBED_BATCH = 500
STATE_PAGES = 9
STATE_DELAY = 3.0

OPENSTATES_KEY = os.getenv("OPENSTATES_API_KEY", "")

STATES = {
    "AL":"Alabama","AK":"Alaska","AZ":"Arizona","AR":"Arkansas",
    "CA":"California","CO":"Colorado","CT":"Connecticut","DE":"Delaware",
    "FL":"Florida","GA":"Georgia","HI":"Hawaii","ID":"Idaho",
    "IL":"Illinois","IN":"Indiana","IA":"Iowa","KS":"Kansas",
    "KY":"Kentucky","LA":"Louisiana","ME":"Maine","MD":"Maryland",
    "MA":"Massachusetts","MI":"Michigan","MN":"Minnesota","MS":"Mississippi",
    "MO":"Missouri","MT":"Montana","NE":"Nebraska","NV":"Nevada",
    "NH":"New Hampshire","NJ":"New Jersey","NM":"New Mexico","NY":"New York",
    "NC":"North Carolina","ND":"North Dakota","OH":"Ohio","OK":"Oklahoma",
    "OR":"Oregon","PA":"Pennsylvania","RI":"Rhode Island","SC":"South Carolina",
    "SD":"South Dakota","TN":"Tennessee","TX":"Texas","UT":"Utah",
    "VT":"Vermont","VA":"Virginia","WA":"Washington","WV":"West Virginia",
    "WI":"Wisconsin","WY":"Wyoming",
}

def chunk_text(text):
    words = text.split()
    if len(words) < 30:
        return [text] if len(text.strip()) > 50 else []
    chunks, step = [], CHUNK_SIZE - CHUNK_OVERLAP
    for i in range(0, len(words), step):
        c = " ".join(words[i:i + CHUNK_SIZE])
        if len(c.strip()) > 50:
            chunks.append(c)
    return chunks if chunks else ([text] if len(text.strip()) > 50 else [])

def fetch_openstates_page(state_name, page, max_retries=5):
    headers = {"X-API-KEY": OPENSTATES_KEY} if OPENSTATES_KEY else {}
    url = "https://v3.openstates.org/bills"
    params = {
        "jurisdiction": state_name, "sort": "updated_desc",
        "per_page": 20, "page": page, "include": "abstracts,sponsorships",
    }
    for attempt in range(max_retries):
        try:
            r = requests.get(url, headers=headers, params=params, timeout=60)
            if r.status_code == 200:
                return r.json().get("results", [])
            elif r.status_code == 429:
                wait = min(60, 2 ** (attempt + 2))
                print(f"    [429] wait {wait}s...", flush=True)
                time.sleep(wait)
            else:
                print(f"    [HTTP {r.status_code}] retry...", flush=True)
                time.sleep(3)
        except Exception:
            time.sleep(min(30, 2 ** (attempt + 1)))
    return []

def build_state_doc(bill):
    parts = []
    title = bill.get("title", "")
    if title: parts.append(f"Title: {title}")
    ident = bill.get("identifier", "")
    session = bill.get("session", "")
    if ident: parts.append(f"Bill: {ident} | Session: {session}")
    classification = bill.get("classification", [])
    if classification: parts.append(f"Type: {', '.join(classification)}")
    for ab in bill.get("abstracts", []):
        desc = ab.get("abstract", "") or ab.get("description", "")
        if desc: parts.append(f"Summary: {desc}")
    sponsors = bill.get("sponsorships", [])
    if sponsors:
        names = [s.get("name","") for s in sponsors[:10] if s.get("name")]
        if names: parts.append(f"Sponsors: {', '.join(names)}")
    subjects = bill.get("subject", [])
    if subjects: parts.append(f"Subjects: {', '.join(subjects)}")
    return "\n".join(parts)

def fetch_one_federal(bill):
    try:
        text = fetch_bill_text(bill["congress"], bill["bill_type"], bill["bill_number"])
        if text and len(text) > 200:
            bill["text"] = text
            return bill
    except:
        pass
    return None

print("=" * 60, flush=True)
print("PRODUCTION INGEST - FEDERAL FIRST", flush=True)
print("=" * 60, flush=True)

print("\nLoading model...", flush=True)
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

print(f"DB: {collection.count()} chunks | {len(existing_measures)} bills done\n", flush=True)

# ========== PHASE 1: FEDERAL GAP-FILL ==========
print("=" * 60, flush=True)
print("PHASE 1: FEDERAL GAP-FILL (max_pages=100)", flush=True)
print("=" * 60, flush=True)

fed_start = time.time()
CONGRESSES = [111, 112, 113, 114, 115, 116, 117, 118, 119]
BILL_TYPES = ["hr", "s", "hjres", "sjres", "hconres", "sconres", "hres", "sres"]

for congress in CONGRESSES:
    for bt in BILL_TYPES:
        tag = f"{bt.upper()} {congress}"
        print(f"\n[{tag}] Fetching...", flush=True)
        listings = fetch_bills_paginated(congress, bt, max_pages=100, per_page=250)
        new = [b for b in listings if b["measure_id"] not in existing_measures]
        print(f"  {len(listings)} total, {len(new)} new", flush=True)
        if not new:
            continue

        with_text = []
        with ThreadPoolExecutor(max_workers=FED_WORKERS) as pool:
            futs = {pool.submit(fetch_one_federal, b): b for b in new}
            done = 0
            for f in as_completed(futs):
                done += 1
                r = f.result()
                if r: with_text.append(r)
                if done % 100 == 0:
                    print(f"    Fetched: {done}/{len(new)} ({len(with_text)} w/ text)", flush=True)

        if not with_text:
            print(f"  0 with text", flush=True)
            continue

        print(f"  {len(with_text)} with text. Embedding...", flush=True)
        buf_ids, buf_docs, buf_metas = [], [], []
        for bill in with_text:
            for j, chunk in enumerate(chunk_text(bill["text"])):
                cid = f"{bill['measure_id']}-chunk-{j}"
                if cid in existing_cids: continue
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
                if len(buf_ids) >= EMBED_BATCH:
                    embs = model.encode(buf_docs).tolist()
                    collection.add(ids=buf_ids, documents=buf_docs, embeddings=embs, metadatas=buf_metas)
                    existing_cids.update(buf_ids)
                    print(f"    +{EMBED_BATCH} | DB: {collection.count()}", flush=True)
                    buf_ids, buf_docs, buf_metas = [], [], []

        if buf_ids:
            embs = model.encode(buf_docs).tolist()
            collection.add(ids=buf_ids, documents=buf_docs, embeddings=embs, metadatas=buf_metas)
            existing_cids.update(buf_ids)
            print(f"    +{len(buf_ids)} | DB: {collection.count()}", flush=True)

        for b in with_text:
            existing_measures.add(b["measure_id"])
        print(f"  [{tag}] Done | DB: {collection.count()}", flush=True)

print(f"\nPhase 1 done: {(time.time()-fed_start)/60:.1f} min | DB: {collection.count()}", flush=True)

# ========== PHASE 2: STATE BILLS (budget 500 req) ==========
print("\n" + "=" * 60, flush=True)
print("PHASE 2: STATE BILLS (9 pages/state = 450 requests max)", flush=True)
print("=" * 60, flush=True)

state_start = time.time()
total_new_state = 0
req_count = 0

for idx, (abbr, name) in enumerate(sorted(STATES.items()), 1):
    print(f"\n[{idx}/50] {name} ({abbr}) [reqs: {req_count}/450]...", flush=True)
    if req_count >= 440:
        print("  QUOTA LIMIT - stopping.", flush=True)
        break

    bills_for_state = []
    empty_pages = 0

    for page in range(1, STATE_PAGES + 1):
        if req_count >= 440: break
        results = fetch_openstates_page(name, page)
        req_count += 1
        if not results:
            empty_pages += 1
            if empty_pages >= 2: break
            continue
        empty_pages = 0

        for bill in results:
            os_id = bill.get("id", "")
            measure_id = f"state-{abbr}-{bill.get('identifier', os_id)}"
            if measure_id in existing_measures: continue
            doc_text = build_state_doc(bill)
            if len(doc_text.strip()) < 50: continue
            bills_for_state.append({
                "measure_id": measure_id,
                "text": doc_text,
                "source_url": bill.get("openstates_url", ""),
                "state": abbr,
            })
        time.sleep(STATE_DELAY)

    if bills_for_state:
        buf_ids, buf_docs, buf_metas = [], [], []
        for bill in bills_for_state:
            chunks = chunk_text(bill["text"])
            for j, chunk in enumerate(chunks):
                cid = f"{bill['measure_id']}-chunk-{j}"
                if cid in existing_cids: continue
                buf_ids.append(cid)
                buf_docs.append(chunk)
                buf_metas.append({
                    "chunk_text": chunk[:500],
                    "source_url": bill.get("source_url", ""),
                    "measure_id": bill["measure_id"],
                    "category": "other",
                    "jurisdiction": "state",
                    "state": bill["state"],
                })

        if buf_ids:
            for i in range(0, len(buf_ids), EMBED_BATCH):
                b_ids = buf_ids[i:i+EMBED_BATCH]
                b_docs = buf_docs[i:i+EMBED_BATCH]
                b_metas = buf_metas[i:i+EMBED_BATCH]
                embs = model.encode(b_docs).tolist()
                collection.add(ids=b_ids, documents=b_docs, embeddings=embs, metadatas=b_metas)
                existing_cids.update(b_ids)

        for b in bills_for_state:
            existing_measures.add(b["measure_id"])
        total_new_state += len(bills_for_state)
        print(f"  +{len(bills_for_state)} bills / +{len(buf_ids)} chunks | DB: {collection.count()}", flush=True)
    else:
        print(f"  0 new", flush=True)

elapsed = time.time() - fed_start
print(f"\n{'=' * 60}", flush=True)
print(f"ALL DONE", flush=True)
print(f"Total chunks: {collection.count()}", flush=True)
print(f"Total bills: {len(existing_measures)}", flush=True)
print(f"OpenStates reqs used: {req_count}", flush=True)
print(f"Time: {elapsed/60:.1f} min", flush=True)
print(f"{'=' * 60}", flush=True)
