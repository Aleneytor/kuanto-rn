import { TestIds } from 'react-native-google-mobile-ads';

// AdMob (Android) — bloque "Banner" creado en la consola de AdMob.
const BANNER_AD_UNIT_ID_ANDROID = 'ca-app-pub-7187537412845196/3490287825';

// En desarrollo siempre se usan los IDs de prueba de Google: mostrar anuncios
// reales fuera de una build de producción viola las políticas de AdMob y puede
// hacer que Google marque la cuenta por "tráfico inválido".
export const BANNER_AD_UNIT_ID = __DEV__ ? TestIds.BANNER : BANNER_AD_UNIT_ID_ANDROID;
