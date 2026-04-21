"""
Machine Learning Engine for Stock Price Prediction
Implements multiple ML models: LSTM, Random Forest, Linear Regression, SVR
"""

import numpy as np
import pandas as pd
import yfinance as yf
import requests
from datetime import datetime, timedelta
from sklearn.preprocessing import MinMaxScaler
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.svm import SVR
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import TimeSeriesSplit
import warnings
import time
warnings.filterwarnings('ignore')


class StockMLEngine:
    """Multi-model ML engine for stock prediction"""

    _YAHOO_CHART_HEADERS = {'User-Agent': 'Mozilla/5.0'}
    
    def __init__(self):
        self.scaler = MinMaxScaler(feature_range=(0, 1))
        self.look_back = 60  # Days of historical data to use for prediction
        self._history_cache = {}

    def _fetch_chart_history(self, symbol, period='2y', interval='1d'):
        """Fetch OHLCV data from Yahoo's chart API."""
        encoded_symbol = requests.utils.quote((symbol or '').upper(), safe='.')
        url = f'https://query1.finance.yahoo.com/v8/finance/chart/{encoded_symbol}'
        params = {
            'range': period,
            'interval': interval,
            'includePrePost': 'false',
            'events': 'div,splits',
        }
        response = requests.get(url, params=params, headers=self._YAHOO_CHART_HEADERS, timeout=20)
        response.raise_for_status()
        payload = response.json()
        chart = payload.get('chart', {})
        error = chart.get('error')
        if error:
            raise ValueError(error.get('description') or str(error))

        result = (chart.get('result') or [None])[0]
        if not result:
            raise ValueError(f'No chart data returned for {symbol}')

        timestamps = result.get('timestamp') or []
        quotes = ((result.get('indicators') or {}).get('quote') or [{}])[0]
        frame = pd.DataFrame(
            {
                'Open': quotes.get('open', []),
                'High': quotes.get('high', []),
                'Low': quotes.get('low', []),
                'Close': quotes.get('close', []),
                'Volume': quotes.get('volume', []),
            },
            index=pd.to_datetime(timestamps, unit='s'),
        )
        frame = frame.dropna(subset=['Close'])
        return frame

    def _normalize_history(self, df):
        """Normalize provider output into a standard OHLCV dataframe."""
        if df is None or df.empty:
            return pd.DataFrame()

        normalized = df.copy()
        if isinstance(normalized.columns, pd.MultiIndex):
            normalized.columns = normalized.columns.get_level_values(0)

        rename_map = {
            'open': 'Open',
            'high': 'High',
            'low': 'Low',
            'close': 'Close',
            'volume': 'Volume',
            'adj close': 'Adj Close',
        }
        normalized.columns = [rename_map.get(str(c).strip().lower(), c) for c in normalized.columns]

        required = {'Open', 'High', 'Low', 'Close', 'Volume'}
        if not required.issubset(set(normalized.columns)):
            return pd.DataFrame()

        normalized = normalized.dropna(subset=['Close'])
        return normalized
    
    def _fetch_data(self, symbol, period='2y'):
        """Fetch stock data with retry logic for rate-limit resilience"""
        max_retries = 3
        retry_delay = 2  # Start with 2 seconds
        cache_key = f"{symbol.upper()}::{period}"
        last_error = None
        
        for attempt in range(max_retries):
            # Try Yahoo chart API first, then yfinance as a backup.
            fetchers = [
                lambda: self._fetch_chart_history(symbol, period=period, interval='1d'),
                lambda: yf.Ticker(symbol).history(period=period),
                lambda: yf.download(symbol, period=period, progress=False, auto_adjust=False, threads=False),
            ]

            for fetcher in fetchers:
                try:
                    raw_df = fetcher()
                    df = self._normalize_history(raw_df)
                    if not df.empty:
                        self._history_cache[cache_key] = df.copy()
                        return df
                except Exception as e:
                    last_error = e

            error_msg = str(last_error).lower() if last_error else ''
            is_rate_limit = last_error and ('429' in str(last_error) or 'too many requests' in error_msg or 'rate limit' in error_msg)

            if is_rate_limit and attempt < max_retries - 1:
                print(f"[RETRY] Rate limited for {symbol}, waiting {retry_delay}s before retry {attempt + 1}/{max_retries}")
                time.sleep(retry_delay)
                retry_delay = min(retry_delay * 2, 10)  # Exponential backoff, max 10s
                continue

        cached = self._history_cache.get(cache_key)
        if cached is not None and not cached.empty:
            print(f"[CACHE] Using cached history for {symbol} ({period}) due to temporary upstream limits")
            return cached.copy()

        if last_error:
            raise last_error
        raise ValueError(f"No data available for {symbol}")
    
    def _create_features(self, df):
        """Engineer features from price data"""
        data = df.copy()
        close = data['Close']
        
        # Price-based features
        data['Returns'] = close.pct_change()
        data['Log_Returns'] = np.log(close / close.shift(1))
        
        # Moving Averages
        for window in [5, 10, 20, 50]:
            data[f'SMA_{window}'] = close.rolling(window=window).mean()
            data[f'EMA_{window}'] = close.ewm(span=window, adjust=False).mean()
            data[f'SMA_ratio_{window}'] = close / data[f'SMA_{window}']
        
        # Volatility
        data['Volatility_10'] = data['Returns'].rolling(window=10).std()
        data['Volatility_20'] = data['Returns'].rolling(window=20).std()
        
        # RSI
        delta = close.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        data['RSI'] = 100 - (100 / (1 + rs))
        
        # MACD
        ema12 = close.ewm(span=12, adjust=False).mean()
        ema26 = close.ewm(span=26, adjust=False).mean()
        data['MACD'] = ema12 - ema26
        data['MACD_Signal'] = data['MACD'].ewm(span=9, adjust=False).mean()
        
        # Bollinger Band width
        sma20 = close.rolling(window=20).mean()
        std20 = close.rolling(window=20).std()
        data['BB_Width'] = (4 * std20) / sma20
        data['BB_Position'] = (close - (sma20 - 2*std20)) / (4 * std20)
        
        # Volume features
        data['Volume_SMA'] = data['Volume'].rolling(window=20).mean()
        data['Volume_Ratio'] = data['Volume'] / data['Volume_SMA']
        
        # Price momentum
        for lag in [1, 3, 5, 10]:
            data[f'Momentum_{lag}'] = close / close.shift(lag) - 1
        
        # Day of week, month
        data['DayOfWeek'] = data.index.dayofweek
        data['Month'] = data.index.month
        
        # ATR
        high_low = data['High'] - data['Low']
        high_close = abs(data['High'] - close.shift())
        low_close = abs(data['Low'] - close.shift())
        tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
        data['ATR'] = tr.rolling(window=14).mean()
        
        # Stochastic
        low_14 = data['Low'].rolling(window=14).min()
        high_14 = data['High'].rolling(window=14).max()
        data['Stochastic'] = ((close - low_14) / (high_14 - low_14)) * 100
        
        # Target: next day close price
        data['Target'] = close.shift(-1)
        
        data = data.dropna()
        return data
    
    def _prepare_sequences(self, data, feature_cols, target_col='Target'):
        """Prepare data sequences for training"""
        X = data[feature_cols].values
        y = data[target_col].values
        return X, y

    def _estimate_spot_price(self, symbol, default_price=100.0):
        """Estimate latest available spot price for fallback predictions."""
        try:
            h = self._fetch_chart_history(symbol, period='5d', interval='1d')
            if not h.empty:
                close = float(h['Close'].iloc[-1])
                if close == close and close > 0:
                    return close
        except Exception:
            pass
        return float(default_price)

    def _build_rate_limit_fallback(self, symbol, forecast_days=30, base_price=100.0):
        """Return deterministic fallback payload when upstream data is temporarily unavailable."""
        now = datetime.utcnow()
        price = round(float(base_price), 2)

        future = []
        for i in range(forecast_days):
            future_date = now + timedelta(days=i + 1)
            while future_date.weekday() >= 5:
                future_date += timedelta(days=1)
            future.append({
                'date': future_date.strftime('%Y-%m-%d'),
                'predicted_price': price,
                'upper_bound': round(price * 1.05, 2),
                'lower_bound': round(price * 0.95, 2),
                'confidence': round(float(max(0.25, 1.0 - i * 0.018)), 2),
            })

        test_dates = [(now - timedelta(days=(30 - 1 - i))).strftime('%Y-%m-%d') for i in range(30)]
        actual_prices = [price] * 30

        base_metrics = {'r2': 0.0, 'mae': 0.0, 'mse': 0.0, 'rmse': 0.0, 'mape': 0.0, 'directional_accuracy': 50.0}

        return {
            'symbol': symbol,
            'models': {
                'Random Forest': {'predictions': actual_prices[:], 'metrics': dict(base_metrics)},
                'Gradient Boosting': {'predictions': actual_prices[:], 'metrics': dict(base_metrics)},
                'Ridge Regression': {'predictions': actual_prices[:], 'metrics': dict(base_metrics)},
                'SVR': {'predictions': actual_prices[:], 'metrics': dict(base_metrics)},
                'Linear Regression': {'predictions': actual_prices[:], 'metrics': dict(base_metrics)},
                'Ensemble': {'predictions': actual_prices[:], 'metrics': dict(base_metrics)},
            },
            'best_model': 'Ensemble',
            'test_dates': test_dates,
            'actual_prices': actual_prices,
            'future': future,
            'training_size': 100,
            'test_size': 30,
            'features_used': 25,
            'current_price': price,
            'is_stale': True,
            'is_fallback': True,
            'warning': 'Prediction service temporarily rate-limited. Returning fallback trend based on latest known price.',
        }
    
    def predict(self, symbol, forecast_days=30):
        """Run all ML models and return predictions"""
        try:
            # Fetch data
            df = self._fetch_data(symbol)
            engineered = self._create_features(df)
            
            feature_cols = [col for col in engineered.columns 
                          if col not in ['Target', 'Open', 'High', 'Low', 'Close', 
                                        'Volume', 'Dividends', 'Stock Splits']]
            
            X, y = self._prepare_sequences(engineered, feature_cols)
            
            # Train/Test split (time-based)
            split_idx = int(len(X) * 0.8)
            X_train, X_test = X[:split_idx], X[split_idx:]
            y_train, y_test = y[:split_idx], y[split_idx:]
            
            # Scale features
            X_train_scaled = self.scaler.fit_transform(X_train)
            X_test_scaled = self.scaler.transform(X_test)
            
            # Results storage
            models_results = {}
            
            # ── Model 1: Random Forest ──
            rf_model = RandomForestRegressor(
                n_estimators=200, max_depth=15, min_samples_split=5,
                min_samples_leaf=2, random_state=42, n_jobs=-1
            )
            rf_model.fit(X_train_scaled, y_train)
            rf_pred = rf_model.predict(X_test_scaled)
            models_results['Random Forest'] = {
                'predictions': rf_pred.tolist(),
                'metrics': self._calculate_metrics(y_test, rf_pred),
                'feature_importance': dict(zip(
                    feature_cols[:10],
                    sorted(rf_model.feature_importances_, reverse=True)[:10]
                ))
            }
            
            # ── Model 2: Gradient Boosting ──
            gb_model = GradientBoostingRegressor(
                n_estimators=200, max_depth=5, learning_rate=0.1,
                min_samples_split=5, random_state=42
            )
            gb_model.fit(X_train_scaled, y_train)
            gb_pred = gb_model.predict(X_test_scaled)
            models_results['Gradient Boosting'] = {
                'predictions': gb_pred.tolist(),
                'metrics': self._calculate_metrics(y_test, gb_pred),
            }
            
            # ── Model 3: Ridge Regression ──
            ridge_model = Ridge(alpha=1.0)
            ridge_model.fit(X_train_scaled, y_train)
            ridge_pred = ridge_model.predict(X_test_scaled)
            models_results['Ridge Regression'] = {
                'predictions': ridge_pred.tolist(),
                'metrics': self._calculate_metrics(y_test, ridge_pred),
            }
            
            # ── Model 4: SVR ──
            svr_model = SVR(kernel='rbf', C=100, gamma=0.1, epsilon=0.01)
            svr_model.fit(X_train_scaled, y_train)
            svr_pred = svr_model.predict(X_test_scaled)
            models_results['SVR'] = {
                'predictions': svr_pred.tolist(),
                'metrics': self._calculate_metrics(y_test, svr_pred),
            }
            
            # ── Model 5: Linear Regression (baseline) ──
            lr_model = LinearRegression()
            lr_model.fit(X_train_scaled, y_train)
            lr_pred = lr_model.predict(X_test_scaled)
            models_results['Linear Regression'] = {
                'predictions': lr_pred.tolist(),
                'metrics': self._calculate_metrics(y_test, lr_pred),
            }
            
            # ── Ensemble Prediction (Weighted Average) ──
            # Weight by R² score
            weights = {}
            total_r2 = 0
            for name, res in models_results.items():
                r2 = max(res['metrics']['r2'], 0.01)
                weights[name] = r2
                total_r2 += r2
            
            for name in weights:
                weights[name] /= total_r2
            
            ensemble_pred = np.zeros_like(rf_pred)
            for name, res in models_results.items():
                ensemble_pred += np.array(res['predictions']) * weights[name]
            
            models_results['Ensemble'] = {
                'predictions': ensemble_pred.tolist(),
                'metrics': self._calculate_metrics(y_test, ensemble_pred),
                'weights': {k: round(v, 4) for k, v in weights.items()},
            }
            
            # ── Future Predictions ──
            future_predictions = self._forecast_future(
                engineered, feature_cols, X_train_scaled, y_train,
                rf_model, gb_model, ridge_model, weights, forecast_days
            )
            
            # Find best model
            best_model = min(models_results.items(), key=lambda x: x[1]['metrics']['mae'])
            
            # Historical data for chart
            test_dates = engineered.index[split_idx:].strftime('%Y-%m-%d').tolist()
            
            return {
                'symbol': symbol,
                'models': models_results,
                'best_model': best_model[0],
                'test_dates': test_dates,
                'actual_prices': y_test.tolist(),
                'future': future_predictions,
                'training_size': split_idx,
                'test_size': len(X_test),
                'features_used': len(feature_cols),
                'current_price': round(float(df['Close'].iloc[-1]), 2),
            }
            
        except Exception as e:
            msg = str(e).lower()
            if '429' in msg or 'too many requests' in msg or 'rate limit' in msg or 'timeout' in msg:
                spot_price = self._estimate_spot_price(symbol, default_price=100.0)
                return self._build_rate_limit_fallback(symbol, forecast_days=forecast_days, base_price=spot_price)
            raise Exception(f"Prediction failed for {symbol}: {str(e)}")
    
    def _forecast_future(self, data, feature_cols, X_train, y_train, rf_model, gb_model, ridge_model, weights, days):
        """Generate future price predictions with realistic progressive price evolution"""
        current_price = float(data['Close'].iloc[-1])

        # ── Get model's directional signal (next-day prediction) ──
        last_features = data[feature_cols].iloc[-1:].values
        last_features_scaled = self.scaler.transform(last_features)

        rf_base  = rf_model.predict(last_features_scaled)[0]
        gb_base  = gb_model.predict(last_features_scaled)[0]
        rid_base = ridge_model.predict(last_features_scaled)[0]

        base_next = (
            rf_base  * weights.get('Random Forest',    0.33) +
            gb_base  * weights.get('Gradient Boosting', 0.33) +
            rid_base * weights.get('Ridge Regression', 0.34)
        )

        # Daily % implied by model (next-day signal)
        raw_model_pct = (base_next - current_price) / max(current_price, 1e-6)
        # Cap to ±2% max per day — prevents one bad prediction from compounding catastrophically
        MAX_DAILY = 0.02
        daily_model_pct = float(np.clip(raw_model_pct, -MAX_DAILY, MAX_DAILY))

        # 20-day linear trend as daily % change
        close_series = data['Close'].values
        recent = close_series[-20:] if len(close_series) >= 20 else close_series
        x_idx = np.arange(len(recent), dtype=float)
        slope = np.polyfit(x_idx, recent, 1)[0]
        raw_trend_pct = slope / max(current_price, 1e-6)
        # Cap trend to ±0.5% per day
        trend_daily_pct = float(np.clip(raw_trend_pct, -0.005, 0.005))

        # Historical daily volatility (std of log-returns)
        log_ret = np.diff(np.log(close_series[-60:])) if len(close_series) >= 60 else np.diff(np.log(close_series))
        hist_vol = float(np.std(log_ret)) if len(log_ret) > 1 else 0.01

        predictions = []
        price = current_price

        for i in range(days):
            # Exponential decay of both signals: model signal fades, trend persists longer
            model_decay = np.exp(-0.012 * i)
            trend_decay = np.exp(-0.006 * i)

            step_pct = daily_model_pct * model_decay * 0.6 + trend_daily_pct * trend_decay * 0.4

            # Deterministic micro-swing (reproducible, no randomness)
            micro = hist_vol * 0.15 * np.sin(i * 1.1 + (current_price * 0.001) % (2 * np.pi))
            price = price * (1.0 + step_pct + micro)
            price = max(price, current_price * 0.70)   # hard floor: max -30% total drop

            # Uncertainty band: widens proportional to √t × vol
            band = price * hist_vol * np.sqrt(i + 1) * 1.65   # ~90% CI

            # Business-day date
            future_date = data.index[-1] + timedelta(days=i + 1)
            while future_date.weekday() >= 5:
                future_date += timedelta(days=1)

            predictions.append({
                'date':            future_date.strftime('%Y-%m-%d'),
                'predicted_price': round(float(price), 2),
                'upper_bound':     round(float(price + band), 2),
                'lower_bound':     round(float(max(0.01, price - band)), 2),
                'confidence':      round(float(max(0.25, 1.0 - i * 0.018)), 2),
            })

        return predictions
    
    def _calculate_metrics(self, actual, predicted):
        """Calculate regression metrics"""
        mae = mean_absolute_error(actual, predicted)
        mse = mean_squared_error(actual, predicted)
        rmse = np.sqrt(mse)
        r2 = r2_score(actual, predicted)
        mape = np.mean(np.abs((actual - predicted) / actual)) * 100
        
        # Directional accuracy
        actual_dir = np.diff(actual) > 0
        pred_dir = np.diff(predicted) > 0
        dir_accuracy = np.mean(actual_dir == pred_dir) * 100
        
        return {
            'mae': round(float(mae), 4),
            'mse': round(float(mse), 4),
            'rmse': round(float(rmse), 4),
            'r2': round(float(r2), 4),
            'mape': round(float(mape), 2),
            'directional_accuracy': round(float(dir_accuracy), 2),
        }
