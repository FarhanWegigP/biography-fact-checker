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
import base64
import asyncio
import unicodedata
import torch
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from sentence_transformers import SentenceTransformer
import chromadb
from groq import Groq

try:
    from playwright.async_api import async_playwright
    PLAYWRIGHT_AVAILABLE = True
except ImportError:
    PLAYWRIGHT_AVAILABLE = False

try:
    import trafilatura
    TRAFILATURA_AVAILABLE = True
except ImportError:
    TRAFILATURA_AVAILABLE = False

load_dotenv()

# ─────────────────────────────────────────────
# Config
# ─────────────────────────────────────────────
CHROMA_DIR  = "data/chroma"
COLLECTION  = "biographies"
EMBED_MODEL = "paraphrase-multilingual-MiniLM-L12-v2"
GROQ_MODEL        = "llama-3.3-70b-versatile"
GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"
TOP_K       = 5
MIN_SCORE   = 0.25  # threshold minimum similarity — di bawah ini dianggap tidak relevan
RETRIEVAL_POOL = 50

STOPWORDS = {
    "apakah", "apa", "siapa", "kapan", "dimana", "di", "ke", "dari", "dan",
    "atau", "yang", "adalah", "merupakan", "seorang", "lahir", "tanggal",
    "pada", "tahun", "bulan", "hari", "benar", "bener", "tidak", "bukan",
    "itu", "ini", "dia", "ia", "dengan", "sebagai", "dalam",
}

ALIASES = {
    "jokowi": "Joko Widodo",
    "sby": "Susilo Bambang Yudhoyono",
    "ahok": "Basuki Tjahaja Purnama",
    "anies": "Anies Baswedan",
    "prabowo": "Prabowo Subianto",
    "megawati": "Megawati Soekarnoputri",
    "bung karno": "Soekarno",
    "karno": "Soekarno",
    "sukarno": "Soekarno",
    "bung hatta": "Mohammad Hatta",
    "hatta": "Mohammad Hatta",
}

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

print("Building article title index...")
_article_meta = collection.get(include=["metadatas"])
ARTICLE_INDEX = {}
for meta in _article_meta["metadatas"]:
    title = meta["title"]
    if title not in ARTICLE_INDEX:
        ARTICLE_INDEX[title] = {
            "title": title,
            "url": meta["url"],
            "lang": meta["lang"],
        }
print(f"Article index ready — {len(ARTICLE_INDEX)} titles")

DOC_INDEX = None
ALIAS_INDEX = {}
TITLE_ALIASES = {}

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

class QARequest(BaseModel):
    pertanyaan: str
    top_k: int = TOP_K

class SourceItem(BaseModel):
    judul: str
    seksi: str
    url: str
    bahasa: str
    skor: float
    kutipan: str

class QAResponse(BaseModel):
    pertanyaan: str
    jawaban: str
    sumber: list[SourceItem]
    model: str
    waktu_retrieval_ms: float
    waktu_llm_ms: float

class KlaimResult(BaseModel):
    klaim: str
    verdict: str
    kepercayaan: float
    penjelasan: str
    bukti: list[EvidenceItem]

class ScanURLRequest(BaseModel):
    url: str
    strategi: str = "cot"

class ScanURLResponse(BaseModel):
    url: str
    judul_artikel: str
    ringkasan_artikel: str
    klaim_ditemukan: list[str]
    hasil: list[KlaimResult]
    waktu_total_ms: float

class ImageScanResponse(BaseModel):
    teks_diekstrak: str
    klaim_ditemukan: list[str]
    hasil: list[KlaimResult]
    waktu_total_ms: float

# ─────────────────────────────────────────────
# Prompts
# ─────────────────────────────────────────────
QA_SYSTEM_PROMPT = """Kamu adalah asisten tanya-jawab yang ahli tentang tokoh, sejarah, dan politik Indonesia.
Gunakan HANYA informasi dari konteks yang diberikan. Jika informasi tidak tersedia di konteks, nyatakan secara eksplisit bahwa kamu tidak memiliki informasi tersebut.
Jawab dalam Bahasa Indonesia secara informatif. Jika relevan, sertakan referensi sumber dengan format [1], [2], dst."""

