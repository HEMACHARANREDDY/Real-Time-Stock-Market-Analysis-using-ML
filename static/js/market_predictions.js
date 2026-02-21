/* ═══════════════════════════════════════════════════════════
   StockPulse AI - Market-Wide Predictions Page
   Predict ALL stocks at once with ML models
   ═══════════════════════════════════════════════════════════ */

let selectedStocks      = new Set();
let allPredictionData   = {};
let signalPieChart      = null;
let returnsBarChart     = null;
let ffChart             = null;   // single future-forecast chart
let stockNames          = {};
let lastForecastDays    = 30;

document.addEventListener('DOMContentLoaded', () => {
    initCommon();
    loadCategories();
    setupEventListeners();
});

// ── Load stock categories from backend ──
async function loadCategories() {
    try {
        const res = await fetch('/api/stock-categories');
        const data = await res.json();
        if (data.stock_names) stockNames = data.stock_names;
        renderCategoryTabs(data.categories);
    } catch (err) {
        console.error('Failed to load categories:', err);
        // Fallback
        renderCategoryTabs({
            'Tech Giants': ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'NFLX'],
            'Finance': ['JPM', 'BAC', 'GS', 'V', 'MA'],
            'Healthcare': ['JNJ', 'UNH', 'PFE', 'ABBV', 'LLY'],
        });
    }
}

function renderCategoryTabs(categories) {
    const container = document.getElementById('categoryTabs');
    
    container.innerHTML = Object.entries(categories).map(([cat, stocks]) => `
        <div class="category-tab">
            <button class="category-btn" data-stocks='${JSON.stringify(stocks)}' data-cat="${cat}">
                <span class="cat-name">${cat}</span>
                <span class="cat-count">${stocks.length} stocks</span>
            </button>
            <div class="category-stocks" id="cat-${cat.replace(/[^a-zA-Z0-9]/g, '')}">
                ${stocks.map(s => `
                    <label class="stock-chip">
                        <input type="checkbox" value="${s}" class="stock-checkbox">
                        <span>${stockNames[s] || s}</span>
                    </label>
                `).join('')}
            </div>
        </div>
    `).join('');
    
    // Add "Select All" button
    container.innerHTML += `
        <div style="margin-top:0.75rem;">
            <button class="btn-sm" id="selectAllBtn"><i class="fas fa-check-double"></i> Select All</button>
            <button class="btn-sm" id="clearAllBtn" style="margin-left:0.5rem;"><i class="fas fa-times"></i> Clear All</button>
        </div>
    `;
    
    // Category button clicks - toggle show stocks + select/deselect all in category
    container.querySelectorAll('.category-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const cat = btn.dataset.cat;
            const stocksDiv = document.getElementById('cat-' + cat.replace(/[^a-zA-Z0-9]/g, ''));
            const isVisible = stocksDiv.classList.contains('visible');
            
            if (isVisible) {
                stocksDiv.classList.remove('visible');
            } else {
                stocksDiv.classList.add('visible');
            }
        });
    });
    
    // Individual stock checkboxes
    container.querySelectorAll('.stock-checkbox').forEach(cb => {
        cb.addEventListener('change', () => {
            if (cb.checked) {
                selectedStocks.add(cb.value);
            } else {
                selectedStocks.delete(cb.value);
            }
            updateSelectedBar();
        });
    });
    
    // Select All
    document.getElementById('selectAllBtn').addEventListener('click', () => {
        container.querySelectorAll('.stock-checkbox').forEach(cb => {
            cb.checked = true;
            selectedStocks.add(cb.value);
        });
        // Show all category stocks
        container.querySelectorAll('.category-stocks').forEach(el => el.classList.add('visible'));
        updateSelectedBar();
    });
    
    // Clear All
    document.getElementById('clearAllBtn').addEventListener('click', () => {
        container.querySelectorAll('.stock-checkbox').forEach(cb => {
            cb.checked = false;
        });
        selectedStocks.clear();
        updateSelectedBar();
    });
}

function updateSelectedBar() {
    const list = document.getElementById('selectedStocksList');
    const count = document.getElementById('selectedCount');
    
    list.innerHTML = Array.from(selectedStocks).map(s => 
        `<span class="selected-chip">${stockNames[s] || s} <i class="fas fa-times" onclick="removeStock('${s}')"></i></span>`
    ).join('');
    
    count.textContent = `${selectedStocks.size} selected`;
}

window.removeStock = function(sym) {
    selectedStocks.delete(sym);
    document.querySelectorAll('.stock-checkbox').forEach(cb => {
        if (cb.value === sym) cb.checked = false;
    });
    updateSelectedBar();
};

