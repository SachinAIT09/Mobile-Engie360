import { Bar, CartesianGrid, Cell, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { UsagePoint } from '../data/energy';
import { useI18n } from '../lib/i18n';
import { useTheme } from '../lib/theme';

export type Metric = 'electricity' | 'gas';

interface Props {
  data: UsagePoint[];
  metric: Metric;
  compare?: boolean;
  /** Overlay the dynamic hourly price (hour view). */
  showPrice?: boolean;
  /** Split electricity bars into EV charging vs the rest. */
  showEv?: boolean;
  height?: number;
  compareLabel?: string;
}

const SERIES = {
  electricity: { main: '#00aaff', soft: { light: '#bfe6fb', dark: '#1d4a6e' } },
  gas: { main: '#ff8a3d', soft: { light: '#ffd7bd', dark: '#5a3418' } },
};

export function UsageChart({ data, metric, compare = true, showPrice = false, showEv = false, height = 280, compareLabel }: Props) {
  const { tx, num, eur, t } = useI18n();
  const unit = metric === 'electricity' ? 'kWh' : 'm³';
  const { theme, chart: c } = useTheme();
  const series = { main: SERIES[metric].main, soft: SERIES[metric].soft[theme] };
  const ev = showEv && metric === 'electricity';
  const digits = data.length === 24 ? 2 : data.length > 20 ? 1 : 0;

  const rows = data.map((d) => ({
    name: tx(d.label),
    value: d[metric],
    base: ev ? Math.max(0, d.electricity - (d.ev ?? 0)) : d[metric],
    ev: ev ? (d.ev ?? 0) : 0,
    prev: metric === 'electricity' ? d.prevElectricity : d.prevGas,
    price: d.price,
    forecast: d.forecast,
  }));

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <ComposedChart data={rows} margin={{ top: 8, right: showPrice ? 4 : 8, left: -14, bottom: 0 }} barCategoryGap={data.length > 20 ? '18%' : '28%'}>
          <CartesianGrid vertical={false} stroke={c.grid} />
          <XAxis
            dataKey="name"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: c.tick }}
            interval="preserveStartEnd"
            minTickGap={10}
          />
          <YAxis yAxisId="u" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: c.tick }} width={48} tickFormatter={(v: number) => num(v, v < 10 && v % 1 ? 1 : 0)} />
          {showPrice && (
            <YAxis yAxisId="p" orientation="right" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: '#7b61ff' }} width={44} tickFormatter={(v: number) => `€${v.toFixed(2)}`} domain={[0.1, 0.45]} />
          )}
          <Tooltip
            cursor={{ fill: c.cursor }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const r = payload[0]?.payload as (typeof rows)[number];
              return (
                <div className="chart-tip">
                  <b>
                    {label}
                    {r.forecast ? ` · ${t('so far', 'tot nu toe')}` : ''}
                  </b>
                  <div>
                    {num(r.value, digits)} {unit}
                  </div>
                  {ev && r.ev > 0 && (
                    <div style={{ color: '#c9bfff' }}>
                      {t('EV charging', 'Auto laden')}: {num(r.ev, digits)} {unit}
                    </div>
                  )}
                  {compare && r.prev !== undefined && (
                    <div style={{ opacity: 0.75 }}>
                      {compareLabel ?? t('Previous', 'Vorige')}: {num(r.prev, digits)} {unit}
                    </div>
                  )}
                  {showPrice && r.price !== undefined && (
                    <div style={{ color: '#c9bfff' }}>
                      {t('Price', 'Prijs')}: {eur(r.price)}/kWh
                    </div>
                  )}
                </div>
              );
            }}
          />
          <Bar yAxisId="u" dataKey="base" stackId="a" radius={ev ? [0, 0, 3, 3] : [5, 5, 3, 3]} animationDuration={600}>
            {rows.map((r) => (
              <Cell key={r.name} fill={r.forecast ? series.soft : series.main} />
            ))}
          </Bar>
          {ev && <Bar yAxisId="u" dataKey="ev" stackId="a" fill="#7b61ff" radius={[5, 5, 0, 0]} animationDuration={600} />}
          {compare && <Line yAxisId="u" type="monotone" dataKey="prev" stroke={c.ink} strokeOpacity={0.55} strokeDasharray="4 4" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />}
          {showPrice && <Line yAxisId="p" type="stepAfter" dataKey="price" stroke="#7b61ff" strokeWidth={2} dot={false} />}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ChartLegend({ metric, compare, compareLabel, ev, price, forecast }: { metric: Metric; compare?: boolean; compareLabel?: string; ev?: boolean; price?: boolean; forecast?: boolean }) {
  const { t } = useI18n();
  const { theme } = useTheme();
  const c = { main: SERIES[metric].main, soft: SERIES[metric].soft[theme] };
  return (
    <div className="chart-legend">
      <span>
        <i style={{ background: c.main }} />
        {metric === 'electricity' ? t('Electricity', 'Stroom') : t('Gas', 'Gas')}
      </span>
      {ev && metric === 'electricity' && (
        <span>
          <i style={{ background: '#7b61ff' }} />
          {t('EV charging', 'Auto laden')}
        </span>
      )}
      {compare && (
        <span>
          <i style={{ background: 'transparent', border: '2px dashed var(--ink)', opacity: 0.6, height: 0, width: 14, borderRadius: 0, verticalAlign: 3 }} />
          {compareLabel ?? t('Previous period', 'Vorige periode')}
        </span>
      )}
      {price && (
        <span>
          <i style={{ background: '#7b61ff', height: 3, width: 14, verticalAlign: 3 }} />
          {t('Hourly price', 'Uurprijs')}
        </span>
      )}
      {forecast && (
        <span>
          <i style={{ background: c.soft }} />
          {t('In progress', 'Lopend')}
        </span>
      )}
    </div>
  );
}
