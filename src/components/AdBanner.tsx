import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { BANNER_AD_UNIT_ID } from '../constants/ads';
import { COLORS } from '../theme/colors';

type Props = {
  bottomInset: number;
};

// Banner fijo y pequeño, anclado abajo. Si el anuncio no carga (sin conexión,
// sin relleno) el componente no reserva espacio: no deja un hueco vacío.
export function AdBanner({ bottomInset }: Props) {
  const [loaded, setLoaded] = useState(false);

  return (
    <View
      style={[
        styles.wrap,
        loaded ? { paddingBottom: bottomInset, borderTopWidth: 1 } : styles.hidden,
      ]}
      pointerEvents={loaded ? 'auto' : 'none'}
    >
      <BannerAd
        unitId={BANNER_AD_UNIT_ID}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        onAdLoaded={() => setLoaded(true)}
        onAdFailedToLoad={() => setLoaded(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    backgroundColor: COLORS.background,
    borderTopColor: COLORS.divider,
  },
  hidden: {
    height: 0,
    overflow: 'hidden',
  },
});
