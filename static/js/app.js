/* ═══════════════════════════════════════════════════════════
   Realtime S Pulse - Core Application JavaScript
   ═══════════════════════════════════════════════════════════ */

// ── Global State ──
let currentSymbol = 'AAPL';
let currentPeriod = '1mo';
let mainChart = null;
let volumeChart = null;
let liveChart = null;
let chartType = 'line';
let lastDashData = null;
let dashView = 'graph';
let currentCurrencySymbol = '$';
const MARKET_OVERVIEW_CACHE_KEY = 'spulse.marketOverview.v1';
const MARKET_OVERVIEW_CACHE_TTL_MS = 45000;

// ── Color Palette ──
const COLORS = {
    blue: '#3b82f6',
    purple: '#8b5cf6',
    cyan: '#06b6d4',
    green: '#10b981',
    red: '#ef4444',
    orange: '#f59e0b',
    pink: '#ec4899',
    blueAlpha: 'rgba(59, 130, 246, 0.15)',
    greenAlpha: 'rgba(16, 185, 129, 0.15)',
    redAlpha: 'rgba(239, 68, 68, 0.15)',
    purpleAlpha: 'rgba(139, 92, 246, 0.15)',
};

const CHART_COLORS = [COLORS.blue, COLORS.purple, COLORS.cyan, COLORS.orange, COLORS.pink, COLORS.green];

// ── Utility Functions ──
function formatNumber(num) {
    if (num === null || num === undefined || isNaN(num)) return '--';
    if (Math.abs(num) >= 1e12) return (num / 1e12).toFixed(2) + 'T';
    if (Math.abs(num) >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (Math.abs(num) >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (Math.abs(num) >= 1e3) return (num / 1e3).toFixed(1) + 'K';
    return num.toLocaleString();
}

function currencyCodeToSymbol(code) {
    const normalized = (code || 'USD').toUpperCase();
    const map = {
        USD: '$',
        INR: '₹',
        EUR: '€',
        GBP: '£',
        JPY: '¥',
    };
    return map[normalized] || normalized;
}

function setCurrencySymbol(code) {
    currentCurrencySymbol = currencyCodeToSymbol(code);
    window.CURRENCY_SYMBOL = currentCurrencySymbol;
}

// Currency symbol is read from the page (set by backend) or falls back to $.
function getCurrencySymbol() {
    return window.CURRENCY_SYMBOL || currentCurrencySymbol || '$';
}

function formatPrice(num, currency) {
    if (num === null || num === undefined || isNaN(num)) return '--';
    const sym = currency || getCurrencySymbol();
    return sym + parseFloat(num).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

function showToast(message, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = { success: 'fa-check-circle', error: 'fa-exclamation-circle', info: 'fa-info-circle' };
    toast.innerHTML = `<i class="fas ${icons[type]}"></i><span>${message}</span>`;
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function getChartDefaults() {
    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    return {
        gridColor: isDark ? 'rgba(148, 163, 184, 0.06)' : 'rgba(15, 23, 42, 0.06)',
        textColor: isDark ? '#94a3b8' : '#475569',
        bgColor: isDark ? '#1a1f2e' : '#ffffff',
    };
}


// ── Theme Toggle ──
function initTheme() {
    const saved = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', saved);
    updateThemeIcon(saved);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateThemeIcon(next);
}

function updateThemeIcon(theme) {
    const btn = document.getElementById('themeToggle');
    if (btn) {
        btn.innerHTML = `<i class="fas fa-${theme === 'dark' ? 'sun' : 'moon'}"></i>`;
    }
}


// ── Sidebar Toggle ──
function initSidebar() {
    const sidebar  = document.getElementById('sidebar');
    const toggle   = document.getElementById('sidebarToggle');
    const mainContent = document.querySelector('.main-content');

    // --- Desktop collapse (existing behaviour) ---
    if (toggle) {
        toggle.addEventListener('click', () => {
            if (window.innerWidth > 768) {
                sidebar.classList.toggle('collapsed');
                if (mainContent) mainContent.classList.toggle('expanded');
                // Swap icon: bars ↔ chevron-right
                const icon = toggle.querySelector('i');
                if (icon) {
                    icon.className = sidebar.classList.contains('collapsed')
                        ? 'fas fa-chevron-right'
                        : 'fas fa-bars';
                }
            } else {
                openMobileSidebar();
            }
        });
    }

    // --- Inject overlay element once ---
    if (!document.getElementById('sidebarOverlay')) {
        const overlay = document.createElement('div');
        overlay.id = 'sidebarOverlay';
        overlay.className = 'sidebar-overlay';
        overlay.addEventListener('click', closeMobileSidebar);
        document.body.appendChild(overlay);
    }

    // --- Inject mobile hamburger button into topbar-left ---
    const topbarLeft = document.querySelector('.topbar-left');
    const existingMobileBtn = document.getElementById('mobileMenuBtn');
    if (existingMobileBtn) {
        // Button already exists in HTML — just attach the handler
        existingMobileBtn.addEventListener('click', openMobileSidebar);
    } else if (topbarLeft) {
        const mobileBtn = document.createElement('button');
        mobileBtn.id = 'mobileMenuBtn';
        mobileBtn.className = 'mobile-menu-btn';
        mobileBtn.setAttribute('aria-label', 'Open menu');
        mobileBtn.innerHTML = '<i class="fas fa-bars"></i>';
        mobileBtn.addEventListener('click', openMobileSidebar);
        topbarLeft.insertBefore(mobileBtn, topbarLeft.firstChild);
    }

    // Close sidebar on nav link click (mobile)
    if (sidebar) {
        sidebar.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                if (window.innerWidth <= 768) closeMobileSidebar();
            });
        });
    }
}

