"""
Add Articles by Name
---------------------
Tambah artikel Wikipedia spesifik langsung ke ChromaDB tanpa re-run pipeline penuh.

Cara pakai:
  python pipeline/add_articles.py
  python pipeline/add_articles.py --dry-run   # cek tanpa simpan ke DB
"""

import sys
import re
import json
import torch
import argparse
import unicodedata
from pathlib import Path

import wikipediaapi
import chromadb
from sentence_transformers import SentenceTransformer

# ─────────────────────────────────────────────
# Daftar artikel yang ingin ditambahkan
# Format: (judul Wikipedia, bahasa)
# ─────────────────────────────────────────────
ARTICLES_TO_ADD = [
    # Tokoh historis Indonesia yang belum ada
    ("Soekarno",                   "id"),
    ("Mohammad Hatta",             "id"),
    ("Basuki Tjahaja Purnama",     "id"),
    ("Soeharto",                   "id"),
    ("Abdurrahman Wahid",          "id"),
    ("Bacharuddin Jusuf Habibie",  "id"),
]

# ─────────────────────────────────────────────
# Config (sama dengan pipeline utama)
# ─────────────────────────────────────────────
CHROMA_DIR   = "data/chroma"
COLLECTION   = "biographies"
EMBED_MODEL  = "paraphrase-multilingual-MiniLM-L12-v2"
CHUNK_SIZE   = 600
CHUNK_OVERLAP = 80
MIN_CHARS    = 80
WIKI_UA      = "BiographyFactChecker/1.0 (academic-project)"


# ─────────────────────────────────────────────
# Scraper helpers (dari pipeline/scraper.py)
# ─────────────────────────────────────────────
def _get_wiki(lang: str) -> wikipediaapi.Wikipedia:
    return wikipediaapi.Wikipedia(language=lang, user_agent=WIKI_UA,
                                   extract_format=wikipediaapi.ExtractFormat.WIKI)

def _clean_text(text: str) -> str:
    text = re.sub(r"\n{3,}", "\n\n", text)
    return re.sub(r" {2,}", " ", text).strip()

def _extract_sections(sections, result, parent_title="", depth=0):
    for section in sections:
        section_title = f"{parent_title} > {section.title}" if parent_title else section.title
        text = _clean_text(section.text)
        if text:
            result.append({"title": section_title, "text": text, "depth": depth})
        if section.sections:
            _extract_sections(section.sections, result, section_title, depth + 1)

def fetch_article(title: str, lang: str) -> dict | None:
    wiki = _get_wiki(lang)
    page = wiki.page(title)
    if not page.exists():
        print(f"  TIDAK DITEMUKAN di Wikipedia ({lang}): {title}")
        return None
    sections = []
    _extract_sections(page.sections, sections)
    full_text = _clean_text(page.text)
    if len(full_text) < 200:
        print(f"  TERLALU PENDEK ({len(full_text)} chars): {title}")
        return None
    return {
        "title": page.title,
        "url": page.fullurl,
        "lang": lang,
        "summary": _clean_text(page.summary),
        "sections": sections,
    }


# ─────────────────────────────────────────────
# Chunker helpers (dari pipeline/chunker.py)
# ─────────────────────────────────────────────
def split_text(text: str) -> list[str]:
    if len(text) <= CHUNK_SIZE:
        return [text] if text.strip() else []
    parts = re.split(r"\n\n+", text)
    if len(parts) > 1:
        return _merge_splits(parts)
    parts = re.split(r"(?<=[.!?])\s+", text)
    if len(parts) > 1:
        return _merge_splits(parts)
    chunks, start = [], 0
    while start < len(text):
        end = min(start + CHUNK_SIZE, len(text))
        chunks.append(text[start:end].strip())
        start += CHUNK_SIZE - CHUNK_OVERLAP
    return [c for c in chunks if c]

def _merge_splits(parts: list[str]) -> list[str]:
    chunks, current, overlap_buf = [], "", ""
    for part in parts:
        part = part.strip()
        if not part:
            continue
        if len(current) + len(part) + 1 <= CHUNK_SIZE:
            current = (current + " " + part).strip() if current else part
        else:
            if current:
                chunks.append(current)
                overlap_buf = current[-CHUNK_OVERLAP:] if len(current) > CHUNK_OVERLAP else current
            current = (overlap_buf + " " + part).strip() if overlap_buf else part
    if current:
        chunks.append(current)
    return [c for c in chunks if c.strip()]

