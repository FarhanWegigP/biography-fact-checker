// ==========================================================================
// CONFIGURATION
// ==========================================================================
const API_BASE_URL  = "http://localhost:8001";
const HISTORY_KEY   = "bfc-history";
const HISTORY_MAX   = 30;
const SIDEBAR_KEY   = "bfc-sidebar";
const SIDEBAR_STATE_VERSION_KEY = "bfc-sidebar-state-version";
const SIDEBAR_STATE_VERSION = "rail-v1";

// ==========================================================================
// DOM ELEMENTS
// ==========================================================================
const apiStatusBadge   = document.getElementById("api-status");
const factCheckForm    = document.getElementById("factcheck-form");
const klaimInput       = document.getElementById("klaim");
const strategiSelect   = document.getElementById("strategi");
const strategiSidebar  = document.getElementById("strategi-sidebar");
const btnSubmit        = document.getElementById("btn-submit");
const btnSubmitText    = btnSubmit.querySelector(".btn-text");
const btnSubmitIcon    = btnSubmit.querySelector(".btn-icon");
const btnSubmitSpinner = btnSubmit.querySelector(".btn-spinner");

const welcomeState    = document.getElementById("welcome-state");
const resultContainer = document.getElementById("result-container");
const queryDisplay    = document.getElementById("query-display");
const btnNewSearch    = document.getElementById("btn-new-search");
const btnHome         = document.getElementById("btn-home");
const themeToggle     = document.getElementById("theme-toggle");
const themeIcon       = document.getElementById("theme-icon");

const loadingState    = document.getElementById("loading-state");
const errorState      = document.getElementById("error-state");
const errorMsg        = document.getElementById("error-msg");
const resultState     = document.getElementById("result-state");

const verdictContainer      = document.getElementById("verdict-container");
const verdictTitle          = document.getElementById("verdict-title");
const verdictIcon           = document.getElementById("verdict-icon");
const confidencePercentage  = document.getElementById("confidence-percentage");
const confidenceFill        = document.getElementById("confidence-fill");
const verdictSummary        = document.getElementById("verdict-summary");
const reasoningContent      = document.getElementById("reasoning-content");
const evidenceContainer     = document.getElementById("evidence-container");
const fullEvidenceContainer = document.getElementById("full-evidence-container");
const buktiDetails          = document.getElementById("bukti-details");
const retrievalTime         = document.getElementById("retrieval-time");
const llmTime               = document.getElementById("llm-time");
const totalTime             = document.getElementById("total-time");

const tokohCountBadge  = document.getElementById("tokoh-count");
const searchTokohInput = document.getElementById("search-tokoh");
const tokohList        = document.getElementById("tokoh-list");

// Sidebar
const appSidebar       = document.getElementById("app-sidebar");
const sidebarOverlay   = document.getElementById("sidebar-overlay");
const mainWrap         = document.getElementById("main-wrap");
const btnSidebarToggle = document.getElementById("btn-sidebar-toggle");
const btnSidebarClose  = document.getElementById("btn-sidebar-close");
const btnSidebarRailOpen    = document.getElementById("btn-sidebar-rail-open");
const btnSidebarRailIndex   = document.getElementById("btn-sidebar-rail-index");
const btnSidebarRailHistory = document.getElementById("btn-sidebar-rail-history");
const btnSidebarRailNew     = document.getElementById("btn-sidebar-rail-new");
const historyList      = document.getElementById("history-list");
const btnClearHistory  = document.getElementById("btn-clear-history");

// Share + mic
const btnShare  = document.getElementById("btn-share");
const shareIcon = document.getElementById("share-icon");
const btnMic    = document.getElementById("btn-mic");
const micIcon   = document.getElementById("mic-icon");

let allTokoh        = [];
let healthRetryTimer = null;
let indexRetryTimer  = null;

