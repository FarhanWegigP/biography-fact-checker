// ==========================================================================
// CONFIGURATION
// ==========================================================================
const API_BASE_URL  = "http://localhost:8001";
const HISTORY_KEY   = "bfc-history";
const HISTORY_MAX   = 30;
const SIDEBAR_KEY   = "bfc-sidebar";
const SIDEBAR_STATE_VERSION_KEY = "bfc-sidebar-state-version";
const SIDEBAR_STATE_VERSION = "rail-v1";

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

// ==========================================================================
// STATE
// ==========================================================================
let currentMode     = "cek";   // "cek" | "qa"
let currentInputType = "text"; // "text" | "image" | "url"
let selectedFile    = null;

// ==========================================================================
// DOM REFS — Common
// ==========================================================================
const apiStatusBadge   = document.getElementById("api-status");
const welcomeState     = document.getElementById("welcome-state");
const resultContainer  = document.getElementById("result-container");
const queryDisplay     = document.getElementById("query-display");
const resultModeBadge  = document.getElementById("result-mode-badge");
const btnNewSearch     = document.getElementById("btn-new-search");
const btnHome          = document.getElementById("btn-home");
const themeToggle      = document.getElementById("theme-toggle");
const themeIcon        = document.getElementById("theme-icon");
const loadingState     = document.getElementById("loading-state");
const loadingLabel     = document.getElementById("loading-label");
const errorState       = document.getElementById("error-state");
const errorMsg         = document.getElementById("error-msg");
const sampleLabel      = document.getElementById("sample-label");
const sampleChips      = document.getElementById("sample-chips");

// DOM — Mode toggle
const tabCek = document.getElementById("tab-cek");
const tabQA  = document.getElementById("tab-qa");

// DOM — Fact-check form
const factCheckForm    = document.getElementById("factcheck-form");
const klaimInput       = document.getElementById("klaim");
const strategiSelect   = document.getElementById("strategi");
const strategiSidebar  = document.getElementById("strategi-sidebar");
const btnSubmit        = document.getElementById("btn-submit");
const btnSubmitText    = btnSubmit.querySelector(".btn-text");
const btnSubmitIcon    = btnSubmit.querySelector(".btn-icon");
const btnSubmitSpinner = btnSubmit.querySelector(".btn-spinner");
const btnMic           = document.getElementById("btn-mic");
const micIcon          = document.getElementById("mic-icon");

// DOM — QA form
const qaForm        = document.getElementById("qa-form");
const strategiQA    = document.getElementById("strategi-qa");
const btnQASubmit   = document.getElementById("btn-qa-submit");
const qaSubmitText  = document.getElementById("qa-btn-text");
const qaSubmitIcon  = document.getElementById("qa-btn-icon");
const qaSubmitSpinner = document.getElementById("qa-btn-spinner");
const btnMicQA      = document.getElementById("btn-mic-qa");
const micQAIcon     = document.getElementById("mic-qa-icon");

// DOM — Input type tabs
const itabText  = document.getElementById("itab-text");
const itabImage = document.getElementById("itab-image");
const itabUrl   = document.getElementById("itab-url");
const paneText  = document.getElementById("pane-text");
const paneImage = document.getElementById("pane-image");
const paneUrl   = document.getElementById("pane-url");

// DOM — QA text input
const qaQuestion = document.getElementById("qa-question");

// DOM — Image upload
const uploadArea     = document.getElementById("upload-area");
const imageFileInput = document.getElementById("image-file-input");
const imagePreview   = document.getElementById("image-preview");
const previewImg     = document.getElementById("preview-img");
const previewFilename = document.getElementById("preview-filename");
const btnRemoveImage = document.getElementById("btn-remove-image");

// DOM — URL input
const urlInput = document.getElementById("url-input");

// DOM — Fact-check result
const resultState           = document.getElementById("result-state");
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

// DOM — QA result
const qaResultState    = document.getElementById("qa-result-state");
const qaEvidenceContainer = document.getElementById("qa-evidence-container");
const qaAnswerText     = document.getElementById("qa-answer-text");
const qaRetrievalTime  = document.getElementById("qa-retrieval-time");
const qaLlmTime        = document.getElementById("qa-llm-time");
const qaTotalTime      = document.getElementById("qa-total-time");

