import { hash01 } from '../common/numbers.js';

/** Highest seeded baseline; stays below the assistant's 85% risk threshold and the 90% flex alert. */
export const BASELINE_FORECAST_MAX = 82;
const BASELINE_FORECAST_MIN = 45;

/**
 * Baseline peak-load forecast for a district (% of capacity), deterministic per district code.
 * Real distribution districts always carry a forecast; the "forecast high" simulation raises one to 92%.
 */
export function baselineForecastPct(districtCode: string): number {
  return BASELINE_FORECAST_MIN + Math.floor(hash01(`${districtCode}:forecast`) * (BASELINE_FORECAST_MAX - BASELINE_FORECAST_MIN + 1));
}
