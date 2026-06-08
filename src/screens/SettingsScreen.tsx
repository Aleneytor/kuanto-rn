import React, { useEffect, useState } from 'react';
import {
  Alert,
  Animated,
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
import {
  Bell,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Globe,
  Mail,
  Share2,
  Star,
} from 'lucide-react-native';
import { COLORS } from '../theme/colors';

const NOTIFICATIONS_KEY = '@app_notifications';

interface Props {
  onClose: () => void;
}

export function SettingsScreen({ onClose }: Props) {
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
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
      const val = await AsyncStorage.getItem(NOTIFICATIONS_KEY);
      if (val !== null) {
        setNotificationsEnabled(JSON.parse(val));
      }
    } catch (err) {
      console.warn('[Settings] Error loading notification settings:', err);
    }
  };

  const toggleNotifications = async (val: boolean) => {
    try {
      setNotificationsEnabled(val);
      await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(val));
      if (val) {
        Alert.alert(
          'Alertas Activadas',
          'Recibirás notificaciones cuando se publiquen nuevas tasas oficiales (1 PM y 5 PM aprox.).',
        );
      }
    } catch (err) {
      console.warn('[Settings] Error saving notification settings:', err);
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

  const handleRateApp = () => {
    Alert.alert(
      'Calificar Kuanto',
      '¡Tu opinión es muy importante para nosotros! Pronto estaremos disponibles en las tiendas oficiales de Google Play y App Store.',
    );
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
        {/* Sección General */}
        <Text style={styles.sectionHeader}>General</Text>
        <View style={styles.sectionCard}>
          {/* Fila: Notificaciones */}
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: COLORS.bcvGreen + '14' }]}>
                <Bell size={20} color={COLORS.bcvGreen} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Notificaciones</Text>
                <Text style={styles.rowSubtitle}>Recibe alertas de tasas diarias</Text>
              </View>
            </View>
            <Switch
              value={notificationsEnabled}
              onValueChange={toggleNotifications}
              trackColor={{ false: '#3a3a3c', true: COLORS.bcvGreen + '66' }}
              thumbColor={notificationsEnabled ? COLORS.bcvGreen : '#aeaeb2'}
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
              <View style={[styles.iconBox, { backgroundColor: COLORS.euroBlue + '14' }]}>
                <Globe size={20} color={COLORS.euroBlue} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Sitio Web</Text>
                <Text style={styles.rowSubtitle}>Visita kuanto.online</Text>
              </View>
            </View>
            <ExternalLink size={16} color={COLORS.textSecondary} />
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
              <View style={[styles.iconBox, { backgroundColor: COLORS.parallelOrange + '14' }]}>
                <Share2 size={20} color={COLORS.parallelOrange} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Compartir App</Text>
                <Text style={styles.rowSubtitle}>Invita a tus amigos</Text>
              </View>
            </View>
            <ExternalLink size={16} color={COLORS.textSecondary} />
          </Pressable>

          <View style={styles.divider} />

          {/* Fila: Califica la App */}
          <Pressable
            onPress={handleRateApp}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: '#FFD60A14' }]}>
                <Star size={20} color="#FFD60A" />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Calificar App</Text>
                <Text style={styles.rowSubtitle}>¡Tu opinión importa!</Text>
              </View>
            </View>
            <ExternalLink size={16} color={COLORS.textSecondary} />
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
              <View style={[styles.iconBox, { backgroundColor: COLORS.glassStrong }]}>
                <Mail size={20} color={COLORS.textSecondary} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowTitle}>Contactar</Text>
                <Text style={styles.rowSubtitle}>info@kuanto.online</Text>
              </View>
            </View>
            <ExternalLink size={16} color={COLORS.textSecondary} />
          </Pressable>

          <View style={styles.divider} />

          {/* Fila Expandible: Aviso Legal */}
          <Pressable
            onPress={() => setLegalExpanded(!legalExpanded)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: COLORS.glassStrong }]}>
                <FileText size={20} color={COLORS.textSecondary} />
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
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 4,
    marginTop: 18,
  },
  sectionCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.divider,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
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
    paddingVertical: 14,
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
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  rowText: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
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
    paddingBottom: 18,
    paddingTop: 4,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  legalParagraph: {
    fontSize: 13,
    lineHeight: 19,
    color: COLORS.textSecondary,
    marginBottom: 12,
    textAlign: 'justify',
  },
  legalBold: {
    fontWeight: '700',
    color: COLORS.text,
  },
  footer: {
    marginTop: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
  },
  footerCopyright: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.3)',
    marginTop: 4,
  },
});
