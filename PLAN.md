# BioFactChecker — Project Plan

Dokumen ini adalah rencana kerja keseluruhan proyek. Diperbarui seiring progres.

---

## Status Sekarang

- **Dataset:** 2.562 artikel Wikipedia (1.828 ID, 734 EN) — pakai ini dulu
- **Frontend:** Selesai — sidebar history, voice input, URL share, dark mode
- **Backend:** RAG berjalan — hybrid retrieval, 3 strategi prompt, verdict + confidence
- **Nilai estimasi sekarang:** ~55–60 / 100 (aspek 1–5 selesai, 6–10 belum)

---

## Fase 1 — Fitur Sistem (Prioritas Utama)

> Gunakan data yang sudah ada. Jangan tunggu scraper baru.

### 1A. Mode 2: Q&A / Chatbot RAG
**Tujuan:** Selain cek fakta (verdict), tambah mode tanya-jawab bebas berbasis RAG — output seperti Perplexity (jawaban paragraf + source cards).

**Input yang didukung (3 mode):**

#### Sub-mode A — Teks
- User ketik pertanyaan bebas
- Backend: RAG retrieval → LLM prompt "jawab pertanyaan ini berdasarkan konteks"
- Return: `{ answer, sources, confidence }`
- Biaya: normal (sama seperti fact-check sekarang)

#### Sub-mode B — Gambar / Screenshot
- User upload gambar (screenshot berita/tweet/WA)
- Backend: kirim image ke LLM vision API (Claude/OpenAI support base64 image)
  - Step 1: LLM vision → ekstrak teks/klaim dari gambar
  - Step 2: teks hasil ekstraksi → masuk pipeline RAG QA seperti biasa
- Return: `{ extracted_text, answer, sources }`
- Biaya: ~2–3x lipat karena image token (~1.500 token/gambar)
- Frontend: tombol upload + preview thumbnail gambar sebelum submit

#### Sub-mode C — URL Artikel
- User paste URL berita
- Backend:
  - Step 1: scrape dengan `trafilatura` (gratis, tidak pakai API)
  - Step 2: LLM → ekstrak 3–5 klaim faktual dari teks artikel
  - Step 3: per klaim → RAG fact-check seperti Mode 1
- Return: list `{ klaim, verdict, confidence, sources }` per klaim
- Frontend: URL input field, output tabel hasil per klaim (expandable)
- Biaya: sedang (1 LLM call untuk ekstraksi + N call untuk N klaim)

**Output semua sub-mode:**
- Jawaban teks + source cards (judul artikel Wikipedia + snippet)
- Mirip Perplexity — bukan verdict label, tapi narasi jawaban
- Simpan ke history sidebar dengan tag "QA" atau "SCAN"

**Backend endpoint:**
```
POST /qa          → sub-mode A (text)
POST /qa-image    → sub-mode B (image, multipart/form-data)
POST /scan-url    → sub-mode C (url)
```

**Frontend:**
- [ ] Toggle di welcome: **Cek Fakta** | **Tanya Jawab**
- [ ] Di mode Tanya Jawab: 3 tab input — Teks / Gambar / URL
- [ ] Answer card: teks paragraf + inline source cards
- [ ] Image preview sebelum submit
- [ ] History tag: "CEK" vs "QA" vs "SCAN"

---

## Fase 2 — Evaluasi (Wajib untuk Nilai)

> Ini yang paling ngaruh ke rubrik: aspek 6, 7, 9 = 25 poin
> ⚠️ **Dikerjakan nanti setelah sistem selesai.**

### Metrik Evaluasi per Mode

#### Mode Fact-Check (label classification)
Lebih mudah — output sistem adalah label diskrit, jadi tinggal bandingkan dengan ground truth.