EXTRACT_CLAIMS_SYSTEM = """Kamu adalah asisten ekstraksi fakta. Tugasmu mengidentifikasi klaim faktual spesifik yang dapat diverifikasi dari sebuah teks."""

SYSTEM_PROMPT = """Kamu adalah asisten pengecekan fakta yang teliti untuk informasi biografi tokoh.
Tugasmu adalah memverifikasi klaim menggunakan HANYA bukti yang diberikan. JANGAN gunakan pengetahuan sebelumnya.
Selalu jawab dalam Bahasa Indonesia.

Pilihan verdict:
- DIDUKUNG: Bukti dengan jelas mendukung klaim
- DIBANTAH: Bukti dengan jelas membantah klaim
- INFO_TIDAK_CUKUP: Bukti tidak cukup untuk memverifikasi klaim"""

def build_qa_prompt(pertanyaan: str, evidence: list[dict]) -> str:
    ev_block = "\n\n".join(
        f"[{i+1}] {e['title']} — {e['section']}\n{e['text']}"
        for i, e in enumerate(evidence)
    )
    return f"""PERTANYAAN: {pertanyaan}

KONTEKS:
{ev_block}

Berikan jawaban komprehensif berdasarkan konteks di atas. Sertakan fakta-fakta penting dan sebutkan sumbernya dengan [1], [2], dst. jika perlu."""


def build_extract_claims_prompt(teks: str) -> str:
    return f"""Dari teks berikut, ekstrak 3-5 klaim faktual yang paling spesifik dan dapat diverifikasi.
Fokus pada: nama orang/jabatan, tanggal/tahun, lokasi, angka, peristiwa spesifik.
Setiap klaim harus berdiri sendiri tanpa konteks tambahan.

TEKS:
{teks[:3000]}

Jawab HANYA dengan JSON array tanpa penjelasan lain:
["klaim 1", "klaim 2", "klaim 3"]"""


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

def normalize_text(text: str) -> str:
    text = unicodedata.normalize("NFKD", text)
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s]", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def title_base(title: str) -> str:
    return re.sub(r"\s*\([^)]*\)\s*$", "", title).strip()


def tokenize(text: str) -> set[str]:
    return {
        token for token in normalize_text(text).split()
        if len(token) > 2 and token not in STOPWORDS
    }


def add_alias(alias_map: dict[str, set[str]], alias: str, title: str) -> None:
    alias = normalize_text(alias)
    if not alias or len(alias) < 3 or alias in STOPWORDS:
        return
    alias_map.setdefault(alias, set()).add(title)


def clean_alias_phrase(text: str) -> str:
    text = re.sub(r"\[[^\]]+\]", "", text)
    text = re.sub(r"\([^)]*\)", "", text)
    text = text.strip(" \"'“”‘’")
    return re.sub(r"\s+", " ", text).strip()


def extract_summary_aliases(text: str) -> list[str]:
    aliases = []
    patterns = [
        r"(?:lebih dikenal sebagai|dikenal sebagai|dikenal dengan sapaan|dengan sapaan)\s+([^.;\n]{2,80})",
        r"(?:better known as|known as)\s+([^.;\n]{2,80})",
    ]
    for pattern in patterns:
        for match in re.finditer(pattern, text, flags=re.IGNORECASE):
            phrase = match.group(1)
            parts = re.split(r"\s+(?:atau|or|dan|and)\s+|,|/", phrase)
            aliases.extend(clean_alias_phrase(part) for part in parts)
    return [alias for alias in aliases if 3 <= len(alias) <= 60]