function openMobileSidebar() {
    const sidebar  = document.getElementById('sidebar');
    const overlay  = document.getElementById('sidebarOverlay');
    if (sidebar)  sidebar.classList.add('mobile-open');
    if (overlay)  overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeMobileSidebar() {
    const sidebar  = document.getElementById('sidebar');
    const overlay  = document.getElementById('sidebarOverlay');
    if (sidebar)  sidebar.classList.remove('mobile-open');
    if (overlay)  overlay.classList.remove('active');
    document.body.style.overflow = '';
}

// Close sidebar on window resize to desktop
window.addEventListener('resize', () => {
    if (window.innerWidth > 768) closeMobileSidebar();
});


// ── Date Display ──
function setCurrentDate() {
    const el = document.getElementById('currentDate');
    if (!el) return;
    function tick() {
        const now = new Date();
        const date = now.toLocaleDateString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });
        const time = now.toLocaleTimeString('en-US', {
            hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
        });
        el.textContent = `${date} · ${time}`;
    }
    tick();
    setInterval(tick, 1000);
}

// ── Market Status (Open if either US or India cash session is active) ──
function updateMarketStatus() {
    const now = new Date();

    // US equities (NYSE/NASDAQ): Mon-Fri 09:30-16:00 ET
    const etParts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        weekday: 'short',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
    }).formatToParts(now);

    const get = (type) => etParts.find(p => p.type === type)?.value || '';
    const usDayStr = get('weekday');
    const usHour = parseInt(get('hour'));
    const usMinute = parseInt(get('minute'));
    const usIsWeekend = usDayStr === 'Sat' || usDayStr === 'Sun';
    const usMin = usHour * 60 + usMinute;
    const usOpen = !usIsWeekend && usMin >= 9 * 60 + 30 && usMin < 16 * 60;

    // India equities (NSE/BSE): Mon-Fri 09:15-15:30 IST
    const istParts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Kolkata',
        weekday: 'short',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
    }).formatToParts(now);
    const getIst = (type) => istParts.find(p => p.type === type)?.value || '';
    const istDayStr = getIst('weekday');
    const istHour = parseInt(getIst('hour'));
    const istMinute = parseInt(getIst('minute'));
    const istIsWeekend = istDayStr === 'Sat' || istDayStr === 'Sun';
    const istMin = istHour * 60 + istMinute;
    const indiaOpen = !istIsWeekend && istMin >= 9 * 60 + 15 && istMin < 15 * 60 + 30;

    const marketIsOpen = usOpen || indiaOpen;

    document.querySelectorAll('.market-status').forEach(el => {
        const dot   = el.querySelector('.status-dot');
        const label = el.querySelector('span');
        if (dot)   dot.className   = marketIsOpen ? 'status-dot' : 'status-dot closed';
        if (label) label.textContent = marketIsOpen ? 'Market Open' : 'Market Closed';
    });
}


// ── Stock Search with Autocomplete ──
let _stockList = null;   // [{sym, name, cat}, ...]

