from sentence_transformers import SentenceTransformer
import psycopg2

print("Starting search...")

model = SentenceTransformer("all-MiniLM-L6-v2")

conn = psycopg2.connect(
    dbname="civic",
    user="anvijain",
    host="localhost"
)

cur = conn.cursor()

query = "Who signs laws?"
query_embedding = model.encode(query).tolist()

# Convert embedding list into pgvector string format
vector_str = "[" + ",".join(str(x) for x in query_embedding) + "]"

cur.execute(f"""
    SELECT content
    FROM documents
    ORDER BY embedding <-> '{vector_str}'
    LIMIT 2;
""")

results = cur.fetchall()

for r in results:
    print(r[0])

cur.close()
conn.close()

print("Done.")