def ensure_search_indexes() -> None:
    global DOC_INDEX, ALIAS_INDEX, TITLE_ALIASES
    if DOC_INDEX is not None:
        return

    result = collection.get(include=["documents", "metadatas"])
    docs = []
    alias_candidates = {}
    token_counts = {}

    for title in ARTICLE_INDEX:
        for token in tokenize(title_base(title)):
            token_counts[token] = token_counts.get(token, 0) + 1

    for doc, meta in zip(result["documents"], result["metadatas"]):
        title = meta["title"]
        record = {
            "text": doc,
            "title": title,
            "section": meta["section"],
            "url": meta["url"],
            "lang": meta["lang"],
            "tokens": tokenize(f"{title} {meta['section']} {doc}"),
        }
        docs.append(record)

        if meta["section"].lower() == "summary":
            for alias in extract_summary_aliases(doc):
                add_alias(alias_candidates, alias, title)

    for alias, title in ALIASES.items():
        if title in ARTICLE_INDEX:
            add_alias(alias_candidates, alias, title)

    for title in ARTICLE_INDEX:
        base = title_base(title)
        base_norm = normalize_text(base)
        title_norm = normalize_text(title)
        add_alias(alias_candidates, base_norm, title)
        add_alias(alias_candidates, title_norm, title)

        tokens = list(tokenize(base))
        for token in tokens:
            if token_counts.get(token, 0) == 1 and len(token) >= 5:
                add_alias(alias_candidates, token, title)

        initials = "".join(token[0] for token in normalize_text(base).split() if token)
        if 2 <= len(initials) <= 5:
            add_alias(alias_candidates, initials, title)

    ALIAS_INDEX = alias_candidates
    TITLE_ALIASES = {}
    for alias, titles in ALIAS_INDEX.items():
        for title in titles:
            TITLE_ALIASES.setdefault(title, set()).add(alias)
    DOC_INDEX = docs
    print(f"Search indexes ready — {len(ALIAS_INDEX)} aliases, {len(DOC_INDEX)} docs")


def aliases_for_title(title: str) -> set[str]:
    ensure_search_indexes()
    aliases = set(TITLE_ALIASES.get(title, set()))
    aliases.add(normalize_text(title_base(title)))
    return aliases


def resolve_title_candidates(klaim: str, limit: int = 3) -> list[str]:
    """Find likely article titles mentioned in the claim before vector search."""
    ensure_search_indexes()
    norm_claim = normalize_text(klaim)
    claim_tokens = tokenize(klaim)
    scored = {}

    for alias, title in ALIASES.items():
        if re.search(rf"\b{re.escape(normalize_text(alias))}\b", norm_claim) and title in ARTICLE_INDEX:
            scored[title] = max(scored.get(title, 0), 1000)

    for alias, titles in ALIAS_INDEX.items():
        if re.search(rf"\b{re.escape(alias)}\b", norm_claim):
            alias_score = 950 + len(alias)
            if len(titles) > 1:
                alias_score -= 120
            for title in titles:
                scored[title] = max(scored.get(title, 0), alias_score)

    for title in ARTICLE_INDEX:
        norm_title = normalize_text(title)
        norm_base = normalize_text(title_base(title))
        title_tokens = tokenize(title_base(title))
        score = 0

        if norm_title and re.search(rf"\b{re.escape(norm_title)}\b", norm_claim):
            score = 900 + len(norm_title)
        elif norm_base and re.search(rf"\b{re.escape(norm_base)}\b", norm_claim):
            score = 850 + len(norm_base)
        elif title_tokens and title_tokens.issubset(claim_tokens):
            score = 700 + len(title_tokens) * 20

        if "(" in title and normalize_text(title) not in norm_claim:
            score -= 50
        if score > 0:
            scored[title] = max(scored.get(title, 0), score)

    return [
        title for title, _ in sorted(scored.items(), key=lambda item: item[1], reverse=True)[:limit]
    ]


def cosine_distance_to_score(distance: float) -> float:
    return max(0.0, min(1.0, 1 - (distance / 2)))


def rerank_score(klaim: str, evidence: dict, candidate_titles: list[str]) -> float:
    claim_tokens = tokenize(klaim)
    evidence_tokens = tokenize(f"{evidence['title']} {evidence['section']} {evidence['text']}")
    overlap = len(claim_tokens & evidence_tokens)
    lexical_bonus = min(0.12, overlap * 0.025)
    title_bonus = 0.15 if evidence["title"] in candidate_titles else 0.0
    summary_bonus = 0.05 if evidence["section"].lower() == "summary" else 0.0
    birth_bonus = 0.0
    birth_penalty = 0.0

    if is_birth_claim(klaim) and evidence["title"] in candidate_titles:
        if subject_birth_match(evidence["text"], evidence["title"]):
            birth_bonus = 0.35
            if contains_date(evidence["text"]):
                birth_bonus += 0.2
        elif re.search(r"\b(lahir|born|kelahiran)\b", normalize_text(evidence["text"])):
            birth_bonus = 0.05
            birth_penalty = 0.12
        else:
            birth_penalty = 0.18

    short_penalty = 0.2 if len(evidence["text"]) < 80 else 0.0
    return evidence["vector_score"] + lexical_bonus + title_bonus + summary_bonus + birth_bonus - birth_penalty - short_penalty


