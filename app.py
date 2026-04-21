"""
Real-Time Stock Market Data Analytics with Machine Learning
Main Flask Application
"""

from flask import Flask, render_template, jsonify, request, session, redirect, url_for, flash
from flask_cors import CORS
from werkzeug.middleware.proxy_fix import ProxyFix
from functools import wraps, lru_cache
import yfinance as yf
import pandas as pd
import numpy as np
import requests
from datetime import datetime, timedelta
import time
import json
import os
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import warnings
import hashlib
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
# RATE LIMITING
# ─────────────────────────────────────────────
def rate_limited(max_per_minute):
    """Decorator to limit API calls to a certain number per minute."""
    lock = threading.Lock()
    calls = []

    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            with lock:
                now = time.time()
                # Remove calls older than a minute
                calls[:] = [c for c in calls if c > now - 60]
                if len(calls) >= max_per_minute:
                    return jsonify({'error': 'Too Many Requests. Rate limited.'}), 429
                calls.append(now)
            return f(*args, **kwargs)
        return wrapper
    return decorator

# ─────────────────────────────────────────────
# API CACHING
# ─────────────────────────────────────────────
def timed_lru_cache(seconds: int, maxsize: int = 128):
    """Decorator to cache function results with a time-to-live (TTL)."""
    def wrapper_cache(func):
        func = lru_cache(maxsize=maxsize)(func)
        func.ttl = seconds
        func.expiration = time.time() + seconds

        @wraps(func)
        def wrapper_func(*args, **kwargs):
            if time.time() >= func.expiration:
                func.cache_clear()
                func.expiration = time.time() + func.ttl
            return func(*args, **kwargs)
        return wrapper_func
    return wrapper_cache


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
_USERS_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'users.json')

def _hash_pw(password):
    """Return a SHA-256 hex digest of the password."""
    return hashlib.sha256(password.encode()).hexdigest()

def _load_users():
    """Load users from JSON file, seeding defaults on first run."""
    defaults = {
        'admin': _hash_pw('spulse123'),
        'trader': _hash_pw('market2026'),
    }
    if os.path.exists(_USERS_FILE):
        try:
            with open(_USERS_FILE) as f:
                users = json.load(f)
            # Merge defaults (don't overwrite existing)
            for k, v in defaults.items():
                users.setdefault(k, v)
            return users
        except Exception:
            pass
    return dict(defaults)

def _save_users():
    """Persist USERS dict to data/users.json."""
    os.makedirs(os.path.dirname(_USERS_FILE), exist_ok=True)
    with open(_USERS_FILE, 'w') as f:
        json.dump(USERS, f, indent=2)

USERS = _load_users()

SUBSCRIPTION_PLANS = {
    'monthly':  {'label': 'Monthly',  'price': 250,  'duration': '1 Month',  'icon': 'fa-calendar'},
    'yearly':   {'label': 'Yearly',   'price': 1000, 'duration': '1 Year',   'icon': 'fa-calendar-days'},
    'lifetime': {'label': 'Lifetime', 'price': 5000, 'duration': 'Forever',  'icon': 'fa-infinity'},
}
SUBSCRIPTION_PRICE_INR = 250  # default / backward-compat

# Persistent (committed) data file — always present in the repo
_repo_data_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
_REPO_SUBS_FILE = os.path.join(_repo_data_dir, 'subscriptions.json')
_WATCHLISTS_FILE = os.path.join(_repo_data_dir, 'watchlists.json')

# On serverless/read-only deploy (Render/Vercel) also keep a runtime copy in /tmp
_is_readonly = bool(os.environ.get('VERCEL') or os.environ.get('RENDER'))
_runtime_dir = '/tmp' if _is_readonly else _repo_data_dir
SUBSCRIPTIONS_FILE = os.path.join(_runtime_dir, 'subscriptions.json')


def _load_subscriptions():
    """Load subscribed users and pending requests.
    Always seeds from the committed data/subscriptions.json (survives redeploys),
    then merges in any runtime additions from /tmp (current session on Render)."""
    subscribed = {'admin'}
    pending = []

    # 1. Load committed baseline (repo file — readable even on Render)
    if os.path.exists(_REPO_SUBS_FILE):
        try:
            with open(_REPO_SUBS_FILE) as f:
                base = json.load(f)
            subscribed = set(base.get('subscribed', ['admin']))
            pending = base.get('pending', [])
        except Exception:
            pass

    # 2. On Render/Vercel also merge runtime /tmp data (approvals made since last deploy)
    if _is_readonly and os.path.exists(SUBSCRIPTIONS_FILE) and SUBSCRIPTIONS_FILE != _REPO_SUBS_FILE:
        try:
            with open(SUBSCRIPTIONS_FILE) as f:
                runtime = json.load(f)
            subscribed |= set(runtime.get('subscribed', []))
            # Merge pending: runtime list takes priority (may have new entries or removals)
            if runtime.get('pending') is not None:
                pending = runtime['pending']
        except Exception:
            pass

    return subscribed, pending


def _save_subscriptions():
    """Persist subscribed users and pending requests.
    Writes to the runtime file (/tmp on Render, data/ locally).
    On local dev also updates the committed repo file so next deploy seeds correctly."""
    payload = {'subscribed': list(SUBSCRIBED_USERS), 'pending': PENDING_REQUESTS}

    # Always write runtime file
    os.makedirs(os.path.dirname(SUBSCRIPTIONS_FILE), exist_ok=True)
    with open(SUBSCRIPTIONS_FILE, 'w') as f:
        json.dump(payload, f, indent=2)

    # On local dev, also update the repo file so pushes carry the latest data
    if not _is_readonly:
        os.makedirs(_repo_data_dir, exist_ok=True)
        with open(_REPO_SUBS_FILE, 'w') as f:
            json.dump(payload, f, indent=2)


# Users who have purchased a subscription (Text Report & future premium features)
SUBSCRIBED_USERS, PENDING_REQUESTS = _load_subscriptions()


def _load_watchlists():
    """Load per-user watchlists and portfolio data."""
    if os.path.exists(_WATCHLISTS_FILE):
        try:
            with open(_WATCHLISTS_FILE) as f:
                data = json.load(f)
                if isinstance(data, dict):
                    return data
        except Exception:
            pass
    return {}


