import React from 'react';
import {
  Image,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Building2, ChevronRight, X } from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { BANK_LOGOS, type PaymentMethod } from '../constants/banks';

interface Props {
  isVisible: boolean;
  paymentMethods: PaymentMethod[];
  onClose: () => void;
  onSelect: (method: PaymentMethod | null) => void;
  /** iOS: se llama cuando el Modal terminó de cerrarse (para presentar el share). */
  onDismiss?: () => void;
}

const shortenBankName = (name: string) => {
  if (!name) return '';
  const nameMap: Record<string, string> = {
    'Banco de Venezuela': 'Venezuela',
    'Banco Mercantil': 'Mercantil',
    'Banesco Banco Universal': 'Banesco',
    'Banco Provincial': 'Provincial',
    'Banco Nacional de Crédito': 'BNC',
    'BNC Nacional de Crédito': 'BNC',
    'Bancamiga Banco Microfinanciero': 'Bancamiga',
    'Banco del Tesoro': 'Tesoro',
    'Banco Bicentenario': 'Bicentenario',
    'Banco Exterior': 'Exterior',
    '100% Banco': '100% Banco',
  };

  if (nameMap[name]) return nameMap[name];

  return name
    .replace(/Banco (de |del )?/gi, '')
    .replace(/ Banco Universal| Banco Microfinanciero/gi, '')
    .split(' ')[0]
    .trim();
};

export function PaymentSelectionModal({ isVisible, paymentMethods, onClose, onSelect, onDismiss }: Props) {
  const handleSelect = (method: PaymentMethod | null) => {
    onSelect(method);
    onClose();
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      onDismiss={onDismiss}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable style={styles.dismissArea} onPress={onClose} />
        <View style={styles.modalContainer}>
          {/* Top Handle bar for sliding visual cue */}
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.headerTitle}>Compartir con...</Text>
            <Pressable onPress={onClose} hitSlop={12} style={styles.closeButton}>
              <X size={22} color={COLORS.text} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <Text style={styles.sectionLabel}>Selecciona datos de pago</Text>

            {paymentMethods.map((method) => {
              const shortBank = shortenBankName(method.bankName);
              const logo = BANK_LOGOS[method.bankCode];
              const hasLogo = !!logo;

              const isPagoMovil = method.type === 'pago_movil';
              const typeLabel = isPagoMovil ? 'Pago Móvil' : 'Transferencia';
              const holderFirstName = method.holderName.split(' ')[0];

              return (
                <Pressable
                  key={method.id}
                  onPress={() => handleSelect(method)}
                  style={({ pressed }) => [
                    styles.methodItem,
                    pressed && styles.methodItemPressed,
                  ]}
                >
                  <View style={[styles.methodIconContainer, { backgroundColor: hasLogo ? 'transparent' : COLORS.bcvGreen + '1A' }]}>
                    {hasLogo ? (
                      <Image source={logo} style={styles.bankLogo} resizeMode="contain" />
                    ) : (
                      <Building2 size={22} color={COLORS.bcvGreen} />
                    )}
                  </View>
                  <View style={styles.methodInfo}>
                    <Text style={styles.methodBank}>{shortBank}</Text>
                    <Text style={styles.methodDetail}>
                      {typeLabel} • {holderFirstName}
                    </Text>
                  </View>
                  <ChevronRight size={18} color={COLORS.textSecondary} />
                </Pressable>
              );
            })}

            {/* "None" option to share just the calculation */}
            <Pressable
              onPress={() => handleSelect(null)}
              style={({ pressed }) => [
                styles.methodItem,
                styles.noneItem,
                pressed && styles.methodItemPressed,
              ]}
            >
              <View style={[styles.methodIconContainer, styles.noneIcon]}>
                <X size={18} color={COLORS.textSecondary} />
              </View>
              <View style={styles.methodInfo}>
                <Text style={styles.methodBank}>Sin datos de pago</Text>
                <Text style={styles.methodDetail}>Solo compartir el cálculo de la tasa</Text>
              </View>
              <ChevronRight size={18} color={COLORS.textSecondary} />
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
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
  modalContainer: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: COLORS.divider,
    borderBottomWidth: 0,
    maxHeight: '80%',
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
  },
  handle: {
    width: 38,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    alignSelf: 'center',
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  closeButton: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: COLORS.glass,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 14,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 14,
    marginLeft: 4,
  },
  methodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.divider,
    backgroundColor: COLORS.card,
    marginBottom: 10,
  },
  methodItemPressed: {
    opacity: 0.85,
    backgroundColor: COLORS.cardElevated,
  },
  methodIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    overflow: 'hidden',
  },
  bankLogo: {
    width: 30,
    height: 30,
  },
  methodInfo: {
    flex: 1,
  },
  methodBank: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 2,
  },
  methodDetail: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  noneItem: {
    borderStyle: 'dashed',
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'transparent',
    marginTop: 6,
  },
  noneIcon: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
});
