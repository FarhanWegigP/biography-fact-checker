// ==========================================================================
// CONFIGURATION
// ==========================================================================
const API_BASE_URL = "http://localhost:8001";

// ==========================================================================
// DOM ELEMENTS
// ==========================================================================
// DOM ELEMENTS
const apiStatusBadge = document.getElementById("api-status");
const factCheckForm = document.getElementById("factcheck-form");
const klaimInput = document.getElementById("klaim");
const strategiSelect = document.getElementById("strategi");
const btnSubmit = document.getElementById("btn-submit");
const btnSubmitText = btnSubmit.querySelector(".btn-text");
const btnSubmitIcon = btnSubmit.querySelector(".btn-icon");
const btnSubmitSpinner = btnSubmit.querySelector(".spinner");

// View States
const welcomeState = document.getElementById("welcome-state");
const loadingState = document.getElementById("loading-state");
const errorState = document.getElementById("error-state");
const errorMsg = document.getElementById("error-msg");
const resultState = document.getElementById("result-state");

// Result Elements
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

// Dataset Browser Elements
const tokohCountBadge = document.getElementById("tokoh-count");
const searchTokohInput = document.getElementById("search-tokoh");
const tokohList = document.getElementById("tokoh-list");

// State
let allTokoh = [];

// ==========================================================================
// INIT & API HEALTH CHECK
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
    checkApiHealth();
    loadIndexedFigures();

    // Form submit listener
    factCheckForm.addEventListener("submit", handleFactCheckSubmit);

    // Search tokoh listener
    searchTokohInput.addEventListener("input", filterTokohList);

    // Sample claims click listener
    document.querySelectorAll(".sample-claim").forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            klaimInput.value = e.target.textContent;
            klaimInput.focus();
        });
    });
});

/**
 * Check if FastAPI server is up and reachable
 */
