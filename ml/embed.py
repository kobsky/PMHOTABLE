"""
embed.py — Frozen multilingual sentence-transformer encoder for U1.

Loads `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` (FROZEN —
no fine-tuning) and encodes task titles into dense embeddings. The model is
multilingual, so mixed Polish + English titles share one embedding space.

Cache lives INSIDE the repo (ml/hf_cache, gitignored). Env vars MUST be set
before importing sentence_transformers, so we set them here at module top.
"""

import os

# --- cache config MUST come before importing sentence_transformers ---
_HERE = os.path.dirname(os.path.abspath(__file__))
_CACHE = os.path.join(_HERE, "hf_cache")
os.makedirs(_CACHE, exist_ok=True)
os.environ.setdefault("HF_HOME", _CACHE)
os.environ.setdefault("SENTENCE_TRANSFORMERS_HOME", _CACHE)
os.environ.setdefault("TOKENIZERS_PARALLELISM", "false")

import numpy as np  # noqa: E402
from sentence_transformers import SentenceTransformer  # noqa: E402

MODEL_NAME = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"

_model = None


def get_model() -> SentenceTransformer:
    """Lazy-load the frozen encoder (CPU)."""
    global _model
    if _model is None:
        print(f"[embed] loading frozen encoder: {MODEL_NAME} (cache={_CACHE})")
        _model = SentenceTransformer(MODEL_NAME, cache_folder=_CACHE, device="cpu")
    return _model


def embed_texts(texts, batch_size: int = 64) -> np.ndarray:
    """Encode a list of texts -> (N, dim) float32 numpy array."""
    model = get_model()
    emb = model.encode(
        list(texts),
        batch_size=batch_size,
        convert_to_numpy=True,
        show_progress_bar=True,
        normalize_embeddings=True,  # L2-normalised -> good for linear classifier
    )
    return emb.astype(np.float32)


if __name__ == "__main__":
    sample = [
        "Fix login bug",
        "Napraw blad logowania",
        "Research competitor pricing",
        "Zbadaj ceny konkurencji",
    ]
    e = embed_texts(sample)
    print("shape:", e.shape, "dtype:", e.dtype)
    # PL/EN of the same meaning should be close (cosine via normalized dot)
    import numpy as np
    print("cos(fix EN, napraw PL) =", float(e[0] @ e[1]))
    print("cos(research EN, zbadaj PL) =", float(e[2] @ e[3]))
