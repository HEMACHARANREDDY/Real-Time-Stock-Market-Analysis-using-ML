/* =====================================================
   SECTOR HEATMAP  –  heatmap.js
   =====================================================*/

(function () {
    'use strict';

    /* ── state ────────────────────────────────────── */
    let currentPeriod = '1d';
    let sectorData    = {};        // sector → { avg_change, stocks:[] }

    /* ── icon map ─────────────────────────────────── */
    const SECTOR_ICONS = {
        Technology:    'fa-microchip',
        Finance:       'fa-landmark',
        Healthcare:    'fa-heartbeat',
        Energy:        'fa-bolt',
        Consumer:      'fa-shopping-cart',
        Semiconductor: 'fa-memory',
    };

    /* ── helpers ──────────────────────────────────── */
    function pctColour(pct) {
        if (pct >= 3)    return '#059669';     // strong green
        if (pct >= 1.5)  return '#10b981';
        if (pct >= 0.5)  return '#34d399';
        if (pct >= 0)    return '#6ee7b7';
        if (pct >= -0.5) return '#fca5a5';
        if (pct >= -1.5) return '#f87171';
        if (pct >= -3)   return '#ef4444';
        return '#dc2626';                      // deep red
    }
    function textOnBg(pct) {
        const abs = Math.abs(pct);
        return abs >= 1.5 ? '#ffffff' : 'var(--text-primary)';
    }
    function fmtPct(n) {
        return (n >= 0 ? '+' : '') + n.toFixed(2) + '%';
    }
    function fmt(n) {
        if (typeof window.formatPrice === 'function') return window.formatPrice(Number(n));
        return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
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

    /* ── API ──────────────────────────────────────── */
    async function fetchHeatmap(period) {
        const res = await fetch('/api/sector-heatmap?period=' + encodeURIComponent(period));
        return res.json();
    }

    /* ── render heatmap grid ──────────────────────── */
    function renderHeatmap() {
        const $grid = document.getElementById('heatmapGrid');
        const sectors = Object.entries(sectorData);
        if (!sectors.length) {
            $grid.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-secondary);">No sector data available.</div>';
            return;
        }

        // Sort sectors: best performing first
        sectors.sort((a, b) => b[1].avg_change - a[1].avg_change);

        let html = '';
        sectors.forEach(([sector, data]) => {
            const bg   = pctColour(data.avg_change);
            const icon = SECTOR_ICONS[sector] || 'fa-industry';

            html += `
            <div class="hm-sector" data-sector="${sector}" style="border-radius:14px;overflow:hidden;cursor:pointer;transition:transform .2s,box-shadow .2s;">
                <!-- Sector Header -->
                <div style="background:${bg};padding:1rem 1.25rem;display:flex;justify-content:space-between;align-items:center;">
                    <div style="display:flex;align-items:center;gap:0.6rem;">
                        <i class="fas ${icon}" style="font-size:1.1rem;color:${textOnBg(data.avg_change)};opacity:0.85;"></i>
                        <span style="font-weight:700;font-size:1rem;color:${textOnBg(data.avg_change)};">${sector}</span>
                    </div>
                    <span style="font-weight:700;font-size:1.05rem;color:${textOnBg(data.avg_change)};">${fmtPct(data.avg_change)}</span>
                </div>
                <!-- Individual Stocks -->
                <div style="display:flex;flex-wrap:wrap;gap:0;background:var(--bg-secondary);">
                    ${data.stocks.map(s => {
                        const sBg = pctColour(s.change_pct);
                        return `<div class="hm-stock-tile" style="flex:1 1 calc(25% - 2px);min-width:100px;padding:0.7rem 0.6rem;text-align:center;background:${sBg};border:1px solid rgba(255,255,255,0.06);transition:transform .15s;" title="${s.name}: ${fmt(s.price)} (${fmtPct(s.change_pct)})">
                            <div style="font-weight:700;font-size:0.82rem;font-family:'JetBrains Mono',monospace;color:${textOnBg(s.change_pct)};">${s.symbol}</div>
                            <div style="font-size:0.72rem;color:${textOnBg(s.change_pct)};opacity:0.85;margin-top:0.15rem;">${fmtPct(s.change_pct)}</div>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        });

        $grid.style.gridTemplateColumns = 'repeat(auto-fit, minmax(340px, 1fr))';
        $grid.innerHTML = html;

        // click to expand detail
        $grid.querySelectorAll('.hm-sector').forEach(el => {
            el.addEventListener('click', () => showSectorDetail(el.dataset.sector));
        });

        // hover effects
        $grid.querySelectorAll('.hm-sector').forEach(el => {
            el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.015)'; el.style.boxShadow = '0 8px 32px rgba(0,0,0,0.25)'; });
            el.addEventListener('mouseleave', () => { el.style.transform = ''; el.style.boxShadow = ''; });
        });
        $grid.querySelectorAll('.hm-stock-tile').forEach(el => {
            el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.06)'; el.style.zIndex = '2'; });
            el.addEventListener('mouseleave', () => { el.style.transform = ''; el.style.zIndex = ''; });
        });
    }

    /* ── sector detail panel ──────────────────────── */
    function showSectorDetail(sector) {
        const data = sectorData[sector];
        if (!data) return;

        const $panel = document.getElementById('sectorDetail');
        const $title = document.getElementById('sectorDetailTitle');
        const $body  = document.getElementById('sectorDetailBody');

        $title.innerHTML = `<i class="fas ${SECTOR_ICONS[sector] || 'fa-industry'}" style="color:#6366f1;"></i> ${sector} — ${fmtPct(data.avg_change)}`;

        let html = `<div style="overflow-x:auto;">
            <table style="width:100%;border-collapse:collapse;font-size:0.88rem;">
                <thead>
                    <tr style="text-align:left;color:var(--text-secondary);font-weight:600;border-bottom:1px solid var(--border-color);">
                        <th style="padding:0.6rem 0.75rem;">Symbol</th>
                        <th style="padding:0.6rem 0.75rem;">Company</th>
                        <th style="padding:0.6rem 0.75rem;text-align:right;">Price</th>
                        <th style="padding:0.6rem 0.75rem;text-align:right;">Change</th>
                    </tr>
                </thead>
                <tbody>`;

        data.stocks.forEach(s => {
            const c = s.change_pct >= 0 ? 'positive' : 'negative';
            html += `
                <tr style="border-bottom:1px solid var(--border-color);">
                    <td style="padding:0.6rem 0.75rem;font-weight:600;font-family:'JetBrains Mono',monospace;color:var(--primary);">${s.symbol}</td>
                    <td style="padding:0.6rem 0.75rem;color:var(--text-secondary);">${s.name}</td>
                    <td style="padding:0.6rem 0.75rem;text-align:right;font-weight:600;">${fmt(s.price)}</td>
                    <td style="padding:0.6rem 0.75rem;text-align:right;font-weight:600;" class="${c}">
                        <i class="fas ${s.change_pct >= 0 ? 'fa-caret-up' : 'fa-caret-down'}"></i> ${fmtPct(s.change_pct)}
                    </td>
                </tr>`;
        });
        html += '</tbody></table></div>';
        $body.innerHTML = html;
        $panel.style.display = 'block';
        $panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    /* ── update summary cards ─────────────────────── */
    function updateSummary() {
        const entries = Object.entries(sectorData);
        if (!entries.length) return;

        // best & worst sector
        entries.sort((a, b) => b[1].avg_change - a[1].avg_change);
        const best  = entries[0];
        const worst = entries[entries.length - 1];
        document.getElementById('statTopSector').textContent  = best[0]  + ' ' + fmtPct(best[1].avg_change);
        document.getElementById('statWorstSector').textContent = worst[0] + ' ' + fmtPct(worst[1].avg_change);
        document.getElementById('statSectorCount').textContent = entries.length;

        // overall top gainer stock
        let topStock = null;
        entries.forEach(([, d]) => {
            d.stocks.forEach(s => {
                if (!topStock || s.change_pct > topStock.change_pct) topStock = s;
            });
        });
        if (topStock) {
            document.getElementById('statTopStock').textContent = topStock.symbol + ' ' + fmtPct(topStock.change_pct);
        }
    }

    /* ── master load ──────────────────────────────── */
    async function loadHeatmap(showToast) {
        const $grid = document.getElementById('heatmapGrid');
        $grid.innerHTML = '<div style="text-align:center;padding:3rem;color:var(--text-secondary);"><div class="spinner"></div><span style="display:block;margin-top:0.75rem;">Fetching sector data…</span></div>';

        try {
            sectorData = await fetchHeatmap(currentPeriod);
            renderHeatmap();
            updateSummary();
            if (showToast) toast('Heatmap refreshed', 'success');
        } catch (e) {
            console.error('Heatmap load error', e);
            $grid.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--text-secondary);">Failed to load sector data. Please try again.</div>';
        }
    }

    /* ── events ───────────────────────────────────── */
    function bindEvents() {
        // period buttons
        document.querySelectorAll('.period-btn[data-period]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.period-btn[data-period]').forEach(b => b.removeAttribute('data-active'));
                btn.setAttribute('data-active', 'true');
                currentPeriod = btn.dataset.period;
                document.getElementById('sectorDetail').style.display = 'none';
                loadHeatmap(false);
            });
        });

        // refresh
        const $refresh = document.getElementById('refreshBtn');
        if ($refresh) $refresh.addEventListener('click', () => loadHeatmap(true));

        // close detail
        const $closeDetail = document.getElementById('closeSectorDetail');
        if ($closeDetail) $closeDetail.addEventListener('click', () => {
            document.getElementById('sectorDetail').style.display = 'none';
        });
    }

    /* ── init ─────────────────────────────────────── */
    document.addEventListener('DOMContentLoaded', () => {
        const $date = document.getElementById('currentDate');
        if ($date) $date.textContent = new Date().toLocaleDateString('en-US', { weekday:'long', year:'numeric', month:'long', day:'numeric' });

        bindEvents();
        loadHeatmap(false);
    });
})();
