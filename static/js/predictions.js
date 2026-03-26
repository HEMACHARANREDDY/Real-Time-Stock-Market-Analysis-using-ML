/* ═══════════════════════════════════════════════════════════
   Realtime S Pulse - ML Predictions Page
   ═══════════════════════════════════════════════════════════ */

let predictionChart = null, forecastChart = null, featureChart = null;
let areaChart = null, areaForecastChart = null;
let barChart = null, barForecastChart = null;
let pieChart = null, pieErrorChart = null;
let radarChart = null;
let doughnutChart = null, doughnutFeatureChart = null;
let lastPredData = null;
let predView = 'graph';
let currentChartType = 'line';

document.addEventListener('DOMContentLoaded', () => {
    initCommon();
    
    document.getElementById('predictBtn').addEventListener('click', runPrediction);
});

async function runPrediction() {
    const symbol = document.getElementById('predSymbol').value.trim().toUpperCase();
    const days = document.getElementById('forecastDays').value;
    
    if (!symbol) return showToast('Enter a stock symbol', 'error');
    
    // Show loading
    document.getElementById('predictionLoading').style.display = 'block';
    document.getElementById('predictionResults').style.display = 'none';
    document.getElementById('predictBtn').disabled = true;
    
    // Animate loading steps
    animateLoadingSteps();
    
    try {
        const res = await fetch(`/api/predict/${symbol}?days=${days}`);
        const data = await res.json();
        
        if (data.error) {
            showToast(data.error, 'error');
            document.getElementById('predictionLoading').style.display = 'none';
            document.getElementById('predictBtn').disabled = false;
            return;
        }
        
        // Hide loading, show results
        document.getElementById('predictionLoading').style.display = 'none';
        document.getElementById('predictionResults').style.display = 'block';
        document.getElementById('predictBtn').disabled = false;
        
        renderPredictionResults(data);
        renderPredTextReport(data);
        showToast(`ML predictions complete for ${symbol}`, 'success');
        
    } catch (err) {
        showToast('Prediction failed: ' + err.message, 'error');
        document.getElementById('predictionLoading').style.display = 'none';
        document.getElementById('predictBtn').disabled = false;
    }
}

function animateLoadingSteps() {
    const steps = document.querySelectorAll('#loadingSteps .step');
    steps.forEach((s, i) => {
        s.className = 'step';
        setTimeout(() => {
            if (i > 0) steps[i-1].classList.add('done');
            s.classList.add('active');
        }, i * 3000);
    });
}

function renderPredictionResults(data) {
    // Best model banner
    document.getElementById('bestModelName').textContent = data.best_model;
    const bestMetrics = data.models[data.best_model].metrics;
    document.getElementById('bestModelMetrics').textContent = 
        `R²: ${bestMetrics.r2.toFixed(4)} | MAE: ${formatPrice(bestMetrics.mae)} | MAPE: ${bestMetrics.mape.toFixed(1)}% | Dir. Accuracy: ${bestMetrics.directional_accuracy.toFixed(1)}%`;
    
    document.getElementById('predCurrentPrice').textContent = formatPrice(data.current_price);
    
    const lastPred = data.future[data.future.length - 1];
    document.getElementById('pred30dPrice').textContent = formatPrice(lastPred.predicted_price);
    
    const change = ((lastPred.predicted_price - data.current_price) / data.current_price * 100).toFixed(2);
    const changeEl = document.getElementById('predChange');
    changeEl.textContent = `${change >= 0 ? '+' : ''}${change}%`;
    changeEl.style.color = change >= 0 ? '#10b981' : '#ef4444';
    
    // Model cards
    renderModelCards(data);
    
    // Charts — render current type
    lastPredData = data;
    renderChartByType(currentChartType, data);
    
    // Metrics table
    renderMetricsTable(data);
    
    // Feature importance
    if (data.models['Random Forest']?.feature_importance) {
        renderFeatureImportance(data.models['Random Forest'].feature_importance);
    }
}

