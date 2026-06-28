import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarSearch,
  ChevronLeft,
  ChevronRight,
  Share2,
  X,
} from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { formatChange, formatCurrency } from '../utils/formatting';
import { fetchRatesByDate, type DateRates } from '../services/rateService';

interface Props {
  isVisible: boolean;
  onClose: () => void;
}

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const pad = (n: number) => String(n).padStart(2, '0');
const toISO = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/** Hoy en hora de Venezuela (UTC-4). */
function todayVET() {
  const vet = new Date(Date.now() - 4 * 60 * 60 * 1000);
  const y = vet.getUTCFullYear();
  const m = vet.getUTCMonth();
  const d = vet.getUTCDate();
  return { y, m, d, iso: toISO(y, m, d) };
}

function formatLongDate(iso: string): string {
  const [y, m, d] = iso.split('-').map((n) => parseInt(n, 10));
  const dt = new Date(y, m - 1, d);
  return `${DAY_NAMES[dt.getDay()]} ${pad(d)} de ${MONTHS[m - 1]}, ${y}`;
}

export function CalendarModal({ isVisible, onClose }: Props) {
  const today = useMemo(() => todayVET(), []);
  const [viewYear, setViewYear] = useState(today.y);
  const [viewMonth, setViewMonth] = useState(today.m);
  const [selected, setSelected] = useState(today.iso);
  const [result, setResult] = useState<DateRates | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isVisible) {
      setViewYear(today.y);
      setViewMonth(today.m);
      setSelected(today.iso);
      loadDate(today.iso);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isVisible]);

  const loadDate = async (iso: string) => {
    setLoading(true);
    setResult(null);
    try {
      setResult(await fetchRatesByDate(iso));
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const cells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Dom
    const offset = (firstDay + 6) % 7; // semana inicia en Lunes
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const out: (number | null)[] = [];
    for (let i = 0; i < offset; i++) out.push(null);
    for (let d = 1; d <= daysInMonth; d++) out.push(d);
    while (out.length % 7 !== 0) out.push(null);
    return out;
  }, [viewYear, viewMonth]);

  const isCurrentMonth = viewYear === today.y && viewMonth === today.m;

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };
  const nextMonth = () => {
    if (isCurrentMonth) return;
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const onDayPress = (d: number) => {
    const iso = toISO(viewYear, viewMonth, d);
    if (iso > today.iso) return;
    setSelected(iso);
    loadDate(iso);
  };

  const shareHistoricalRates = async () => {
    if (!result) return;
    const longDate = formatLongDate(selected);
    let message = `💱 *Kuanto — Tasas Históricas*\n📅 *${longDate}*\n\n`;
    message += `🇺🇸 *Dólar BCV:* ${formatCurrency(result.usd)} Bs\n`;
    message += `🇪🇺 *Euro BCV:* ${formatCurrency(result.eur)} Bs\n`;
    if (result.parallel != null) {
      message += `🪙 *Paralelo:* ${formatCurrency(result.parallel)} Bs\n`;
    }
    message += `\n_Consultado en kuanto.online_ 📲`;

    try {
      await Share.share({ message });
    } catch {
      /* usuario canceló */
    }
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable style={styles.dismissArea} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <CalendarSearch size={20} color={COLORS.bcvGreen} />
              <Text style={styles.headerTitle}>Buscar por fecha</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
              <X size={20} color={COLORS.text} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Navegación de mes */}
            <View style={styles.monthNav}>
              <Pressable onPress={prevMonth} hitSlop={8} style={styles.navBtn}>
                <ChevronLeft size={22} color={COLORS.text} />
              </Pressable>
              <Text style={styles.monthLabel}>
                {MONTHS[viewMonth]} {viewYear}
              </Text>
              <Pressable
                onPress={nextMonth}
                hitSlop={8}
                style={[styles.navBtn, isCurrentMonth && styles.navBtnDisabled]}
                disabled={isCurrentMonth}
              >
                <ChevronRight
                  size={22}
                  color={isCurrentMonth ? COLORS.textSecondary : COLORS.text}
                />
              </Pressable>
            </View>

            {/* Cabecera de días de la semana */}
            <View style={styles.weekRow}>
              {WEEKDAYS.map((w, i) => (
                <View key={i} style={styles.weekCell}>
                  <Text style={styles.weekText}>{w}</Text>
                </View>
              ))}
            </View>

            {/* Rejilla de días */}
            <View style={styles.grid}>
              {cells.map((d, i) => {
                if (d === null) return <View key={i} style={styles.dayCell} />;
                const iso = toISO(viewYear, viewMonth, d);
                const isFuture = iso > today.iso;
                const isSelected = iso === selected;
                const isToday = iso === today.iso;
                return (
                  <View key={i} style={styles.dayCell}>
                    <Pressable
                      onPress={() => onDayPress(d)}
                      disabled={isFuture}
                      style={[
                        styles.dayBtn,
                        isSelected && styles.daySelected,
                        isToday && !isSelected && styles.dayToday,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          isFuture && styles.dayTextDisabled,
                          isSelected && styles.dayTextSelected,
                          isToday && !isSelected && styles.dayTextToday,
                        ]}
                      >
                        {d}
                      </Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>

            {/* Resultado */}
            <View style={styles.resultBox}>
              <View style={styles.resultHeader}>
                <Text style={styles.resultDate}>{formatLongDate(selected)}</Text>
                {result && result.bcvDate && !loading && (
                  <Pressable onPress={shareHistoricalRates} hitSlop={10} style={styles.shareBtn}>
                    <Share2 size={16} color={COLORS.textSecondary} />
                  </Pressable>
                )}
              </View>

              {loading ? (
                <View style={styles.resultLoading}>
                  <ActivityIndicator color={COLORS.bcvGreen} />
                </View>
              ) : result && result.bcvDate ? (
                <>
                  {!result.isExact && (
                    <Text style={styles.resultNote}>
                      Sin publicación ese día · tasa vigente del {formatShort(result.bcvDate)}
                    </Text>
                  )}
                  <RateRow
                    code="USD"
                    label="Dólar BCV"
                    value={result.usd}
                    change={result.usdChange}
                    accent={COLORS.bcvGreen}
                  />
                  <RateRow
                    code="EUR"
                    label="Euro BCV"
                    value={result.eur}
                    change={result.eurChange}
                    accent={COLORS.euroBlue}
                  />
                  <RateRow
                    code="USDT"
                    label="Paralelo"
                    value={result.parallel ?? 0}
                    accent={COLORS.parallelOrange}
                    empty={result.parallel == null}
                  />
                </>
              ) : (
                <Text style={styles.resultEmpty}>
                  No hay datos registrados para esta fecha.
                </Text>
              )}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function formatShort(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(-2)}`;
}

interface RateRowProps {
  code: string;
  label: string;
  value: number;
  change?: number;
  accent: string;
  empty?: boolean;
}

function RateRow({ code, label, value, change, accent, empty }: RateRowProps) {
  const hasChange = typeof change === 'number' && change !== 0;
  const isUp = (change ?? 0) >= 0;
  const changeColor = isUp ? COLORS.positive : COLORS.negative;
  const Arrow = isUp ? ArrowUpRight : ArrowDownRight;

  return (
    <View style={styles.rateRow}>
      <View style={[styles.rateBadge, { backgroundColor: accent + '1F' }]}>
        <Text style={[styles.rateBadgeText, { color: accent }]}>{code}</Text>
      </View>
      <View style={styles.rateInfo}>
        <Text style={styles.rateLabel}>{label}</Text>
      </View>
      {empty ? (
        <Text style={styles.rateEmpty}>Sin datos</Text>
      ) : (
        <View style={styles.rateRight}>
          <Text style={[styles.rateValue, { color: accent }]}>
            {formatCurrency(value)}
            <Text style={styles.rateUnit}> Bs</Text>
          </Text>
          {hasChange && (
            <View style={styles.rateChangeRow}>
              <Arrow size={11} color={changeColor} />
              <Text style={[styles.rateChange, { color: changeColor }]}>
                {formatChange(change!)}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  dismissArea: {
    flex: 1,
  },
  sheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.divider,
    borderBottomWidth: 0,
    maxHeight: '88%',
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  handle: {
    width: 38,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignSelf: 'center',
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: COLORS.text,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: COLORS.glass,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 8,
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
    marginBottom: 14,
  },
  navBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: {
    opacity: 0.4,
  },
  monthLabel: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekCell: {
    flex: 1,
    alignItems: 'center',
  },
  weekText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.6,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  dayBtn: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySelected: {
    backgroundColor: COLORS.bcvGreen,
  },
  dayToday: {
    borderWidth: 1.5,
    borderColor: COLORS.bcvGreen + '66',
  },
  dayText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  dayTextDisabled: {
    color: COLORS.textSecondary,
    opacity: 0.25,
  },
  dayTextSelected: {
    color: '#0a1a0e',
    fontWeight: '800',
  },
  dayTextToday: {
    color: COLORS.bcvGreen,
    fontWeight: '800',
  },
  resultBox: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.divider,
    padding: 16,
    marginTop: 18,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  resultDate: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  shareBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  resultNote: {
    color: COLORS.parallelOrange,
    fontSize: 12,
    marginBottom: 12,
    marginTop: -4,
  },
  resultLoading: {
    height: 130,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultEmpty: {
    color: COLORS.textSecondary,
    fontSize: 14,
    paddingVertical: 24,
    textAlign: 'center',
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  rateBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 9,
    marginRight: 12,
    minWidth: 52,
    alignItems: 'center',
  },
  rateBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  rateInfo: {
    flex: 1,
  },
  rateLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  rateRight: {
    alignItems: 'flex-end',
  },
  rateValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  rateUnit: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  rateChangeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  rateChange: {
    fontSize: 12,
    fontWeight: '700',
  },
  rateEmpty: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontStyle: 'italic',
    opacity: 0.7,
  },
});
