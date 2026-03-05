import sys, os, time
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scraper.ingest import ingest_federal
from scraper.ingest_states import main as ingest_states_main
from rag.retrieve import get_collection

collection = get_collection()
print(f"Starting chunks: {collection.count()}")
start = time.time()

# === FEDERAL: Congress 111-119, HR + S + Joint Resolutions ===
print("\n=== Federal Bills (Congress 111-119, all types) ===")
for bill_types, label in [
    (["hr", "s"], "Bills"),
    (["hjres", "sjres"], "Joint Resolutions"),
    (["hconres", "sconres"], "Concurrent Resolutions"),
    (["hres", "sres"], "Simple Resolutions"),
]:
    print(f"\n--- {label} ---")
    fed = ingest_federal(
        congresses=[111, 112, 113, 114, 115, 116, 117, 118, 119],
        bill_types=bill_types,
        max_pages=40,
    )
    print(f"{label} added: {fed} chunks | DB total: {collection.count()}")

elapsed = time.time() - start
print(f"\nFederal done in {elapsed/60:.1f} min | DB total: {collection.count()}")

# === STATE: all 50 states with max pages ===
print("\n=== State Bills (all 50 states, max coverage) ===")
sys.argv = ["ingest_states"]  # reset argv for argparse
ingest_states_main()

elapsed = time.time() - start
print(f"\n=== ALL DONE ===")
print(f"Total chunks in DB: {collection.count()}")
print(f"Total time: {elapsed/60:.1f} minutes")
