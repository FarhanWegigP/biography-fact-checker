"""
Biography Fact Checker - API
-----------------------------
Jalanin:
  uvicorn api:app --reload --port 8000
"""

import os
import json
import time
import re
import torch
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from sentence_transformers import SentenceTransformer
import chromadb
from groq import Groq

load_dotenv()

# ─────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────
CHROMA_DIR  = "data/chroma"
COLLECTION  = "biographies"
EMBED_MODEL = "paraphrase-multilingual-MiniLM-L12-v2"
GROQ_MODEL  = "llama-3.3-70b-versatile"
TOP_K       = 5
MIN_SCORE   = 0.25  # threshold minimum similarity — di bawah ini dianggap tidak relevan

# ─────────────────────────────────────────────
# Init
# ─────────────────────────────────────────────
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Loading embedding model di {device.upper()}...")
model = SentenceTransformer(EMBED_MODEL, device=device)

print("Connecting to ChromaDB...")
client     = chromadb.PersistentClient(path=CHROMA_DIR)
collection = client.get_collection(name=COLLECTION)
print(f"ChromaDB ready — {collection.count()} chunks")

print("Init Groq client...")
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

app = FastAPI(title="Biography Fact Checker", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
# Models
# ─────────────────────────────────────────────
class FactCheckRequest(BaseModel):
    klaim: str
    top_k: int = TOP_K
    strategi: str = "cot"  # zero_shot | cot | structured

class SearchRequest(BaseModel):
    query: str
    top_k: int = 5

class EvidenceItem(BaseModel):
    teks: str
    judul: str
    seksi: str
    url: str
    bahasa: str
    skor: float

class FactCheckResponse(BaseModel):
    klaim: str
    verdict: str
    kepercayaan: float
    penjelasan: str
    penalaran: str
    bukti: list[EvidenceItem]
    model: str
    waktu_retrieval_ms: float
    waktu_llm_ms: float

# ─────────────────────────────────────────────
# Prompts
# ─────────────────────────────────────────────
SYSTEM_PROMPT = """Kamu adalah asisten pengecekan fakta yang teliti untuk informasi biografi tokoh.
Tugasmu adalah memverifikasi klaim menggunakan HANYA bukti yang diberikan. JANGAN gunakan pengetahuan sebelumnya.
Selalu jawab dalam Bahasa Indonesia.

Pilihan verdict:
- DIDUKUNG: Bukti dengan jelas mendukung klaim
- DIBANTAH: Bukti dengan jelas membantah klaim
- INFO_TIDAK_CUKUP: Bukti tidak cukup untuk memverifikasi klaim"""

def build_prompt(klaim: str, evidence: list[dict], strategi: str) -> str:
    ev_block = "\n\n".join(
        f"[Bukti {i+1}] {e['title']} — {e['section']}\n{e['text']}"
        for i, e in enumerate(evidence)
    )

    if strategi == "zero_shot":
        return f"""KLAIM: {klaim}

BUKTI:
{ev_block}

Berdasarkan bukti di atas, apakah klaim DIDUKUNG, DIBANTAH, atau INFO_TIDAK_CUKUP?

Jawab dalam format ini:
VERDICT: <DIDUKUNG|DIBANTAH|INFO_TIDAK_CUKUP>
KEPERCAYAAN: <0.0-1.0>
PENJELASAN: <penjelasan singkat dalam Bahasa Indonesia>"""

    elif strategi == "structured":
        return f"""KLAIM: {klaim}

BUKTI:
{ev_block}

Jawab HANYA dengan JSON berikut (tanpa markdown):
{{"verdict": "DIDUKUNG|DIBANTAH|INFO_TIDAK_CUKUP", "kepercayaan": 0.0, "penjelasan": "...", "penalaran": "..."}}"""

    else:  # cot (default)
        return f"""KLAIM: "{klaim}"

BUKTI:
{ev_block}

Pikirkan langkah demi langkah dalam Bahasa Indonesia:
Langkah 1 - Identifikasi fakta-fakta kunci dalam klaim (nama, tanggal, peran, peristiwa, dll)
Langkah 2 - Cocokkan setiap fakta dengan bukti yang tersedia
Langkah 3 - Tentukan apakah bukti mendukung, membantah, atau tidak cukup untuk setiap fakta
Langkah 4 - Ambil kesimpulan keseluruhan

PENALARAN:
[analisis langkah demi langkah dalam Bahasa Indonesia]

VERDICT: <DIDUKUNG|DIBANTAH|INFO_TIDAK_CUKUP>
KEPERCAYAAN: <0.0-1.0>
PENJELASAN: <ringkasan 1-2 kalimat dalam Bahasa Indonesia>"""

# ─────────────────────────────────────────────
# Parser
# ─────────────────────────────────────────────
VALID_VERDICTS = {"DIDUKUNG", "DIBANTAH", "INFO_TIDAK_CUKUP"}

def parse_response(text: str, strategi: str) -> dict:
    if strategi == "structured":
        try:
            clean = re.sub(r"```(?:json)?", "", text).strip()
            data  = json.loads(clean)
            verdict = data.get("verdict", "INFO_TIDAK_CUKUP").upper()
            if verdict not in VALID_VERDICTS:
                verdict = "INFO_TIDAK_CUKUP"
            return {
                "verdict"   : verdict,
                "kepercayaan": float(data.get("kepercayaan", 0.5)),
                "penjelasan": data.get("penjelasan", ""),
                "penalaran" : data.get("penalaran", ""),
            }
        except Exception:
            pass

    verdict_match = re.search(r"VERDICT:\s*(DIDUKUNG|DIBANTAH|INFO_TIDAK_CUKUP)", text, re.IGNORECASE)
    conf_match    = re.search(r"KEPERCAYAAN:\s*([0-9.]+)", text)
    exp_match     = re.search(r"PENJELASAN:\s*(.+?)(?=\n[A-Z]|$)", text, re.DOTALL)
    reason_match  = re.search(r"PENALARAN:\s*(.+?)(?=VERDICT:)", text, re.DOTALL)

    verdict = verdict_match.group(1).upper() if verdict_match else "INFO_TIDAK_CUKUP"
    if verdict not in VALID_VERDICTS:
        verdict = "INFO_TIDAK_CUKUP"

    return {
        "verdict"    : verdict,
        "kepercayaan": float(conf_match.group(1)) if conf_match else 0.5,
        "penjelasan" : exp_match.group(1).strip() if exp_match else "",
        "penalaran"  : reason_match.group(1).strip() if reason_match else "",
    }

# ─────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────
@app.get("/")
def root():
    return {
        "status" : "ok",
        "pesan"  : "API Biography Fact Checker siap digunakan",
        "chunks" : collection.count(),
        "device" : device.upper(),
    }


@app.get("/artikel")
def list_artikel():
    result = collection.get(include=["metadatas"])
    seen   = {}
    for meta in result["metadatas"]:
        t = meta["title"]
        if t not in seen:
            seen[t] = {
                "judul"  : t,
                "url"    : meta["url"],
                "bahasa" : meta["lang"],
            }
    return list(seen.values())


@app.post("/cek-fakta", response_model=FactCheckResponse)
def cek_fakta(req: FactCheckRequest):
    if collection.count() == 0:
        raise HTTPException(400, "ChromaDB kosong")

    # Embed klaim pakai GPU
    t0        = time.perf_counter()
    query_vec = model.encode(
        [req.klaim],
        normalize_embeddings=True,
        device=device,
    ).tolist()

    result = collection.query(
        query_embeddings=query_vec,
        n_results=req.top_k,
        include=["documents", "metadatas", "distances"],
    )
    retrieval_ms = (time.perf_counter() - t0) * 1000

    docs      = result["documents"][0]
    metas     = result["metadatas"][0]
    distances = result["distances"][0]

    evidence = []
    for doc, meta, dist in zip(docs, metas, distances):
        score = 1 - (dist / 2)
        if score < MIN_SCORE:
            continue  # skip evidence yang tidak relevan
        evidence.append({
            "text"   : doc,
            "title"  : meta["title"],
            "section": meta["section"],
            "url"    : meta["url"],
            "lang"   : meta["lang"],
            "score"  : round(score, 4),
        })

    if not evidence:
        return FactCheckResponse(
            klaim=req.klaim,
            verdict="INFO_TIDAK_CUKUP",
            kepercayaan=0.0,
            penjelasan="Tidak ada bukti relevan yang ditemukan dalam basis data.",
            penalaran="",
            bukti=[],
            model=GROQ_MODEL,
            waktu_retrieval_ms=round(retrieval_ms, 2),
            waktu_llm_ms=0.0,
        )

    # LLM
    prompt = build_prompt(req.klaim, evidence, req.strategi)
    t1     = time.perf_counter()
    resp   = groq_client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user",   "content": prompt},
        ],
        temperature=0.1,
        max_tokens=1024,
    )
    llm_ms = (time.perf_counter() - t1) * 1000
    raw    = resp.choices[0].message.content
    parsed = parse_response(raw, req.strategi)

    bukti_items = [
        EvidenceItem(
            teks   = e["text"],
            judul  = e["title"],
            seksi  = e["section"],
            url    = e["url"],
            bahasa = e["lang"],
            skor   = e["score"],
        )
        for e in evidence
    ]

    return FactCheckResponse(
        klaim             = req.klaim,
        verdict           = parsed["verdict"],
        kepercayaan       = parsed["kepercayaan"],
        penjelasan        = parsed["penjelasan"],
        penalaran         = parsed["penalaran"],
        bukti             = bukti_items,
        model             = GROQ_MODEL,
        waktu_retrieval_ms= round(retrieval_ms, 2),
        waktu_llm_ms      = round(llm_ms, 2),
    )


@app.post("/cari")
def cari(req: SearchRequest):
    query_vec = model.encode(
        [req.query],
        normalize_embeddings=True,
        device=device,
    ).tolist()
    result = collection.query(
        query_embeddings=query_vec,
        n_results=req.top_k,
        include=["documents", "metadatas", "distances"],
    )
    hits = []
    for doc, meta, dist in zip(
        result["documents"][0],
        result["metadatas"][0],
        result["distances"][0],
    ):
        score = round(1 - dist / 2, 4)
        if score < MIN_SCORE:
            continue
        hits.append({
            "teks" : doc,
            "judul": meta["title"],
            "skor" : score,
        })
    return hits


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8001, reload=True)