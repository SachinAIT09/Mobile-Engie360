import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { colors } from '../lib/theme';
import { Txt } from './ui';

export interface BarPoint {
  key: string;
  label: string;
  value: number;
  /** Part of `value` drawn in a second colour on top (e.g. EV charging). */
  stacked?: number;
  /** Comparison value drawn as a thin marker (e.g. last year). */
  compare?: number;
  /** Lighter bar for a period that is still running. */
  partial?: boolean;
  highlight?: boolean;
}

interface BarChartProps {
  points: BarPoint[];
  height?: number;
  color?: string;
  stackedColor?: string;
  /** Second series as a line on its own scale (e.g. the hourly price). */
  line?: number[];
  lineColor?: string;
  /** Show every nth x label; default fits about six. */
  labelEvery?: number;
  /** Describes the chart for screen readers. */
  accessibilityLabel: string;
}

/**
 * Bar chart drawn with react-native-svg (works on web, iOS and Android). Bars share one scale;
 * the optional line has its own. Labels are plain text under the plot.
 */
export function BarChart({ points, height = 150, color = colors.electricity, stackedColor = colors.ev, line, lineColor = colors.navy, labelEvery, accessibilityLabel }: BarChartProps) {
  const [width, setWidth] = React.useState(0);
  const n = points.length;
  const max = Math.max(0.001, ...points.map((p) => Math.max(p.value, p.compare ?? 0)));
  const gap = n > 20 ? 2 : n > 12 ? 3 : 6;
  const barW = n ? Math.max(2, (width - gap * (n - 1)) / n) : 0;
  const every = labelEvery ?? Math.max(1, Math.ceil(n / 6));
  const lineMax = line?.length ? Math.max(...line) : 1;
  const lineMin = line?.length ? Math.min(...line) : 0;
  const ly = (v: number) => 6 + (1 - (v - lineMin) / Math.max(0.0001, lineMax - lineMin)) * (height - 12);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Svg width={width} height={height}>
          {[0.25, 0.5, 0.75].map((f) => (
            <Line key={f} x1={0} x2={width} y1={height * f} y2={height * f} stroke={colors.divider} strokeWidth={1} />
          ))}
          {points.map((p, i) => {
            const x = i * (barW + gap);
            const h = Math.max(2, (p.value / max) * (height - 4));
            const sh = p.stacked ? Math.min(h, (p.stacked / max) * (height - 4)) : 0;
            const r = Math.min(4, barW / 2);
            return (
              <React.Fragment key={p.key}>
                <Rect x={x} y={height - h} width={barW} height={h} rx={r} fill={p.highlight ? colors.brandBlue : color} opacity={p.partial ? 0.45 : 1} />
                {sh > 0 && <Rect x={x} y={height - h} width={barW} height={sh} rx={r} fill={stackedColor} opacity={p.partial ? 0.45 : 1} />}
                {p.compare !== undefined && <Rect x={x} y={height - Math.max(2, (p.compare / max) * (height - 4))} width={barW} height={2} fill={colors.navy} opacity={0.55} />}
              </React.Fragment>
            );
          })}
          {line && line.length === n && n > 1 && (
            <Path
              d={line.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * (barW + gap) + barW / 2).toFixed(1)} ${ly(v).toFixed(1)}`).join(' ')}
              stroke={lineColor}
              strokeWidth={2}
              fill="none"
              strokeLinejoin="round"
            />
          )}
        </Svg>
      )}
      <View style={{ flexDirection: 'row', marginTop: 6 }}>
        {points.map((p, i) => (
          <View key={p.key} style={{ width: barW + (i < n - 1 ? gap : 0), alignItems: 'flex-start' }}>
            {i % every === 0 && (
              <Txt size={10} color={colors.textMuted} numberOfLines={1} style={{ width: 60 }}>
                {p.label}
              </Txt>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

/** Donut with a centre label; segments in the order given. */
export function Donut({ segments, size = 132, stroke = 18, children, accessibilityLabel }: { segments: { key: string; value: number; color: string }[]; size?: number; stroke?: number; children?: React.ReactNode; accessibilityLabel: string }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.divider} strokeWidth={stroke} fill="none" />
        {segments.map((s) => {
          const len = (s.value / total) * c;
          const el = <Circle key={s.key} cx={size / 2} cy={size / 2} r={r} stroke={s.color} strokeWidth={stroke} fill="none" strokeDasharray={`${Math.max(0, len - 1.5)} ${c}`} strokeDashoffset={-offset} />;
          offset += len;
          return el;
        })}
      </Svg>
      {children}
    </View>
  );
}

/** Small filled line for live power (latest value on the right). */
export function Sparkline({ values, height = 56, color = colors.accent }: { values: number[]; height?: number; color?: string }) {
  const [width, setWidth] = React.useState(0);
  const max = Math.max(0.5, ...values);
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const pts = values.map((v, i) => `${(i * step).toFixed(1)} ${(height - 3 - (v / max) * (height - 8)).toFixed(1)}`);
  return (
    <View aria-hidden onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
      {width > 0 && values.length > 1 && (
        <Svg width={width} height={height}>
          <Path d={`M0 ${height} L${pts.join(' L')} L${width} ${height} Z`} fill={color} opacity={0.14} />
          <Path d={`M${pts.join(' L')}`} stroke={color} strokeWidth={2.2} fill="none" strokeLinejoin="round" />
        </Svg>
      )}
    </View>
  );
}

/** Colour per Net2Grid appliance group, shared by the usage and live screens. */
export const APPLIANCE_COLOR: Record<string, string> = {
  ev: colors.ev,
  heatpump: '#E5484D',
  always: '#5A7090',
  laundry: colors.accent,
  cooking: colors.gas,
  media: colors.teal,
  fridge: '#5BC8FF',
  light: colors.solar,
  other: '#B6C2CF',
};