// DOM — Scan result
const scanResultState  = document.getElementById("scan-result-state");
const scanArticleCard  = document.getElementById("scan-article-card");
const scanClaimsList   = document.getElementById("scan-claims-list");
const scanTotalTime    = document.getElementById("scan-total-time");
const scanClaimsCount  = document.getElementById("scan-claims-count");

// DOM — Sidebar
const appSidebar            = document.getElementById("app-sidebar");
const sidebarOverlay        = document.getElementById("sidebar-overlay");
const mainWrap              = document.getElementById("main-wrap");
const btnSidebarToggle      = document.getElementById("btn-sidebar-toggle");
const btnSidebarClose       = document.getElementById("btn-sidebar-close");
const btnSidebarRailOpen    = document.getElementById("btn-sidebar-rail-open");
const btnSidebarRailIndex   = document.getElementById("btn-sidebar-rail-index");
const btnSidebarRailHistory = document.getElementById("btn-sidebar-rail-history");
const btnSidebarRailNew     = document.getElementById("btn-sidebar-rail-new");
const historyList           = document.getElementById("history-list");
const btnClearHistory       = document.getElementById("btn-clear-history");
const tokohCountBadge       = document.getElementById("tokoh-count");
const searchTokohInput      = document.getElementById("search-tokoh");
const tokohList             = document.getElementById("tokoh-list");

// DOM — Share
const btnShare  = document.getElementById("btn-share");
const shareIcon = document.getElementById("share-icon");

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
    renderSampleChips();

    // Fact-check form
    factCheckForm.addEventListener("submit", handleFactCheckSubmit);

    // QA form
    qaForm.addEventListener("submit", handleQASubmit);

    // Mode toggle
    tabCek.addEventListener("click", () => switchMode("cek"));
    tabQA.addEventListener("click",  () => switchMode("qa"));

    // Input type tabs
    itabText.addEventListener("click",  () => switchInputType("text"));
    itabImage.addEventListener("click", () => switchInputType("image"));
    itabUrl.addEventListener("click",   () => switchInputType("url"));

    // Image upload
    uploadArea.addEventListener("click", () => imageFileInput.click());
    uploadArea.addEventListener("dragover",  e => { e.preventDefault(); uploadArea.classList.add("drag-over"); });
    uploadArea.addEventListener("dragleave", () => uploadArea.classList.remove("drag-over"));
    uploadArea.addEventListener("drop", e => {
        e.preventDefault();
        uploadArea.classList.remove("drag-over");
        const file = e.dataTransfer.files[0];
        if (file) setImageFile(file);
    });
    imageFileInput.addEventListener("change", () => {
        if (imageFileInput.files[0]) setImageFile(imageFileInput.files[0]);
    });
    btnRemoveImage.addEventListener("click", clearImageFile);

    // Sync strategy selectors
    strategiSelect.addEventListener("change", () => {
        strategiSidebar.value = strategiSelect.value;
        strategiQA.value = strategiSelect.value;
    });
    strategiSidebar.addEventListener("change", () => {
        strategiSelect.value  = strategiSidebar.value;
        strategiQA.value      = strategiSidebar.value;
    });
    strategiQA.addEventListener("change", () => {
        strategiSelect.value  = strategiQA.value;
        strategiSidebar.value = strategiQA.value;
    });

    // Sample chips
    sampleChips.addEventListener("click", e => {
        const chip = e.target.closest(".sample-claim");
        if (!chip) return;
        e.preventDefault();
        const text = chip.textContent.trim();
        if (currentMode === "cek") {
            klaimInput.value = text;
            klaimInput.focus();
        } else {
            qaQuestion.value = text;
            qaQuestion.focus();
        }
    });

    // Navigation
    btnNewSearch.addEventListener("click", resetToWelcome);
    btnHome.addEventListener("click", resetToWelcome);
    themeToggle.addEventListener("click", toggleTheme);
    btnShare.addEventListener("click", copyShareLink);

    // Sidebar
    btnSidebarToggle.addEventListener("click", toggleSidebar);
    btnSidebarClose.addEventListener("click", closeSidebar);
    btnSidebarRailOpen.addEventListener("click", openSidebar);
    btnSidebarRailIndex.addEventListener("click", () => openSidebar({ focus: "index" }));
    btnSidebarRailHistory.addEventListener("click", () => openSidebar({ focus: "history" }));
    btnSidebarRailNew.addEventListener("click", () => { openSidebar(); resetToWelcome(); });
    sidebarOverlay.addEventListener("click", closeSidebar);
    btnClearHistory.addEventListener("click", clearHistory);
    searchTokohInput.addEventListener("input", filterTokohList);

    document.addEventListener("keydown", e => {
        if (e.key === "Escape" && appSidebar.classList.contains("is-open")) closeSidebar();
    });

    loadHashState();
});

