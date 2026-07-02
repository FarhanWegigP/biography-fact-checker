"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
const HISTORY_KEY = "bfc-history";
const HISTORY_MAX = 30;

const SAMPLES = {
  cek: [
    "Jokowi lahir di Solo pada 21 Juni 1961.",
    "Barack Obama lahir di Hawaii.",
    "Albert Einstein menerima Nobel Fisika pada 1921.",
  ],
  qa: [
    "Siapa wakil presiden Indonesia pertama?",
    "Apa yang dilakukan Prabowo sebelum jadi presiden?",
    "Kapan Indonesia merdeka dan siapa yang memproklamasikannya?",
  ],
};

const STRATEGIES = [
  { value: "cot", label: "Chain-of-Thought" },
  { value: "structured", label: "Structured JSON" },
  { value: "zero_shot", label: "Zero-Shot" },
];

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function highlightKeywords(text, claim) {
  if (!claim) return escapeHtml(text);
  const ignoreList = new Set([
    "adalah", "yang", "dan", "di", "dari", "ke", "pada", "itu", "ini",
    "dengan", "atau", "sebagai", "untuk", "ia", "dia", "mereka", "kita",
    "kamu", "saya", "akan", "telah", "sudah", "belum", "sedang", "dalam",
  ]);
  const words = claim
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !ignoreList.has(w));
  const safe = escapeHtml(text);
  if (words.length === 0) return safe;
  const escaped = words.map((w) => w.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"));
  const regex = new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");
  return safe.replace(regex, (m) => `<mark class="highlight">${m}</mark>`);
}