function renderModelCards(data) {
    const container = document.getElementById('modelCards');
    const modelNames = Object.keys(data.models);
    
    container.innerHTML = modelNames.map(name => {
        const m = data.models[name];
        const r2 = m.metrics.r2;
        const color = r2 >= 0.95 ? '#10b981' : r2 >= 0.9 ? '#06b6d4' : r2 >= 0.8 ? '#f59e0b' : '#ef4444';
        
        return `
            <div class="model-card ${name === data.best_model ? 'best' : ''}">
                ${name === data.best_model ? '<div style="font-size:0.7rem;color:#3b82f6;margin-bottom:0.5rem;font-weight:700;">★ BEST MODEL</div>' : ''}
                <h4>${name}</h4>
                <div class="r2-score" style="color:${color}">${(r2 * 100).toFixed(1)}%</div>
                <div class="r2-label">R² Score</div>
                <div class="model-mae">MAE: ${formatPrice(m.metrics.mae)}</div>
            </div>
        `;
    }).join('');
}

function renderPredictionChart(data) {
    const ctx = document.getElementById('predictionChart');
    if (predictionChart) predictionChart.destroy();
    
    const defaults = getChartDefaults();
    const datasets = [
        {
            label: 'Actual',
            data: data.actual_prices,
            borderColor: COLORS.blue,
            borderWidth: 2,
            tension: 0.3,
            pointRadius: 0,
        }
    ];
    
    const modelColors = {
        'Random Forest': COLORS.green,
        'Gradient Boosting': COLORS.purple,
        'Ridge Regression': COLORS.cyan,
        'SVR': COLORS.orange,
        'Linear Regression': COLORS.pink,
        'Ensemble': '#ffffff',
    };
    
    for (const [name, model] of Object.entries(data.models)) {
        if (name === 'Ensemble') continue; // Show ensemble separately
        datasets.push({
            label: name,
            data: model.predictions,
            borderColor: modelColors[name] || COLORS.orange,
            borderWidth: 1.5,
            tension: 0.3,
            pointRadius: 0,
            borderDash: [4, 4],
        });
    }
    
    // Ensemble (solid, thicker)
    if (data.models['Ensemble']) {
        datasets.push({
            label: 'Ensemble',
            data: data.models['Ensemble'].predictions,
            borderColor: '#f59e0b',
            borderWidth: 2.5,
            tension: 0.3,
            pointRadius: 0,
        });
    }
    
    predictionChart = new Chart(ctx, {
        type: 'line',
        data: { labels: data.test_dates, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    labels: { color: defaults.textColor, usePointStyle: true, padding: 10, font: { size: 11 } },
                    position: 'top',
                },
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

function renderForecastChart(data) {
    const ctx = document.getElementById('forecastChart');
    if (forecastChart) forecastChart.destroy();
    
    const defaults = getChartDefaults();
    const futureDates = data.future.map(f => f.date);
    const predicted = data.future.map(f => f.predicted_price);
    const upper = data.future.map(f => f.upper_bound);
    const lower = data.future.map(f => f.lower_bound);
    
    // Add current price as starting point
    const allDates = [data.test_dates[data.test_dates.length - 1], ...futureDates];
    const allPredicted = [data.current_price, ...predicted];
    const allUpper = [data.current_price, ...upper];
    const allLower = [data.current_price, ...lower];
    
    forecastChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: allDates,
            datasets: [
                {
                    label: 'Predicted',
                    data: allPredicted,
                    borderColor: COLORS.blue,
                    borderWidth: 2.5,
                    tension: 0.3,
                    pointRadius: 2,
                    pointBackgroundColor: COLORS.blue,
                },
                {
                    label: 'Upper Bound',
                    data: allUpper,
                    borderColor: 'rgba(16, 185, 129, 0.3)',
                    borderWidth: 1,
                    tension: 0.3,
                    pointRadius: 0,
                    fill: false,
                },
                {
                    label: 'Lower Bound',
                    data: allLower,
                    borderColor: 'rgba(239, 68, 68, 0.3)',
                    borderWidth: 1,
                    tension: 0.3,
                    pointRadius: 0,
                    fill: '-1',
                    backgroundColor: 'rgba(59, 130, 246, 0.08)',
                },
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { labels: { color: defaults.textColor, usePointStyle: true, font: { size: 11 } }},
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

function renderMetricsTable(data) {
    const tbody = document.getElementById('metricsBody');
    
    tbody.innerHTML = Object.entries(data.models).map(([name, model]) => {
        const m = model.metrics;
        let rating, ratingClass;
        
        if (m.r2 >= 0.95) { rating = 'Excellent'; ratingClass = 'excellent'; }
        else if (m.r2 >= 0.9) { rating = 'Good'; ratingClass = 'good'; }
        else if (m.r2 >= 0.8) { rating = 'Fair'; ratingClass = 'fair'; }
        else { rating = 'Poor'; ratingClass = 'poor'; }
        
        const isBest = name === data.best_model;
        
        return `
            <tr style="${isBest ? 'background: rgba(59, 130, 246, 0.05);' : ''}">
                <td style="font-family: var(--font-sans); font-weight: ${isBest ? '700' : '500'};">
                    ${isBest ? '★ ' : ''}${name}
                </td>
                <td>${formatPrice(m.mae)}</td>
                <td>${formatPrice(m.rmse)}</td>
                <td>${m.r2.toFixed(4)}</td>
                <td>${m.mape.toFixed(2)}%</td>
                <td>${m.directional_accuracy.toFixed(1)}%</td>
                <td><span class="rating-badge ${ratingClass}">${rating}</span></td>
            </tr>
        `;
    }).join('');
}

function renderFeatureImportance(features) {
    const ctx = document.getElementById('featureChart');
    if (featureChart) featureChart.destroy();
    
    const defaults = getChartDefaults();
    const labels = Object.keys(features);
    const values = Object.values(features);
    
    const colors = values.map((_, i) => {
        const opacity = 1 - (i * 0.08);
        return `rgba(59, 130, 246, ${opacity})`;
    });
    
    featureChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Importance',
                data: values,
                backgroundColor: colors,
                borderRadius: 6,
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
                    callbacks: { label: ctx => 'Importance: ' + (ctx.parsed.x * 100).toFixed(2) + '%' }
                }
            },
            scales: {
                x: { grid: { color: defaults.gridColor }, ticks: { color: defaults.textColor, font: { size: 10 }, callback: v => (v * 100).toFixed(0) + '%' }},
                y: { grid: { display: false }, ticks: { color: defaults.textColor, font: { size: 11 } }},
            }
        }
    });
}