def is_birth_claim(klaim: str) -> bool:
    norm = normalize_text(klaim)
    return bool(re.search(r"\b(lahir|born|kelahiran|tanggal lahir)\b", norm))


def contains_date(text: str) -> bool:
    norm = normalize_text(text)
    months = (
        "januari|februari|maret|april|mei|juni|juli|agustus|september|"
        "oktober|november|desember|january|february|march|april|may|june|"
        "july|august|september|october|november|december"
    )
    return bool(re.search(rf"\b\d{{1,2}}\s+({months})\s+\d{{4}}\b", norm))


def subject_birth_match(text: str, title: str) -> bool:
    norm_text = normalize_text(text)
    full_name = normalize_text(title_base(title))
    aliases = aliases_for_title(title)

    if full_name:
        patterns = [
            rf"\b{re.escape(full_name)}\b.{{0,100}}\b(lahir|born)\b",
            rf"\b(lahir|born)\b.{{0,100}}\b{re.escape(full_name)}\b",
        ]
        if any(re.search(pattern, norm_text) for pattern in patterns):
            return True

    for alias in aliases:
        patterns = [
            rf"\b{re.escape(alias)}\s+(lahir|born)\b",
            rf"\b(lahir|born)\b.{{0,80}}\b{re.escape(alias)}\b",
        ]
        if any(re.search(pattern, norm_text) for pattern in patterns):
            return True

    return False


def subject_name_match(text: str, title: str) -> bool:
    norm_text = normalize_text(text)
    for name in aliases_for_title(title):
        if not name:
            continue
        if re.search(rf"\b{re.escape(name)}\b", norm_text):
            return True
    return False


def collect_hits(query_vec: list[list[float]], n_results: int, where: Optional[dict] = None) -> list[dict]:
    kwargs = {
        "query_embeddings": query_vec,
        "n_results": n_results,
        "include": ["documents", "metadatas", "distances"],
    }
    if where:
        kwargs["where"] = where

    result = collection.query(**kwargs)
    hits = []
    for doc, meta, dist in zip(
        result["documents"][0],
        result["metadatas"][0],
        result["distances"][0],
    ):
        score = cosine_distance_to_score(dist)
        hits.append({
            "text": doc,
            "title": meta["title"],
            "section": meta["section"],
            "url": meta["url"],
            "lang": meta["lang"],
            "vector_score": score,
        })
    return hits


def collect_lexical_hits(klaim: str, candidate_titles: list[str], limit: int = 25) -> list[dict]:
    ensure_search_indexes()
    claim_tokens = tokenize(klaim)
    if not claim_tokens:
        return []

    scored = []
    candidate_set = set(candidate_titles)
    for doc in DOC_INDEX:
        if candidate_set and doc["title"] not in candidate_set:
            continue
        overlap = len(claim_tokens & doc["tokens"])
        if overlap == 0:
            continue

        title_bonus = 4 if doc["title"] in candidate_set else 0
        summary_bonus = 1 if doc["section"].lower() == "summary" else 0
        score = overlap + title_bonus + summary_bonus
        scored.append((score, doc))

    scored.sort(key=lambda item: item[0], reverse=True)
    hits = []
    for score, doc in scored[:limit]:
        hits.append({
            "text": doc["text"],
            "title": doc["title"],
            "section": doc["section"],
            "url": doc["url"],
            "lang": doc["lang"],
            "vector_score": min(0.82, 0.55 + score * 0.04),
        })
    return hits


