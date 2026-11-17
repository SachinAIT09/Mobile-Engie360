import { useLive } from '../api/live';
import { useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  BatteryCharging,
  Lightbulb,
  Refrigerator,
  Tv,
  WashingMachine,
  CookingPot,
  Moon,
} from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { tomorrowPrices } from '../data/energy';
import { useLivePower } from '../lib/live';
import { Card, Expander, PageHead } from '../components/ui';
import { useToast } from '../components/toast';
import { clock, planCharging } from '../lib/chargingPlan';
import { useTheme } from '../lib/theme';

export default function SmartEnergy() {
  const { t, num, eur } = useI18n();
  const toast = useToast();
  const { now, history } = useLivePower(40);
  const [kwh, setKwh] = useState(24);
  const [readyBy, setReadyBy] = useState(7);
  const [active, setActive] = useState(false);
  const [allDevices, setAllDevices] = useState(false);
  const { saveCharging } = useLive();
  const { chart: c } = useTheme();
  const plan = useMemo(() => planCharging({ kwh, readyBy, plugInHour: 18, hourPrices: tomorrowPrices.map((p) => p.price) }), [kwh, readyBy]);
  const saving = plan.directCost - plan.smartCost;
  const co2Saved = plan.directCo2Kg - plan.smartCo2Kg;
  const sessionsText = plan.sessions.map((x) => `${clock(x.from)}–${clock(x.to)}`).join(', ');

  const liveData = history.map((h) => ({ ts: new Date(h.ts).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' }), w: h.watts }));
  const appNames: Record<string, [string, string, string]> = {
    always: ['Always-on', 'Sluipverbruik', '#5a7090'],
    fridge: ['Refrigeration', 'Koelen', '#5bc8ff'],
    media: ['Entertainment & IT', 'Entertainment & IT', '#23d2b5'],
    cooking: ['Cooking', 'Koken', '#ff8a3d'],
    other: ['Other', 'Overig', '#b6c2cf'],
  };

  const devices = [
    { icon: BatteryCharging, name: t('EV charger', 'Laadpaal'), since: t('Detected 28 Aug 2026', 'Herkend 28 aug 2026'), share: '25%', conf: 97, isNew: true },
    { icon: WashingMachine, name: t('Washing machine & dryer', 'Wasmachine & droger'), since: t('9 cycles this month', '9 wasbeurten deze maand'), share: '12%', conf: 94 },
    { icon: CookingPot, name: t('Electric cooking', 'Elektrisch koken'), since: t('Induction hob, oven', 'Inductie, oven'), share: '11%', conf: 91 },
    { icon: Tv, name: t('Entertainment & IT', 'Entertainment & IT'), since: t('TV, router, computers', 'Tv, router, computers'), share: '10%', conf: 88 },
    { icon: Refrigerator, name: t('Refrigeration', 'Koelen & vriezen'), since: t('Fridge-freezer, ~11 yrs old', 'Koel-vriescombinatie, ~11 jaar oud'), share: '9%', conf: 92 },
    { icon: Lightbulb, name: t('Lighting', 'Verlichting'), since: t('Mostly LED', 'Grotendeels led'), share: '7%', conf: 80 },
  ];

  return (
    <>
      <PageHead
        eyebrow={t('Smart Energy', 'Slimme Energie')}
        title={t('Your home right now', 'Je woning op dit moment')}
        sub={t('Live power, your appliances and smart charging.', 'Live vermogen, je apparaten en slim laden.')}
      />

      <Card
        title={
          <span className="row">
            {t('Live power', 'Live vermogen')} <span className="live">{t('Live', 'Live')}</span>
          </span>
        }
        sub={t('Updated every 2 seconds', 'Elke 2 seconden bijgewerkt')}
        action={
          <span className="num" style={{ fontSize: 30, fontWeight: 900 }}>
            {num(now.watts)} <span className="small muted">W</span>
          </span>
        }
      >
        <div style={{ height: 150 }}>
          <ResponsiveContainer>
            <AreaChart data={liveData} margin={{ top: 6, right: 4, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="liveFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00aaff" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#00aaff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="ts" hide />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: c.tick }} width={56} tickFormatter={(v: number) => (v >= 1000 ? `${num(v / 1000, 1)} kW` : `${v} W`)} />
              <Tooltip content={({ active, payload }) => (active && payload?.[0] ? <div className="chart-tip">{num(Number(payload[0].value))} W</div> : null)} />
              <Area type="monotone" dataKey="w" stroke="#00aaff" strokeWidth={2.5} fill="url(#liveFill)" isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="row wrap mt-s" style={{ gap: 8 }}>
          {now.appliances
            .filter((a) => a.watts > 0)
            .map((a) => {
              const n = appNames[a.key]!;
              return (
                <span key={a.key} className="badge neutral" style={{ gap: 6 }}>
                  <i style={{ width: 8, height: 8, borderRadius: 2, background: n[2], display: 'inline-block' }} />
                  {t(n[0], n[1])} · <span className="num">{num(a.watts)} W</span>
                </span>
              );
            })}
        </div>
      </Card>

      <Card
        className="mt"
        title={
          <span className="row">
            <BatteryCharging size={20} color="#7b61ff" /> {t('Smart EV charging', 'Slim laden')}
          </span>
        }
        sub={t('Charge in the cheapest hours of your dynamic tariff, ready when you need the car.', 'Laad in de goedkoopste uren van je dynamische tarief, klaar wanneer je de auto nodig hebt.')}
        action={
          <label className="row small strong" style={{ cursor: 'pointer' }}>
            <button
              className={`switch${active ? ' on' : ''}`}
              role="switch"
              aria-checked={active}
              aria-label={t('Smart charging', 'Slim laden')}
              onClick={() => {
                setActive(!active);
                saveCharging({ active: !active, kwh, readyBy });
                toast(active ? t('Smart charging paused', 'Slim laden gepauzeerd') : t('Smart charging scheduled for tonight', 'Slim laden ingepland voor vannacht'));
              }}
            />
            {active ? t('Active tonight', 'Actief vannacht') : t('Off', 'Uit')}
          </label>
        }
      >
        <div className="stack" style={{ gap: 10 }}>
          <label className="field">
            <span className="row between">
              {t('Energy to add', 'Te laden energie')} <span className="num">{kwh} kWh ≈ {Math.round(kwh * 6)} km</span>
            </span>
            <input type="range" min={6} max={40} value={kwh} onChange={(e) => setKwh(Number(e.target.value))} />
          </label>
          <label className="field" style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            {t('Ready by', 'Klaar om')}
            <select className="input" style={{ width: 'auto' }} value={readyBy} onChange={(e) => setReadyBy(Number(e.target.value))}>
              {[6, 7, 8, 9].map((h) => (
                <option key={h} value={h}>
                  {String(h).padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="mt">
          <div style={{ height: 170 }}>
            <ResponsiveContainer>
              <BarChart data={plan.window.map((b) => ({ t: clock(b.start), price: b.price, co2: b.co2, on: b.charging }))} margin={{ top: 6, right: 4, left: -14, bottom: 0 }} barCategoryGap={1}>
                <XAxis dataKey="t" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: c.tick }} interval={7} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: c.tick }} width={50} tickFormatter={(v: number) => `€${v.toFixed(2)}`} />
                <Tooltip
                  cursor={{ fill: c.cursor }}
                  content={({ active: a, payload }) =>
                    a && payload?.[0] ? (
                      <div className="chart-tip">
                        <b>{String(payload[0].payload.t)}</b>
                        {eur(Number(payload[0].value), 3)}/kWh · {num(Number(payload[0].payload.co2))} g CO₂
                        {payload[0].payload.on ? <div style={{ color: '#c9bfff' }}>{t('Charging', 'Laden')}</div> : null}
                      </div>
                    ) : null
                  }
                />
                <Bar dataKey="price" radius={[3, 3, 1, 1]}>
                  {plan.window.map((b) => (
                    <Cell key={b.start} fill={b.charging ? '#7b61ff' : c.track} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-legend mt-s">
            <span>
              <i style={{ background: '#7b61ff' }} />
              {t('Planned charging (15-min blocks)', 'Gepland laden (kwartierblokken)')}
            </span>
            <span>
              <i style={{ background: c.track }} />
              {t('Day-ahead price per quarter hour', 'Day-ahead prijs per kwartier')}
            </span>
          </div>
          <p className="small mt-s">
            <b>{t('Charges', 'Laadt')}</b> {sessionsText} · <span className="muted">{t(`${num(plan.deliveredKwh, 1)} kWh by`, `${num(plan.deliveredKwh, 1)} kWh om`)} {clock(readyBy * 60)}</span>
          </p>
        </div>
        <div className="card flat mt" style={{ background: 'var(--purple-50)', border: 0, padding: 14 }}>
          <dl className="kv">
            <dt>{t('Charge on plug-in (18:00)', 'Direct laden (18:00)')}</dt>
            <dd className="num">{eur(plan.directCost)}</dd>
            <dt>{t('Smart charging', 'Slim laden')}</dt>
            <dd className="num">{eur(plan.smartCost)}</dd>
            <dt className="strong" style={{ color: 'var(--ink)' }}>
              {t('You save tonight', 'Je bespaart vannacht')}
            </dt>
            <dd className="num down" style={{ fontSize: 18 }}>
              {eur(saving)}
            </dd>
            <dt>{t('Less CO₂', 'Minder CO₂')}</dt>
            <dd className="num down">
              {num(co2Saved, 1)} kg ({Math.round((co2Saved / plan.directCo2Kg) * 100)}%)
            </dd>
          </dl>
          <p className="xs muted mt-s">
            {t('Based on tonight’s prices. Over a full year, with day-to-day price swings, smart charging saves you about €142.', 'Op basis van de prijzen van vannacht. Over een heel jaar, met wisselende dagprijzen, bespaar je met slim laden zo’n €142.')}
          </p>
        </div>
      </Card>

      <Card className="mt" title={t('Recognised in your home', 'Herkend in je woning')} sub={t('Share of October electricity', 'Aandeel stroom oktober')}>
        <div className="list">
          {(allDevices ? devices : devices.slice(0, 3)).map((d) => (
            <div key={d.name} className="list-row" style={{ padding: '9px 0' }}>
              <span className={`kpi-ic ${d.isNew ? 'pur' : 'el'}`} style={{ width: 34, height: 34 }}>
                <d.icon size={17} />
              </span>
              <div className="grow">
                <div className="small strong row" style={{ gap: 6 }}>
                  {d.name} {d.isNew && <span className="badge pur xs">{t('New', 'Nieuw')}</span>}
                </div>
                <div className="xs muted">{d.since}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="small strong num">{d.share}</div>
                <div className="xs muted num">{d.conf}% {t('conf.', 'zeker')}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setAllDevices(!allDevices)} aria-expanded={allDevices}>
            {allDevices ? t('Show less', 'Toon minder') : t(`Show all ${devices.length}`, `Toon alle ${devices.length}`)}
          </button>
        </div>
      </Card>

      <div className="mt">
        <Expander title={t('Anomaly detection', 'Afwijkingsdetectie')} meta={<span className="badge warn">{t('1 open', '1 open')}</span>}>
          <div className="list">
            {[
              { icon: Moon, tone: 'gas', title: t('Unusual night-time use', 'Ongebruikelijk nachtverbruik'), meta: t('11 Nov · 01:40–04:10 · 1.4 kW', '11 nov · 01:40–04:10 · 1,4 kW'), badge: <span className="badge warn">{t('Open', 'Open')}</span> },
              { icon: BatteryCharging, tone: 'pur', title: t('New appliance: EV charger', 'Nieuw apparaat: laadpaal'), meta: t('28 Aug · 3.3 kW sessions', '28 aug · sessies van 3,3 kW'), badge: <span className="badge ok">{t('Confirmed', 'Bevestigd')}</span> },
              { icon: Refrigerator, tone: 'el', title: t('Fridge cycling more often', 'Koelkast slaat vaker aan'), meta: t('Since Sep · +18% vs summer', 'Sinds sep · +18% vs zomer'), badge: <span className="badge neutral">{t('Watching', 'Volgen')}</span> },
            ].map((a) => (
              <div key={a.title} className="list-row">
                <span className={`kpi-ic ${a.tone}`} style={{ width: 34, height: 34 }}>
                  <a.icon size={17} />
                </span>
                <div className="grow">
                  <div className="small strong">{a.title}</div>
                  <div className="xs muted">{a.meta}</div>
                </div>
                {a.badge}
              </div>
            ))}
          </div>
        </Expander>
      </div>

    </>
  );
}
