/* =====================================================
   WATCHLIST & PORTFOLIO TRACKER  –  watchlist.js
   =====================================================*/

(function () {
    'use strict';

    /* ── state ────────────────────────────────────── */
    let watchStocks = [];
    let portfolio   = [];
    let livePrices  = {};          // sym → { price, change, change_pct, … }
    let allocationChart = null;
    let plChart         = null;

    /* ── DOM refs ─────────────────────────────────── */
    const $watchTable     = document.getElementById('watchlistTable');
    const $portfolioTable = document.getElementById('portfolioTable');
    const $addWatchInput  = document.getElementById('addWatchSymbol');
    const $btnAddWatch    = document.getElementById('btnAddWatch');
    const $btnAddPos      = document.getElementById('btnAddPosition');
    const $posForm        = document.getElementById('addPositionForm');
    const $btnSavePos     = document.getElementById('btnSavePosition');
    const $btnCancelPos   = document.getElementById('btnCancelPosition');
    const $refreshBtn     = document.getElementById('refreshBtn');

    /* ── helpers ──────────────────────────────────── */
    function fmt(n) {
        if (n === undefined || n === null || isNaN(n)) return '--';
        if (typeof window.formatPrice === 'function') return window.formatPrice(Number(n));
        return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    function fmtPct(n) {
        if (n === undefined || n === null || isNaN(n)) return '0.00%';
        return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
    }
    function cls(n) { return n >= 0 ? 'positive' : 'negative'; }
    function arrow(n) { return n >= 0 ? 'fa-caret-up' : 'fa-caret-down'; }
    function toast(msg, type) {
        if (typeof window.showToast === 'function') { window.showToast(msg, type); return; }
        const c = document.getElementById('toastContainer');
        if (!c) return;
        const t = document.createElement('div');
        t.className = 'toast ' + (type || 'info');
        t.textContent = msg;
        c.appendChild(t);
        setTimeout(() => t.remove(), 3500);
    }
    function fmtVolume(v) {
        if (!v) return '--';
        if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
        if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
        if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
        return v.toString();
    }

    /* ── API calls ────────────────────────────────── */
    async function fetchWatchlist() {
        try {
            const res = await fetch('/api/watchlist');
            const data = await res.json();
            watchStocks = data.stocks || [];
            portfolio   = data.portfolio || [];
        } catch (e) {
            console.error('Failed to load watchlist', e);
        }
    }

    async function fetchPrices(symbols) {
        if (!symbols.length) return;
        try {
            const res = await fetch('/api/watchlist/prices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbols }),
            });
            const data = await res.json();
            Object.assign(livePrices, data);
        } catch (e) {
            console.error('Failed to fetch prices', e);
        }
    }

    async function addSymbol(symbol) {
        const res = await fetch('/api/watchlist/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbol }),
        });
        return res.json();
    }

    async function removeSymbol(symbol) {
        const res = await fetch('/api/watchlist/remove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbol }),
        });
        return res.json();
    }

    async function addPortfolioPosition(symbol, buy_price, quantity) {
        const res = await fetch('/api/portfolio/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbol, buy_price, quantity }),
        });
        return res.json();
    }

    async function removePortfolioPosition(idx) {
        const res = await fetch('/api/portfolio/remove', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ index: idx }),
        });
        return res.json();
    }

    /* ── render watchlist table ───────────────────── */
    function renderWatchlist() {
        if (!watchStocks.length) {
            $watchTable.innerHTML = `
                <div style="text-align:center;padding:2.5rem 1rem;color:var(--text-secondary);">
                    <i class="fas fa-star" style="font-size:2.5rem;opacity:0.25;margin-bottom:0.75rem;display:block;"></i>
                    <p style="font-size:1rem;font-weight:500;">Your watchlist is empty</p>
                    <p style="font-size:0.85rem;opacity:0.7;margin-top:0.25rem;">Add stocks above to start tracking them in real time.</p>
                </div>`;
            return;
        }

        let html = `<div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:0.88rem;">
            <thead>
                <tr style="text-align:left;color:var(--text-secondary);font-weight:600;border-bottom:1px solid var(--border-color);">
                    <th style="padding:0.6rem 0.75rem;">Symbol</th>
                    <th style="padding:0.6rem 0.75rem;">Name</th>
                    <th style="padding:0.6rem 0.75rem;text-align:right;">Price</th>
                    <th style="padding:0.6rem 0.75rem;text-align:right;">Change</th>
                    <th style="padding:0.6rem 0.75rem;text-align:right;">High</th>
                    <th style="padding:0.6rem 0.75rem;text-align:right;">Low</th>
                    <th style="padding:0.6rem 0.75rem;text-align:right;">Volume</th>
                    <th style="padding:0.6rem 0.75rem;text-align:center;">Action</th>
                </tr>
            </thead>
            <tbody>`;

        watchStocks.forEach(sym => {
            const d = livePrices[sym] || {};
            const has = !d.error && d.price !== undefined;
            const chClass = has ? cls(d.change_pct) : '';
            html += `
                <tr style="border-bottom:1px solid var(--border-color);">
                    <td style="padding:0.6rem 0.75rem;font-weight:600;font-family:'JetBrains Mono',monospace;color:var(--primary);">${sym}</td>
                    <td style="padding:0.6rem 0.75rem;color:var(--text-secondary);">${has ? d.name : '--'}</td>
                    <td style="padding:0.6rem 0.75rem;text-align:right;font-weight:600;">${has ? fmt(d.price) : '--'}</td>
                    <td style="padding:0.6rem 0.75rem;text-align:right;" class="${chClass}">
                        ${has ? '<i class="fas ' + arrow(d.change_pct) + '"></i> ' + fmt(d.change) + ' (' + fmtPct(d.change_pct) + ')' : '--'}
                    </td>
                    <td style="padding:0.6rem 0.75rem;text-align:right;">${has ? fmt(d.high) : '--'}</td>
                    <td style="padding:0.6rem 0.75rem;text-align:right;">${has ? fmt(d.low) : '--'}</td>
                    <td style="padding:0.6rem 0.75rem;text-align:right;">${has ? fmtVolume(d.volume) : '--'}</td>
                    <td style="padding:0.6rem 0.75rem;text-align:center;">
                        <button class="wl-remove-btn" data-sym="${sym}" title="Remove" style="background:none;border:none;color:var(--text-secondary);cursor:pointer;font-size:1rem;transition:color .2s;">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </td>
                </tr>`;
        });

        html += '</tbody></table></div>';
        $watchTable.innerHTML = html;

        // bind remove buttons
        $watchTable.querySelectorAll('.wl-remove-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const sym = btn.dataset.sym;
                btn.disabled = true;
                const res = await removeSymbol(sym);
                if (res.success) {
                    watchStocks = res.stocks;
                    renderWatchlist();
                    updateStats();
                    toast(sym + ' removed from watchlist', 'info');
                }
            });
        });
    }

    /* ── render portfolio table ───────────────────── */
    function renderPortfolio() {
        if (!portfolio.length) {
            $portfolioTable.innerHTML = `
                <div style="text-align:center;padding:2.5rem 1rem;color:var(--text-secondary);">
                    <i class="fas fa-briefcase" style="font-size:2.5rem;opacity:0.25;margin-bottom:0.75rem;display:block;"></i>
                    <p style="font-size:1rem;font-weight:500;">No positions yet</p>
                    <p style="font-size:0.85rem;opacity:0.7;margin-top:0.25rem;">Click "Add Position" to track your investments and P&L.</p>
                </div>`;
            return;
        }

        let html = `<div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:0.88rem;">
            <thead>
                <tr style="text-align:left;color:var(--text-secondary);font-weight:600;border-bottom:1px solid var(--border-color);">
                    <th style="padding:0.6rem 0.75rem;">Symbol</th>
                    <th style="padding:0.6rem 0.75rem;text-align:right;">Qty</th>
                    <th style="padding:0.6rem 0.75rem;text-align:right;">Buy Price</th>
                    <th style="padding:0.6rem 0.75rem;text-align:right;">Current</th>
                    <th style="padding:0.6rem 0.75rem;text-align:right;">Invested</th>
                    <th style="padding:0.6rem 0.75rem;text-align:right;">Cur. Value</th>
                    <th style="padding:0.6rem 0.75rem;text-align:right;">P&L</th>
                    <th style="padding:0.6rem 0.75rem;text-align:right;">P&L %</th>
                    <th style="padding:0.6rem 0.75rem;">Date</th>
                    <th style="padding:0.6rem 0.75rem;text-align:center;">Action</th>
                </tr>
            </thead>
            <tbody>`;

        portfolio.forEach((pos, idx) => {
            const live = livePrices[pos.symbol] || {};
            const has = !live.error && live.price !== undefined;
            const curPrice = has ? live.price : 0;
            const invested = pos.buy_price * pos.quantity;
            const curVal   = curPrice * pos.quantity;
            const pl       = curVal - invested;
            const plPct    = invested > 0 ? (pl / invested * 100) : 0;
            const c = has ? cls(pl) : '';

            html += `
                <tr style="border-bottom:1px solid var(--border-color);">
                    <td style="padding:0.6rem 0.75rem;font-weight:600;font-family:'JetBrains Mono',monospace;color:var(--primary);">${pos.symbol}</td>
                    <td style="padding:0.6rem 0.75rem;text-align:right;">${pos.quantity}</td>
                    <td style="padding:0.6rem 0.75rem;text-align:right;">${fmt(pos.buy_price)}</td>
                    <td style="padding:0.6rem 0.75rem;text-align:right;font-weight:600;">${has ? fmt(curPrice) : '--'}</td>
                    <td style="padding:0.6rem 0.75rem;text-align:right;">${fmt(invested)}</td>
                    <td style="padding:0.6rem 0.75rem;text-align:right;font-weight:600;">${has ? fmt(curVal) : '--'}</td>
                    <td style="padding:0.6rem 0.75rem;text-align:right;font-weight:600;" class="${c}">
                        ${has ? '<i class="fas ' + arrow(pl) + '"></i> ' + fmt(Math.abs(pl)) : '--'}
                    </td>
                    <td style="padding:0.6rem 0.75rem;text-align:right;" class="${c}">
                        ${has ? fmtPct(plPct) : '--'}
                    </td>
                    <td style="padding:0.6rem 0.75rem;color:var(--text-secondary);font-size:0.82rem;">${pos.date || '--'}</td>
                    <td style="padding:0.6rem 0.75rem;text-align:center;">
                        <button class="pf-remove-btn" data-idx="${idx}" title="Remove Position" style="background:none;border:none;color:var(--text-secondary);cursor:pointer;font-size:1rem;transition:color .2s;">
                            <i class="fas fa-trash-alt"></i>
                        </button>
                    </td>
                </tr>`;
        });
        html += '</tbody></table></div>';
        $portfolioTable.innerHTML = html;

        // bind remove buttons
        $portfolioTable.querySelectorAll('.pf-remove-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const idx = parseInt(btn.dataset.idx);
                btn.disabled = true;
                const res = await removePortfolioPosition(idx);
                if (res.success) {
                    portfolio = res.portfolio;
                    renderPortfolio();
                    updateStats();
                    renderCharts();
                    toast('Position removed', 'info');
                }
            });
        });
    }

    /* ── update summary stats ─────────────────────── */
    function updateStats() {
        document.getElementById('statWatchCount').textContent = watchStocks.length;

        let totalInvested = 0, totalCurrent = 0;
        portfolio.forEach(pos => {
            const live = livePrices[pos.symbol] || {};
            const has = !live.error && live.price !== undefined;
            totalInvested += pos.buy_price * pos.quantity;
            if (has) totalCurrent += live.price * pos.quantity;
        });

        document.getElementById('statInvested').textContent = fmt(totalInvested);
        document.getElementById('statCurrentVal').textContent = totalCurrent ? fmt(totalCurrent) : '--';

        const totalPL = totalCurrent - totalInvested;
        const $plVal = document.getElementById('statPL');
        $plVal.textContent = (totalPL >= 0 ? '+' : '') + fmt(Math.abs(totalPL));
        $plVal.className = 'stat-value ' + (totalPL >= 0 ? 'positive' : 'negative');

        // colour code the P&L stat card icon
        const $profitIcon = document.getElementById('statProfitIcon');
        if (totalInvested > 0 && totalCurrent > 0) {
            $profitIcon.className = totalPL >= 0 ? 'stat-icon green' : 'stat-icon red';
        }
    }

    /* ── charts ───────────────────────────────────── */
    const palette = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899','#14b8a6','#f97316','#3b82f6'];

    function renderCharts() {
        renderAllocationChart();
        renderPLChart();
    }

    function renderAllocationChart() {
        const ctx = document.getElementById('allocationChart');
        if (!ctx) return;
        if (allocationChart) allocationChart.destroy();

        if (!portfolio.length) {
            allocationChart = new Chart(ctx, {
                type: 'doughnut',
                data: { labels: ['No Positions'], datasets: [{ data: [1], backgroundColor: ['#374151'] }] },
                options: { plugins: { legend: { display: false } }, responsive: true, maintainAspectRatio: false },
            });
            return;
        }

        // aggregate by symbol
        const map = {};
        portfolio.forEach(p => {
            const val = p.buy_price * p.quantity;
            map[p.symbol] = (map[p.symbol] || 0) + val;
        });
        const labels = Object.keys(map);
        const values = Object.values(map);

        allocationChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data: values,
                    backgroundColor: labels.map((_, i) => palette[i % palette.length]),
                    borderWidth: 0,
                    hoverOffset: 8,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                    legend: { position: 'bottom', labels: { color: getComputedStyle(document.body).getPropertyValue('--text-primary').trim() || '#e2e8f0', padding: 12, font: { size: 12 } } },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                                const pct = ((ctx.parsed / total) * 100).toFixed(1);
                                return ctx.label + ': ' + fmt(ctx.parsed) + ' (' + pct + '%)';
                            },
                        },
                    },
                },
            },
        });
    }

    function renderPLChart() {
        const ctx = document.getElementById('plChart');
        if (!ctx) return;
        if (plChart) plChart.destroy();

        if (!portfolio.length) {
            plChart = new Chart(ctx, {
                type: 'bar',
                data: { labels: ['No Positions'], datasets: [{ data: [0], backgroundColor: ['#374151'] }] },
                options: { plugins: { legend: { display: false } }, responsive: true, maintainAspectRatio: false,
                    scales: { x: { display: false }, y: { display: false } } },
            });
            return;
        }

        // aggregate P&L by symbol
        const map = {};
        portfolio.forEach(p => {
            const live = livePrices[p.symbol] || {};
            const has = !live.error && live.price !== undefined;
            const invested = p.buy_price * p.quantity;
            const curVal = has ? live.price * p.quantity : invested;
            const pl = curVal - invested;
            map[p.symbol] = (map[p.symbol] || 0) + pl;
        });
        const labels = Object.keys(map);
        const values = Object.values(map);
        const colours = values.map(v => v >= 0 ? '#10b981' : '#ef4444');

        plChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'P&L',
                    data: values,
                    backgroundColor: colours,
                    borderRadius: 6,
                    maxBarThickness: 48,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: labels.length > 6 ? 'y' : 'x',
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: ctx => 'P&L: ' + fmt(ctx.parsed.y || ctx.parsed.x),
                        },
                    },
                },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: 'var(--text-secondary)' } },
                    y: { grid: { color: 'rgba(255,255,255,0.06)' }, ticks: { color: 'var(--text-secondary)' } },
                },
            },
        });
    }

    /* ── master load ──────────────────────────────── */
    async function loadAll(showToast) {
        // show loading
        $watchTable.innerHTML = '<div style="text-align:center;padding:2rem;"><div class="spinner"></div><span style="display:block;margin-top:0.75rem;color:var(--text-secondary);">Loading watchlist…</span></div>';
        $portfolioTable.innerHTML = '<div style="text-align:center;padding:2rem;"><div class="spinner"></div><span style="display:block;margin-top:0.75rem;color:var(--text-secondary);">Loading portfolio…</span></div>';

        await fetchWatchlist();

        // gather all unique symbols we need prices for
        const allSyms = new Set([...watchStocks]);
        portfolio.forEach(p => allSyms.add(p.symbol));
        await fetchPrices([...allSyms]);

        renderWatchlist();
        renderPortfolio();
        updateStats();
        renderCharts();

        if (showToast) toast('Prices refreshed', 'success');
    }

    /* ── event listeners ──────────────────────────── */
    function bindEvents() {
        // Add to watchlist
        $btnAddWatch.addEventListener('click', async () => {
            const sym = $addWatchInput.value.trim().toUpperCase();
            if (!sym) return toast('Enter a stock symbol', 'error');
            if (watchStocks.includes(sym)) return toast(sym + ' is already in your watchlist', 'error');
            $btnAddWatch.disabled = true;
            const res = await addSymbol(sym);
            $btnAddWatch.disabled = false;
            if (res.success) {
                watchStocks = res.stocks;
                $addWatchInput.value = '';
                // fetch price for new symbol
                await fetchPrices([sym]);
                renderWatchlist();
                updateStats();
                toast(sym + ' added to watchlist', 'success');
            } else {
                toast(res.error || 'Failed to add', 'error');
            }
        });
        $addWatchInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') $btnAddWatch.click();
        });

        // Add position toggle
        $btnAddPos.addEventListener('click', () => {
            $posForm.style.display = $posForm.style.display === 'none' ? 'block' : 'none';
        });
        $btnCancelPos.addEventListener('click', () => {
            $posForm.style.display = 'none';
        });

        // Save position
        $btnSavePos.addEventListener('click', async () => {
            const sym   = document.getElementById('posSymbol').value.trim().toUpperCase();
            const price = parseFloat(document.getElementById('posBuyPrice').value);
            const qty   = parseInt(document.getElementById('posQuantity').value);
            if (!sym) return toast('Enter a stock symbol', 'error');
            if (!price || price <= 0) return toast('Enter a valid buy price', 'error');
            if (!qty || qty <= 0) return toast('Enter a valid quantity', 'error');
            $btnSavePos.disabled = true;
            const res = await addPortfolioPosition(sym, price, qty);
            $btnSavePos.disabled = false;
            if (res.success) {
                portfolio = res.portfolio;
                document.getElementById('posSymbol').value = '';
                document.getElementById('posBuyPrice').value = '';
                document.getElementById('posQuantity').value = '';
                $posForm.style.display = 'none';
                // fetch price for new symbol
                await fetchPrices([sym]);
                renderPortfolio();
                updateStats();
                renderCharts();
                toast('Position added for ' + sym, 'success');
            } else {
                toast(res.error || 'Failed to add position', 'error');
            }
        });

        // Refresh
        if ($refreshBtn) {
            $refreshBtn.addEventListener('click', () => loadAll(true));
        }
    }

    /* ── initialise ───────────────────────────────── */
    document.addEventListener('DOMContentLoaded', () => {
        // set date
        const $date = document.getElementById('currentDate');
        if ($date) $date.textContent = new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

        bindEvents();
        loadAll(false);

        // auto-refresh every 60 seconds
        setInterval(() => loadAll(false), 60000);
    });
})();
