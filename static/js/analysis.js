/* ═══════════════════════════════════════════════════════════
   Realtime S Pulse - Technical Analysis Page
   ═══════════════════════════════════════════════════════════ */

let priceChart = null, macdChart = null, rsiChart = null, stochChart = null, volumeAnalysisChart = null;
let lastAnalysisData = null;
let analysisView = 'graph';

document.addEventListener('DOMContentLoaded', () => {
    initCommon();
    
    document.getElementById('analyzeBtn').addEventListener('click', () => {
        const sym = document.getElementById('analysisSymbol').value.trim().toUpperCase();
        if (sym) runAnalysis(sym);
    });
    
    document.getElementById('analysisSymbol').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const sym = e.target.value.trim().toUpperCase();
            if (sym) runAnalysis(sym);
        }
    });
    
    runAnalysis('AAPL');
});

async function runAnalysis(symbol) {
    showToast(`Analyzing ${symbol}...`, 'info');
    
    try {
        const res = await fetch(`/api/technical/${symbol}`);
        const data = await res.json();
        
        if (data.error) {
            showToast(data.error, 'error');
            return;
        }
        
        renderSignals(data.signals);
        renderPriceWithBollinger(data);
        renderMACD(data);
        renderRSI(data);
        renderStochastic(data);
        renderVolumeAnalysis(data);

        lastAnalysisData = data;
        renderAnalysisTextReport(data.signals, symbol);
        document.getElementById('analysisViewToggle').style.display = 'flex';
        switchAnalysisView(analysisView);
        
        showToast(`Analysis complete for ${symbol}`, 'success');
    } catch (err) {
        showToast('Analysis failed: ' + err.message, 'error');
    }
}

function renderSignals(signals) {
    const overview = document.getElementById('signalOverview');
    overview.style.display = 'block';
    
    // Overall signal badge
    const badge = document.getElementById('overallSignal');
    const overall = signals.overall;
    badge.textContent = overall;
    badge.className = 'signal-badge';
    
    if (overall.includes('BUY')) badge.classList.add(overall === 'STRONG BUY' ? 'strong-buy' : 'buy');
    else if (overall.includes('SELL')) badge.classList.add(overall === 'STRONG SELL' ? 'strong-sell' : 'sell');
    else badge.classList.add('hold');
    
    // Score bar
    const normalizedScore = ((signals.score + signals.max_score) / (2 * signals.max_score)) * 100;
    document.getElementById('scoreBar').style.width = normalizedScore + '%';
    document.getElementById('scoreText').textContent = `${signals.score}/${signals.max_score}`;
    
    // Signal grid
    const grid = document.getElementById('signalGrid');
    grid.innerHTML = signals.indicators.map(sig => {
        const cls = sig.signal.toLowerCase();
        return `
            <div class="signal-card-item ${cls}">
                <div>
                    <div class="signal-indicator-name">${sig.indicator}</div>
                    <div class="signal-reason">${sig.reason}</div>
                </div>
                <span class="signal-tag ${cls}">${sig.signal}</span>
            </div>
        `;
    }).join('');
}