def _save_watchlists(data):
    """Persist per-user watchlists and portfolio data."""
    os.makedirs(os.path.dirname(_WATCHLISTS_FILE), exist_ok=True)
    with open(_WATCHLISTS_FILE, 'w') as f:
        json.dump(data, f, indent=2)


def _normalize_user_key():
    """Return a stable lowercase key for the logged-in user."""
    return session.get('username', '').strip().lower()


def _get_user_watchlist_bundle(store, user_key):
    """Ensure user bundle exists and return it."""
    if user_key not in store or not isinstance(store[user_key], dict):
        store[user_key] = {'stocks': [], 'portfolio': []}
    bundle = store[user_key]
    bundle.setdefault('stocks', [])
    bundle.setdefault('portfolio', [])
    return bundle

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not session.get('logged_in'):
            # API routes should return JSON instead of HTML redirects so frontend
            # handlers can show actionable messages.
            if request.path.startswith('/api/'):
                return jsonify({'error': 'auth_required', 'message': 'Please sign in to continue.'}), 401
            flash('Please sign in to access the dashboard.', 'error')
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated

# ─────────────────────────────────────────────
# GOOGLE SEARCH CONSOLE VERIFICATION FILE
# Set env var GOOGLE_SITE_VERIFICATION_FILE to the
# content provided by Google (e.g. "google1234abcd.html")
# ─────────────────────────────────────────────
@app.route('/google<token>.html')
def google_verification(token):
    """Serve Google Search Console HTML verification file."""
    expected = os.environ.get('GOOGLE_SITE_VERIFICATION_FILE', '')
    filename = f'google{token}.html'
    if expected and filename == expected:
        return f'google-site-verification: {filename}', 200, {'Content-Type': 'text/html'}
    return '', 404

@app.context_processor
def inject_user():
    username = session.get('username', '').lower()
    return {
        'current_user': username or 'Guest',
        'logged_in': session.get('logged_in', False),
        'is_subscribed': username in SUBSCRIBED_USERS,
        'asset_version': os.environ.get('ASSET_VERSION', '20260403-1'),
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
        if username in USERS and USERS[username] == _hash_pw(password):
            session['logged_in'] = True
            session['username'] = username.lower()
            session.permanent = bool(request.form.get('remember'))
            flash(f'Welcome back, {username}!', 'success')
            return redirect(url_for('dashboard'))  # /dashboard
        else:
            flash('Invalid username or password. Please try again.', 'error')
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if session.get('logged_in'):
        return redirect(url_for('dashboard'))
    if request.method == 'POST':
        full_name = request.form.get('fullname', '').strip()
        email     = request.form.get('email', '').strip()
        username  = request.form.get('username', '').strip().lower()
        password  = request.form.get('password', '')
        confirm   = request.form.get('confirm_password', '')

        # Validation
        if not all([full_name, username, password, confirm]):
            flash('All fields are required.', 'error')
        elif len(username) < 3:
            flash('Username must be at least 3 characters.', 'error')
        elif len(password) < 6:
            flash('Password must be at least 6 characters.', 'error')
        elif password != confirm:
            flash('Passwords do not match.', 'error')
        elif username in USERS:
            flash('Username already taken. Please choose another.', 'error')
        else:
            # Create the account
            USERS[username] = _hash_pw(password)
            _save_users()
            # Auto-login
            session['logged_in'] = True
            session['username']  = username
            if email:
                session['email'] = email
            session.permanent = True
            # Send welcome email in background
            if email:
                threading.Thread(target=send_welcome_email, args=(email, full_name), daemon=True).start()
            flash(f'Account created successfully! Welcome, {full_name}!', 'success')
            return redirect(url_for('dashboard'))
    return render_template('register.html')

@app.route('/forgot-password', methods=['GET', 'POST'])
def forgot_password():
    if session.get('logged_in'):
        return redirect(url_for('dashboard'))
    step = 'username'          # default first step
    username_val = ''
    if request.method == 'POST':
        action = request.form.get('action', '')
        if action == 'verify':
            username_val = request.form.get('username', '').strip().lower()
            if not username_val:
                flash('Please enter your username.', 'error')
            elif username_val not in USERS:
                flash('No account found with that username.', 'error')
            else:
                step = 'reset'
        elif action == 'reset':
            username_val = request.form.get('username', '').strip().lower()
            new_pw   = request.form.get('new_password', '')
            confirm  = request.form.get('confirm_password', '')
            if not username_val or username_val not in USERS:
                flash('Invalid request. Please start over.', 'error')
            elif len(new_pw) < 6:
                flash('Password must be at least 6 characters.', 'error')
                step = 'reset'
            elif new_pw != confirm:
                flash('Passwords do not match.', 'error')
                step = 'reset'
            else:
                USERS[username_val] = _hash_pw(new_pw)
                _save_users()
                flash('Password reset successfully! You can now sign in.', 'success')
                return redirect(url_for('login'))
    return render_template('forgot_password.html', step=step, username_val=username_val)

@app.route('/logout')
def logout():
    session.clear()
    flash('You have been signed out successfully.', 'success')
    return redirect(url_for('login'))

# ─────────────────────────────────────────────
# GOOGLE OAUTH ROUTES
# ─────────────────────────────────────────────
def _get_redirect_uri():
    """Return the OAuth redirect URI — multiple fallbacks for reliability."""
    # 1. Explicit env var (highest priority)
    env_uri = os.environ.get('REDIRECT_URI', '').strip()
    if env_uri:
        print(f'[OAUTH] Using REDIRECT_URI env var: {env_uri}')
        return env_uri
    # 2. Render auto-detects its own hostname via RENDER_EXTERNAL_HOSTNAME
    render_host = os.environ.get('RENDER_EXTERNAL_HOSTNAME', '').strip()
    if render_host:
        uri = f'https://{render_host}/auth/google/callback'
        print(f'[OAUTH] Using RENDER_EXTERNAL_HOSTNAME: {uri}')
        return uri
    # 3. Local fallback
    uri = url_for('google_callback', _external=True)
    print(f'[OAUTH] Using url_for fallback: {uri}')
    return uri

@app.route('/auth/google')
def google_login():
    if not os.environ.get('GOOGLE_CLIENT_ID'):
        flash('Google login is not configured.', 'error')
        return redirect(url_for('login'))
    return google.authorize_redirect(_get_redirect_uri())

@app.route('/auth/google/callback')
def google_callback():
    try:
        token = google.authorize_access_token()
        user_info = token.get('userinfo')
        if not user_info:
            import urllib.request as _ur, json as _json
            req = _ur.Request(
                'https://www.googleapis.com/oauth2/v3/userinfo',
                headers={'Authorization': f'Bearer {token["access_token"]}'}
            )
            user_info = _json.loads(_ur.urlopen(req).read())

        email    = user_info.get('email', '')
        name     = user_info.get('name', email.split('@')[0])
        username = email.split('@')[0].replace('.', '_').lower()

        if email not in USERS:
            USERS[email] = None

        session.clear()
        session['logged_in']    = True
        session['username']     = username
        session['email']        = email
        session['avatar']       = user_info.get('picture', '')
        session['auth_method']  = 'google'
        session.permanent       = True

        threading.Thread(target=send_welcome_email, args=(email, name), daemon=True).start()

        flash(f'Welcome, {name}!', 'success')
        return redirect(url_for('dashboard'))
    except Exception as e:
        print(f'[OAUTH ERROR] {e}')
        flash(f'Google login failed: {str(e)}', 'error')
        return redirect(url_for('login'))

# ─────────────────────────────────────────────
# PAGE ROUTES
# ─────────────────────────────────────────────

@app.route('/')
def home():
    """Route visitors to login and signed-in users to dashboard."""
    if session.get('logged_in'):
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))

