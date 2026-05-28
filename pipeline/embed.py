"""
Embedder
---------
Baca chunks.json, embed tiap chunk, simpan ke ChromaDB.

Jalanin:
  python embed.py
"""

import json
import torch
from pathlib import Path
from tqdm import tqdm
from sentence_transformers import SentenceTransformer
import chromadb

CHUNKS_PATH  = "data/chunks.json"
CHROMA_DIR   = "data/chroma"
COLLECTION   = "biographies"
EMBED_MODEL  = "paraphrase-multilingual-MiniLM-L12-v2"
BATCH_SIZE   = 256  # lebih besar karena GPU


if __name__ == "__main__":
    # Cek GPU
    device = "cuda" if torch.cuda.is_available() else "cpu"
    if device == "cuda":
        print(f"GPU detected: {torch.cuda.get_device_name(0)}")
    else:
        print("GPU tidak ditemukan, pakai CPU")

    # Load chunks
    print("\nLoading chunks.json...")
    chunks = json.load(open(CHUNKS_PATH, encoding="utf-8"))
    print(f"Total chunks: {len(chunks)}")

    # Load model langsung ke GPU
    print(f"\nLoading embedding model ke {device.upper()}...")
    model = SentenceTransformer(EMBED_MODEL, device=device)

    # Init ChromaDB (tanpa embedding function bawaan, kita embed manual)
    print(f"Connecting to ChromaDB di {CHROMA_DIR}...")
    client     = chromadb.PersistentClient(path=CHROMA_DIR)
    collection = client.get_or_create_collection(
        name=COLLECTION,
        metadata={"hnsw:space": "cosine"},
    )

    already = collection.count()
    existing_ids = set()
    if already > 0:
        print(f"Collection sudah ada {already} chunks")
        result = collection.get(include=[])
        existing_ids = set(result["ids"])

    new_chunks = [c for c in chunks if c["chunk_id"] not in existing_ids]
    print(f"Chunks baru: {len(new_chunks)}")

    if len(new_chunks) == 0:
        print("Semua chunks sudah ter-embed!")
    else:
        print(f"\nMulai embedding di {device.upper()}... (batch={BATCH_SIZE})")
        for i in tqdm(range(0, len(new_chunks), BATCH_SIZE), desc="Embedding"):
            batch     = new_chunks[i : i + BATCH_SIZE]
            texts     = [c["text"] for c in batch]

            # Embed di GPU
            embeddings = model.encode(
                texts,
                batch_size=BATCH_SIZE,
                show_progress_bar=False,
                normalize_embeddings=True,
                device=device,
            )

            ids       = [c["chunk_id"] for c in batch]
            metadatas = [
                {
                    "title"  : c["title"],
                    "section": c["section"],
                    "url"    : c["url"],
                    "lang"   : c["lang"],
                }
                for c in batch
            ]

            collection.upsert(
                ids=ids,
                documents=texts,
                embeddings=embeddings.tolist(),
                metadatas=metadatas,
            )

    print(f"\nDone!")
    print(f"  Total di ChromaDB : {collection.count()} chunks")
    print(f"  Lokasi            : {CHROMA_DIR}/")
