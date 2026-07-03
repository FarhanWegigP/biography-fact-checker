# Biography Fact Checker

Tugas Besar Pemrograman NLP. Use case yang dipilih: **fact checking** — cek kebenaran klaim biografi tokoh (Soekarno, Einstein, dll) pakai RAG dari Wikipedia, bukan cuma nanya ke LLM mentah-mentah.

Kenapa fact checking dan bukan QA dokumen kampus atau sentiment analysis: datanya (biografi tokoh) jelas dan gampang divalidasi — ada tanggal lahir, jabatan, penghargaan yang bisa dicocokkan ke sumber, jadi lebih gampang diukur bener/salahnya dibanding sentiment analysis yang subjektif.

## Cara kerjanya

Klaim masuk → di-embed → dicari chunk Wikipedia yang paling relevan di ChromaDB (semantic similarity + entity matching biar nama tokoh gak salah cocok) → chunk yang ketemu dikasih ke LLM (Groq Llama 3.3 70B) buat mutusin klaimnya BENAR / SALAH / TIDAK CUKUP INFORMASI, lengkap sama alasan dan sumbernya.

Ini yang dimaksud RAG di CPMK3 — jawaban LLM dibatasi sama apa yang ada di data, jadi kalau dokumennya gak nyebut sesuatu, sistem bilang "gak cukup info" daripada ngarang.

## Fitur

- **Cek Fakta** — mode utama. Masukin klaim, keluar verdict + penjelasan + kutipan sumber.
- **Tanya Jawab bebas** — nanya hal biografis secara umum, dijawab pakai retrieval yang sama.
- **Cek dari gambar** — screenshot postingan/klaim, di-OCR pakai vision model (Llama 4 Scout) terus diverifikasi.
- **Scan URL** — tempel link artikel, sistem scrape isinya lalu jalanin fact-check yang sama. Fitur tambahan, bukan fokus utama.
- 3 strategi prompting yang bisa dibandingin: `zero_shot`, `cot` (chain-of-thought, default), `structured` (output JSON).

## Evaluasi (CPMK4)

- **Kuantitatif**: `evaluate.py` — verdict accuracy, retrieval hit-rate, dan BERTScore buat ngukur kemiripan penjelasan model sama referensi. Dataset uji ada di `data/test_claims.json`.
- **Kualitatif**: review manual per kasus dari hasil `evaluate.py`, termasuk kasus yang modelnya salah atau ambigu.
- **Etika, bias, safety**: lihat bagian di bawah.

## Etika, Bias & Safety

- Data condong ke tokoh Indonesia (~70% ID, ~30% EN) karena scraping fokus ke kategori Wikipedia Indonesia — hasil retrieval jadi lebih kuat buat tokoh lokal, lebih lemah buat tokoh yang kurang punya artikel ID.
- Wikipedia sendiri punya bias representasi (gender, geografi, tokoh yang kurang terdokumentasi tetap kurang keliatan di sistem ini).
- RAG mengurangi halusinasi tapi gak menghilangkan — LLM tetap bisa salah baca konteks, jadi verdict "BENAR" dari sistem ini bukan kebenaran absolut, tetap perlu dicek ke sumber aslinya (makanya source card selalu ditampilkan).
- Sistem ini alat bantu, bukan pengganti verifikasi manual — dibuat buat tugas kuliah, belum diuji buat dipakai publik dalam skala besar.

## Stack

FastAPI · Groq (Llama 3.3 70B untuk teks, Llama 4 Scout untuk gambar) · ChromaDB · `paraphrase-multilingual-MiniLM-L12-v2` untuk embedding · Wikipedia API sebagai sumber data · Trafilatura + Playwright untuk scraping.

## Struktur

```
rag/
├── api.py                  # semua endpoint FastAPI
├── evaluate.py              # evaluasi kuantitatif
├── pipeline/
│   ├── scraper.py           # scrape biografi dari Wikipedia
│   ├── clean_data_v2.py      # cleaning hasil scraping
│   ├── chunker.py            # potong artikel jadi chunk
│   └── embed.py               # embed chunk ke ChromaDB
├── scripts/
│   ├── check_data.py          # statistik dataset
│   └── check_tokoh.py          # cek tokoh yang ke-index
├── frontend/                # UI (vanilla HTML/JS, dipakai sekarang)
├── web/                     # migrasi ke Next.js, belum jadi frontend utama
└── data/                    # dataset & vector store (gak di-push, lihat .gitignore)
```

## Menjalankan

Butuh Python 3.11.

```bash
py -3.11 -m venv venv311
venv311\Scripts\activate
pip install -r requirements.txt
```

Buat `.env` di root:
```
GROQ_API_KEY=your_groq_api_key_here
```
(gratis di https://console.groq.com/keys)

Pipeline data (kalau mau bangun ulang dari nol):
```bash
python pipeline/scraper.py --max 5000 --max_per_cat 500
python pipeline/clean_data_v2.py
python pipeline/chunker.py
python pipeline/embed.py
```

Jalankan API:
```bash
uvicorn api:app --reload --port 8099
```

Buka `frontend/index.html` di browser. Docs API otomatis ada di `http://localhost:8099/docs`.

## Endpoint

| Method | Endpoint | Fungsi |
|---|---|---|
| POST | `/cek-fakta` | Fact-check klaim teks (fitur utama) |
| POST | `/qa` | Tanya jawab bebas berbasis RAG |
| POST | `/qa-image` | Fact-check dari gambar |
| POST | `/scan-url` | Fact-check dari URL artikel |
| POST | `/cari` | Retrieval doang, tanpa LLM |
| GET | `/artikel` | List artikel yang ke-index |

Contoh:
```bash
curl -X POST http://localhost:8099/cek-fakta \
  -H "Content-Type: application/json" \
  -d '{"klaim": "Soekarno adalah presiden pertama Indonesia", "strategi": "cot"}'
```