async function checkApiHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/`);
        if (response.ok) {
            const data = await response.json();
            apiStatusBadge.className = "api-status-badge online";
            apiStatusBadge.querySelector(".status-text").textContent = "API Tersambung";
        } else {
            throw new Error("HTTP error");
        }
    } catch (error) {
        console.error("Health check failed:", error);
        apiStatusBadge.className = "api-status-badge offline";
        apiStatusBadge.querySelector(".status-text").textContent = "API Terputus";
    }
}

// ==========================================================================
// DATASET BROWSER FUNCTIONS
// ==========================================================================
/**
 * Load indexed figures from /artikel endpoint
 */
async function loadIndexedFigures() {
    try {
        const response = await fetch(`${API_BASE_URL}/artikel`);
        if (!response.ok) throw new Error("Gagal mengambil daftar tokoh");
        
        allTokoh = await response.json();
        
        // Sort alphabetically
        allTokoh.sort((a, b) => a.judul.localeCompare(b.judul));

        tokohCountBadge.textContent = `${allTokoh.length} tokoh`;
        renderTokohList(allTokoh);
    } catch (error) {
        console.error("Error loading figures:", error);
        tokohList.innerHTML = `<li class="loading-item" style="color: var(--danger-color)">✗ Gagal memuat dataset</li>`;
    }
}

/**
 * Render the filtered/unfiltered list of figures
 */
function renderTokohList(list) {
    if (list.length === 0) {
        tokohList.innerHTML = `<li class="loading-item">Tokoh tidak ditemukan</li>`;
        return;
    }

    tokohList.innerHTML = list.map(tokoh => `
        <li data-title="${tokoh.judul}">
            <span class="tokoh-name">${tokoh.judul}</span>
            <span class="tokoh-meta">${tokoh.bahasa}</span>
        </li>
    `).join("");

    // Add click listeners to items
    tokohList.querySelectorAll("li").forEach(item => {
        item.addEventListener("click", () => {
            const name = item.getAttribute("data-title");
            klaimInput.value = `${name} adalah...`;
            klaimInput.focus();
            
            // Highlight text range
            const len = klaimInput.value.length;
            klaimInput.setSelectionRange(len, len);
        });
    });
}

/**
 * Filter figures client-side based on search input
 */
function filterTokohList() {
    const query = searchTokohInput.value.toLowerCase().trim();
    if (!query) {
        renderTokohList(allTokoh);
        return;
    }
    const filtered = allTokoh.filter(t => t.judul.toLowerCase().includes(query));
    renderTokohList(filtered);
}

// ==========================================================================
// FACT CHECKING CORE FLOW
// ==========================================================================
/**
 * Handles Form Submission and API Integration
 */
async function handleFactCheckSubmit(e) {
    e.preventDefault();

    const klaim = klaimInput.value.trim();
    const strategi = strategiSelect.value;
    const top_k = 5; // Hardcoded default yang optimal untuk RAG fact checker

    if (!klaim) return;

    // UI State: Loading
    setLoadingState(true);

    try {
        const response = await fetch(`${API_BASE_URL}/cek-fakta`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ klaim, strategi, top_k })
        });

        if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.detail || "Terjadi kesalahan di server.");
        }

        const data = await response.json();
        renderResult(data);
    } catch (error) {
        console.error("Fact-check error:", error);
        showError(error.message);
    } finally {
        setLoadingState(false);
    }
}

/**
 * Switch visibility to show loading state
 */
function setLoadingState(isLoading) {
    if (isLoading) {
        // Disable form elements
        klaimInput.disabled = true;
        strategiSelect.disabled = true;
        btnSubmit.disabled = true;

        // Toggle buttons spinner
        btnSubmitText.textContent = "Sedang Memeriksa Fakta...";
        btnSubmitIcon.classList.add("hidden");
        btnSubmitSpinner.classList.remove("hidden");

        // Swap panels
        welcomeState.classList.add("hidden");
        errorState.classList.add("hidden");
        resultState.classList.add("hidden");
        loadingState.classList.remove("hidden");
    } else {
        // Enable form elements
        klaimInput.disabled = false;
        strategiSelect.disabled = false;
        btnSubmit.disabled = false;

        // Reset buttons spinner
        btnSubmitText.textContent = "Cek Kebenaran Klaim";
        btnSubmitIcon.classList.remove("hidden");
        btnSubmitSpinner.classList.add("hidden");

        loadingState.classList.add("hidden");
    }
}

/**
 * Show error message card
 */
function showError(message) {
    errorMsg.textContent = message;
    errorState.classList.remove("hidden");
    resultState.classList.add("hidden");
}

/**
 * Highlight important keywords in the source text for human audit
 */
function highlightKeywords(text, claim) {
    if (!claim) return text;
    
    // Stop words & small words filter to get core nouns/entities
    const ignoreList = new Set([
        "adalah", "yang", "dan", "di", "dari", "ke", "pada", "itu", "ini", "dengan", "atau", "sebagai", "untuk",
        "ia", "dia", "mereka", "kita", "kamu", "saya", "akan", "telah", "sudah", "belum", "sedang", "dalam"
    ]);

    // Tokenize claim into words, clean them
    const words = claim.toLowerCase()
        .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "")
        .split(/\s+/)
        .filter(w => w.length > 2 && !ignoreList.has(w));

    if (words.length === 0) return text;

    // Create regex matching any of these keywords (case insensitive, full word boundaries where possible)
    // Escape keywords
    const escapedWords = words.map(w => w.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
    const regex = new RegExp(`\\b(${escapedWords.join("|")})\\b`, "gi");

    return text.replace(regex, (match) => `<mark class="highlight">${match}</mark>`);
}

/**
 * Render result data into UI templates
 */
function renderResult(data) {
    // 1. Theme Verdict Container based on response
    verdictContainer.className = "glass-card result-header-card";
    const verdict = data.verdict.toUpperCase();

    if (verdict === "DIDUKUNG") {
        verdictContainer.classList.add("didukung");
        verdictTitle.textContent = "DIDUKUNG";
        verdictIcon.innerHTML = `<i class="fa-solid fa-circle-check"></i>`;
    } else if (verdict === "DIBANTAH") {
        verdictContainer.classList.add("dibantah");
        verdictTitle.textContent = "DIBANTAH";
        verdictIcon.innerHTML = `<i class="fa-solid fa-circle-xmark"></i>`;
    } else {
        verdictContainer.className = "glass-card result-header-card tidak-cukup";
        verdictTitle.textContent = "INFORMASI TIDAK CUKUP";
        verdictIcon.innerHTML = `<i class="fa-solid fa-circle-question"></i>`;
    }

    // 2. Set Confidence Fill
    const confidenceVal = Math.round(data.kepercayaan * 100);
    confidencePercentage.textContent = `${confidenceVal}%`;
    confidenceFill.style.width = `${confidenceVal}%`;

    // 3. Set explanation & reasoning
    verdictSummary.textContent = data.penjelasan || "Tidak ada kesimpulan singkat.";
    
    // Formatting Chain of Thought (bolding lines starting with "Langkah" or steps)
    if (data.penalaran) {
        let formattedReasoning = data.penalaran
            .replace(/(Langkah\s+\d+)/gi, "<strong>$1</strong>")
            .replace(/(Step\s+\d+)/gi, "<strong>$1</strong>")
            .replace(/(Kesimpulan:)/gi, "<strong>$1</strong>");
        reasoningContent.innerHTML = formattedReasoning;
        document.getElementById("reasoning-card").classList.remove("hidden");
    } else {
        document.getElementById("reasoning-card").classList.add("hidden");
    }

    // 4. Render Evidence Cards
    if (data.bukti && data.bukti.length > 0) {
        evidenceContainer.innerHTML = data.bukti.map(evidence => {
            const highlightedText = highlightKeywords(evidence.teks, data.klaim);
            const scorePercent = Math.round(evidence.skor * 100);

            return `
            <article class="evidence-card">
                <div class="evidence-header">
                    <div class="evidence-source">
                        <span class="source-icon"><i class="fa-brands fa-wikipedia-w"></i></span>
                        <span class="source-title">${evidence.judul}</span>
                        <span class="source-section">${evidence.seksi}</span>
                    </div>
                    <span class="evidence-score">${scorePercent}% Relevansi</span>
                </div>
                <p class="evidence-text">"... ${highlightedText} ..."</p>
                <div class="evidence-footer">
                    <a href="${evidence.url}" target="_blank" class="evidence-link">
                        Buka Artikel Wikipedia <i class="fa-solid fa-arrow-up-right-from-square"></i>
                    </a>
                    <span class="evidence-lang">${evidence.bahasa}</span>
                </div>
            </article>
            `;
        }).join("");
    } else {
        evidenceContainer.innerHTML = `<div class="glass-card" style="text-align: center; color: var(--text-muted)">Tidak ada bukti relevan yang lolos threshold minimal.</div>`;
    }

    // 5. Performance Indicators
    retrievalTime.textContent = `${data.waktu_retrieval_ms.toFixed(1)} ms`;
    llmTime.textContent = `${data.waktu_llm_ms.toFixed(1)} ms`;

    // Swap State to Result view
    resultState.classList.remove("hidden");
}