// ==========================================================================
// INIT
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    initSidebar();
    initVoiceInput();
    checkApiHealth();
    loadIndexedFigures();

    factCheckForm.addEventListener("submit", handleFactCheckSubmit);
    searchTokohInput.addEventListener("input", filterTokohList);
    btnNewSearch.addEventListener("click", resetToWelcome);
    btnHome.addEventListener("click", resetToWelcome);
    themeToggle.addEventListener("click", toggleTheme);

    btnSidebarToggle.addEventListener("click", toggleSidebar);
    btnSidebarClose.addEventListener("click", closeSidebar);
    btnSidebarRailOpen.addEventListener("click", openSidebar);
    btnSidebarRailIndex.addEventListener("click", () => openSidebar({ focus: "index" }));
    btnSidebarRailHistory.addEventListener("click", () => openSidebar({ focus: "history" }));
    btnSidebarRailNew.addEventListener("click", () => {
        openSidebar();
        resetToWelcome();
        klaimInput.focus();
    });
    sidebarOverlay.addEventListener("click", closeSidebar);
    btnClearHistory.addEventListener("click", clearHistory);
    btnShare.addEventListener("click", copyShareLink);

    // Sync strategy selectors
    strategiSelect.addEventListener("change", () => {
        strategiSidebar.value = strategiSelect.value;
    });
    strategiSidebar.addEventListener("change", () => {
        strategiSelect.value = strategiSidebar.value;
    });

    // Sample claim chips
    document.querySelectorAll(".sample-claim").forEach(link => {
        link.addEventListener("click", e => {
            e.preventDefault();
            klaimInput.value = e.target.textContent;
            klaimInput.focus();
        });
    });

    // Escape closes sidebar
    document.addEventListener("keydown", e => {
        if (e.key === "Escape" && appSidebar.classList.contains("is-open")) {
            closeSidebar();
        }
    });

    loadHashState();
});

// ==========================================================================
// THEME
// ==========================================================================
function initTheme() {
    const saved = localStorage.getItem("bfc-theme") || "light";
    document.documentElement.setAttribute("data-theme", saved);
    updateThemeIcon(saved);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("bfc-theme", next);
    updateThemeIcon(next);
}

function updateThemeIcon(theme) {
    themeIcon.className = theme === "light" ? "ph ph-moon" : "ph ph-sun";
}

// ==========================================================================
// SIDEBAR
// ==========================================================================
function initSidebar() {
    if (localStorage.getItem(SIDEBAR_STATE_VERSION_KEY) !== SIDEBAR_STATE_VERSION) {
        localStorage.setItem(SIDEBAR_KEY, "open");
        localStorage.setItem(SIDEBAR_STATE_VERSION_KEY, SIDEBAR_STATE_VERSION);
    }
    const saved = localStorage.getItem(SIDEBAR_KEY) || "open";
    applySidebarState(saved !== "closed", { persist: false });
    renderHistoryList();
}

function applySidebarState(isOpen, { persist = true } = {}) {
    appSidebar.classList.toggle("is-open", isOpen);
    appSidebar.classList.toggle("is-collapsed", !isOpen);
    mainWrap.classList.toggle("sidebar-pushed", isOpen);
    mainWrap.classList.toggle("sidebar-collapsed", !isOpen);
    btnSidebarToggle.setAttribute("aria-expanded", String(isOpen));
    btnSidebarToggle.setAttribute("aria-label", isOpen ? "Tutup sidebar" : "Buka sidebar");
    btnSidebarToggle.querySelector("i").className = isOpen ? "ph ph-sidebar-simple" : "ph ph-list";

    if (!isOpen) {
        sidebarOverlay.classList.remove("is-visible");
        sidebarOverlay.setAttribute("aria-hidden", "true");
    }

    if (persist) {
        localStorage.setItem(SIDEBAR_KEY, isOpen ? "open" : "closed");
    }
}

function openSidebar(options = {}) {
    applySidebarState(true);
    if (window.innerWidth >= 769) {
        sidebarOverlay.classList.remove("is-visible");
        sidebarOverlay.setAttribute("aria-hidden", "true");
    } else {
        sidebarOverlay.classList.add("is-visible");
        sidebarOverlay.removeAttribute("aria-hidden");
    }

    if (options.focus === "index") {
        searchTokohInput.focus();
    } else if (options.focus === "history") {
        historyList.focus();
    }
}

function closeSidebar() {
    applySidebarState(false);
}

