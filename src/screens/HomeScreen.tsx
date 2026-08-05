import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
  type LayoutChangeEvent,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { CalendarClock, CalendarSearch, DollarSign, Euro, Menu, WifiOff } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../theme/colors';
import { FONTS } from '../theme/typography';
import { useRates } from '../context/RatesContext';
import { RateCard } from '../components/RateCard';
import { UsdtIcon } from '../components/UsdtIcon';
import { HistorySection } from '../components/HistorySection';
import { HeaderMenu, type MenuKey } from '../components/HeaderMenu';
import { SectionModal } from '../components/SectionModal';
import { CalendarModal } from '../components/CalendarModal';
import { HistoryModal } from '../components/HistoryModal';
import { CoachMark } from '../components/CoachMark';
import { SourcesScreen } from './SourcesScreen';
import { PagoMovilScreen } from './PagoMovilScreen';
import { type PaymentMethod } from '../constants/banks';
import { CurrencyGap } from '../components/CurrencyGap';
import { SettingsScreen } from './SettingsScreen';
import { NotificationPrompt } from '../components/NotificationPrompt';
import { AdBanner } from '../components/AdBanner';
import {
  addNotificationTapHandler,
  requestPermissions,
  scheduleUsdtReminders,
  registerForBcvPush,
  KEY_USDT,
  KEY_BCV,
} from '../services/notificationService';

type CardKey = 'bcv' | 'euro' | 'parallel';
type SectionKey = MenuKey | 'fuentes' | 'history';

const SECTION_TITLES: Record<SectionKey, string> = {
  fuentes: 'Fuentes',
  pago: 'Mis datos',
  ajustes: 'Ajustes',
  history: 'Historial completo',
};

// Versionada: al rediseñar el tutorial se incrementa el sufijo para que vuelva a
// mostrarse una vez a quienes ya completaron una versión anterior.
const ONBOARDING_KEY = '@kuanto/onboarding_done_v3';
const NOTIF_PROMPT_KEY = '@kuanto/notif_prompt_v1';

function getTodayVetISO(): string {
  const vet = new Date(Date.now() - 4 * 60 * 60 * 1000);
  return vet.toISOString().split('T')[0];
}

function addDaysISO(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split('-').map((n) => parseInt(n, 10));
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().split('T')[0];
}