/* ── Chart Type Switcher ──────────────────────────────────── */
function switchChartType(type) {
    currentChartType = type;
    // Sync dropdown
    const sel = document.getElementById('chartTypeSelect');
    if (sel) sel.value = type;
    // Show/hide panels
    document.querySelectorAll('.chart-panel').forEach(p => p.style.display = 'none');
    const panel = document.getElementById('chartPanel_' + type);
    if (panel) panel.style.display = '';
    // Render the selected chart type with cached data
    if (lastPredData) renderChartByType(type, lastPredData);
}

function renderChartByType(type, data) {
    switch (type) {
        case 'line':
            renderPredictionChart(data);
            renderForecastChart(data);
            break;
        case 'area':
            renderAreaChart(data);
            renderAreaForecastChart(data);
            break;
        case 'bar':
            renderBarChart(data);
            renderBarForecastChart(data);
            break;
        case 'pie':
            renderPieChart(data);
            renderPieErrorChart(data);
            break;
        case 'radar':
            renderRadarChart(data);
            break;
        case 'doughnut':
            renderDoughnutChart(data);
            renderDoughnutFeatureChart(data);
            break;
    }
}

/* ── Area Charts ──────────────────────────────────────────── */
function renderAreaChart(data) {
    const ctx = document.getElementById('areaChart');
    if (!ctx) return;
    if (areaChart) areaChart.destroy();
    const defaults = getChartDefaults();
    const modelColors = {
        'Random Forest': COLORS.green, 'Gradient Boosting': COLORS.purple,
        'Ridge Regression': COLORS.cyan, 'SVR': COLORS.orange,
        'Linear Regression': COLORS.pink, 'Ensemble': '#f59e0b',
    };
    const datasets = [{
        label: 'Actual', data: data.actual_prices,
        borderColor: COLORS.blue, backgroundColor: hexToRgba(COLORS.blue, 0.15),
        borderWidth: 2, tension: 0.3, pointRadius: 0, fill: true,
    }];
    for (const [name, model] of Object.entries(data.models)) {
        if (name === 'Ensemble') continue;
        const c = modelColors[name] || COLORS.orange;
        datasets.push({
            label: name, data: model.predictions,
            borderColor: c, backgroundColor: hexToRgba(c, 0.06),
            borderWidth: 1.5, tension: 0.3, pointRadius: 0, fill: true, borderDash: [4, 4],
        });
    }
    if (data.models['Ensemble']) {
        datasets.push({
            label: 'Ensemble', data: data.models['Ensemble'].predictions,
            borderColor: '#f59e0b', backgroundColor: hexToRgba('#f59e0b', 0.1),
            borderWidth: 2.5, tension: 0.3, pointRadius: 0, fill: true,
        });
    }
    areaChart = new Chart(ctx, {
        type: 'line', data: { labels: data.test_dates, datasets },
        options: chartLineOpts(defaults),
    });
}

