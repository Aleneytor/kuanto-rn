import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
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
import { DollarSign, Euro, Menu, WifiOff } from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { useRates } from '../context/RatesContext';
import { RateCard } from '../components/RateCard';
import { UsdtIcon } from '../components/UsdtIcon';
import { HistorySection } from '../components/HistorySection';
import { HeaderMenu, type MenuKey } from '../components/HeaderMenu';
import { SectionModal } from '../components/SectionModal';
import { SourcesScreen } from './SourcesScreen';

type CardKey = 'bcv' | 'euro' | 'parallel';

const SECTION_TITLES: Record<MenuKey, string> = {
  fuentes: 'Fuentes',
  pago: 'Pago móvil',
  ajustes: 'Ajustes',
};

function ComingSoon({ label }: { label: string }) {
  return (
    <View style={styles.comingSoon}>
      <Text style={styles.comingSoonTitle}>{label}</Text>
      <Text style={styles.comingSoonText}>
        Próximamente. Lo construiremos en una próxima iteración.
      </Text>
    </View>
  );
}

export function HomeScreen() {
  const { rates, loading, isStale, error, refresh } = useRates();
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<CardKey | null>(null);
  const [dateMode, setDateMode] = useState<'today' | 'next'>('today');
  const [menuOpen, setMenuOpen] = useState(false);
  const [section, setSection] = useState<MenuKey | null>(null);
  const insets = useSafeAreaInsets();

  const scrollRef = useRef<ScrollView>(null);
  const cardY = useRef<Record<CardKey, number>>({ bcv: 0, euro: 0, parallel: 0 });

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
      // Al abrir, revela la tarjeta (sin abrir el teclado). El teclado abre al tocar un campo.
      if (next) setTimeout(() => scrollCardIntoView(key), 300);
      return next;
    });

  const registerY = (key: CardKey) => (e: LayoutChangeEvent) => {
    cardY.current[key] = e.nativeEvent.layout.y;
  };

  const hasFuture = !!rates?.nextRates;
  const useFuture = dateMode === 'next' && hasFuture;

  const usdValue = useFuture ? rates!.nextRates!.usd : rates?.bcv ?? 0;
  const eurValue = useFuture ? rates!.nextRates!.eur : rates?.euro ?? 0;
  const bcvUpdate = useFuture
    ? `Próxima · ${rates!.nextRates!.date}`
    : rates?.lastUpdate ?? '—';

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[COLORS.bcvGreen + '24', 'transparent']}
        style={styles.backdrop}
        pointerEvents="none"
      />
      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image
              source={require('../../assets/kuanto-logo.png')}
              style={styles.logo}
              resizeMode="contain"
              accessibilityLabel="Kuanto"
            />
            <View style={styles.subtitleRow}>
              <View style={styles.liveDot} />
              <Text style={styles.subtitle}>
                {rates?.lastUpdate ? `BCV · ${rates.lastUpdate}` : 'Tasas de cambio'}
              </Text>
            </View>
          </View>
          <Pressable onPress={() => setMenuOpen(true)} hitSlop={8} style={styles.menuBtn}>
            <Menu size={24} color={COLORS.text} />
          </Pressable>
        </View>

      {loading && !rates ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.bcvGreen} />
          <Text style={styles.loadingText}>Cargando tasas…</Text>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
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

          {/* Selector de fecha BCV (solo si hay tasa futura publicada) */}
          {hasFuture && (
            <View style={styles.dateToggle}>
              <Pressable
                onPress={() => setDateMode('today')}
                style={[styles.dateBtn, dateMode === 'today' && styles.dateBtnActive]}
              >
                <Text
                  style={[
                    styles.dateBtnText,
                    dateMode === 'today' && styles.dateBtnTextActive,
                  ]}
                >
                  Hoy
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setDateMode('next')}
                style={[styles.dateBtn, dateMode === 'next' && styles.dateBtnActive]}
              >
                <Text
                  style={[
                    styles.dateBtnText,
                    dateMode === 'next' && styles.dateBtnTextActive,
                  ]}
                >
                  {rates!.nextRates!.date}
                </Text>
              </Pressable>
            </View>
          )}

          <Text style={styles.hint}>Toca una tarjeta para calcular ↓</Text>

          <View onLayout={registerY('bcv')}>
            <RateCard
              label="Dólar BCV"
              code="USD"
              value={usdValue}
              change={useFuture ? 0 : rates?.usdChange ?? 0}
              accent={COLORS.bcvGreen}
              icon={DollarSign}
              update={bcvUpdate}
              expanded={expanded === 'bcv'}
              onToggle={() => toggle('bcv')}
              onCalcFocus={() => scrollCardIntoView('bcv')}
            />
          </View>

          <View onLayout={registerY('euro')}>
            <RateCard
              label="Euro BCV"
              code="EUR"
              value={eurValue}
              change={useFuture ? 0 : rates?.eurChange ?? 0}
              accent={COLORS.euroBlue}
              icon={Euro}
              update={bcvUpdate}
              expanded={expanded === 'euro'}
              onToggle={() => toggle('euro')}
              onCalcFocus={() => scrollCardIntoView('euro')}
            />
          </View>

          <View onLayout={registerY('parallel')}>
            <RateCard
              label="Paralelo"
              code="USDT"
              value={rates?.parallel ?? 0}
              change={rates?.usdtChange ?? 0}
              accent={COLORS.parallelOrange}
              icon={UsdtIcon}
              update={rates?.parallelUpdate ? `Hoy, ${rates.parallelUpdate}` : '—'}
              expanded={expanded === 'parallel'}
              onToggle={() => toggle('parallel')}
              onCalcFocus={() => scrollCardIntoView('parallel')}
            />
          </View>

          <HistorySection />

          <Text style={styles.disclaimer}>
            Datos con fines informativos. Fuente oficial: Banco Central de Venezuela (BCV) y
            promedio del mercado paralelo (USDT).
          </Text>
        </ScrollView>
      )}
      </SafeAreaView>

      <HeaderMenu
        visible={menuOpen}
        topOffset={insets.top + 56}
        onClose={() => setMenuOpen(false)}
        onSelect={(key) => {
          setMenuOpen(false);
          setSection(key);
        }}
      />
      <SectionModal
        visible={section !== null}
        title={section ? SECTION_TITLES[section] : ''}
        onClose={() => setSection(null)}
      >
        {section === 'fuentes' && <SourcesScreen />}
        {section === 'pago' && <ComingSoon label="Mis datos de pago móvil" />}
        {section === 'ajustes' && <ComingSoon label="Ajustes" />}
      </SectionModal>
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
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 380,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  menuBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.glass,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  comingSoon: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  comingSoonTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  comingSoonText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  logo: {
    height: 34,
    width: 34 * (2504 / 629),
    alignSelf: 'flex-start',
  },
  subtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.bcvGreen,
    marginRight: 7,
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 6,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
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
    color: COLORS.parallelOrange,
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
  },
  dateToggle: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    padding: 4,
    marginBottom: 14,
  },
  dateBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 10,
  },
  dateBtnActive: {
    backgroundColor: COLORS.bcvGreen + '24',
  },
  dateBtnText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  dateBtnTextActive: {
    color: COLORS.bcvGreen,
  },
  hint: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginBottom: 12,
    marginLeft: 2,
  },
  disclaimer: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
    opacity: 0.8,
  },
});