@app.route('/dashboard')
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
    return render_template('predictions.html', stock_categories=STOCK_CATEGORIES, stock_names=STOCK_NAMES)

@app.route('/compare')
@login_required
def compare():
    # Keep compare accessible for all signed-in users.
    return render_template('compare.html', is_subscribed=True)

@app.route('/market-predictions')
@login_required
def market_predictions():
    return render_template('market_predictions.html')

@app.route('/watchlist')
@login_required
def watchlist():
    return render_template('watchlist.html')

@app.route('/heatmap')
@login_required
def heatmap():
    return render_template('heatmap.html')


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
                               plans=SUBSCRIPTION_PLANS, already_subscribed=True)

    already_pending = any(p['username'] == username for p in PENDING_REQUESTS)

    if request.method == 'POST':
        txn_id = request.form.get('txn_id', '').strip()
        plan   = request.form.get('plan', 'monthly').strip().lower()
        if plan not in SUBSCRIPTION_PLANS:
            plan = 'monthly'
        plan_info = SUBSCRIPTION_PLANS[plan]

        if not txn_id:
            flash('Please enter a valid UPI Transaction ID.', 'error')
        elif already_pending:
            flash('Your payment request is already under review. Please wait for admin approval.', 'info')
        else:
            PENDING_REQUESTS.append({
                'username': username,
                'txn_id': txn_id,
                'plan': plan,
                'amount': plan_info['price'],
                'submitted_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
                'status': 'pending',
            })
            _save_subscriptions()
            already_pending = True
            flash('Payment submitted! Your subscription will be activated after admin verification.', 'success')

    return render_template('subscribe.html', pending=already_pending,
                           plans=SUBSCRIPTION_PLANS, already_subscribed=False)


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
                           plans=SUBSCRIPTION_PLANS)


@app.route('/admin/subscriptions/snapshot')
@login_required
def admin_subscriptions_snapshot():
    """Download current subscriptions as JSON — commit to repo to make persistent."""
    if session.get('username', '').lower() != 'admin':
        return '', 403
    payload = json.dumps({'subscribed': sorted(SUBSCRIBED_USERS), 'pending': PENDING_REQUESTS}, indent=2)
    return payload, 200, {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="subscriptions.json"',
    }


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
_FX_RATE_CACHE = {'rate': USD_TO_INR, 'expires_at': 0}
_FX_RATE_LOCK = threading.Lock()


def get_usd_to_inr_rate(force_refresh=False):
    """Return USD->INR FX rate using cached live value with safe fallback."""
    now = time.time()
    cached_rate = _FX_RATE_CACHE.get('rate', USD_TO_INR)
    if not force_refresh and now < _FX_RATE_CACHE.get('expires_at', 0):
        return cached_rate

    with _FX_RATE_LOCK:
        now = time.time()
        if not force_refresh and now < _FX_RATE_CACHE.get('expires_at', 0):
            return _FX_RATE_CACHE.get('rate', USD_TO_INR)

        rate = None
        try:
            fx = yf.Ticker('USDINR=X')
            hist = fx.history(period='5d', interval='1d')
            if not hist.empty:
                rate = float(hist['Close'].iloc[-1])
            if rate in (None, 0) or rate != rate:
                fast = fx.fast_info
                rate = float(fast.get('lastPrice') or fast.get('regularMarketPrice') or 0)
        except Exception:
            rate = None

        # Guardrail for bad provider payloads.
        if rate is None or rate != rate or rate <= 0 or rate < 60 or rate > 120:
            rate = _FX_RATE_CACHE.get('rate', USD_TO_INR) or USD_TO_INR

        _FX_RATE_CACHE['rate'] = round(float(rate), 4)
        _FX_RATE_CACHE['expires_at'] = now + 900  # 15 minutes
        return _FX_RATE_CACHE['rate']

# Keep last successful API payloads so UI remains usable during temporary upstream limits.
_LAST_STOCK_PAYLOAD = {}
_LAST_TECH_PAYLOAD = {}
_LAST_LIVE_PAYLOAD = {}
_LAST_PRED_PAYLOAD = {}
_LAST_COMPARE_PAYLOAD = {}
_MARKET_OVERVIEW_CACHE = {'payload': None, 'expires_at': 0}
_MARKET_OVERVIEW_CACHE_LOCK = threading.Lock()