function toggleSidebar() {
    if (appSidebar.classList.contains("is-open")) closeSidebar();
    else openSidebar();
}

// ==========================================================================
// API HEALTH
// ==========================================================================
async function checkApiHealth() {
    try {
        const res = await fetch(`${API_BASE_URL}/`);
        if (!res.ok) throw new Error("HTTP error");
        const data = await res.json();
        setApiStatus(true, `API aktif · ${data.chunks || 0} chunks`);
    } catch {
        setApiStatus(false, "API terputus");
        scheduleHealthRetry();
    }
}

function setApiStatus(isOnline, text) {
    apiStatusBadge.className = `status-pill ${isOnline ? "online" : "offline"}`;
    apiStatusBadge.querySelector(".status-text").textContent = text;
}

function scheduleHealthRetry() {
    if (healthRetryTimer) return;
    healthRetryTimer = setTimeout(() => { healthRetryTimer = null; checkApiHealth(); }, 2500);
}

// ==========================================================================
// INDEXED FIGURES
// ==========================================================================
async function loadIndexedFigures() {
    try {
        const res = await fetch(`${API_BASE_URL}/artikel`);
        if (!res.ok) throw new Error("Gagal memuat daftar tokoh");

        allTokoh = await res.json();
        allTokoh.sort((a, b) => a.judul.localeCompare(b.judul));

        tokohCountBadge.textContent = allTokoh.length;
        renderTokohList(allTokoh);

        if (indexRetryTimer) { clearTimeout(indexRetryTimer); indexRetryTimer = null; }
    } catch {
        tokohCountBadge.textContent = "—";
        tokohList.innerHTML = `<li class="tokoh-loading">Gagal memuat indeks.</li>`;
        scheduleIndexRetry();
    }
}

function scheduleIndexRetry() {
    if (indexRetryTimer) return;
    indexRetryTimer = setTimeout(() => { indexRetryTimer = null; loadIndexedFigures(); }, 2500);
}

function renderTokohList(list) {
    if (list.length === 0) {
        tokohList.innerHTML = `<li class="tokoh-loading">Tokoh tidak ditemukan.</li>`;
        return;
    }

    tokohList.innerHTML = list.map(t => `
        <li data-title="${escapeHtml(t.judul)}" role="option">
            <span class="tokoh-name">${escapeHtml(t.judul)}</span>
            <span class="tokoh-lang">${escapeHtml(t.bahasa)}</span>
        </li>
    `).join("");

    tokohList.querySelectorAll("li[data-title]").forEach(item => {
        item.addEventListener("click", () => {
            const name = item.getAttribute("data-title");
            klaimInput.value = `${name} adalah `;
            resetToWelcome();
            if (window.innerWidth < 769) closeSidebar();
            klaimInput.focus();
            klaimInput.setSelectionRange(klaimInput.value.length, klaimInput.value.length);
        });
    });
}

function filterTokohList() {
    const q = searchTokohInput.value.toLowerCase().trim();
    renderTokohList(q ? allTokoh.filter(t => t.judul.toLowerCase().includes(q)) : allTokoh);
}

// ==========================================================================
// STATE TRANSITIONS
// ==========================================================================
function resetToWelcome() {
    resultContainer.classList.add("hidden");
    welcomeState.classList.remove("hidden");
    resultState.classList.add("hidden");
    errorState.classList.add("hidden");
    loadingState.classList.add("hidden");

    klaimInput.disabled       = false;
    strategiSelect.disabled   = false;
    strategiSidebar.disabled  = false;
    btnSubmit.disabled        = false;
    btnSubmitText.textContent = "Cek Fakta";
    btnSubmitIcon.classList.remove("hidden");
    btnSubmitSpinner.classList.add("hidden");
    clearHashState();
}

