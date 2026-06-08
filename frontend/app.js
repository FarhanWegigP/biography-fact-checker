// ==========================================================================
// CONFIGURATION
// ==========================================================================
const API_BASE_URL = "http://localhost:8001";

// ==========================================================================
// DOM ELEMENTS
// ==========================================================================
const apiStatusBadge = document.getElementById("api-status");
const factCheckForm = document.getElementById("factcheck-form");
const klaimInput = document.getElementById("klaim");
const strategiSelect = document.getElementById("strategi");
const btnSubmit = document.getElementById("btn-submit");
const btnSubmitText = btnSubmit.querySelector(".btn-text");
const btnSubmitIcon = btnSubmit.querySelector(".btn-icon");
const btnSubmitSpinner = btnSubmit.querySelector(".spinner");

const welcomeState = document.getElementById("welcome-state");
const loadingState = document.getElementById("loading-state");
const errorState = document.getElementById("error-state");
const errorMsg = document.getElementById("error-msg");
const resultState = document.getElementById("result-state");

const verdictContainer = document.getElementById("verdict-container");
const verdictTitle = document.getElementById("verdict-title");
const verdictIcon = document.getElementById("verdict-icon");
const confidencePercentage = document.getElementById("confidence-percentage");
const confidenceFill = document.getElementById("confidence-fill");
const verdictSummary = document.getElementById("verdict-summary");
const reasoningContent = document.getElementById("reasoning-content");
const evidenceContainer = document.getElementById("evidence-container");
const retrievalTime = document.getElementById("retrieval-time");
const llmTime = document.getElementById("llm-time");
const totalTime = document.getElementById("total-time");

const tokohCountBadge = document.getElementById("tokoh-count");
const searchTokohInput = document.getElementById("search-tokoh");
const tokohList = document.getElementById("tokoh-list");

let allTokoh = [];
let healthRetryTimer = null;
let indexRetryTimer = null;

// ==========================================================================
// INIT
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
    checkApiHealth();
    loadIndexedFigures();

    factCheckForm.addEventListener("submit", handleFactCheckSubmit);
    searchTokohInput.addEventListener("input", filterTokohList);

    document.querySelectorAll(".sample-claim").forEach(link => {
        link.addEventListener("click", (event) => {
            event.preventDefault();
            klaimInput.value = event.target.textContent;
            klaimInput.focus();
        });
    });
});

