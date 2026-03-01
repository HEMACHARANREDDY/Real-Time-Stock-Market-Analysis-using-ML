"""
Real-Time Stock Market Data Analytics with Machine Learning
Main Flask Application
"""

from flask import Flask, render_template, jsonify, request, session, redirect, url_for, flash
from flask_cors import CORS
from werkzeug.middleware.proxy_fix import ProxyFix
from functools import wraps
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import json
import os
import threading
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import warnings
warnings.filterwarnings('ignore')

from authlib.integrations.flask_client import OAuth

# Load .env file if present (local development only)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from ml_engine import StockMLEngine

# ─────────────────────────────────────────────
# WELCOME EMAIL
# ─────────────────────────────────────────────
def send_welcome_email(to_email: str, name: str):
    """Send a thank-you welcome email to a user who just signed in via Google."""
    smtp_host   = os.environ.get('SMTP_HOST', 'smtp.gmail.com')
    smtp_port   = int(os.environ.get('SMTP_PORT', 587))
    smtp_user   = os.environ.get('SMTP_USER', '')
    smtp_pass   = os.environ.get('SMTP_PASS', '')

    if not smtp_user or not smtp_pass:
        # SMTP not configured – skip silently
        return

    first_name = name.split()[0] if name else 'there'

    html = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to Realtime S Pulse</title>
    </head>
    <body style="margin:0;padding:0;background:#0a0e17;font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0e17;padding:40px 0;">
        <tr><td align="center">
          <table width="600" cellpadding="0" cellspacing="0" style="background:#1a1f2e;border-radius:16px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.6);">

            <!-- Header -->
            <tr>
              <td style="background:linear-gradient(135deg,#3b82f6,#8b5cf6);padding:40px 48px;text-align:center;">
                <div style="display:inline-flex;align-items:center;gap:10px;">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="40" height="40" fill="none">
                    <path d="M3,32 C7,32 9,26 14,22 C20,17 16,10 23,7 C27,5 31,5 33,6" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
                    <polyline points="7,22 10,22 12.5,16 15,28 17.5,16 20,22 23,22" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>
                  </svg>
                  <span style="color:#fff;font-size:26px;font-weight:800;letter-spacing:-0.5px;">S Pulse</span>
                  <span style="background:rgba(255,255,255,0.2);color:#fff;font-size:11px;font-weight:700;padding:2px 8px;border-radius:20px;letter-spacing:1px;">AI</span>
                </div>
                <p style="color:rgba(255,255,255,0.8);margin:14px 0 0;font-size:14px;letter-spacing:0.5px;">Realtime Stock Market Analytics</p>
              </td>
            </tr>

            <!-- Body -->
            <tr>
              <td style="padding:48px 48px 32px;">
                <h1 style="margin:0 0 8px;color:#f1f5f9;font-size:26px;font-weight:700;">Hey {first_name}, welcome! &#127881;</h1>
                <p style="margin:0 0 24px;color:#94a3b8;font-size:15px;line-height:1.6;">
                  Thank you for choosing <strong style="color:#3b82f6;">Realtime S Pulse</strong> &mdash; your AI-powered stock market analytics platform.
                  We&rsquo;re thrilled to have you on board.
                </p>

                <div style="background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);border-radius:12px;padding:24px 28px;margin-bottom:28px;">
                  <p style="margin:0 0 14px;color:#f1f5f9;font-weight:600;font-size:15px;">&#10024; What you can do now:</p>
                  <ul style="margin:0;padding-left:20px;color:#94a3b8;font-size:14px;line-height:2;">
                    <li>&#128200; &nbsp;Real-time stock prices &amp; live charts</li>
                    <li>&#129504; &nbsp;AI-powered predictions &amp; market signals</li>
                    <li>&#128293; &nbsp;Compare multiple stocks side-by-side</li>
                    <li>&#127758; &nbsp;Global market overview &amp; indices</li>
                    <li>&#128274; &nbsp;Upgrade to PRO for advanced analytics</li>
                  </ul>
                </div>

                <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                  <tr>
                    <td style="background:linear-gradient(135deg,#3b82f6,#8b5cf6);border-radius:10px;padding:1px;">
                      <a href="https://spulse.onrender.com/" style="display:inline-block;background:#1a1f2e;color:#3b82f6;text-decoration:none;font-weight:700;font-size:15px;padding:14px 36px;border-radius:9px;transition:background 0.2s;">
                        &#128640; &nbsp;Go to Dashboard
                      </a>
                    </td>
                  </tr>
                </table>

                <p style="margin:0;color:#64748b;font-size:13px;line-height:1.7;">
                  If you have any questions, reply to this email or reach out to our support team.<br>
                  We&rsquo;re always here to help you make smarter investment decisions.
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:#0f1523;padding:24px 48px;border-top:1px solid rgba(148,163,184,0.08);">
                <p style="margin:0;color:#475569;font-size:12px;text-align:center;line-height:1.8;">
                  &copy; 2026 Realtime S Pulse &bull; AI Stock Analytics<br>
                  You&rsquo;re receiving this because you signed in with your Google account.<br>
                  <span style="color:#374151;">Data powered by Yahoo Finance</span>
                </p>
              </td>
            </tr>

          </table>
        </td></tr>
      </table>
    </body>
    </html>
    """

    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = '🎉 Welcome to Realtime S Pulse — Your AI Stock Platform'
        msg['From']    = f'Realtime S Pulse <{smtp_user}>'
        msg['To']      = to_email
        msg.attach(MIMEText(html, 'html'))

        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.ehlo()
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_user, to_email, msg.as_string())
    except Exception as exc:
        print(f'[EMAIL] Failed to send welcome email to {to_email}: {exc}')


# Use explicit root path so Flask finds templates/static correctly on Vercel
_root = os.path.dirname(os.path.abspath(__file__))
app = Flask(__name__, template_folder=os.path.join(_root, 'templates'),
            static_folder=os.path.join(_root, 'static'))

# Trust Render/Vercel reverse proxy so HTTPS URLs and sessions work correctly
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)

app.secret_key = os.environ.get('SECRET_KEY', 'realtime-spulse-secret-2026-xK9mP3qR')

# Secure session cookies in production (HTTPS)
_is_prod = bool(os.environ.get('RENDER') or os.environ.get('VERCEL'))
app.config['SESSION_COOKIE_SECURE']   = _is_prod
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=30)

CORS(app)

# ─────────────────────────────────────────────
# GOOGLE OAUTH SETUP
# ─────────────────────────────────────────────
oauth = OAuth(app)
google = oauth.register(
    name='google',
    client_id=os.environ.get('GOOGLE_CLIENT_ID', ''),
    client_secret=os.environ.get('GOOGLE_CLIENT_SECRET', ''),
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'},
)

# ─────────────────────────────────────────────
# AUTH – Simple credentials store
# ─────────────────────────────────────────────
USERS = {
    'admin': 'spulse123',
    'trader': 'market2026',
}

SUBSCRIPTION_PRICE_INR = 25
# On serverless/read-only filesystems use /tmp, otherwise use local data/
_is_readonly = os.environ.get('VERCEL') or os.environ.get('RENDER')
_data_dir = '/tmp' if _is_readonly else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
SUBSCRIPTIONS_FILE = os.path.join(_data_dir, 'subscriptions.json')


def _load_subscriptions():
    """Load subscribed users and pending requests from JSON file."""
    if os.path.exists(SUBSCRIPTIONS_FILE):
        try:
            with open(SUBSCRIPTIONS_FILE) as f:
                data = json.load(f)
            return set(data.get('subscribed', ['admin'])), data.get('pending', [])
        except Exception:
            pass
    return {'admin'}, []


def _save_subscriptions():
    """Persist subscribed users and pending requests to JSON file."""
    os.makedirs(os.path.dirname(SUBSCRIPTIONS_FILE), exist_ok=True)
    with open(SUBSCRIPTIONS_FILE, 'w') as f:
        json.dump({'subscribed': list(SUBSCRIBED_USERS), 'pending': PENDING_REQUESTS}, f, indent=2)


# Users who have purchased a subscription (Text Report & future premium features)
SUBSCRIBED_USERS, PENDING_REQUESTS = _load_subscriptions()

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('logged_in'):
            flash('Please sign in to access the dashboard.', 'error')
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated

@app.context_processor
def inject_user():
    username = session.get('username', '').lower()
    return {
        'current_user': username or 'Guest',
        'logged_in': session.get('logged_in', False),
        'is_subscribed': username in SUBSCRIBED_USERS,
    }

# Initialize ML Engine
ml_engine = StockMLEngine()

# ─────────────────────────────────────────────
# AUTH ROUTES
# ─────────────────────────────────────────────

@app.route('/login', methods=['GET', 'POST'])
def login():
    if session.get('logged_in'):
        return redirect(url_for('dashboard'))
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')
        if username in USERS and USERS[username] == password:
            session['logged_in'] = True
            session['username'] = username.lower()
            session.permanent = bool(request.form.get('remember'))
            flash(f'Welcome back, {username}!', 'success')
            return redirect(url_for('dashboard'))
        else:
            flash('Invalid username or password. Please try again.', 'error')
    return render_template('login.html')

@app.route('/logout')
def logout():
    session.clear()
    flash('You have been signed out successfully.', 'success')
    return redirect(url_for('login'))

# ─────────────────────────────────────────────
# GOOGLE OAUTH ROUTES
# ─────────────────────────────────────────────
@app.route('/auth/google')
def google_login():
    if not os.environ.get('GOOGLE_CLIENT_ID'):
        flash('Google login is not configured. Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.', 'error')
        return redirect(url_for('login'))
    # Use explicit REDIRECT_URI from env if set, otherwise auto-detect
    redirect_uri = os.environ.get('REDIRECT_URI') or url_for('google_callback', _external=True)
    return google.authorize_redirect(redirect_uri)

@app.route('/auth/google/callback')
def google_callback():
    try:
        redirect_uri = os.environ.get('REDIRECT_URI') or url_for('google_callback', _external=True)
        token = google.authorize_access_token()
        user_info = token.get('userinfo')
        if not user_info:
            import urllib.request as _ur
            import json as _json
            req = _ur.Request(
                'https://www.googleapis.com/oauth2/v3/userinfo',
                headers={'Authorization': f'Bearer {token["access_token"]}'}
            )
            user_info = _json.loads(_ur.urlopen(req).read())

        email = user_info.get('email', '')
        name  = user_info.get('name', email.split('@')[0])
        # Use email prefix as username (safe slug)
        username = email.split('@')[0].replace('.', '_').lower()

        # Register google user in USERS dict if not present
        if email not in USERS:
            USERS[email] = None  # password-less google user

        session['logged_in'] = True
        session['username']  = username.lower()
        session['email']     = email
        session['avatar']    = user_info.get('picture', '')
        session['auth_method'] = 'google'
        session.permanent    = True

        # Send welcome/thank-you email in background so login isn't delayed
        threading.Thread(target=send_welcome_email, args=(email, name), daemon=True).start()

        flash(f'Welcome, {name}!', 'success')
        return redirect(url_for('dashboard'))
    except Exception as e:
        flash(f'Google login failed: {str(e)}', 'error')
        return redirect(url_for('login'))

# ─────────────────────────────────────────────
# PAGE ROUTES  (all protected)
# ─────────────────────────────────────────────

@app.route('/')
@login_required
def dashboard():
    return render_template('dashboard.html')

@app.route('/analysis')
@login_required
def analysis():
    return render_template('analysis.html')

@app.route('/predictions')
@login_required
def predictions():
    return render_template('predictions.html')

@app.route('/compare')
@login_required
def compare():
    return render_template('compare.html')

@app.route('/market-predictions')
@login_required
def market_predictions():
    return render_template('market_predictions.html')


# ─────────────────────────────────────────────
# SUBSCRIPTION ROUTES
# ─────────────────────────────────────────────

@app.route('/subscribe', methods=['GET', 'POST'])
@login_required
def subscribe():
    username = session.get('username', '').lower()

    # Don't redirect — show premium dashboard instead
    if username in SUBSCRIBED_USERS:
        return render_template('subscribe.html', pending=False,
                               price=SUBSCRIPTION_PRICE_INR, already_subscribed=True)

    already_pending = any(p['username'] == username for p in PENDING_REQUESTS)

    if request.method == 'POST':
        txn_id = request.form.get('txn_id', '').strip()
        if not txn_id:
            flash('Please enter a valid UPI Transaction ID.', 'error')
        elif already_pending:
            flash('Your payment request is already under review. Please wait for admin approval.', 'info')
        else:
            PENDING_REQUESTS.append({
                'username': username,
                'txn_id': txn_id,
                'amount': SUBSCRIPTION_PRICE_INR,
                'submitted_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'status': 'pending',
            })
            _save_subscriptions()
            already_pending = True
            flash('Payment submitted! Your subscription will be activated after admin verification.', 'success')

    return render_template('subscribe.html', pending=already_pending,
                           price=SUBSCRIPTION_PRICE_INR, already_subscribed=False)


@app.route('/admin/subscriptions', methods=['GET', 'POST'])
@login_required
def admin_subscriptions():
    if session.get('username', '').lower() != 'admin':
        flash('Admin access required.', 'error')
        return redirect(url_for('dashboard'))

    if request.method == 'POST':
        action   = request.form.get('action')
        username = request.form.get('username', '').strip().lower()

        if action == 'approve' and username:
            SUBSCRIBED_USERS.add(username)
            for p in PENDING_REQUESTS:
                if p['username'] == username:
                    p['status'] = 'approved'
            # Remove approved from pending list
            PENDING_REQUESTS[:] = [p for p in PENDING_REQUESTS if p['username'] != username]
            _save_subscriptions()
            flash(f'Subscription activated for {username}.', 'success')

        elif action == 'reject' and username:
            PENDING_REQUESTS[:] = [p for p in PENDING_REQUESTS if p['username'] != username]
            _save_subscriptions()
            flash(f'Request from {username} rejected.', 'info')

        elif action == 'revoke' and username:
            SUBSCRIBED_USERS.discard(username)
            _save_subscriptions()
            flash(f'Subscription revoked for {username}.', 'info')

        return redirect(url_for('admin_subscriptions'))

    return render_template('admin_subscriptions.html',
                           pending=PENDING_REQUESTS,
                           subscribed=[u for u in SUBSCRIBED_USERS if u != 'admin'],
                           price=SUBSCRIPTION_PRICE_INR)


# ─────────────────────────────────────────────
# STOCK CATEGORIES FOR BATCH PREDICTION
# ─────────────────────────────────────────────

STOCK_CATEGORIES = {
    'Tech Giants': ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'NFLX'],
    'Finance': ['JPM', 'BAC', 'GS', 'MS', 'V', 'MA', 'AXP', 'WFC'],
    'Healthcare': ['JNJ', 'UNH', 'PFE', 'ABBV', 'MRK', 'TMO', 'ABT', 'LLY'],
    'Energy': ['XOM', 'CVX', 'COP', 'SLB', 'EOG', 'MPC', 'PSX', 'VLO'],
    'Consumer': ['WMT', 'PG', 'KO', 'PEP', 'COST', 'MCD', 'NKE', 'SBUX'],
    'Semiconductor': ['NVDA', 'AMD', 'INTC', 'AVGO', 'QCOM', 'TXN', 'MU', 'AMAT'],
    'Indian Stocks (NSE)': ['RELIANCE.NS', 'TCS.NS', 'INFY.NS', 'HDFCBANK.NS', 'ICICIBANK.NS', 'HINDUNILVR.NS', 'SBIN.NS', 'BHARTIARTL.NS'],
    'Crypto ETFs': ['BITO', 'GBTC', 'ETHA', 'IBIT'],
}

ALL_POPULAR_STOCKS = list(set(s for stocks in STOCK_CATEGORIES.values() for s in stocks))

# ─────────────────────────────────────────────
# STOCK NAMES & CURRENCY CONVERSION
# ─────────────────────────────────────────────

STOCK_NAMES = {
    # Tech Giants
    'AAPL': 'Apple Inc.',
    'MSFT': 'Microsoft Corporation',
    'GOOGL': 'Alphabet Inc. (Google)',
    'AMZN': 'Amazon.com Inc.',
    'META': 'Meta Platforms Inc.',
    'NVDA': 'NVIDIA Corporation',
    'TSLA': 'Tesla Inc.',
    'NFLX': 'Netflix Inc.',
    # Finance
    'JPM': 'JPMorgan Chase & Co.',
    'BAC': 'Bank of America Corp.',
    'GS': 'Goldman Sachs Group',
    'MS': 'Morgan Stanley',
    'V': 'Visa Inc.',
    'MA': 'Mastercard Inc.',
    'AXP': 'American Express Co.',
    'WFC': 'Wells Fargo & Co.',
    # Healthcare
    'JNJ': 'Johnson & Johnson',
    'UNH': 'UnitedHealth Group',
    'PFE': 'Pfizer Inc.',
    'ABBV': 'AbbVie Inc.',
    'MRK': 'Merck & Co.',
    'TMO': 'Thermo Fisher Scientific',
    'ABT': 'Abbott Laboratories',
    'LLY': 'Eli Lilly and Co.',
    # Energy
    'XOM': 'Exxon Mobil Corp.',
    'CVX': 'Chevron Corporation',
    'COP': 'ConocoPhillips',
    'SLB': 'Schlumberger Ltd.',
    'EOG': 'EOG Resources Inc.',
    'MPC': 'Marathon Petroleum Corp.',
    'PSX': 'Phillips 66',
    'VLO': 'Valero Energy Corp.',
    # Consumer
    'WMT': 'Walmart Inc.',
    'PG': 'Procter & Gamble Co.',
    'KO': 'Coca-Cola Company',
    'PEP': 'PepsiCo Inc.',
    'COST': 'Costco Wholesale Corp.',
    'MCD': "McDonald's Corporation",
    'NKE': 'Nike Inc.',
    'SBUX': 'Starbucks Corporation',
    # Semiconductor
    'AMD': 'Advanced Micro Devices',
    'INTC': 'Intel Corporation',
    'AVGO': 'Broadcom Inc.',
    'QCOM': 'Qualcomm Inc.',
    'TXN': 'Texas Instruments',
    'MU': 'Micron Technology',
    'AMAT': 'Applied Materials Inc.',
    # Indian Stocks (NSE)
    'RELIANCE.NS': 'Reliance Industries Ltd.',
    'TCS.NS': 'Tata Consultancy Services',
    'INFY.NS': 'Infosys Ltd.',
    'HDFCBANK.NS': 'HDFC Bank Ltd.',
    'ICICIBANK.NS': 'ICICI Bank Ltd.',
    'HINDUNILVR.NS': 'Hindustan Unilever Ltd.',
    'SBIN.NS': 'State Bank of India',
    'BHARTIARTL.NS': 'Bharti Airtel Ltd.',
    # Crypto ETFs
    'BITO': 'ProShares Bitcoin Strategy ETF',
    'GBTC': 'Grayscale Bitcoin Trust',
    'ETHA': 'iShares Ethereum Trust ETF',
    'IBIT': 'iShares Bitcoin Trust ETF',
    # Indices
    '^GSPC': 'S&P 500',
    '^DJI': 'Dow Jones Industrial',
    '^IXIC': 'NASDAQ Composite',
    '^RUT': 'Russell 2000',
}

USD_TO_INR = 83.50  # Approximate USD to INR exchange rate


def get_stock_name(symbol):
    """Get clear company name for a stock symbol"""
    return STOCK_NAMES.get(symbol.upper(), symbol.upper())


def is_inr_stock(symbol):
    """Check if stock prices are already in INR"""
    return symbol.upper().endswith('.NS')


def to_inr(value, symbol):
    """Convert a single price value to INR"""
    if value is None:
        return 0
    try:
        val = float(value)
        if val != val:  # NaN check
            return 0
        if is_inr_stock(symbol):
            return round(val, 2)
        return round(val * USD_TO_INR, 2)
    except (ValueError, TypeError):
        return 0


def list_to_inr(values, symbol):
    """Convert a list of price values to INR"""
    rate = 1 if is_inr_stock(symbol) else USD_TO_INR
    result = []
    for v in values:
        try:
            fv = float(v)
            if fv != fv:  # NaN check
                result.append(0)
            else:
                result.append(round(fv * rate, 2))
        except (ValueError, TypeError):
            result.append(0)
    return result


def convert_stock_data_to_inr(data, symbol):
    """Convert stock data API response to INR"""
    if is_inr_stock(symbol):
        return data
    rate = USD_TO_INR
    for key in ['open', 'high', 'low', 'close']:
        if key in data and isinstance(data[key], list):
            data[key] = [round(v * rate, 2) for v in data[key]]
    for key in ['current_price', 'prev_close', 'change']:
        if key in data:
            data[key] = round(data[key] * rate, 2)
    if 'info' in data:
        for key in ['fiftyTwoWeekHigh', 'fiftyTwoWeekLow', 'eps']:
            if key in data['info'] and data['info'][key]:
                data['info'][key] = round(float(data['info'][key]) * rate, 2)
        if 'marketCap' in data['info'] and data['info']['marketCap']:
            data['info']['marketCap'] = round(float(data['info']['marketCap']) * rate)
        data['info']['currency'] = 'INR'
    return data


def convert_technical_to_inr(result, symbol):
    """Convert technical indicator results to INR"""
    if is_inr_stock(symbol):
        return result
    rate = USD_TO_INR
    for key in ['close', 'sma_20', 'sma_50', 'ema_12', 'ema_26',
                'bb_upper', 'bb_middle', 'bb_lower', 'vwap', 'atr',
                'macd', 'macd_signal', 'macd_hist']:
        if key in result and isinstance(result[key], list):
            result[key] = [round(v * rate, 2) for v in result[key]]
    return result


def convert_prediction_to_inr(result, symbol):
    """Convert ML prediction results to INR"""
    if is_inr_stock(symbol):
        return result
    rate = USD_TO_INR
    result['current_price'] = round(result['current_price'] * rate, 2)
    if 'actual_prices' in result:
        result['actual_prices'] = [round(p * rate, 2) for p in result['actual_prices']]
    for model in result.get('models', {}).values():
        if 'predictions' in model:
            model['predictions'] = [round(p * rate, 2) for p in model['predictions']]
        if 'metrics' in model:
            for k in ['mae', 'rmse']:
                if k in model['metrics']:
                    model['metrics'][k] = round(model['metrics'][k] * rate, 2)
            if 'mse' in model['metrics']:
                model['metrics']['mse'] = round(model['metrics']['mse'] * rate * rate, 4)
    for f in result.get('future', []):
        for k in ['predicted_price', 'upper_bound', 'lower_bound']:
            if k in f:
                f[k] = round(f[k] * rate, 2)
    return result


# ─────────────────────────────────────────────
# API ROUTES - STOCK DATA
# ─────────────────────────────────────────────

@app.route('/api/stock/<symbol>')
def get_stock_data(symbol):
    """Fetch real-time stock data"""
    try:
        period = request.args.get('period', '1mo')
        interval = request.args.get('interval', '1d')
        
        ticker = yf.Ticker(symbol.upper())
        hist = ticker.history(period=period, interval=interval)
        
        if hist.empty:
            return jsonify({'error': f'No data found for {symbol}'}), 404
        
        info = {}
        try:
            raw_info = ticker.info
            info = {
                'name': get_stock_name(symbol),
                'sector': raw_info.get('sector', 'N/A'),
                'industry': raw_info.get('industry', 'N/A'),
                'marketCap': raw_info.get('marketCap', 0),
                'peRatio': raw_info.get('trailingPE', 0),
                'dividendYield': raw_info.get('dividendYield', 0),
                'fiftyTwoWeekHigh': raw_info.get('fiftyTwoWeekHigh', 0),
                'fiftyTwoWeekLow': raw_info.get('fiftyTwoWeekLow', 0),
                'avgVolume': raw_info.get('averageVolume', 0),
                'beta': raw_info.get('beta', 0),
                'eps': raw_info.get('trailingEps', 0),
                'currency': 'INR',
            }
        except Exception:
            info = {'name': get_stock_name(symbol)}
        
        data = {
            'dates': hist.index.strftime('%Y-%m-%d %H:%M').tolist(),
            'open': hist['Open'].round(2).tolist(),
            'high': hist['High'].round(2).tolist(),
            'low': hist['Low'].round(2).tolist(),
            'close': hist['Close'].round(2).tolist(),
            'volume': hist['Volume'].tolist(),
            'info': info,
            'current_price': round(hist['Close'].iloc[-1], 2),
            'prev_close': round(hist['Close'].iloc[-2], 2) if len(hist) > 1 else round(hist['Close'].iloc[-1], 2),
            'change': round(hist['Close'].iloc[-1] - (hist['Close'].iloc[-2] if len(hist) > 1 else hist['Close'].iloc[-1]), 2),
            'change_pct': round(((hist['Close'].iloc[-1] - (hist['Close'].iloc[-2] if len(hist) > 1 else hist['Close'].iloc[-1])) / (hist['Close'].iloc[-2] if len(hist) > 1 else hist['Close'].iloc[-1])) * 100, 2),
        }
        
        data = convert_stock_data_to_inr(data, symbol)
        return jsonify(data)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/technical/<symbol>')
def get_technical_indicators(symbol):
    """Calculate technical indicators"""
    try:
        period = request.args.get('period', '6mo')
        ticker = yf.Ticker(symbol.upper())
        hist = ticker.history(period=period)
        
        if hist.empty:
            return jsonify({'error': f'No data found for {symbol}'}), 404
        
        close = hist['Close']
        high = hist['High']
        low = hist['Low']
        volume = hist['Volume']
        
        # SMA
        sma_20 = close.rolling(window=20).mean()
        sma_50 = close.rolling(window=50).mean()
        
        # EMA
        ema_12 = close.ewm(span=12, adjust=False).mean()
        ema_26 = close.ewm(span=26, adjust=False).mean()
        
        # MACD
        macd_line = ema_12 - ema_26
        signal_line = macd_line.ewm(span=9, adjust=False).mean()
        macd_hist = macd_line - signal_line
        
        # RSI
        delta = close.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        
        # Bollinger Bands
        bb_middle = sma_20
        bb_std = close.rolling(window=20).std()
        bb_upper = bb_middle + (bb_std * 2)
        bb_lower = bb_middle - (bb_std * 2)
        
        # ATR (Average True Range)
        tr1 = high - low
        tr2 = abs(high - close.shift())
        tr3 = abs(low - close.shift())
        tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        atr = tr.rolling(window=14).mean()
        
        # VWAP
        typical_price = (high + low + close) / 3
        vwap = (typical_price * volume).cumsum() / volume.cumsum()
        
        # Stochastic Oscillator
        low_14 = low.rolling(window=14).min()
        high_14 = high.rolling(window=14).max()
        stoch_k = ((close - low_14) / (high_14 - low_14)) * 100
        stoch_d = stoch_k.rolling(window=3).mean()
        
        # OBV (On Balance Volume)
        obv = (np.sign(close.diff()) * volume).fillna(0).cumsum()
        
        result = {
            'dates': hist.index.strftime('%Y-%m-%d').tolist(),
            'close': close.round(2).tolist(),
            'sma_20': sma_20.round(2).fillna(0).tolist(),
            'sma_50': sma_50.round(2).fillna(0).tolist(),
            'ema_12': ema_12.round(2).tolist(),
            'ema_26': ema_26.round(2).tolist(),
            'macd': macd_line.round(4).fillna(0).tolist(),
            'macd_signal': signal_line.round(4).fillna(0).tolist(),
            'macd_hist': macd_hist.round(4).fillna(0).tolist(),
            'rsi': rsi.round(2).fillna(50).tolist(),
            'bb_upper': bb_upper.round(2).fillna(0).tolist(),
            'bb_middle': bb_middle.round(2).fillna(0).tolist(),
            'bb_lower': bb_lower.round(2).fillna(0).tolist(),
            'atr': atr.round(4).fillna(0).tolist(),
            'vwap': vwap.round(2).fillna(0).tolist(),
            'stoch_k': stoch_k.round(2).fillna(50).tolist(),
            'stoch_d': stoch_d.round(2).fillna(50).tolist(),
            'obv': obv.fillna(0).tolist(),
            'volume': volume.tolist(),
            # Summary signals
            'signals': generate_signals(close, rsi, macd_line, signal_line, sma_20, sma_50, bb_upper, bb_lower, stoch_k),
        }
        
        result = convert_technical_to_inr(result, symbol)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def generate_signals(close, rsi, macd, signal, sma20, sma50, bb_upper, bb_lower, stoch_k):
    """Generate buy/sell signals from technical indicators"""
    latest = len(close) - 1
    signals = []
    score = 0
    
    # RSI Signal
    rsi_val = rsi.iloc[latest]
    if rsi_val < 30:
        signals.append({'indicator': 'RSI', 'signal': 'BUY', 'value': round(rsi_val, 2), 'reason': 'Oversold territory (< 30)'})
        score += 2
    elif rsi_val > 70:
        signals.append({'indicator': 'RSI', 'signal': 'SELL', 'value': round(rsi_val, 2), 'reason': 'Overbought territory (> 70)'})
        score -= 2
    else:
        signals.append({'indicator': 'RSI', 'signal': 'NEUTRAL', 'value': round(rsi_val, 2), 'reason': 'Within normal range'})
    
    # MACD Signal
    if macd.iloc[latest] > signal.iloc[latest] and macd.iloc[latest-1] <= signal.iloc[latest-1]:
        signals.append({'indicator': 'MACD', 'signal': 'BUY', 'value': round(macd.iloc[latest], 4), 'reason': 'Bullish crossover detected'})
        score += 2
    elif macd.iloc[latest] < signal.iloc[latest] and macd.iloc[latest-1] >= signal.iloc[latest-1]:
        signals.append({'indicator': 'MACD', 'signal': 'SELL', 'value': round(macd.iloc[latest], 4), 'reason': 'Bearish crossover detected'})
        score -= 2
    elif macd.iloc[latest] > signal.iloc[latest]:
        signals.append({'indicator': 'MACD', 'signal': 'BUY', 'value': round(macd.iloc[latest], 4), 'reason': 'MACD above signal line'})
        score += 1
    else:
        signals.append({'indicator': 'MACD', 'signal': 'SELL', 'value': round(macd.iloc[latest], 4), 'reason': 'MACD below signal line'})
        score -= 1
    
    # SMA Crossover
    if sma20.iloc[latest] > sma50.iloc[latest]:
        signals.append({'indicator': 'SMA Cross', 'signal': 'BUY', 'value': f'{round(sma20.iloc[latest],2)}/{round(sma50.iloc[latest],2)}', 'reason': 'SMA20 above SMA50 (Golden cross)'})
        score += 1
    else:
        signals.append({'indicator': 'SMA Cross', 'signal': 'SELL', 'value': f'{round(sma20.iloc[latest],2)}/{round(sma50.iloc[latest],2)}', 'reason': 'SMA20 below SMA50 (Death cross)'})
        score -= 1
    
    # Bollinger Bands
    current_price = close.iloc[latest]
    if current_price <= bb_lower.iloc[latest]:
        signals.append({'indicator': 'Bollinger', 'signal': 'BUY', 'value': round(current_price, 2), 'reason': 'Price at lower band - potential bounce'})
        score += 1
    elif current_price >= bb_upper.iloc[latest]:
        signals.append({'indicator': 'Bollinger', 'signal': 'SELL', 'value': round(current_price, 2), 'reason': 'Price at upper band - potential pullback'})
        score -= 1
    else:
        signals.append({'indicator': 'Bollinger', 'signal': 'NEUTRAL', 'value': round(current_price, 2), 'reason': 'Price within bands'})
    
    # Stochastic
    stoch_val = stoch_k.iloc[latest]
    if stoch_val < 20:
        signals.append({'indicator': 'Stochastic', 'signal': 'BUY', 'value': round(stoch_val, 2), 'reason': 'Oversold (< 20)'})
        score += 1
    elif stoch_val > 80:
        signals.append({'indicator': 'Stochastic', 'signal': 'SELL', 'value': round(stoch_val, 2), 'reason': 'Overbought (> 80)'})
        score -= 1
    else:
        signals.append({'indicator': 'Stochastic', 'signal': 'NEUTRAL', 'value': round(stoch_val, 2), 'reason': 'Neutral zone'})
    
    # Overall recommendation
    if score >= 3:
        overall = 'STRONG BUY'
    elif score >= 1:
        overall = 'BUY'
    elif score <= -3:
        overall = 'STRONG SELL'
    elif score <= -1:
        overall = 'SELL'
    else:
        overall = 'HOLD'
    
    return {
        'indicators': signals,
        'overall': overall,
        'score': score,
        'max_score': 8,
    }


# ─────────────────────────────────────────────
# API ROUTES - ML PREDICTIONS
# ─────────────────────────────────────────────

@app.route('/api/predict/<symbol>')
def predict_stock(symbol):
    """ML-based stock price prediction"""
    try:
        days = int(request.args.get('days', 30))
        result = ml_engine.predict(symbol.upper(), days)
        result = convert_prediction_to_inr(result, symbol)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/stock-categories')
def get_stock_categories():
    """Return all stock categories and symbols"""
    return jsonify({
        'categories': STOCK_CATEGORIES,
        'all_stocks': ALL_POPULAR_STOCKS,
        'stock_names': STOCK_NAMES,
    })


@app.route('/api/predict-batch', methods=['POST'])
def predict_batch():
    """Run ML predictions on multiple stocks"""
    try:
        data = request.get_json()
        symbols = data.get('symbols', [])
        days = int(data.get('days', 30))
        
        if not symbols:
            return jsonify({'error': 'No symbols provided'}), 400
        
        results = {}
        errors = []
        
        for sym in symbols[:20]:  # Max 20 stocks at once
            try:
                result = ml_engine.predict(sym.upper(), days)
                result = convert_prediction_to_inr(result, sym)
                
                # Get current price info
                ticker = yf.Ticker(sym.upper())
                info = {}
                try:
                    raw = ticker.info
                    info = {
                        'name': get_stock_name(sym),
                        'sector': raw.get('sector', 'N/A'),
                    }
                except Exception:
                    info = {'name': get_stock_name(sym), 'sector': 'N/A'}
                
                # Extract summary for batch view
                best = result['best_model']
                best_metrics = result['models'][best]['metrics']
                future = result['future']
                last_pred = future[-1] if future else {}
                first_pred = future[0] if future else {}

                # Use end-period price for display target
                predicted_price = last_pred.get('predicted_price', result['current_price'])
                price_change = predicted_price - result['current_price']
                price_change_pct = (price_change / result['current_price']) * 100 if result['current_price'] else 0

                # Signal uses first-day prediction (highest confidence, best directional accuracy)
                # Day-1 price change is the model's clearest directional signal
                first_price = first_pred.get('predicted_price', result['current_price'])
                signal_pct = (first_price - result['current_price']) / result['current_price'] * 100 if result['current_price'] else 0

                # Determine signal based on day-1 prediction direction
                if signal_pct >= 1.5:
                    signal = 'STRONG BUY'
                elif signal_pct >= 0.5:
                    signal = 'BUY'
                elif signal_pct <= -1.5:
                    signal = 'STRONG SELL'
                elif signal_pct <= -0.5:
                    signal = 'SELL'
                else:
                    signal = 'HOLD'
                
                results[sym.upper()] = {
                    'name': info.get('name', sym.upper()),
                    'sector': info.get('sector', 'N/A'),
                    'current_price': result['current_price'],
                    'predicted_price': round(predicted_price, 2),
                    'price_change': round(price_change, 2),
                    'price_change_pct': round(price_change_pct, 2),
                    'signal': signal,
                    'best_model': best,
                    'r2_score': best_metrics['r2'],
                    'mae': best_metrics['mae'],
                    'mape': best_metrics['mape'],
                    'directional_accuracy': best_metrics['directional_accuracy'],
                    'confidence': last_pred.get('confidence', 0),
                    'upper_bound': last_pred.get('upper_bound', predicted_price),
                    'lower_bound': last_pred.get('lower_bound', predicted_price),
                    'forecast': future,
                    'full_result': result,
                }
            except Exception as e:
                errors.append({'symbol': sym.upper(), 'error': str(e)})
                continue
        
        return jsonify({
            'predictions': results,
            'errors': errors,
            'total': len(results),
            'forecast_days': days,
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/quick-scan', methods=['POST'])
def quick_scan():
    """Quick scan stocks using technical indicators only (faster than ML)"""
    try:
        data = request.get_json()
        symbols = data.get('symbols', [])
        
        results = []
        for sym in symbols[:30]:
            try:
                ticker = yf.Ticker(sym.upper())
                hist = ticker.history(period='6mo')
                if hist.empty or len(hist) < 50:
                    continue
                
                close = hist['Close']
                current = to_inr(float(close.iloc[-1]), sym)
                
                # Quick technical signals
                sma20 = close.rolling(20).mean().iloc[-1]
                sma50 = close.rolling(50).mean().iloc[-1]
                
                delta = close.diff()
                gain = (delta.where(delta > 0, 0)).rolling(14).mean()
                loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
                rs = gain / loss
                rsi = (100 - (100 / (1 + rs))).iloc[-1]
                
                ema12 = close.ewm(span=12).mean()
                ema26 = close.ewm(span=26).mean()
                macd = (ema12 - ema26).iloc[-1]
                macd_signal = (ema12 - ema26).ewm(span=9).mean().iloc[-1]
                
                # 5-day change
                change_5d = round(((close.iloc[-1] / close.iloc[-6]) - 1) * 100, 2) if len(close) > 5 else 0
                # 30-day change
                change_30d = round(((close.iloc[-1] / close.iloc[-22]) - 1) * 100, 2) if len(close) > 22 else 0
                
                # Score
                score = 0
                if rsi < 30: score += 2
                elif rsi > 70: score -= 2
                if macd > macd_signal: score += 1
                else: score -= 1
                if sma20 > sma50: score += 1
                else: score -= 1
                
                if score >= 3: signal = 'STRONG BUY'
                elif score >= 1: signal = 'BUY'
                elif score <= -3: signal = 'STRONG SELL'
                elif score <= -1: signal = 'SELL'
                else: signal = 'HOLD'
                
                name = get_stock_name(sym)
                
                results.append({
                    'symbol': sym.upper(),
                    'name': name,
                    'price': current,
                    'change_5d': change_5d,
                    'change_30d': change_30d,
                    'rsi': round(float(rsi), 1),
                    'macd': round(float(macd), 4),
                    'sma20': to_inr(float(sma20), sym),
                    'sma50': to_inr(float(sma50), sym),
                    'signal': signal,
                    'score': score,
                })
            except Exception:
                continue
        
        # Sort by score descending
        results.sort(key=lambda x: x['score'], reverse=True)
        
        return jsonify({'stocks': results, 'total': len(results)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/market/overview')
def market_overview():
    """Get market overview data for major indices and trending stocks"""
    try:
        indices = {
            '^GSPC': 'S&P 500',
            '^DJI': 'Dow Jones',
            '^IXIC': 'NASDAQ',
            '^RUT': 'Russell 2000',
        }
        
        trending = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'JPM']
        
        index_data = []
        for sym, name in indices.items():
            try:
                t = yf.Ticker(sym)
                h = t.history(period='5d')
                if len(h) >= 2:
                    current = round(h['Close'].iloc[-1], 2)
                    prev = round(h['Close'].iloc[-2], 2)
                    change = round(current - prev, 2)
                    change_pct = round((change / prev) * 100, 2)
                    index_data.append({
                        'symbol': sym, 'name': name, 'price': to_inr(current, sym),
                        'change': to_inr(change, sym), 'change_pct': change_pct
                    })
            except Exception:
                continue
        
        stock_data = []
        for sym in trending:
            try:
                t = yf.Ticker(sym)
                h = t.history(period='5d')
                if len(h) >= 2:
                    current = round(h['Close'].iloc[-1], 2)
                    prev = round(h['Close'].iloc[-2], 2)
                    change = round(current - prev, 2)
                    change_pct = round((change / prev) * 100, 2)
                    stock_data.append({
                        'symbol': sym, 'name': get_stock_name(sym), 'price': to_inr(current, sym),
                        'change': to_inr(change, sym), 'change_pct': change_pct,
                        'volume': int(h['Volume'].iloc[-1])
                    })
            except Exception:
                continue
        
        return jsonify({'indices': index_data, 'trending': stock_data})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/compare', methods=['POST'])
@login_required
def compare_stocks():
    """Compare multiple stocks — subscribers only"""
    username = session.get('username', '').lower()
    if username not in SUBSCRIBED_USERS:
        return jsonify({'error': 'premium_required'}), 403
    try:
        data = request.get_json()
        symbols = data.get('symbols', ['AAPL', 'MSFT'])
        period = data.get('period', '1y')
        
        result = {}
        for sym in symbols[:5]:  # Max 5 stocks
            try:
                t = yf.Ticker(sym.upper())
                h = t.history(period=period)
                h = h.dropna(subset=['Close'])
                if not h.empty:
                    # Normalize prices to percentage change from start
                    start_price = h['Close'].iloc[0]
                    normalized = ((h['Close'] / start_price) - 1) * 100
                    
                    # Clean NaN from volume
                    volume_clean = [int(v) if v == v else 0 for v in h['Volume'].tolist()]
                    # Clean NaN from normalized
                    norm_clean = [round(float(v), 2) if v == v else 0.0 for v in normalized.tolist()]
                    
                    result[sym.upper()] = {
                        'dates': h.index.strftime('%Y-%m-%d').tolist(),
                        'close': list_to_inr(h['Close'].tolist(), sym),
                        'normalized': norm_clean,
                        'volume': volume_clean,
                        'start_price': to_inr(start_price, sym),
                        'end_price': to_inr(h['Close'].iloc[-1], sym),
                        'total_return': round(float(normalized.iloc[-1]), 2) if normalized.iloc[-1] == normalized.iloc[-1] else 0.0,
                        'max_price': to_inr(h['Close'].max(), sym),
                        'min_price': to_inr(h['Close'].min(), sym),
                        'avg_volume': int(h['Volume'].mean()) if h['Volume'].mean() == h['Volume'].mean() else 0,
                        'volatility': round(h['Close'].pct_change().std() * np.sqrt(252) * 100, 2) if h['Close'].pct_change().std() == h['Close'].pct_change().std() else 0.0,
                    }
            except Exception:
                continue
        
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/search/<query>')
def search_stocks(query):
    """Search for stock symbols"""
    try:
        ticker = yf.Ticker(query.upper())
        info = ticker.info
        results = [{
            'symbol': query.upper(),
            'name': info.get('shortName', query.upper()),
            'exchange': info.get('exchange', 'N/A'),
            'type': info.get('quoteType', 'N/A'),
        }]
        return jsonify(results)
    except Exception:
        return jsonify([])


if __name__ == '__main__':
    print("\n" + "="*60)
    print("  Realtime S Pulse - Stock Market Analytics")
    print("  Open http://localhost:5000 in your browser")
    print("="*60 + "\n")
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV', 'development') != 'production'
    app.run(debug=debug, host='0.0.0.0', port=port)