function setLoadingState(isLoading) {
    klaimInput.disabled      = isLoading;
    strategiSelect.disabled  = isLoading;
    strategiSidebar.disabled = isLoading;
    btnSubmit.disabled       = isLoading;

    if (isLoading) {
        btnSubmitText.textContent = "Memverifikasi...";
        btnSubmitIcon.classList.add("hidden");
        btnSubmitSpinner.classList.remove("hidden");

        queryDisplay.textContent = klaimInput.value.trim();
        welcomeState.classList.add("hidden");
        resultContainer.classList.remove("hidden");
        loadingState.classList.remove("hidden");
        errorState.classList.add("hidden");
        resultState.classList.add("hidden");
    } else {
        btnSubmitText.textContent = "Cek Fakta";
        btnSubmitIcon.classList.remove("hidden");
        btnSubmitSpinner.classList.add("hidden");
        loadingState.classList.add("hidden");
    }
}

function showError(message) {
    errorMsg.textContent = message;
    errorState.classList.remove("hidden");
    resultState.classList.add("hidden");
}

// ==========================================================================
// FACT CHECK SUBMIT
// ==========================================================================
async function handleFactCheckSubmit(e) {
    e.preventDefault();

    const klaim    = klaimInput.value.trim();
    const strategi = strategiSelect.value;
    const top_k    = 5;

    if (!klaim) return;

    setLoadingState(true);

    try {
        const res = await fetch(`${API_BASE_URL}/cek-fakta`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ klaim, strategi, top_k }),
        });

        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Terjadi kesalahan di server.");
        }

        const data = await res.json();
        setApiStatus(true, "API aktif");
        if (allTokoh.length === 0) loadIndexedFigures();
        renderResult(data);
        setHashState(klaim, strategi);
        saveToHistory(data, klaim, strategi);
    } catch (err) {
        showError(err.message);
    } finally {
        setLoadingState(false);
    }
}

// ==========================================================================
// RENDER RESULT
// ==========================================================================
function renderResult(data) {
    const verdict = data.verdict.toUpperCase();

    verdictContainer.className = "verdict-panel";
    if (verdict === "DIDUKUNG") {
        verdictContainer.classList.add("verdict--didukung");
        verdictTitle.textContent = "DIDUKUNG";
        verdictIcon.innerHTML = `<i class="ph ph-check-circle" aria-hidden="true"></i>`;
    } else if (verdict === "DIBANTAH") {
        verdictContainer.classList.add("verdict--dibantah");
        verdictTitle.textContent = "DIBANTAH";
        verdictIcon.innerHTML = `<i class="ph ph-x-circle" aria-hidden="true"></i>`;
    } else {
        verdictContainer.classList.add("verdict--tidak-cukup");
        verdictTitle.textContent = "TIDAK CUKUP";
        verdictIcon.innerHTML = `<i class="ph ph-question" aria-hidden="true"></i>`;
    }

    const confidenceVal = Math.round(data.kepercayaan * 100);
    confidencePercentage.textContent = `${confidenceVal}%`;
    confidenceFill.style.width = `${confidenceVal}%`;
    verdictSummary.textContent = data.penjelasan || "Tidak ada kesimpulan singkat.";

    if (data.bukti && data.bukti.length > 0) {
        evidenceContainer.innerHTML = data.bukti.map((ev, i) => {
            const scorePercent = Math.round(ev.skor * 100);
            const domain = ev.bahasa === "id" ? "id.wikipedia.org" : "en.wikipedia.org";
            return `
                <a href="${escapeAttribute(ev.url)}" target="_blank" rel="noreferrer" class="source-card">
                    <div class="source-card-top">
                        <span class="source-num">${i + 1}</span>
                        <span class="source-score-sm">${scorePercent}%</span>
                    </div>
                    <div class="source-name">${escapeHtml(ev.judul)}</div>
                    <div class="source-detail">${escapeHtml(ev.seksi)} · ${domain}</div>
                </a>
            `;
        }).join("");

        fullEvidenceContainer.innerHTML = data.bukti.map((ev, i) => {
            const highlighted  = highlightKeywords(ev.teks, data.klaim);
            const scorePercent = Math.round(ev.skor * 100);
            return `
                <article class="evidence-card">
                    <div class="evidence-head">
                        <div class="ev-source">
                            <i class="ph ph-globe" aria-hidden="true"></i>
                            <span class="ev-title">${escapeHtml(ev.judul)}</span>
                            <span class="ev-section">${escapeHtml(ev.seksi)}</span>
                        </div>
                        <span class="ev-score">${scorePercent}%</span>
                    </div>
                    <p class="ev-text">"${highlighted}"</p>
                    <div class="ev-foot">
                        <a href="${escapeAttribute(ev.url)}" target="_blank" rel="noreferrer" class="ev-link">
                            Buka Wikipedia <i class="ph ph-arrow-square-out" aria-hidden="true"></i>
                        </a>
                        <span class="ev-lang">${escapeHtml(ev.bahasa)}</span>
                    </div>
                </article>
            `;
        }).join("");

        buktiDetails.removeAttribute("hidden");
    } else {
        evidenceContainer.innerHTML = `<div class="no-sources">Tidak ada bukti relevan yang lolos threshold minimal.</div>`;
        fullEvidenceContainer.innerHTML = "";
        buktiDetails.setAttribute("hidden", "");
    }

    const reasoningCard = document.getElementById("reasoning-card");
    if (data.penalaran) {
        const formatted = escapeHtml(data.penalaran)
            .replace(/(Langkah\s+\d+)/gi, "<strong>$1</strong>")
            .replace(/(Step\s+\d+)/gi,     "<strong>$1</strong>")
            .replace(/(Kesimpulan:)/gi,     "<strong>$1</strong>");
        reasoningContent.innerHTML = formatted;
        reasoningCard.classList.remove("hidden");
    } else {
        reasoningCard.classList.add("hidden");
    }

    retrievalTime.textContent = `${data.waktu_retrieval_ms.toFixed(1)} ms`;
    llmTime.textContent       = `${data.waktu_llm_ms.toFixed(1)} ms`;
    totalTime.textContent     = `${(data.waktu_retrieval_ms + data.waktu_llm_ms).toFixed(1)} ms`;

    resultState.classList.remove("hidden");
}

