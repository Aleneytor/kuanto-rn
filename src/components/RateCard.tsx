import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { FakeCurrencyInput } from 'react-native-currency-input';
import {
  ArrowLeftRight,
  ArrowDownRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Copy,
  RotateCcw,
  Share2,
} from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { FONTS } from '../theme/typography';
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
  futureNotice?: {
    label: string;
    prefix: string;
    dateLabel: string;
  };
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
  futureNotice,
}: RateCardProps) {
  const anim = useRef(new Animated.Value(0)).current;
  const [contentHeight, setContentHeight] = useState(0);
  const foreignInputRef = useRef<TextInput>(null);
  const bsInputRef = useRef<TextInput>(null);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: expanded ? 1 : 0,
      duration: expanded ? 320 : 240,
      easing: expanded ? Easing.out(Easing.cubic) : Easing.inOut(Easing.cubic),
      useNativeDriver: false,
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
  const contentOpacity = useMemo(
    () => anim.interpolate({ inputRange: [0, 0.35, 1], outputRange: [0, 0.72, 1] }),
    [anim],
  );
  const contentTranslateY = useMemo(
    () => anim.interpolate({ inputRange: [0, 1], outputRange: [-6, 0] }),
    [anim],
  );
  const contentScale = useMemo(
    () => anim.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }),
    [anim],
  );

  const isUp = change >= 0;
  const changeColor = isUp ? COLORS.positive : COLORS.negative;
  const ChangeArrow = isUp ? ArrowUpRight : ArrowDownRight;

  const [amount, setAmount] = useState<number | null>(1);
  const [source, setSource] = useState<Source>('foreign');

  useEffect(() => {
    if (expanded) {
      setSource('foreign');
      setAmount(1);
    } else {
      Keyboard.dismiss();
    }
  }, [expanded]);

  const foreignValue =
    source === 'foreign' ? amount : amount != null && value > 0 ? amount / value : null;
  const bsValue = source === 'bs' ? amount : amount != null ? amount * value : null;

  const focusForeign = () => {
    if (source !== 'foreign') setAmount(foreignValue);
    setSource('foreign');
    onCalcFocus?.();
  };
  const focusBs = () => {
    if (source !== 'bs') setAmount(bsValue);
    setSource('bs');
    onCalcFocus?.();
  };
  const focusForeignInput = () => {
    focusForeign();
    foreignInputRef.current?.focus();
  };
  const focusBsInput = () => {
    focusBs();
    bsInputRef.current?.focus();
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

  const [selectionModalVisible, setSelectionModalVisible] = useState(false);
  // Método elegido pendiente de compartir mientras el modal de selección se
  // cierra. `undefined` = nada pendiente; `null` = "Sin datos de pago"; objeto =
  // método. En iOS el share sheet (UIActivityViewController) NO puede presentarse
  // mientras el Modal nativo sigue en pantalla o en transición, así que se
  // dispara en `onDismiss` (cuando terminó de cerrarse), con un timeout de
  // respaldo. Usamos un ref (no estado) para no re-renderizar ni cancelarlo.
  const pendingShareRef = useRef<PaymentMethod | null | undefined>(undefined);

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

  // Dispara el share que quedó pendiente al cerrarse el modal de selección.
  // Idempotente: limpia el ref antes de compartir, así onDismiss y el timeout de
  // respaldo no provocan un doble share.
  const firePendingShare = () => {
    const method = pendingShareRef.current;
    pendingShareRef.current = undefined;
    if (method !== undefined) performShare(method);
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

        {futureNotice && (
          <View style={styles.futureNotice}>
            <Text style={[styles.futureNoticeLabel, { color: accent }]}>
              {futureNotice.label}
            </Text>
          </View>
        )}

        {/* Update + chevron */}
        <View style={styles.updateRow}>
          <Text style={styles.update}>Actualizado: {update}</Text>
          <Animated.View style={{ transform: [{ rotate }], opacity: 0.45 }}>
            <ChevronDown size={14} color={COLORS.textSecondary} />
          </Animated.View>
        </View>
      </Pressable>

      {/* Calculadora desplegable */}
      <Animated.View style={[styles.calcClip, { height, opacity: contentOpacity }]}>
        <Animated.View
          style={[
            styles.calcMeasure,
            { transform: [{ translateY: contentTranslateY }, { scale: contentScale }] },
          ]}
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
              <Pressable
                onPress={focusForeignInput}
                onLongPress={focusForeignInput}
                delayLongPress={120}
                style={({ pressed }) => [
                  styles.calcInputPressable,
                  pressed ? styles.calcInputPressed : null,
                ]}
              >
                <FakeCurrencyInput
                  ref={foreignInputRef}
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
                  contextMenuHidden
                  disableKeyboardShortcuts
                  selectTextOnFocus={false}
                  selectionColor={accent}
                  autoComplete="off"
                  autoCorrect={false}
                  spellCheck={false}
                  textContentType="none"
                  importantForAutofill="no"
                  pointerEvents="none"
                  keyboardType="number-pad"
                  containerStyle={styles.calcInputContainer}
                  style={[
                    styles.calcInput,
                    { color: source === 'foreign' ? COLORS.text : accent },
                  ]}
                />
              </Pressable>
              <Pressable onPress={() => copyValue('foreign')} hitSlop={8} style={styles.copyBtn}>
                {copied === 'foreign' ? (
                  <Check size={18} color={accent} />
                ) : (
                  <Copy size={18} color={COLORS.textSecondary} />
                )}
              </Pressable>
            </View>

            <View style={styles.swapRow}>
              <View style={styles.swapLine} />
              <View style={[styles.swapButton, { borderColor: accent + '40' }]}>
                <ArrowLeftRight size={15} color={COLORS.textSecondary} />
              </View>
              <View style={styles.swapLine} />
            </View>

            {/* Bolívares abajo */}
            <View style={styles.calcRow}>
              <Text style={styles.calcUnit}>VES</Text>
              <Pressable
                onPress={focusBsInput}
                onLongPress={focusBsInput}
                delayLongPress={120}
                style={({ pressed }) => [
                  styles.calcInputPressable,
                  pressed ? styles.calcInputPressed : null,
                ]}
              >
                <FakeCurrencyInput
                  ref={bsInputRef}
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
                  contextMenuHidden
                  disableKeyboardShortcuts
                  selectTextOnFocus={false}
                  selectionColor={accent}
                  autoComplete="off"
                  autoCorrect={false}
                  spellCheck={false}
                  textContentType="none"
                  importantForAutofill="no"
                  pointerEvents="none"
                  keyboardType="number-pad"
                  containerStyle={styles.calcInputContainer}
                  style={[
                    styles.calcInput,
                    { color: source === 'bs' ? COLORS.text : accent },
                  ]}
                />
              </Pressable>
              <Pressable onPress={() => copyValue('bs')} hitSlop={8} style={styles.copyBtn}>
                {copied === 'bs' ? (
                  <Check size={18} color={accent} />
                ) : (
                  <Copy size={18} color={COLORS.textSecondary} />
                )}
              </Pressable>
            </View>
          </View>

          <View style={styles.actionsRow}>
            <Pressable onPress={reset} style={styles.actionBtn} hitSlop={6}>
              <RotateCcw size={16} color={COLORS.textSecondary} />
              <Text style={styles.actionText}>Reiniciar</Text>
            </Pressable>
            <View style={styles.actionsDivider} />
            <Pressable onPress={share} style={styles.actionBtn} hitSlop={6}>
              <Share2 size={16} color={accent} />
              <Text style={[styles.actionText, { color: accent }]}>Compartir</Text>
            </Pressable>
          </View>
        </Animated.View>
      </Animated.View>

      <PaymentSelectionModal
        isVisible={selectionModalVisible}
        paymentMethods={paymentMethods}
        onClose={() => setSelectionModalVisible(false)}
        onSelect={(method) => {
          pendingShareRef.current = method;
          // iOS: el share aparece en onDismiss (al terminar de cerrarse el
          // modal). El timeout es red de seguridad por si onDismiss no llega.
          // Android no tiene ese conflicto: comparte en cuanto cierra.
          setTimeout(firePendingShare, Platform.OS === 'ios' ? 600 : 60);
        }}
        onDismiss={firePendingShare}
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
    fontFamily: FONTS.semiBold,
    fontSize: 13,
    letterSpacing: 0.1,
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
    fontFamily: FONTS.semiBold,
    fontSize: 12,
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
    fontFamily: FONTS.bold,
    fontSize: 38,
    letterSpacing: 0,
    lineHeight: 44,
  },
  bsSuffix: {
    fontFamily: FONTS.bold,
    fontSize: 12,
    marginLeft: 3,
    marginBottom: 5,
  },
  futureNotice: {
    marginTop: -7,
    marginBottom: 9,
  },
  futureNoticeLabel: {
    fontFamily: FONTS.bold,
    fontSize: 15,
    lineHeight: 17,
  },
  updateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  update: {
    fontFamily: FONTS.semiBold,
    color: COLORS.textSecondary,
    fontSize: 11,
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
    marginTop: 12,
    marginBottom: 12,
  },
  calcBox: {
    backgroundColor: 'rgba(0,0,0,0.16)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.035)',
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  calcRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 42,
  },
  calcUnit: {
    fontFamily: FONTS.semiBold,
    color: COLORS.textSecondary,
    fontSize: 14,
    letterSpacing: 0.1,
    width: 44,
  },
  calcInputContainer: {
    width: '100%',
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  calcInputPressable: {
    flex: 1,
    minHeight: 42,
    borderRadius: 14,
    justifyContent: 'center',
  },
  calcInputPressed: {
    opacity: 0.72,
  },
  calcInput: {
    fontFamily: FONTS.semiBold,
    fontSize: 21,
    lineHeight: 28,
    includeFontPadding: false,
  },
  swapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
    marginVertical: 3,
  },
  swapLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.divider,
  },
  swapButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderWidth: 1,
  },
  copyBtn: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    backgroundColor: 'rgba(255,255,255,0.055)',
  },
  actionsDivider: {
    width: 1,
    height: 22,
    backgroundColor: COLORS.divider,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
    paddingTop: 14,
    paddingBottom: 2,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  actionText: {
    fontFamily: FONTS.semiBold,
    color: COLORS.textSecondary,
    fontSize: 14,
    marginLeft: 6,
  },
});