function setupEventListeners() {
    document.getElementById('runBatchBtn').addEventListener('click', runBatchPredictions);
    document.getElementById('closeModal').addEventListener('click', () => {
        document.getElementById('forecastModal').style.display = 'none';
    });
    
    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderTable(btn.dataset.filter);
        });
    });
    
    // Sort
    document.getElementById('sortBy').addEventListener('change', () => {
        const activeFilter = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
        renderTable(activeFilter);
    });

}


// ─────────────────────────────────────────────
// BATCH PREDICTION
// ─────────────────────────────────────────────

async function runBatchPredictions() {
    // Gather symbols from selection + custom input
    const customInput = document.getElementById('customSymbols').value;
    const customSymbols = customInput ? customInput.split(',').map(s => s.trim().toUpperCase()).filter(s => s) : [];
    
    const allSymbols = [...new Set([...selectedStocks, ...customSymbols])];
    
    if (allSymbols.length === 0) {
        showToast('Please select stocks or enter symbols to predict', 'error');
        return;
    }
    
    const mode = document.getElementById('predictionMode').value;
    lastForecastDays = parseInt(document.getElementById('batchForecastDays').value);
    
    // Show loading
    document.getElementById('batchLoading').style.display = 'block';
    document.getElementById('batchResults').style.display = 'none';
    document.getElementById('batchErrors').style.display = 'none';
    document.getElementById('runBatchBtn').disabled = true;
    
    if (mode === 'quick') {
        await runQuickScan(allSymbols);
    } else {
        await runMLPredictions(allSymbols, lastForecastDays);
    }
    
    document.getElementById('runBatchBtn').disabled = false;
}

async function runQuickScan(symbols) {
    document.getElementById('batchLoadingTitle').textContent = 'Running Quick Technical Scan...';
    document.getElementById('batchLoadingSubtext').textContent = `Scanning ${symbols.length} stocks with technical indicators.`;
    
    try {
        const res = await fetch('/api/quick-scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbols })
        });
        const data = await res.json();
        
        document.getElementById('batchLoading').style.display = 'none';
        
        if (data.error) {
            showToast(data.error, 'error');
            return;
        }
        
        // Convert quick scan results to same format
        allPredictionData = {};
        data.stocks.forEach(s => {
            allPredictionData[s.symbol] = {
                name: s.name,
                sector: 'N/A',
                current_price: s.price,
                predicted_price: s.price, // No price prediction in quick mode
                price_change: 0,
                price_change_pct: s.change_30d,
                signal: s.signal,
                best_model: 'Technical',
                r2_score: 0,
                mae: 0,
                mape: 0,
                directional_accuracy: 0,
                confidence: 0,
                rsi: s.rsi,
                change_5d: s.change_5d,
                change_30d: s.change_30d,
                score: s.score,
                forecast: [],
                isQuickScan: true,
            };
        });
        
        document.getElementById('batchResults').style.display = 'block';
        renderResults();
        renderBatchTextReport();
        showToast(`Quick scan complete: ${data.total} stocks analyzed`, 'success');
        
    } catch (err) {
        document.getElementById('batchLoading').style.display = 'none';
        showToast('Quick scan failed: ' + err.message, 'error');
    }
}

async function runMLPredictions(symbols, days) {
    document.getElementById('batchLoadingTitle').textContent = 'Running ML Predictions...';
    document.getElementById('batchLoadingSubtext').textContent = 
        `Training 5 ML models on ${symbols.length} stocks. Each stock takes ~10-20 seconds.`;
    
    // For large batches, process in chunks to show progress
    const chunkSize = 3;
    const chunks = [];
    for (let i = 0; i < symbols.length; i += chunkSize) {
        chunks.push(symbols.slice(i, i + chunkSize));
    }
    
    allPredictionData = {};
    let allErrors = [];
    let processed = 0;
    
    for (const chunk of chunks) {
        // Update progress
        const pct = Math.round((processed / symbols.length) * 100);
        document.getElementById('batchProgressFill').style.width = pct + '%';
        document.getElementById('batchProgressText').textContent = pct + '%';
        document.getElementById('batchCurrentStock').textContent = 
            `Processing: ${chunk.join(', ')} (${processed + 1}-${Math.min(processed + chunk.length, symbols.length)} of ${symbols.length})`;
        
        try {
            const res = await fetch('/api/predict-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbols: chunk, days })
            });
            const data = await res.json();
            
            if (data.predictions) {
                Object.assign(allPredictionData, data.predictions);
            }
            if (data.errors) {
                allErrors = allErrors.concat(data.errors);
            }
        } catch (err) {
            chunk.forEach(s => allErrors.push({ symbol: s, error: err.message }));
        }
        
        processed += chunk.length;
    }
    
    // Final progress
    document.getElementById('batchProgressFill').style.width = '100%';
    document.getElementById('batchProgressText').textContent = '100%';
    
    setTimeout(() => {
        document.getElementById('batchLoading').style.display = 'none';
        document.getElementById('batchResults').style.display = 'block';
        
        renderResults();
        renderBatchTextReport();
        
        // Show errors if any
        if (allErrors.length > 0) {
            document.getElementById('batchErrors').style.display = 'block';
            document.getElementById('errorList').innerHTML = allErrors.map(e => 
                `<div class="error-item"><strong>${e.symbol}:</strong> ${e.error}</div>`
            ).join('');
        }
        
        showToast(`ML predictions complete: ${Object.keys(allPredictionData).length} stocks analyzed`, 'success');
    }, 500);
}