def retrieve_evidence(klaim: str, query_vec: list[list[float]], top_k: int) -> list[dict]:
    candidate_titles = resolve_title_candidates(klaim)
    pool_size = max(RETRIEVAL_POOL, top_k * 10)
    raw_hits = []

    if candidate_titles:
        per_title = max(top_k + 5, 10)
        for title in candidate_titles:
            raw_hits.extend(collect_hits(query_vec, per_title, where={"title": title}))
            if is_birth_claim(klaim):
                raw_hits.extend(collect_subject_birth_hits(title))
        raw_hits.extend(collect_lexical_hits(klaim, candidate_titles, limit=25))
    else:
        raw_hits.extend(collect_hits(query_vec, pool_size))
        raw_hits.extend(collect_lexical_hits(klaim, [], limit=25))

    seen = set()
    evidence = []
    for hit in raw_hits:
        key = (hit["title"], hit["section"], hit["text"])
        if key in seen:
            continue
        seen.add(key)

        final_score = rerank_score(klaim, hit, candidate_titles)
        if hit["vector_score"] < MIN_SCORE or final_score < MIN_SCORE:
            continue

        evidence.append({
            "text": hit["text"],
            "title": hit["title"],
            "section": hit["section"],
            "url": hit["url"],
            "lang": hit["lang"],
            "score": round(min(1.0, final_score), 4),
            "_rank": final_score,
        })

    if is_birth_claim(klaim) and candidate_titles:
        subject_birth_evidence = [
            item for item in evidence
            if item["title"] in candidate_titles and subject_birth_match(item["text"], item["title"])
        ]
        if subject_birth_evidence:
            evidence = subject_birth_evidence

    evidence.sort(key=lambda item: item["_rank"], reverse=True)
    for item in evidence:
        item.pop("_rank", None)
    return evidence[:top_k]


def collect_subject_birth_hits(title: str) -> list[dict]:
    result = collection.get(
        where={"title": title},
        include=["documents", "metadatas"],
    )
    hits = []
    for doc, meta in zip(result["documents"], result["metadatas"]):
        if meta["section"].lower() == "summary" or subject_birth_match(doc, title):
            hits.append({
                "text": doc,
                "title": meta["title"],
                "section": meta["section"],
                "url": meta["url"],
                "lang": meta["lang"],
                "vector_score": 0.78,
            })
    return hits[:12]

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
# Core helpers (reusable across endpoints)
# ─────────────────────────────────────────────
def run_fact_check(klaim: str, top_k: int = TOP_K, strategi: str = "cot") -> dict:
    t0 = time.perf_counter()
    query_vec = model.encode([klaim], normalize_embeddings=True, device=device).tolist()
    evidence = retrieve_evidence(klaim, query_vec, top_k)
    retrieval_ms = (time.perf_counter() - t0) * 1000

    if not evidence:
        return {
            "klaim": klaim, "verdict": "INFO_TIDAK_CUKUP", "kepercayaan": 0.0,
            "penjelasan": "Tidak ada bukti relevan yang ditemukan dalam basis data.",
            "penalaran": "", "bukti": [],
            "model": GROQ_MODEL,
            "waktu_retrieval_ms": round(retrieval_ms, 2), "waktu_llm_ms": 0.0,
        }

    prompt = build_prompt(klaim, evidence, strategi)
    t1 = time.perf_counter()
    resp = groq_client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "system", "content": SYSTEM_PROMPT}, {"role": "user", "content": prompt}],
        temperature=0.1,
        max_tokens=1024,
    )
    llm_ms = (time.perf_counter() - t1) * 1000
    parsed = parse_response(resp.choices[0].message.content, strategi)

    return {
        "klaim": klaim, "verdict": parsed["verdict"], "kepercayaan": parsed["kepercayaan"],
        "penjelasan": parsed["penjelasan"], "penalaran": parsed["penalaran"],
        "bukti": evidence, "model": GROQ_MODEL,
        "waktu_retrieval_ms": round(retrieval_ms, 2), "waktu_llm_ms": round(llm_ms, 2),
    }