function renderAreaForecastChart(data) {
    const ctx = document.getElementById('areaForecastChart');
    if (!ctx) return;
    if (areaForecastChart) areaForecastChart.destroy();
    const defaults = getChartDefaults();
    const futureDates = data.future.map(f => f.date);
    const allDates = [data.test_dates[data.test_dates.length - 1], ...futureDates];
    const allPredicted = [data.current_price, ...data.future.map(f => f.predicted_price)];
    const allUpper = [data.current_price, ...data.future.map(f => f.upper_bound)];
    const allLower = [data.current_price, ...data.future.map(f => f.lower_bound)];

    areaForecastChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: allDates,
            datasets: [
                { label: 'Predicted', data: allPredicted, borderColor: COLORS.blue, backgroundColor: hexToRgba(COLORS.blue, 0.18), borderWidth: 2.5, tension: 0.3, pointRadius: 2, fill: true },
                { label: 'Upper Bound', data: allUpper, borderColor: 'rgba(16,185,129,0.4)', borderWidth: 1, tension: 0.3, pointRadius: 0, fill: false },
                { label: 'Lower Bound', data: allLower, borderColor: 'rgba(239,68,68,0.4)', borderWidth: 1, tension: 0.3, pointRadius: 0, fill: '-1', backgroundColor: 'rgba(59,130,246,0.08)' },
            ]
        },
        options: chartLineOpts(defaults),
    });
}

/* ── Bar Charts ──────────────────────────────────────────── */
function renderBarChart(data) {
    const ctx = document.getElementById('barChart');
    if (!ctx) return;
    if (barChart) barChart.destroy();
    const defaults = getChartDefaults();
    const modelNames = Object.keys(data.models);
    const lastActual = data.actual_prices[data.actual_prices.length - 1];
    const modelColors = [COLORS.green, COLORS.purple, COLORS.cyan, COLORS.orange, COLORS.pink, '#f59e0b'];

    const barData = modelNames.map((name, i) => {
        const preds = data.models[name].predictions;
        return preds[preds.length - 1];
    });

    barChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: modelNames,
            datasets: [
                { label: 'Actual Price', data: modelNames.map(() => lastActual), backgroundColor: hexToRgba(COLORS.blue, 0.7), borderRadius: 6, barPercentage: 0.5 },
                { label: 'Predicted Price', data: barData, backgroundColor: modelColors.map(c => hexToRgba(c, 0.7)), borderRadius: 6, barPercentage: 0.5 },
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: defaults.textColor, usePointStyle: true, font: { size: 11 } } },
                tooltip: { backgroundColor: defaults.bgColor, titleColor: defaults.textColor, bodyColor: defaults.textColor, borderColor: 'rgba(148,163,184,0.2)', borderWidth: 1, callbacks: { label: ctx => `${ctx.dataset.label}: ${formatPrice(ctx.parsed.y)}` } }
            },
            scales: {
                x: { grid: { color: defaults.gridColor }, ticks: { color: defaults.textColor, font: { size: 10 } } },
                y: { grid: { color: defaults.gridColor }, ticks: { color: defaults.textColor, font: { size: 10 }, callback: v => formatPrice(v) } },
            }
        }
    });
}