// ─────────────────────────────────────────────
// RENDER RESULTS
// ─────────────────────────────────────────────

function renderResults() {
    const stocks = Object.entries(allPredictionData);
    
    // Summary counts
    let buyCount = 0, holdCount = 0, sellCount = 0;
    stocks.forEach(([_, s]) => {
        if (s.signal.includes('BUY')) buyCount++;
        else if (s.signal.includes('SELL')) sellCount++;
        else holdCount++;
    });
    
    document.getElementById('sumBuy').textContent = buyCount;
    document.getElementById('sumHold').textContent = holdCount;
    document.getElementById('sumSell').textContent = sellCount;
    document.getElementById('sumTotal').textContent = stocks.length;
    
    // Charts
    renderSignalPieChart(buyCount, holdCount, sellCount);
    renderReturnsChart(stocks);

    // Dedicated future predictions (one section)
    renderFuturePredictions();
    
    // Table
    renderTable('all');
}

function renderSignalPieChart(buy, hold, sell) {
    const ctx = document.getElementById('signalPieChart');
    if (signalPieChart) signalPieChart.destroy();
    
    const defaults = getChartDefaults();
    
    signalPieChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Buy / Strong Buy', 'Hold', 'Sell / Strong Sell'],
            datasets: [{
                data: [buy, hold, sell],
                backgroundColor: [
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(245, 158, 11, 0.8)',
                    'rgba(239, 68, 68, 0.8)',
                ],
                borderColor: [
                    'rgba(16, 185, 129, 1)',
                    'rgba(245, 158, 11, 1)',
                    'rgba(239, 68, 68, 1)',
                ],
                borderWidth: 2,
                hoverOffset: 8,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '55%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: defaults.textColor, padding: 15, usePointStyle: true, font: { size: 12 } }
                },
                tooltip: {
                    backgroundColor: defaults.bgColor,
                    titleColor: defaults.textColor,
                    bodyColor: defaults.textColor,
                    borderColor: 'rgba(148,163,184,0.2)',
                    borderWidth: 1,
                }
            }
        }
    });
}

function renderReturnsChart(stocks) {
    const ctx = document.getElementById('returnsBarChart');
    if (returnsBarChart) returnsBarChart.destroy();
    
    const defaults = getChartDefaults();
    
    // Sort by predicted change
    const sorted = [...stocks].sort((a, b) => b[1].price_change_pct - a[1].price_change_pct);
    const top = sorted.slice(0, 15); // Show top 15
    
    const labels = top.map(([sym, s]) => s.name || stockNames[sym] || sym);
    const values = top.map(([_, s]) => s.price_change_pct);
    const colors = values.map(v => v >= 0 ? 'rgba(16, 185, 129, 0.7)' : 'rgba(239, 68, 68, 0.7)');
    
    returnsBarChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Predicted Return %',
                data: values,
                backgroundColor: colors,
                borderRadius: 4,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: defaults.bgColor,
                    titleColor: defaults.textColor,
                    bodyColor: defaults.textColor,
                    borderColor: 'rgba(148,163,184,0.2)',
                    borderWidth: 1,
                    callbacks: { label: ctx => `${ctx.parsed.x >= 0 ? '+' : ''}${ctx.parsed.x.toFixed(2)}%` }
                }
            },
            scales: {
                x: { grid: { color: defaults.gridColor }, ticks: { color: defaults.textColor, callback: v => v + '%' }},
                y: { grid: { display: false }, ticks: { color: defaults.textColor, font: { size: 11, weight: '600' } }},
            }
        }
    });
}


