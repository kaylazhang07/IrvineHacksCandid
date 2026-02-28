import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from scraper.ingest import ingest_federal, ingest_states
from rag.retrieve import get_collection

print(f"Starting chunks: {get_collection().count()}")

print("\n=== Federal Bills (Congress 115-119) ===")
fed = ingest_federal(
    congresses=[115, 116, 117, 118, 119],
    bill_types=["hr", "s"],
    max_pages=15,
)
print(f"Federal added: {fed} chunks | DB total: {get_collection().count()}")

print("\n=== State Bills (all 50 states) ===")
state = ingest_states(per_state=150, max_pages=8)
print(f"State added: {state} chunks | DB total: {get_collection().count()}")

print(f"\nFINAL TOTAL: {get_collection().count()} chunks")