def _fetch_market_snapshot(symbol):
    """Fetch a compact quote snapshot for dashboard ticker/trending blocks."""
    try:
        hist, _meta = _fetch_yahoo_chart_history(symbol, period='5d', interval='1d')
        if hist.empty or len(hist) < 2:
            return None

        current = float(hist['Close'].iloc[-1])
        prev = float(hist['Close'].iloc[-2])
        if prev == 0:
            return None

        change = current - prev
        volume_raw = hist['Volume'].iloc[-1]
        volume = int(volume_raw) if volume_raw == volume_raw else 0

        return {
            'symbol': symbol,
            'price': to_inr(current, symbol),
            'change': to_inr(change, symbol),
            'change_pct': round((change / prev) * 100, 2),
            'volume': volume,
        }
    except Exception:
        return None


def _build_stock_fallback(symbol, points=30, base_price=100.0):
    """Return a safe fallback stock payload when upstream APIs are throttled."""
    now = datetime.utcnow()
    dates = [(now - timedelta(days=(points - 1 - i))).strftime('%Y-%m-%d %H:%M') for i in range(points)]
    price = to_inr(base_price, symbol)
    close = [price for _ in range(points)]
    return {
        'dates': dates,
        'open': close[:],
        'high': close[:],
        'low': close[:],
        'close': close[:],
        'volume': [0 for _ in range(points)],
        'info': {
            'name': get_stock_name(symbol),
            'sector': 'N/A',
            'industry': 'N/A',
            'marketCap': 0,
            'peRatio': 0,
            'dividendYield': 0,
            'fiftyTwoWeekHigh': price,
            'fiftyTwoWeekLow': price,
            'avgVolume': 0,
            'beta': 0,
            'eps': 0,
            'currency': 'INR',
        },
        'current_price': price,
        'prev_close': price,
        'change': 0,
        'change_pct': 0,
        'is_stale': True,
        'is_fallback': True,
        'warning': 'Live market data temporarily limited. Showing fallback data.',
    }


def _build_technical_fallback(symbol, points=60, base_price=100.0):
    """Return neutral technical indicators so charts remain usable."""
    now = datetime.utcnow()
    dates = [(now - timedelta(days=(points - 1 - i))).strftime('%Y-%m-%d') for i in range(points)]
    price = to_inr(base_price, symbol)
    flat = [price for _ in range(points)]
    zeros = [0 for _ in range(points)]
    neutral = [50 for _ in range(points)]
    return {
        'dates': dates,
        'close': flat[:],
        'sma_20': flat[:],
        'sma_50': flat[:],
        'ema_12': flat[:],
        'ema_26': flat[:],
        'macd': zeros[:],
        'macd_signal': zeros[:],
        'macd_hist': zeros[:],
        'rsi': neutral[:],
        'bb_upper': flat[:],
        'bb_middle': flat[:],
        'bb_lower': flat[:],
        'atr': zeros[:],
        'vwap': flat[:],
        'stoch_k': neutral[:],
        'stoch_d': neutral[:],
        'obv': zeros[:],
        'volume': zeros[:],
        'signals': {
            'overall': 'HOLD',
            'score': 0,
            'max_score': 8,
            'indicators': [
                {'indicator': 'RSI', 'signal': 'NEUTRAL', 'value': 50, 'reason': 'Fallback data'},
                {'indicator': 'MACD', 'signal': 'NEUTRAL', 'value': 0, 'reason': 'Fallback data'},
                {'indicator': 'SMA Cross', 'signal': 'NEUTRAL', 'value': 'N/A', 'reason': 'Fallback data'},
            ],
        },
        'is_stale': True,
        'is_fallback': True,
        'warning': 'Technical data temporarily limited. Showing fallback data.',
    }


def _build_prediction_fallback(symbol, days=30, base_price=100.0):
    """Return safe fallback ML predictions so forecasts remain usable during API limits."""
    price = to_inr(base_price, symbol)
    now = datetime.utcnow()
    
    future = []
    for i in range(days):
        future_date = now + timedelta(days=i + 1)
        while future_date.weekday() >= 5:
            future_date += timedelta(days=1)
        future.append({
            'date': future_date.strftime('%Y-%m-%d'),
            'predicted_price': round(price, 2),
            'upper_bound': round(price * 1.05, 2),
            'lower_bound': round(price * 0.95, 2),
            'confidence': max(0.25, 1.0 - i * 0.018),
        })
    
    test_dates = [(now - timedelta(days=(30 - 1 - i))).strftime('%Y-%m-%d') for i in range(30)]
    actual_prices = [price] * 30
    
    return {
        'symbol': symbol.upper(),
        'current_price': price,
        'best_model': 'Ensemble',
        'test_dates': test_dates,
        'actual_prices': actual_prices,
        'future': future,
        'training_size': 100,
        'test_size': 30,
        'features_used': 25,
        'models': {
            'Random Forest': {'predictions': actual_prices[:], 'metrics': {'r2': 0.0, 'mae': 0.0, 'mape': 0.0, 'directional_accuracy': 50.0}},
            'Gradient Boosting': {'predictions': actual_prices[:], 'metrics': {'r2': 0.0, 'mae': 0.0, 'mape': 0.0, 'directional_accuracy': 50.0}},
            'Ridge Regression': {'predictions': actual_prices[:], 'metrics': {'r2': 0.0, 'mae': 0.0, 'mape': 0.0, 'directional_accuracy': 50.0}},
            'SVR': {'predictions': actual_prices[:], 'metrics': {'r2': 0.0, 'mae': 0.0, 'mape': 0.0, 'directional_accuracy': 50.0}},
            'Linear Regression': {'predictions': actual_prices[:], 'metrics': {'r2': 0.0, 'mae': 0.0, 'mape': 0.0, 'directional_accuracy': 50.0}},
            'Ensemble': {'predictions': actual_prices[:], 'metrics': {'r2': 0.0, 'mae': 0.0, 'mape': 0.0, 'directional_accuracy': 50.0}},
        },
        'is_stale': True,
        'is_fallback': True,
        'warning': 'ML predictions temporarily limited. This is fallback data with no price change projected.',
    }


def _estimate_base_price(symbol, default_price=100.0):
    """Estimate a realistic current price in the symbol's source currency."""
    sym = (symbol or '').upper()
    try:
        hist, _meta = _fetch_yahoo_chart_history(sym, period='5d', interval='1d')
        if not hist.empty:
            last_close = float(hist['Close'].iloc[-1])
            if last_close == last_close and last_close > 0:
                return last_close
        hist, _meta = _fetch_yahoo_chart_history(sym, period='1d', interval='1m')
        if not hist.empty:
            last_close = float(hist['Close'].iloc[-1])
            if last_close == last_close and last_close > 0:
                return last_close
    except Exception:
        pass

    return float(default_price)


