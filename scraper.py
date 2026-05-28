"""
Wikipedia Biography Scraper
-----------------------------
Scrape ribuan artikel biografi dari Wikipedia via Category crawling.

Cara kerja:
  1. Ambil semua member dari daftar kategori (EN + ID)
  2. Filter: hanya halaman yang terindikasi biografi (ada kata kunci kelahiran/tahun)
  3. Fetch tiap artikel: title, url, summary, sections
  4. Simpan ke data/raw_articles.json (bisa resume kalau terputus)

Jalanin:
  python scraper.py
  python scraper.py --max 2000       # batas jumlah artikel
  python scraper.py --max 500 --resume   # lanjut dari yang sudah ada
"""

import json
import logging
import re
import time
import argparse
from pathlib import Path

import wikipediaapi

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

WIKI_USER_AGENT = "BiographyFactChecker/1.0 (academic-project)"
OUTPUT_PATH = "./data/raw_articles.json"

# ─────────────────────────────────────────────────────────
# Kategori Wikipedia yang akan di-crawl
# ─────────────────────────────────────────────────────────
EN_CATEGORIES = [
    # Pemimpin & Politik
    "Category:Heads of state",
    "Category:Heads of government",
    "Category:Presidents by country",
    "Category:Prime ministers",
    "Category:Monarchs",
    "Category:Revolutionaries",
    "Category:Political philosophers",

    # Ilmuwan
    "Category:Nobel Prize in Physics laureates",
    "Category:Nobel Prize in Chemistry laureates",
    "Category:Nobel Prize in Physiology or Medicine laureates",
    "Category:Nobel Prize in Literature laureates",
    "Category:Nobel Peace Prize laureates",
    "Category:Mathematicians",
    "Category:Physicists",
    "Category:Chemists",
    "Category:Biologists",
    "Category:Computer scientists",
    "Category:Inventors",
    "Category:Astronomers",

    # Teknologi & Bisnis
    "Category:American technology company founders",
    "Category:Businesspeople from California",
    "Category:Billionaires",
    "Category:Entrepreneurs",

    # Seni & Budaya
    "Category:Artists by nationality",
    "Category:Writers by nationality",
    "Category:Philosophers",
    "Category:Composers",
    "Category:Painters",

    # Olahraga
    "Category:Olympic gold medalists",
    "Category:FIFA World Cup players",
    "Category:Tennis players",
    "Category:Basketball players",
    "Category:Boxers",

    # Sejarah
    "Category:Ancient Greek philosophers",
    "Category:Military commanders",
    "Category:Explorers",
    "Category:Revolutionaries",
]

ID_CATEGORIES = [
    # Politik Indonesia
    "Kategori:Presiden Indonesia",
    "Kategori:Wakil Presiden Indonesia",
    "Kategori:Gubernur di Indonesia",
    "Kategori:Politikus Indonesia",
    "Kategori:Tokoh militer Indonesia",
    "Kategori:Pahlawan nasional Indonesia",

    # Ilmuwan & Akademisi
    "Kategori:Ilmuwan Indonesia",
    "Kategori:Tokoh pendidikan Indonesia",

    # Seni & Budaya
    "Kategori:Sastrawan Indonesia",
    "Kategori:Seniman Indonesia",
    "Kategori:Sutradara Indonesia",
    "Kategori:Penyanyi Indonesia",

    # Olahraga
    "Kategori:Atlet Indonesia",
    "Kategori:Pesepak bola Indonesia",
    "Kategori:Pemain bulu tangkis Indonesia",

    # Sejarah
    "Kategori:Tokoh Jawa",
    "Kategori:Tokoh Minangkabau",
    "Kategori:Tokoh Sunda",
]


# ─────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────

def _get_wiki(lang: str) -> wikipediaapi.Wikipedia:
    return wikipediaapi.Wikipedia(
        language=lang,
        user_agent=WIKI_USER_AGENT,
        extract_format=wikipediaapi.ExtractFormat.WIKI,
    )


def _clean_text(text: str) -> str:
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r" {2,}", " ", text)
    return text.strip()


def _is_biography(page) -> bool:
    """
    Filter kasar: cek apakah halaman ini biografi orang.
    Cek keberadaan kata kunci kelahiran di summary.
    """
    summary_lower = page.summary[:500].lower()
    bio_keywords = [
        "born", "lahir", "died", "meninggal",
        "is a", "was a", "adalah seorang", "merupakan",
        "politician", "scientist", "president", "minister",
        "presiden", "ilmuwan", "politikus", "pemimpin",
    ]
    return any(kw in summary_lower for kw in bio_keywords)


def _is_disambiguation(page) -> bool:
    summary_lower = page.summary[:300].lower()
    return (
        "may refer to" in summary_lower
        or "dapat merujuk" in summary_lower
        or "disambiguation" in summary_lower
    )


def _extract_sections(sections, result, parent_title="", depth=0):
    for section in sections:
        section_title = f"{parent_title} > {section.title}" if parent_title else section.title
        text = _clean_text(section.text)
        if text:
            result.append({"title": section_title, "text": text, "depth": depth})
        if section.sections:
            _extract_sections(section.sections, result, section_title, depth + 1)


# ─────────────────────────────────────────────────────────
# Category Crawler
# ─────────────────────────────────────────────────────────