function renderPriceWithBollinger(data) {
    const ctx = document.getElementById('priceChart');
    if (priceChart) priceChart.destroy();
    
    const defaults = getChartDefaults();
    
    priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.dates,
            datasets: [
                {
                    label: 'Close',
                    data: data.close,
                    borderColor: COLORS.blue,
                    borderWidth: 2,
                    tension: 0.3,
                    pointRadius: 0,
                    order: 1,
                },
                {
                    label: 'SMA 20',
                    data: data.sma_20,
                    borderColor: COLORS.orange,
                    borderWidth: 1.5,
                    borderDash: [5, 5],
                    tension: 0.3,
                    pointRadius: 0,
                    order: 2,
                },
                {
                    label: 'SMA 50',
                    data: data.sma_50,
                    borderColor: COLORS.purple,
                    borderWidth: 1.5,
                    borderDash: [5, 5],
                    tension: 0.3,
                    pointRadius: 0,
                    order: 3,
                },
                {
                    label: 'BB Upper',
                    data: data.bb_upper,
                    borderColor: 'rgba(239, 68, 68, 0.4)',
                    borderWidth: 1,
                    tension: 0.3,
                    pointRadius: 0,
                    fill: false,
                    order: 4,
                },
                {
                    label: 'BB Lower',
                    data: data.bb_lower,
                    borderColor: 'rgba(16, 185, 129, 0.4)',
                    borderWidth: 1,
                    tension: 0.3,
                    pointRadius: 0,
                    fill: '-1',
                    backgroundColor: 'rgba(59, 130, 246, 0.05)',
                    order: 5,
                },
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { color: defaults.textColor, usePointStyle: true, padding: 12, font: { size: 11 } }},
                tooltip: {
                    backgroundColor: defaults.bgColor,
                    titleColor: defaults.textColor,
                    bodyColor: defaults.textColor,
                    borderColor: 'rgba(148, 163, 184, 0.2)',
                    borderWidth: 1,
                    padding: 10,
                }
            },
            scales: {
                x: { grid: { color: defaults.gridColor }, ticks: { color: defaults.textColor, maxTicksLimit: 12, font: { size: 10 } }},
                y: { grid: { color: defaults.gridColor }, ticks: { color: defaults.textColor, font: { size: 10 }, callback: v => formatPrice(v) }, position: 'right' },
            }
        }
    });
}

function renderMACD(data) {
    const ctx = document.getElementById('macdChart');
    if (macdChart) macdChart.destroy();
    
    const defaults = getChartDefaults();
    const histColors = data.macd_hist.map(v => v >= 0 ? 'rgba(16, 185, 129, 0.6)' : 'rgba(239, 68, 68, 0.6)');
    
    macdChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.dates,
            datasets: [
                {
                    label: 'Histogram',
                    data: data.macd_hist,
                    backgroundColor: histColors,
                    borderRadius: 1,
                    order: 2,
                    yAxisID: 'y',
                },
                {
                    label: 'MACD',
                    data: data.macd,
                    borderColor: COLORS.blue,
                    borderWidth: 1.5,
                    type: 'line',
                    tension: 0.3,
                    pointRadius: 0,
                    order: 1,
                    yAxisID: 'y',
                },
                {
                    label: 'Signal',
                    data: data.macd_signal,
                    borderColor: COLORS.orange,
                    borderWidth: 1.5,
                    type: 'line',
                    tension: 0.3,
                    pointRadius: 0,
                    order: 1,
                    yAxisID: 'y',
                },
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { color: defaults.textColor, usePointStyle: true, padding: 12, font: { size: 11 } }},
                tooltip: { backgroundColor: defaults.bgColor, titleColor: defaults.textColor, bodyColor: defaults.textColor, borderColor: 'rgba(148,163,184,0.2)', borderWidth: 1 }
            },
            scales: {
                x: { grid: { color: defaults.gridColor }, ticks: { color: defaults.textColor, maxTicksLimit: 12, font: { size: 10 } }},
                y: { grid: { color: defaults.gridColor }, ticks: { color: defaults.textColor, font: { size: 10 } }, position: 'right' },
            }
        }
    });
}