def _build_compare_fallback(symbol, period='1y', base_price=100.0):
    """Return safe compare payload for one symbol when upstream quote source is limited."""
    points_map = {
        '1mo': 22,
        '3mo': 66,
        '6mo': 132,
        '1y': 252,
        '2y': 504,
        '5y': 1260,
    }
    points = max(10, int(points_map.get((period or '1y').lower(), 252)))
    now = datetime.utcnow()

    dates = []
    current = now
    while len(dates) < points:
        if current.weekday() < 5:
            dates.append(current.strftime('%Y-%m-%d'))
        current -= timedelta(days=1)
    dates.reverse()

    price = round(float(base_price), 2)
    close = [price] * points

    return {
        'dates': dates,
        'close': close,
        'normalized': [0.0] * points,
        'volume': [0] * points,
        'start_price': price,
        'end_price': price,
        'total_return': 0.0,
        'max_price': price,
        'min_price': price,
        'avg_volume': 0,
        'volatility': 0.0,
        'is_stale': True,
        'warning': 'Comparison data temporarily limited. Showing fallback series.',
    }


def get_stock_name(symbol):
    """Get clear company name for a stock symbol"""
    return STOCK_NAMES.get(symbol.upper(), symbol.upper())


def is_inr_stock(symbol):
    """Check if stock prices are already in INR"""
    sym = (symbol or '').upper()
    # NSE stocks and Indian indices are already INR-denominated.
    return sym.endswith('.NS') or sym in {'NSEI', '^NSEI', 'BSESN', '^BSESN'}


def to_inr(value, symbol):
    """Normalize a single price value without forcing a currency conversion."""
    if value is None:
        return 0
    try:
        val = float(value)
        if val != val:  # NaN check
            return 0
        return round(val, 2)
    except (ValueError, TypeError):
        return 0


def list_to_inr(values, symbol):
    """Normalize a list of price values without forcing a currency conversion."""
    result = []
    for v in values:
        try:
            fv = float(v)
            if fv != fv:  # NaN check
                result.append(0)
            else:
                result.append(round(fv, 2))
        except (ValueError, TypeError):
            result.append(0)
    return result


def convert_stock_data_to_inr(data, symbol):
    """Normalize stock data API response to native market values."""
    if 'info' in data:
        data['info']['currency'] = data['info'].get('currency', 'USD')
    return data


def convert_technical_to_inr(result, symbol):
    """Normalize technical indicator results without forcing a currency conversion."""
    return result


_YAHOO_CHART_HEADERS = {'User-Agent': 'Mozilla/5.0'}


def _fetch_yahoo_chart_history(symbol, period='1mo', interval='1d'):
    """Fetch chart data directly from Yahoo's chart API."""
    encoded_symbol = requests.utils.quote((symbol or '').upper(), safe='.')
    url = f'https://query1.finance.yahoo.com/v8/finance/chart/{encoded_symbol}'
    params = {
        'range': period,
        'interval': interval,
        'includePrePost': 'false',
        'events': 'div,splits',
    }
    response = requests.get(url, params=params, headers=_YAHOO_CHART_HEADERS, timeout=20)
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
    return frame, result.get('meta', {})


def convert_prediction_to_inr(result, symbol):
    """Normalize ML prediction results without forcing a currency conversion."""
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
        hist, meta = _fetch_yahoo_chart_history(symbol.upper(), period=period, interval=interval)
        
        if hist.empty:
            return jsonify({'error': f'No data found for {symbol}'}), 404
        
        info = {
            'name': meta.get('longName') or meta.get('shortName') or get_stock_name(symbol),
            'sector': meta.get('sector', 'N/A'),
            'industry': meta.get('industry', 'N/A'),
            'marketCap': meta.get('marketCap', 0) or 0,
            'peRatio': meta.get('trailingPE', 0) or 0,
            'dividendYield': meta.get('dividendYield', 0) or 0,
            'fiftyTwoWeekHigh': meta.get('fiftyTwoWeekHigh', 0) or 0,
            'fiftyTwoWeekLow': meta.get('fiftyTwoWeekLow', 0) or 0,
            'avgVolume': meta.get('averageVolume', 0) or meta.get('regularMarketVolume', 0) or 0,
            'beta': meta.get('beta', 0) or 0,
            'eps': meta.get('trailingEps', 0) or 0,
            'currency': meta.get('currency', 'USD'),
        }
        
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
        data['is_fallback'] = False
        _LAST_STOCK_PAYLOAD[symbol.upper()] = data
        return jsonify(data)
    except Exception as e:
        print(f"[ERROR] Failed to get stock data for {symbol}: {e}")
        msg = str(e).lower()
        cached = _LAST_STOCK_PAYLOAD.get(symbol.upper())
        if cached and not cached.get('is_fallback') and ('too many requests' in msg or 'rate limited' in msg):
            stale = dict(cached)
            stale['is_stale'] = True
            stale['warning'] = 'Serving cached data due to temporary upstream rate limit.'
            return jsonify(stale)

        base_price = _estimate_base_price(symbol.upper(), default_price=100.0)
        fallback = _build_stock_fallback(symbol, points=30, base_price=base_price)
        return jsonify(fallback)

