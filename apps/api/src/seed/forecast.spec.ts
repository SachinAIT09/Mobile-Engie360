import { describe, expect, it } from 'vitest';
import { BASELINE_FORECAST_MAX, baselineForecastPct } from './forecast.js';

describe('baselineForecastPct', () => {
  it('is deterministic and between 45% and the max, below the 85% risk threshold', () => {
    const codes = Array.from({ length: 200 }, (_, i) => String(1000 + i * 37));
    for (const c of codes) {
      const v = baselineForecastPct(c);
      expect(v).toBe(baselineForecastPct(c));
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(45);
      expect(v).toBeLessThanOrEqual(BASELINE_FORECAST_MAX);
    }
    expect(BASELINE_FORECAST_MAX).toBeLessThan(85);
  });
  it('varies between districts', () => {
    const vals = new Set(['3581', '3582', '3583', '3584', '3585', '3571', '3572'].map(baselineForecastPct));
    expect(vals.size).toBeGreaterThan(3);
  });
});