async function loadStockList() {
    if (_stockList) return _stockList;
    try {
        const res = await fetch('/api/stock-categories');
        const data = await res.json();
        const names = data.stock_names || {};
        const cats  = data.categories || {};
        const list  = [];
        for (const [cat, syms] of Object.entries(cats)) {
            for (const sym of syms) {
                list.push({ sym, name: names[sym] || sym, cat });
            }
        }
        _stockList = list;
        return list;
    } catch (e) {
        console.error('Failed to load stock list', e);
        return [];
    }
}

function attachAutocomplete(input, onSelect) {
    // Create dropdown container
    let listEl = input.parentElement.querySelector('.autocomplete-list');
    if (!listEl) {
        listEl = document.createElement('div');
        listEl.className = 'autocomplete-list';
        input.parentElement.style.position = 'relative';
        input.parentElement.appendChild(listEl);
    }
    let activeIdx = -1;

    function renderItems(items) {
        activeIdx = -1;
        if (!items.length) { listEl.innerHTML = ''; return; }
        listEl.innerHTML = items.slice(0, 12).map((s, i) =>
            `<div class="autocomplete-item" data-idx="${i}" data-sym="${s.sym}">
                <span class="ac-sym">${s.sym}</span>
                <span class="ac-name">${s.name}</span>
                <span class="ac-cat">${s.cat}</span>
            </div>`
        ).join('');
    }

    function pick(sym) {
        input.value = sym;
        listEl.innerHTML = '';
        if (onSelect) onSelect(sym);
    }

    function highlight(idx) {
        const items = listEl.querySelectorAll('.autocomplete-item');
        items.forEach(el => el.classList.remove('active'));
        if (idx >= 0 && idx < items.length) {
            items[idx].classList.add('active');
            items[idx].scrollIntoView({ block: 'nearest' });
        }
        activeIdx = idx;
    }

    input.addEventListener('input', async () => {
        const q = input.value.trim().toLowerCase();
        if (q.length < 1) { listEl.innerHTML = ''; return; }
        const stocks = await loadStockList();
        const matches = stocks.filter(s =>
            s.sym.toLowerCase().includes(q) ||
            s.name.toLowerCase().includes(q)
        );
        renderItems(matches);
    });

    input.addEventListener('keydown', (e) => {
        const items = listEl.querySelectorAll('.autocomplete-item');
        if (!items.length) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            highlight(Math.min(activeIdx + 1, items.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            highlight(Math.max(activeIdx - 1, 0));
        } else if (e.key === 'Enter' && activeIdx >= 0) {
            e.preventDefault();
            pick(items[activeIdx].dataset.sym);
        } else if (e.key === 'Escape') {
            listEl.innerHTML = '';
        }
    });

    listEl.addEventListener('click', (e) => {
        const item = e.target.closest('.autocomplete-item');
        if (item) pick(item.dataset.sym);
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !listEl.contains(e.target)) {
            listEl.innerHTML = '';
        }
    });
}

function initSearch() {
    // Sidebar search (all pages)
    const sidebarInput = document.getElementById('stockSearch');
    if (sidebarInput) {
        attachAutocomplete(sidebarInput, (sym) => {
            currentSymbol = sym;
            if (typeof loadStockData === 'function') loadStockData(sym);
            if (typeof runAnalysis === 'function') {
                const analInput = document.getElementById('analysisSymbol');
                if (analInput) analInput.value = sym;
                runAnalysis(sym);
            }
            showToast(`Loading data for ${sym}...`, 'info');
        });

        // Keep Enter key working for manual entry too
        sidebarInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const acItems = sidebarInput.parentElement.querySelectorAll('.autocomplete-item.active');
                if (acItems.length) return; // autocomplete handled it
                const sym = sidebarInput.value.trim().toUpperCase();
                if (sym) {
                    currentSymbol = sym;
                    if (typeof loadStockData === 'function') loadStockData(sym);
                    if (typeof runAnalysis === 'function') {
                        const analInput = document.getElementById('analysisSymbol');
                        if (analInput) analInput.value = sym;
                        runAnalysis(sym);
                    }
                    showToast(`Loading data for ${sym}...`, 'info');
                    // Close autocomplete
                    const list = sidebarInput.parentElement.querySelector('.autocomplete-list');
                    if (list) list.innerHTML = '';
                }
            }
        });
    }

    // Analysis page symbol input
    const analysisInput = document.getElementById('analysisSymbol');
    if (analysisInput) {
        attachAutocomplete(analysisInput, (sym) => {
            if (typeof runAnalysis === 'function') runAnalysis(sym);
        });
    }

    // Compare page tag typing input
    const tagTyping = document.getElementById('tagTyping');
    if (tagTyping) {
        attachAutocomplete(tagTyping, (sym) => {
            if (typeof addTag === 'function') addTag(sym);
            tagTyping.value = '';
        });
    }
}