async function checkApiHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/`);
        if (!response.ok) throw new Error("HTTP error");

        const data = await response.json();
        setApiStatus(true, `API aktif · ${data.chunks || 0} chunks`);
    } catch (error) {
        console.error("Health check failed:", error);
        setApiStatus(false, "API terputus");
        scheduleHealthRetry();
    }
}

async function loadIndexedFigures() {
    try {
        const response = await fetch(`${API_BASE_URL}/artikel`);
        if (!response.ok) throw new Error("Gagal mengambil daftar tokoh");

        allTokoh = await response.json();
        allTokoh.sort((a, b) => a.judul.localeCompare(b.judul));

        tokohCountBadge.textContent = `${allTokoh.length} tokoh`;
        renderTokohList(allTokoh);
        if (indexRetryTimer) {
            clearTimeout(indexRetryTimer);
            indexRetryTimer = null;
        }
    } catch (error) {
        console.error("Error loading figures:", error);
        tokohCountBadge.textContent = "retry";
        tokohList.innerHTML = `<li class="loading-item">Mencoba memuat ulang indeks...</li>`;
        scheduleIndexRetry();
    }
}

function setApiStatus(isOnline, text) {
    apiStatusBadge.className = `api-status-badge ${isOnline ? "online" : "offline"}`;
    apiStatusBadge.querySelector(".status-text").textContent = text;
}

function scheduleHealthRetry() {
    if (healthRetryTimer) return;
    healthRetryTimer = setTimeout(() => {
        healthRetryTimer = null;
        checkApiHealth();
    }, 2500);
}

function scheduleIndexRetry() {
    if (indexRetryTimer) return;
    indexRetryTimer = setTimeout(() => {
        indexRetryTimer = null;
        loadIndexedFigures();
    }, 2500);
}

function renderTokohList(list) {
    if (list.length === 0) {
        tokohList.innerHTML = `<li class="loading-item">Tokoh tidak ditemukan</li>`;
        return;
    }

    tokohList.innerHTML = list.map(tokoh => `
        <li data-title="${escapeHtml(tokoh.judul)}">
            <span class="tokoh-name">${escapeHtml(tokoh.judul)}</span>
            <span class="tokoh-meta">${escapeHtml(tokoh.bahasa)}</span>
        </li>
    `).join("");

    tokohList.querySelectorAll("li").forEach(item => {
        item.addEventListener("click", () => {
            const name = item.getAttribute("data-title");
            klaimInput.value = `${name} adalah `;
            klaimInput.focus();
            klaimInput.setSelectionRange(klaimInput.value.length, klaimInput.value.length);
        });
    });
}

function filterTokohList() {
    const query = searchTokohInput.value.toLowerCase().trim();
    if (!query) {
        renderTokohList(allTokoh);
        return;
    }

    renderTokohList(allTokoh.filter(tokoh => tokoh.judul.toLowerCase().includes(query)));
}

async function handleFactCheckSubmit(event) {
    event.preventDefault();

    const klaim = klaimInput.value.trim();
    const strategi = strategiSelect.value;
    const top_k = 5;

    if (!klaim) return;

    setLoadingState(true);

    try {
        const response = await fetch(`${API_BASE_URL}/cek-fakta`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ klaim, strategi, top_k }),
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || "Terjadi kesalahan di server.");
        }

        const data = await response.json();
        setApiStatus(true, "API aktif");
        if (allTokoh.length === 0) loadIndexedFigures();
        renderResult(data);
    } catch (error) {
        console.error("Fact-check error:", error);
        showError(error.message);
    } finally {
        setLoadingState(false);
    }
}

function setLoadingState(isLoading) {
    klaimInput.disabled = isLoading;
    strategiSelect.disabled = isLoading;
    btnSubmit.disabled = isLoading;

    if (isLoading) {
        btnSubmitText.textContent = "Memverifikasi...";
        btnSubmitIcon.classList.add("hidden");
        btnSubmitSpinner.classList.remove("hidden");

        welcomeState.classList.add("hidden");
        errorState.classList.add("hidden");
        resultState.classList.add("hidden");
        loadingState.classList.remove("hidden");
    } else {
        btnSubmitText.textContent = "Jalankan Verifikasi";
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

function highlightKeywords(text, claim) {
    if (!claim) return escapeHtml(text);

    const ignoreList = new Set([
        "adalah", "yang", "dan", "di", "dari", "ke", "pada", "itu", "ini", "dengan", "atau",
        "sebagai", "untuk", "ia", "dia", "mereka", "kita", "kamu", "saya", "akan", "telah",
        "sudah", "belum", "sedang", "dalam",
    ]);

    const words = claim.toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "")
        .split(/\s+/)
        .filter(word => word.length > 2 && !ignoreList.has(word));

    const safeText = escapeHtml(text);
    if (words.length === 0) return safeText;

    const escapedWords = words.map(word => word.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&"));
    const regex = new RegExp(`\\b(${escapedWords.join("|")})\\b`, "gi");

    return safeText.replace(regex, match => `<mark class="highlight">${match}</mark>`);
}

function renderResult(data) {
    verdictContainer.className = "panel verdict-card";
    const verdict = data.verdict.toUpperCase();

    if (verdict === "DIDUKUNG") {
        verdictContainer.classList.add("didukung");
        verdictTitle.textContent = "DIDUKUNG";
        verdictIcon.innerHTML = `<i class="fa-solid fa-check"></i>`;
    } else if (verdict === "DIBANTAH") {
        verdictContainer.classList.add("dibantah");
        verdictTitle.textContent = "DIBANTAH";
        verdictIcon.innerHTML = `<i class="fa-solid fa-xmark"></i>`;
    } else {
        verdictContainer.classList.add("tidak-cukup");
        verdictTitle.textContent = "INFORMASI TIDAK CUKUP";
        verdictIcon.innerHTML = `<i class="fa-solid fa-question"></i>`;
    }

    const confidenceVal = Math.round(data.kepercayaan * 100);
    confidencePercentage.textContent = `${confidenceVal}%`;
    confidenceFill.style.width = `${confidenceVal}%`;
    verdictSummary.textContent = data.penjelasan || "Tidak ada kesimpulan singkat.";

    if (data.penalaran) {
        const formattedReasoning = escapeHtml(data.penalaran)
            .replace(/(Langkah\s+\d+)/gi, "<strong>$1</strong>")
            .replace(/(Step\s+\d+)/gi, "<strong>$1</strong>")
            .replace(/(Kesimpulan:)/gi, "<strong>$1</strong>");
        reasoningContent.innerHTML = formattedReasoning;
        document.getElementById("reasoning-card").classList.remove("hidden");
    } else {
        document.getElementById("reasoning-card").classList.add("hidden");
    }

    if (data.bukti && data.bukti.length > 0) {
        evidenceContainer.innerHTML = data.bukti.map((evidence, index) => {
            const highlightedText = highlightKeywords(evidence.teks, data.klaim);
            const scorePercent = Math.round(evidence.skor * 100);

            return `
                <article class="evidence-card">
                    <div class="evidence-header">
                        <div class="evidence-source">
                            <span class="source-icon"><i class="fa-brands fa-wikipedia-w"></i></span>
                            <span class="source-title">${escapeHtml(evidence.judul)}</span>
                            <span class="source-section">${escapeHtml(evidence.seksi)}</span>
                        </div>
                        <span class="evidence-score">${scorePercent}%</span>
                    </div>
                    <p class="evidence-text"><strong>Bukti ${index + 1}</strong> "${highlightedText}"</p>
                    <div class="evidence-footer">
                        <a href="${escapeAttribute(evidence.url)}" target="_blank" rel="noreferrer" class="evidence-link">
                            Buka Wikipedia <i class="fa-solid fa-arrow-up-right-from-square"></i>
                        </a>
                        <span class="evidence-lang">${escapeHtml(evidence.bahasa)}</span>
                    </div>
                </article>
            `;
        }).join("");
    } else {
        evidenceContainer.innerHTML = `<div class="panel empty-evidence">Tidak ada bukti relevan yang lolos threshold minimal.</div>`;
    }

    retrievalTime.textContent = `${data.waktu_retrieval_ms.toFixed(1)} ms`;
    llmTime.textContent = `${data.waktu_llm_ms.toFixed(1)} ms`;
    totalTime.textContent = `${(data.waktu_retrieval_ms + data.waktu_llm_ms).toFixed(1)} ms`;

    resultState.classList.remove("hidden");
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
}
