import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Layers, TrendingUp } from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { formatCurrency } from '../utils/formatting';
import { type Rates } from '../services/rateService';

interface GapCardProps {
  label1: string;
  label2: string;
  value1: number;
  value2: number;
  color: string;
}

function GapCard({ label1, label2, value1, value2, color }: GapCardProps) {
  const diff = Math.abs(value1 - value2);
  const minVal = Math.min(value1, value2);
  const percent = minVal > 0 ? (diff / minVal) * 100 : 0;

  return (
    <View style={styles.gapCard}>
      {/* Premium Glow Effect */}
      <View style={[styles.glowCircle, { backgroundColor: color }]} />

      <View style={styles.topRow}>
        <View style={styles.labelContainer}>
          <Text style={styles.assetLabel}>{label1}</Text>
          <Text style={styles.separator}>↔</Text>
          <Text style={styles.assetLabel}>{label2}</Text>
        </View>

        <View style={styles.badge}>
          <TrendingUp size={13} color={COLORS.positive} strokeWidth={2.5} />
          <Text style={styles.badgeText}>+{percent.toFixed(2).replace('.', ',')}%</Text>
        </View>
      </View>

      <Text style={styles.diffText}>Diferencia:</Text>
      <Text style={[styles.diffValue, { color }]}>Bs {formatCurrency(diff)}</Text>
    </View>
  );
}

interface CurrencyGapProps {
  rates: Rates;
}

export function CurrencyGap({ rates }: CurrencyGapProps) {
  if (!rates || !rates.bcv || !rates.euro || !rates.parallel) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Layers size={18} color={COLORS.textSecondary} />
        <Text style={styles.headerTitle}>Brecha de hoy</Text>
      </View>

      <View style={styles.cardsContainer}>
        <GapCard
          label1="BCV"
          label2="EUR"
          value1={rates.bcv}
          value2={rates.euro}
          color={COLORS.bcvGreen}
        />
        <GapCard
          label1="EUR"
          label2="USDT"
          value1={rates.euro}
          value2={rates.parallel}
          color={COLORS.euroBlue}
        />
        <GapCard
          label1="USDT"
          label2="BCV"
          value1={rates.parallel}
          value2={rates.bcv}
          color={COLORS.parallelOrange}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.divider,
    padding: 18,
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  headerTitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  cardsContainer: {
    gap: 12,
  },
  gapCard: {
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.divider,
    padding: 16,
    position: 'relative',
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  glowCircle: {
    position: 'absolute',
    top: -30,
    right: -30,
    width: 90,
    height: 90,
    borderRadius: 45,
    opacity: 0.08,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  labelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  assetLabel: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
  },
  separator: {
    color: COLORS.textSecondary,
    fontSize: 12,
    opacity: 0.5,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.positive + '1A',
    borderColor: COLORS.positive + '33',
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
    gap: 4,
  },
  badgeText: {
    color: COLORS.positive,
    fontSize: 11,
    fontWeight: '700',
  },
  diffText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 2,
    opacity: 0.7,
  },
  diffValue: {
    fontSize: 20,
    fontWeight: '800',
  },
});