// ==========================================================================
// HISTORY
// ==========================================================================
function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); }
    catch { return []; }
}

function saveToHistory(data, klaim, strategi) {
    const entries = loadHistory().filter(e => e.klaim !== klaim);
    entries.unshift({
        id:          Date.now(),
        klaim,
        strategi,
        verdict:     data.verdict,
        kepercayaan: data.kepercayaan,
        timestamp:   Date.now(),
    });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, HISTORY_MAX)));
    renderHistoryList();
}

function clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
    renderHistoryList();
}

function timeAgo(ts) {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (m < 1)  return "baru saja";
    if (m < 60) return `${m} mnt lalu`;
    if (h < 24) return `${h} jam lalu`;
    return `${d} hari lalu`;
}

function histVerdictClass(verdict) {
    const v = String(verdict).toUpperCase();
    if (v === "DIDUKUNG") return "hist-verdict--didukung";
    if (v === "DIBANTAH") return "hist-verdict--dibantah";
    return "hist-verdict--tidak-cukup";
}

function renderHistoryList() {
    const entries = loadHistory();
    if (entries.length === 0) {
        historyList.innerHTML = `<li class="sidebar-empty-hint">Belum ada riwayat.</li>`;
        return;
    }

    historyList.innerHTML = entries.map(e => `
        <li class="hist-entry"
            data-klaim="${escapeAttribute(e.klaim)}"
            data-strategi="${escapeAttribute(e.strategi)}"
            role="option"
            tabindex="0">
            <div class="hist-entry-row">
                <span class="hist-entry-klaim">${escapeHtml(e.klaim)}</span>
                <span class="hist-verdict ${histVerdictClass(e.verdict)}">${escapeHtml(e.verdict)}</span>
            </div>
            <span class="hist-entry-time">${timeAgo(e.timestamp)}</span>
        </li>
    `).join("");

    historyList.querySelectorAll(".hist-entry").forEach(item => {
        const activate = () => {
            const k = item.getAttribute("data-klaim");
            const s = item.getAttribute("data-strategi");
            klaimInput.value = k;
            strategiSelect.value  = s;
            strategiSidebar.value = s;
            if (window.innerWidth < 769) closeSidebar();
            factCheckForm.dispatchEvent(new Event("submit"));
        };
        item.addEventListener("click", activate);
        item.addEventListener("keydown", e => {
            if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); }
        });
    });
}

