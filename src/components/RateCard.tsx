import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { FakeCurrencyInput } from 'react-native-currency-input';
import {
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Copy,
  RotateCcw,
  Share2,
} from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { formatChange, formatCurrency } from '../utils/formatting';

type IconComponent = React.ComponentType<{ size?: number; color?: string }>;
type Source = 'foreign' | 'bs';

interface RateCardProps {
  label: string;
  /** Sigla, p. ej. "USD", "EUR", "USDT". */
  code: string;
  /** Tasa en Bs por unidad de la divisa. */
  value: number;
  change: number;
  /** Color de acento de marca. */
  accent: string;
  icon: IconComponent;
  update: string;
  expanded: boolean;
  onToggle: () => void;
  /** Se llama cuando el usuario enfoca un campo de la calculadora (para centrar la tarjeta). */
  onCalcFocus?: () => void;
}

export function RateCard({
  label,
  code,
  value,
  change,
  accent,
  icon: Icon,
  update,
  expanded,
  onToggle,
  onCalcFocus,
}: RateCardProps) {
  const anim = useRef(new Animated.Value(0)).current;
  const [contentHeight, setContentHeight] = useState(0);

  // Despliegue suave (spring). El teclado NO se abre solo: solo al tocar un campo.
  useEffect(() => {
    Animated.spring(anim, {
      toValue: expanded ? 1 : 0,
      useNativeDriver: false,
      friction: 11,
      tension: 70,
    }).start();
  }, [expanded, anim]);

  // Interpolaciones memorizadas: estables entre re-renders.
  const height = useMemo(
    () => anim.interpolate({ inputRange: [0, 1], outputRange: [0, contentHeight] }),
    [anim, contentHeight],
  );
  const rotate = useMemo(
    () => anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }),
    [anim],
  );

  const isUp = change >= 0;
  const changeColor = isUp ? COLORS.positive : COLORS.negative;
  const ChangeArrow = isUp ? ArrowUpRight : ArrowDownRight;

  // --- Calculadora de dos campos (divisa arriba, Bs abajo) ---
  // `amount` es el valor del campo activo (`source`); el otro se calcula.
  const [amount, setAmount] = useState<number | null>(1);
  const [source, setSource] = useState<Source>('foreign');

  // Al abrir la tarjeta, la calculadora arranca en 1,00 de la divisa.
  useEffect(() => {
    if (expanded) {
      setSource('foreign');
      setAmount(1);
    }
  }, [expanded]);

  const foreignValue =
    source === 'foreign' ? amount : amount != null && value > 0 ? amount / value : null;
  const bsValue = source === 'bs' ? amount : amount != null ? amount * value : null;

  const focusForeign = () => {
    if (source !== 'foreign') {
      setSource('foreign');
      setAmount(foreignValue);
    }
    onCalcFocus?.();
  };
  const focusBs = () => {
    if (source !== 'bs') {
      setSource('bs');
      setAmount(bsValue);
    }
    onCalcFocus?.();
  };

  const [copied, setCopied] = useState<Source | null>(null);
  const copyValue = async (which: Source) => {
    const val = which === 'foreign' ? foreignValue : bsValue;
    await Clipboard.setStringAsync(formatCurrency(val ?? 0));
    setCopied(which);
    setTimeout(() => setCopied((c) => (c === which ? null : c)), 1200);
  };

  const reset = () => {
    setSource('foreign');
    setAmount(1);
  };

  const share = async () => {
    const message =
      amount != null
        ? `${label} (${code})\n${formatCurrency(foreignValue ?? 0)} ${code} = Bs ${formatCurrency(bsValue ?? 0)}\n(1 ${code} = Bs ${formatCurrency(value)})\n— vía Kuanto`
        : `${label}: 1 ${code} = Bs ${formatCurrency(value)}\n— vía Kuanto`;
    try {
      await Share.share({ message });
    } catch {
      /* el usuario canceló */
    }
  };

  return (
    <View
      style={[
        styles.card,
        expanded
          ? {
              borderColor: accent + '66',
              shadowColor: accent,
              shadowOpacity: 0.3,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 0 },
              elevation: 10,
            }
          : { borderColor: accent + '26' },
      ]}
    >
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => (pressed ? styles.headerPressed : null)}
      >
        <View style={styles.header}>
          <View style={[styles.iconWrap, { backgroundColor: accent + '1F' }]}>
            <Icon size={22} color={accent} />
          </View>
          <View style={styles.titleWrap}>
            <Text style={styles.label}>{label}</Text>
            <Text style={styles.code}>{code}</Text>
          </View>
          {change !== 0 && (
            <View style={[styles.changeBadge, { backgroundColor: changeColor + '1F' }]}>
              <ChangeArrow size={13} color={changeColor} />
              <Text style={[styles.changeText, { color: changeColor }]}>
                {formatChange(change)}
              </Text>
            </View>
          )}
          <Animated.View style={[styles.chevron, { transform: [{ rotate }] }]}>
            <ChevronDown size={20} color={COLORS.textSecondary} />
          </Animated.View>
        </View>

        <View style={styles.valueRow}>
          <Text style={styles.currencySymbol}>Bs</Text>
          <Text style={styles.value}>{formatCurrency(value)}</Text>
        </View>
        <Text style={styles.update}>Actualizado: {update}</Text>
      </Pressable>

      {/* Calculadora desplegable */}
      <Animated.View style={[styles.calcClip, { height, opacity: anim }]}>
        <View
          style={styles.calcMeasure}
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (h > 0 && Math.abs(h - contentHeight) > 1) setContentHeight(h);
          }}
        >
          <View style={styles.divider} />

          <View style={styles.calcBox}>
            {/* Divisa (siempre arriba) */}
            <View style={styles.calcRow}>
              <Text style={styles.calcUnit}>{code}</Text>
              <FakeCurrencyInput
                value={foreignValue}
                onChangeValue={(v) => {
                  setSource('foreign');
                  setAmount(v);
                }}
                onFocus={focusForeign}
                precision={2}
                delimiter="."
                separator=","
                minValue={0}
                placeholder="0,00"
                placeholderTextColor={COLORS.textSecondary}
                caretColor={accent}
                keyboardType="number-pad"
                containerStyle={styles.calcInputContainer}
                style={[
                  styles.calcInput,
                  { color: source === 'foreign' ? COLORS.text : accent },
                ]}
              />
              <Pressable onPress={() => copyValue('foreign')} hitSlop={8} style={styles.copyBtn}>
                {copied === 'foreign' ? (
                  <Check size={18} color={accent} />
                ) : (
                  <Copy size={18} color={COLORS.textSecondary} />
                )}
              </Pressable>
            </View>

            {/* Tasa por unidad (separador informativo) */}
            <View style={styles.rateHintRow}>
              <View style={styles.rateHintLine} />
              <Text style={styles.rateHint}>
                1 {code} = Bs {formatCurrency(value)}
              </Text>
              <View style={styles.rateHintLine} />
            </View>

            {/* Bolívares (siempre abajo) */}
            <View style={styles.calcRow}>
              <Text style={styles.calcUnit}>Bs</Text>
              <FakeCurrencyInput
                value={bsValue}
                onChangeValue={(v) => {
                  setSource('bs');
                  setAmount(v);
                }}
                onFocus={focusBs}
                precision={2}
                delimiter="."
                separator=","
                minValue={0}
                placeholder="0,00"
                placeholderTextColor={COLORS.textSecondary}
                caretColor={accent}
                keyboardType="number-pad"
                containerStyle={styles.calcInputContainer}
                style={[
                  styles.calcInput,
                  { color: source === 'bs' ? COLORS.text : accent },
                ]}
              />
              <Pressable onPress={() => copyValue('bs')} hitSlop={8} style={styles.copyBtn}>
                {copied === 'bs' ? (
                  <Check size={18} color={accent} />
                ) : (
                  <Copy size={18} color={COLORS.textSecondary} />
                )}
              </Pressable>
            </View>

            {/* Acciones */}
            <View style={styles.actionsDivider} />
            <View style={styles.actionsRow}>
              <Pressable onPress={reset} style={styles.actionBtn} hitSlop={6}>
                <RotateCcw size={16} color={COLORS.textSecondary} />
                <Text style={styles.actionText}>Reiniciar</Text>
              </Pressable>
              <View style={styles.actionsSep} />
              <Pressable onPress={share} style={styles.actionBtn} hitSlop={6}>
                <Share2 size={16} color={accent} />
                <Text style={[styles.actionText, { color: accent }]}>Compartir</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  headerPressed: {
    opacity: 0.85,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
    marginLeft: 12,
  },
  label: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  code: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 1,
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  changeText: {
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 2,
  },
  chevron: {
    marginLeft: 10,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 16,
  },
  currencySymbol: {
    color: COLORS.textSecondary,
    fontSize: 18,
    fontWeight: '600',
    marginRight: 6,
  },
  value: {
    color: COLORS.text,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  update: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 10,
  },
  // Calculadora
  calcClip: {
    overflow: 'hidden',
  },
  calcMeasure: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginTop: 16,
    marginBottom: 16,
  },
  calcBox: {
    backgroundColor: COLORS.glass,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  calcRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  calcUnit: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  calcInputContainer: {
    flex: 1,
    alignItems: 'flex-end',
  },
  calcInput: {
    fontSize: 28,
    fontWeight: '700',
  },
  rateHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 6,
  },
  rateHintLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.divider,
  },
  rateHint: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginHorizontal: 10,
  },
  copyBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
    backgroundColor: COLORS.card,
  },
  actionsDivider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginTop: 14,
    marginBottom: 6,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  actionText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  actionsSep: {
    width: 1,
    height: 18,
    backgroundColor: COLORS.divider,
  },
});
