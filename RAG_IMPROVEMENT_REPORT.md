# Laporan Perubahan Arsitektur dan Pipeline RAG

Dokumen ini menjelaskan perbedaan sistem RAG sebelum dan sesudah improvement, khususnya pada bagian retrieval, alias/entity resolution, embedding, reranking, dan tampilan bukti di frontend.

## Ringkasan

Sebelum improvement, sistem menggunakan semantic vector search langsung terhadap seluruh chunk. Klaim user di-embed apa adanya, lalu ChromaDB mengambil top-k chunk paling mirip secara semantik. Masalahnya, untuk fact-checking biografi, nama tokoh harus menjadi prioritas utama. Tanpa penguncian tokoh, query seperti `apakah jokowi lahir 17 agustus 1945?` bisa mengambil chunk tokoh lain yang sama-sama membahas tanggal lahir.

Sesudah improvement, pipeline diubah menjadi entity-first hybrid RAG. Sistem terlebih dahulu mencoba mendeteksi tokoh atau alias dari klaim, lalu retrieval difokuskan ke artikel tokoh tersebut. Setelah itu, bukti dipilih dengan gabungan vector search, lexical search, alias matching, dan reranking.

## Arsitektur Sebelum Improvement

```text
Klaim User
    |
    v
Embedding klaim langsung
    |
    v
Vector Search ke semua chunk ChromaDB
    |
    v
Ambil Top-K berdasarkan similarity
    |
    v
Filter MIN_SCORE
    |
    v
Kirim bukti ke LLM
    |
    v
Verdict: DIDUKUNG / DIBANTAH / INFO_TIDAK_CUKUP
```

### Karakteristik Sebelum

- Retrieval hanya berbasis vector similarity.
- Tidak ada deteksi tokoh sebelum pencarian.
- Tidak ada alias resolver, kecuali nama persis yang kebetulan cocok di embedding.
- Metadata seperti `title` dan `section` tidak ikut di-embed.
- Semua chunk dari semua tokoh bersaing dalam satu ruang retrieval.
- Frontend hanya menampilkan satu bukti teratas.
- ChromaDB bisa stale karena `embed.py` hanya skip ID yang sudah ada, walaupun isi chunk berubah.

### Dampak Masalah

Contoh klaim:

```text
apakah jokowi lahir 17 agustus 1945?
```

Sebelumnya, sistem mengambil bukti dari tokoh lain seperti `Harijadi Sumodidjojo`, karena chunk tersebut kuat secara semantik pada pola:

```text
lahir + tanggal
```

Akibatnya LLM tidak menerima bukti yang benar tentang Joko Widodo. LLM lalu menjawab `INFO_TIDAK_CUKUP`, bukan `DIBANTAH`.

## Arsitektur Sesudah Improvement

```text
Klaim User
    |
    v
Normalisasi teks dan tokenisasi
    |
    v
Entity / Title / Alias Resolution
    |
    +-- Jika tokoh terdeteksi:
    |       v
    |   Retrieval dikunci ke artikel tokoh tersebut
    |
    +-- Jika tokoh tidak terdeteksi:
            v
        Retrieval fallback ke semua chunk

    |
    v
Hybrid Retrieval
    |
    +-- Vector Search
    +-- Lexical Search
    +-- Subject-specific evidence search
    |
    v
Reranking evidence
    |
    v
Filter bukti paling relevan
    |
    v
Kirim bukti ke LLM
    |
    v
Verdict: DIDUKUNG / DIBANTAH / INFO_TIDAK_CUKUP
```

## Pipeline Sesudah Improvement

### 1. Query Understanding

Klaim user dinormalisasi:

- lowercase,
- hilangkan tanda baca,
- hilangkan aksen/diakritik,
- tokenisasi kata penting,
- stopword filtering.

Contoh:

```text
apakah jokowi lahir 17 agustus 1945?
```

Menjadi token penting seperti:

