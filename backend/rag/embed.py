from sentence_transformers import SentenceTransformer

_model = None


def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def embed_text(text: str) -> list[float]:
    model = get_model()
    embedding = model.encode(text[:2000], normalize_embeddings=True)
    return embedding.tolist()


def embed_batch(texts: list[str]) -> list[list[float]]:
    model = get_model()
    embeddings = model.encode(
        [t[:2000] for t in texts], normalize_embeddings=True, batch_size=32
    )
    return embeddings.tolist()
