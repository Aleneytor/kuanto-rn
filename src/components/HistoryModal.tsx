import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  AlertTriangle,
  Calendar,
  CalendarSearch,
  ChevronLeft,
  Download,
  History,
  X,
} from 'lucide-react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../theme/colors';
import { formatCurrency } from '../utils/formatting';
import {
  fetchHistoricalRates,
  fetchUsdtDailyAverages,
  type HistoryPoint,
  type UsdtHistoryPoint,
} from '../services/rateService';
import { fetchAndPrepareExportData, exportToExcel } from '../services/exportService';

const { height: SCREEN_H } = Dimensions.get('window');

// El historial se cachea para abrir al instante; se refresca en segundo plano si
// pasaron más de CACHE_TTL. Solo se piden ~LIST_DAYS días (la lista muestra 14).
const HISTORY_CACHE_KEY = '@history_modal_cache';
const HISTORY_CACHE_TTL = 15 * 60 * 1000; // 15 min
const LIST_DAYS = 21;

/** Fecha (YYYY-MM-DD, hora de Venezuela) de hace LIST_DAYS días, para acotar la consulta. */
function listFromDateISO(): string {
  const d = new Date(Date.now() - 4 * 60 * 60 * 1000);
  d.setDate(d.getDate() - LIST_DAYS);
  return d.toISOString().split('T')[0];
}

interface HistoryModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenCalendar?: () => void;
}

interface UnifiedHistoryItem {
  date: string;
  usd: number | null;
  eur: number | null;
  usdt: number | null;
}

function mergeHistoryRows(
  bcv: HistoryPoint[],
  usdt: UsdtHistoryPoint[]
): UnifiedHistoryItem[] {
  const unified: Record<string, UnifiedHistoryItem> = {};

  bcv.forEach((item) => {
    const dateStr = item.date.split('T')[0];
    unified[dateStr] = { date: dateStr, usd: item.usd, eur: item.eur, usdt: null };
  });

  usdt.forEach((item) => {
    if (unified[item.date]) {
      unified[item.date].usdt = item.usdt;
    } else {
      unified[item.date] = { date: item.date, usd: null, eur: null, usdt: item.usdt };
    }
  });

  return Object.values(unified).sort((a, b) => b.date.localeCompare(a.date));
}