@app.route('/api/live_price/<symbol>')
def get_live_price(symbol):
    """Fetch live price for a stock symbol."""
    try:
        requested_symbol = symbol.upper()

        # Map short index names to Yahoo symbols expected by yfinance.
        if symbol.upper() in ['NSEI', 'GSPC', 'DJI', 'IXIC', 'RUT'] and not symbol.startswith('^'):
            symbol = f'^{symbol}'
        mapped_symbol = symbol.upper()

        latest_price = None
        prev_close = None

        # Primary source: intraday candles from Yahoo chart API.
        try:
            hist, meta = _fetch_yahoo_chart_history(symbol, period='1d', interval='1m')
            if hist.empty:
                hist, meta = _fetch_yahoo_chart_history(symbol, period='5d', interval='1d')
            if not hist.empty:
                latest_price = float(hist['Close'].iloc[-1])
                prev_close = float(hist['Close'].iloc[-2]) if len(hist) > 1 else float(meta.get('chartPreviousClose') or latest_price)
        except Exception:
            pass

        if latest_price is None or latest_price == 0:
            cached = _LAST_LIVE_PAYLOAD.get(mapped_symbol) or _LAST_LIVE_PAYLOAD.get(requested_symbol)
            if cached:
                stale = dict(cached)
                stale['is_stale'] = True
                stale['warning'] = 'Serving cached live data due to temporary upstream rate limit.'
                return jsonify(stale)

            # Secondary fallback: use latest known stock close/current value if available.
            stock_cached = _LAST_STOCK_PAYLOAD.get(mapped_symbol) or _LAST_STOCK_PAYLOAD.get(requested_symbol)
            if stock_cached:
                stock_price = stock_cached.get('current_price')
                if stock_price in (None, 0):
                    close_series = stock_cached.get('close') if isinstance(stock_cached.get('close'), list) else []
                    if close_series:
                        stock_price = close_series[-1]
                if stock_price not in (None, 0):
                    stale = {
                        'price': round(float(stock_price), 2),
                        'change': round(float(stock_cached.get('change', 0) or 0), 2),
                        'change_pct': round(float(stock_cached.get('change_pct', 0) or 0), 2),
                        'timestamp': datetime.utcnow().isoformat() + 'Z',
                        'is_stale': True,
                        'warning': 'Using recent cached market data while live feed reconnects.',
                    }
                    _LAST_LIVE_PAYLOAD[mapped_symbol] = stale
                    _LAST_LIVE_PAYLOAD[requested_symbol] = stale
                    return jsonify(stale)

            fallback_price = to_inr(100.0, symbol)
            fallback = {
                'price': fallback_price,
                'change': 0,
                'change_pct': 0,
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'is_stale': True,
                'warning': 'Live market data temporarily limited. Showing fallback quote.',
            }
            _LAST_LIVE_PAYLOAD[mapped_symbol] = fallback
            _LAST_LIVE_PAYLOAD[requested_symbol] = fallback
            return jsonify(fallback)

        change = latest_price - (prev_close if prev_close is not None else latest_price)
        base = prev_close if prev_close not in (None, 0) else latest_price
        change_pct = (change / base) * 100 if base else 0

        payload = {
            'price': to_inr(latest_price, symbol),
            'change': to_inr(change, symbol),
            'change_pct': round(change_pct, 2),
            'timestamp': datetime.utcnow().isoformat() + 'Z',
        }
        _LAST_LIVE_PAYLOAD[mapped_symbol] = payload
        _LAST_LIVE_PAYLOAD[requested_symbol] = payload
        return jsonify(payload)
    except Exception as e:
        print(f"[ERROR] Failed to get live price for {symbol}: {e}")
        msg = str(e).lower()
        fallback_key = (symbol or '').upper()
        cached = _LAST_LIVE_PAYLOAD.get(fallback_key)
        if cached and ('too many requests' in msg or 'rate limited' in msg):
            stale = dict(cached)
            stale['is_stale'] = True
            stale['warning'] = 'Serving cached live data due to temporary upstream rate limit.'
            return jsonify(stale)

        fallback = {
            'price': to_inr(100.0, symbol),
            'change': 0,
            'change_pct': 0,
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'is_stale': True,
            'warning': 'Live market data temporarily limited. Showing fallback quote.',
        }
        _LAST_LIVE_PAYLOAD[fallback_key] = fallback
        return jsonify(fallback)


