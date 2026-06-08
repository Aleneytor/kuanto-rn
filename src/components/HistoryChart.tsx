import React, { useState } from 'react';
import { type LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { COLORS } from '../theme/colors';
import { formatCurrency } from '../utils/formatting';
import type { HistoryEntry } from '../services/rateService';

interface Props {
  data: HistoryEntry[];
  color: string;
  height?: number;
}

const PAD_TOP = 18;
const PAD_BOTTOM = 18;

type Point = { x: number; y: number };

/** Convierte puntos en un path con curva suave (Catmull-Rom → Bézier). */
function smoothPath(points: Point[]): string {
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function formatDateLabel(date: string): string {
  const [, m, d] = date.split('-');
  return `${d}/${m}`;
}

export function HistoryChart({ data, color, height = 180 }: Props) {
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - width) > 1) setWidth(w);
  };

  if (data.length < 2) {
    return (
      <View style={[styles.empty, { height }]} onLayout={onLayout}>
        <Text style={styles.emptyText}>Sin datos suficientes para el gráfico.</Text>
      </View>
    );
  }

  const values = data.map((d) => d.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const plotH = height - PAD_TOP - PAD_BOTTOM;
  const n = data.length;

  const points: Point[] = data.map((d, i) => ({
    x: width > 0 ? (i / (n - 1)) * width : 0,
    y: PAD_TOP + (1 - (d.value - min) / range) * plotH,
  }));

  const linePath = smoothPath(points);
  const areaPath =
    width > 0 && linePath
      ? `${linePath} L ${points[n - 1].x} ${height} L ${points[0].x} ${height} Z`
      : '';

  const gradId = `grad-${color.replace('#', '')}`;

  const handleTouch = (locationX: number) => {
    if (width <= 0) return;
    const idx = Math.round((locationX / width) * (n - 1));
    setActive(Math.max(0, Math.min(n - 1, idx)));
  };

  const activePoint = active != null ? points[active] : null;
  const activeData = active != null ? data[active] : null;

  return (
    <View
      onLayout={onLayout}
      style={{ height }}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderGrant={(e) => handleTouch(e.nativeEvent.locationX)}
      onResponderMove={(e) => handleTouch(e.nativeEvent.locationX)}
      onResponderRelease={() => setActive(null)}
      onResponderTerminate={() => setActive(null)}
    >
      {width > 0 && (
        <Svg width={width} height={height}>
          <Defs>
            <LinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} stopOpacity={0.35} />
              <Stop offset="1" stopColor={color} stopOpacity={0} />
            </LinearGradient>
          </Defs>

          {areaPath ? <Path d={areaPath} fill={`url(#${gradId})`} /> : null}
          <Path d={linePath} stroke={color} strokeWidth={2.5} fill="none" />

          {activePoint ? (
            <>
              <Line
                x1={activePoint.x}
                y1={PAD_TOP - 6}
                x2={activePoint.x}
                y2={height}
                stroke={COLORS.textSecondary}
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <Circle
                cx={activePoint.x}
                cy={activePoint.y}
                r={5}
                fill={color}
                stroke={COLORS.background}
                strokeWidth={2}
              />
            </>
          ) : (
            <Circle cx={points[n - 1].x} cy={points[n - 1].y} r={4} fill={color} />
          )}
        </Svg>
      )}

      {activeData && activePoint && (
        <View
          style={[
            styles.tooltip,
            { left: Math.max(0, Math.min(activePoint.x - 62, width - 124)) },
          ]}
        >
          <Text style={styles.tooltipValue}>Bs {formatCurrency(activeData.value)}</Text>
          <Text style={styles.tooltipDate}>{formatDateLabel(activeData.date)}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  tooltip: {
    position: 'absolute',
    top: 0,
    width: 124,
    backgroundColor: COLORS.cardElevated,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  tooltipValue: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  tooltipDate: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
});