// ─────────────────────────────────────────────────────────────
// FUTURE OUTLOOK — one panel, all stocks, UP ↑ or DOWN ↓
// ─────────────────────────────────────────────────────────────

function renderFuturePredictions() {
    const mlStocks = Object.entries(allPredictionData)
        .filter(([_, s]) => s.forecast && s.forecast.length > 0 && !s.isQuickScan)
        .sort((a, b) => b[1].price_change_pct - a[1].price_change_pct);

    const panel = document.getElementById('futureForecastPanel');
    if (mlStocks.length === 0) { panel.style.display = 'none'; return; }

    panel.style.display = 'block';
    document.getElementById('ffDaysBadge').textContent = `${lastForecastDays} Days`;

    const container = document.getElementById('ffStockCards');
    container.innerHTML = mlStocks.map(([sym, s]) => {
        const fc     = s.forecast;
        const cur    = s.current_price;
        const t7     = fc[Math.min(6,  fc.length - 1)];
        const t14    = fc[Math.min(13, fc.length - 1)];
        const tend   = fc[fc.length - 1];
        const sigCls = s.signal.includes('BUY') ? 'buy' : s.signal.includes('SELL') ? 'sell' : 'hold';

        const endPct  = ((tend.predicted_price - cur) / cur) * 100;
        const cardBdr = endPct >= 0 ? 'border-top:3px solid var(--accent-green);'
                                    : 'border-top:3px solid var(--accent-red);';

        const row = (label, point) => {
            if (!point) return '';
            const pct  = ((point.predicted_price - cur) / cur) * 100;
            const up   = pct >= 0;
            const col  = up ? 'var(--accent-green)' : 'var(--accent-red)';
            const icon = up ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';
            return `<div style="display:flex;align-items:center;gap:0.4rem;padding:0.28rem 0;
                        border-bottom:1px solid rgba(148,163,184,0.07);">
                    <span style="font-size:0.72rem;color:var(--text-muted);width:46px;flex-shrink:0;">${label}</span>
                    <i class="fas ${icon}" style="color:${col};font-size:0.78rem;"></i>
                    <span style="color:${col};font-family:var(--font-mono);font-size:0.82rem;font-weight:700;min-width:52px;text-align:right;">
                        ${up ? '+' : ''}${pct.toFixed(1)}%
                    </span>
                    <span style="color:var(--text-secondary);font-family:var(--font-mono);font-size:0.78rem;margin-left:auto;">
                        ${formatPrice(point.predicted_price)}
                    </span>
                </div>`;
        };

        return `<div class="ff-stock-card" onclick="showForecast('${sym}')" title="Click to see detailed chart"
                     style="cursor:pointer;${cardBdr}">
                <div class="fsc-header">
                    <span class="fsc-sym">${sym}</span>
                    <span class="signal-tag ${sigCls} fsc-sig">${s.signal}</span>
                </div>
                <div style="font-size:0.7rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;
                            text-overflow:ellipsis;margin-bottom:0.4rem;">
                    ${(s.name || sym).substring(0, 28)}
                </div>
                <div style="font-size:0.78rem;font-family:var(--font-mono);color:var(--text-secondary);
                            padding-bottom:0.4rem;margin-bottom:0.4rem;
                            border-bottom:1px solid rgba(148,163,184,0.12);">
                    <span style="color:var(--text-muted);font-size:0.68rem;">Now </span>${formatPrice(cur)}
                </div>
                ${row('7-Day', t7)}
                ${row('14-Day', t14)}
                ${row(lastForecastDays + 'D', tend)}
            </div>`;
    }).join('');
}

window.selectForecastStock = function(sym) {
    const panel = document.getElementById('futureForecastPanel');
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Update dropdown
    const sel = document.getElementById('ffStockSelect');
    if (sel) sel.value = sym;
    // Render chart + target cards for this stock
    renderInlineForecastChart(sym);
};

