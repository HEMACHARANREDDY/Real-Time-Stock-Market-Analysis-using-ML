#!/usr/bin/env python
"""Test ML engine directly"""

import traceback
from ml_engine import StockMLEngine

print("=" * 60)
print("Testing ML Engine Predictions")
print("=" * 60)

engine = StockMLEngine()

try:
    print("\n[1] Requesting AAPL prediction with 30-day forecast...")
    result = engine.predict('AAPL', 30)
    print("✓ SUCCESS: ML prediction returned data")
    print(f"  - Best model: {result.get('best_model')}")
    print(f"  - Current price: {result.get('current_price')}")
    print(f"  - Forecast days: {len(result.get('future', []))}")
    print(f"  - Test dates: {len(result.get('test_dates', []))}")
    print(f"  - Models trained: {len(result.get('models', {}))}")
    
except Exception as e:
    print(f"\n✗ ERROR: {type(e).__name__}: {e}")
    print("\nFull traceback:")
    traceback.print_exc()

print("\n" + "=" * 60)
