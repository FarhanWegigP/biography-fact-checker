import json

data   = json.load(open('data/clean_articles.json', encoding='utf-8'))
titles = [d['title'].lower() for d in data]

cek = [
    'soekarno', 'sukarno', 'habibie', 'jokowi', 'widodo',
    'megawati', 'soeharto', 'hatta', 'einstein', 'newton',
    'marie curie', 'napoleon', 'gandhi', 'mandela', 'lincoln',
    'churchill', 'darwin', 'tesla', 'aristotle', 'plato',
    'messi', 'ronaldo', 'ali', 'obama', 'putin',
]

print("Status tokoh di dataset:\n")
for t in cek:
    ada = any(t in title for title in titles)
    status = "✓ ADA" if ada else "✗ TIDAK ADA"
    print(f"  {status:<15} {t}")