function renderFuturePredictions() {
    const mlStocks = Object.entries(allPredictionData)
        .filter(([_, s]) => s.forecast && s.forecast.length > 0 && !s.isQuickScan)
        .sort((a, b) => b[1].price_change_pct - a[1].price_change_pct);

    const panel = document.getElementById('futureForecastPanel');
    if (mlStocks.length === 0) { panel.style.display = 'none'; return; }
    panel.style.display = 'block';

    document.getElementById('ffDaysBadge').textContent = `${lastForecastDays} Days`;
    document.getElementById('ffEndLabel' ).textContent = `${lastForecastDays}-Day`;

    // Populate dropdown
    const sel = document.getElementById('ffStockSelect');
    sel.innerHTML = mlStocks
        .map(([sym, s]) => `<option value="${sym}">${sym} — ${(s.name||sym).substring(0,26)}</option>`)
        .join('');

    // Auto-load best mover
    renderInlineForecastChart(mlStocks[0][0]);

    // All-stocks overview cards
    const container = document.getElementById('ffStockCards');
    container.innerHTML = mlStocks.map(([sym, s]) => {
        const fc     = s.forecast;
        const cur    = s.current_price;
        const t7     = fc[Math.min(6,  fc.length - 1)];
        const t14    = fc[Math.min(13, fc.length - 1)];
        const tend   = fc[fc.length - 1];
        const sigCls = s.signal.includes('BUY') ? 'buy' : s.signal.includes('SELL') ? 'sell' : 'hold';
        const endPct = ((tend.predicted_price - cur) / cur) * 100;
        const bdr    = endPct >= 0 ? 'border-top:3px solid var(--accent-green);'
                                   : 'border-top:3px solid var(--accent-red);';

        const row = (label, pt) => {
            if (!pt) return '';
            const pct  = ((pt.predicted_price - cur) / cur) * 100;
            const up   = pct >= 0;
            const col  = up ? 'var(--accent-green)' : 'var(--accent-red)';
            const icon = up ? 'fa-arrow-trend-up' : 'fa-arrow-trend-down';
            return `<div style="display:flex;align-items:center;gap:0.35rem;padding:0.25rem 0;
                        border-bottom:1px solid rgba(148,163,184,0.07);">
                    <span style="font-size:0.7rem;color:var(--text-muted);width:42px;flex-shrink:0;">${label}</span>
                    <i class="fas ${icon}" style="color:${col};font-size:0.75rem;"></i>
                    <span style="color:${col};font-family:var(--font-mono);font-size:0.8rem;font-weight:700;min-width:48px;text-align:right;">${up?'+':''}${pct.toFixed(1)}%</span>
                    <span style="color:var(--text-secondary);font-family:var(--font-mono);font-size:0.76rem;margin-left:auto;">${formatPrice(pt.predicted_price)}</span>
                </div>`;
        };

        return `<div class="ff-stock-card" onclick="selectForecastStock('${sym}')" title="Load ${sym} forecast"
                     style="cursor:pointer;${bdr}">
                <div class="fsc-header">
                    <span class="fsc-sym">${sym}</span>
                    <span class="signal-tag ${sigCls} fsc-sig">${s.signal}</span>
                </div>
                <div style="font-size:0.69rem;color:var(--text-muted);white-space:nowrap;
                            overflow:hidden;text-overflow:ellipsis;margin-bottom:0.4rem;">${(s.name||sym).substring(0,28)}</div>
                <div style="font-size:0.76rem;font-family:var(--font-mono);color:var(--text-secondary);
                            padding-bottom:0.35rem;margin-bottom:0.35rem;
                            border-bottom:1px solid rgba(148,163,184,0.12);">
                    <span style="color:var(--text-muted);font-size:0.66rem;">Now </span>${formatPrice(cur)}
                </div>
                ${row('7-Day', t7)}
                ${row('14-Day', t14)}
                ${row(lastForecastDays+'D', tend)}
            </div>`;
    }).join('');
}