function renderRSI(data) {
    const ctx = document.getElementById('rsiChart');
    if (rsiChart) rsiChart.destroy();
    
    const defaults = getChartDefaults();
    
    rsiChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.dates,
            datasets: [{
                label: 'RSI (14)',
                data: data.rsi,
                borderColor: COLORS.purple,
                borderWidth: 2,
                tension: 0.3,
                pointRadius: 0,
                fill: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: defaults.textColor, usePointStyle: true }},
                tooltip: { backgroundColor: defaults.bgColor, titleColor: defaults.textColor, bodyColor: defaults.textColor, borderColor: 'rgba(148,163,184,0.2)', borderWidth: 1 },
                annotation: {
                    annotations: {
                        overbought: {
                            type: 'line', yMin: 70, yMax: 70,
                            borderColor: 'rgba(239, 68, 68, 0.5)', borderWidth: 1, borderDash: [6, 6],
                            label: { display: true, content: 'Overbought (70)', position: 'start', backgroundColor: 'transparent', color: COLORS.red, font: { size: 10 } }
                        },
                        oversold: {
                            type: 'line', yMin: 30, yMax: 30,
                            borderColor: 'rgba(16, 185, 129, 0.5)', borderWidth: 1, borderDash: [6, 6],
                            label: { display: true, content: 'Oversold (30)', position: 'start', backgroundColor: 'transparent', color: COLORS.green, font: { size: 10 } }
                        },
                        midline: {
                            type: 'line', yMin: 50, yMax: 50,
                            borderColor: 'rgba(148, 163, 184, 0.2)', borderWidth: 1, borderDash: [3, 3],
                        }
                    }
                }
            },
            scales: {
                x: { grid: { color: defaults.gridColor }, ticks: { color: defaults.textColor, maxTicksLimit: 12, font: { size: 10 } }},
                y: { grid: { color: defaults.gridColor }, ticks: { color: defaults.textColor, font: { size: 10 } }, min: 0, max: 100, position: 'right' },
            }
        }
    });
}

function renderStochastic(data) {
    const ctx = document.getElementById('stochChart');
    if (stochChart) stochChart.destroy();
    
    const defaults = getChartDefaults();
    
    stochChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.dates,
            datasets: [
                {
                    label: '%K',
                    data: data.stoch_k,
                    borderColor: COLORS.cyan,
                    borderWidth: 1.5,
                    tension: 0.3,
                    pointRadius: 0,
                },
                {
                    label: '%D',
                    data: data.stoch_d,
                    borderColor: COLORS.orange,
                    borderWidth: 1.5,
                    tension: 0.3,
                    pointRadius: 0,
                    borderDash: [5, 5],
                },
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { color: defaults.textColor, usePointStyle: true }},
                tooltip: { backgroundColor: defaults.bgColor, titleColor: defaults.textColor, bodyColor: defaults.textColor, borderColor: 'rgba(148,163,184,0.2)', borderWidth: 1 },
                annotation: {
                    annotations: {
                        upper: { type: 'line', yMin: 80, yMax: 80, borderColor: 'rgba(239, 68, 68, 0.4)', borderWidth: 1, borderDash: [6, 6] },
                        lower: { type: 'line', yMin: 20, yMax: 20, borderColor: 'rgba(16, 185, 129, 0.4)', borderWidth: 1, borderDash: [6, 6] },
                    }
                }
            },
            scales: {
                x: { grid: { color: defaults.gridColor }, ticks: { color: defaults.textColor, maxTicksLimit: 12, font: { size: 10 } }},
                y: { grid: { color: defaults.gridColor }, ticks: { color: defaults.textColor, font: { size: 10 } }, min: 0, max: 100, position: 'right' },
            }
        }
    });
}

function renderVolumeAnalysis(data) {
    const ctx = document.getElementById('volumeAnalysisChart');
    if (volumeAnalysisChart) volumeAnalysisChart.destroy();
    
    const defaults = getChartDefaults();
    const colors = data.close.map((close, i) => {
        if (i === 0) return 'rgba(59, 130, 246, 0.4)';
        return close >= data.close[i-1] ? 'rgba(16, 185, 129, 0.5)' : 'rgba(239, 68, 68, 0.5)';
    });
    
    volumeAnalysisChart = new Chart(ctx, {
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
                    backgroundColor: defaults.bgColor, titleColor: defaults.textColor, bodyColor: defaults.textColor,
                    borderColor: 'rgba(148,163,184,0.2)', borderWidth: 1,
                    callbacks: { label: ctx => 'Volume: ' + formatNumber(ctx.parsed.y) }
                }
            },
            scales: {
                x: { grid: { display: false }, ticks: { color: defaults.textColor, maxTicksLimit: 12, font: { size: 10 } }},
                y: { grid: { color: defaults.gridColor }, ticks: { color: defaults.textColor, font: { size: 10 }, callback: v => formatNumber(v) }, position: 'right' },
            }
        }
    });
}

