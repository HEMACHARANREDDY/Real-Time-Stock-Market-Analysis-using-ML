#!/usr/bin/env python
"""Test complete Flask prediction flow"""

import traceback
from ml_engine import StockMLEngine
import sys
sys.path.insert(0, 'c:\\Users\\Administrator\\Desktop\\Stock_Analysis_Project')

print("=" * 60)
print("Testing Complete Prediction Flow")
print("=" * 60)

# Import the conversion function from app.py
try:
    from app import convert_prediction_to_inr, _build_prediction_fallback
    print("\n[OK] Successfully imported app functions")
except Exception as e:
    print(f"\n[ERROR] Failed to import app: {e}")
    traceback.print_exc()
    sys.exit(1)

engine = StockMLEngine()

try:
    print("\n[1] Getting ML prediction...")
    result = engine.predict('AAPL', 30)
    print(f"[OK] ML prediction received: {result.get('current_price')} INR")
    
    print("\n[2] Converting to INR...")
    converted = convert_prediction_to_inr(result, 'AAPL')
    print(f"[OK] Conversion successful: {converted.get('current_price')} INR")
    print(f"  - Best model: {converted.get('best_model')}")
    print(f"  - Forecasts: {len(converted.get('future', []))} days")
    
    is_stale = converted.get('is_stale', False)
    warning = converted.get('warning', '')
    print(f"  - Is stale: {is_stale}")
    if warning:
        print(f"  - Warning: {warning}")
    
except Exception as e:
    print(f"\n[ERROR] during conversion: {type(e).__name__}: {e}")
    traceback.print_exc()

print("\n" + "=" * 60)