function renderInlineForecastChart(symbol) {
    const data = allPredictionData[symbol];
    if (!data || !data.forecast || data.forecast.length === 0) return;

    const fc     = data.forecast;
    const cur    = data.current_price;
    const isPos  = data.price_change_pct >= 0;
    const lineCol = isPos ? 'rgba(16,185,129,1)'    : 'rgba(239,68,68,1)';
    const bandCol = isPos ? 'rgba(16,185,129,0.3)'  : 'rgba(239,68,68,0.3)';
    const fillCol = isPos ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)';
    const defaults = getChartDefaults();

    // Update target cards
    const t7   = fc[Math.min(6,  fc.length - 1)];
    const t14  = fc[Math.min(13, fc.length - 1)];
    const tend = fc[fc.length - 1];

    const chg = (p) => {
        const pct = ((p - cur) / cur) * 100;
        const cls = pct >= 0 ? 'positive' : 'negative';
        return `<span class="ff-target-chg ${cls}">${pct>=0?'+':''}${pct.toFixed(2)}%</span>`;
    };
    const colFor = (p) => ((p - cur) / cur) >= 0 ? 'var(--accent-green)' : 'var(--accent-red)';

    document.getElementById('ffCurrentPrice').textContent = formatPrice(cur);
    document.getElementById('ffTarget7d' ).innerHTML = `<span style="color:${colFor(t7.predicted_price)}">${formatPrice(t7.predicted_price)}</span>`;
    document.getElementById('ffTarget14d').innerHTML = `<span style="color:${colFor(t14.predicted_price)}">${formatPrice(t14.predicted_price)}</span>`;
    document.getElementById('ffTargetEnd').innerHTML = `<span style="color:${colFor(tend.predicted_price)}">${formatPrice(tend.predicted_price)}</span>`;
    document.getElementById('ffChg7d' ).innerHTML = chg(t7.predicted_price);
    document.getElementById('ffChg14d').innerHTML = chg(t14.predicted_price);
    document.getElementById('ffChgEnd').innerHTML = chg(tend.predicted_price);

    const sigCls = data.signal.includes('BUY') ? 'buy' : data.signal.includes('SELL') ? 'sell' : 'hold';
    document.getElementById('ffSignal').innerHTML = `<span class="signal-tag ${sigCls}">${data.signal}</span>`;
    document.getElementById('ffModel' ).textContent = data.best_model || '--';
    document.getElementById('ffR2'    ).textContent = data.r2_score != null ? (data.r2_score*100).toFixed(1)+'%' : 'N/A';

    // Draw chart
    const ctx = document.getElementById('ffChart');
    if (ffChart) ffChart.destroy();

    const labels = ['Today', ...fc.map(f => f.date)];
    const pred   = [cur, ...fc.map(f => f.predicted_price)];
    const upper  = [cur, ...fc.map(f => f.upper_bound)];
    const lower  = [cur, ...fc.map(f => f.lower_bound)];

    ffChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [
                { label: `${symbol} — Predicted Price`, data: pred,
                  borderColor: lineCol, borderWidth: 2.5, tension: 0.35,
                  pointRadius: (c) => c.dataIndex === 0 ? 6 : 2,
                  pointBackgroundColor: lineCol, pointBorderColor: '#fff', pointBorderWidth: 1.5 },
                { label: 'Upper Bound (90% CI)', data: upper,
                  borderColor: bandCol, borderDash: [4,3], borderWidth: 1,
                  tension: 0.35, pointRadius: 0, fill: false },
                { label: 'Lower Bound (90% CI)', data: lower,
                  borderColor: bandCol, borderDash: [4,3], borderWidth: 1,
                  tension: 0.35, pointRadius: 0, fill: '-1', backgroundColor: fillCol },
            ],
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { color: defaults.textColor, usePointStyle: true, font: { size: 11 } } },
                tooltip: {
                    backgroundColor: defaults.bgColor, titleColor: defaults.textColor,
                    bodyColor: defaults.textColor, borderColor: 'rgba(148,163,184,0.2)', borderWidth: 1,
                    callbacks: {
                        label: c => `${c.dataset.label}: ${formatPrice(c.parsed.y)}`,
                        afterBody: (items) => {
                            const idx = items[0]?.dataIndex;
                            if (idx > 0 && fc[idx-1]) return [`Confidence: ${(fc[idx-1].confidence*100).toFixed(0)}%`];
                            return [];
                        },
                    },
                },
            },
            scales: {
                x: { grid: { color: defaults.gridColor },
                     ticks: { color: defaults.textColor, maxTicksLimit: 10, font: { size: 10 }, maxRotation: 30 } },
                y: { grid: { color: defaults.gridColor }, position: 'right',
                     ticks: { color: defaults.textColor, font: { size: 10 }, callback: v => formatPrice(v) } },
            },
        },
    });
}


// ─────────────────────────────────────────────
// PREDICTIONS TABLE
// ─────────────────────────────────────────────

