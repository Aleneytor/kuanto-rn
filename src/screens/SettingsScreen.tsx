import React, { useEffect, useState } from 'react';
import {
  Alert,
  Animated,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import * as StoreReview from 'expo-store-review';
import {
  Bell,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Coins,
  Database,
  FileText,
  Globe,
  History,
  Mail,
  Share2,
  Star,
} from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import {
  KEY_USDT,
  KEY_BCV,
  requestPermissions,
  scheduleUsdtReminders,
  cancelUsdtReminders,
  registerForBcvPush,
  unregisterBcvPush,
} from '../services/notificationService';

const LEGACY_NOTIF_KEY = '@app_notifications';

interface Props {
  onClose: () => void;
  onOpenHistory: () => void;
  onOpenSources: () => void;
}

export function SettingsScreen({ onClose, onOpenHistory, onOpenSources }: Props) {
  const [usdtEnabled, setUsdtEnabled] = useState(false);
  const [bcvEnabled, setBcvEnabled] = useState(false);
  const [legalExpanded, setLegalExpanded] = useState(false);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    loadNotificationSettings();
  }, []);

  const loadNotificationSettings = async () => {
    try {
      const [usdt, bcv, legacy] = await Promise.all([
        AsyncStorage.getItem(KEY_USDT),
        AsyncStorage.getItem(KEY_BCV),
        AsyncStorage.getItem(LEGACY_NOTIF_KEY),
      ]);
      // Migración del toggle único anterior: si estaba activo, encender ambos.
      if (usdt === null && bcv === null && legacy === 'true') {
        setUsdtEnabled(true);
        setBcvEnabled(true);
        return;
      }
      setUsdtEnabled(usdt === 'true');
      setBcvEnabled(bcv === 'true');
    } catch (err) {
      console.warn('[Settings] Error loading notification settings:', err);
    }
  };

  const toggleUsdt = async (val: boolean) => {
    try {
      setUsdtEnabled(val);
      await AsyncStorage.setItem(KEY_USDT, val ? 'true' : 'false');
      if (val) {
        const granted = await requestPermissions();
        if (!granted) {
          setUsdtEnabled(false);
          await AsyncStorage.setItem(KEY_USDT, 'false');
          Alert.alert(
            'Permiso necesario',
            'Activa las notificaciones de Kuanto desde los ajustes de tu teléfono para recibir los recordatorios.',
          );
          return;
        }
        await scheduleUsdtReminders();
      } else {
        await cancelUsdtReminders();
      }
    } catch (err) {
      console.warn('[Settings] Error toggling USDT reminders:', err);
    }
  };

  const toggleBcv = async (val: boolean) => {
    try {
      setBcvEnabled(val);
      await AsyncStorage.setItem(KEY_BCV, val ? 'true' : 'false');
      if (val) {
        const granted = await requestPermissions();
        if (!granted) {
          setBcvEnabled(false);
          await AsyncStorage.setItem(KEY_BCV, 'false');
          Alert.alert(
            'Permiso necesario',
            'Activa las notificaciones de Kuanto desde los ajustes de tu teléfono.',
          );
          return;
        }
        const token = await registerForBcvPush();
        if (!token) {
          Alert.alert(
            'Casi listo',
            'La alerta del BCV requiere la versión instalada de Kuanto (no funciona en Expo Go). Tu preferencia quedó guardada y se activará en la app instalada.',
          );
        }
      } else {
        await unregisterBcvPush();
      }
    } catch (err) {
      console.warn('[Settings] Error toggling BCV alert:', err);
    }
  };

  const handleShareApp = async () => {
    try {
      await Share.share({
        message: `💱 *Kuanto*\n\nConsulta las tasas oficiales del BCV (USD/EUR) y el promedio Paralelo en Venezuela al instante de forma simple y premium.\n\n📲 Descarga la app y pruébala gratis en https://kuanto.online`,
      });
    } catch (err) {
      console.error('[Settings] Share error:', err);
    }
  };

  const handleRateApp = async () => {
    try {
      if (await StoreReview.hasAction()) {
        await StoreReview.requestReview();
      } else {
        const appId = 'com.aleneytor.app';
        const url = Platform.select({
          android: `market://details?id=${appId}`,
          ios: `itms-apps://itunes.apple.com/app/idYOUR_APP_ID?action=write-review`,
        });
        if (url) {
          Linking.openURL(url).catch(() => {
            const webUrl = `https://play.google.com/store/apps/details?id=${appId}`;
            Linking.openURL(webUrl).catch(() => {
              Alert.alert('Error', 'No se pudo abrir la tienda de aplicaciones.');
            });
          });
        }
      }
    } catch (err) {
      console.warn('[Settings] Error showing store review:', err);
    }
  };

  const handleContactSupport = () => {
    Linking.openURL('mailto:info@kuanto.online').catch(() => {
      Alert.alert(
        'Soporte Técnico',
        'No se pudo abrir tu cliente de correo. Por favor escríbenos directamente a info@kuanto.online',
      );
    });
  };

  const handleVisitWebsite = () => {
    Linking.openURL('https://kuanto.online').catch(() => {
      Alert.alert('Error', 'No se pudo abrir el navegador.');
    });
  };

  return (
    <Animated.View style={[styles.root, { opacity: fadeAnim }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Banner de marca */}
        <View style={styles.brandingCard}>
          <LinearGradient
            colors={[COLORS.bcvGreen + '1A', 'transparent']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
          <Image
            source={require('../../assets/kuanto-logo.png')}
            style={styles.brandingLogo}
            resizeMode="contain"
          />
          <Text style={styles.brandingSubtitle}>
            Consulta de tasas oficiales y promedio en tiempo real
          </Text>
        </View>

        {/* Sección Consulta: Historial + Fuentes (movidos aquí desde el menú ☰) */}
        <Text style={styles.sectionHeader}>Consulta</Text>
        <View style={styles.sectionCard}>
          <Pressable
            onPress={onOpenHistory}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, styles.blueIconBox]}>
                <History size={18} color={COLORS.euroBlue} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Historial completo</Text>
                <Text style={styles.rowSubtitle}>Tasas por día y exportar a Excel</Text>
              </View>
            </View>
            <ChevronRight size={18} color="rgba(255, 255, 255, 0.25)" />
          </Pressable>

          <View style={styles.divider} />

          <Pressable
            onPress={onOpenSources}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, styles.greenIconBox]}>
                <Database size={18} color={COLORS.bcvGreen} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Fuentes</Text>
                <Text style={styles.rowSubtitle}>De dónde provienen las tasas</Text>
              </View>
            </View>
            <ChevronRight size={18} color="rgba(255, 255, 255, 0.25)" />
          </Pressable>
        </View>

        {/* Sección General */}
        <Text style={styles.sectionHeader}>General</Text>
        <View style={styles.sectionCard}>
          {/* Fila: Recordatorio USDT (local, suave) */}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, styles.orangeIconBox]}>
                <Coins size={18} color={COLORS.parallelOrange} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Recordatorio USDT</Text>
                <Text style={styles.rowSubtitle}>Promedio del paralelo · 9am y 1pm</Text>
              </View>
            </View>
            <Switch
              value={usdtEnabled}
              onValueChange={toggleUsdt}
              trackColor={{ false: '#3a3a3c', true: COLORS.bcvGreen + '66' }}
              thumbColor={usdtEnabled ? COLORS.bcvGreen : '#aeaeb2'}
              ios_backgroundColor="#2c2c2e"
            />
          </View>

          <View style={styles.divider} />

          {/* Fila: Nueva tasa BCV (push remoto) */}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, styles.greenIconBox]}>
                <Bell size={18} color={COLORS.bcvGreen} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Nueva tasa BCV</Text>
                <Text style={styles.rowSubtitle}>Aviso al publicarse la tasa oficial</Text>
              </View>
            </View>
            <Switch
              value={bcvEnabled}
              onValueChange={toggleBcv}
              trackColor={{ false: '#3a3a3c', true: COLORS.bcvGreen + '66' }}
              thumbColor={bcvEnabled ? COLORS.bcvGreen : '#aeaeb2'}
              ios_backgroundColor="#2c2c2e"
            />
          </View>

          <View style={styles.divider} />

          {/* Fila: Sitio Web */}
          <Pressable
            onPress={handleVisitWebsite}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, styles.blueIconBox]}>
                <Globe size={18} color={COLORS.euroBlue} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Sitio Web</Text>
                <Text style={styles.rowSubtitle}>Visita kuanto.online</Text>
              </View>
            </View>
            <ChevronRight size={18} color="rgba(255, 255, 255, 0.25)" />
          </Pressable>
        </View>

        {/* Sección Compartir */}
        <Text style={styles.sectionHeader}>Comparte</Text>
        <View style={styles.sectionCard}>
          {/* Fila: Compartir App */}
          <Pressable
            onPress={handleShareApp}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, styles.orangeIconBox]}>
                <Share2 size={18} color={COLORS.parallelOrange} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Compartir App</Text>
                <Text style={styles.rowSubtitle}>Invita a tus amigos</Text>
              </View>
            </View>
            <ChevronRight size={18} color="rgba(255, 255, 255, 0.25)" />
          </Pressable>

          <View style={styles.divider} />

          {/* Fila: Califica la App */}
          <Pressable
            onPress={handleRateApp}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, styles.yellowIconBox]}>
                <Star size={18} color="#FFD60A" />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Calificar App</Text>
                <Text style={styles.rowSubtitle}>¡Tu opinión importa!</Text>
              </View>
            </View>
            <ChevronRight size={18} color="rgba(255, 255, 255, 0.25)" />
          </Pressable>
        </View>

        {/* Sección Soporte */}
        <Text style={styles.sectionHeader}>Soporte</Text>
        <View style={styles.sectionCard}>
          {/* Fila: Contactar */}
          <Pressable
            onPress={handleContactSupport}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, styles.grayIconBox]}>
                <Mail size={18} color={COLORS.textSecondary} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Contactar</Text>
                <Text style={styles.rowSubtitle}>info@kuanto.online</Text>
              </View>
            </View>
            <ChevronRight size={18} color="rgba(255, 255, 255, 0.25)" />
          </Pressable>

          <View style={styles.divider} />

          {/* Fila Expandible: Aviso Legal */}
          <Pressable
            onPress={() => setLegalExpanded(!legalExpanded)}
            style={({ pressed }) => [
              styles.row,
              pressed && styles.rowPressed,
              legalExpanded && { backgroundColor: 'rgba(255, 255, 255, 0.02)' },
            ]}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, styles.grayIconBox]}>
                <FileText size={18} color={COLORS.textSecondary} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Aviso Legal</Text>
                <Text style={styles.rowSubtitle}>Términos y condiciones</Text>
              </View>
            </View>
            {legalExpanded ? (
              <ChevronUp size={20} color={COLORS.textSecondary} />
            ) : (
              <ChevronDown size={20} color={COLORS.textSecondary} />
            )}
          </Pressable>

          {/* Acordeón expandido de Aviso Legal */}
          {legalExpanded && (
            <View style={styles.legalExpandedContent}>
              <Text style={styles.legalParagraph}>
                La información mostrada en esta aplicación tiene un carácter{' '}
                <Text style={styles.legalBold}>exclusivamente informativo</Text>. Kuanto no representa
                ni está afiliado a ninguna entidad gubernamental y no establece ninguna de las tasas
                aquí publicadas. La única tasa oficial en Venezuela es la publicada por el{' '}
                <Text style={styles.legalBold}>Banco Central de Venezuela (BCV)</Text>, disponible en su
                sitio web oficial.
              </Text>
              <Text style={styles.legalParagraph}>
                En la aplicación, la tasa oficial del BCV se actualiza tras su publicación oficial en
                los días hábiles. Esta tasa solo se refleja en la calculadora cuando entra en vigencia
                según lo indicado oficialmente por el BCV.
              </Text>
              <Text style={styles.legalParagraph}>
                Se muestra asimismo una referencia del valor del{' '}
                <Text style={styles.legalBold}>USDT (Tether)</Text> frente al bolívar, calculada a partir
                de un promedio estadístico de anuncios en mercados P2P. El USDT es una stablecoin, pero
                no es dinero fiduciario ni debe interpretarse como una tasa oficial del dólar estadounidense.
              </Text>
              <Text style={styles.legalParagraph}>
                La tasa USDT mostrada se debe entender únicamente como una{' '}
                <Text style={styles.legalBold}>referencia estadística</Text>. En los mercados digitales
                P2P no existe un precio único, sino rangos de valores dinámicos. Por lo tanto, la cifra
                mostrada no equivale a un precio garantizado ni constituye una recomendación financiera.
              </Text>
              <Text style={styles.legalParagraph}>
                Esta aplicación no intermedia operaciones, no fija precios y no mantiene afiliación ni
                respaldo con ninguna plataforma de intercambio. El uso de esta información queda bajo
                la responsabilidad exclusiva del usuario.
              </Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Kuanto v2.0.0</Text>
          <Text style={styles.footerCopyright}>© 2026 - Aora Estudio</Text>
        </View>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  brandingCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.divider,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  brandingLogo: {
    height: 34,
    width: 34 * (2504 / 629),
    marginBottom: 8,
  },
  brandingSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 18,
    opacity: 0.8,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 10,
    marginLeft: 4,
    marginTop: 14,
    opacity: 0.7,
  },
  sectionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.divider,
    overflow: 'hidden',
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 15,
    paddingHorizontal: 16,
  },
  rowPressed: {
    backgroundColor: COLORS.glass,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderWidth: 1,
  },
  greenIconBox: {
    backgroundColor: 'rgba(2, 223, 130, 0.06)',
    borderColor: 'rgba(2, 223, 130, 0.15)',
  },
  blueIconBox: {
    backgroundColor: 'rgba(0, 122, 255, 0.06)',
    borderColor: 'rgba(0, 122, 255, 0.15)',
  },
  orangeIconBox: {
    backgroundColor: 'rgba(255, 149, 0, 0.06)',
    borderColor: 'rgba(255, 149, 0, 0.15)',
  },
  yellowIconBox: {
    backgroundColor: 'rgba(255, 214, 10, 0.06)',
    borderColor: 'rgba(255, 214, 10, 0.15)',
  },
  grayIconBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.text,
  },
  rowSubtitle: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginLeft: 68,
  },
  legalExpandedContent: {
    paddingHorizontal: 18,
    paddingBottom: 20,
    paddingTop: 14,
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  legalParagraph: {
    fontSize: 12.5,
    lineHeight: 18,
    color: COLORS.textSecondary,
    marginBottom: 12,
    textAlign: 'justify',
    opacity: 0.9,
  },
  legalBold: {
    fontWeight: '700',
    color: COLORS.text,
  },
  footer: {
    marginTop: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  footerText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    opacity: 0.8,
  },
  footerCopyright: {
    fontSize: 11,
    color: COLORS.textSecondary,
    opacity: 0.35,
  },
});