@app.route('/api/technical/<symbol>')
def get_technical_indicators(symbol):
    """Calculate technical indicators"""
    try:
        period = request.args.get('period', '6mo')
        hist, _meta = _fetch_yahoo_chart_history(symbol.upper(), period=period, interval='1d')
        
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
        result['is_fallback'] = False
        _LAST_TECH_PAYLOAD[symbol.upper()] = result
        return jsonify(result)
    except Exception as e:
        print(f"[ERROR] Failed to get technical indicators for {symbol}: {e}")
        msg = str(e).lower()
        cached = _LAST_TECH_PAYLOAD.get(symbol.upper())
        if cached and not cached.get('is_fallback') and ('too many requests' in msg or 'rate limited' in msg):
            stale = dict(cached)
            stale['is_stale'] = True
            stale['warning'] = 'Serving cached indicators due to temporary upstream rate limit.'
            return jsonify(stale)

        base_price = _estimate_base_price(symbol.upper(), default_price=100.0)
        fallback = _build_technical_fallback(symbol, points=60, base_price=base_price)
        return jsonify(fallback)


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
    """ML-based stock price prediction with graceful fallback during API limits"""
    import logging
    logging.basicConfig(level=logging.DEBUG, filename='prediction_debug.log', filemode='a')
    logger = logging.getLogger(__name__)
    
    try:
        days = int(request.args.get('days', 30))
        logger.info(f"[PREDICT] Starting ML prediction for {symbol} ({days} days)")
        result = ml_engine.predict(symbol.upper(), days)
        logger.info(f"[PREDICT] ML prediction successful for {symbol}")
        result = convert_prediction_to_inr(result, symbol)
        result['is_fallback'] = bool(result.get('is_fallback', False))
        _LAST_PRED_PAYLOAD[symbol.upper()] = result
        logger.info(f"[PREDICT] Returning actual ML predictions for {symbol}")
        return jsonify(result)
    except Exception as e:
        logger.error(f"[ERROR] ML prediction failed for {symbol}: {type(e).__name__}: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        msg = str(e).lower()
        cached = _LAST_PRED_PAYLOAD.get(symbol.upper())
        
        if cached and not cached.get('is_fallback') and ('too many requests' in msg or 'rate limited' in msg or 'timeout' in msg):
            logger.warning(f"[PREDICT] Returning cached predictions for {symbol} due to rate limit")
            stale = dict(cached)
            stale['is_stale'] = True
            stale['warning'] = 'ML predictions temporarily limited due to upstream rate-limits. Showing last successful prediction.'
            return jsonify(stale)
        
        logger.warning(f"[PREDICT] Returning fallback predictions for {symbol}")
        base_price = _estimate_base_price(symbol.upper(), default_price=100.0)
        fallback = _build_prediction_fallback(symbol.upper(), days=int(request.args.get('days', 30)), base_price=base_price)
        return jsonify(fallback)


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
        now = time.time()
        with _MARKET_OVERVIEW_CACHE_LOCK:
            cached_payload = _MARKET_OVERVIEW_CACHE.get('payload')
            if cached_payload and now < _MARKET_OVERVIEW_CACHE.get('expires_at', 0):
                return jsonify(cached_payload)

        indices = {
            '^GSPC': 'S&P 500',
            '^DJI': 'Dow Jones',
            '^IXIC': 'NASDAQ',
            '^RUT': 'Russell 2000',
        }

        trending = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'NVDA', 'META', 'JPM']

        symbols = list(dict.fromkeys(list(indices.keys()) + trending))
        snapshots = {}
        max_workers = min(8, max(1, len(symbols)))
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {executor.submit(_fetch_market_snapshot, sym): sym for sym in symbols}
            for future in as_completed(futures):
                sym = futures[future]
                snap = future.result()
                if snap:
                    snapshots[sym] = snap

        index_data = []
        for sym, name in indices.items():
            snap = snapshots.get(sym)
            if not snap:
                continue
            index_data.append({
                'symbol': sym,
                'name': name,
                'price': snap['price'],
                'change': snap['change'],
                'change_pct': snap['change_pct'],
            })

        stock_data = []
        for sym in trending:
            snap = snapshots.get(sym)
            if not snap:
                continue
            stock_data.append({
                'symbol': sym,
                'name': get_stock_name(sym),
                'price': snap['price'],
                'change': snap['change'],
                'change_pct': snap['change_pct'],
                'volume': snap['volume'],
            })

        payload = {'indices': index_data, 'trending': stock_data}

        # Cache short-lived payload so repeated dashboard loads feel instant.
        if index_data or stock_data:
            with _MARKET_OVERVIEW_CACHE_LOCK:
                _MARKET_OVERVIEW_CACHE['payload'] = payload
                _MARKET_OVERVIEW_CACHE['expires_at'] = time.time() + 45
            return jsonify(payload)

        with _MARKET_OVERVIEW_CACHE_LOCK:
            stale_payload = _MARKET_OVERVIEW_CACHE.get('payload')
        if stale_payload:
            stale = dict(stale_payload)
            stale['warning'] = 'Serving cached market overview due to temporary upstream limits.'
            return jsonify(stale)

        return jsonify(payload)
    except Exception as e:
        with _MARKET_OVERVIEW_CACHE_LOCK:
            stale_payload = _MARKET_OVERVIEW_CACHE.get('payload')
        if stale_payload:
            stale = dict(stale_payload)
            stale['warning'] = 'Serving cached market overview due to temporary upstream limits.'
            return jsonify(stale)
        return jsonify({'error': str(e)}), 500


@app.route('/api/sector-heatmap')
@login_required
def sector_heatmap():
    """Get sector-level heatmap data used by heatmap.js."""
    try:
        period = request.args.get('period', '1d').strip().lower()
        period_map = {
            '1d': '5d',
            '5d': '1mo',
            '1w': '1mo',
            '1mo': '3mo',
            '3mo': '6mo',
        }
        yf_period = period_map.get(period, '1mo')

        heatmap = {}
        for sector, symbols in STOCK_CATEGORIES.items():
            stocks = []
            changes = []
            for sym in symbols:
                try:
                    t = yf.Ticker(sym)
                    h = t.history(period=yf_period)
                    if h.empty or len(h) < 2:
                        continue
                    close_now = float(h['Close'].iloc[-1])
                    close_prev = float(h['Close'].iloc[-2])
                    if close_prev == 0:
                        continue
                    change_pct = ((close_now - close_prev) / close_prev) * 100
                    stocks.append({
                        'symbol': sym,
                        'name': get_stock_name(sym),
                        'price': to_inr(close_now, sym),
                        'change_pct': round(change_pct, 2),
                    })
                    changes.append(change_pct)
                except Exception:
                    continue

            if stocks:
                stocks.sort(key=lambda s: s['change_pct'], reverse=True)
                heatmap[sector] = {
                    'avg_change': round(float(np.mean(changes)), 2),
                    'stocks': stocks,
                }

        return jsonify(heatmap)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/watchlist')
@login_required
def api_watchlist():
    """Get watchlist + portfolio for current user."""
    store = _load_watchlists()
    user_key = _normalize_user_key()
    bundle = _get_user_watchlist_bundle(store, user_key)
    return jsonify({'stocks': bundle['stocks'], 'portfolio': bundle['portfolio']})


@app.route('/api/watchlist/add', methods=['POST'])
@login_required
def api_watchlist_add():
    """Add symbol to user watchlist."""
    try:
        payload = request.get_json(silent=True) or {}
        symbol = str(payload.get('symbol', '')).strip().upper()
        if not symbol:
            return jsonify({'success': False, 'error': 'symbol_required'}), 400

        store = _load_watchlists()
        user_key = _normalize_user_key()
        bundle = _get_user_watchlist_bundle(store, user_key)
        if symbol not in bundle['stocks']:
            bundle['stocks'].append(symbol)
            _save_watchlists(store)
        return jsonify({'success': True, 'stocks': bundle['stocks']})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/watchlist/remove', methods=['POST'])
@login_required
def api_watchlist_remove():
    """Remove symbol from user watchlist."""
    try:
        payload = request.get_json(silent=True) or {}
        symbol = str(payload.get('symbol', '')).strip().upper()
        store = _load_watchlists()
        user_key = _normalize_user_key()
        bundle = _get_user_watchlist_bundle(store, user_key)
        bundle['stocks'] = [s for s in bundle['stocks'] if s.upper() != symbol]
        _save_watchlists(store)
        return jsonify({'success': True, 'stocks': bundle['stocks']})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/watchlist/prices', methods=['POST'])
