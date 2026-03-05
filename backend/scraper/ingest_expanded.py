import sys, os, time, gc
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from scraper.ingest import ingest_federal
from scraper.ingest_states import main as ingest_all_states
from rag.retrieve import get_collection

collection = get_collection()
print(f"Starting chunks: {collection.count()}")

print("\n=== Older Congress Sessions (111-114) ===")
fed_old = ingest_federal(
    congresses=[111, 112, 113, 114],
    bill_types=["hr", "s"],
    max_pages=20,
)
print(f"Older federal added: {fed_old} chunks | DB total: {collection.count()}")

print("\n=== Joint Resolutions (115-119) ===")
fed_res = ingest_federal(
    congresses=[115, 116, 117, 118, 119],
    bill_types=["hjres", "sjres"],
    max_pages=10,
)
print(f"Resolutions added: {fed_res} chunks | DB total: {collection.count()}")

print(f"\nFINAL TOTAL: {collection.count()} chunks")
