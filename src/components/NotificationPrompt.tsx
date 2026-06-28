import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { BellRing, Coins } from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { FONTS } from '../theme/typography';

interface Props {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

/**
 * Aviso suave (priming) en el primer arranque: pregunta si quiere notificaciones
 * ANTES de disparar el permiso del sistema. Si acepta → se activan recordatorio
 * USDT + alerta BCV (y recién ahí sale el diálogo de permiso del SO). Si dice que
 * no, no pasa nada: puede activarlas luego en Ajustes.
 */
export function NotificationPrompt({ visible, onAccept, onDecline }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onDecline}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconWrap}>
            <BellRing size={28} color={COLORS.bcvGreen} />
          </View>
          <Text style={styles.title}>Mantente al día</Text>
          <Text style={styles.subtitle}>Activa las notificaciones para no perderte:</Text>

          <View style={styles.featureRow}>
            <BellRing size={18} color={COLORS.bcvGreen} />
            <Text style={styles.featureText}>El aviso cuando el BCV publica una nueva tasa</Text>
          </View>
          <View style={styles.featureRow}>
            <Coins size={18} color={COLORS.parallelOrange} />
            <Text style={styles.featureText}>Un recordatorio del Promedio USDT (9am y 1pm)</Text>
          </View>

          <Pressable style={styles.primaryBtn} onPress={onAccept}>
            <Text style={styles.primaryText}>Activar notificaciones</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={onDecline} hitSlop={8}>
            <Text style={styles.secondaryText}>Ahora no</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: COLORS.cardElevated,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.divider,
    padding: 24,
    alignItems: 'center',
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: COLORS.bcvGreen + '1A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontFamily: FONTS.bold,
    color: COLORS.text,
    fontSize: 20,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: FONTS.regular,
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    gap: 12,
    paddingVertical: 8,
  },
  featureText: {
    flex: 1,
    fontFamily: FONTS.medium,
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 19,
  },
  primaryBtn: {
    alignSelf: 'stretch',
    backgroundColor: COLORS.bcvGreen,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryText: {
    fontFamily: FONTS.bold,
    color: '#0a1a0e',
    fontSize: 15,
  },
  secondaryBtn: {
    paddingVertical: 12,
    marginTop: 4,
  },
  secondaryText: {
    fontFamily: FONTS.medium,
    color: COLORS.textSecondary,
    fontSize: 14,
  },
});