@login_required
def api_watchlist_prices():
    """Get live quote snapshots for watchlist symbols."""
    try:
        payload = request.get_json(silent=True) or {}
        symbols = payload.get('symbols', []) or []
        results = {}

        for raw_sym in symbols[:100]:
            sym = str(raw_sym).strip().upper()
            if not sym:
                continue
            try:
                t = yf.Ticker(sym)
                h = t.history(period='5d')
                if h.empty or len(h) < 2:
                    results[sym] = {'error': 'no_data'}
                    continue
                current = float(h['Close'].iloc[-1])
                prev = float(h['Close'].iloc[-2])
                change = current - prev
                change_pct = (change / prev) * 100 if prev else 0
                high = float(h['High'].iloc[-1])
                low = float(h['Low'].iloc[-1])
                volume = int(h['Volume'].iloc[-1]) if h['Volume'].iloc[-1] == h['Volume'].iloc[-1] else 0

                results[sym] = {
                    'symbol': sym,
                    'name': get_stock_name(sym),
                    'price': to_inr(current, sym),
                    'change': to_inr(change, sym),
                    'change_pct': round(change_pct, 2),
                    'high': to_inr(high, sym),
                    'low': to_inr(low, sym),
                    'volume': volume,
                }
            except Exception:
                results[sym] = {'error': 'quote_failed'}

        return jsonify(results)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/portfolio/add', methods=['POST'])
@login_required
def api_portfolio_add():
    """Add position to user's portfolio."""
    try:
        payload = request.get_json(silent=True) or {}
        symbol = str(payload.get('symbol', '')).strip().upper()
        buy_price = float(payload.get('buy_price', 0))
        quantity = int(payload.get('quantity', 0))
        if not symbol or buy_price <= 0 or quantity <= 0:
            return jsonify({'success': False, 'error': 'invalid_payload'}), 400

        store = _load_watchlists()
        user_key = _normalize_user_key()
        bundle = _get_user_watchlist_bundle(store, user_key)
        bundle['portfolio'].append({
            'symbol': symbol,
            'buy_price': buy_price,
            'quantity': quantity,
            'date': datetime.utcnow().strftime('%Y-%m-%d'),
        })
        if symbol not in bundle['stocks']:
            bundle['stocks'].append(symbol)
        _save_watchlists(store)
        return jsonify({'success': True, 'portfolio': bundle['portfolio'], 'stocks': bundle['stocks']})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/portfolio/remove', methods=['POST'])
@login_required
def api_portfolio_remove():
    """Remove position from user's portfolio by index."""
    try:
        payload = request.get_json(silent=True) or {}
        index = int(payload.get('index', -1))
        store = _load_watchlists()
        user_key = _normalize_user_key()
        bundle = _get_user_watchlist_bundle(store, user_key)
        if 0 <= index < len(bundle['portfolio']):
            bundle['portfolio'].pop(index)
            _save_watchlists(store)
            return jsonify({'success': True, 'portfolio': bundle['portfolio']})
        return jsonify({'success': False, 'error': 'invalid_index'}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/compare', methods=['POST'])
@login_required
def compare_stocks():
    """Compare multiple stocks for signed-in users."""
    try:
        data = request.get_json()
        symbols = data.get('symbols', ['AAPL', 'MSFT'])
        period = data.get('period', '1y')
        
        result = {}
        for sym in symbols[:5]:  # Max 5 stocks
            key = sym.upper()
            try:
                h, _meta = _fetch_yahoo_chart_history(key, period=period, interval='1d')
                h = h.dropna(subset=['Close'])
                if not h.empty:
                    # Normalize prices to percentage change from start
                    start_price = h['Close'].iloc[0]
                    normalized = ((h['Close'] / start_price) - 1) * 100
                    
                    # Clean NaN from volume
                    volume_clean = [int(v) if v == v else 0 for v in h['Volume'].tolist()]
                    # Clean NaN from normalized
                    norm_clean = [round(float(v), 2) if v == v else 0.0 for v in normalized.tolist()]
                    
                    payload = {
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
                    result[key] = payload
                    _LAST_COMPARE_PAYLOAD[key] = payload
                    continue
            except Exception:
                pass

            # Graceful fallback per symbol when live compare fetch fails.
            cached = _LAST_COMPARE_PAYLOAD.get(key)
            if cached:
                stale_cached = dict(cached)
                stale_cached['is_stale'] = True
                stale_cached['warning'] = 'Serving cached comparison data due to temporary upstream rate limit.'
                result[key] = stale_cached
            else:
                base_price = _estimate_base_price(key, default_price=100.0)
                result[key] = _build_compare_fallback(key, period=period, base_price=base_price)
        
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


# ─────────────────────────────────────────────
# SEO: robots.txt & sitemap.xml
# ─────────────────────────────────────────────
@app.route('/robots.txt')
def robots_txt():
    """Serve robots.txt for search engine crawling."""
    content = """User-agent: *
Allow: /
Allow: /login
Disallow: /dashboard
Disallow: /analysis
Disallow: /predictions
Disallow: /compare
Disallow: /market-predictions
Disallow: /subscribe
Disallow: /admin/
Disallow: /api/
Disallow: /auth/
Disallow: /logout

Sitemap: https://real-time-stock-market-analysis-using-ml.onrender.com/sitemap.xml
"""
    return content, 200, {'Content-Type': 'text/plain; charset=utf-8'}


@app.route('/sitemap.xml')
def sitemap_xml():
    """Dynamically generated XML sitemap — only public pages."""
    base = 'https://real-time-stock-market-analysis-using-ml.onrender.com'
    pages = [
        ('/', '1.0', 'daily'),
        ('/login', '0.5', 'monthly'),
    ]
    today = datetime.utcnow().strftime('%Y-%m-%d')
    urls = ''
    for path, priority, freq in pages:
        urls += f"""
  <url>
    <loc>{base}{path}</loc>
    <lastmod>{today}</lastmod>
    <changefreq>{freq}</changefreq>
    <priority>{priority}</priority>
  </url>"""
    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{urls}
</urlset>"""
    return xml, 200, {'Content-Type': 'application/xml; charset=utf-8'}


if __name__ == '__main__':
    print("\n" + "="*60)
    print("  Realtime S Pulse - Stock Market Analytics")
    print("  Open http://localhost:5000 in your browser")
    print("="*60 + "\n")
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('FLASK_ENV', 'development') != 'production'
    app.run(debug=debug, host='0.0.0.0', port=port)
