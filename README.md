# Real-Time Stock Market Analysis using ML (S Pulse)

A Flask-based stock analytics platform that combines live market data, technical analysis, and multi-model machine learning forecasts.

## Features

- User auth (email/password + Google OAuth)
- Live stock prices and technical indicators
- Single-stock ML prediction API (`/api/predict/<symbol>`)
- Batch market predictions (`/api/predict-batch`)
- Quick technical scan mode (`/api/quick-scan`)
- Compare view, watchlist, and heatmap dashboards
- Subscription flow with admin approval panel
- Rate-limit-aware fallbacks for resilient predictions

## ML Models Used

The prediction engine in `ml_engine.py` trains and evaluates:

- Random Forest
- Gradient Boosting
- Ridge Regression
- SVR
- Linear Regression
- Ensemble (weighted blend)

## Prediction Modes (Market Predictions page)

For batch predictions in `/market-predictions`, these modes are supported:

- `quick` -> Quick Scan (technical indicators only, fast)
- `ml` -> Full ML Prediction (detailed, slower)

## Tech Stack

- Backend: Flask, Flask-CORS
- Data: yfinance, pandas, numpy
- ML: scikit-learn
- Auth: Authlib (Google OAuth)
- Serving: gunicorn

## Project Structure

- `app.py` - Main Flask app and API routes
- `ml_engine.py` - ML feature engineering and prediction engine
- `templates/` - Jinja2 HTML templates
- `static/` - CSS, JS, images
- `api/index.py` - Vercel entrypoint
- `data/` - JSON-backed users/watchlists/subscriptions

## Local Setup

### 1) Clone and enter project

```bash
git clone https://github.com/HEMACHARANREDDY/Real-Time-Stock-Market-Analysis-using-ML.git
cd Real-Time-Stock-Market-Analysis-using-ML
```

### 2) Create virtual environment

Windows (PowerShell):

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

macOS/Linux:

```bash
python -m venv .venv
source .venv/bin/activate
```

### 3) Install dependencies

```bash
pip install -r requirements.txt
```

### 4) Optional environment variables

Create a `.env` file in project root (optional but recommended):

```env
SECRET_KEY=your_secret_key
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
REDIRECT_URI=http://localhost:5000/auth/google/callback

# Optional welcome email SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email
SMTP_PASS=your_app_password
```

### 5) Run local server

```bash
python app.py
```

Open:

- `http://localhost:5000`

## Production / Deployment

### Render

This repo includes:

- `render.yaml`
- `Procfile`
- `runtime.txt`

Start command:

```bash
gunicorn app:app --workers 2 --timeout 120 --bind 0.0.0.0:$PORT
```

### Vercel

This repo includes:

- `vercel.json`
- `api/index.py`

Vercel routes all requests to `api/index.py`, which exposes Flask `app` as `handler`.

## Useful API Endpoints

- `GET /api/stock/<symbol>`
- `GET /api/live_price/<symbol>`
- `GET /api/technical/<symbol>`
- `GET /api/predict/<symbol>?days=30`
- `POST /api/predict-batch`
- `POST /api/quick-scan`
- `GET /api/market/overview`
- `GET /api/sector-heatmap`
- `POST /api/compare`
- `GET /api/search/<query>`

## Notes

- External market providers can rate-limit requests; the app uses cached/fallback prediction behavior.
- `data/*.json` files are used as lightweight storage for users, subscriptions, and watchlists.

## License

This project is provided by the repository owner. Add a `LICENSE` file if you want explicit open-source licensing.