// ── Common Init ──
function initCommon() {
    // Pages using top header (no left sidebar) should not reserve sidebar space.
    if (!document.getElementById('sidebar')) {
        document.body.classList.add('no-sidebar');
    }

    initTheme();
    initSidebar();
    setCurrentDate();
    initSearch();
    initScrollTopButton();
    updateMarketStatus();
    setInterval(updateMarketStatus, 60000); // refresh every minute

    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
}


// ── Scroll To Top ──
function initScrollTopButton() {
    let btn = document.getElementById('scrollTopBtn');
    if (!btn) {
        btn = document.createElement('button');
        btn.id = 'scrollTopBtn';
        btn.className = 'scroll-top-btn';
        btn.setAttribute('aria-label', 'Scroll to top');
        btn.innerHTML = '<i class="fas fa-arrow-up"></i>';
        document.body.appendChild(btn);
    }

    const onScroll = () => {
        if (window.scrollY > 280) btn.classList.add('visible');
        else btn.classList.remove('visible');
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}


// ═══════════════════════════════════════════
// DASHBOARD FUNCTIONS
// ═══════════════════════════════════════════

async function initDashboard() {
    initCommon();
    
    // Period buttons
    document.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.period-btn').forEach(b => {
                b.classList.remove('active');
                b.removeAttribute('data-active');
            });
            btn.classList.add('active');
            btn.setAttribute('data-active', 'true');
            currentPeriod = btn.dataset.period;
            loadStockData(currentSymbol, currentPeriod);
        });
    });
    
    // Chart type dropdown
    const dashChartSel = document.getElementById('dashChartType');
    if (dashChartSel) {
        dashChartSel.addEventListener('change', () => {
            chartType = dashChartSel.value;
            if (lastDashData) {
                renderMainChart(lastDashData);
            } else {
                loadStockData(currentSymbol, currentPeriod);
            }
        });
    }

    // Also expose globally for onchange attribute
    window.switchDashChartType = function(type) {
        chartType = type;
        const sel = document.getElementById('dashChartType');
        if (sel && sel.value !== type) sel.value = type;
        if (lastDashData) {
            renderMainChart(lastDashData);
        } else {
            loadStockData(currentSymbol, currentPeriod);
        }
    };
    
    // Refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadStockData(currentSymbol, currentPeriod);
            loadMarketOverview({ forceRefresh: true });
            showToast('Refreshing data...', 'info');
        });
    }

    const refreshTrendingBtn = document.getElementById('refreshTrending');
    if (refreshTrendingBtn) {
        refreshTrendingBtn.addEventListener('click', () => {
            loadMarketOverview({ forceRefresh: true });
        });
    }
    
    // Load initial data
    loadStockData(currentSymbol, currentPeriod);
    loadMarketOverview();
}

async function loadStockData(symbol, period = '1mo') {
    const loading = document.getElementById('chartLoading');
    if (loading) loading.classList.remove('hidden');
    
    try {
        const res = await fetch(`/api/stock/${symbol}?period=${period}`);
        const data = await res.json();
        
        if (data.error) {
            showToast(data.error, 'error');
            return;
        }

        setCurrencySymbol(data.info?.currency || data.currency || 'USD');
        
        // Update stats
        updateQuickStats(data);
        updateStockDetails(data.info);
        
        // Update chart title
        const titleEl = document.getElementById('chartTitle');
        if (titleEl) titleEl.textContent = `${symbol} - ${data.info?.name || symbol}`;

        // Render charts
        renderMainChart(data);
        renderVolumeChart(data);

        // Store data and update text view
        lastDashData = { ...data, symbol };
        if (typeof renderDashTextReport === 'function') renderDashTextReport(lastDashData);
        
        if (loading) loading.classList.add('hidden');
    } catch (err) {
        showToast('Failed to load stock data', 'error');
        console.error(err);
        if (loading) loading.classList.add('hidden');
    }
}

