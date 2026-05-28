"""
Chunker
--------
Potong artikel dari clean_articles.json jadi chunks kecil.
Output: data/chunks.json

Jalanin:
  python chunker.py
"""

import json
import re
from pathlib import Path


CHUNK_SIZE    = 600   # target panjang chunk (karakter)
CHUNK_OVERLAP = 80    # overlap antar chunk


def clean_text(text: str) -> str:
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r" {2,}", " ", text)
    return text.strip()


def split_text(text: str) -> list[str]:
    """
    Pecah teks dengan hierarki:
    1. Paragraph (\n\n)
    2. Kalimat (. )
    3. Character window (fallback)
    """
    if len(text) <= CHUNK_SIZE:
        return [text] if text.strip() else []

    # Coba split by paragraph
    parts = re.split(r"\n\n+", text)
    if len(parts) > 1:
        return merge_splits(parts)

    # Coba split by kalimat
    parts = re.split(r"(?<=[.!?])\s+", text)
    if len(parts) > 1:
        return merge_splits(parts)

    # Fallback: hard window
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + CHUNK_SIZE, len(text))
        chunks.append(text[start:end].strip())
        start += CHUNK_SIZE - CHUNK_OVERLAP
    return [c for c in chunks if c]


def merge_splits(parts: list[str]) -> list[str]:
    chunks = []
    current = ""
    overlap_buf = ""

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
    chunks = []
    idx = 0

    # Chunk summary dulu (info paling penting: lahir, profesi, dll)
    summary = clean_text(article.get("summary", ""))
    if summary:
        pieces = split_text(summary)
        for piece in pieces:
            chunks.append({
                "chunk_id"   : f"{article['title'].replace(' ', '_')}_{article['lang']}_{idx}",
                "title"      : article["title"],
                "url"        : article["url"],
                "lang"       : article["lang"],
                "section"    : "Summary",
                "text"       : piece,
            })
            idx += 1

    for section in article["sections"]:
        text = clean_text(section["text"])
        if not text:
            continue

        pieces = split_text(text)
        for piece in pieces:
            chunks.append({
                "chunk_id"   : f"{article['title'].replace(' ', '_')}_{article['lang']}_{idx}",
                "title"      : article["title"],
                "url"        : article["url"],
                "lang"       : article["lang"],
                "section"    : section["title"],
                "text"       : piece,
            })
            idx += 1

    return chunks


if __name__ == "__main__":
    print("Loading clean_articles.json...")
    data = json.load(open("data/clean_articles.json", encoding="utf-8"))
    print(f"Total artikel: {len(data)}")

    all_chunks = []
    for i, article in enumerate(data, 1):
        chunks = chunk_article(article)
        all_chunks.extend(chunks)

        if i % 500 == 0:
            print(f"  [{i}/{len(data)}] total chunks so far: {len(all_chunks)}")

    # Simpan
    Path("data").mkdir(exist_ok=True)
    with open("data/chunks.json", "w", encoding="utf-8") as f:
        json.dump(all_chunks, f, ensure_ascii=False, indent=2)

    print(f"\nDone!")
    print(f"  Total chunks : {len(all_chunks)}")
    print(f"  Rata-rata    : {len(all_chunks) // len(data)} chunks/artikel")
    print(f"  Output       : data/chunks.json")