async def scrape_article(url: str) -> tuple[str, str]:
    """Scrape URL using Playwright (JS-rendered) + trafilatura (article extraction).
    Returns (title, text). Falls back to httpx if Playwright not installed."""
    html = ""

    if PLAYWRIGHT_AVAILABLE:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
            page = await context.new_page()
            try:
                await page.goto(url, wait_until="networkidle", timeout=30000)
                html = await page.content()
            except Exception as e:
                await browser.close()
                raise HTTPException(422, f"Gagal membuka URL: {e}")
            await browser.close()
    else:
        try:
            import httpx
            async with httpx.AsyncClient(timeout=20, follow_redirects=True) as client:
                r = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
                html = r.text
        except Exception as e:
            raise HTTPException(422, f"Gagal fetch URL (Playwright tidak terinstal): {e}")

    if not TRAFILATURA_AVAILABLE:
        raise HTTPException(500, "trafilatura tidak terinstal. Jalankan: pip install trafilatura")

    metadata = trafilatura.extract_metadata(html)
    text = trafilatura.extract(html, include_comments=False, include_tables=False, favor_precision=True)
    title = (metadata.title if metadata and metadata.title else None) or url

    return title, text or ""


def extract_claims_from_text(teks: str) -> list[str]:
    resp = groq_client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": EXTRACT_CLAIMS_SYSTEM},
            {"role": "user", "content": build_extract_claims_prompt(teks)},
        ],
        temperature=0.1,
        max_tokens=512,
    )
    raw = resp.choices[0].message.content.strip()
    try:
        clean = re.sub(r"```(?:json)?", "", raw).strip()
        claims = json.loads(clean)
        if isinstance(claims, list):
            return [str(c) for c in claims if c][:5]
    except Exception:
        pass
    return [teks[:300]]


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

    result = run_fact_check(req.klaim, req.top_k, req.strategi)
    return FactCheckResponse(
        klaim              = result["klaim"],
        verdict            = result["verdict"],
        kepercayaan        = result["kepercayaan"],
        penjelasan         = result["penjelasan"],
        penalaran          = result["penalaran"],
        bukti              = [EvidenceItem(teks=e["text"], judul=e["title"], seksi=e["section"],
                                           url=e["url"], bahasa=e["lang"], skor=e["score"])
                              for e in result["bukti"]],
        model              = result["model"],
        waktu_retrieval_ms = result["waktu_retrieval_ms"],
        waktu_llm_ms       = result["waktu_llm_ms"],
    )


@app.post("/qa", response_model=QAResponse)
def tanya_jawab(req: QARequest):
    """Mode QA: jawab pertanyaan bebas menggunakan RAG, output teks + sumber (bukan verdict)."""
    if collection.count() == 0:
        raise HTTPException(400, "ChromaDB kosong")

    t0 = time.perf_counter()
    query_vec = model.encode([req.pertanyaan], normalize_embeddings=True, device=device).tolist()
    evidence = retrieve_evidence(req.pertanyaan, query_vec, req.top_k)
    retrieval_ms = (time.perf_counter() - t0) * 1000

    if not evidence:
        return QAResponse(
            pertanyaan=req.pertanyaan,
            jawaban="Maaf, tidak ditemukan informasi yang relevan di basis data untuk menjawab pertanyaan ini.",
            sumber=[], model=GROQ_MODEL,
            waktu_retrieval_ms=round(retrieval_ms, 2), waktu_llm_ms=0.0,
        )

    prompt = build_qa_prompt(req.pertanyaan, evidence)
    t1 = time.perf_counter()
    resp = groq_client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "system", "content": QA_SYSTEM_PROMPT}, {"role": "user", "content": prompt}],
        temperature=0.3,
        max_tokens=1024,
    )
    llm_ms = (time.perf_counter() - t1) * 1000
    jawaban = resp.choices[0].message.content.strip()

    sumber_items = [
        SourceItem(
            judul   = e["title"],
            seksi   = e["section"],
            url     = e["url"],
            bahasa  = e["lang"],
            skor    = e["score"],
            kutipan = e["text"][:200] + ("..." if len(e["text"]) > 200 else ""),
        )
        for e in evidence
    ]

    return QAResponse(
        pertanyaan         = req.pertanyaan,
        jawaban            = jawaban,
        sumber             = sumber_items,
        model              = GROQ_MODEL,
        waktu_retrieval_ms = round(retrieval_ms, 2),
        waktu_llm_ms       = round(llm_ms, 2),
    )