function renderBarForecastChart(data) {
    const ctx = document.getElementById('barForecastChart');
    if (!ctx) return;
    if (barForecastChart) barForecastChart.destroy();
    const defaults = getChartDefaults();

    // Sample forecast at intervals
    const step = Math.max(1, Math.floor(data.future.length / 10));
    const sampled = data.future.filter((_, i) => i % step === 0 || i === data.future.length - 1);
    const labels = sampled.map(f => f.date);
    const predicted = sampled.map(f => f.predicted_price);
    const upper = sampled.map(f => f.upper_bound);
    const lower = sampled.map(f => f.lower_bound);

    barForecastChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                { label: 'Upper Bound', data: upper, backgroundColor: hexToRgba(COLORS.green, 0.5), borderRadius: 4 },
                { label: 'Predicted', data: predicted, backgroundColor: hexToRgba(COLORS.blue, 0.7), borderRadius: 4 },
                { label: 'Lower Bound', data: lower, backgroundColor: hexToRgba(COLORS.red || '#ef4444', 0.5), borderRadius: 4 },
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: defaults.textColor, usePointStyle: true, font: { size: 11 } } },
                tooltip: { backgroundColor: defaults.bgColor, titleColor: defaults.textColor, bodyColor: defaults.textColor, borderColor: 'rgba(148,163,184,0.2)', borderWidth: 1, callbacks: { label: ctx => `${ctx.dataset.label}: ${formatPrice(ctx.parsed.y)}` } }
            },
            scales: {
                x: { grid: { color: defaults.gridColor }, ticks: { color: defaults.textColor, font: { size: 9 }, maxRotation: 45 } },
                y: { grid: { color: defaults.gridColor }, ticks: { color: defaults.textColor, font: { size: 10 }, callback: v => formatPrice(v) } },
            }
        }
    });
}

/* ── Pie Charts ──────────────────────────────────────────── */
function renderPieChart(data) {
    const ctx = document.getElementById('pieChart');
    if (!ctx) return;
    if (pieChart) pieChart.destroy();
    const defaults = getChartDefaults();
    const modelNames = Object.keys(data.models);
    const r2Scores = modelNames.map(n => Math.max(0, data.models[n].metrics.r2 * 100));
    const bgColors = [COLORS.green, COLORS.purple, COLORS.cyan, COLORS.orange, COLORS.pink, '#f59e0b'].map(c => hexToRgba(c, 0.8));

    pieChart = new Chart(ctx, {
        type: 'pie',
        data: { labels: modelNames, datasets: [{ data: r2Scores, backgroundColor: bgColors, borderWidth: 2, borderColor: defaults.bgColor }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: defaults.textColor, padding: 12, usePointStyle: true, font: { size: 11 } } },
                tooltip: { backgroundColor: defaults.bgColor, titleColor: defaults.textColor, bodyColor: defaults.textColor, callbacks: { label: ctx => `${ctx.label}: R² ${ctx.parsed.toFixed(1)}%` } }
            }
        }
    });
}

function renderPieErrorChart(data) {
    const ctx = document.getElementById('pieErrorChart');
    if (!ctx) return;
    if (pieErrorChart) pieErrorChart.destroy();
    const defaults = getChartDefaults();
    const modelNames = Object.keys(data.models);
    const mapeScores = modelNames.map(n => data.models[n].metrics.mape);
    const bgColors = [COLORS.green, COLORS.purple, COLORS.cyan, COLORS.orange, COLORS.pink, '#f59e0b'].map(c => hexToRgba(c, 0.8));

    pieErrorChart = new Chart(ctx, {
        type: 'pie',
        data: { labels: modelNames, datasets: [{ data: mapeScores, backgroundColor: bgColors, borderWidth: 2, borderColor: defaults.bgColor }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: defaults.textColor, padding: 12, usePointStyle: true, font: { size: 11 } } },
                tooltip: { backgroundColor: defaults.bgColor, titleColor: defaults.textColor, bodyColor: defaults.textColor, callbacks: { label: ctx => `${ctx.label}: MAPE ${ctx.parsed.toFixed(2)}%` } }
            }
        }
    });
}

