import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Activity } from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { FONTS } from '../theme/typography';
import { formatChange, formatCurrency } from '../utils/formatting';
import {
  fetchSeriesHistory,
  type HistoryEntry,
  type HistoryPeriod,
  type HistorySeries,
} from '../services/rateService';
import { HistoryChart } from './HistoryChart';

const SERIES: { key: HistorySeries; label: string; accent: string }[] = [
  { key: 'usd', label: 'BCV USD', accent: COLORS.bcvGreen },
  { key: 'eur', label: 'BCV EUR', accent: COLORS.euroBlue },
  { key: 'parallel', label: 'USDT', accent: COLORS.parallelOrange },
];

const PERIODS: { key: HistoryPeriod; label: string }[] = [
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mes' },
  { key: 'year', label: 'Año' },
];

interface Props {
  futureRates?: {
    date: string;
    usd: number;
    eur: number;
  } | null;
}

export function HistorySection({ futureRates }: Props) {
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

  const displayData = useMemo(() => {
    if (!futureRates || series === 'parallel') return data;

    const futureValue = series === 'usd' ? futureRates.usd : futureRates.eur;
    return [
      ...data.filter((point) => point.date !== futureRates.date),
      { date: futureRates.date, value: futureValue },
    ].sort((a, b) => a.date.localeCompare(b.date));
  }, [data, futureRates, series]);

  const last = displayData.length ? displayData[displayData.length - 1].value : 0;
  const first = displayData.length ? displayData[0].value : 0;
  const change = first > 0 ? ((last - first) / first) * 100 : 0;
  const changeColor = change >= 0 ? COLORS.positive : COLORS.negative;

  return (
    <View style={styles.card}>
      <View style={styles.titleRow}>
        <Activity size={15} color={COLORS.textSecondary} />
        <Text style={styles.title}>ACTIVIDAD HISTÓRICA</Text>
      </View>

      <View style={styles.seriesRow}>
        {SERIES.map((s) => {
          const activeS = s.key === series;
          return (
            <Pressable
              key={s.key}
              onPress={() => setSeries(s.key)}
              style={[styles.seriesChip, activeS && { backgroundColor: s.accent }]}
            >
              <Text style={[styles.seriesChipText, activeS && styles.seriesChipTextActive]}>
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.valueRow}>
        <Text style={styles.value}>Bs {formatCurrency(last)}</Text>
        {displayData.length >= 2 && (
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
          <HistoryChart data={displayData} color={accent} height={180} />
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontFamily: FONTS.semiBold,
    color: COLORS.textSecondary,
    fontSize: 11,
    letterSpacing: 0.2,
  },
  seriesRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.background,
    borderRadius: 12,
    padding: 4,
    marginTop: 14,
    gap: 4,
  },
  seriesChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 9,
  },
  seriesChipText: {
    fontFamily: FONTS.semiBold,
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  seriesChipTextActive: {
    color: '#0a1a0e',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 14,
  },
  value: {
    fontFamily: FONTS.semiBold,
    color: COLORS.text,
    fontSize: 24,
  },
  change: {
    fontFamily: FONTS.medium,
    fontSize: 13,
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
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  periodTextActive: {
    color: COLORS.text,
  },
});
