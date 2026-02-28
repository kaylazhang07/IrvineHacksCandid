from sentence_transformers import SentenceTransformer
import psycopg2

print("Starting script...")

model = SentenceTransformer("all-MiniLM-L6-v2")

conn = psycopg2.connect(
    dbname="civic",
    user="anvijain",
    host="localhost"
)

cur = conn.cursor()

def insert_document(text):
    embedding = model.encode(text).tolist()
    cur.execute(
        "INSERT INTO documents (content, embedding) VALUES (%s, %s)",
        (text, embedding)
    )
    conn.commit()

insert_document("The president signs federal legislation.")
insert_document("The Supreme Court interprets constitutional law.")

cur.close()
conn.close()

print("Done inserting documents.")