function renderTable(filter) {
    const sortBy = document.getElementById('sortBy').value;
    let stocks = Object.entries(allPredictionData);

    // Filter
    if (filter === 'buy')  stocks = stocks.filter(([_, s]) => s.signal.includes('BUY'));
    else if (filter === 'sell') stocks = stocks.filter(([_, s]) => s.signal.includes('SELL'));
    else if (filter === 'hold') stocks = stocks.filter(([_, s]) => s.signal === 'HOLD');

    // Sort
    switch (sortBy) {
        case 'change_desc': stocks.sort((a, b) => b[1].price_change_pct - a[1].price_change_pct); break;
        case 'change_asc':  stocks.sort((a, b) => a[1].price_change_pct - b[1].price_change_pct); break;
        case 'confidence':  stocks.sort((a, b) => ((b[1].r2_score || 0) + (b[1].confidence || 0)) - ((a[1].r2_score || 0) + (a[1].confidence || 0))); break;
        case 'symbol':      stocks.sort((a, b) => a[0].localeCompare(b[0])); break;
    }

    document.getElementById('resultCount').textContent = `${stocks.length} stocks`;

    const tbody = document.getElementById('batchTableBody');
    tbody.innerHTML = stocks.map(([sym, s], i) => {
        const isPos   = s.price_change_pct >= 0;
        const sigCls  = s.signal.includes('BUY') ? 'buy' : s.signal.includes('SELL') ? 'sell' : 'hold';
        const isQuick = s.isQuickScan;

        // R² and confidence display
        const r2Str   = isQuick || s.r2_score  == null ? 'N/A' : (s.r2_score  * 100).toFixed(1) + '%';
        const confStr = isQuick || s.confidence == null ? 'N/A' : (s.confidence * 100).toFixed(0) + '%';
        const confCol = !isQuick && s.confidence >= 0.7
            ? 'var(--accent-green)' : !isQuick && s.confidence >= 0.5
            ? 'var(--accent-orange)' : 'var(--text-muted)';

        // Price change using formatPrice (removes hardcoded ₹)
        const chgStr = isQuick ? '--'
            : `${isPos ? '+' : '-'}${formatPrice(Math.abs(s.price_change))}`;

        return `
            <tr>
                <td>${i + 1}</td>
                <td style="font-weight:700;font-family:var(--font-mono);">${sym}</td>
                <td style="max-width:155px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${s.name || sym}</td>
                <td style="font-family:var(--font-mono);">${formatPrice(s.current_price)}</td>
                <td style="font-family:var(--font-mono);">${isQuick ? '--' : formatPrice(s.predicted_price)}</td>
                <td class="${isPos ? 'positive' : 'negative'}" style="font-family:var(--font-mono);">${chgStr}</td>
                <td class="${isPos ? 'positive' : 'negative'}" style="font-weight:700;font-family:var(--font-mono);">
                    ${isPos ? '+' : ''}${s.price_change_pct.toFixed(2)}%
                </td>
                <td><span class="signal-tag ${sigCls}">${s.signal}</span></td>
                <td style="font-family:var(--font-mono);">${r2Str}</td>
                <td style="font-family:var(--font-mono);color:${confCol};">${confStr}</td>
                <td style="font-size:0.8rem;">${s.best_model}</td>
                <td style="white-space:nowrap;">
                    ${!isQuick && s.forecast && s.forecast.length > 0
                        ? `<button class="btn-sm" onclick="selectForecastStock('${sym}')">
                           <i class="fas fa-chart-line"></i> View Forecast</button>`
                        : `<a href="/predictions" class="btn-sm"><i class="fas fa-brain"></i> Detail</a>`}
                </td>
            </tr>`;
    }).join('');
}


// ─────────────────────────────────────────────
// FORECAST MODAL  (removed — forecast is now inline in the panel)
// ─────────────────────────────────────────────

/* ── View Toggle ─────────────────────────────────────────── */
let batchView = 'graph';

function switchBatchView(view) {
    batchView = view;
    const isGraph = view === 'graph';
    document.getElementById('batchGraphView').style.display = isGraph ? '' : 'none';
    document.getElementById('batchTextView').style.display = isGraph ? 'none' : '';
    document.getElementById('btnBatchGraph').classList.toggle('active', isGraph);
    document.getElementById('btnBatchText').classList.toggle('active', !isGraph);
}