| Metrik | Cara Hitung | Keterangan |
|--------|-------------|------------|
| **Accuracy** | (prediksi benar) / total | Overall correctness |
| **Precision** | TP / (TP + FP) per kelas | Seberapa sering verdict benar kalau sistem bilang X |
| **Recall** | TP / (TP + FN) per kelas | Seberapa sering kelas X tertangkap |
| **F1 Macro** | rata-rata F1 per kelas | Ukuran utama untuk kelas tidak seimbang |
| **Retrieval Recall@k** | chunk relevan yang masuk top-k / total chunk relevan | Kualitas retrieval terpisah dari LLM |

#### Mode QA (free-text answer)
Lebih sulit — output adalah teks bebas, tidak ada label pasti.

| Metrik | Cara Hitung | Keterangan |
|--------|-------------|------------|
| **ROUGE-1/2/L** | n-gram overlap dengan referensi jawaban | Standar NLP untuk teks generatif |
| **BERTScore** | cosine similarity embedding jawaban vs referensi | Lebih semantik dari ROUGE |
| **Faithfulness** | apakah jawaban bisa didukung oleh chunk yang diambil? | Anti-hallucination metric |
| **Answer Relevance** | apakah jawaban menjawab pertanyaannya? | Bisa pakai LLM-as-judge |
| **Context Recall** | apakah chunk yang relevan berhasil diambil? | Sama seperti Retrieval Recall@k |

> Faithfulness & Answer Relevance bisa dievaluasi manual (kualitatif) atau pakai framework **RAGAS** yang otomatis via LLM.

---

### 2A. Evaluasi Kuantitatif (Aspek 6 — 10 poin)
- [ ] Buat **labeled test set** — minimal 50 klaim dengan ground truth
  - Format: `{ klaim, expected_verdict }` → JSON atau CSV
  - Contoh label: `DIDUKUNG`, `DIBANTAH`, `TIDAK CUKUP`
  - Sumber: buat manual berdasarkan data Wikipedia yang sudah ada
- [ ] Script `scripts/evaluate.py`:
  - Jalankan setiap klaim ke API
  - Hitung: Accuracy, F1 (macro), Precision, Recall per kelas
  - Hitung: Retrieval Recall@k
  - Output: tabel hasil + confusion matrix (opsional)
- [ ] Jalankan untuk **3 strategi** (CoT, Structured, Zero-Shot) → tabel perbandingan

### 2B. Evaluasi Kualitatif (Aspek 7 — 10 poin)
- [ ] Pilih **15–20 kasus** dari test set (campuran benar/salah/edge case)
- [ ] Analisis manual per kasus:
  - Apakah chunk yang diambil relevan?
  - Ada hallucination? (LLM menyebut fakta yang tidak ada di chunk)
  - Koherensi penjelasan
  - Apakah verdict masuk akal?
- [ ] Dokumentasikan dalam tabel + narasi singkat per temuan

### 2C. Perbandingan Strategi Prompt (Aspek 9 — 5 poin)
- [ ] Tabel ringkasan: CoT vs Structured vs Zero-Shot
  - Kolom: Accuracy, F1, Avg latency, kelebihan, kelemahan
- [ ] Analisis: kapan CoT unggul? kapan Zero-Shot cukup?

---

## Fase 3 — Analisis Etika & Bias (Aspek 8 — 10 poin)

- [ ] **Bias dataset:** tokoh apa yang overrepresented? (mayoritas politikus pria?)
- [ ] **Risiko misuse:** bisa dipakai untuk menyerang reputasi orang → mitigasi apa?
- [ ] **Data privacy:** artikel Wikipedia publik, tapi ada tokoh hidup → apa implikasinya?
- [ ] **Fairness:** sistem lebih akurat untuk tokoh dengan artikel panjang?
- [ ] **Mitigasi:** saran konkret per risiko yang diidentifikasi

---

## Fase 4 — Dokumentasi & Laporan (Aspek 10 — 5 poin)

- [ ] Perbarui README dengan arsitektur terbaru
- [ ] Laporan sistematis yang cover 10 aspek rubrik:
  - Bisa format Markdown atau PDF
  - Sertakan diagram arsitektur pipeline
  - Sertakan tabel hasil evaluasi
  - Sertakan contoh output (screenshot / teks)