// ==========================================================================
// MODE SWITCHING
// ==========================================================================
function switchMode(mode) {
    currentMode = mode;

    tabCek.classList.toggle("is-active", mode === "cek");
    tabQA.classList.toggle("is-active",  mode === "qa");
    tabCek.setAttribute("aria-selected", String(mode === "cek"));
    tabQA.setAttribute("aria-selected",  String(mode === "qa"));

    factCheckForm.classList.toggle("hidden", mode !== "cek");
    qaForm.classList.toggle("hidden",        mode !== "qa");

    // Strategy select visibility — hide in image/url scan (less relevant)
    updateQAStrategyVisibility();
    renderSampleChips();
}

function switchInputType(type) {
    currentInputType = type;

    [itabText, itabImage, itabUrl].forEach(t => {
        t.classList.toggle("is-active", t.dataset.itype === type);
        t.setAttribute("aria-selected", String(t.dataset.itype === type));
    });
    paneText.classList.toggle("hidden",  type !== "text");
    paneImage.classList.toggle("hidden", type !== "image");
    paneUrl.classList.toggle("hidden",   type !== "url");

    // Mic only for text input
    btnMicQA.classList.toggle("hidden", type !== "text");
    updateQAStrategyVisibility();
    updateQASubmitLabel();
}

function updateQAStrategyVisibility() {
    const show = currentMode === "qa" && currentInputType === "text";
    document.getElementById("qa-strategy-wrap").classList.toggle("hidden", !show);
}

function updateQASubmitLabel() {
    const labels = { text: "Tanya", image: "Analisis Gambar", url: "Scan Artikel" };
    qaSubmitText.textContent = labels[currentInputType] || "Kirim";
}

function renderSampleChips() {
    if (currentMode === "cek") {
        sampleLabel.textContent = "Contoh klaim";
        sampleChips.innerHTML = SAMPLES.cek.map(s =>
            `<a href="#" class="sample-claim">${escapeHtml(s)}</a>`
        ).join("");
    } else {
        sampleLabel.textContent = "Contoh pertanyaan";
        sampleChips.innerHTML = SAMPLES.qa.map(s =>
            `<a href="#" class="sample-claim">${escapeHtml(s)}</a>`
        ).join("");
    }
}

// ==========================================================================
// IMAGE FILE HANDLING
// ==========================================================================
function setImageFile(file) {
    if (!file.type.startsWith("image/")) {
        alert("File harus berupa gambar (JPG, PNG, WebP).");
        return;
    }
    if (file.size > 10 * 1024 * 1024) {
        alert("Ukuran gambar maksimal 10 MB.");
        return;
    }
    selectedFile = file;
    const reader = new FileReader();
    reader.onload = e => {
        previewImg.src = e.target.result;
        previewFilename.textContent = file.name;
        uploadArea.classList.add("hidden");
        imagePreview.classList.remove("hidden");
    };
    reader.readAsDataURL(file);
}

function clearImageFile() {
    selectedFile = null;
    previewImg.src = "";
    imageFileInput.value = "";
    imagePreview.classList.add("hidden");
    uploadArea.classList.remove("hidden");
}

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
    localStorage.setItem(SIDEBAR_STATE_VERSION_KEY, SIDEBAR_STATE_VERSION);
    localStorage.setItem(SIDEBAR_KEY, "open");
    applySidebarState(true, { persist: false });
    renderHistoryList();
}