function updateQuickStats(data) {
    document.getElementById('statPrice').textContent = formatPrice(data.current_price);
    
    const changeEl = document.getElementById('statChange');
    const changeIcon = document.getElementById('statChangeIcon');
    const isPositive = data.change >= 0;
    
    changeEl.textContent = `${isPositive ? '+' : ''}${data.change} (${isPositive ? '+' : ''}${data.change_pct}%)`;
    changeEl.className = `stat-value ${isPositive ? 'positive' : 'negative'}`;
    changeIcon.className = `stat-icon ${isPositive ? 'green' : 'red'}`;
    changeIcon.innerHTML = `<i class="fas fa-arrow-${isPositive ? 'up' : 'down'}"></i>`;
    
    const vol = data.volume?.[data.volume.length - 1];
    document.getElementById('statVolume').textContent = formatNumber(vol);
    
    document.getElementById('statMarketCap').textContent = formatNumber(data.info?.marketCap);
}

function updateStockDetails(info) {
    if (!info) return;
    const sets = {
        'detSector': info.sector,
        'detIndustry': info.industry,
        'detPE': info.peRatio ? parseFloat(info.peRatio).toFixed(2) : 'N/A',
        'detEPS': info.eps ? formatPrice(info.eps) : 'N/A',
        'det52H': info.fiftyTwoWeekHigh ? formatPrice(info.fiftyTwoWeekHigh) : 'N/A',
        'det52L': info.fiftyTwoWeekLow ? formatPrice(info.fiftyTwoWeekLow) : 'N/A',
        'detBeta': info.beta ? parseFloat(info.beta).toFixed(2) : 'N/A',
        'detAvgVol': formatNumber(info.avgVolume),
        'detDivYield': info.dividendYield ? (info.dividendYield * 100).toFixed(2) + '%' : 'N/A',
        'detCurrency': info.currency || 'USD',
    };
    
    for (const [id, val] of Object.entries(sets)) {
        const el = document.getElementById(id);
        if (el) el.textContent = val || 'N/A';
    }
}