@app.post("/qa-image", response_model=ImageScanResponse)
async def qa_image(file: UploadFile = File(...)):
    """Upload screenshot/foto → ekstrak teks via vision LLM → fact-check klaim yang ditemukan."""
    allowed = {"image/jpeg", "image/png", "image/webp", "image/gif"}
    if file.content_type not in allowed:
        raise HTTPException(400, f"Tipe file tidak didukung: {file.content_type}. Gunakan JPEG/PNG/WebP.")

    t0 = time.perf_counter()
    image_data = await file.read()
    b64_image = base64.b64encode(image_data).decode()
    mime_type = file.content_type

    vision_resp = groq_client.chat.completions.create(
        model=GROQ_VISION_MODEL,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{b64_image}"}},
                {"type": "text", "text": "Ekstrak semua teks dari gambar ini secara lengkap dan akurat. Jika ada berita atau artikel, tulis teks utamanya."},
            ],
        }],
        max_tokens=2048,
    )
    extracted_text = vision_resp.choices[0].message.content.strip()

    if not extracted_text or len(extracted_text) < 20:
        raise HTTPException(422, "Tidak dapat mengekstrak teks dari gambar. Pastikan gambar mengandung teks yang jelas.")

    claims = extract_claims_from_text(extracted_text)

    results = []
    for klaim in claims:
        r = run_fact_check(klaim, TOP_K, "cot")
        results.append(KlaimResult(
            klaim       = r["klaim"],
            verdict     = r["verdict"],
            kepercayaan = r["kepercayaan"],
            penjelasan  = r["penjelasan"],
            bukti       = [EvidenceItem(teks=e["text"], judul=e["title"], seksi=e["section"],
                                        url=e["url"], bahasa=e["lang"], skor=e["score"])
                           for e in r["bukti"]],
        ))

    return ImageScanResponse(
        teks_diekstrak   = extracted_text,
        klaim_ditemukan  = claims,
        hasil            = results,
        waktu_total_ms   = round((time.perf_counter() - t0) * 1000, 2),
    )


@app.post("/scan-url", response_model=ScanURLResponse)
async def scan_url(req: ScanURLRequest):
    """Scrape URL artikel berita → ekstrak klaim faktual → batch RAG fact-check."""
    if not req.url.startswith(("http://", "https://")):
        raise HTTPException(400, "URL harus dimulai dengan http:// atau https://")

    t0 = time.perf_counter()
    judul, teks = await scrape_article(req.url)

    if not teks or len(teks) < 100:
        raise HTTPException(422, "Tidak dapat mengekstrak konten artikel. Coba URL artikel berita lain.")

    ringkasan = teks[:500] + ("..." if len(teks) > 500 else "")
    claims = extract_claims_from_text(teks)

    results = []
    for klaim in claims:
        r = run_fact_check(klaim, TOP_K, req.strategi)
        results.append(KlaimResult(
            klaim       = r["klaim"],
            verdict     = r["verdict"],
            kepercayaan = r["kepercayaan"],
            penjelasan  = r["penjelasan"],
            bukti       = [EvidenceItem(teks=e["text"], judul=e["title"], seksi=e["section"],
                                        url=e["url"], bahasa=e["lang"], skor=e["score"])
                           for e in r["bukti"]],
        ))

    return ScanURLResponse(
        url              = req.url,
        judul_artikel    = judul,
        ringkasan_artikel= ringkasan,
        klaim_ditemukan  = claims,
        hasil            = results,
        waktu_total_ms   = round((time.perf_counter() - t0) * 1000, 2),
    )


@app.post("/cari")
def cari(req: SearchRequest):
    query_vec = model.encode(
        [req.query],
        normalize_embeddings=True,
        device=device,
    ).tolist()
    evidence = retrieve_evidence(req.query, query_vec, req.top_k)
    return [
        {
            "teks" : item["text"],
            "judul": item["title"],
            "seksi": item["section"],
            "skor" : item["score"],
        }
        for item in evidence
    ]


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("api:app", host="0.0.0.0", port=8001, reload=True)