def get_category_members(wiki, category_title: str, max_per_cat: int = 200) -> list[str]:
    """
    Ambil daftar judul artikel dari sebuah kategori Wikipedia.
    Hanya ambil halaman (bukan subkategori).
    """
    cat_page = wiki.page(category_title)
    if not cat_page.exists():
        logger.warning(f"Category not found: {category_title}")
        return []

    members = []
    for title, member in cat_page.categorymembers.items():
        # ns=0 = artikel biasa (bukan kategori/template)
        if member.ns == wikipediaapi.Namespace.MAIN:
            members.append(title)
        if len(members) >= max_per_cat:
            break

    logger.info(f"  {category_title}: {len(members)} articles found")
    return members


def collect_all_titles(max_per_cat: int = 200) -> list[tuple[str, str]]:
    """
    Crawl semua kategori, return list of (title, lang).
    Deduplicate by title.
    """
    wiki_en = _get_wiki("en")
    wiki_id = _get_wiki("id")

    seen = set()
    all_titles = []

    print(f"\n{'='*50}")
    print("Crawling EN categories...")
    print(f"{'='*50}")
    for cat in EN_CATEGORIES:
        members = get_category_members(wiki_en, cat, max_per_cat)
        for title in members:
            if title not in seen:
                seen.add(title)
                all_titles.append((title, "en"))
        time.sleep(0.3)  # jangan terlalu agresif hit Wikipedia

    print(f"\n{'='*50}")
    print("Crawling ID categories...")
    print(f"{'='*50}")
    for cat in ID_CATEGORIES:
        members = get_category_members(wiki_id, cat, max_per_cat)
        for title in members:
            if title not in seen:
                seen.add(title)
                all_titles.append((title, "id"))
        time.sleep(0.3)

    print(f"\nTotal unique titles collected: {len(all_titles)}")
    return all_titles


# ─────────────────────────────────────────────────────────
# Fetch Single Article
# ─────────────────────────────────────────────────────────

def fetch_article(title: str, lang: str) -> dict | None:
    """Fetch satu artikel. Return None kalau skip."""
    wiki = _get_wiki(lang)
    page = wiki.page(title)

    if not page.exists():
        return None
    if _is_disambiguation(page):
        return None
    if not _is_biography(page):
        return None

    sections = []
    _extract_sections(page.sections, sections)

    full_text = _clean_text(page.text)
    if len(full_text) < 500:  # skip artikel terlalu pendek
        return None

    return {
        "title": page.title,
        "url": page.fullurl,
        "lang": lang,
        "summary": _clean_text(page.summary),
        "sections": sections,
        "total_chars": len(full_text),
        "total_sections": len(sections),
    }


# ─────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────

def load_existing(path: str) -> tuple[list[dict], set[str]]:
    """Load hasil scraping sebelumnya untuk resume."""
    if not Path(path).exists():
        return [], set()
    with open(path, encoding="utf-8") as f:
        existing = json.load(f)
    seen = {a["title"] for a in existing}
    return existing, seen


def save_checkpoint(articles: list[dict], path: str) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(articles, f, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--max", type=int, default=3000, help="Maks jumlah artikel")
    parser.add_argument("--max_per_cat", type=int, default=200, help="Maks artikel per kategori")
    parser.add_argument("--resume", action="store_true", help="Lanjut dari checkpoint")
    parser.add_argument("--output", default=OUTPUT_PATH)
    args = parser.parse_args()

    # Load existing kalau resume
    if args.resume:
        articles, scraped_titles = load_existing(args.output)
        print(f"Resuming from {len(articles)} existing articles")
    else:
        articles, scraped_titles = [], set()

    # Step 1: Collect all titles from categories
    print("\nStep 1: Collecting article titles from categories...")
    all_titles = collect_all_titles(max_per_cat=args.max_per_cat)

    # Filter yang sudah di-scrape
    remaining = [(t, l) for t, l in all_titles if t not in scraped_titles]
    remaining = remaining[: args.max - len(articles)]

    print(f"\nStep 2: Scraping {len(remaining)} articles...")
    print(f"{'='*50}")

    skipped = 0
    errors = 0

    for i, (title, lang) in enumerate(remaining, 1):
        print(f"[{i}/{len(remaining)}] {title} ({lang})", end=" ... ")

        try:
            article = fetch_article(title, lang)
            if article is None:
                print("SKIP (bukan biografi / terlalu pendek)")
                skipped += 1
            else:
                articles.append(article)
                print(f"OK ({article['total_sections']} sections, {article['total_chars']} chars)")

        except Exception as e:
            print(f"ERROR: {e}")
            errors += 1

        # Checkpoint setiap 50 artikel
        if i % 50 == 0:
            save_checkpoint(articles, args.output)
            print(f"\n  >>> Checkpoint saved: {len(articles)} articles total\n")

        time.sleep(0.5)  # rate limiting

    # Final save
    save_checkpoint(articles, args.output)

    print(f"\n{'='*50}")
    print(f"DONE!")
    print(f"  Total artikel tersimpan : {len(articles)}")
    print(f"  Skipped (bukan bio)     : {skipped}")
    print(f"  Errors                  : {errors}")
    print(f"  Output                  : {args.output}")
    print(f"{'='*50}")
