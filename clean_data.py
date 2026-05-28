import json

data = json.load(open('data/raw_articles.json', encoding='utf-8'))
print(f'Sebelum cleaning: {len(data)} artikel')

# 1. Hapus duplikat (keep yang pertama)
seen = set()
deduped = []
for d in data:
    if d['title'] not in seen:
        seen.add(d['title'])
        deduped.append(d)
print(f'Setelah deduplikasi: {len(deduped)} artikel (hapus {len(data) - len(deduped)})')

# 2. Hapus yang sections kosong
has_sections = [d for d in deduped if len(d['sections']) > 0]
print(f'Setelah hapus sections kosong: {len(has_sections)} artikel (hapus {len(deduped) - len(has_sections)})')

# 3. Filter artikel yang bukan biografi orang
# Ciri biografi: summary mengandung kata kelahiran/profesi
bio_keywords = [
    'born', 'lahir', 'died', 'meninggal',
    'is a', 'was a', 'adalah seorang', 'merupakan seorang',
    'politician', 'scientist', 'president', 'minister', 'writer',
    'presiden', 'ilmuwan', 'politikus', 'penulis', 'atlet',
    'actor', 'singer', 'player', 'general', 'philosopher',
    'pemain', 'penyanyi', 'jenderal', 'filsuf', 'dokter',
]

def is_bio(article):
    summary = article.get('summary', '').lower()
    return any(kw in summary for kw in bio_keywords)

bio_only = [d for d in has_sections if is_bio(d)]
print(f'Setelah filter non-biografi: {len(bio_only)} artikel (hapus {len(has_sections) - len(bio_only)})')

# Ringkasan akhir
by_lang = {}
for d in bio_only:
    by_lang[d['lang']] = by_lang.get(d['lang'], 0) + 1
print(f'Per bahasa: {by_lang}')

# Simpan
with open('data/clean_articles.json', 'w', encoding='utf-8') as f:
    json.dump(bio_only, f, ensure_ascii=False, indent=2)

print(f'\nDone! Tersimpan di data/clean_articles.json')
