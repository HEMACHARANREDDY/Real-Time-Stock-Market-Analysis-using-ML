/* ═══════════════════════════════════════════════════════════
   Realtime S Pulse - Compare Stocks Page
   ═══════════════════════════════════════════════════════════ */

let compareChart = null, absoluteChart = null;
let taggedSymbols = [];
let lastCompareData = null;   // stored so text view can re-render
let currentView = 'graph';

document.addEventListener('DOMContentLoaded', () => {
    initCommon();
    initTagInput();
    initSuggestions();

    document.getElementById('compareBtn').addEventListener('click', runComparison);

    // Pre-load 2 default stocks so users can click Compare immediately
    ['AAPL', 'MSFT'].forEach(s => addTag(s));
});

/* ── Tag Input ─────────────────────────────────────────── */
function initTagInput() {
    const typing = document.getElementById('tagTyping');
    const wrapper = document.getElementById('tagInputWrapper');

    // Focus the text box when clicking anywhere in the wrapper
    wrapper.addEventListener('click', () => typing.focus());

    typing.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
            e.preventDefault();
            // Support comma/space-separated paste e.g. "AAPL MSFT" or "AAPL,MSFT"
            typing.value.split(/[,\s]+/).map(s => s.trim()).filter(Boolean).forEach(s => addTag(s));
            typing.value = '';
        } else if (e.key === 'Backspace' && typing.value === '' && taggedSymbols.length) {
            removeTag(taggedSymbols[taggedSymbols.length - 1]);
        }
    });

    // Also add on blur so symbols typed but not confirmed still get picked up
    typing.addEventListener('blur', () => {
        const val = typing.value.trim();
        if (val) {
            val.split(/[,\s]+/).map(s => s.trim()).filter(Boolean).forEach(s => addTag(s));
            typing.value = '';
        }
    });
}

function addTag(sym) {
    sym = sym.toUpperCase();
    if (!sym || taggedSymbols.includes(sym)) return;
    if (taggedSymbols.length >= 5) {
        showToast('Maximum 5 stocks allowed. Remove one to add another.', 'error');
        return;
    }
    taggedSymbols.push(sym);
    renderTags();
    syncHidden();
    updateSuggestionChips();
}

function removeTag(sym) {
    taggedSymbols = taggedSymbols.filter(s => s !== sym);
    renderTags();
    syncHidden();
    updateSuggestionChips();
}

function renderTags() {
    const list = document.getElementById('tagList');
    list.innerHTML = taggedSymbols.map(sym => `
        <span class="stock-tag">
            ${sym}
            <button class="tag-remove" onclick="removeTag('${sym}')" title="Remove">&times;</button>
        </span>
    `).join('');

    // Show/hide count badge
    const counter = document.getElementById('tagCounter');
    if (counter) {
        counter.textContent = taggedSymbols.length > 0
            ? taggedSymbols.length + ' selected (need at least 2 to compare)'
            : 'No stocks selected — click chips below or type above';
        counter.style.color = taggedSymbols.length >= 2 ? 'var(--accent-green)' : 'var(--text-muted)';
    }
}

function syncHidden() {
    document.getElementById('compareSymbols').value = taggedSymbols.join(',');
}

/* ── Suggestions ───────────────────────────────────────── */
function initSuggestions() {
    document.querySelectorAll('.sug-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            const sym = btn.dataset.sym;
            if (taggedSymbols.includes(sym.toUpperCase())) {
                removeTag(sym.toUpperCase());
            } else {
                addTag(sym);
            }
        });
    });
    updateSuggestionChips();
}

