/* ═══════════════════════════════════════════════════════════
   Realtime S Pulse - Core Application JavaScript
   ═══════════════════════════════════════════════════════════ */

// ── Global State ──
let currentSymbol = 'AAPL';
let currentPeriod = '1mo';
let mainChart = null;
let volumeChart = null;
let chartType = 'line';
let lastDashData = null;
let dashView = 'graph';

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

// Currency symbol is read from the page (set by backend) or falls back to ₹
function getCurrencySymbol() {
    return window.CURRENCY_SYMBOL || '₹';
}

function formatPrice(num, currency) {
    if (num === null || num === undefined || isNaN(num)) return '--';
    const sym = currency || getCurrencySymbol();
    return sym + parseFloat(num).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
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
    const toggle = document.getElementById('sidebarToggle');
    if (toggle) {
        toggle.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('collapsed');
            document.querySelector('.main-content').classList.toggle('expanded');
        });
    }
}


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

// ── Market Status (NYSE hours: Mon–Fri 9:30–16:00 ET) ──
function updateMarketStatus() {
    const now = new Date();

    // Get current date/time parts in Eastern Time
    const etParts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        weekday: 'short',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
    }).formatToParts(now);

    const get = (type) => etParts.find(p => p.type === type)?.value || '';
    const dayStr   = get('weekday');          // 'Mon', 'Tue', …
    const hour     = parseInt(get('hour'));    // 0–23
    const minute   = parseInt(get('minute')); // 0–59
    const year     = get('year');
    const month    = get('month');
    const day      = get('day');
    const dateStr  = `${year}-${month}-${day}`; // 'YYYY-MM-DD'

    // Weekend check
    const isWeekend = dayStr === 'Sat' || dayStr === 'Sun';

    // NYSE time window in minutes
    const timeMin   = hour * 60 + minute;
    const openMin   = 9 * 60 + 30;   // 09:30
    const closeMin  = 16 * 60;       // 16:00
    const inHours   = timeMin >= openMin && timeMin < closeMin;

    // NYSE holidays (add/update as needed)
    const holidays = new Set([
        '2026-01-01','2026-01-19','2026-02-16','2026-04-03',
        '2026-05-25','2026-07-03','2026-09-07','2026-11-26',
        '2026-11-27','2026-12-25',
        '2025-01-01','2025-01-20','2025-02-17','2025-04-18',
        '2025-05-26','2025-07-04','2025-09-01','2025-11-27',
        '2025-11-28','2025-12-25',
    ]);
    const isHoliday = holidays.has(dateStr);

    const marketIsOpen = !isWeekend && !isHoliday && inHours;

    document.querySelectorAll('.market-status').forEach(el => {
        const dot   = el.querySelector('.status-dot');
        const label = el.querySelector('span');
        if (dot)   dot.className   = marketIsOpen ? 'status-dot' : 'status-dot closed';
        if (label) label.textContent = marketIsOpen ? 'Market Open' : 'Market Closed';
    });
}


// ── Stock Search ──
function initSearch() {
    const input = document.getElementById('stockSearch');
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const sym = input.value.trim().toUpperCase();
                if (sym) {
                    currentSymbol = sym;
                    if (typeof loadStockData === 'function') loadStockData(sym);
                    if (typeof runAnalysis === 'function') {
                        document.getElementById('analysisSymbol').value = sym;
                        runAnalysis(sym);
                    }
                    showToast(`Loading data for ${sym}...`, 'info');
                }
            }
        });
    }
}


