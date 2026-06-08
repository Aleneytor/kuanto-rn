import React, { type ReactNode } from 'react';
import {
  Image,
  type ImageSourcePropType,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ExternalLink } from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { useRates } from '../context/RatesContext';
import { formatCurrency } from '../utils/formatting';
import { BinanceLogo } from '../components/BinanceLogo';

function pngLogo(source: ImageSourcePropType) {
  return <Image source={source} style={styles.logoImg} resizeMode="contain" />;
}

interface SourceCardProps {
  logo: ReactNode;
  name: string;
  /** Texto bajo el nombre cuando no es "en vivo" (p. ej. fecha del BCV). */
  subtitle?: string;
  live?: boolean;
  url: string;
  col1: { label: string; value: number };
  col2: { label: string; value: number };
}

function SourceCard({ logo, name, subtitle, live, url, col1, col2 }: SourceCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.logoBox}>{logo}</View>
        <View style={styles.headerText}>
          <Text style={styles.name}>{name}</Text>
          {live ? (
            <View style={styles.liveRow}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>EN VIVO</Text>
            </View>
          ) : subtitle ? (
            <Text style={styles.subtitle}>{subtitle}</Text>
          ) : null}
        </View>
        <Pressable onPress={() => Linking.openURL(url)} hitSlop={8}>
          <ExternalLink size={18} color={COLORS.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.ratesPanel}>
        <View style={styles.col}>
          <Text style={styles.colLabel}>{col1.label}</Text>
          <Text style={styles.colValue}>Bs {formatCurrency(col1.value)}</Text>
        </View>
        <View style={styles.colDivider} />
        <View style={styles.col}>
          <Text style={styles.colLabel}>{col2.label}</Text>
          <Text style={styles.colValue}>Bs {formatCurrency(col2.value)}</Text>
        </View>
      </View>
    </View>
  );
}

export function SourcesScreen() {
  const { rates } = useRates();
  const p2p = rates?.p2p;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.intro}>
        Kuanto reúne las tasas de Venezuela desde la fuente oficial y el mercado paralelo,
        con transparencia y precisión.
      </Text>

      <SourceCard
        logo={pngLogo(require('../../assets/sources/bcv-logo.png'))}
        name="BCV (Oficial)"
        subtitle={rates?.lastUpdate}
        url="https://www.bcv.org.ve"
        col1={{ label: 'USD oficial', value: rates?.bcv ?? 0 }}
        col2={{ label: 'EUR oficial', value: rates?.euro ?? 0 }}
      />

      <SourceCard
        logo={<BinanceLogo size={34} />}
        name="Binance P2P"
        live
        url="https://p2p.binance.com"
        col1={{ label: 'Compra', value: p2p?.binance.buy ?? 0 }}
        col2={{ label: 'Venta', value: p2p?.binance.sell ?? 0 }}
      />

      <SourceCard
        logo={pngLogo(require('../../assets/sources/bybit-logo.png'))}
        name="Bybit P2P"
        live
        url="https://www.bybit.com/fiat/trade/otc"
        col1={{ label: 'Compra', value: p2p?.bybit.buy ?? 0 }}
        col2={{ label: 'Venta', value: p2p?.bybit.sell ?? 0 }}
      />

      <SourceCard
        logo={pngLogo(require('../../assets/sources/yadio-logo.png'))}
        name="Yadio"
        live
        url="https://yadio.io"
        col1={{ label: 'Compra', value: p2p?.yadio.buy ?? 0 }}
        col2={{ label: 'Venta', value: p2p?.yadio.sell ?? 0 }}
      />

      <Text style={styles.footer}>
        El paralelo mostrado en el inicio es el promedio de estas plataformas P2P
        (USDT/VES). Información con fines informativos.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    paddingBottom: 32,
  },
  intro: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 18,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.divider,
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImg: {
    width: 36,
    height: 36,
  },
  headerText: {
    flex: 1,
    marginLeft: 14,
  },
  name: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  liveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.positive,
    marginRight: 6,
  },
  liveText: {
    color: COLORS.positive,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  ratesPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.glass,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 14,
  },
  col: {
    flex: 1,
    alignItems: 'center',
  },
  colDivider: {
    width: 1,
    alignSelf: 'stretch',
    marginVertical: 4,
    backgroundColor: COLORS.divider,
  },
  colLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 5,
  },
  colValue: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
  },
  footer: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6,
    opacity: 0.8,
  },
});
