import json

data = json.load(open('data/raw_articles.json', encoding='utf-8'))

print(f'Total artikel     : {len(data)}')
print(f'Contoh judul      : {[d["title"] for d in data[:5]]}')

empty    = [d['title'] for d in data if len(d['sections']) == 0]
short    = [d['title'] for d in data if d['total_chars'] < 500]
titles   = [d['title'] for d in data]
dupes    = len(titles) - len(set(titles))
by_lang  = {}
for d in data:
    by_lang[d['lang']] = by_lang.get(d['lang'], 0) + 1

print(f'Sections kosong   : {len(empty)}')
print(f'Terlalu pendek    : {len(short)}')
print(f'Duplikat          : {dupes}')
print(f'Per bahasa        : {by_lang}')