---

## Fase 5 — Ekspansi Dataset (NANTI — Setelah Sistem Selesai)

> ⚠️ **BELUM DIKERJAKAN.** Scraper belum diubah. Gunakan data yang ada dulu.

### Yang perlu dilakukan nanti:

**`pipeline/scraper.py` — Tambah ID_CATEGORIES:**
```python
# Anggota legislatif & eksekutif
"Kategori:Anggota DPR-RI",
"Kategori:Menteri Indonesia",
"Kategori:Bupati dan wali kota di Indonesia",
"Kategori:Ketua partai politik Indonesia",

# Tokoh bidang lain
"Kategori:Tokoh hukum Indonesia",
"Kategori:Ekonom Indonesia",
"Kategori:Jenderal TNI",
"Kategori:Tokoh pers Indonesia",
"Kategori:Tokoh Islam Indonesia",

# Peristiwa & institusi (jika scope diperluas)
"Kategori:Peristiwa sejarah Indonesia",
"Kategori:Partai politik di Indonesia",
"Kategori:Lembaga pemerintah Indonesia",
```

**`pipeline/clean_data_v2.py` — Relaksasi filter:**
- Filter `_is_biography()` terlalu ketat untuk artikel pendek Bahasa Indonesia
- Pertimbangkan: loloskan artikel dengan `total_chars > 800` tanpa syarat bio pattern

**Target dataset setelah ekspansi:** ~5.000–8.000 artikel ID

---

---

## Ide Agak Gila Tio (Belum Direncanakan — Brainstorm Saja)

> Jangan dikerjakan sekarang. Ini ide yang mungkin terlalu ambisius tapi menarik.

- **Scan URL Berita** — user paste link artikel berita → sistem scrape teks → ekstrak klaim otomatis via LLM → batch RAG fact-check per klaim → tampilkan laporan hoax/faktual per klaim. Berguna banget secara use case nyata.
- **Input Gambar / Screenshot** — user upload foto screenshot tweet/WA/berita → OCR atau vision LLM ekstrak teks → masuk ke pipeline fact-check seperti biasa. Cocok untuk cek konten viral.
- **Highlight & Check** — ekstensi browser atau bookmarklet: select teks di halaman mana saja → klik → langsung masuk ke sistem
- **RAG atas RAG** — sistem bisa membandingkan 2 klaim yang bertentangan dan kasih analisis mana yang lebih didukung data

---

## Urutan Pengerjaan yang Disarankan

```
[Minggu ini]
1. Mode 2 QA (backend + frontend)          ← fitur, 1–2 hari
2. Labeled test set (50 klaim)             ← data, bisa sambil jalan
3. Script evaluate.py                      ← evaluasi kuantitatif

[Setelahnya]
4. URL article scanner                     ← fitur tambahan
5. Analisis kualitatif (manual 15 kasus)
6. Analisis etika & bias
7. Laporan sistematis

[Paling akhir]
8. Ekspansi dataset (scraper baru)
```

---

## Checklist Nilai

| No | Aspek | Poin | Status |
|----|-------|------|--------|
| 1 | Perumusan Masalah | 10 | ✅ Selesai |
| 2 | Desain Arsitektur | 15 | ✅ Selesai |
| 3 | Implementasi LLM | 10 | ✅ Selesai |
| 4 | Prompt Engineering | 10 | ✅ Selesai (perlu dok. eksperimen) |
| 5 | Implementasi RAG | 15 | ✅ Selesai |
| 6 | Evaluasi Kuantitatif | 10 | ⬜ Belum |
| 7 | Evaluasi Kualitatif | 10 | ⬜ Belum |
| 8 | Etika, Bias & Safety | 10 | ⬜ Belum |
| 9 | Analisis & Diskusi | 5 | ⬜ Belum |
| 10 | Kualitas & Dokumentasi | 5 | ⬜ Partial |
| | **Total** | **100** | **~55–60 sekarang** |