function updateSuggestionChips() {
    document.querySelectorAll('.sug-chip').forEach(btn => {
        const sym = btn.dataset.sym.toUpperCase();
        if (taggedSymbols.includes(sym)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
}

async function runComparison() {
    // Grab anything typed but not yet confirmed (supports "AAPL MSFT" or "AAPL,MSFT")
    const typing = document.getElementById('tagTyping');
    if (typing && typing.value.trim()) {
        typing.value.split(/[,\s]+/).map(s => s.trim()).filter(Boolean).forEach(s => addTag(s));
        typing.value = '';
    }

    const symbols = [...taggedSymbols];
    const period = document.getElementById('comparePeriod').value;

    if (symbols.length < 2) {
        showToast('⚠️ Select at least 2 stocks — click the Quick Add chips below or type symbols and press Enter', 'error');
        return;
    }
    
    showToast(`Comparing ${symbols.join(', ')}...`, 'info');
    
    try {
        const res = await fetch('/api/compare', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbols, period })
        });

        // If not JSON (e.g. session expired → redirect to login page)
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            showToast('Session expired — please refresh and log in again.', 'error');
            return;
        }
        
        const data = await res.json();
        
        if (data.error) {
            showToast(data.error, 'error');
            return;
        }

        if (Object.keys(data).length === 0) {
            showToast('No data returned — check the stock symbols and try again.', 'error');
            return;
        }
        
        document.getElementById('compareResults').style.display = 'block';
        document.getElementById('viewToggleBar').style.display = '';
        lastCompareData = data;
        renderComparisonResults(data);
        renderTextReport(data);
        switchView(currentView);
        showToast('Comparison complete ✓', 'success');
        // Scroll results into view
        document.getElementById('viewToggleBar').scrollIntoView({ behavior: 'smooth', block: 'start' });
        
    } catch (err) {
        showToast('Comparison failed: ' + err.message, 'error');
    }
}

function renderComparisonResults(data) {
    const symbols = Object.keys(data);
    if (!symbols.length) return;
    
    // Summary cards
    const summary = document.getElementById('compareSummary');
    summary.innerHTML = symbols.map((sym, i) => {
        const s = data[sym];
        const isPositive = s.total_return >= 0;
        return `
            <div class="compare-card">
                <h4>${sym}</h4>
                <div class="compare-price">${formatPrice(s.end_price)}</div>
                <div class="compare-return ${isPositive ? 'positive' : 'negative'}">
                    ${isPositive ? '+' : ''}${s.total_return}% total return
                </div>
                <div class="compare-volatility">
                    Volatility: ${s.volatility}% | Range: ${formatPrice(s.min_price)} - ${formatPrice(s.max_price)}
                </div>
            </div>
        `;
    }).join('');
    
    // Normalized chart
    renderNormalizedChart(data, symbols);
    
    // Absolute chart
    renderAbsoluteChart(data, symbols);
    
    // Comparison table
    renderCompareTable(data, symbols);
}

