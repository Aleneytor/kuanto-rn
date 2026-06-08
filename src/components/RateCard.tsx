import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Keyboard, Pressable, Share, StyleSheet, Text, View } from 'react-native';
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
import { PaymentSelectionModal } from './PaymentSelectionModal';
import { type PaymentMethod } from '../constants/banks';

type IconComponent = React.ComponentType<{ size?: number; color?: string }>;
type Source = 'foreign' | 'bs';

interface RateCardProps {
  label: string;
  code: string;
  value: number;
  change: number;
  accent: string;
  icon: IconComponent;
  update: string;
  expanded: boolean;
  onToggle: () => void;
  onCalcFocus?: () => void;
  paymentMethods: PaymentMethod[];
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
  paymentMethods,
}: RateCardProps) {
  const anim = useRef(new Animated.Value(0)).current;
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    Animated.spring(anim, {
      toValue: expanded ? 1 : 0,
      useNativeDriver: false,
      friction: 11,
      tension: 70,
    }).start();
  }, [expanded, anim]);

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

  const [amount, setAmount] = useState<number | null>(1);
  const [source, setSource] = useState<Source>('foreign');
  // `touched` distingue el valor por defecto (1,00) de un monto ya escrito por el usuario.
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (expanded) {
      setSource('foreign');
      setAmount(1);
      setTouched(false);
    } else {
      Keyboard.dismiss();
    }
  }, [expanded]);

  const foreignValue =
    source === 'foreign' ? amount : amount != null && value > 0 ? amount / value : null;
  const bsValue = source === 'bs' ? amount : amount != null ? amount * value : null;

  // Al enfocar: si aún es el valor por defecto, se limpia para escribir directo.
  // Si ya hay un monto escrito, se conserva (solo cambia el campo activo).
  const focusForeign = () => {
    setSource('foreign');
    if (!touched) setAmount(null);
    else if (source !== 'foreign') setAmount(foreignValue);
    onCalcFocus?.();
  };
  const focusBs = () => {
    setSource('bs');
    if (!touched) setAmount(null);
    else if (source !== 'bs') setAmount(bsValue);
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
    setTouched(false);
  };

  const [selectionModalVisible, setSelectionModalVisible] = useState(false);
  const [pendingMethod, setPendingMethod] = useState<PaymentMethod | null | undefined>(undefined);

  useEffect(() => {
    if (pendingMethod !== undefined && !selectionModalVisible) {
      const method = pendingMethod;
      setPendingMethod(undefined);
      const t = setTimeout(() => performShare(method), 500);
      return () => clearTimeout(t);
    }
  }, [selectionModalVisible, pendingMethod]);

  const share = () => {
    if (paymentMethods.length > 0) {
      setSelectionModalVisible(true);
    } else {
      performShare(null);
    }
  };

  const performShare = async (method: PaymentMethod | null) => {
    let message = '';
    if (amount != null) {
      const currencyName = code === 'parallel' ? 'USDT' : code;
      const currencyIcon = code === 'EUR' ? '🇪🇺' : currencyName === 'USDT' ? '🪙' : '🇺🇸';

      message = `💱 *Kuanto*\n\n${currencyIcon} *${formatCurrency(foreignValue ?? 0)} ${currencyName}*  ➡️  🇻🇪 *${formatCurrency(bsValue ?? 0)} Bs*\n\n📊 Tasa: *${formatCurrency(value)} Bs*\n📅 ${update}`;

      if (method) {
        const bankDisplay = `${method.bankName} (${method.bankCode})`;
        const contactInfo =
          method.type === 'pago_movil' ? method.phoneNumber || '' : method.accountNumber || '';
        message += `\n\n*DATOS DE PAGO*`;
        message += `\n*--------------------*`;
        message += `\n${bankDisplay}`;
        message += `\n${method.idPrefix}-${method.holderId}`;
        message += `\n${contactInfo}`;
      }

      message += `\n\n_Enviado desde kuanto.online_ 📲`;
    } else {
      message =
        `💱 *Kuanto*\n\n📊 *${label} (${code})*\n💰 *${formatCurrency(value)} Bs*` +
        (change !== 0 ? ` (${change > 0 ? '+' : ''}${formatChange(change)})` : '') +
        `\n📅 ${update}\n\n_Enviado desde kuanto.online_ 📲`;
    }

    try {
      await Share.share({ message });
    } catch {
      /* usuario canceló */
    }
  };

  // "TASA BCV (USD)" / "TASA BCV (EUR)" / "PROMEDIO (USDT)"
  const headerLabel = `${label.toUpperCase()} (${code})`;

  return (
    <View
      style={[
        styles.card,
        expanded
          ? {
              borderColor: accent + '55',
              shadowColor: accent,
              shadowOpacity: 0.22,
              shadowRadius: 18,
              shadowOffset: { width: 0, height: 0 },
              elevation: 10,
            }
          : { borderColor: accent + '22' },
      ]}
    >
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => (pressed ? styles.cardPressed : null)}
      >
        {/* Top row: icon | label | change badge | share */}
        <View style={styles.topRow}>
          <View style={[styles.iconWrap, { backgroundColor: accent + '1F' }]}>
            <Icon size={20} color={accent} />
          </View>
          <Text style={styles.cardLabel}>{headerLabel}</Text>
          <View style={styles.topRight}>
            {change !== 0 && (
              <View
                style={[
                  styles.changeBadge,
                  { backgroundColor: changeColor + '1F', borderColor: changeColor + '33' },
                ]}
              >
                <ChangeArrow size={11} color={changeColor} />
                <Text style={[styles.changeText, { color: changeColor }]}>
                  {formatChange(change)}
                </Text>
              </View>
            )}
            {!expanded && (
              <Pressable onPress={share} hitSlop={10} style={styles.shareBtn}>
                <Share2 size={17} color={COLORS.textSecondary} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Value */}
        <View style={styles.valueRow}>
          <Text style={[styles.value, { color: accent }]}>{formatCurrency(value)}</Text>
          <Text style={[styles.bsSuffix, { color: accent }]}>Bs.</Text>
        </View>

        {/* Update + chevron */}
        <View style={styles.updateRow}>
          <Text style={styles.update}>Actualizado: {update}</Text>
          <Animated.View style={{ transform: [{ rotate }], opacity: 0.45 }}>
            <ChevronDown size={14} color={COLORS.textSecondary} />
          </Animated.View>
        </View>
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
            {/* Divisa arriba */}
            <View style={styles.calcRow}>
              <Text style={styles.calcUnit}>{code}</Text>
              <FakeCurrencyInput
                value={foreignValue}
                onChangeValue={(v) => {
                  setSource('foreign');
                  setAmount(v);
                  setTouched(true);
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

            <View style={styles.rateHintRow}>
              <View style={styles.rateHintLine} />
              <Text style={styles.rateHint}>1 {code} = Bs {formatCurrency(value)}</Text>
              <View style={styles.rateHintLine} />
            </View>

            {/* Bolívares abajo */}
            <View style={styles.calcRow}>
              <Text style={styles.calcUnit}>Bs</Text>
              <FakeCurrencyInput
                value={bsValue}
                onChangeValue={(v) => {
                  setSource('bs');
                  setAmount(v);
                  setTouched(true);
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

            <View style={styles.actionsDivider} />
            <View style={styles.actionsRow}>
              <Pressable onPress={reset} style={styles.actionBtn} hitSlop={6}>
                <RotateCcw size={15} color={COLORS.textSecondary} />
                <Text style={styles.actionText}>Reiniciar</Text>
              </Pressable>
              <Pressable onPress={share} style={styles.actionBtn} hitSlop={6}>
                <Share2 size={15} color={COLORS.textSecondary} />
                <Text style={styles.actionText}>Compartir</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Animated.View>

      <PaymentSelectionModal
        isVisible={selectionModalVisible}
        paymentMethods={paymentMethods}
        onClose={() => setSelectionModalVisible(false)}
        onSelect={(method) => {
          setPendingMethod(method);
          setSelectionModalVisible(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  cardPressed: {
    opacity: 0.88,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  cardLabel: {
    flex: 1,
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  topRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    gap: 2,
  },
  changeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  shareBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  value: {
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  bsSuffix: {
    fontSize: 20,
    fontWeight: '700',
    marginLeft: 8,
    marginBottom: 2,
    opacity: 0.75,
  },
  updateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  update: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
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
    gap: 24,
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
});