def chunk_article(article: dict) -> list[dict]:
    chunks, idx = [], 0
    summary = _clean_text(article.get("summary", ""))
    if summary:
        for piece in split_text(summary):
            chunks.append({
                "chunk_id": f"{article['title'].replace(' ', '_')}_{article['lang']}_{idx}",
                "title": article["title"],
                "url": article["url"],
                "lang": article["lang"],
                "section": "Summary",
                "text": piece,
            })
            idx += 1
    for section in article["sections"]:
        text = _clean_text(section["text"])
        if not text:
            continue
        for piece in split_text(text):
            chunks.append({
                "chunk_id": f"{article['title'].replace(' ', '_')}_{article['lang']}_{idx}",
                "title": article["title"],
                "url": article["url"],
                "lang": article["lang"],
                "section": section["title"],
                "text": piece,
            })
            idx += 1
    return chunks


# ─────────────────────────────────────────────
# Embed helper (dari pipeline/embed.py)
# ─────────────────────────────────────────────
def embedding_text(chunk: dict) -> str:
    return f"Judul: {chunk['title']}\nBagian: {chunk['section']}\nTeks: {chunk['text']}"

def is_useful_chunk(chunk: dict) -> bool:
    text = chunk.get("text", "").strip()
    if len(text) >= MIN_CHARS:
        return True
    return chunk.get("section", "").lower() == "summary" and len(text) >= 30


# ─────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Scrape & chunk tapi jangan simpan ke DB")
    args = parser.parse_args()

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Device: {device.upper()}")

    if not args.dry_run:
        print(f"Loading embedding model...")
        model = SentenceTransformer(EMBED_MODEL, device=device)
        client = chromadb.PersistentClient(path=CHROMA_DIR)
        collection = client.get_or_create_collection(name=COLLECTION, metadata={"hnsw:space": "cosine"})
        existing_ids = set(collection.get(include=[])["ids"])
        print(f"ChromaDB: {collection.count()} chunks sudah ada\n")
    else:
        model = None
        collection = None
        existing_ids = set()
        print("DRY RUN — tidak akan menyimpan ke DB\n")

    total_added = 0

    for title, lang in ARTICLES_TO_ADD:
        print(f"{'─'*50}")
        print(f"[{lang}] {title}")

        article = fetch_article(title, lang)
        if article is None:
            continue

        chunks = chunk_article(article)
        chunks = [c for c in chunks if is_useful_chunk(c)]
        new_chunks = [c for c in chunks if c["chunk_id"] not in existing_ids]

        print(f"  Sections: {len(article['sections'])} | Chunks: {len(chunks)} | Baru: {len(new_chunks)}")

        if args.dry_run or len(new_chunks) == 0:
            if len(new_chunks) == 0:
                print(f"  Semua chunks sudah ada di DB, skip.")
            continue

        embed_texts = [embedding_text(c) for c in new_chunks]
        embeddings = model.encode(
            embed_texts,
            batch_size=64,
            normalize_embeddings=True,
            device=device,
            show_progress_bar=len(new_chunks) > 50,
        )

        collection.upsert(
            ids=[c["chunk_id"] for c in new_chunks],
            documents=[c["text"] for c in new_chunks],
            embeddings=embeddings.tolist(),
            metadatas=[{"title": c["title"], "section": c["section"],
                        "url": c["url"], "lang": c["lang"]} for c in new_chunks],
        )

        existing_ids.update(c["chunk_id"] for c in new_chunks)
        total_added += len(new_chunks)
        print(f"  TERSIMPAN: {len(new_chunks)} chunks baru")

    print(f"\n{'='*50}")
    if args.dry_run:
        print("DRY RUN selesai. Jalankan tanpa --dry-run untuk menyimpan.")
    else:
        print(f"Selesai! Total chunks ditambahkan: {total_added}")
        if collection:
            print(f"Total di ChromaDB sekarang: {collection.count()} chunks")


if __name__ == "__main__":
    main()