function renderNormalizedChart(data, symbols) {
    const ctx = document.getElementById('compareChart');
    if (compareChart) compareChart.destroy();
    
    const defaults = getChartDefaults();
    const firstSymbol = symbols[0];
    const dates = data[firstSymbol].dates;
    
    const datasets = symbols.map((sym, i) => ({
        label: sym,
        data: data[sym].normalized,
        borderColor: CHART_COLORS[i % CHART_COLORS.length],
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 0,
        pointHitRadius: 10,
    }));
    
    compareChart = new Chart(ctx, {
        type: 'line',
        data: { labels: dates, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { color: defaults.textColor, usePointStyle: true, padding: 15, font: { size: 12, weight: '600' } }},
                tooltip: {
                    backgroundColor: defaults.bgColor,
                    titleColor: defaults.textColor,
                    bodyColor: defaults.textColor,
                    borderColor: 'rgba(148,163,184,0.2)',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y >= 0 ? '+' : ''}${ctx.parsed.y.toFixed(2)}%` }
                }
            },
            scales: {
                x: { grid: { color: defaults.gridColor }, ticks: { color: defaults.textColor, maxTicksLimit: 12, font: { size: 10 } }},
                y: { grid: { color: defaults.gridColor }, ticks: { color: defaults.textColor, font: { size: 10 }, callback: v => v.toFixed(0) + '%' }, position: 'right' },
            }
        }
    });
}

function renderAbsoluteChart(data, symbols) {
    const ctx = document.getElementById('absoluteChart');
    if (absoluteChart) absoluteChart.destroy();
    
    const defaults = getChartDefaults();
    const firstSymbol = symbols[0];
    const dates = data[firstSymbol].dates;
    
    const datasets = symbols.map((sym, i) => ({
        label: sym,
        data: data[sym].close,
        borderColor: CHART_COLORS[i % CHART_COLORS.length],
        borderWidth: 2,
        tension: 0.3,
        pointRadius: 0,
    }));
    
    absoluteChart = new Chart(ctx, {
        type: 'line',
        data: { labels: dates, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { color: defaults.textColor, usePointStyle: true, padding: 15, font: { size: 12 } }},
                tooltip: {
                    backgroundColor: defaults.bgColor,
                    titleColor: defaults.textColor,
                    bodyColor: defaults.textColor,
                    borderColor: 'rgba(148,163,184,0.2)',
                    borderWidth: 1,
                    callbacks: { label: ctx => `${ctx.dataset.label}: ${formatPrice(ctx.parsed.y)}` }
                }
            },
            scales: {
                x: { grid: { color: defaults.gridColor }, ticks: { color: defaults.textColor, maxTicksLimit: 12, font: { size: 10 } }},
                y: { grid: { color: defaults.gridColor }, ticks: { color: defaults.textColor, font: { size: 10 }, callback: v => formatPrice(v) }, position: 'right' },
            }
        }
    });
}

function renderCompareTable(data, symbols) {
    const tbody = document.getElementById('compareBody');
    
    tbody.innerHTML = symbols.map(sym => {
        const s = data[sym];
        const isPositive = s.total_return >= 0;
        return `
            <tr>
                <td style="font-weight: 700;">${sym}</td>
                <td>${formatPrice(s.start_price)}</td>
                <td>${formatPrice(s.end_price)}</td>
                <td class="${isPositive ? 'positive' : 'negative'}" style="font-weight:700;">
                    ${isPositive ? '+' : ''}${s.total_return}%
                </td>
                <td>${formatPrice(s.max_price)}</td>
                <td>${formatPrice(s.min_price)}</td>
                <td>${s.volatility}%</td>
                <td>${formatNumber(s.avg_volume)}</td>
            </tr>
        `;
    }).join('');
}

/* ── View Toggle ─────────────────────────────────────── */
function switchView(view) {
    currentView = view;
    const isGraph = view === 'graph';
    document.getElementById('graphView').style.display = isGraph ? '' : 'none';
    document.getElementById('textView').style.display = isGraph ? 'none' : '';
    document.getElementById('btnGraphView').classList.toggle('active', isGraph);
    document.getElementById('btnTextView').classList.toggle('active', !isGraph);
    document.getElementById('viewToggleHint').textContent = isGraph
        ? "Switch to Text Report if graphs don't load"
        : 'Switch back to interactive charts';
}


/* ── Text Report ───────────────────────────────────── */
function renderTextReport(data) {
    const symbols = Object.keys(data);
    const now = new Date().toLocaleDateString('en-IN', { year:'numeric', month:'long', day:'numeric' });

    // Rank by return
    const ranked = [...symbols].sort((a, b) => data[b].total_return - data[a].total_return);
    const best = ranked[0];
    const worst = ranked[ranked.length - 1];
    const leastVolatile = [...symbols].sort((a, b) => data[a].volatility - data[b].volatility)[0];
    const mostVolatile  = [...symbols].sort((a, b) => data[b].volatility - data[a].volatility)[0];

    function arrow(v) { return v >= 0 ? '▲' : '▼'; }
    function sign(v)  { return v >= 0 ? '+' : ''; }
    function cls(v)   { return v >= 0 ? 'tr-positive' : 'tr-negative'; }

    const stockBlocks = symbols.map((sym, i) => {
        const s = data[sym];
        const rank = ranked.indexOf(sym) + 1;
        return `
        <div class="tr-stock-block">
            <div class="tr-stock-header">
                <span class="tr-rank">#${rank}</span>
                <span class="tr-sym">${sym}</span>
                <span class="tr-return ${cls(s.total_return)}">${arrow(s.total_return)} ${sign(s.total_return)}${s.total_return}% return</span>
            </div>
            <div class="tr-metrics">
                <div class="tr-metric">
                    <span class="tr-metric-label">Current Price</span>
                    <span class="tr-metric-value">${formatPrice(s.end_price)}</span>
                </div>
                <div class="tr-metric">
                    <span class="tr-metric-label">Start Price</span>
                    <span class="tr-metric-value">${formatPrice(s.start_price)}</span>
                </div>
                <div class="tr-metric">
                    <span class="tr-metric-label">52W High</span>
                    <span class="tr-metric-value">${formatPrice(s.max_price)}</span>
                </div>
                <div class="tr-metric">
                    <span class="tr-metric-label">52W Low</span>
                    <span class="tr-metric-value">${formatPrice(s.min_price)}</span>
                </div>
                <div class="tr-metric">
                    <span class="tr-metric-label">Volatility</span>
                    <span class="tr-metric-value">${s.volatility}%</span>
                </div>
                <div class="tr-metric">
                    <span class="tr-metric-label">Avg Volume</span>
                    <span class="tr-metric-value">${formatNumber(s.avg_volume)}</span>
                </div>
            </div>
            <div class="tr-summary-text">
                ${sym} ${s.total_return >= 0
                    ? `gained <strong>${sign(s.total_return)}${s.total_return}%</strong> over the period, rising from ${formatPrice(s.start_price)} to ${formatPrice(s.end_price)}.`
                    : `declined <strong>${s.total_return}%</strong> over the period, falling from ${formatPrice(s.start_price)} to ${formatPrice(s.end_price)}.`
                }
                Its price ranged between ${formatPrice(s.min_price)} and ${formatPrice(s.max_price)},
                with an annualised volatility of ${s.volatility}% and an average daily trading volume of ${formatNumber(s.avg_volume)} shares.
            </div>
        </div>`;
    }).join('');

    const spreadReturn = (data[ranked[0]].total_return - data[ranked[ranked.length-1]].total_return).toFixed(2);

    const html = `
    <div class="text-report">
        <div class="tr-header">
            <div class="tr-title"><i class="fas fa-file-lines"></i> Stock Comparison Report</div>
            <div class="tr-date">Generated on ${now}</div>
        </div>

        <div class="tr-section">
            <div class="tr-section-title">Overview</div>
            <p class="tr-overview-text">
                This report compares <strong>${symbols.length} stocks</strong>: ${symbols.join(', ')}.
                <strong>${best}</strong> was the top performer with a return of ${sign(data[best].total_return)}${data[best].total_return}%,
                while <strong>${worst}</strong> was the weakest at ${sign(data[worst].total_return)}${data[worst].total_return}%.
                The performance spread between the best and worst is <strong>${spreadReturn}%</strong>.
                <strong>${leastVolatile}</strong> was the most stable (volatility: ${data[leastVolatile].volatility}%)
                and <strong>${mostVolatile}</strong> was the most volatile (${data[mostVolatile].volatility}%).
            </p>
        </div>

        <div class="tr-section">
            <div class="tr-section-title">Rankings by Total Return</div>
            <div class="tr-ranking">
                ${ranked.map((sym, i) => `
                <div class="tr-rank-row">
                    <span class="tr-rank-num">${i+1}</span>
                    <span class="tr-rank-sym">${sym}</span>
                    <div class="tr-rank-bar-wrap">
                        <div class="tr-rank-bar ${data[sym].total_return >= 0 ? 'pos' : 'neg'}" style="width:${Math.min(Math.abs(data[sym].total_return / Math.max(...ranked.map(s => Math.abs(data[s].total_return)))) * 100, 100)}%"></div>
                    </div>
                    <span class="tr-rank-val ${cls(data[sym].total_return)}">${sign(data[sym].total_return)}${data[sym].total_return}%</span>
                </div>`).join('')}
            </div>
        </div>

        <div class="tr-section">
            <div class="tr-section-title">Individual Stock Details</div>
            ${stockBlocks}
        </div>

        <div class="tr-section">
            <div class="tr-section-title">Key Highlights</div>
            <ul class="tr-highlights">
                <li>🏆 <strong>Best Performer:</strong> ${best} &mdash; ${sign(data[best].total_return)}${data[best].total_return}% return</li>
                <li>📉 <strong>Worst Performer:</strong> ${worst} &mdash; ${sign(data[worst].total_return)}${data[worst].total_return}% return</li>
                <li>🛡️ <strong>Most Stable:</strong> ${leastVolatile} &mdash; ${data[leastVolatile].volatility}% volatility</li>
                <li>⚡ <strong>Most Volatile:</strong> ${mostVolatile} &mdash; ${data[mostVolatile].volatility}% volatility</li>
                <li>💰 <strong>Highest Price:</strong> ${[...symbols].sort((a,b) => data[b].end_price - data[a].end_price)[0]} &mdash; ${formatPrice(data[[...symbols].sort((a,b) => data[b].end_price - data[a].end_price)[0]].end_price)}</li>
                <li>📈 <strong>Return Spread:</strong> ${spreadReturn}% gap between best and worst</li>
            </ul>
        </div>
    </div>`;

    document.getElementById('textReportCard').innerHTML = html;
}

/* ── Download Text Report ──────────────────────────────── */
function downloadTextReport() {
    // Switch to text view first so the report is rendered
    switchView('text');

    setTimeout(() => {
        const card = document.getElementById('textReportCard');
        if (!card || !card.innerText.trim()) {
            if (typeof showToast === 'function') showToast('Run a comparison first to generate a report.', 'error');
            return;
        }

        // Build plain-text version
        const lines = [];
        lines.push('='.repeat(60));
        lines.push('  REALTIME S PULSE — STOCK COMPARISON REPORT');
        lines.push('='.repeat(60));
        lines.push('Generated: ' + new Date().toLocaleString());
        lines.push('');

        // Walk DOM for readable text
        card.querySelectorAll('.tr-section').forEach(sec => {
            const title = sec.querySelector('.tr-section-title');
            if (title) { lines.push(''); lines.push('── ' + title.innerText.toUpperCase() + ' ──'); lines.push(''); }
            sec.querySelectorAll('.tr-metric').forEach(m => {
                const lbl = m.querySelector('.tr-metric-label');
                const val = m.querySelector('.tr-metric-value');
                if (lbl && val) lines.push('  ' + lbl.innerText.padEnd(22) + val.innerText);
            });
            sec.querySelectorAll('.tr-highlights li').forEach(li => {
                lines.push('  ' + li.innerText);
            });
            sec.querySelectorAll('.tr-stock-block').forEach(blk => lines.push(blk.innerText.trim()));
        });

        lines.push('');
        lines.push('='.repeat(60));
        lines.push('  Powered by Realtime S Pulse — Premium');
        lines.push('='.repeat(60));

        const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href     = url;
        a.download = 'SPulse_CompareReport_' + new Date().toISOString().slice(0,10) + '.txt';
        a.click();
        URL.revokeObjectURL(url);
        if (typeof showToast === 'function') showToast('Report downloaded!', 'success');
    }, 300);
}
