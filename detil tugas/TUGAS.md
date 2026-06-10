# Tugas Besar NLP — Instrumen Penilaian TBP

## Deskripsi Tugas

Membuat **pipeline NLP** dengan memanfaatkan metode yang dipelajari di kelas:
- Large Language Models (LLM)
- Prompt Engineering
- Retrieval-Augmented Generation (RAG)
- Evaluasi model NLP secara kuantitatif dan kualitatif
- Analisis aspek etika, bias, dan safety dalam penggunaan NLP

**Use case yang dipilih:** ✅ Sistem Fact-Checking (BioFactChecker)

---

## Capaian Pembelajaran (CPMK)

| CPMK | Deskripsi |
|------|-----------|
| CPMK3 | Menggunakan LLM untuk menyelesaikan permasalahan NLP dengan prompt engineering, fine-tuning terbatas, dan RAG |
| CPMK4 | Mengevaluasi model NLP dan LLM menggunakan metrik kuantitatif dan kualitatif serta menganalisis aspek etika, bias, dan keamanan |
| CPMK5 | Mengembangkan dan mempresentasikan proyek NLP/LLM berbasis kasus nyata |

---

## Rubrik Penilaian (Total: 100)

| No | Aspek | Kriteria | Skor |
|----|-------|----------|------|
| 1 | **Perumusan Masalah & Use Case** | Menjelaskan latar belakang, tujuan sistem, dan batasan masalah sesuai use case | 10 |
| 2 | **Desain Arsitektur Pipeline** | Menjelaskan alur sistem secara runtut (input → retrieval → LLM → output → evaluasi) disertai diagram/penjelasan teknis | 15 |
| 3 | **Implementasi LLM** | Menggunakan LLM secara tepat (API / open-source) serta menjelaskan konfigurasi yang digunakan | 10 |
| 4 | **Prompt Engineering** | Merancang prompt yang terstruktur (instruction, context, constraint) dan melakukan eksperimen/perbaikan prompt | 10 |
| 5 | **Implementasi RAG** | Mengimplementasikan RAG (embedding, vector database, retrieval strategy) dan menjelaskan mekanismenya | 15 |
| 6 | **Evaluasi Kuantitatif** | Menggunakan metrik evaluasi yang sesuai (Accuracy, F1, ROUGE, BLEU, Retrieval Recall, dsb.) | 10 |
| 7 | **Evaluasi Kualitatif** | Melakukan analisis kualitas output (relevansi, koherensi, factuality, hallucination) | 10 |
| 8 | **Analisis Etika, Bias & Safety** | Mengidentifikasi potensi bias, risiko misuse, data privacy, fairness, serta memberikan contoh dan mitigasi | 10 |
| 9 | **Analisis Hasil & Diskusi** | Membandingkan hasil eksperimen, menjelaskan kelebihan dan keterbatasan sistem | 5 |
| 10 | **Kualitas Implementasi & Dokumentasi** | Kode terstruktur, reproducible, dokumentasi jelas, serta laporan sistematis | 5 |

---

## Status Per Aspek

| No | Aspek | Status | Catatan |
|----|-------|--------|---------|
| 1 | Perumusan Masalah | ✅ Ada | Use case fact-checking biografi berbasis Wikipedia |
| 2 | Desain Arsitektur | ✅ Ada | Pipeline: input → hybrid retrieval → LLM → verdict + confidence |
| 3 | Implementasi LLM | ✅ Ada | API Claude/OpenAI, konfigurasi strategi (CoT, Structured, Zero-Shot) |
| 4 | Prompt Engineering | ✅ Ada | 3 strategi prompt, perlu dokumentasi eksperimen perbandingannya |
| 5 | Implementasi RAG | ✅ Ada | ChromaDB, embedding, hybrid entity matching, retrieval scoring |
| 6 | Evaluasi Kuantitatif | ⚠️ Perlu dikerjakan | Belum ada script evaluasi Accuracy/F1/Retrieval Recall |
| 7 | Evaluasi Kualitatif | ⚠️ Perlu dikerjakan | Belum ada analisis relevansi/hallucination secara sistematis |
| 8 | Etika, Bias & Safety | ⚠️ Perlu dikerjakan | Belum ada analisis bias dataset/output |
| 9 | Analisis Hasil & Diskusi | ⚠️ Perlu dikerjakan | Perlu perbandingan antar strategi prompt |
| 10 | Kualitas & Dokumentasi | ⚠️ Partial | README ada, perlu laporan sistematis |

---

## Dataset

- **2.562 artikel Wikipedia** (1.828 Bahasa Indonesia, 734 English)
- Mayoritas tokoh politik Indonesia (Prabowo, Megawati, Jokowi, SBY, dst.) + tokoh/konsep global
- Struktur: `title`, `url`, `lang`, `summary`, `sections` (bertingkat), `total_chars`, `total_sections`
- Disimpan di ChromaDB sebagai vector store

## Arsitektur Sistem

```
Input klaim
    ↓
Ekstraksi entitas + keyword
    ↓
Hybrid retrieval (semantic + entity matching) → ChromaDB
    ↓
Re-ranking & filtering by score threshold
    ↓
LLM inference (CoT / Structured / Zero-Shot)
    ↓
Output: verdict (DIDUKUNG / DIBANTAH / TIDAK CUKUP) + confidence + penjelasan
```

---

## Yang Perlu Dikerjakan untuk Nilai Penuh

1. **Evaluasi Kuantitatif** — buat labeled test set (misal 50 klaim dengan ground truth), hitung Accuracy, F1, Retrieval Recall
2. **Evaluasi Kualitatif** — analisis 10-20 output secara manual: relevansi chunk, ada/tidak hallucination, koherensi penjelasan
3. **Analisis Etika & Bias** — apakah dataset bias ke tokoh tertentu? risiko misuse (dipakai untuk menyerang reputasi orang)? privacy concerns?
4. **Laporan perbandingan prompt** — tabel hasil CoT vs Structured vs Zero-Shot di test set yang sama
5. **Laporan sistematis** — dokumen yang cover semua 10 aspek rubrik di atas