```text
jokowi, 17, agustus, 1945
```

### 2. Entity-First Resolution

Sistem mencoba menentukan artikel tokoh yang dimaksud sebelum retrieval.

Sumber resolver:

- alias manual,
- judul artikel,
- nama pendek unik,
- inisial,
- frasa dari summary seperti `lebih dikenal sebagai ...` atau `known as ...`.

Contoh alias manual:

```python
"jokowi" -> "Joko Widodo"
"sby" -> "Susilo Bambang Yudhoyono"
"ahok" -> "Basuki Tjahaja Purnama"
"bung karno" -> "Soekarno"
"bung hatta" -> "Mohammad Hatta"
```

Alias otomatis dibangun dari dataset ChromaDB saat runtime. Pada salah satu pengujian, sistem membangun sekitar:

```text
6375 aliases
29068 docs/chunks
```

### 3. Article-Scoped Retrieval

Jika tokoh berhasil dideteksi, ChromaDB tidak lagi mencari ke seluruh dataset.

Sebelumnya:

```text
query -> semua chunk semua tokoh
```

Sesudah:

```text
query -> chunk milik artikel tokoh yang terdeteksi
```

Contoh:

```text
jokowi -> Joko Widodo
```

Maka retrieval difokuskan ke artikel `Joko Widodo`.

### 4. Hybrid Retrieval

Retrieval sekarang menggunakan gabungan beberapa sinyal.

#### Vector Search

Tetap menggunakan embedding model:

```text
paraphrase-multilingual-MiniLM-L12-v2
```

Vector search berguna untuk menangkap kemiripan semantik.

#### Lexical Search

Sistem juga menghitung overlap token antara klaim dan dokumen. Ini membantu ketika vector search kurang sensitif terhadap nama, alias, tanggal, atau istilah eksplisit.

#### Subject-Specific Search

Untuk klaim tertentu, terutama klaim kelahiran, sistem mencari bukti yang benar-benar membahas kelahiran subjek.

Contoh:

```text
Joko Widodo ... lahir 21 Juni 1961
```

lebih diprioritaskan daripada kalimat lain yang hanya mengandung kata `lahir`.

### 5. Reranking Evidence

Evidence diberi skor ulang berdasarkan:

- vector score,
- token overlap,
- kecocokan judul tokoh,
- apakah berasal dari section `Summary`,
- apakah klaim adalah klaim kelahiran,
- apakah teks menyebut kelahiran subjek,
- apakah teks mengandung tanggal eksplisit,
- penalti untuk chunk terlalu pendek.

Untuk klaim kelahiran, evidence yang tidak membahas kelahiran subjek bisa dibuang jika sudah ada evidence kelahiran yang lebih tepat.

### 6. LLM sebagai Judge

LLM tetap digunakan di tahap akhir, bukan untuk retrieval awal.

Perannya:

- membaca klaim,
- membaca bukti yang sudah dipilih,
- menentukan verdict,
- memberi penjelasan.

LLM tidak lagi dipaksa memperbaiki retrieval yang salah. Ini penting karena LLM hanya boleh menggunakan bukti yang diberikan.

## Perubahan Embedding Pipeline

File yang berubah:

```text
pipeline/embed.py
```

### Sebelum

Embedding hanya memakai isi chunk:

```text
Teks chunk
```

Metadata seperti judul artikel dan section tidak ikut di-embed.

### Sesudah

Embedding memakai format:

```text
Judul: <title>
Bagian: <section>
Teks: <chunk text>
```

Dampaknya, nama tokoh dan konteks section ikut masuk ke embedding.

### Filter Chunk Noise

Sebelumnya, chunk sangat pendek tetap masuk ChromaDB, misalnya:

```text
FTV
Books
DWANGO
Catatan
```

Sesudah improvement, chunk pendek/noise difilter agar tidak merusak retrieval.

### Rebuild ChromaDB

