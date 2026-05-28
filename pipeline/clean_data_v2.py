import json
from pathlib import Path

data = json.load(open('data/raw_articles.json', encoding='utf-8'))
print(f'Sebelum cleaning: {len(data)} artikel')

# 1. Hapus duplikat
seen = set()
deduped = []
for d in data:
    if d['title'] not in seen:
        seen.add(d['title'])
        deduped.append(d)
print(f'Setelah deduplikasi: {len(deduped)}')

# 2. Hapus sections kosong
has_sections = [d for d in deduped if len(d['sections']) > 0]
print(f'Setelah hapus sections kosong: {len(has_sections)}')

# 3. Filter ketat — harus ada kata kelahiran SPESIFIK (tanggal/tahun lahir)
# Biografi orang hampir selalu punya pola "born on", "lahir pada", "born in [year]"
import re

def is_strict_bio(article):
    summary = article.get('summary', '')

    # Pola tanggal lahir: "born 14 March 1879", "born on 6 June 1901", "lahir 6 Juni 1901"
    born_pattern = re.search(
        r'(born|lahir).{0,30}(\d{4})',
        summary, re.IGNORECASE
    )
    if born_pattern:
        return True

    # Pola tahun hidup di title atau summary: "(1879–1955)" atau "(1901 - 1970)"
    lifespan_pattern = re.search(r'\(\d{4}[\s–\-]+\d{4}\)', summary)
    if lifespan_pattern:
        return True

    # Pola "is an Indonesian politician" / "adalah seorang politikus"
    person_pattern = re.search(
        r'(is an?|was an?|adalah seorang|merupakan seorang)\s+\w+\s+(politician|scientist|president|actor|singer|writer|athlete|player|general|director|musician|painter|philosopher|mathematician|physicist|chemist|engineer|doctor|lawyer|journalist|activist|artist|composer|novelist|poet|filmmaker|entrepreneur|businessman|military|admiral|general|colonel|professor|minister|governor|senator|diplomat|ambassador|bishop|archbishop|cardinal|imam|ulama|kyai|politikus|ilmuwan|presiden|aktor|penyanyi|penulis|atlet|pemain|jenderal|sutradara|musisi|pelukis|filsuf|matematikawan|fisikawan|insinyur|dokter|pengacara|jurnalis|aktivis|seniman|komposer|novelis|penyair)',
        summary, re.IGNORECASE
    )
    if person_pattern:
        return True

    return False

bio_only = [d for d in has_sections if is_strict_bio(d)]
print(f'Setelah filter ketat biografi: {len(bio_only)}')

# Cek sample
print('\nSample 10 judul:')
for d in bio_only[:10]:
    print(f'  - {d["title"]} ({d["lang"]})')

by_lang = {}
for d in bio_only:
    by_lang[d['lang']] = by_lang.get(d['lang'], 0) + 1
print(f'\nPer bahasa: {by_lang}')

# Simpan
with open('data/clean_articles.json', 'w', encoding='utf-8') as f:
    json.dump(bio_only, f, ensure_ascii=False, indent=2)
print(f'\nDone! Tersimpan di data/clean_articles.json')