/* ── View Toggle ─────────────────────────────────────────── */
function switchAnalysisView(view) {
    analysisView = view;
    const isGraph = view === 'graph';
    document.getElementById('analysisGraphView').style.display = isGraph ? '' : 'none';
    document.getElementById('analysisTextView').style.display = isGraph ? 'none' : '';
    document.getElementById('btnAnalysisGraph').classList.toggle('active', isGraph);
    document.getElementById('btnAnalysisText').classList.toggle('active', !isGraph);

    const hint = document.getElementById('analysisViewHint');

    if (!isGraph) {
        const btn = document.getElementById('btnAnalysisText');
        const subscribed = btn && btn.dataset.subscribed === 'true';

        if (!subscribed) {
            if (hint) hint.textContent = 'Subscribe for ₹25 to unlock Text Reports';
            // Build fake blurred report lines for background
            const fakeLines = Array.from({length: 18}, (_, i) => {
                const w = [60, 85, 72, 90, 55, 78, 68, 95, 50, 80][i % 10];
                return `<div style="height:12px;border-radius:4px;background:rgba(148,163,184,.25);margin-bottom:10px;width:${w}%"></div>`;
            }).join('');

            document.getElementById('analysisTextReport').innerHTML = `
                <div class="blur-gate-wrap">
                    <div class="blur-gate-bg">
                        <div style="height:28px;border-radius:6px;background:rgba(148,163,184,.3);width:55%;margin-bottom:20px"></div>
                        ${fakeLines}
                    </div>
                    <div class="blur-gate-overlay">
                        <div class="gate-icon"><i class="fas fa-lock"></i></div>
                        <h3>Premium Feature</h3>
                        <p>The <strong>Text Report</strong> is available to subscribers only.<br>Unlock it with a one-time payment.</p>
                        <div class="blur-gate-price">₹25<small>one-time &middot; lifetime access</small></div>
                        <ul class="blur-gate-features">
                            <li>Full technical analysis text report</li>
                            <li>Signal breakdown for all indicators</li>
                            <li>Overall buy/sell verdict with score</li>
                            <li>All future premium features</li>
                        </ul>
                        <div class="gate-actions-row">
                            <a href="/subscribe" class="btn-gate-subscribe">
                                <i class="fas fa-crown"></i> Subscribe for ₹25
                            </a>
                            <button class="btn-gate-back" onclick="switchAnalysisView('graph')">
                                <i class="fas fa-chart-area"></i> Back to Graph
                            </button>
                        </div>
                    </div>
                </div>`;
        } else {
            if (hint) hint.textContent = 'Switch back to interactive charts';
            // Re-render with real data if available
            if (lastAnalysisData) {
                renderAnalysisTextReport(lastAnalysisData.signals,
                    document.getElementById('analysisSymbol').value.trim().toUpperCase() || 'Stock');
            }
        }
    } else {
        if (hint) hint.textContent = "Switch to Text Report if charts don't load";
    }
}