// ==========================================================================
// URL STATE
// ==========================================================================
function setHashState(klaim, strategi) {
    const params = new URLSearchParams();
    params.set("q", klaim);
    params.set("s", strategi);
    history.replaceState(null, "", "#" + params.toString());
}

function clearHashState() {
    history.replaceState(null, "", window.location.pathname + window.location.search);
}

function loadHashState() {
    if (!window.location.hash) return;
    try {
        const params = new URLSearchParams(window.location.hash.slice(1));
        const q = params.get("q");
        const s = params.get("s");
        if (!q) return;
        klaimInput.value = q;
        if (s && ["cot", "structured", "zero_shot"].includes(s)) {
            strategiSelect.value  = s;
            strategiSidebar.value = s;
        }
        factCheckForm.dispatchEvent(new Event("submit"));
    } catch { /* invalid hash — ignore */ }
}

// ==========================================================================
// SHARE LINK
// ==========================================================================
function copyShareLink() {
    const url  = window.location.href;
    const done = () => {
        shareIcon.className = "ph ph-check";
        setTimeout(() => { shareIcon.className = "ph ph-link"; }, 1800);
    };
    if (navigator.clipboard) {
        navigator.clipboard.writeText(url).then(done).catch(() => fallbackCopy(url, done));
    } else {
        fallbackCopy(url, done);
    }
}

function fallbackCopy(text, cb) {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); cb(); } catch { /* silent */ }
    document.body.removeChild(ta);
}

// ==========================================================================
// VOICE INPUT  (Web Speech API — no backend required)
// ==========================================================================
function initVoiceInput() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SR) {
        btnMic.classList.add("hidden");
        return;
    }

    const recognition = new SR();
    recognition.lang             = "id-ID";
    recognition.continuous       = false;
    recognition.interimResults   = true;

    let recording = false;

    recognition.onstart = () => {
        recording = true;
        btnMic.classList.add("recording");
        btnMic.setAttribute("aria-label", "Hentikan rekaman");
        micIcon.className = "ph ph-microphone-slash";
    };

    recognition.onresult = e => {
        const transcript = Array.from(e.results)
            .map(r => r[0].transcript)
            .join("");
        klaimInput.value = transcript;
    };

    recognition.onend = () => {
        recording = false;
        btnMic.classList.remove("recording");
        btnMic.setAttribute("aria-label", "Input via mikrofon");
        micIcon.className = "ph ph-microphone";
    };

    recognition.onerror = e => {
        recording = false;
        btnMic.classList.remove("recording");
        btnMic.setAttribute("aria-label", "Input via mikrofon");
        micIcon.className = e.error === "not-allowed" ? "ph ph-microphone-slash" : "ph ph-microphone";
        if (e.error === "not-allowed") {
            setTimeout(() => { micIcon.className = "ph ph-microphone"; }, 2000);
        }
    };

    btnMic.addEventListener("click", () => {
        if (recording) recognition.stop();
        else           recognition.start();
    });
}

// ==========================================================================
// HELPERS
// ==========================================================================
function highlightKeywords(text, claim) {
    if (!claim) return escapeHtml(text);

    const ignoreList = new Set([
        "adalah", "yang", "dan", "di", "dari", "ke", "pada", "itu", "ini",
        "dengan", "atau", "sebagai", "untuk", "ia", "dia", "mereka", "kita",
        "kamu", "saya", "akan", "telah", "sudah", "belum", "sedang", "dalam",
    ]);

    const words = claim.toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "")
        .split(/\s+/)
        .filter(w => w.length > 2 && !ignoreList.has(w));

    const safe = escapeHtml(text);
    if (words.length === 0) return safe;

    const escaped = words.map(w => w.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"));
    const regex   = new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");
    return safe.replace(regex, m => `<mark class="highlight">${m}</mark>`);
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g,  "&amp;")
        .replace(/</g,  "&lt;")
        .replace(/>/g,  "&gt;")
        .replace(/"/g,  "&quot;")
        .replace(/'/g,  "&#039;");
}

function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
}