/* ── Radar Chart ─────────────────────────────────────────── */
function renderRadarChart(data) {
    const ctx = document.getElementById('radarChart');
    if (!ctx) return;
    if (radarChart) radarChart.destroy();
    const defaults = getChartDefaults();
    const modelNames = Object.keys(data.models);
    const radarColors = [COLORS.green, COLORS.purple, COLORS.cyan, COLORS.orange, COLORS.pink, '#f59e0b'];

    const datasets = modelNames.map((name, i) => {
        const m = data.models[name].metrics;
        return {
            label: name,
            data: [
                m.r2 * 100,
                Math.max(0, 100 - m.mape),
                m.directional_accuracy,
                Math.max(0, 100 - (m.mae / data.current_price * 100)),
                Math.max(0, 100 - (m.rmse / data.current_price * 100)),
            ],
            borderColor: radarColors[i] || COLORS.blue,
            backgroundColor: hexToRgba(radarColors[i] || COLORS.blue, 0.12),
            borderWidth: 2,
            pointBackgroundColor: radarColors[i] || COLORS.blue,
            pointRadius: 3,
        };
    });

    radarChart = new Chart(ctx, {
        type: 'radar',
        data: { labels: ['R² Score', 'Accuracy (100-MAPE)', 'Dir. Accuracy', 'MAE Score', 'RMSE Score'], datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: defaults.textColor, padding: 12, usePointStyle: true, font: { size: 11 } } },
                tooltip: { backgroundColor: defaults.bgColor, titleColor: defaults.textColor, bodyColor: defaults.textColor, borderColor: 'rgba(148,163,184,0.2)', borderWidth: 1, callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.r.toFixed(1)}%` } }
            },
            scales: {
                r: {
                    beginAtZero: true, max: 100,
                    grid: { color: defaults.gridColor },
                    angleLines: { color: defaults.gridColor },
                    pointLabels: { color: defaults.textColor, font: { size: 11 } },
                    ticks: { color: defaults.textColor, backdropColor: 'transparent', font: { size: 9 }, stepSize: 20 }
                }
            }
        }
    });
}

/* ── Doughnut Charts ─────────────────────────────────────── */
function renderDoughnutChart(data) {
    const ctx = document.getElementById('doughnutChart');
    if (!ctx) return;
    if (doughnutChart) doughnutChart.destroy();
    const defaults = getChartDefaults();
    const modelNames = Object.keys(data.models);
    const r2Scores = modelNames.map(n => Math.max(0, data.models[n].metrics.r2 * 100));
    const bgColors = [COLORS.green, COLORS.purple, COLORS.cyan, COLORS.orange, COLORS.pink, '#f59e0b'].map(c => hexToRgba(c, 0.8));

    doughnutChart = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: modelNames, datasets: [{ data: r2Scores, backgroundColor: bgColors, borderWidth: 2, borderColor: defaults.bgColor, cutout: '55%' }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: defaults.textColor, padding: 12, usePointStyle: true, font: { size: 11 } } },
                tooltip: { backgroundColor: defaults.bgColor, titleColor: defaults.textColor, bodyColor: defaults.textColor, callbacks: { label: ctx => `${ctx.label}: R² ${ctx.parsed.toFixed(1)}%` } }
            }
        }
    });
}

function renderDoughnutFeatureChart(data) {
    const ctx = document.getElementById('doughnutFeatureChart');
    if (!ctx) return;
    if (doughnutFeatureChart) doughnutFeatureChart.destroy();
    const defaults = getChartDefaults();
    const features = data.models['Random Forest']?.feature_importance;
    if (!features) return;

    const labels = Object.keys(features);
    const values = Object.values(features).map(v => v * 100);
    const bgColors = labels.map((_, i) => hexToRgba(COLORS.blue, 1 - i * 0.1));

    doughnutFeatureChart = new Chart(ctx, {
        type: 'doughnut',
        data: { labels, datasets: [{ data: values, backgroundColor: bgColors, borderWidth: 2, borderColor: defaults.bgColor, cutout: '50%' }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: defaults.textColor, padding: 10, usePointStyle: true, font: { size: 10 } } },
                tooltip: { backgroundColor: defaults.bgColor, titleColor: defaults.textColor, bodyColor: defaults.textColor, callbacks: { label: ctx => `${ctx.label}: ${ctx.parsed.toFixed(2)}%` } }
            }
        }
    });
}

/* ── Helper: hex to rgba ─────────────────────────────────── */
function hexToRgba(hex, alpha) {
    if (hex.startsWith('rgba') || hex.startsWith('rgb')) return hex.replace(/[\d.]+\)$/, alpha + ')');
    let c = hex.replace('#', '');
    if (c.length === 3) c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2];
    const r = parseInt(c.substring(0,2), 16);
    const g = parseInt(c.substring(2,4), 16);
    const b = parseInt(c.substring(4,6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
}

/* ── Helper: shared line/area chart options ───────────────── */
function chartLineOpts(defaults) {
    return {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: { labels: { color: defaults.textColor, usePointStyle: true, padding: 10, font: { size: 11 } }, position: 'top' },
            tooltip: { backgroundColor: defaults.bgColor, titleColor: defaults.textColor, bodyColor: defaults.textColor, borderColor: 'rgba(148,163,184,0.2)', borderWidth: 1, callbacks: { label: ctx => `${ctx.dataset.label}: ${formatPrice(ctx.parsed.y)}` } }
        },
        scales: {
            x: { grid: { color: defaults.gridColor }, ticks: { color: defaults.textColor, maxTicksLimit: 12, font: { size: 10 } } },
            y: { grid: { color: defaults.gridColor }, ticks: { color: defaults.textColor, font: { size: 10 }, callback: v => formatPrice(v) }, position: 'right' },
        }
    };
}

/* ── View Toggle ─────────────────────────────────────────── */
function switchPredView(view) {
    predView = view;
    const isGraph = view === 'graph';
    document.getElementById('predGraphView').style.display = isGraph ? '' : 'none';
    document.getElementById('predTextView').style.display = isGraph ? 'none' : '';
    document.getElementById('btnPredGraph').classList.toggle('active', isGraph);
    document.getElementById('btnPredText').classList.toggle('active', !isGraph);
}

/* ── Text Report ─────────────────────────────────────────── */
function renderPredTextReport(data) {
    lastPredData = data;
    const symbol = document.getElementById('predSymbol').value.trim().toUpperCase();
    const days = document.getElementById('forecastDays').value;
    const now = new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });

    const lastFuture = data.future[data.future.length - 1];
    const firstFuture = data.future[0];
    const totalChange = ((lastFuture.predicted_price - data.current_price) / data.current_price * 100).toFixed(2);
    const changeCls = totalChange >= 0 ? 'tr-positive' : 'tr-negative';

    // Model rows ranked by R²
    const modelsSorted = Object.entries(data.models).sort((a, b) => b[1].metrics.r2 - a[1].metrics.r2);

    const modelRows = modelsSorted.map(([name, m], i) => {
        const r2 = m.metrics.r2;
        const isBest = name === data.best_model;
        const ratingLabel = r2 >= 0.95 ? 'Excellent' : r2 >= 0.9 ? 'Good' : r2 >= 0.8 ? 'Fair' : 'Poor';
        const ratingCls = r2 >= 0.95 ? 'tr-positive' : r2 >= 0.8 ? '' : 'tr-negative';
        return `
        <div class="tr-stock-block" style="margin-bottom:0.6rem;">
            <div class="tr-stock-header">
                <span class="tr-rank">#${i+1}</span>
                <span class="tr-sym" style="font-size:0.88rem;">${isBest ? '★ ' : ''}${name}</span>
                <span class="tr-return ${ratingCls}" style="margin-left:auto;">${ratingLabel} — R² ${(r2*100).toFixed(1)}%</span>
            </div>
            <div class="tr-metrics">
                <div class="tr-metric"><span class="tr-metric-label">MAE</span><span class="tr-metric-value">${formatPrice(m.metrics.mae)}</span></div>
                <div class="tr-metric"><span class="tr-metric-label">RMSE</span><span class="tr-metric-value">${formatPrice(m.metrics.rmse)}</span></div>
                <div class="tr-metric"><span class="tr-metric-label">MAPE</span><span class="tr-metric-value">${m.metrics.mape.toFixed(2)}%</span></div>
                <div class="tr-metric"><span class="tr-metric-label">Dir. Accuracy</span><span class="tr-metric-value">${m.metrics.directional_accuracy.toFixed(1)}%</span></div>
            </div>
        </div>`;
    }).join('');

    // Forecast milestones
    const milestones = [];
    [6, 13, 29].forEach(idx => {
        if (data.future[idx]) {
            const f = data.future[idx];
            const chg = ((f.predicted_price - data.current_price) / data.current_price * 100).toFixed(2);
            milestones.push({ label: `Day ${idx+1} (${f.date})`, price: f.predicted_price, change: chg, upper: f.upper_bound, lower: f.lower_bound });
        }
    });
    // Always include last day
    const finalChg = ((lastFuture.predicted_price - data.current_price) / data.current_price * 100).toFixed(2);
    milestones.push({ label: `Day ${data.future.length} — End (${lastFuture.date})`, price: lastFuture.predicted_price, change: finalChg, upper: lastFuture.upper_bound, lower: lastFuture.lower_bound });

    const milestoneRows = milestones.map(m => {
        const cls = m.change >= 0 ? 'tr-positive' : 'tr-negative';
        return `<li>${m.label}: <strong class="${cls}">${formatPrice(m.price)}</strong> (${m.change >= 0 ? '+' : ''}${m.change}%) — Range: ${formatPrice(m.lower)} – ${formatPrice(m.upper)}</li>`;
    }).join('');

    const bestM = data.models[data.best_model].metrics;

    const html = `
    <div class="text-report">
        <div class="tr-header">
            <div class="tr-title"><i class="fas fa-brain"></i> ML Prediction Report — ${symbol}</div>
            <div class="tr-date">${now}</div>
        </div>

        <div class="tr-section">
            <div class="tr-section-title">Summary</div>
            <p class="tr-overview-text">
                6 ML models were trained on historical data for <strong>${symbol}</strong>.
                The best performing model is <strong>${data.best_model}</strong>
                with an R² of <strong>${(bestM.r2*100).toFixed(1)}%</strong>, MAE of ${formatPrice(bestM.mae)}, and directional accuracy of ${bestM.directional_accuracy.toFixed(1)}%.
                The current price is <strong>${formatPrice(data.current_price)}</strong>.
                Over the next <strong>${days} days</strong>, the ensemble model predicts a price of
                <strong class="${changeCls}">${formatPrice(lastFuture.predicted_price)}</strong>
                — a change of <strong class="${changeCls}">${totalChange >= 0 ? '+' : ''}${totalChange}%</strong>.
            </p>
        </div>

        <div class="tr-section">
            <div class="tr-section-title">Price Forecast Milestones</div>
            <ul class="tr-highlights">
                <li>📍 <strong>Current Price:</strong> ${formatPrice(data.current_price)}</li>
                ${milestoneRows}
            </ul>
        </div>

        <div class="tr-section">
            <div class="tr-section-title">Model Performance (Best to Worst)</div>
            ${modelRows}
        </div>

        <div class="tr-section">
            <div class="tr-section-title">Key Takeaway</div>
            <ul class="tr-highlights">
                <li>🏆 <strong>Best Model:</strong> ${data.best_model} — R² ${(bestM.r2*100).toFixed(1)}%</li>
                <li>📈 <strong>${days}-Day Target:</strong> ${formatPrice(lastFuture.predicted_price)} (${totalChange >= 0 ? '+' : ''}${totalChange}%)</li>
                <li>📉 <strong>Lower Bound:</strong> ${formatPrice(lastFuture.lower_bound)} — conservative estimate</li>
                <li>📈 <strong>Upper Bound:</strong> ${formatPrice(lastFuture.upper_bound)} — optimistic estimate</li>
                <li>⚠️ <strong>Disclaimer:</strong> ML predictions are estimates based on historical data and should not be used as sole financial advice.</li>
            </ul>
        </div>
    </div>`;

    document.getElementById('predTextReport').innerHTML = html;
}