function applySidebarState(isOpen, { persist = true } = {}) {
    appSidebar.classList.toggle("is-open", isOpen);
    appSidebar.classList.toggle("is-collapsed", !isOpen);
    mainWrap.classList.toggle("sidebar-pushed", isOpen);
    mainWrap.classList.toggle("sidebar-collapsed", !isOpen);
    btnSidebarToggle.setAttribute("aria-expanded", String(isOpen));
    btnSidebarToggle.setAttribute("aria-label", isOpen ? "Tutup sidebar" : "Buka sidebar");
    if (!isOpen) {
        sidebarOverlay.classList.remove("is-visible");
        sidebarOverlay.setAttribute("aria-hidden", "true");
    }
    if (persist) localStorage.setItem(SIDEBAR_KEY, isOpen ? "open" : "closed");
}

function openSidebar(options = {}) {
    applySidebarState(true);
    if (window.innerWidth < 769) {
        sidebarOverlay.classList.add("is-visible");
        sidebarOverlay.removeAttribute("aria-hidden");
    }
    if (options.focus === "index")   searchTokohInput.focus();
    else if (options.focus === "history") historyList.focus();
}

function closeSidebar() { applySidebarState(false); }

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
        if (!res.ok) throw new Error();
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
        if (!res.ok) throw new Error();
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
        <li data-title="${escapeAttribute(t.judul)}" role="option">
            <span class="tokoh-name">${escapeHtml(t.judul)}</span>
            <span class="tokoh-lang">${escapeHtml(t.bahasa)}</span>
        </li>
    `).join("");

    tokohList.querySelectorAll("li[data-title]").forEach(item => {
        item.addEventListener("click", () => {
            const name = item.getAttribute("data-title");
            if (currentMode === "cek") {
                klaimInput.value = `${name} adalah `;
                klaimInput.focus();
                klaimInput.setSelectionRange(klaimInput.value.length, klaimInput.value.length);
            } else {
                qaQuestion.value = `Ceritakan tentang ${name}`;
                qaQuestion.focus();
            }
            resetToWelcome();
            if (window.innerWidth < 769) closeSidebar();
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
    [resultState, qaResultState, scanResultState, errorState, loadingState].forEach(el => {
        el.classList.add("hidden");
    });

    // Re-enable inputs
    klaimInput.disabled       = false;
    qaQuestion.disabled       = false;
    urlInput.disabled         = false;
    strategiSelect.disabled   = false;
    strategiSidebar.disabled  = false;
    strategiQA.disabled       = false;
    btnSubmit.disabled        = false;
    btnQASubmit.disabled      = false;
    btnSubmitText.textContent = "Cek Fakta";
    btnSubmitIcon.classList.remove("hidden");
    btnSubmitSpinner.classList.add("hidden");
    qaSubmitText.textContent  = updateQASubmitLabel() || qaSubmitText.textContent;
    qaSubmitIcon.classList.remove("hidden");
    qaSubmitSpinner.classList.add("hidden");
    clearHashState();
}

function setLoadingState(isLoading, label = "Menjalankan retrieval dan inferensi...") {
    const inputs = [klaimInput, qaQuestion, urlInput, strategiSelect, strategiSidebar, strategiQA];
    inputs.forEach(el => { el.disabled = isLoading; });
    btnSubmit.disabled   = isLoading;
    btnQASubmit.disabled = isLoading;
    loadingLabel.textContent = label;

    if (isLoading) {
        welcomeState.classList.add("hidden");
        resultContainer.classList.remove("hidden");
        loadingState.classList.remove("hidden");
        [resultState, qaResultState, scanResultState, errorState].forEach(el => el.classList.add("hidden"));

        // Spinner on active submit btn
        if (currentMode === "cek") {
            btnSubmitText.textContent = "Memverifikasi...";
            btnSubmitIcon.classList.add("hidden");
            btnSubmitSpinner.classList.remove("hidden");
        } else {
            qaSubmitIcon.classList.add("hidden");
            qaSubmitSpinner.classList.remove("hidden");
        }
    } else {
        loadingState.classList.add("hidden");
        btnSubmitText.textContent = "Cek Fakta";
        btnSubmitIcon.classList.remove("hidden");
        btnSubmitSpinner.classList.add("hidden");
        qaSubmitIcon.classList.remove("hidden");
        qaSubmitSpinner.classList.add("hidden");
    }
}

function showError(message) {
    errorMsg.textContent = message;
    errorState.classList.remove("hidden");
    [resultState, qaResultState, scanResultState].forEach(el => el.classList.add("hidden"));
}

function showResultBadge(mode) {
    const labels = { cek: "CEK", qa: "QA", scan: "SCAN" };
    resultModeBadge.textContent = labels[mode] || mode.toUpperCase();
    resultModeBadge.className = `result-mode-badge badge--${mode}`;
}

// ==========================================================================
// FACT-CHECK SUBMIT
// ==========================================================================
async function handleFactCheckSubmit(e) {
    e.preventDefault();
    const klaim    = klaimInput.value.trim();
    const strategi = strategiSelect.value;
    if (!klaim) return;

    queryDisplay.textContent = klaim;
    showResultBadge("cek");
    setLoadingState(true);

    try {
        const res = await fetch(`${API_BASE_URL}/cek-fakta`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ klaim, strategi, top_k: 5 }),
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.detail || "Terjadi kesalahan."); }
        const data = await res.json();
        setApiStatus(true, "API aktif");
        renderFactCheckResult(data);
        setHashState(klaim, strategi, "cek");
        saveToHistory({ type: "cek", label: klaim, strategi, verdict: data.verdict, kepercayaan: data.kepercayaan });
    } catch (err) {
        showError(err.message);
    } finally {
        setLoadingState(false);
    }
}

// ==========================================================================
// QA SUBMIT
// ==========================================================================
async function handleQASubmit(e) {
    e.preventDefault();
    const itype = currentInputType;

    if (itype === "text") {
        await submitQAText();
    } else if (itype === "image") {
        await submitQAImage();
    } else {
        await submitQAUrl();
    }
}

async function submitQAText() {
    const pertanyaan = qaQuestion.value.trim();
    if (!pertanyaan) return;

    queryDisplay.textContent = pertanyaan;
    showResultBadge("qa");
    setLoadingState(true, "Mencari informasi relevan...");

    try {
        const res = await fetch(`${API_BASE_URL}/qa`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pertanyaan, top_k: 5 }),
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.detail || "Terjadi kesalahan."); }
        const data = await res.json();
        setApiStatus(true, "API aktif");
        renderQAResult(data);
        setHashState(pertanyaan, strategiQA.value, "qa");
        saveToHistory({ type: "qa", label: pertanyaan, strategi: strategiQA.value });
    } catch (err) {
        showError(err.message);
    } finally {
        setLoadingState(false);
    }
}

async function submitQAImage() {
    if (!selectedFile) { alert("Pilih gambar terlebih dahulu."); return; }

    queryDisplay.textContent = `Analisis gambar: ${selectedFile.name}`;
    showResultBadge("scan");
    setLoadingState(true, "Mengekstrak teks dari gambar dengan vision AI...");

    try {
        const formData = new FormData();
        formData.append("file", selectedFile);

        const res = await fetch(`${API_BASE_URL}/qa-image`, { method: "POST", body: formData });
        if (!res.ok) { const err = await res.json(); throw new Error(err.detail || "Gagal memproses gambar."); }
        const data = await res.json();
        setApiStatus(true, "API aktif");
        renderScanResult({
            judul_artikel: selectedFile.name,
            ringkasan_artikel: data.teks_diekstrak,
            klaim_ditemukan: data.klaim_ditemukan,
            hasil: data.hasil,
            waktu_total_ms: data.waktu_total_ms,
            _is_image: true,
        });
        saveToHistory({ type: "scan", label: `Gambar: ${selectedFile.name}` });
    } catch (err) {
        showError(err.message);
    } finally {
        setLoadingState(false);
    }
}

async function submitQAUrl() {
    const url = urlInput.value.trim();
    if (!url) { alert("Masukkan URL artikel."); return; }
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
        alert("URL harus dimulai dengan http:// atau https://"); return;
    }

    const strategi = strategiQA.value;
    queryDisplay.textContent = url;
    showResultBadge("scan");
    setLoadingState(true, "Mengambil artikel dari URL...");

    try {
        const res = await fetch(`${API_BASE_URL}/scan-url`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url, strategi }),
        });
        if (!res.ok) { const err = await res.json(); throw new Error(err.detail || "Gagal memproses URL."); }
        const data = await res.json();
        setApiStatus(true, "API aktif");
        renderScanResult(data);
        saveToHistory({ type: "scan", label: url });
    } catch (err) {
        showError(err.message);
    } finally {
        setLoadingState(false);
    }
}

// ==========================================================================
// RENDER — Fact-check
// ==========================================================================
function renderFactCheckResult(data) {
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

    const pct = Math.round(data.kepercayaan * 100);
    confidencePercentage.textContent = `${pct}%`;
    confidenceFill.style.width = `${pct}%`;
    verdictSummary.textContent = data.penjelasan || "";

    if (data.bukti && data.bukti.length > 0) {
        evidenceContainer.innerHTML = buildSourceCards(data.bukti, data.klaim);
        fullEvidenceContainer.innerHTML = buildFullEvidence(data.bukti, data.klaim);
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
// RENDER — QA
// ==========================================================================
function renderQAResult(data) {
    if (data.sumber && data.sumber.length > 0) {
        qaEvidenceContainer.innerHTML = data.sumber.map((s, i) => {
            const domain = s.bahasa === "id" ? "id.wikipedia.org" : "en.wikipedia.org";
            return `
                <a href="${escapeAttribute(s.url)}" target="_blank" rel="noreferrer" class="source-card">
                    <div class="source-card-top">
                        <span class="source-num">${i + 1}</span>
                        <span class="source-score-sm">${Math.round(s.skor * 100)}%</span>
                    </div>
                    <div class="source-name">${escapeHtml(s.judul)}</div>
                    <div class="source-detail">${escapeHtml(s.seksi)} · ${domain}</div>
                </a>
            `;
        }).join("");
    } else {
        qaEvidenceContainer.innerHTML = `<div class="no-sources">Tidak ada sumber relevan ditemukan.</div>`;
    }

    qaAnswerText.textContent = data.jawaban || "Tidak ada jawaban yang dihasilkan.";
    qaRetrievalTime.textContent = `${data.waktu_retrieval_ms.toFixed(1)} ms`;
    qaLlmTime.textContent       = `${data.waktu_llm_ms.toFixed(1)} ms`;
    qaTotalTime.textContent     = `${(data.waktu_retrieval_ms + data.waktu_llm_ms).toFixed(1)} ms`;

    qaResultState.classList.remove("hidden");
}

// ==========================================================================
// RENDER — Scan (URL + Image)
// ==========================================================================
function renderScanResult(data) {
    const isImage = data._is_image;
    const icon    = isImage ? "ph-image" : "ph-newspaper";
    const label   = isImage ? "Teks diekstrak dari gambar" : "Artikel yang dipindai";

    scanArticleCard.innerHTML = `
        <i class="ph ${icon} scan-article-icon" aria-hidden="true"></i>
        <div class="scan-article-meta">
            <div class="scan-article-label">${label}</div>
            <div class="scan-article-title">${escapeHtml(data.judul_artikel || data.url || "—")}</div>
            <div class="scan-article-summary">${escapeHtml(data.ringkasan_artikel || "")}</div>
        </div>
    `;

    const hasil = data.hasil || [];
    scanClaimsCount.textContent = hasil.length;

    if (hasil.length === 0) {
        scanClaimsList.innerHTML = `<div class="no-sources">Tidak ada klaim yang berhasil diekstrak.</div>`;
    } else {
        scanClaimsList.innerHTML = hasil.map((item, i) => {
            const verdict = (item.verdict || "").toUpperCase();
            const verdictClass = verdict === "DIDUKUNG" ? "hist-verdict--didukung"
                               : verdict === "DIBANTAH" ? "hist-verdict--dibantah"
                               : "hist-verdict--tidak-cukup";
            const verdictLabel = verdict === "DIDUKUNG" ? "DIDUKUNG"
                               : verdict === "DIBANTAH" ? "DIBANTAH"
                               : "TIDAK CUKUP";
            const pct = Math.round((item.kepercayaan || 0) * 100);

            const sourcesHtml = (item.bukti || []).map((ev, j) => {
                const domain = ev.bahasa === "id" ? "id.wikipedia.org" : "en.wikipedia.org";
                return `
                    <a href="${escapeAttribute(ev.url)}" target="_blank" rel="noreferrer" class="source-card">
                        <div class="source-card-top">
                            <span class="source-num">${j + 1}</span>
                            <span class="source-score-sm">${Math.round(ev.skor * 100)}%</span>
                        </div>
                        <div class="source-name">${escapeHtml(ev.judul)}</div>
                        <div class="source-detail">${escapeHtml(ev.seksi)} · ${domain}</div>
                    </a>
                `;
            }).join("");

            return `
                <details class="scan-claim-item">
                    <summary class="scan-claim-summary">
                        <span class="scan-claim-num">${i + 1}</span>
                        <span class="scan-claim-text">${escapeHtml(item.klaim)}</span>
                        <div class="scan-claim-badges">
                            <span class="hist-verdict ${verdictClass}">${verdictLabel}</span>
                            <span class="scan-claim-conf">${pct}%</span>
                        </div>
                        <i class="ph ph-caret-down scan-claim-caret" aria-hidden="true"></i>
                    </summary>
                    <div class="scan-claim-body">
                        <p class="scan-claim-explanation">${escapeHtml(item.penjelasan || "")}</p>
                        ${sourcesHtml ? `<div class="scan-claim-sources">${sourcesHtml}</div>` : ""}
                    </div>
                </details>
            `;
        }).join("");
    }

    scanTotalTime.textContent = `${(data.waktu_total_ms || 0).toFixed(1)} ms`;
    scanResultState.classList.remove("hidden");
}

// ==========================================================================
// SOURCE CARD HELPERS
// ==========================================================================
function buildSourceCards(bukti, klaim) {
    return bukti.map((ev, i) => {
        const domain = ev.bahasa === "id" ? "id.wikipedia.org" : "en.wikipedia.org";
        return `
            <a href="${escapeAttribute(ev.url)}" target="_blank" rel="noreferrer" class="source-card">
                <div class="source-card-top">
                    <span class="source-num">${i + 1}</span>
                    <span class="source-score-sm">${Math.round(ev.skor * 100)}%</span>
                </div>
                <div class="source-name">${escapeHtml(ev.judul)}</div>
                <div class="source-detail">${escapeHtml(ev.seksi)} · ${domain}</div>
            </a>
        `;
    }).join("");
}

function buildFullEvidence(bukti, klaim) {
    return bukti.map((ev, i) => {
        const highlighted  = highlightKeywords(ev.teks, klaim);
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
}

// ==========================================================================
// HISTORY
// ==========================================================================
function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]"); }
    catch { return []; }
}

function saveToHistory({ type, label, strategi, verdict, kepercayaan }) {
    const entries = loadHistory().filter(e => e.label !== label || e.type !== type);
    entries.unshift({ id: Date.now(), type: type || "cek", label, strategi, verdict, kepercayaan, timestamp: Date.now() });
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
    const v = String(verdict || "").toUpperCase();
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

    historyList.innerHTML = entries.map(e => {
        const typeTag = `<span class="hist-type-tag hist-type-tag--${e.type || 'cek'}">${(e.type || 'cek').toUpperCase()}</span>`;
        const verdictTag = e.verdict
            ? `<span class="hist-verdict ${histVerdictClass(e.verdict)}">${escapeHtml(e.verdict)}</span>`
            : "";
        return `
            <li class="hist-entry"
                data-label="${escapeAttribute(e.label)}"
                data-type="${escapeAttribute(e.type || 'cek')}"
                data-strategi="${escapeAttribute(e.strategi || 'cot')}"
                role="option" tabindex="0">
                <div class="hist-entry-row">
                    <span class="hist-entry-klaim">${escapeHtml(e.label)}</span>
                    <div style="display:flex;gap:4px;flex-shrink:0;align-items:center">
                        ${typeTag}
                        ${verdictTag}
                    </div>
                </div>
                <span class="hist-entry-time">${timeAgo(e.timestamp)}</span>
            </li>
        `;
    }).join("");

    historyList.querySelectorAll(".hist-entry").forEach(item => {
        const activate = () => {
            const type    = item.getAttribute("data-type");
            const label   = item.getAttribute("data-label");
            const strategi = item.getAttribute("data-strategi");

            if (type === "cek") {
                switchMode("cek");
                klaimInput.value = label;
                strategiSelect.value  = strategi;
                strategiSidebar.value = strategi;
                if (window.innerWidth < 769) closeSidebar();
                factCheckForm.dispatchEvent(new Event("submit"));
            } else if (type === "qa") {
                switchMode("qa");
                switchInputType("text");
                qaQuestion.value = label;
                if (window.innerWidth < 769) closeSidebar();
                qaForm.dispatchEvent(new Event("submit"));
            } else if (type === "scan") {
                switchMode("qa");
                if (label.startsWith("http")) {
                    switchInputType("url");
                    urlInput.value = label;
                }
                if (window.innerWidth < 769) closeSidebar();
                qaForm.dispatchEvent(new Event("submit"));
            }
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
function setHashState(query, strategi, type = "cek") {
    const params = new URLSearchParams();
    params.set("q", query);
    params.set("s", strategi);
    params.set("t", type);
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
        const t = params.get("t") || "cek";
        if (!q) return;

        if (t === "cek") {
            switchMode("cek");
            klaimInput.value = q;
            if (s && ["cot", "structured", "zero_shot"].includes(s)) {
                strategiSelect.value  = s;
                strategiSidebar.value = s;
            }
            factCheckForm.dispatchEvent(new Event("submit"));
        } else if (t === "qa") {
            switchMode("qa");
            switchInputType("text");
            qaQuestion.value = q;
            qaForm.dispatchEvent(new Event("submit"));
        }
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
// VOICE INPUT
// ==========================================================================
function initVoiceInput() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
        btnMic.classList.add("hidden");
        btnMicQA.classList.add("hidden");
        return;
    }

    setupMic(btnMic,   micIcon,   () => klaimInput);
    setupMic(btnMicQA, micQAIcon, () => qaQuestion);
}

function setupMic(btn, icon, getInput) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang           = "id-ID";
    recognition.continuous     = false;
    recognition.interimResults = true;
    let recording = false;

    recognition.onstart = () => {
        recording = true;
        btn.classList.add("recording");
        btn.setAttribute("aria-label", "Hentikan rekaman");
        icon.className = "ph ph-microphone-slash";
    };
    recognition.onresult = e => {
        getInput().value = Array.from(e.results).map(r => r[0].transcript).join("");
    };
    recognition.onend = () => {
        recording = false;
        btn.classList.remove("recording");
        btn.setAttribute("aria-label", "Input via mikrofon");
        icon.className = "ph ph-microphone";
    };
    recognition.onerror = e => {
        recording = false;
        btn.classList.remove("recording");
        icon.className = e.error === "not-allowed" ? "ph ph-microphone-slash" : "ph ph-microphone";
        if (e.error === "not-allowed") setTimeout(() => { icon.className = "ph ph-microphone"; }, 2000);
    };
    btn.addEventListener("click", () => { if (recording) recognition.stop(); else recognition.start(); });
}

// ==========================================================================
// HELPERS
// ==========================================================================
function highlightKeywords(text, claim) {
    if (!claim) return escapeHtml(text);
    const ignoreList = new Set([
        "adalah","yang","dan","di","dari","ke","pada","itu","ini",
        "dengan","atau","sebagai","untuk","ia","dia","mereka","kita",
        "kamu","saya","akan","telah","sudah","belum","sedang","dalam",
    ]);
    const words = claim.toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "")
        .split(/\s+/)
        .filter(w => w.length > 2 && !ignoreList.has(w));
    const safe = escapeHtml(text);
    if (words.length === 0) return safe;
    const escaped = words.map(w => w.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"));
    const regex = new RegExp(`\\b(${escaped.join("|")})\\b`, "gi");
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
