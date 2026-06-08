import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS } from '../theme/colors';
import { formatChange, formatCurrency } from '../utils/formatting';
import {
  fetchSeriesHistory,
  type HistoryEntry,
  type HistoryPeriod,
  type HistorySeries,
} from '../services/rateService';
import { HistoryChart } from './HistoryChart';

const SERIES: { key: HistorySeries; label: string; accent: string }[] = [
  { key: 'usd', label: 'USD', accent: COLORS.bcvGreen },
  { key: 'eur', label: 'EUR', accent: COLORS.euroBlue },
  { key: 'parallel', label: 'USDT', accent: COLORS.parallelOrange },
];

const PERIODS: { key: HistoryPeriod; label: string }[] = [
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mes' },
  { key: 'year', label: 'Año' },
];

export function HistorySection() {
  const [series, setSeries] = useState<HistorySeries>('usd');
  const [period, setPeriod] = useState<HistoryPeriod>('month');
  const [data, setData] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const accent = SERIES.find((s) => s.key === series)!.accent;
  const periodLabel = PERIODS.find((p) => p.key === period)!.label.toLowerCase();

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchSeriesHistory(series, period)
      .then((d) => mounted && setData(d))
      .catch(() => mounted && setData([]))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [series, period]);

  const last = data.length ? data[data.length - 1].value : 0;
  const first = data.length ? data[0].value : 0;
  const change = first > 0 ? ((last - first) / first) * 100 : 0;
  const changeColor = change >= 0 ? COLORS.positive : COLORS.negative;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Historial</Text>
        <View style={styles.seriesChips}>
          {SERIES.map((s) => {
            const activeS = s.key === series;
            return (
              <Pressable
                key={s.key}
                onPress={() => setSeries(s.key)}
                style={[styles.seriesChip, activeS && { backgroundColor: s.accent + '24' }]}
              >
                <Text style={[styles.seriesChipText, activeS && { color: s.accent }]}>
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.valueRow}>
        <Text style={styles.value}>Bs {formatCurrency(last)}</Text>
        {data.length >= 2 && (
          <Text style={[styles.change, { color: changeColor }]}>
            {formatChange(change)} · {periodLabel}
          </Text>
        )}
      </View>

      <View style={styles.chartWrap}>
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={accent} />
          </View>
        ) : (
          <HistoryChart data={data} color={accent} height={180} />
        )}
      </View>

      <View style={styles.periodRow}>
        {PERIODS.map((p) => {
          const activeP = p.key === period;
          return (
            <Pressable
              key={p.key}
              onPress={() => setPeriod(p.key)}
              style={[styles.periodChip, activeP && styles.periodChipActive]}
            >
              <Text style={[styles.periodText, activeP && styles.periodTextActive]}>
                {p.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.divider,
    padding: 18,
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  seriesChips: {
    flexDirection: 'row',
    gap: 6,
  },
  seriesChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9,
    backgroundColor: COLORS.glass,
  },
  seriesChipText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 14,
  },
  value: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: '700',
  },
  change: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 10,
  },
  chartWrap: {
    marginTop: 12,
    height: 180,
    justifyContent: 'center',
  },
  loading: {
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 4,
    marginTop: 14,
  },
  periodChip: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 9,
  },
  periodChipActive: {
    backgroundColor: COLORS.glassStrong,
  },
  periodText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  periodTextActive: {
    color: COLORS.text,
  },
});