export function HistoryModal({ visible, onClose, onOpenCalendar }: HistoryModalProps) {
  // View State: 'list' | 'export'
  const [view, setView] = useState<'list' | 'export'>('list');

  // Unified history data
  const [historyData, setHistoryData] = useState<UnifiedHistoryItem[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  const [usdtLoading, setUsdtLoading] = useState(false);

  // Export State
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d;
  });
  const [endDate, setEndDate] = useState(new Date());
  const [exportLoading, setExportLoading] = useState(false);
  const [progressStep, setProgressStep] = useState('');
  const [showPicker, setShowPicker] = useState<'start' | 'end' | null>(null);

  // Animation states
  const anim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  const loadRunRef = useRef(0);

  // Sync visibility and trigger native animations
  useEffect(() => {
    if (visible) {
      setMounted(true);
      setView('list');
      setExportLoading(false);
      setProgressStep('');
      loadHistory();
      Animated.timing(anim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else if (mounted) {
      loadRunRef.current += 1;
      setUsdtLoading(false);
      Animated.timing(anim, {
        toValue: 0,
        duration: 240,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible]);

  // Carga el historial: muestra el caché al instante y refresca en segundo plano
  // (tras la animación de apertura) solo si está vencido. Evita el spinner y la
  // espera a Supabase en cada apertura.
  const loadHistory = async () => {
    const runId = ++loadRunRef.current;
    const isCurrentRun = () => runId === loadRunRef.current;
    setUsdtLoading(false);
    let hadCache = false;
    try {
      const raw = await AsyncStorage.getItem(HISTORY_CACHE_KEY);
      if (raw) {
        const cached = JSON.parse(raw) as { items: UnifiedHistoryItem[]; cachedAt: number };
        if (cached?.items?.length) {
          if (!isCurrentRun()) return;
          setHistoryData(cached.items);
          setDataLoading(false);
          hadCache = true;
          // Caché reciente: no volvemos a pedir a Supabase.
          if (Date.now() - cached.cachedAt < HISTORY_CACHE_TTL) return;
        }
      }
    } catch {
      /* caché corrupto: se ignora y se recarga */
    }

    if (!hadCache) setDataLoading(true);

    // Refrescar tras la animación de apertura (~300 ms), para no competir con ella.
    await new Promise<void>((resolve) => setTimeout(resolve, 320));
    if (!isCurrentRun()) return;

    try {
      const fromDate = listFromDateISO();
      const bcv = await fetchHistoricalRates('month', fromDate);
      if (!isCurrentRun()) return;

      const bcvOnly = mergeHistoryRows(bcv, []);
      if (!hadCache && bcvOnly.length) {
        setHistoryData(bcvOnly);
        setDataLoading(false);
        AsyncStorage.setItem(
          HISTORY_CACHE_KEY,
          JSON.stringify({ items: bcvOnly, cachedAt: 0 })
        ).catch(() => {});
      }

      setUsdtLoading(true);
      const usdt = await fetchUsdtDailyAverages('month', fromDate);
      if (!isCurrentRun()) return;

      const sorted = mergeHistoryRows(bcv, usdt);
      setHistoryData(sorted);
      AsyncStorage.setItem(
        HISTORY_CACHE_KEY,
        JSON.stringify({ items: sorted, cachedAt: Date.now() })
      ).catch(() => {});
    } catch (error) {
      console.error('[HistoryModal] Error loading history:', error);
      if (!hadCache) {
        alert('Error al cargar el historial: ' + (error instanceof Error ? error.message : String(error)));
      }
    } finally {
      if (isCurrentRun()) {
        setDataLoading(false);
        setUsdtLoading(false);
      }
    }
  };

  // Limit preview list to 14 days
  const filteredData = useMemo(() => historyData.slice(0, 14), [historyData]);

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString + 'T00:00:00'); // Force local time
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().substring(2);
    return `${day}/${month}/${year}`;
  };

  const handleDownload = async () => {
    if (startDate > endDate) {
      alert('La fecha de inicio no puede ser mayor a la final');
      return;
    }

    setExportLoading(true);
    setProgressStep('Obteniendo datos...');

    try {
      const data = await fetchAndPrepareExportData(startDate, endDate);

      if (data.length === 0) {
        alert('No hay datos disponibles para este rango');
        setExportLoading(false);
        return;
      }

      setProgressStep('Generando Excel...');
      await exportToExcel(data);

      onClose();
    } catch (error) {
      console.error(error);
      alert('Error al generar el archivo');
    } finally {
      setExportLoading(false);
      setProgressStep('');
    }
  };

  if (!mounted) return null;

  // Backdrop opacity fade-in [0, 1]
  const backdropOpacity = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.6],
  });

  // Slide-up for card on mobile [300, 0], scale for web [0.95, 1]
  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [Platform.OS === 'web' ? 0 : 300, 0],
  });

  const scale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [Platform.OS === 'web' ? 0.95 : 1, 1],
  });

  const renderDateInput = (
    label: string,
    date: Date,
    setDate: (d: Date) => void,
    type: 'start' | 'end'
  ) => {
    return (
      <View style={styles.dateField}>
        <Text style={styles.dateLabel}>{label}</Text>
        {Platform.OS === 'web' ? (
          <View style={styles.dateButton}>
            <Calendar size={18} color={COLORS.text} style={{ marginRight: 8 }} />
            <Text style={styles.dateText}>{date.toLocaleDateString('es-VE')}</Text>
            <input
              type="date"
              value={date.toISOString().split('T')[0]}
              onChange={(e) => setDate(new Date(e.target.value))}
              max={new Date().toISOString().split('T')[0]}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: 'pointer',
                zIndex: 10,
              }}
            />
          </View>
        ) : (
          <View>
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => setShowPicker(type)}
              style={styles.dateButton}
            >
              <Calendar size={18} color={COLORS.text} style={{ marginRight: 8 }} />
              <Text style={styles.dateText}>{date.toLocaleDateString('es-VE')}</Text>
            </TouchableOpacity>
            {showPicker === type && (
              <DateTimePicker
                value={date}
                mode="date"
                display="default"
                maximumDate={new Date()}
                minimumDate={new Date(2020, 0, 1)}
                onChange={(event, selectedDate) => {
                  setShowPicker(null);
                  if (selectedDate) setDate(selectedDate);
                }}
              />
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Backdrop */}
        <Animated.View
          style={[styles.backdrop, { opacity: backdropOpacity }]}
          pointerEvents="auto"
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        {/* Card */}
        <Animated.View
          style={[
            styles.card,
            {
              transform: [{ translateY }, { scale }],
              maxHeight: SCREEN_H * 0.85,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              {view === 'export' ? (
                <>
                  <TouchableOpacity onPress={() => setView('list')} style={styles.backBtn}>
                    <ChevronLeft size={24} color={COLORS.text} />
                  </TouchableOpacity>
                  <Text style={styles.title}>Exportar Excel</Text>
                </>
              ) : (
                <>
                  <History size={20} color={COLORS.textSecondary} />
                  <Text style={styles.title}>HISTORIAL DE PRECIOS</Text>
                </>
              )}
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={COLORS.text} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.body}>
            {view === 'list' ? (
              dataLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={COLORS.bcvGreen} />
                  <Text style={styles.loadingText}>Cargando historial...</Text>
                </View>
              ) : (
                <View style={{ flex: 1 }}>
                  {/* Table Header */}
                  <View style={styles.tableHeader}>
                    <View style={[styles.columnHeader, { flex: 0.8 }]}>
                      <Text style={styles.headerText}>FECHA</Text>
                    </View>
                    <View style={[styles.columnHeader, { flex: 1, alignItems: 'flex-end' }]}>
                      <Text style={[styles.headerText, { color: COLORS.bcvGreen }]}>USD BCV</Text>
                    </View>
                    <View style={[styles.columnHeader, { flex: 1, alignItems: 'flex-end' }]}>
                      <Text style={[styles.headerText, { color: COLORS.euroBlue }]}>EUR BCV</Text>
                    </View>
                    <View style={[styles.columnHeader, { flex: 1, alignItems: 'flex-end' }]}>
                      <View style={styles.usdtHeader}>
                        {usdtLoading && (
                          <ActivityIndicator size="small" color={COLORS.parallelOrange} />
                        )}
                        <Text style={[styles.headerText, { color: COLORS.parallelOrange }]}>USDT</Text>
                      </View>
                    </View>
                  </View>

                  {/* Table Rows */}
                  <FlatList
                    data={filteredData}
                    keyExtractor={(item) => item.date}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item, index }) => (
                      <View
                        style={[
                          styles.row,
                          index % 2 !== 0 && { backgroundColor: 'rgba(255,255,255,0.015)' },
                        ]}
                      >
                        <View style={[styles.cell, { flex: 0.8 }]}>
                          <Text style={styles.dateTextCell}>{formatDate(item.date)}</Text>
                        </View>
                        <View style={[styles.cell, { flex: 1, alignItems: 'flex-end' }]}>
                          <Text style={[styles.valueText, { color: COLORS.bcvGreen }]}>
                            {item.usd ? formatCurrency(item.usd) : '—'}
                          </Text>
                        </View>
                        <View style={[styles.cell, { flex: 1, alignItems: 'flex-end' }]}>
                          <Text style={[styles.valueText, { color: COLORS.euroBlue }]}>
                            {item.eur ? formatCurrency(item.eur) : '—'}
                          </Text>
                        </View>
                        <View style={[styles.cell, { flex: 1, alignItems: 'flex-end' }]}>
                          <Text style={[styles.valueText, { color: COLORS.parallelOrange }]}>
                            {item.usdt ? formatCurrency(item.usdt) : '—'}
                          </Text>
                        </View>
                      </View>
                    )}
                    ListFooterComponent={() =>
                      historyData.length > 14 && onOpenCalendar ? (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => {
                            onClose();
                            setTimeout(() => {
                              onOpenCalendar();
                            }, 300);
                          }}
                          style={styles.moreHistoryButton}
                        >
                          <CalendarSearch size={24} color={COLORS.textSecondary} opacity={0.7} />
                          <Text style={styles.moreHistoryText}>
                            Presiona aquí para buscar por fecha específica en el calendario
                          </Text>
                        </TouchableOpacity>
                      ) : null
                    }
                  />
                </View>
              )
            ) : (
              <ScrollView style={styles.exportForm}>
                <View style={styles.warningBox}>
                  <AlertTriangle size={18} color={COLORS.parallelOrange} style={{ marginTop: 2 }} />
                  <Text style={styles.warningText}>
                    El reporte de exportación incluirá el consolidado diario de tasas BCV (USD/EUR) y
                    promedio USDT de las fechas seleccionadas.
                  </Text>
                </View>

                <View style={styles.dateInputsGroup}>
                  {renderDateInput('Desde', startDate, setStartDate, 'start')}
                  {renderDateInput('Hasta', endDate, setEndDate, 'end')}
                </View>
              </ScrollView>
            )}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            {view === 'list' ? (
              <TouchableOpacity
                onPress={() => setView('export')}
                style={[styles.downloadButton, { backgroundColor: COLORS.bcvGreen }]}
                activeOpacity={0.8}
                disabled={dataLoading}
              >
                <Download size={18} color="#0a1a0e" style={{ marginRight: 8 }} />
                <Text style={styles.downloadButtonText}>Descargar Historial en Excel</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleDownload}
                disabled={exportLoading}
                style={[
                  styles.downloadButton,
                  { backgroundColor: COLORS.bcvGreen, opacity: exportLoading ? 0.7 : 1 },
                ]}
                activeOpacity={0.8}
              >
                {exportLoading ? (
                  <View style={styles.progressRow}>
                    <ActivityIndicator size="small" color="#0a1a0e" style={{ marginRight: 8 }} />
                    <Text style={styles.downloadButtonText}>{progressStep}</Text>
                  </View>
                ) : (
                  <>
                    <Download size={18} color="#0a1a0e" style={{ marginRight: 8 }} />
                    <Text style={styles.downloadButtonText}>Generar y Descargar</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  card: {
    width: '100%',
    maxWidth: 500,
    height: Platform.OS === 'web' ? 'auto' : SCREEN_H * 0.7,
    backgroundColor: COLORS.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.divider,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  backBtn: {
    padding: 4,
    marginRight: 4,
  },
  title: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  closeBtn: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  body: {
    flex: 1,
    minHeight: 250,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 12,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    backgroundColor: 'rgba(255,255,255,0.02)',
  },
  columnHeader: {
    justifyContent: 'center',
  },
  headerText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    opacity: 0.8,
    letterSpacing: 0.5,
  },
  usdtHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
  },
  listContent: {
    paddingBottom: 16,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    alignItems: 'center',
  },
  cell: {
    justifyContent: 'center',
  },
  dateTextCell: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  valueText: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  moreHistoryButton: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  moreHistoryText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    opacity: 0.8,
  },
  exportForm: {
    flex: 1,
    padding: 20,
  },
  warningBox: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    marginBottom: 24,
    backgroundColor: 'rgba(255, 149, 0, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 149, 0, 0.15)',
  },
  warningText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
    color: COLORS.textSecondary,
  },
  dateInputsGroup: {
    gap: 18,
  },
  dateField: {
    gap: 8,
  },
  dateLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.divider,
    height: 52,
    backgroundColor: COLORS.glass,
    position: 'relative',
  },
  dateText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    backgroundColor: 'rgba(255,255,255,0.01)',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    width: '100%',
  },
  downloadButtonText: {
    color: '#0a1a0e',
    fontSize: 15,
    fontWeight: '800',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