/* ── Text Report ─────────────────────────────────────────── */
function renderAnalysisTextReport(signals, symbol) {
    const now = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
    const overall = signals.overall;
    const overallCls = overall.includes('BUY') ? 'tr-positive' : overall.includes('SELL') ? 'tr-negative' : '';

    const signalEmoji = {
        'STRONG BUY': '🟢', 'BUY': '🟩', 'HOLD': '🟡', 'SELL': '🟥', 'STRONG SELL': '🔴'
    };

    const indRows = signals.indicators.map(ind => {
        const cls = ind.signal.toLowerCase().replace(' ', '-');
        const clsName = ind.signal.includes('BUY') ? 'tr-positive' : ind.signal.includes('SELL') ? 'tr-negative' : '';
        return `
        <div class="tr-stock-block" style="margin-bottom:0.65rem;">
            <div class="tr-stock-header">
                <span class="tr-sym" style="font-size:0.88rem;">${ind.indicator}</span>
                <span class="tr-return ${clsName}" style="margin-left:auto;">${signalEmoji[ind.signal] || '⚪'} ${ind.signal}</span>
            </div>
            <div class="tr-summary-text" style="border:none;padding-top:0.25rem;">${ind.reason}</div>
        </div>`;
    }).join('');

    const buyCount  = signals.indicators.filter(i => i.signal.includes('BUY')).length;
    const sellCount = signals.indicators.filter(i => i.signal.includes('SELL')).length;
    const holdCount = signals.indicators.length - buyCount - sellCount;

    const html = `
    <div class="text-report">
        <div class="tr-header">
            <div class="tr-title"><i class="fas fa-chart-bar"></i> Technical Analysis Report — ${symbol}</div>
            <div class="tr-date">${now}</div>
        </div>

        <div class="tr-section">
            <div class="tr-section-title">Overall Signal</div>
            <p class="tr-overview-text">
                The technical analysis for <strong>${symbol}</strong> gives an overall signal of
                <strong class="${overallCls}">${overall}</strong>
                with a score of <strong>${signals.score} / ${signals.max_score}</strong>.
                Out of ${signals.indicators.length} indicators: <strong>${buyCount} Buy</strong>,
                <strong>${holdCount} Hold</strong>, <strong>${sellCount} Sell</strong>.
            </p>
        </div>

        <div class="tr-section">
            <div class="tr-section-title">Signal Summary</div>
            <div class="tr-ranking">
                <div class="tr-rank-row">
                    <span class="tr-rank-sym" style="color:var(--accent-green);">BUY signals</span>
                    <div class="tr-rank-bar-wrap"><div class="tr-rank-bar pos" style="width:${(buyCount/signals.indicators.length)*100}%"></div></div>
                    <span class="tr-rank-val tr-positive">${buyCount}</span>
                </div>
                <div class="tr-rank-row">
                    <span class="tr-rank-sym" style="color:var(--accent-orange);">HOLD signals</span>
                    <div class="tr-rank-bar-wrap"><div class="tr-rank-bar" style="width:${(holdCount/signals.indicators.length)*100}%;background:var(--accent-orange);"></div></div>
                    <span class="tr-rank-val" style="color:var(--accent-orange);">${holdCount}</span>
                </div>
                <div class="tr-rank-row">
                    <span class="tr-rank-sym" style="color:var(--accent-red);">SELL signals</span>
                    <div class="tr-rank-bar-wrap"><div class="tr-rank-bar neg" style="width:${(sellCount/signals.indicators.length)*100}%"></div></div>
                    <span class="tr-rank-val tr-negative">${sellCount}</span>
                </div>
            </div>
        </div>

        <div class="tr-section">
            <div class="tr-section-title">Indicator Breakdown</div>
            ${indRows}
        </div>

        <div class="tr-section">
            <div class="tr-section-title">Key Takeaway</div>
            <ul class="tr-highlights">
                <li>📊 <strong>Overall:</strong> ${overall} — Score ${signals.score}/${signals.max_score}</li>
                <li>🟢 <strong>${buyCount} indicator(s)</strong> are signalling to Buy</li>
                <li>🟡 <strong>${holdCount} indicator(s)</strong> are neutral / Hold</li>
                <li>🔴 <strong>${sellCount} indicator(s)</strong> are signalling to Sell</li>
            </ul>
        </div>
    </div>`;

    document.getElementById('analysisTextReport').innerHTML = html;
}

window.runAnalysis = runAnalysis;