function formatReasoning(text) {
  return escapeHtml(text)
    .replace(/(Langkah\s+\d+)/gi, "<strong>$1</strong>")
    .replace(/(Step\s+\d+)/gi, "<strong>$1</strong>")
    .replace(/(Kesimpulan:)/gi, "<strong>$1</strong>");
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m} mnt lalu`;
  if (h < 24) return `${h} jam lalu`;
  return `${d} hari lalu`;
}

function histVerdictClass(verdict) {
  const v = String(verdict || "").toUpperCase();
  if (v === "DIDUKUNG") return "hist-verdict--didukung";
  if (v === "DIBANTAH") return "hist-verdict--dibantah";
  return "hist-verdict--tidak-cukup";
}

function SourceCard({ ev, i }) {
  const domain = ev.bahasa === "id" ? "id.wikipedia.org" : "en.wikipedia.org";
  return (
    <a href={ev.url} target="_blank" rel="noreferrer" className="source-card">
      <div className="source-card-top">
        <span className="source-num">{i + 1}</span>
        <span className="source-score-sm">{Math.round(ev.skor * 100)}%</span>
      </div>
      <div className="source-name">{ev.judul}</div>
      <div className="source-detail">{ev.seksi} · {domain}</div>
    </a>
  );
}

function EvidenceCard({ ev, i, highlightAgainst }) {
  const highlighted = highlightKeywords(ev.teks, highlightAgainst);
  return (
    <article className="evidence-card">
      <div className="evidence-head">
        <div className="ev-source">
          <i className="ph ph-globe" aria-hidden="true"></i>
          <span className="ev-title">{ev.judul}</span>
          <span className="ev-section">{ev.seksi}</span>
        </div>
        <span className="ev-score">{Math.round(ev.skor * 100)}%</span>
      </div>
      <p className="ev-text">&quot;<span dangerouslySetInnerHTML={{ __html: highlighted }} />&quot;</p>
      <div className="ev-foot">
        <a href={ev.url} target="_blank" rel="noreferrer" className="ev-link">
          Buka Wikipedia <i className="ph ph-arrow-square-out" aria-hidden="true"></i>
        </a>
        <span className="ev-lang">{ev.bahasa}</span>
      </div>
    </article>
  );
}

export default function Home() {
  // Theme / sidebar
  const [theme, setTheme] = useState("light");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [overlayVisible, setOverlayVisible] = useState(false);

  // Mode / input type
  const [mode, setMode] = useState("cek");
  const [inputType, setInputType] = useState("text");

  // Form fields
  const [klaim, setKlaim] = useState("");
  const [strategi, setStrategi] = useState("cot");
  const [qaQuestion, setQaQuestion] = useState("");
  const [urlInputVal, setUrlInputVal] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewSrc, setPreviewSrc] = useState("");

  // API status / index
  const [apiOnline, setApiOnline] = useState(null);
  const [apiStatusText, setApiStatusText] = useState("Memeriksa...");
  const [allTokoh, setAllTokoh] = useState([]);
  const [tokohSearch, setTokohSearch] = useState("");

  // History
  const [history, setHistory] = useState([]);

  // Result view
  const [view, setView] = useState("welcome");
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("Menjalankan retrieval dan inferensi...");
  const [error, setErrorMsg] = useState(null);
  const [resultKind, setResultKind] = useState(null);
  const [queryDisplay, setQueryDisplay] = useState("");
  const [factData, setFactData] = useState(null);
  const [qaResult, setQaResult] = useState(null);
  const [scanData, setScanData] = useState(null);

  // Mic
  const [micKlaimRecording, setMicKlaimRecording] = useState(false);
  const [micQaRecording, setMicQaRecording] = useState(false);
  const [micAvailable, setMicAvailable] = useState(false);

  const [shareCopied, setShareCopied] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const klaimRef = useRef(null);
  const qaQuestionRef = useRef(null);
  const searchTokohRef = useRef(null);
  const historyListRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionKlaimRef = useRef(null);
  const recognitionQaRef = useRef(null);
  const healthRetryTimer = useRef(null);
  const indexRetryTimer = useRef(null);

  // ── History persistence ─────────────────────────────
  const loadHistory = useCallback(() => {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    } catch {
      return [];
    }
  }, []);

  const saveToHistory = useCallback(({ type, label, strategi, verdict, kepercayaan }) => {
    const entries = loadHistory().filter((e) => e.label !== label || e.type !== type);
    entries.unshift({ id: Date.now(), type: type || "cek", label, strategi, verdict, kepercayaan, timestamp: Date.now() });
    const next = entries.slice(0, HISTORY_MAX);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    setHistory(next);
  }, [loadHistory]);

  const clearHistory = () => {
    localStorage.removeItem(HISTORY_KEY);
    setHistory([]);
  };

  // ── State transitions ───────────────────────────────
  const resetToWelcome = () => {
    setView("welcome");
    setLoading(false);
    setErrorMsg(null);
    setResultKind(null);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  };

  const showResultBadge = (kind) => {
    setResultKind(kind);
    setView("result");
    setErrorMsg(null);
  };

  // ── API health ───────────────────────────────────────
  const checkApiHealth = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setApiOnline(true);
      setApiStatusText(`API aktif · ${data.chunks || 0} chunks`);
    } catch {
      setApiOnline(false);
      setApiStatusText("API terputus");
      if (!healthRetryTimer.current) {
        healthRetryTimer.current = setTimeout(() => {
          healthRetryTimer.current = null;
          checkApiHealth();
        }, 2500);
      }
    }
  }, []);

  const loadIndexedFigures = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/artikel`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      data.sort((a, b) => a.judul.localeCompare(b.judul));
      setAllTokoh(data);
      if (indexRetryTimer.current) {
        clearTimeout(indexRetryTimer.current);
        indexRetryTimer.current = null;
      }
    } catch {
      setAllTokoh(null);
      if (!indexRetryTimer.current) {
        indexRetryTimer.current = setTimeout(() => {
          indexRetryTimer.current = null;
          loadIndexedFigures();
        }, 2500);
      }
    }
  }, []);

  // ── Submit handlers ──────────────────────────────────
  const doFactCheck = useCallback(async (klaimText, strategiVal) => {
    if (!klaimText) return;
    setQueryDisplay(klaimText);
    showResultBadge("cek");
    setLoading(true);
    setLoadingLabel("Menjalankan retrieval dan inferensi...");
    try {
      const res = await fetch(`${API_BASE_URL}/cek-fakta`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ klaim: klaimText, strategi: strategiVal, top_k: 5 }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Terjadi kesalahan.");
      }
      const data = await res.json();
      setApiOnline(true);
      setApiStatusText("API aktif");
      setFactData(data);
      if (typeof window !== "undefined") {
        const params = new URLSearchParams();
        params.set("q", klaimText);
        params.set("s", strategiVal);
        params.set("t", "cek");
        window.history.replaceState(null, "", "#" + params.toString());
      }
      saveToHistory({ type: "cek", label: klaimText, strategi: strategiVal, verdict: data.verdict, kepercayaan: data.kepercayaan });
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }, [saveToHistory]);

  const doQaText = useCallback(async (question) => {
    if (!question) return;
    setQueryDisplay(question);
    showResultBadge("qa");
    setLoading(true);
    setLoadingLabel("Mencari informasi relevan...");
    try {
      const res = await fetch(`${API_BASE_URL}/qa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pertanyaan: question, top_k: 5 }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Terjadi kesalahan.");
      }
      const data = await res.json();
      setApiOnline(true);
      setApiStatusText("API aktif");
      setQaResult(data);
      if (typeof window !== "undefined") {
        const params = new URLSearchParams();
        params.set("q", question);
        params.set("s", strategi);
        params.set("t", "qa");
        window.history.replaceState(null, "", "#" + params.toString());
      }
      saveToHistory({ type: "qa", label: question, strategi });
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveToHistory, strategi]);

  const doQaImage = useCallback(async (file) => {
    if (!file) { alert("Pilih gambar terlebih dahulu."); return; }
    setQueryDisplay(`Analisis gambar: ${file.name}`);
    showResultBadge("scan");
    setLoading(true);
    setLoadingLabel("Mengekstrak teks dari gambar dengan vision AI...");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE_URL}/qa-image`, { method: "POST", body: formData });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Gagal memproses gambar.");
      }
      const data = await res.json();
      setApiOnline(true);
      setApiStatusText("API aktif");
      setScanData({
        judul_artikel: file.name,
        ringkasan_artikel: data.teks_diekstrak,
        klaim_ditemukan: data.klaim_ditemukan,
        hasil: data.hasil,
        waktu_total_ms: data.waktu_total_ms,
        _is_image: true,
      });
      saveToHistory({ type: "scan", label: `Gambar: ${file.name}` });
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }, [saveToHistory]);

  const doQaUrl = useCallback(async (url, strategiVal) => {
    if (!url) { alert("Masukkan URL artikel."); return; }
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      alert("URL harus dimulai dengan http:// atau https://");
      return;
    }
    setQueryDisplay(url);
    showResultBadge("scan");
    setLoading(true);
    setLoadingLabel("Mengambil artikel dari URL...");
    try {
      const res = await fetch(`${API_BASE_URL}/scan-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, strategi: strategiVal }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Gagal memproses URL.");
      }
      const data = await res.json();
      setApiOnline(true);
      setApiStatusText("API aktif");
      setScanData(data);
      saveToHistory({ type: "scan", label: url });
    } catch (err) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  }, [saveToHistory]);

  const handleFactCheckSubmit = (e) => {
    e.preventDefault();
    doFactCheck(klaim.trim(), strategi);
  };

  const handleQASubmit = (e) => {
    e.preventDefault();
    if (inputType === "text") doQaText(qaQuestion.trim());
    else if (inputType === "image") doQaImage(selectedFile);
    else doQaUrl(urlInputVal.trim(), strategi);
  };

  // ── Init ─────────────────────────────────────────────
  useEffect(() => {
    const saved = localStorage.getItem("bfc-theme") || "light";
    setTheme(saved);
    document.documentElement.setAttribute("data-theme", saved);

    setHistory(loadHistory());
    checkApiHealth();
    loadIndexedFigures();

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    setMicAvailable(!!SR);

    if (window.location.hash) {
      try {
        const params = new URLSearchParams(window.location.hash.slice(1));
        const q = params.get("q");
        const s = params.get("s");
        const t = params.get("t") || "cek";
        if (q) {
          if (t === "cek") {
            const validStrategi = s && ["cot", "structured", "zero_shot"].includes(s) ? s : "cot";
            setMode("cek");
            setKlaim(q);
            setStrategi(validStrategi);
            doFactCheck(q, validStrategi);
          } else if (t === "qa") {
            setMode("qa");
            setInputType("text");
            setQaQuestion(q);
            doQaText(q);
          }
        }
      } catch { /* invalid hash — ignore */ }
    }

    return () => {
      if (healthRetryTimer.current) clearTimeout(healthRetryTimer.current);
      if (indexRetryTimer.current) clearTimeout(indexRetryTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Voice input ──────────────────────────────────────
  useEffect(() => {
    if (!micAvailable) return;

    const setupMic = (setInput, recognitionRef, setRecording) => {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SR();
      recognition.lang = "id-ID";
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.onstart = () => setRecording(true);
      recognition.onresult = (e) => {
        setInput(Array.from(e.results).map((r) => r[0].transcript).join(""));
      };
      recognition.onend = () => setRecording(false);
      recognition.onerror = () => setRecording(false);
      recognitionRef.current = recognition;
    };

    setupMic(setKlaim, recognitionKlaimRef, setMicKlaimRecording);
    setupMic(setQaQuestion, recognitionQaRef, setMicQaRecording);
  }, [micAvailable]);

  const toggleMic = (recognitionRef, recording) => {
    if (!recognitionRef.current) return;
    if (recording) recognitionRef.current.stop();
    else recognitionRef.current.start();
  };

  // ── Theme ────────────────────────────────────────────
  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("bfc-theme", next);
  };

  // ── Sidebar ──────────────────────────────────────────
  const openSidebar = (focus) => {
    setSidebarOpen(true);
    if (window.innerWidth < 769) setOverlayVisible(true);
    if (focus === "index") searchTokohRef.current?.focus();
    else if (focus === "history") historyListRef.current?.focus();
  };
  const closeSidebar = () => {
    setSidebarOpen(false);
    setOverlayVisible(false);
  };
  const toggleSidebar = () => (sidebarOpen ? closeSidebar() : openSidebar());

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape" && sidebarOpen) closeSidebar();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

  // ── Image file handling ──────────────────────────────
  const setImageFile = (file) => {
    if (!file.type.startsWith("image/")) {
      alert("File harus berupa gambar (JPG, PNG, WebP).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      alert("Ukuran gambar maksimal 10 MB.");
      return;
    }
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setPreviewSrc(e.target.result);
    reader.readAsDataURL(file);
  };

  const clearImageFile = () => {
    setSelectedFile(null);
    setPreviewSrc("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Sample chips / tokoh click ───────────────────────
  const applySample = (text) => {
    if (mode === "cek") { setKlaim(text); klaimRef.current?.focus(); }
    else { setQaQuestion(text); qaQuestionRef.current?.focus(); }
  };

  const applyTokoh = (name) => {
    if (mode === "cek") setKlaim(`${name} adalah `);
    else setQaQuestion(`Ceritakan tentang ${name}`);
    resetToWelcome();
    if (window.innerWidth < 769) closeSidebar();
  };

  const activateHistoryEntry = (entry) => {
    if (entry.type === "cek") {
      setMode("cek");
      setKlaim(entry.label);
      setStrategi(entry.strategi || "cot");
      if (window.innerWidth < 769) closeSidebar();
      doFactCheck(entry.label, entry.strategi || "cot");
    } else if (entry.type === "qa") {
      setMode("qa");
      setInputType("text");
      setQaQuestion(entry.label);
      if (window.innerWidth < 769) closeSidebar();
      doQaText(entry.label);
    } else if (entry.type === "scan") {
      setMode("qa");
      if (entry.label.startsWith("http")) {
        setInputType("url");
        setUrlInputVal(entry.label);
      }
      if (window.innerWidth < 769) closeSidebar();
      doQaUrl(entry.label, strategi);
    }
  };

  // ── Share link ───────────────────────────────────────
  const fallbackCopy = (text, cb) => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); cb(); } catch { /* silent */ }
    document.body.removeChild(ta);
  };

  const copyShareLink = () => {
    const url = window.location.href;
    const done = () => {
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 1800);
    };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(done).catch(() => fallbackCopy(url, done));
    } else {
      fallbackCopy(url, done);
    }
  };

  const filteredTokoh = tokohSearch.trim()
    ? (allTokoh || []).filter((t) => t.judul.toLowerCase().includes(tokohSearch.toLowerCase().trim()))
    : allTokoh;

  const samples = mode === "cek" ? SAMPLES.cek : SAMPLES.qa;
  const qaSubmitLabel = { text: "Tanya", image: "Analisis Gambar", url: "Scan Artikel" }[inputType] || "Kirim";
  const showQaStrategy = mode === "qa" && inputType === "text";

  const verdictClass = factData
    ? factData.verdict?.toUpperCase() === "DIDUKUNG"
      ? "verdict--didukung"
      : factData.verdict?.toUpperCase() === "DIBANTAH"
        ? "verdict--dibantah"
        : "verdict--tidak-cukup"
    : "";
  const verdictLabel = factData
    ? factData.verdict?.toUpperCase() === "DIDUKUNG"
      ? "DIDUKUNG"
      : factData.verdict?.toUpperCase() === "DIBANTAH"
        ? "DIBANTAH"
        : "TIDAK CUKUP"
    : "";
  const verdictIconClass = factData
    ? factData.verdict?.toUpperCase() === "DIDUKUNG"
      ? "ph-check-circle"
      : factData.verdict?.toUpperCase() === "DIBANTAH"
        ? "ph-x-circle"
        : "ph-question"
    : "";

  return (
    <>
      <aside className={`app-sidebar ${sidebarOpen ? "is-open" : "is-collapsed"}`} aria-label="Panel navigasi">
        <div className="sidebar-rail" aria-label="Navigasi cepat">
          <button className="rail-btn rail-logo" aria-label="Buka sidebar" title="Buka sidebar" onClick={() => openSidebar()}>
            <i className="ph ph-list" aria-hidden="true"></i>
          </button>
          <button className="rail-btn" aria-label="Buka indeks tokoh" title="Indeks tokoh" onClick={() => openSidebar("index")}>
            <i className="ph ph-magnifying-glass" aria-hidden="true"></i>
          </button>
          <button className="rail-btn" aria-label="Buka riwayat" title="Riwayat" onClick={() => openSidebar("history")}>
            <i className="ph ph-clock-counter-clockwise" aria-hidden="true"></i>
          </button>
          <button className="rail-btn" aria-label="Klaim baru" title="Klaim baru" onClick={() => { openSidebar(); resetToWelcome(); }}>
            <i className="ph ph-note-pencil" aria-hidden="true"></i>
          </button>
        </div>
        <div className="sidebar-head">
          <div className="sidebar-logo">BioFactChecker</div>
          <button className="sidebar-close-btn" aria-label="Tutup sidebar" onClick={closeSidebar}>
            <i className="ph ph-list" aria-hidden="true"></i>
          </button>
        </div>

        <div className="sidebar-body">
          <div className="sidebar-section">
            <div className="sidebar-section-hdr">
              <span>Riwayat</span>
              <button className="sidebar-action-btn" aria-label="Hapus semua riwayat" onClick={clearHistory}>Hapus semua</button>
            </div>
            <ul className="sidebar-hist-list" role="listbox" tabIndex={-1} ref={historyListRef}>
              {history.length === 0 ? (
                <li className="sidebar-empty-hint">Belum ada riwayat.</li>
              ) : (
                history.map((e) => (
                  <li
                    key={e.id}
                    className="hist-entry"
                    role="option"
                    tabIndex={0}
                    onClick={() => activateHistoryEntry(e)}
                    onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); activateHistoryEntry(e); } }}
                  >
                    <div className="hist-entry-row">
                      <span className="hist-entry-klaim">{e.label}</span>
                      <div style={{ display: "flex", gap: 4, flexShrink: 0, alignItems: "center" }}>
                        <span className={`hist-type-tag hist-type-tag--${e.type || "cek"}`}>{(e.type || "cek").toUpperCase()}</span>
                        {e.verdict && <span className={`hist-verdict ${histVerdictClass(e.verdict)}`}>{e.verdict}</span>}
                      </div>
                    </div>
                    <span className="hist-entry-time">{timeAgo(e.timestamp)}</span>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="sidebar-section sidebar-section--grow">
            <div className="sidebar-section-hdr">
              <span>Indeks Tokoh</span>
              <span className="count-pill">{allTokoh === null ? "—" : allTokoh.length}</span>
            </div>
            <div className="sidebar-search-wrap">
              <i className="ph ph-magnifying-glass" aria-hidden="true"></i>
              <input ref={searchTokohRef} type="text" placeholder="Cari tokoh..." aria-label="Cari tokoh" value={tokohSearch} onChange={(e) => setTokohSearch(e.target.value)} />
            </div>
            <ul className="tokoh-list sidebar-tokoh-list" role="listbox">
              {allTokoh === null ? (
                <li className="tokoh-loading">Gagal memuat indeks.</li>
              ) : allTokoh.length === 0 ? (
                <li className="tokoh-loading">Memuat indeks...</li>
              ) : filteredTokoh.length === 0 ? (
                <li className="tokoh-loading">Tokoh tidak ditemukan.</li>
              ) : (
                filteredTokoh.map((t) => (
                  <li key={t.judul} role="option" onClick={() => applyTokoh(t.judul)}>
                    <span className="tokoh-name">{t.judul}</span>
                    <span className="tokoh-lang">{t.bahasa}</span>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      </aside>

      <div className={`sidebar-overlay ${overlayVisible ? "is-visible" : ""}`} aria-hidden={!overlayVisible} onClick={closeSidebar}></div>

      <div className={`main-wrap ${sidebarOpen ? "sidebar-pushed" : "sidebar-collapsed"}`}>
        <nav className="top-nav">
          <div className="nav-inner">
            <div className="nav-left">
              <button className="icon-btn" aria-label={sidebarOpen ? "Tutup sidebar" : "Buka sidebar"} aria-expanded={sidebarOpen} onClick={toggleSidebar}>
                <i className="ph ph-list" aria-hidden="true"></i>
              </button>
              <button className="nav-brand" aria-label="Ke halaman utama" onClick={resetToWelcome}>BioFactChecker</button>
            </div>
            <div className="nav-actions">
              <div className={`status-pill ${apiOnline === true ? "online" : apiOnline === false ? "offline" : ""}`}>
                <span className="status-dot"></span>
                <span className="status-text">{apiStatusText}</span>
              </div>
              <button className="icon-btn" aria-label="Toggle tema" onClick={toggleTheme}>
                <i className={theme === "light" ? "ph ph-moon" : "ph ph-sun"}></i>
              </button>
            </div>
          </div>
        </nav>

        <div className={`welcome-page ${view !== "welcome" ? "hidden" : ""}`}>
          <div className="welcome-inner">
            <div className="welcome-hero">
              <div className="welcome-eyebrow" aria-hidden="true">
                <span className="eyebrow-dot"></span>
                RAG · Wikipedia
              </div>
              <h1>BioFactChecker</h1>
              <p className="welcome-tagline">Verifikasi klaim & tanya-jawab berbasis RAG</p>
            </div>

            <div className="mode-toggle" role="tablist" aria-label="Pilih mode">
              <button className={`mode-tab ${mode === "cek" ? "is-active" : ""}`} role="tab" aria-selected={mode === "cek"} onClick={() => setMode("cek")}>
                <i className="ph ph-check-fat" aria-hidden="true"></i> Cek Fakta
              </button>
              <button className={`mode-tab ${mode === "qa" ? "is-active" : ""}`} role="tab" aria-selected={mode === "qa"} onClick={() => setMode("qa")}>
                <i className="ph ph-chat-dots" aria-hidden="true"></i> Tanya Jawab
              </button>
            </div>

            <form className={`search-form ${mode !== "cek" ? "hidden" : ""}`} autoComplete="off" onSubmit={handleFactCheckSubmit}>
              <div className="search-box-wrap">
                <textarea ref={klaimRef} className="search-textarea" placeholder="Masukkan klaim yang ingin dicek..." rows={3} required disabled={loading}
                  value={klaim} onChange={(e) => setKlaim(e.target.value)} />
                <div className="search-form-footer">
                  <div className="mode-control">
                    <select className="mode-select" aria-label="Mode penalaran" value={strategi} disabled={loading} onChange={(e) => setStrategi(e.target.value)}>
                      {STRATEGIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div className="form-actions">
                    {micAvailable && (
                      <button type="button" className={`mic-btn ${micKlaimRecording ? "recording" : ""}`} aria-label="Input via mikrofon" title="Bicara untuk input klaim"
                        onClick={() => toggleMic(recognitionKlaimRef, micKlaimRecording)}>
                        <i className={micKlaimRecording ? "ph ph-microphone-slash" : "ph ph-microphone"} aria-hidden="true"></i>
                      </button>
                    )}
                    <button type="submit" className="submit-btn" disabled={loading}>
                      <span className="btn-text">{loading ? "Memverifikasi..." : "Cek Fakta"}</span>
                      <i className={`ph ph-arrow-right btn-icon ${loading ? "hidden" : ""}`} aria-hidden="true"></i>
                      <i className={`ph ph-circle-notch btn-spinner ${loading ? "" : "hidden"}`} aria-hidden="true"></i>
                    </button>
                  </div>
                </div>
              </div>
            </form>

            <form className={`search-form ${mode !== "qa" ? "hidden" : ""}`} autoComplete="off" onSubmit={handleQASubmit}>
              <div className="search-box-wrap">
                <div className="input-type-tabs" role="tablist" aria-label="Tipe input">
                  <button type="button" className={`input-tab ${inputType === "text" ? "is-active" : ""}`} role="tab" data-itype="text" aria-selected={inputType === "text"} onClick={() => setInputType("text")}>
                    <i className="ph ph-text-t" aria-hidden="true"></i> Teks
                  </button>
                  <button type="button" className={`input-tab ${inputType === "image" ? "is-active" : ""}`} role="tab" data-itype="image" aria-selected={inputType === "image"} onClick={() => setInputType("image")}>
                    <i className="ph ph-image" aria-hidden="true"></i> Gambar
                  </button>
                  <button type="button" className={`input-tab ${inputType === "url" ? "is-active" : ""}`} role="tab" data-itype="url" aria-selected={inputType === "url"} onClick={() => setInputType("url")}>
                    <i className="ph ph-link" aria-hidden="true"></i> URL Artikel
                  </button>
                </div>

                <div className={`qa-input-pane ${inputType !== "text" ? "hidden" : ""}`}>
                  <textarea ref={qaQuestionRef} className="search-textarea" placeholder="Tanya apa saja tentang tokoh atau sejarah Indonesia..." rows={3} disabled={loading}
                    value={qaQuestion} onChange={(e) => setQaQuestion(e.target.value)} />
                </div>

                <div className={`qa-input-pane ${inputType !== "image" ? "hidden" : ""}`}>
                  {!selectedFile ? (
                    <label className={`upload-area ${dragOver ? "drag-over" : ""}`} tabIndex={0} role="button" aria-label="Klik atau seret gambar"
                      onClick={() => fileInputRef.current?.click()}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click(); }}
                      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) setImageFile(f); }}
                    >
                      <i className="ph ph-upload-simple upload-icon" aria-hidden="true"></i>
                      <span className="upload-text">Klik atau seret gambar ke sini</span>
                      <span className="upload-hint">JPG · PNG · WebP — maks 10 MB</span>
                      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" aria-hidden="true" style={{ display: "none" }}
                        onChange={(e) => { if (e.target.files[0]) setImageFile(e.target.files[0]); }} />
                    </label>
                  ) : (
                    <div className="image-preview">
                      <img alt="Preview" src={previewSrc} />
                      <button type="button" className="btn-remove-image" aria-label="Hapus gambar" onClick={clearImageFile}>
                        <i className="ph ph-x" aria-hidden="true"></i>
                      </button>
                      <div className="preview-filename">{selectedFile.name}</div>
                    </div>
                  )}
                </div>

                <div className={`qa-input-pane ${inputType !== "url" ? "hidden" : ""}`}>
                  <div className="url-input-wrap">
                    <i className="ph ph-globe" aria-hidden="true"></i>
                    <input type="url" className="url-text-input" placeholder="https://www.kompas.com/artikel-berita..." autoComplete="off" spellCheck="false"
                      value={urlInputVal} disabled={loading} onChange={(e) => setUrlInputVal(e.target.value)} />
                  </div>
                </div>

                <div className="search-form-footer">
                  <div className={`mode-control ${showQaStrategy ? "" : "hidden"}`}>
                    <select className="mode-select" aria-label="Mode penalaran" value={strategi} disabled={loading} onChange={(e) => setStrategi(e.target.value)}>
                      {STRATEGIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </div>
                  <div className="form-actions">
                    {micAvailable && inputType === "text" && (
                      <button type="button" className={`mic-btn ${micQaRecording ? "recording" : ""}`} aria-label="Input via mikrofon" title="Bicara untuk input pertanyaan"
                        onClick={() => toggleMic(recognitionQaRef, micQaRecording)}>
                        <i className={micQaRecording ? "ph ph-microphone-slash" : "ph ph-microphone"} aria-hidden="true"></i>
                      </button>
                    )}
                    <button type="submit" className="submit-btn" disabled={loading}>
                      <span className="btn-text">{qaSubmitLabel}</span>
                      <i className={`ph ph-arrow-right btn-icon ${loading ? "hidden" : ""}`} aria-hidden="true"></i>
                      <i className={`ph ph-circle-notch btn-spinner ${loading ? "" : "hidden"}`} aria-hidden="true"></i>
                    </button>
                  </div>
                </div>
              </div>
            </form>

            <div className="sample-section">
              <p className="sample-label">{mode === "cek" ? "Contoh klaim" : "Contoh pertanyaan"}</p>
              <div className="sample-chips-row">
                {samples.map((s) => (
                  <a key={s} href="#" className="sample-claim" onClick={(e) => { e.preventDefault(); applySample(s); }}>{s}</a>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className={`result-page ${view !== "result" ? "hidden" : ""}`}>
          <div className="query-bar">
            <div className="query-bar-inner">
              <div className="query-bar-left">
                <span className={`result-mode-badge badge--${resultKind}`}>{{ cek: "CEK", qa: "QA", scan: "SCAN" }[resultKind] || ""}</span>
                <h2 className="query-display">{queryDisplay}</h2>
              </div>
              <div className="query-bar-actions">
                <button className="icon-btn" aria-label="Salin tautan hasil" onClick={copyShareLink}>
                  <i className={shareCopied ? "ph ph-check" : "ph ph-link"} aria-hidden="true"></i>
                </button>
                <button className="btn-new-search" onClick={resetToWelcome}>
                  <i className="ph ph-plus" aria-hidden="true"></i> Baru
                </button>
              </div>
            </div>
          </div>

          <div className="result-layout">
            <main className="result-main">
              {loading && (
                <div className="loading-plex" aria-live="polite">
                  <div className="load-header">
                    <span className="loader-pulse" aria-hidden="true"></span>
                    <span>{loadingLabel}</span>
                  </div>
                  <div className="skeleton-strip">
                    <div className="skeleton-source"></div>
                    <div className="skeleton-source"></div>
                    <div className="skeleton-source"></div>
                    <div className="skeleton-source"></div>
                  </div>
                  <div className="skeleton-block"></div>
                  <div className="skeleton-group">
                    <div className="skeleton-line w-3-4"></div>
                    <div className="skeleton-line w-1-2"></div>
                    <div className="skeleton-line w-2-3"></div>
                  </div>
                </div>
              )}

              {!loading && error && (
                <div className="error-plex" role="alert">
                  <i className="ph ph-warning-circle" aria-hidden="true"></i>
                  <div className="error-body">
                    <strong>Request gagal</strong>
                    <p>{error}</p>
                  </div>
                </div>
              )}

              {!loading && !error && resultKind === "cek" && factData && (
                <div className="answer-zone">
                  <div className="sources-strip">
                    {factData.bukti && factData.bukti.length > 0
                      ? factData.bukti.map((ev, i) => <SourceCard key={i} ev={ev} i={i} />)
                      : <div className="no-sources">Tidak ada bukti relevan yang lolos threshold minimal.</div>}
                  </div>

                  <div className={`verdict-panel ${verdictClass}`}>
                    <div className="verdict-row">
                      <span className="verdict-icon-wrap" aria-hidden="true"><i className={`ph ${verdictIconClass}`} aria-hidden="true"></i></span>
                      <h2 className="verdict-title">{verdictLabel}</h2>
                      <span className="confidence-pct">{Math.round(factData.kepercayaan * 100)}%</span>
                    </div>
                    <div className="conf-bar-bg">
                      <div className="conf-bar-fill" style={{ width: `${Math.round(factData.kepercayaan * 100)}%` }}></div>
                    </div>
                    <p className="verdict-summary">{factData.penjelasan || ""}</p>
                  </div>

                  {factData.bukti && factData.bukti.length > 0 && (
                    <details className="expand-section">
                      <summary className="expand-summary">
                        <span>Bukti lengkap</span>
                        <i className="ph ph-caret-down expand-caret" aria-hidden="true"></i>
                      </summary>
                      <div className="full-evidence">
                        {factData.bukti.map((ev, i) => <EvidenceCard key={i} ev={ev} i={i} highlightAgainst={factData.klaim} />)}
                      </div>
                    </details>
                  )}

                  {factData.penalaran && (
                    <details className="expand-section">
                      <summary className="expand-summary">
                        <span>Penalaran AI</span>
                        <i className="ph ph-caret-down expand-caret" aria-hidden="true"></i>
                      </summary>
                      <div className="reasoning-body" dangerouslySetInnerHTML={{ __html: formatReasoning(factData.penalaran) }} />
                    </details>
                  )}

                  <footer className="perf-row">
                    <span className="perf-chip">Retrieval <strong>{factData.waktu_retrieval_ms.toFixed(1)} ms</strong></span>
                    <span className="perf-chip">LLM <strong>{factData.waktu_llm_ms.toFixed(1)} ms</strong></span>
                    <span className="perf-chip">Total <strong>{(factData.waktu_retrieval_ms + factData.waktu_llm_ms).toFixed(1)} ms</strong></span>
                  </footer>
                </div>
              )}

              {!loading && !error && resultKind === "qa" && qaResult && (
                <div className="answer-zone">
                  <div className="sources-strip">
                    {qaResult.sumber && qaResult.sumber.length > 0
                      ? qaResult.sumber.map((s, i) => <SourceCard key={i} ev={s} i={i} />)
                      : <div className="no-sources">Tidak ada sumber relevan ditemukan.</div>}
                  </div>

                  <div className="qa-answer-card">
                    <div className="qa-answer-header">
                      <i className="ph ph-sparkle" aria-hidden="true"></i>
                      <span>Jawaban</span>
                    </div>
                    <div className="qa-answer-body">{qaResult.jawaban || "Tidak ada jawaban yang dihasilkan."}</div>
                  </div>

                  {qaResult.sumber && qaResult.sumber.length > 0 && (
                    <details className="expand-section">
                      <summary className="expand-summary">
                        <span>Bukti lengkap</span>
                        <i className="ph ph-caret-down expand-caret" aria-hidden="true"></i>
                      </summary>
                      <div className="full-evidence">
                        {qaResult.sumber.map((s, i) => <EvidenceCard key={i} ev={s} i={i} highlightAgainst={qaResult.pertanyaan} />)}
                      </div>
                    </details>
                  )}

                  <footer className="perf-row">
                    <span className="perf-chip">Retrieval <strong>{qaResult.waktu_retrieval_ms.toFixed(1)} ms</strong></span>
                    <span className="perf-chip">LLM <strong>{qaResult.waktu_llm_ms.toFixed(1)} ms</strong></span>
                    <span className="perf-chip">Total <strong>{(qaResult.waktu_retrieval_ms + qaResult.waktu_llm_ms).toFixed(1)} ms</strong></span>
                  </footer>
                </div>
              )}

              {!loading && !error && resultKind === "scan" && scanData && (
                <div className="answer-zone">
                  <div className="scan-article-card">
                    <i className={`ph ${scanData._is_image ? "ph-image" : "ph-newspaper"} scan-article-icon`} aria-hidden="true"></i>
                    <div className="scan-article-meta">
                      <div className="scan-article-label">{scanData._is_image ? "Teks diekstrak dari gambar" : "Artikel yang dipindai"}</div>
                      <div className="scan-article-title">{scanData.judul_artikel || scanData.url || "—"}</div>
                      <div className="scan-article-summary">{scanData.ringkasan_artikel || ""}</div>
                    </div>
                  </div>

                  <div className="scan-claims-list">
                    {(!scanData.hasil || scanData.hasil.length === 0) ? (
                      <div className="no-sources">Tidak ada klaim yang berhasil diekstrak.</div>
                    ) : (
                      scanData.hasil.map((item, i) => {
                        const v = (item.verdict || "").toUpperCase();
                        const vClass = v === "DIDUKUNG" ? "hist-verdict--didukung" : v === "DIBANTAH" ? "hist-verdict--dibantah" : "hist-verdict--tidak-cukup";
                        const vLabel = v === "DIDUKUNG" ? "DIDUKUNG" : v === "DIBANTAH" ? "DIBANTAH" : "TIDAK CUKUP";
                        return (
                          <details key={i} className="scan-claim-item">
                            <summary className="scan-claim-summary">
                              <span className="scan-claim-num">{i + 1}</span>
                              <span className="scan-claim-text">{item.klaim}</span>
                              <div className="scan-claim-badges">
                                <span className={`hist-verdict ${vClass}`}>{vLabel}</span>
                                <span className="scan-claim-conf">{Math.round((item.kepercayaan || 0) * 100)}%</span>
                              </div>
                              <i className="ph ph-caret-down scan-claim-caret" aria-hidden="true"></i>
                            </summary>
                            <div className="scan-claim-body">
                              <p className="scan-claim-explanation">{item.penjelasan || ""}</p>
                              {item.bukti && item.bukti.length > 0 && (
                                <div className="scan-claim-sources">
                                  {item.bukti.map((ev, j) => <SourceCard key={j} ev={ev} i={j} />)}
                                </div>
                              )}
                            </div>
                          </details>
                        );
                      })
                    )}
                  </div>

                  <footer className="perf-row">
                    <span className="perf-chip">Total <strong>{(scanData.waktu_total_ms || 0).toFixed(1)} ms</strong></span>
                    <span className="perf-chip"><strong>{(scanData.hasil || []).length}</strong> klaim diperiksa</span>
                  </footer>
                </div>
              )}
            </main>

            <aside className="result-sidebar">
              <div className="sidebar-widget">
                <p className="widget-label">Mode analisis</p>
                <select className="widget-select" aria-label="Mode penalaran" value={strategi} onChange={(e) => setStrategi(e.target.value)}>
                  {STRATEGIES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </>
  );
}