Ditambahkan mode rebuild:

```powershell
python .\pipeline\embed.py --rebuild
```

Mode ini menghapus collection lama dan membangun ulang ChromaDB dari `data/chunks.json`.

## Perubahan Frontend

File yang berubah:

```text
frontend/app.js
```

### Sebelum

Frontend hanya menampilkan satu bukti teratas.

Masalah:

- sulit audit,
- jika top-1 salah, user mengira semua konteks salah,
- evidence lain yang mungkin relevan tidak terlihat.

### Sesudah

Frontend menampilkan semua bukti yang dikirim API.

Dampaknya:

- proses RAG lebih transparan,
- user bisa melihat beberapa evidence,
- lebih mudah mengevaluasi kualitas retrieval.

## Perbandingan Hasil

### Kasus Uji

```text
apakah jokowi lahir 17 agustus 1945?
```

### Sebelum

Retrieval mengambil bukti dari tokoh lain.

Hasil:

```text
INFO_TIDAK_CUKUP
```

Alasan:

```text
Bukti tidak menyebutkan informasi tentang Jokowi.
```

### Sesudah

Retrieval mengambil artikel `Joko Widodo`.

Bukti utama:

```text
Joko Widodo ... lahir 21 Juni 1961
```

Hasil:

```text
DIBANTAH
```

Penjelasan:

```text
Bukti menyatakan bahwa Joko Widodo lahir pada tanggal 21 Juni 1961,
bukan 17 Agustus 1945.
```

## Kelebihan Arsitektur Baru

- Lebih cocok untuk fact-checking biografi.
- Nama tokoh menjadi prioritas utama.
- Alias populer bisa dikenali.
- Retrieval tidak mudah tertipu oleh pola umum seperti `lahir + tanggal`.
- Evidence lebih relevan sebelum dikirim ke LLM.
- ChromaDB lebih bersih karena chunk noise difilter.
- Frontend lebih transparan.

## Batasan yang Masih Ada

Arsitektur sudah lebih kuat, tetapi kualitas tetap bergantung pada coverage dataset.

Contoh:

```text
apakah Bung Karno presiden pertama Indonesia?
```

Alias `Bung Karno` sudah ditambahkan, tetapi jika artikel utama `Soekarno` belum ada di dataset, sistem tetap tidak punya bukti utama yang cukup.

Artinya, improvement berikutnya yang penting adalah targeted data backfill untuk tokoh-tokoh penting yang belum ada.

## Rekomendasi Improvement Berikutnya

1. Tambahkan targeted scraper untuk tokoh penting:

```text
Soekarno
Mohammad Hatta
Soeharto
Abdurrahman Wahid
BJ Habibie
Sri Mulyani
tokoh lain yang sering diuji
```

2. Tambahkan endpoint debug retrieval.

Endpoint ini bisa menampilkan:

```text
detected entity
alias yang match
candidate titles
raw vector hits
lexical hits
final reranked evidence
```

3. Tambahkan evaluasi kuantitatif.

Contoh metrik:

```text
Recall@5
Precision@5
MRR
verdict accuracy
```

4. Tambahkan test set klaim biografi.

Minimal berisi klaim:

```text
tanggal lahir
tempat lahir
jabatan
pendidikan
keluarga
penghargaan
peristiwa sejarah
```

## Kesimpulan

Sebelum improvement, sistem adalah RAG semantic-search sederhana. Setelah improvement, sistem menjadi entity-first hybrid RAG yang lebih sesuai untuk pengecekan fakta biografi.

Perubahan paling penting adalah:

```text
dari: klaim -> vector search semua chunk -> LLM
menjadi: klaim -> entity resolution -> hybrid retrieval terarah -> reranking -> LLM
```

Dengan arsitektur baru, LLM menerima bukti yang jauh lebih relevan, sehingga verdict menjadi lebih akurat dan bisa dipertanggungjawabkan.