function renderMainChart(data) {
    const ctx = document.getElementById('mainChart');
    if (!ctx) return;
    
    if (mainChart) mainChart.destroy();
    
    const defaults = getChartDefaults();
    
    let datasets = [];
    
    if (chartType === 'area') {
        datasets = [{
            label: currentSymbol,
            data: data.close,
            borderColor: COLORS.blue,
            backgroundColor: createGradient(ctx, COLORS.blue),
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHitRadius: 10,
        }];
    } else if (chartType === 'candlestick') {
        // Simulate candlestick with bar colors
        const colors = data.close.map((close, i) => {
            const open = data.open[i];
            return close >= open ? COLORS.green : COLORS.red;
        });
        
        datasets = [{
            label: `${currentSymbol} Close`,
            data: data.close,
            borderColor: COLORS.blue,
            backgroundColor: 'transparent',
            borderWidth: 2,
            tension: 0.1,
            pointRadius: 0,
            pointHitRadius: 10,
        }, {
            label: 'High',
            data: data.high,
            borderColor: 'rgba(16, 185, 129, 0.3)',
            borderWidth: 1,
            borderDash: [5, 5],
            tension: 0.1,
            pointRadius: 0,
            fill: false,
        }, {
            label: 'Low',
            data: data.low,
            borderColor: 'rgba(239, 68, 68, 0.3)',
            borderWidth: 1,
            borderDash: [5, 5],
            tension: 0.1,
            pointRadius: 0,
            fill: false,
        }];
    } else if (chartType === 'bar') {
        const barColors = data.close.map((close, i) => {
            if (i === 0) return COLORS.blueAlpha;
            return close >= data.close[i-1] ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)';
        });
        datasets = [{
            label: currentSymbol,
            data: data.close,
            backgroundColor: barColors,
            borderRadius: 3,
        }];
    } else {
        datasets = [{
            label: currentSymbol,
            data: data.close,
            borderColor: COLORS.blue,
            backgroundColor: 'transparent',
            borderWidth: 2.5,
            tension: 0.4,
            pointRadius: 0,
            pointHitRadius: 10,
            pointHoverRadius: 5,
            pointHoverBackgroundColor: COLORS.blue,
        }];
    }
    
    const isBar = chartType === 'bar';
    mainChart = new Chart(ctx, {
        type: isBar ? 'bar' : 'line',
        data: { labels: data.dates, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    display: datasets.length > 1,
                    labels: {
                        color: defaults.textColor,
                        usePointStyle: true,
                        padding: 15,
                        font: { size: 13, weight: '700' }
                    }
                },
                tooltip: {
                    backgroundColor: defaults.bgColor,
                    titleColor: defaults.textColor,
                    bodyColor: defaults.textColor,
                    borderColor: 'rgba(148, 163, 184, 0.2)',
                    borderWidth: 1,
                    padding: 12,
                    titleFont: { size: 13, weight: '700' },
                    bodyFont: { size: 12, weight: '600' },
                    displayColors: true,
                    callbacks: {
                        label: ctx => `${ctx.dataset.label}: ${formatPrice(ctx.parsed.y)}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: defaults.gridColor, drawBorder: false },
                    ticks: { color: defaults.textColor, maxTicksLimit: 10, font: { size: 12, weight: '700' } },
                },
                y: {
                    grid: { color: defaults.gridColor, drawBorder: false },
                    ticks: { color: defaults.textColor, font: { size: 12, weight: '700' }, callback: v => formatPrice(v) },
                    position: 'right',
                }
            }
        }
    });
}

function renderVolumeChart(data) {
    const ctx = document.getElementById('volumeChart');
    if (!ctx) return;
    
    if (volumeChart) volumeChart.destroy();
    
    const defaults = getChartDefaults();
    const colors = data.close.map((close, i) => {
        if (i === 0) return COLORS.blueAlpha;
        return close >= data.close[i-1] ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)';
    });
    
    volumeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.dates,
            datasets: [{
                label: 'Volume',
                data: data.volume,
                backgroundColor: colors,
                borderRadius: 2,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: defaults.bgColor,
                    titleColor: defaults.textColor,
                    bodyColor: defaults.textColor,
                    borderColor: 'rgba(148, 163, 184, 0.2)',
                    borderWidth: 1,
                    titleFont: { size: 13, weight: '700' },
                    bodyFont: { size: 12, weight: '600' },
                    callbacks: { label: ctx => 'Vol: ' + formatNumber(ctx.parsed.y) }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: defaults.textColor, maxTicksLimit: 8, font: { size: 11, weight: '700' } }
                },
                y: {
                    grid: { color: defaults.gridColor, drawBorder: false },
                    ticks: { color: defaults.textColor, font: { size: 11, weight: '700' }, callback: v => formatNumber(v) },
                    position: 'right',
                }
            }
        }
    });
}

function createGradient(ctx, color) {
    const canvas = ctx.getContext ? ctx : ctx.canvas;
    const context = canvas.getContext('2d');
    const gradient = context.createLinearGradient(0, 0, 0, 350);
    gradient.addColorStop(0, color.replace(')', ', 0.3)').replace('rgb', 'rgba'));
    gradient.addColorStop(1, color.replace(')', ', 0.01)').replace('rgb', 'rgba'));
    return gradient;
}

function readMarketOverviewCache() {
    try {
        const raw = sessionStorage.getItem(MARKET_OVERVIEW_CACHE_KEY);
        if (!raw) return null;
        const cached = JSON.parse(raw);
        if (!cached || !cached.timestamp || !cached.data) return null;
        if ((Date.now() - cached.timestamp) > MARKET_OVERVIEW_CACHE_TTL_MS) return null;
        return cached.data;
    } catch (_err) {
        return null;
    }
}

function writeMarketOverviewCache(data) {
    try {
        sessionStorage.setItem(MARKET_OVERVIEW_CACHE_KEY, JSON.stringify({
            timestamp: Date.now(),
            data,
        }));
    } catch (_err) {
        // Ignore storage failures in private mode.
    }
}

async function loadMarketOverview(options = {}) {
    const forceRefresh = Boolean(options.forceRefresh);

    if (!forceRefresh) {
        const cached = readMarketOverviewCache();
        if (cached) {
            renderTicker(cached.indices || []);
            renderTrending(cached.trending || []);
        }
    }

    try {
        const res = await fetch('/api/market/overview', { cache: 'no-store' });
        const data = await res.json();
        
        if (data.error) return;
        
        // Render ticker
        renderTicker(data.indices || []);
        
        // Render trending
        renderTrending(data.trending || []);

        writeMarketOverviewCache({
            indices: data.indices || [],
            trending: data.trending || [],
        });
        
    } catch (err) {
        console.error('Market overview error:', err);
    }
}

function renderTicker(indices) {
    const container = document.getElementById('tickerContent');
    if (!container || !Array.isArray(indices) || indices.length === 0) return;
    
    const items = indices.map(idx => `
        <div class="ticker-item">
            <span class="ticker-name">${idx.name}</span>
            <span class="ticker-price">${formatPrice(idx.price)}</span>
            <span class="ticker-change ${idx.change >= 0 ? 'positive' : 'negative'}">
                ${idx.change >= 0 ? '+' : ''}${idx.change_pct}%
            </span>
        </div>
    `).join('');
    
    container.innerHTML = items + items; // Duplicate for seamless scroll

    // More items can scroll a bit faster while keeping readability.
    const perItemSeconds = 2.2;
    const durationSeconds = Math.max(12, Math.min(30, indices.length * perItemSeconds));
    container.style.setProperty('--ticker-duration', `${durationSeconds}s`);
}

function renderTrending(stocks) {
    const container = document.getElementById('trendingList');
    if (!container || !stocks) return;
    
    container.innerHTML = stocks.map(s => `
        <div class="trending-item" onclick="currentSymbol='${s.symbol}';loadStockData('${s.symbol}')">
            <div>
                <div class="trending-symbol">${s.symbol}</div>
                <div style="font-size:0.75rem;color:var(--text-muted);">Vol: ${formatNumber(s.volume)}</div>
            </div>
            <div style="text-align:right;">
                <div class="trending-price">${formatPrice(s.price)}</div>
                <div class="trending-change ${s.change >= 0 ? 'positive bg-positive' : 'negative bg-negative'}">
                    ${s.change >= 0 ? '+' : ''}${s.change_pct}%
                </div>
            </div>
        </div>
    `).join('');
}


// ── Make functions globally available ──
window.initDashboard = initDashboard;
window.loadStockData = loadStockData;
window.initCommon = initCommon;
window.showToast = showToast;
window.formatPrice = formatPrice;
window.formatNumber = formatNumber;
window.getChartDefaults = getChartDefaults;
window.COLORS = COLORS;
window.CHART_COLORS = CHART_COLORS;
window.currentSymbol = currentSymbol;

// ── LIVE GRAPH FUNCTIONS ──
const LIVE_TICKER = 'NSEI'; // NIFTY 50
let liveFailCount = 0;
let liveLoadingTimeout = null;

function initLiveGraph() {
    const ctx = document.getElementById('liveStockChart');
    if (!ctx) return;

    const defaults = getChartDefaults();

    liveChart = new Chart(ctx, {
        type: 'line',
        data: {
            datasets: [{
                label: 'NIFTY 50 Live Price',
                data: [],
                borderColor: COLORS.cyan,
                backgroundColor: createGradient(ctx, COLORS.cyan),
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'minute',
                        tooltipFormat: 'hh:mm:ss a',
                        displayFormats: {
                            minute: 'h:mm a'
                        }
                    },
                    grid: { color: defaults.gridColor, drawBorder: false },
                    ticks: { color: defaults.textColor, maxTicksLimit: 10, font: { size: 12, weight: '700' } },
                },
                y: {
                    grid: { color: defaults.gridColor, drawBorder: false },
                    ticks: { color: defaults.textColor, font: { size: 12, weight: '700' }, callback: v => formatPrice(v) },
                    position: 'right',
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    titleFont: { size: 13, weight: '700' },
                    bodyFont: { size: 12, weight: '600' },
                    callbacks: {
                        label: (context) => `Price: ${formatPrice(context.parsed.y)}`
                    }
                }
            }
        }
    });

    // Set timeout to force-hide loading overlay after 8 seconds if still visible
    const loadingEl = document.getElementById('liveChartLoading');
    if (loadingEl && liveLoadingTimeout) clearTimeout(liveLoadingTimeout);
    if (loadingEl) {
        liveLoadingTimeout = setTimeout(() => {
            const overlay = document.getElementById('liveChartLoading');
            if (overlay && !overlay.classList.contains('hidden')) {
                overlay.classList.add('hidden');
                const spinner = overlay.querySelector('.spinner');
                if (spinner) spinner.style.display = 'none';
            }
        }, 8000);
    }

    startLiveFeed();
}

async function fetchLivePrice() {
    const loadingEl = document.getElementById('liveChartLoading');
    try {
        const res = await fetch(`/api/live_price/${LIVE_TICKER}`);
        if (!res.ok) {
            const errorBody = await res.text();
            console.error('Failed to fetch live price:', res.status, errorBody);
            liveFailCount += 1;
            if (loadingEl) {
                const msg = loadingEl.querySelector('span');
                if (msg) msg.textContent = liveFailCount >= 3 ? 'Live feed delayed. Retrying in background...' : 'Live feed delayed, retrying...';
                if (liveFailCount >= 3) {
                    const spinner = loadingEl.querySelector('.spinner');
                    if (spinner) spinner.style.display = 'none';
                    loadingEl.classList.add('hidden');
                    if (liveLoadingTimeout) clearTimeout(liveLoadingTimeout);
                }
            }
            return;
        }
        const data = await res.json();
        if (data && (data.price === undefined || data.price === null || Number.isNaN(Number(data.price)))) {
            liveFailCount += 1;
            if (loadingEl && liveFailCount >= 3) {
                loadingEl.classList.add('hidden');
                if (liveLoadingTimeout) clearTimeout(liveLoadingTimeout);
            }
            return;
        }
        liveFailCount = 0;
        const newPoint = {
            x: new Date(), // Use current time
            y: data.price
        };

        if (liveChart && liveChart.data && liveChart.data.datasets && liveChart.data.datasets[0]) {
            liveChart.data.datasets[0].data.push(newPoint);

            // Keep the chart to a reasonable size, e.g., last 100 points
            const maxDataPoints = 100;
            if (liveChart.data.datasets[0].data.length > maxDataPoints) {
                liveChart.data.datasets[0].data.shift();
            }

            liveChart.update('quiet');
        }
        
        if (loadingEl) {
            const spinner = loadingEl.querySelector('.spinner');
            if (spinner) spinner.style.display = 'none';
            loadingEl.classList.add('hidden');
            if (liveLoadingTimeout) clearTimeout(liveLoadingTimeout);
        }

    } catch (error) {
        console.error('Error fetching live price:', error);
        liveFailCount += 1;
        // Try fallback using the latest close from stock endpoint.
        try {
            const backupRes = await fetch(`/api/stock/${LIVE_TICKER}?period=5d`);
            if (!backupRes.ok) {
                if (loadingEl) {
                    const msg = loadingEl.querySelector('span');
                    if (msg) msg.textContent = liveFailCount >= 3 ? 'Live feed delayed. Retrying in background...' : 'Live feed unavailable, retrying...';
                    if (liveFailCount >= 3) {
                        const spinner = loadingEl.querySelector('.spinner');
                        if (spinner) spinner.style.display = 'none';
                        loadingEl.classList.add('hidden');
                        if (liveLoadingTimeout) clearTimeout(liveLoadingTimeout);
                    }
                }
                return;
            }
            const backup = await backupRes.json();
            const latest = backup?.close?.[backup.close.length - 1];
            if (latest !== undefined && latest !== null) {
                liveFailCount = 0;
                if (liveChart && liveChart.data && liveChart.data.datasets && liveChart.data.datasets[0]) {
                    liveChart.data.datasets[0].data.push({ x: new Date(), y: latest });
                    if (liveChart.data.datasets[0].data.length > 100) {
                        liveChart.data.datasets[0].data.shift();
                    }
                    liveChart.update('quiet');
                }
                if (loadingEl) {
                    const msg = loadingEl.querySelector('span');
                    if (msg) msg.textContent = 'Showing delayed data';
                    const spinner = loadingEl.querySelector('.spinner');
                    if (spinner) spinner.style.display = 'none';
                    loadingEl.classList.add('hidden');
                    if (liveLoadingTimeout) clearTimeout(liveLoadingTimeout);
                }
            }
        } catch (fallbackError) {
            console.error('Fallback live price fetch failed:', fallbackError);
            if (loadingEl && liveFailCount >= 3) {
                const msg = loadingEl.querySelector('span');
                if (msg) msg.textContent = 'Live data unavailable - retrying in background';
                const spinner = loadingEl.querySelector('.spinner');
                if (spinner) spinner.style.display = 'none';
                loadingEl.classList.add('hidden');
                if (liveLoadingTimeout) clearTimeout(liveLoadingTimeout);
            }
        }
    }
}

function startLiveFeed() {
    if (liveInterval) {
        clearInterval(liveInterval);
    }
    // Fetch initial price immediately, then every 15 seconds
    fetchLivePrice();
    liveInterval = setInterval(fetchLivePrice, 15000);
}

function stopLiveFeed() {
    if (liveInterval) {
        clearInterval(liveInterval);
        liveInterval = null;
    }
}