export function HomeScreen() {
  const { rates, loading, isStale, error, refresh } = useRates();
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<CardKey | null>(null);
  const [dateMode, setDateMode] = useState<'today' | 'next'>('today');
  const [menuOpen, setMenuOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [section, setSection] = useState<SectionKey | null>(null);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [pagoInitialMode, setPagoInitialMode] = useState<'list' | 'form'>('list');
  const [pagoEditingId, setPagoEditingId] = useState<string | null>(null);
  const [onboardingActive, setOnboardingActive] = useState(false);
  const [notifPromptVisible, setNotifPromptVisible] = useState(false);
  const insets = useSafeAreaInsets();

  const scrollRef = useRef<any>(null);
  const cardY = useRef<Record<CardKey, number>>({ bcv: 0, euro: 0, parallel: 0 });
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  useEffect(() => {
    loadPaymentMethods();
  }, []);

  // Tutorial flotante (coach-marks): solo en el primer arranque.
  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY)
      .then((done) => {
        if (!done) setOnboardingActive(true);
      })
      .catch(() => {});
  }, []);

  // Aviso de notificaciones (priming): solo la 1ª vez y si aún no activó nada.
  useEffect(() => {
    (async () => {
      const [asked, usdt, bcv] = await Promise.all([
        AsyncStorage.getItem(NOTIF_PROMPT_KEY),
        AsyncStorage.getItem(KEY_USDT),
        AsyncStorage.getItem(KEY_BCV),
      ]);
      if (!asked && usdt !== 'true' && bcv !== 'true') setNotifPromptVisible(true);
    })().catch(() => {});
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.2, duration: 950, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 950, useNativeDriver: true }),
      ])
    ).start();
  }, [pulseAnim]);

  // Tocar una notificación (recordatorio USDT / push del BCV) refresca las tasas.
  useEffect(() => {
    const unsub = addNotificationTapHandler(() => refreshRef.current());
    return unsub;
  }, []);

  const loadPaymentMethods = async () => {
    try {
      const json = await AsyncStorage.getItem('@payment_methods_data');
      setPaymentMethods(json ? JSON.parse(json) : []);
    } catch (err) {
      console.error('Error loading payment methods:', err);
    }
  };

  const closePagoModal = () => {
    setSection(null);
    setPagoInitialMode('list');
    setPagoEditingId(null);
  };

  const closeSectionModal = () => {
    // Fuentes e Historial se abren desde Ajustes → al volver, regresan a Ajustes.
    if (section === 'fuentes' || section === 'history') {
      setSection('ajustes');
      return;
    }
    closePagoModal();
  };

  // El Historial es una sección del SectionModal (como Mis datos): solo cambiamos
  // de sección, sin abrir un segundo modal → sin carreras ni pantallas negras.
  const openHistoryFromSettings = () => {
    setSection('history');
  };

  const openSourcesFromSettings = () => {
    setSection('fuentes');
  };

  const finishOnboarding = () => {
    AsyncStorage.setItem(ONBOARDING_KEY, 'true').catch(() => {});
    setOnboardingActive(false);
  };

  const acceptNotifications = async () => {
    setNotifPromptVisible(false);
    try {
      await AsyncStorage.setItem(NOTIF_PROMPT_KEY, 'true');
      const granted = await requestPermissions();
      if (granted) {
        await AsyncStorage.multiSet([
          [KEY_USDT, 'true'],
          [KEY_BCV, 'true'],
        ]);
        await scheduleUsdtReminders();
        await registerForBcvPush();
      }
    } catch (err) {
      console.warn('[Notif] aceptar prompt:', err);
    }
  };

  const declineNotifications = () => {
    setNotifPromptVisible(false);
    AsyncStorage.setItem(NOTIF_PROMPT_KEY, 'true').catch(() => {});
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const scrollCardIntoView = (key: CardKey) => {
    scrollRef.current?.scrollTo({
      y: Math.max(cardY.current[key] - 12, 0),
      animated: true,
    });
  };

  const toggle = (key: CardKey) =>
    setExpanded((cur) => {
      const next = cur === key ? null : key;
      // Reubicar la vista en la tarjeta tanto al abrir como al cerrar, para que
      // el usuario no quede "perdido" cuando el contenido se reacomoda al colapsar.
      setTimeout(() => scrollCardIntoView(key), next ? 300 : 220);
      return next;
    });

  const registerY = (key: CardKey) => (e: LayoutChangeEvent) => {
    cardY.current[key] = e.nativeEvent.layout.y;
  };

  const hasFuture = !!rates?.nextRates;
  const useFuture = dateMode === 'next' && hasFuture;

  const usdValue = useFuture ? rates!.nextRates!.usd : rates?.bcv ?? 0;
  const eurValue = useFuture ? rates!.nextRates!.eur : rates?.euro ?? 0;
  const usdChange = useFuture
    ? (rates?.nextRates && rates.bcv ? ((rates.nextRates.usd - rates.bcv) / rates.bcv) * 100 : 0)
    : (rates?.usdChange ?? 0);
  const eurChange = useFuture
    ? (rates?.nextRates && rates.euro ? ((rates.nextRates.eur - rates.euro) / rates.euro) * 100 : 0)
    : (rates?.eurChange ?? 0);
  const bcvUpdate = useFuture
    ? `Próxima · ${rates!.nextRates!.date}`
    : rates?.lastUpdate ?? '—';
  const futureNotice =
    useFuture && rates?.nextRates
      ? {
          label:
            rates.nextRates.rawDate === addDaysISO(getTodayVetISO(), 1)
              ? 'Mañana'
              : 'Próxima tasa',
          prefix:
            rates.nextRates.rawDate === addDaysISO(getTodayVetISO(), 1)
              ? 'Para mañana'
              : 'Para',
          dateLabel: rates.nextRates.date,
        }
      : undefined;

  const displayRates = rates
    ? {
        ...rates,
        bcv: usdValue,
        euro: eurValue,
        usdChange,
        eurChange,
        lastUpdate: bcvUpdate,
      }
    : null;
  const futureHistoryPoint =
    useFuture && rates?.nextRates
      ? {
          date: rates.nextRates.rawDate,
          usd: rates.nextRates.usd,
          eur: rates.nextRates.eur,
        }
      : null;

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[COLORS.bcvGreen + '1C', 'transparent']}
        style={styles.backdropTop}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', COLORS.bcvGreen + '08']}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.backdropAccent}
        pointerEvents="none"
      />

      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Header: calendario · logo · menú */}
        <View style={styles.header}>
          <Pressable
            onPress={() => setCalendarOpen(true)}
            hitSlop={8}
            style={styles.iconBtn}
          >
            <CalendarSearch size={21} color={COLORS.text} />
          </Pressable>
          <Image
            source={require('../../assets/kuanto-logo.png')}
            style={styles.logo}
            resizeMode="contain"
            accessibilityLabel="Kuanto"
          />
          <Pressable onPress={() => setMenuOpen(true)} hitSlop={8} style={styles.iconBtn}>
            <Menu size={22} color={COLORS.text} />
          </Pressable>
        </View>

        {/* Update timestamp + live indicator */}
        {rates?.lastUpdate && !useFuture && (
          <View style={styles.stampRow}>
            <Animated.View style={[styles.liveDot, { opacity: pulseAnim }]} />
            <Text style={styles.updateStamp}>BCV · Actualizado {rates.lastUpdate}</Text>
          </View>
        )}
        {useFuture && rates?.nextRates && (
          <View style={styles.stampRow}>
            <CalendarClock size={12} color={COLORS.bcvGreen} />
            <Text style={styles.updateStamp}>
              Próxima publicación · {rates.nextRates.date}
            </Text>
          </View>
        )}

        {loading && !rates ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={COLORS.bcvGreen} />
            <Text style={styles.loadingText}>Cargando tasas…</Text>
          </View>
        ) : (
          <ScrollView
            ref={scrollRef as any}
            contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            automaticallyAdjustKeyboardInsets
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={COLORS.bcvGreen}
                colors={[COLORS.bcvGreen]}
              />
            }
          >
            {isStale && (
              <View style={styles.offlineBanner}>
                <WifiOff size={16} color={COLORS.parallelOrange} />
                <Text style={styles.offlineText}>
                  {error ?? 'Sin conexión: mostrando últimas tasas conocidas.'}
                </Text>
              </View>
            )}

            {/* Subtitle + date toggle (only when future rate available) */}
            {hasFuture && (
              <>
                <Text style={styles.subtitle}>
                  Selecciona la tasa de hoy o la siguiente disponible
                </Text>
                <View style={styles.dateToggle}>
                  <Pressable
                    onPress={() => setDateMode('today')}
                    style={[styles.dateBtn, dateMode === 'today' && styles.dateBtnActive]}
                  >
                    <Text style={[styles.dateBtnText, dateMode === 'today' && styles.dateBtnTextActive]}>
                      Hoy
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setDateMode('next')}
                    style={[styles.dateBtn, dateMode === 'next' && styles.dateBtnActive]}
                  >
                    <Text style={[styles.dateBtnText, dateMode === 'next' && styles.dateBtnTextActive]}>
                      {rates!.nextRates!.date}
                    </Text>
                  </Pressable>
                </View>
              </>
            )}

            <Text style={styles.hint}>Presiona una tarjeta para calcular 👇</Text>

            <View onLayout={registerY('bcv')}>
              <RateCard
                label="Tasa BCV"
                code="USD"
                value={usdValue}
                change={usdChange}
                accent={COLORS.bcvGreen}
                icon={DollarSign}
                update={bcvUpdate}
                expanded={expanded === 'bcv'}
                onToggle={() => toggle('bcv')}
                onCalcFocus={() => scrollCardIntoView('bcv')}
                paymentMethods={paymentMethods}
                futureNotice={futureNotice}
              />
            </View>

            <View onLayout={registerY('euro')}>
              <RateCard
                label="Tasa BCV"
                code="EUR"
                value={eurValue}
                change={eurChange}
                accent={COLORS.euroBlue}
                icon={Euro}
                update={bcvUpdate}
                expanded={expanded === 'euro'}
                onToggle={() => toggle('euro')}
                onCalcFocus={() => scrollCardIntoView('euro')}
                paymentMethods={paymentMethods}
                futureNotice={futureNotice}
              />
            </View>

            <View onLayout={registerY('parallel')}>
              <RateCard
                label="Promedio"
                code="USDT"
                value={rates?.parallel ?? 0}
                change={rates?.usdtChange ?? 0}
                accent={COLORS.parallelOrange}
                icon={UsdtIcon}
                update={rates?.parallelUpdate ? `Hoy, ${rates.parallelUpdate}` : '—'}
                expanded={expanded === 'parallel'}
                onToggle={() => toggle('parallel')}
                onCalcFocus={() => scrollCardIntoView('parallel')}
                paymentMethods={paymentMethods}
              />
            </View>

            <Text style={styles.sectionLabel}>Historial de tasas</Text>

            <HistorySection futureRates={futureHistoryPoint} />

            {displayRates && <CurrencyGap rates={displayRates} isFuture={useFuture} />}

            <Text style={styles.disclaimer}>
              Datos con fines informativos. Fuente oficial: Banco Central de Venezuela (BCV) y
              promedio del mercado paralelo (USDT).
            </Text>
          </ScrollView>
        )}
      </SafeAreaView>

      <AdBanner bottomInset={insets.bottom} />

      <HeaderMenu
        visible={menuOpen}
        topOffset={insets.top + 52}
        highlightKey={onboardingActive ? 'pago' : undefined}
        onClose={() => {
          setMenuOpen(false);
          if (onboardingActive) finishOnboarding();
        }}
        onSelect={(key) => {
          setMenuOpen(false);
          if (onboardingActive) finishOnboarding();
          setSection(key);
        }}
      />
      <SectionModal
        visible={
          section === 'fuentes' ||
          section === 'ajustes' ||
          section === 'pago' ||
          section === 'history'
        }
        title={section ? SECTION_TITLES[section] : ''}
        onClose={closeSectionModal}
      >
        {section === 'fuentes' && <SourcesScreen />}
        {section === 'ajustes' && (
          <SettingsScreen
            onClose={() => setSection(null)}
            onOpenHistory={openHistoryFromSettings}
            onOpenSources={openSourcesFromSettings}
          />
        )}
        {section === 'history' && (
          <HistoryModal
            embedded
            visible
            // Cierre interno (exportar / "buscar por fecha") → cierra del todo a
            // Home; el botón ⬅ del SectionModal es el que regresa a Ajustes.
            onClose={() => setSection(null)}
            onOpenCalendar={() => setCalendarOpen(true)}
          />
        )}
        {section === 'pago' && (
          <PagoMovilScreen
            paymentMethods={paymentMethods}
            onRefresh={loadPaymentMethods}
            onClose={closePagoModal}
            initialMode={pagoInitialMode}
            initialEditingId={pagoEditingId}
          />
        )}
      </SectionModal>

      <CalendarModal isVisible={calendarOpen} onClose={() => setCalendarOpen(false)} />

      {/* Aviso de notificaciones (1ª vez). Se muestra antes del tutorial. */}
      <NotificationPrompt
        visible={notifPromptVisible}
        onAccept={acceptNotifications}
        onDecline={declineNotifications}
      />

      {/* Tutorial flotante: paso 1 (menú cerrado) apunta al ☰; paso 2 (menú abierto) a "Mis datos". */}
      <CoachMark
        visible={onboardingActive && !menuOpen && !notifPromptVisible}
        onDismiss={finishOnboarding}
        topOffset={insets.top + 56}
        text="Toca el menú ☰ para añadir tus datos de pago"
        autoDismissMs={9000}
      />
      <CoachMark
        visible={onboardingActive && menuOpen && !notifPromptVisible}
        onDismiss={finishOnboarding}
        topOffset={insets.top + 166}
        text="Elige 'Mis datos' para guardar tu pago móvil"
        autoDismissMs={0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  safe: {
    flex: 1,
  },
  backdropTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 360,
  },
  backdropAccent: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 220,
    height: 260,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 2,
  },
  logo: {
    height: 32,
    width: 32 * (2504 / 629),
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stampRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 8,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.bcvGreen,
  },
  updateStamp: {
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
    fontSize: 12,
    opacity: 0.7,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 2,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
    marginTop: 12,
    fontSize: 14,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.parallelOrange + '1A',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
  },
  offlineText: {
    fontFamily: FONTS.medium,
    color: COLORS.parallelOrange,
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
    marginTop: 4,
    paddingHorizontal: 10,
    lineHeight: 20,
  },
  dateToggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 5,
    marginBottom: 14,
    gap: 4,
  },
  dateBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
  },
  dateBtnActive: {
    backgroundColor: COLORS.bcvGreen,
  },
  dateBtnText: {
    fontFamily: FONTS.semiBold,
    color: COLORS.textSecondary,
    fontSize: 15,
  },
  dateBtnTextActive: {
    color: '#0a1a0e',
  },
  hint: {
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 14,
    opacity: 0.7,
  },
  sectionLabel: {
    fontFamily: FONTS.semiBold,
    color: COLORS.textSecondary,
    fontSize: 12,
    letterSpacing: 0.1,
    marginBottom: 10,
    marginTop: 8,
    marginLeft: 2,
    opacity: 0.7,
  },
  disclaimer: {
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
    opacity: 0.55,
    textAlign: 'center',
  },
});