// ── Common Init ──
function initCommon() {
    initTheme();
    initSidebar();
    setCurrentDate();
    initSearch();
    updateMarketStatus();
    setInterval(updateMarketStatus, 60000); // refresh every minute

    const themeBtn = document.getElementById('themeToggle');
    if (themeBtn) themeBtn.addEventListener('click', toggleTheme);
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
    
    // Chart type buttons
    document.querySelectorAll('.chart-type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.chart-type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            chartType = btn.dataset.type;
            loadStockData(currentSymbol, currentPeriod);
        });
    });
    
    // Refresh button
    const refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadStockData(currentSymbol, currentPeriod);
            loadMarketOverview();
            showToast('Refreshing data...', 'info');
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
    
    mainChart = new Chart(ctx, {
        type: 'line',
        data: { labels: data.dates, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { display: datasets.length > 1, labels: { color: defaults.textColor, usePointStyle: true, padding: 15 }},
                tooltip: {
                    backgroundColor: defaults.bgColor,
                    titleColor: defaults.textColor,
                    bodyColor: defaults.textColor,
                    borderColor: 'rgba(148, 163, 184, 0.2)',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true,
                    callbacks: {
                        label: ctx => `${ctx.dataset.label}: ${formatPrice(ctx.parsed.y)}`
                    }
                }
            },
            scales: {
                x: {
                    grid: { color: defaults.gridColor, drawBorder: false },
                    ticks: { color: defaults.textColor, maxTicksLimit: 10, font: { size: 11 } },
                },
                y: {
                    grid: { color: defaults.gridColor, drawBorder: false },
                    ticks: { color: defaults.textColor, font: { size: 11 }, callback: v => formatPrice(v) },
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
                    callbacks: { label: ctx => 'Vol: ' + formatNumber(ctx.parsed.y) }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: defaults.textColor, maxTicksLimit: 8, font: { size: 10 } }
                },
                y: {
                    grid: { color: defaults.gridColor, drawBorder: false },
                    ticks: { color: defaults.textColor, font: { size: 10 }, callback: v => formatNumber(v) },
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

async function loadMarketOverview() {
    try {
        const res = await fetch('/api/market/overview');
        const data = await res.json();
        
        if (data.error) return;
        
        // Render ticker
        renderTicker(data.indices);
        
        // Render trending
        renderTrending(data.trending);
        
    } catch (err) {
        console.error('Market overview error:', err);
    }
}

function renderTicker(indices) {
    const container = document.getElementById('tickerContent');
    if (!container || !indices) return;
    
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

/* ── Dashboard View Toggle ─────────────────────────────── */
function switchDashView(view) {
    dashView = view;
    const isGraph = view === 'graph';
    const gv = document.getElementById('dashGraphView');
    const tv = document.getElementById('dashTextView');
    const btnG = document.getElementById('btnDashGraph');
    const btnT = document.getElementById('btnDashText');
    if (gv) gv.style.display = isGraph ? '' : 'none';
    if (tv) tv.style.display = isGraph ? 'none' : '';
    if (btnG) btnG.classList.toggle('active', isGraph);
    if (btnT) btnT.classList.toggle('active', !isGraph);
}

function renderDashTextReport(data) {
    const el = document.getElementById('dashTextReport');
    if (!el) return;

    const sym = data.symbol || currentSymbol;
    const now = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
    const info = data.info || {};
    const isPos = data.change >= 0;
    const changeCls = isPos ? 'tr-positive' : 'tr-negative';
    const lastClose = data.close?.[data.close.length - 1];
    const vol = data.volume?.[data.volume.length - 1];

    const metrics = [
        { label: 'Current Price',   value: formatPrice(data.current_price) },
        { label: 'Change',          value: `${isPos ? '+' : ''}${data.change} (${isPos ? '+' : ''}${data.change_pct}%)`, cls: changeCls },
        { label: 'Volume',          value: formatNumber(vol) },
        { label: 'Market Cap',      value: formatNumber(info.marketCap) },
        { label: 'Sector',          value: info.sector || 'N/A' },
        { label: 'Industry',        value: info.industry || 'N/A' },
        { label: 'P/E Ratio',       value: info.peRatio ? parseFloat(info.peRatio).toFixed(2) : 'N/A' },
        { label: 'EPS',             value: info.eps ? formatPrice(info.eps) : 'N/A' },
        { label: '52W High',        value: info.fiftyTwoWeekHigh ? formatPrice(info.fiftyTwoWeekHigh) : 'N/A' },
        { label: '52W Low',         value: info.fiftyTwoWeekLow  ? formatPrice(info.fiftyTwoWeekLow)  : 'N/A' },
        { label: 'Beta',            value: info.beta ? parseFloat(info.beta).toFixed(2) : 'N/A' },
        { label: 'Avg Volume',      value: formatNumber(info.avgVolume) },
        { label: 'Dividend Yield',  value: info.dividendYield ? (info.dividendYield * 100).toFixed(2) + '%' : 'N/A' },
        { label: 'Currency',        value: info.currency || 'USD' },
    ];

    const metricCards = metrics.map(m => `
        <div class="tr-metric">
            <span class="tr-metric-label">${m.label}</span>
            <span class="tr-metric-value ${m.cls || ''}">${m.value}</span>
        </div>`).join('');

    // Price range summary from available close data
    let priceSummary = '';
    if (data.close && data.close.length) {
        const hi = Math.max(...data.close);
        const lo = Math.min(...data.close);
        const open = data.close[0];
        const periodChg = ((lastClose - open) / open * 100).toFixed(2);
        const periodCls = periodChg >= 0 ? 'tr-positive' : 'tr-negative';
        priceSummary = `
        <div class="tr-section">
            <div class="tr-section-title">Period Summary (${currentPeriod})</div>
            <ul class="tr-highlights">
                <li>📍 <strong>Period Open:</strong> ${formatPrice(open)}</li>
                <li>📍 <strong>Period Close:</strong> ${formatPrice(lastClose)}</li>
                <li>📈 <strong>Period High:</strong> ${formatPrice(hi)}</li>
                <li>📉 <strong>Period Low:</strong> ${formatPrice(lo)}</li>
                <li>🔄 <strong>Period Return:</strong> <span class="${periodCls}">${periodChg >= 0 ? '+' : ''}${periodChg}%</span></li>
            </ul>
        </div>`;
    }

    el.innerHTML = `
    <div class="text-report">
        <div class="tr-header">
            <div class="tr-title"><i class="fas fa-th-large"></i> Dashboard — ${sym} ${info.name ? '· ' + info.name : ''}</div>
            <div class="tr-date">${now}</div>
        </div>
        <div class="tr-section">
            <div class="tr-section-title">Key Metrics</div>
            <div class="tr-metrics" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:0.75rem;">
                ${metricCards}
            </div>
        </div>
        ${priceSummary}
    </div>`;
}

window.switchDashView = switchDashView;
window.renderDashTextReport = renderDashTextReport;
