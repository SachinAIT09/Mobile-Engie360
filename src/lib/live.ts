import { useEffect, useState } from 'react';

export interface LiveReading {
  ts: number;
  watts: number;
  /** Simulated Net2Grid appliance split of `watts`. */
  appliances: { key: string; watts: number }[];
}

/**
 * Simulated real-time power (P1 port / Net2Grid stream), one reading every 2 s.
 * Replace with a WebSocket subscription when a live feed is available.
 */
// Cooking is a short session (~20 s) that starts now and then, not random single spikes.
let cookingTicks = 0;

export function useLivePower(points = 30): { now: LiveReading; history: LiveReading[] } {
  const make = (prev?: number): LiveReading => {
    const base = 205; // always-on
    const fridge = Math.random() < 0.45 ? 95 : 0;
    const media = 140 + Math.round(Math.random() * 30);
    if (cookingTicks > 0) cookingTicks -= 1;
    else if (Math.random() < 0.03) cookingTicks = 10;
    const cooking = cookingTicks > 0 ? 1650 + Math.round(Math.random() * 250) : 0;
    const other = Math.round(120 + Math.random() * 160);
    let watts = base + fridge + media + cooking + other;
    if (prev !== undefined && cooking === 0) watts = Math.round(prev * 0.4 + watts * 0.6);
    return {
      ts: Date.now(),
      watts,
      appliances: [
        { key: 'always', watts: base },
        { key: 'fridge', watts: fridge },
        { key: 'media', watts: media },
        { key: 'cooking', watts: cooking },
        { key: 'other', watts: Math.max(0, watts - base - fridge - media - cooking) },
      ],
    };
  };

  const [history, setHistory] = useState<LiveReading[]>(() => {
    const out: LiveReading[] = [];
    for (let i = 0; i < points; i++) {
      const r = make(out[i - 1]?.watts);
      r.ts = Date.now() - (points - i) * 2000;
      out.push(r);
    }
    return out;
  });

  useEffect(() => {
    const id = setInterval(() => {
      setHistory((h) => [...h.slice(1 - points), make(h[h.length - 1]?.watts)]);
    }, 2000);
    return () => clearInterval(id);
  }, [points]);

  return { now: history[history.length - 1] as LiveReading, history };
}