/* ── Text Report ─────────────────────────────────────────── */
function renderBatchTextReport() {
    const now = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
    const entries = Object.entries(allPredictionData);
    if (!entries.length) return;

    const buyList  = entries.filter(([,s]) => s.signal && s.signal.includes('BUY'));
    const sellList = entries.filter(([,s]) => s.signal && s.signal.includes('SELL'));
    const holdList = entries.filter(([,s]) => s.signal && !s.signal.includes('BUY') && !s.signal.includes('SELL'));

    // Sort by predicted change desc for top gainers/decliners
    const sorted = [...entries].sort((a, b) => b[1].price_change_pct - a[1].price_change_pct);
    const topGainers  = sorted.slice(0, 5);
    const topDecliners = sorted.slice(-5).reverse();

    const gainersRows = topGainers.map(([sym, s]) => `<li>🟢 <strong>${sym}</strong> — ${formatPrice(s.current_price)} → ${formatPrice(s.predicted_price)} (<span class="tr-positive">+${s.price_change_pct.toFixed(2)}%</span>) · Signal: ${s.signal}</li>`).join('');
    const declinersRows = topDecliners.map(([sym, s]) => `<li>🔴 <strong>${sym}</strong> — ${formatPrice(s.current_price)} → ${formatPrice(s.predicted_price)} (<span class="tr-negative">${s.price_change_pct.toFixed(2)}%</span>) · Signal: ${s.signal}</li>`).join('');

    const allRows = entries.map(([sym, s], i) => {
        const isPos = s.price_change_pct >= 0;
        const cls = isPos ? 'tr-positive' : 'tr-negative';
        return `
        <div class="tr-stock-block" style="margin-bottom:0.5rem;">
            <div class="tr-stock-header">
                <span class="tr-rank">#${i+1}</span>
                <span class="tr-sym" style="font-size:0.85rem;">${sym}</span>
                <span style="font-size:0.78rem;color:var(--text-muted);">${stockNames[sym] || ''}</span>
                <span class="tr-return ${cls}" style="margin-left:auto;">${isPos ? '▲' : '▼'} ${isPos ? '+' : ''}${s.price_change_pct.toFixed(2)}%</span>
            </div>
            <div class="tr-metrics">
                <div class="tr-metric"><span class="tr-metric-label">Current</span><span class="tr-metric-value">${formatPrice(s.current_price)}</span></div>
                <div class="tr-metric"><span class="tr-metric-label">Predicted</span><span class="tr-metric-value ${cls}">${formatPrice(s.predicted_price)}</span></div>
                <div class="tr-metric"><span class="tr-metric-label">Signal</span><span class="tr-metric-value">${s.signal || '--'}</span></div>
                <div class="tr-metric"><span class="tr-metric-label">Best Model</span><span class="tr-metric-value" style="font-size:0.78rem;">${s.best_model || '--'}</span></div>
                ${s.r2_score != null ? `<div class="tr-metric"><span class="tr-metric-label">R²</span><span class="tr-metric-value">${(s.r2_score*100).toFixed(1)}%</span></div>` : ''}
            </div>
        </div>`;
    }).join('');

    const avgChange = (entries.reduce((acc, [,s]) => acc + s.price_change_pct, 0) / entries.length).toFixed(2);

    const html = `
    <div class="text-report">
        <div class="tr-header">
            <div class="tr-title"><i class="fas fa-globe"></i> Market-Wide Prediction Report</div>
            <div class="tr-date">${now}</div>
        </div>

        <div class="tr-section">
            <div class="tr-section-title">Market Overview</div>
            <p class="tr-overview-text">
                Predictions were run for <strong>${entries.length} stocks</strong>.
                <strong>${buyList.length}</strong> stocks received a Buy signal,
                <strong>${holdList.length}</strong> Hold, and
                <strong>${sellList.length}</strong> Sell.
                The average predicted return across all stocks is <strong>${avgChange >= 0 ? '+' : ''}${avgChange}%</strong>.
            </p>
        </div>

        <div class="tr-section">
            <div class="tr-section-title">Signal Distribution</div>
            <div class="tr-ranking">
                <div class="tr-rank-row">
                    <span class="tr-rank-sym" style="color:var(--accent-green);">Buy signals</span>
                    <div class="tr-rank-bar-wrap"><div class="tr-rank-bar pos" style="width:${(buyList.length/entries.length)*100}%"></div></div>
                    <span class="tr-rank-val tr-positive">${buyList.length}</span>
                </div>
                <div class="tr-rank-row">
                    <span class="tr-rank-sym" style="color:var(--accent-orange);">Hold signals</span>
                    <div class="tr-rank-bar-wrap"><div class="tr-rank-bar" style="width:${(holdList.length/entries.length)*100}%;background:var(--accent-orange);"></div></div>
                    <span class="tr-rank-val" style="color:var(--accent-orange);">${holdList.length}</span>
                </div>
                <div class="tr-rank-row">
                    <span class="tr-rank-sym" style="color:var(--accent-red);">Sell signals</span>
                    <div class="tr-rank-bar-wrap"><div class="tr-rank-bar neg" style="width:${(sellList.length/entries.length)*100}%"></div></div>
                    <span class="tr-rank-val tr-negative">${sellList.length}</span>
                </div>
            </div>
        </div>

        <div class="tr-section">
            <div class="tr-section-title">Top 5 Predicted Gainers</div>
            <ul class="tr-highlights">${gainersRows}</ul>
        </div>

        <div class="tr-section">
            <div class="tr-section-title">Top 5 Predicted Decliners</div>
            <ul class="tr-highlights">${declinersRows}</ul>
        </div>

        <div class="tr-section">
            <div class="tr-section-title">All Stocks Detail</div>
            ${allRows}
        </div>
    </div>`;

    document.getElementById('batchTextReport').innerHTML = html;
}