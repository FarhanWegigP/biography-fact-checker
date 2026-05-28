# 🔍 Biography Fact Checker

Sistem pengecekan fakta berbasis RAG (Retrieval-Augmented Generation) untuk informasi biografi tokoh dari Wikipedia.

Dibangun untuk memenuhi Tugas Besar Pemrograman NLP — mencakup LLM, RAG, Prompt Engineering, Evaluasi Kuantitatif & Kualitatif, serta Analisis Etika.

---

## 🏗️ Arsitektur Sistem

```
Input Klaim (Bahasa Indonesia)
        ↓
[Embedding] → paraphrase-multilingual-MiniLM-L12-v2
        ↓
[Retrieval] → ChromaDB (cosine similarity)
        ↓
[Top-K Chunks] ← Wikipedia Biografi (EN + ID)
        ↓
[LLM Fact-Check] → Groq Llama-3.3-70b (+ Prompt Engineering)
        ↓
Output: DIDUKUNG / DIBANTAH / INFO_TIDAK_CUKUP + Penjelasan
```

---

## 🛠️ Tech Stack

| Komponen | Teknologi |
|---|---|
| API Framework | FastAPI |
| LLM | Groq Llama-3.3-70b-versatile (gratis) |
| Embedding Model | `paraphrase-multilingual-MiniLM-L12-v2` |
| Vector Database | ChromaDB (local persistence) |
| Data Source | Wikipedia API (EN + ID) |
| GPU Acceleration | PyTorch CUDA (opsional) |

---

## 📁 Struktur Folder

```
RAG/
├── scraper.py          # Scrape artikel biografi dari Wikipedia by kategori
├── clean_data_v2.py    # Filter & cleaning data hasil scraping
├── chunker.py          # Potong artikel jadi chunks ~600 karakter
├── embed.py            # Embed chunks + simpan ke ChromaDB (GPU support)
├── api.py              # FastAPI — endpoint utama fact-checking
├── check_data.py       # Cek statistik dataset
├── check_tokoh.py      # Cek tokoh mana yang ada di dataset
├── .env.example        # Template environment variables
├── .gitignore
├── README.md
└── data/               # (tidak di-push ke GitHub)
    ├── raw_articles.json     # Hasil scraping mentah
    ├── clean_articles.json   # Setelah cleaning
    ├── chunks.json           # Setelah chunking
    └── chroma/               # ChromaDB vector store
```

---

## ⚙️ Setup & Instalasi

### Prasyarat
- Python 3.11 (bukan 3.14 — PyTorch belum support)
- GPU NVIDIA (opsional, tapi sangat disarankan)

### 1. Clone repo

```bash
git clone https://github.com/USERNAME/REPO_NAME.git
cd REPO_NAME
```

### 2. Buat virtual environment

```bash
py -3.11 -m venv venv311
venv311\Scripts\activate      # Windows
source venv311/bin/activate   # Mac/Linux
```

### 3. Install dependencies

```bash
pip install wikipedia-api sentence-transformers chromadb groq fastapi uvicorn python-dotenv tqdm
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

```bash
cp .env.example .env
# Isi GROQ_API_KEY di file .env
```

Dapatkan Groq API key gratis di: https://console.groq.com/keys

---

## 🚀 Menjalankan Sistem

### Step 1 — Scrape data Wikipedia
```bash
python scraper.py --max 5000 --max_per_cat 500
```

### Step 2 — Cleaning data
```bash
python clean_data_v2.py
```

### Step 3 — Chunking
```bash
python chunker.py
```

### Step 4 — Embedding ke ChromaDB
```bash
python embed.py
```

### Step 5 — Jalankan API
```bash
uvicorn api:app --reload --port 8000
```

API docs: http://localhost:8000/docs

---

## 🔌 API Endpoints

| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | `/` | Health check |
| POST | `/cek-fakta` | **Endpoint utama fact-checking** |
| POST | `/cari` | Retrieval saja (tanpa LLM) |
| GET | `/artikel` | List semua artikel yang ter-index |

### Contoh Request

```bash
curl -X POST http://localhost:8000/cek-fakta \
  -H "Content-Type: application/json" \
  -d '{
    "klaim": "Soekarno adalah presiden pertama Indonesia",
    "strategi": "cot"
  }'
```

### Strategi Prompt

| Strategi | Deskripsi |
|---|---|
| `zero_shot` | Langsung jawab tanpa reasoning |
| `cot` | Chain-of-Thought step-by-step (recommended) |
| `structured` | Output JSON terstruktur |

---

## 📊 Pipeline Detail

### Scraping
- Crawl dari 40+ kategori Wikipedia (EN + ID)
- Auto-resume kalau koneksi putus (`--resume`)
- Checkpoint setiap 50 artikel

### Cleaning
- Hapus duplikat & sections kosong
- Filter ketat biografi: deteksi pola tanggal lahir & profesi

### Chunking
- Target: 600 karakter per chunk, overlap 80 karakter
- Hierarki split: paragraph → kalimat → character window

### Embedding
- Model multilingual 384-dim, support 50+ bahasa
- GPU accelerated (CUDA)
- Disimpan di ChromaDB dengan cosine similarity

---

## ⚠️ Catatan Etika & Bias

- Dataset lebih berat ke tokoh Indonesia (ID: ~70%, EN: ~30%)
- Wikipedia memiliki bias representasi gender dan geografi
- LLM bisa menghasilkan halusinasi meski dengan RAG
- Sistem tidak boleh dijadikan satu-satunya sumber kebenaran
- Data Wikipedia bersifat publik, bebas digunakan untuk riset

---
