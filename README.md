# Biography Fact Checker

Sistem pengecekan fakta berbasis RAG (Retrieval-Augmented Generation) untuk informasi biografi tokoh dari Wikipedia.

Dibangun untuk memenuhi Tugas Besar Pemrograman NLP — mencakup LLM, RAG, Prompt Engineering, Evaluasi Kuantitatif & Kualitatif, serta Analisis Etika.

---

## Arsitektur Sistem

```
Input (Klaim / Pertanyaan / Gambar / URL)
        ↓
[Embedding] → paraphrase-multilingual-MiniLM-L12-v2
        ↓
[Hybrid Retrieval] → ChromaDB (cosine similarity + entity matching)
        ↓
[Top-K Chunks] ← Wikipedia Biografi (EN + ID)
        ↓
[LLM Processing] → Groq Llama-3.3-70b / Llama-4 Scout (vision)
        ↓
Output: Verdict + Penjelasan + Source Cards
```

---

## Tech Stack

| Komponen | Teknologi |
|---|---|
| API Framework | FastAPI |
| LLM (text) | Groq `llama-3.3-70b-versatile` |
| LLM (vision) | Groq `meta-llama/llama-4-scout-17b-16e-instruct` |
| Embedding Model | `paraphrase-multilingual-MiniLM-L12-v2` |
| Vector Database | ChromaDB (local persistence) |
| Data Source | Wikipedia API (EN + ID) |
| Web Scraping | Trafilatura + Playwright |
| GPU Acceleration | PyTorch CUDA (opsional) |

---

## Struktur Folder

```
rag/
├── api.py                  # FastAPI — semua endpoint
├── requirements.txt
├── .env                    # API keys (tidak di-push)
├── frontend/
│   ├── index.html
│   ├── app.js
│   └── style.css
├── pipeline/
│   ├── scraper.py          # Scrape artikel biografi dari Wikipedia
│   ├── clean_data_v2.py    # Filter & cleaning hasil scraping
│   ├── chunker.py          # Potong artikel jadi chunks
│   └── embed.py            # Embed chunks → ChromaDB
├── scripts/
│   ├── check_data.py       # Statistik dataset
│   └── check_tokoh.py      # Cek tokoh di dataset
└── data/                   # Tidak di-push ke GitHub
    ├── raw_articles.json
    ├── clean_articles.json
    ├── chunks.json
    └── chroma/             # ChromaDB vector store
```

---

## Setup & Instalasi

### Prasyarat
- Python 3.11
- GPU NVIDIA (opsional)

### 1. Clone repo

```bash
git clone <repo-url>
cd rag
```

### 2. Buat virtual environment

```bash
py -3.11 -m venv venv311
venv311\Scripts\activate      # Windows
source venv311/bin/activate   # Mac/Linux
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

Install PyTorch dengan CUDA (GPU NVIDIA):
```bash
pip install torch --index-url https://download.pytorch.org/whl/cu124
```

Install PyTorch CPU-only:
```bash
pip install torch
```

### 4. Setup environment variables

Buat file `.env` di root project:
```
GROQ_API_KEY=your_groq_api_key_here
```

Dapatkan Groq API key gratis di: https://console.groq.com/keys

---

## Menjalankan Sistem

### Step 1 — Scrape data Wikipedia
```bash
python pipeline/scraper.py --max 5000 --max_per_cat 500
```

### Step 2 — Cleaning data
```bash
python pipeline/clean_data_v2.py
```

### Step 3 — Chunking
```bash
python pipeline/chunker.py
```

### Step 4 — Embedding ke ChromaDB
```bash
python pipeline/embed.py
```

### Step 5 — Jalankan API
```bash
uvicorn api:app --reload --port 8000
```

Buka frontend di browser: `frontend/index.html`  
API docs: http://localhost:8000/docs

---

## API Endpoints

| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | `/` | Health check |
| POST | `/cek-fakta` | Fact-checking klaim teks |
| POST | `/qa` | Tanya-jawab bebas berbasis RAG |
| POST | `/qa-image` | Fact-check dari gambar/screenshot |
| POST | `/scan-url` | Scan & fact-check artikel dari URL |
| POST | `/cari` | Retrieval saja (tanpa LLM) |
| GET | `/artikel` | List semua artikel yang ter-index |

### Contoh Request — Cek Fakta

```bash
curl -X POST http://localhost:8000/cek-fakta \
  -H "Content-Type: application/json" \
  -d '{"klaim": "Soekarno adalah presiden pertama Indonesia", "strategi": "cot"}'
```

### Contoh Request — Tanya Jawab

```bash
curl -X POST http://localhost:8000/qa \
  -H "Content-Type: application/json" \
  -d '{"pertanyaan": "Siapa pendiri Budi Utomo?"}'
```

### Strategi Prompt (untuk `/cek-fakta`)

| Strategi | Deskripsi |
|---|---|
| `zero_shot` | Langsung jawab tanpa reasoning |
| `cot` | Chain-of-Thought step-by-step (default) |
| `structured` | Output JSON terstruktur |

---

## Fitur Frontend

- Mode **Cek Fakta** dan **Tanya Jawab** (toggle)
- Input teks, upload gambar, atau paste URL artikel
- Source cards dengan snippet Wikipedia
- History sidebar dengan label per mode (CEK / QA / SCAN)
- Voice input
- URL share untuk berbagi hasil
- Dark mode

---

## Pipeline Detail

### Scraping
- Crawl dari 40+ kategori Wikipedia (EN + ID)
- Auto-resume jika koneksi putus (`--resume`)
- Checkpoint setiap 50 artikel

### Cleaning
- Hapus duplikat & section kosong
- Filter biografi: deteksi pola tanggal lahir & profesi

### Chunking
- Target: 600 karakter per chunk, overlap 80 karakter
- Hierarki split: paragraph → kalimat → character window

### Embedding
- Model multilingual 384-dim, support 50+ bahasa
- GPU accelerated (CUDA)
- Disimpan di ChromaDB dengan cosine similarity

### Retrieval
- Hybrid: semantic similarity + entity matching
- Top-K chunks dengan threshold minimum similarity

---

## Etika & Bias

- Dataset lebih berat ke tokoh Indonesia (ID: ~70%, EN: ~30%)
- Wikipedia memiliki bias representasi gender dan geografi
- LLM dapat menghasilkan halusinasi meski dengan RAG
- Sistem tidak boleh dijadikan satu-satunya sumber kebenaran
- Data Wikipedia bersifat publik, bebas digunakan untuk riset
