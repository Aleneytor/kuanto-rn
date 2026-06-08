import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowLeft,
  Building2,
  Check,
  ChevronDown,
  Copy,
  CreditCard,
  Edit2,
  FileText,
  Phone,
  Plus,
  Search,
  Share2,
  Trash2,
  User,
  X,
} from 'lucide-react-native';
import { COLORS } from '../theme/colors';
import { BANK_LOGOS, VENEZUELAN_BANKS, type Bank, type PaymentMethod, type AccountType } from '../constants/banks';

const STORAGE_KEY = '@payment_methods_data';
const ID_PREFIXES = ['V', 'E', 'J', 'G'] as const;
type IdPrefix = typeof ID_PREFIXES[number];

const formatLongNumber = (value: string) => value.replace(/(\d{4})(?=\d)/g, '$1 ').trim();

const getMethodVisuals = (type: AccountType) => {
  const isPagoMovil = type === 'pago_movil';
  return {
    accent: isPagoMovil ? COLORS.bcvGreen : COLORS.euroBlue,
    label: isPagoMovil ? 'PAGO MÓVIL' : type === 'cuenta_corriente' ? 'CTA. CORRIENTE' : 'CTA. AHORRO',
    iconLabel: isPagoMovil ? 'Móvil' : 'Banco',
  };
};

interface Props {
  paymentMethods: PaymentMethod[];
  onRefresh: () => Promise<void>;
  onClose: () => void;
  initialMode?: 'list' | 'form';
  initialEditingId?: string | null;
}

export function PagoMovilScreen({
  paymentMethods,
  onRefresh,
  onClose,
  initialMode = 'list',
  initialEditingId = null,
}: Props) {
  const [viewMode, setViewMode] = useState<'list' | 'form'>(initialMode);
  const [editingId, setEditingId] = useState<string | null>(initialEditingId);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const copyField = async (key: string, value: string) => {
    await Clipboard.setStringAsync(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1400);
  };

  // Form states
  const [accountType, setAccountType] = useState<AccountType>('pago_movil');
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [holderName, setHolderName] = useState('');
  const [idPrefix, setIdPrefix] = useState<IdPrefix>('V');
  const [holderId, setHolderId] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

  // Search bank modal state
  const [bankModalVisible, setBankModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Load editing method if any
  useEffect(() => {
    if (editingId) {
      const method = paymentMethods.find((m) => m.id === editingId);
      if (method) {
        setAccountType(method.type);
        setSelectedBank({ code: method.bankCode, name: method.bankName });
        setHolderName(method.holderName);
        setIdPrefix((method.idPrefix || 'V') as IdPrefix);
        setHolderId(method.holderId);
        setPhoneNumber(method.phoneNumber || '');
        setAccountNumber(method.accountNumber || '');
        setViewMode('form');
      }
    }
  }, [editingId, paymentMethods]);

  const handleSave = async () => {
    if (!selectedBank) {
      Alert.alert('Error', 'Por favor selecciona un banco.');
      return;
    }
    if (!holderName.trim()) {
      Alert.alert('Error', 'Por favor ingresa el nombre del titular.');
      return;
    }
    const cleanId = holderId.replace(/[^0-9]/g, '');
    if (!cleanId) {
      Alert.alert('Error', 'Por favor ingresa una cédula o RIF válida.');
      return;
    }

    let cleanPhone = '';
    let cleanAccount = '';

    if (accountType === 'pago_movil') {
      cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
      if (cleanPhone.length !== 11 || !cleanPhone.startsWith('04')) {
        Alert.alert('Error', 'El teléfono debe tener 11 dígitos y comenzar con 04 (ej. 04121234567).');
        return;
      }
    } else {
      cleanAccount = accountNumber.replace(/[^0-9]/g, '');
      if (cleanAccount.length !== 20) {
        Alert.alert('Error', 'El número de cuenta debe tener exactamente 20 dígitos.');
        return;
      }
      if (cleanAccount.substring(0, 4) !== selectedBank.code) {
        Alert.alert(
          'Error',
          `Los primeros 4 dígitos de la cuenta deben ser el código del banco seleccionado (${selectedBank.code}).`
        );
        return;
      }
    }

    const newMethod: PaymentMethod = {
      id: editingId || Date.now().toString(),
      type: accountType,
      bankCode: selectedBank.code,
      bankName: selectedBank.name,
      holderName: holderName.trim(),
      idPrefix,
      holderId: cleanId,
      ...(accountType === 'pago_movil' ? { phoneNumber: cleanPhone } : { accountNumber: cleanAccount }),
    };

    try {
      let updatedList: PaymentMethod[] = [];
      if (editingId) {
        updatedList = paymentMethods.map((m) => (m.id === editingId ? newMethod : m));
      } else {
        updatedList = [...paymentMethods, newMethod];
      }

      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
      await onRefresh();
      resetForm();
      setViewMode('list');
      Alert.alert('Guardado', 'Los datos de pago se guardaron correctamente.');
    } catch (err) {
      console.error('Error saving payment method:', err);
      Alert.alert('Error', 'No se pudieron guardar los datos.');
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Eliminar método',
      '¿Estás seguro de que deseas borrar este método de pago?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const updatedList = paymentMethods.filter((m) => m.id !== id);
              await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
              await onRefresh();
            } catch (err) {
              console.error('Error deleting payment method:', err);
              Alert.alert('Error', 'No se pudo eliminar el método.');
            }
          },
        },
      ]
    );
  };

  const handleEditClick = (id: string) => {
    setEditingId(id);
  };

  const resetForm = () => {
    setEditingId(null);
    setAccountType('pago_movil');
    setSelectedBank(null);
    setHolderName('');
    setIdPrefix('V');
    setHolderId('');
    setPhoneNumber('');
    setAccountNumber('');
  };

  const handleShare = async (item: PaymentMethod) => {
    const bankDisplay = `${item.bankName} (${item.bankCode})`;
    const typeLabel = item.type === 'pago_movil' ? 'Pago Móvil' : 'Transferencia';
    let message = '';

    if (item.type === 'pago_movil') {
      message += `Pago Movil ${item.holderName}\n\n`;
      message += ` ${bankDisplay}\n`;
      message += ` ${item.idPrefix}-${item.holderId}\n`;
      message += ` ${item.phoneNumber}\n`;
    } else {
      message += `Número de Cuenta ${item.holderName}\n\n`;
      message += ` ${bankDisplay}\n`;
      message += ` ${item.idPrefix}-${item.holderId}\n`;
      message += ` ${typeLabel}\n`;
      message += ` ${item.accountNumber}\n`;
    }
    message += `\nEnviado desde kuanto.online`;

    try {
      await Share.share({ message, title: 'Mis Datos de Pago' });
    } catch (err) {
      console.error('Error sharing payment method:', err);
    }
  };

  const filteredBanks = VENEZUELAN_BANKS.filter(
    (b) =>
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.code.includes(searchQuery)
  );
  const isTransferMode = accountType === 'cuenta_corriente' || accountType === 'cuenta_ahorro';
  const formAccent = accountType === 'pago_movil' ? COLORS.bcvGreen : COLORS.euroBlue;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      {viewMode === 'list' ? (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {paymentMethods.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <CreditCard size={32} color={COLORS.bcvGreen} />
              </View>
              <Text style={styles.emptyTitle}>Sin métodos guardados</Text>
              <Text style={styles.emptyText}>
                Agrega un método de pago móvil o una cuenta bancaria para tenerlo a mano.
              </Text>
              <Pressable onPress={() => { resetForm(); setViewMode('form'); }} style={styles.addButton}>
                <Plus size={18} color="#1c1c1e" />
                <Text style={styles.addButtonText}>Agregar método</Text>
              </Pressable>
            </View>
          ) : (
            <View>
              <View style={styles.listToolbar}>
                <View>
                  <Text style={styles.sectionEyebrow}>Compartir rápido</Text>
                  <Text style={styles.listTitle}>Métodos guardados</Text>
                </View>
                <Pressable onPress={() => { resetForm(); setViewMode('form'); }} style={styles.addPill}>
                  <Plus size={17} color="#1c1c1e" />
                  <Text style={styles.addPillText}>Agregar</Text>
                </Pressable>
              </View>

              {paymentMethods.map((item) => {
                const logo = BANK_LOGOS[item.bankCode];
                const hasLogo = !!logo;
                const isPM = item.type === 'pago_movil';
                const visuals = getMethodVisuals(item.type);
                const idKey = `${item.id}-id`;
                const contactKey = `${item.id}-contact`;
                const contactValue = isPM ? item.phoneNumber! : item.accountNumber!;
                const contactDisplay = isPM ? contactValue : formatLongNumber(contactValue);

                return (
                  <View
                    key={item.id}
                    style={[
                      styles.card,
                      {
                        borderLeftWidth: 4,
                        borderLeftColor: visuals.accent,
                      },
                    ]}
                  >
                    <LinearGradient
                      pointerEvents="none"
                      colors={[visuals.accent + '08', 'transparent']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.cardWash}
                    />
                    <View style={styles.cardInner}>

                      {/* Bank row */}
                      <View style={styles.cardTop}>
                        <View style={[styles.bankLogoBox, { backgroundColor: hasLogo ? '#fff' : visuals.accent + '20' }]}>
                          {hasLogo
                            ? <Image source={logo} style={styles.bankLogo} resizeMode="contain" />
                            : <Building2 size={20} color={visuals.accent} />}
                        </View>
                        <View style={styles.bankMeta}>
                          <View style={styles.bankNameRow}>
                            <Text style={styles.bankName} numberOfLines={1}>{item.bankName}</Text>
                            <View style={[styles.typeBadge, { backgroundColor: visuals.accent + '18' }]}>
                              <Text style={[styles.typeBadgeText, { color: visuals.accent }]}>{visuals.label}</Text>
                            </View>
                          </View>
                          <Text style={styles.bankCodeText}>{item.bankCode} · {visuals.iconLabel}</Text>
                        </View>
                      </View>

                      {/* Holder name */}
                      <Text style={styles.holderName} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
                        {item.holderName}
                      </Text>

                      {/* Copyable fields */}
                      <View style={styles.fieldsBox}>
                        <Pressable
                          onPress={() => copyField(idKey, `${item.idPrefix}-${item.holderId}`)}
                          style={({ pressed }) => [styles.fieldRow, pressed && styles.fieldRowPressed]}
                        >
                          <View style={styles.fieldTextWrap}>
                            <Text style={styles.fieldLabel}>Cédula / RIF</Text>
                            <Text style={styles.fieldValue} numberOfLines={1}>{item.idPrefix}-{item.holderId}</Text>
                          </View>
                          <View style={[styles.copyIconWrap, copiedKey === idKey && { backgroundColor: visuals.accent + '18' }]}>
                            {copiedKey === idKey
                              ? <Check size={16} color={visuals.accent} />
                              : <Copy size={16} color={COLORS.textSecondary} />}
                          </View>
                        </Pressable>

                        <View style={styles.fieldDivider} />

                        <Pressable
                          onPress={() => copyField(contactKey, contactValue)}
                          style={({ pressed }) => [styles.fieldRow, pressed && styles.fieldRowPressed]}
                        >
                          <View style={styles.fieldTextWrap}>
                            <Text style={styles.fieldLabel}>{isPM ? 'Teléfono' : 'Nro. Cuenta'}</Text>
                            <Text
                              style={styles.fieldValue}
                              numberOfLines={1}
                              adjustsFontSizeToFit
                              minimumFontScale={0.76}
                            >
                              {contactDisplay}
                            </Text>
                          </View>
                          <View style={[styles.copyIconWrap, copiedKey === contactKey && { backgroundColor: visuals.accent + '18' }]}>
                            {copiedKey === contactKey
                              ? <Check size={16} color={visuals.accent} />
                              : <Copy size={16} color={COLORS.textSecondary} />}
                          </View>
                        </Pressable>
                      </View>

                      {/* Footer actions */}
                      <View style={styles.cardFooter}>
                        <Pressable
                          onPress={() => handleShare(item)}
                          style={[styles.shareBtn, { borderColor: visuals.accent + '45', backgroundColor: visuals.accent + '12' }]}
                        >
                          <Share2 size={14} color={visuals.accent} />
                          <Text style={[styles.shareBtnText, { color: visuals.accent }]}>Compartir</Text>
                        </Pressable>
                        <View style={styles.iconActions}>
                          <Pressable onPress={() => handleEditClick(item.id)} hitSlop={8} style={styles.iconBtn}>
                            <Edit2 size={16} color={COLORS.textSecondary} />
                          </Pressable>
                          <Pressable onPress={() => handleDelete(item.id)} hitSlop={8} style={[styles.iconBtn, styles.iconBtnDanger]}>
                            <Trash2 size={16} color={COLORS.negative} />
                          </Pressable>
                        </View>
                      </View>

                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header row in form */}
          <View style={styles.formHeader}>
            <Pressable
              onPress={() => {
                resetForm();
                setViewMode('list');
              }}
              style={styles.backBtn}
              hitSlop={8}
            >
              <ArrowLeft size={20} color={COLORS.text} />
              <Text style={styles.backBtnText}>Volver a la lista</Text>
            </Pressable>
          </View>

          <LinearGradient
            colors={[formAccent + '18', 'rgba(255,255,255,0.025)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.formHero}
          >
            <View style={[styles.formHeroIcon, { backgroundColor: formAccent + '18' }]}>
              {accountType === 'pago_movil' ? (
                <Phone size={22} color={formAccent} />
              ) : (
                <CreditCard size={22} color={formAccent} />
              )}
            </View>
            <View style={styles.formHeroCopy}>
              <Text style={styles.formHeroTitle}>{editingId ? 'Editar método' : 'Nuevo método'}</Text>
              <Text style={styles.formHeroSubtitle}>
                {accountType === 'pago_movil'
                  ? 'Datos para recibir pago móvil.'
                  : 'Datos para recibir transferencia bancaria.'}
              </Text>
            </View>
          </LinearGradient>

          {/* Account Type Option Selection */}
          <Text style={styles.inputLabel}>¿QUÉ DESEA AGREGAR?</Text>
          <View style={styles.typeSelectorRow}>
            <Pressable
              onPress={() => setAccountType('pago_movil')}
              style={[
                styles.typeSelectBtn,
                accountType === 'pago_movil' && {
                  borderColor: COLORS.bcvGreen + '66',
                  backgroundColor: COLORS.bcvGreen + '10',
                },
              ]}
            >
              <View style={[styles.typeIconWrap, accountType === 'pago_movil' && { backgroundColor: COLORS.bcvGreen + '20' }]}>
                <Phone size={18} color={accountType === 'pago_movil' ? COLORS.bcvGreen : COLORS.textSecondary} />
              </View>
              <View style={styles.typeCopy}>
                <Text style={[styles.typeSelectBtnText, accountType === 'pago_movil' && { color: COLORS.bcvGreen }]}>
                  Pago Móvil
                </Text>
                <Text style={styles.typeSelectHint}>Teléfono asociado</Text>
              </View>
            </Pressable>

            <Pressable
              onPress={() => setAccountType('cuenta_corriente')}
              style={[
                styles.typeSelectBtn,
                isTransferMode && {
                  borderColor: COLORS.euroBlue + '66',
                  backgroundColor: COLORS.euroBlue + '10',
                },
              ]}
            >
              <View style={[styles.typeIconWrap, isTransferMode && { backgroundColor: COLORS.euroBlue + '20' }]}>
                <CreditCard
                  size={18}
                  color={isTransferMode ? COLORS.euroBlue : COLORS.textSecondary}
                />
              </View>
              <View style={styles.typeCopy}>
                <Text style={[styles.typeSelectBtnText, isTransferMode && { color: COLORS.euroBlue }]}>
                  Transferencia
                </Text>
                <Text style={styles.typeSelectHint}>Cuenta bancaria</Text>
              </View>
            </Pressable>
          </View>

          {/* If Transferencia selected, show Corriente / Ahorro subtype selector */}
          {isTransferMode && (
            <View style={styles.subTypeContainer}>
              <Text style={styles.subTypeLabel}>Tipo de Cuenta:</Text>
              <View style={styles.subTypeRow}>
                <Pressable
                  onPress={() => setAccountType('cuenta_corriente')}
                  style={[
                    styles.subTypeBtn,
                    accountType === 'cuenta_corriente' && {
                      backgroundColor: COLORS.euroBlue + '18',
                      borderColor: COLORS.euroBlue + '60',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.subTypeBtnText,
                      accountType === 'cuenta_corriente' && { color: COLORS.text },
                    ]}
                  >
                    Corriente
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setAccountType('cuenta_ahorro')}
                  style={[
                    styles.subTypeBtn,
                    accountType === 'cuenta_ahorro' && {
                      backgroundColor: COLORS.euroBlue + '18',
                      borderColor: COLORS.euroBlue + '60',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.subTypeBtnText,
                      accountType === 'cuenta_ahorro' && { color: COLORS.text },
                    ]}
                  >
                    Ahorro
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Bank Selector */}
          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>BANCO</Text>
            <Pressable
              onPress={() => setBankModalVisible(true)}
              style={({ pressed }) => [
                styles.bankSelector,
                selectedBank && { borderColor: formAccent + '55' },
                pressed && styles.bankSelectorPressed,
              ]}
            >
              {selectedBank ? (
                <View style={styles.selectedBankRow}>
                  <View style={styles.bankLogoContainerMini}>
                    {BANK_LOGOS[selectedBank.code] ? (
                      <Image
                        source={BANK_LOGOS[selectedBank.code]}
                        style={styles.bankLogoMini}
                        resizeMode="contain"
                      />
                    ) : (
                      <Building2 size={18} color={formAccent} />
                    )}
                  </View>
                  <Text style={styles.selectedBankText}>
                    {selectedBank.name} ({selectedBank.code})
                  </Text>
                </View>
              ) : (
                <Text style={styles.bankPlaceholderText}>Selecciona el banco destino</Text>
              )}
              <ChevronDown size={20} color={COLORS.textSecondary} />
            </Pressable>
          </View>

          {/* Holder Name */}
          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>TITULAR (NOMBRE Y APELLIDO)</Text>
            <View style={[styles.inputWrapper, focusedField === 'holder' && { borderColor: formAccent + '88' }]}>
              <User
                size={18}
                color={focusedField === 'holder' ? formAccent : COLORS.textSecondary}
                style={styles.inputIcon}
              />
              <TextInput
                value={holderName}
                onChangeText={setHolderName}
                placeholder="Ej. Juan Pérez"
                placeholderTextColor={COLORS.textSecondary}
                style={styles.textInput}
                autoCapitalize="words"
                onFocus={() => setFocusedField('holder')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </View>

          {/* ID Card / RIF */}
          <View style={styles.formGroup}>
            <Text style={styles.inputLabel}>CÉDULA DE IDENTIDAD / RIF</Text>
            <View style={styles.idRow}>
              <View style={styles.prefixGroup}>
                {ID_PREFIXES.map((prefix) => {
                  const isActive = idPrefix === prefix;
                  return (
                    <Pressable
                      key={prefix}
                      onPress={() => setIdPrefix(prefix)}
                      style={[styles.prefixButton, isActive && { backgroundColor: formAccent + '24' }]}
                    >
                      <Text style={[styles.prefixText, isActive && { color: formAccent }]}>{prefix}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View
                style={[
                  styles.inputWrapper,
                  styles.idInputWrapper,
                  focusedField === 'id' && { borderColor: formAccent + '88' },
                ]}
              >
                <FileText
                  size={18}
                  color={focusedField === 'id' ? formAccent : COLORS.textSecondary}
                  style={styles.inputIcon}
                />
                <TextInput
                  value={holderId}
                  onChangeText={(t) => setHolderId(t.replace(/[^0-9]/g, ''))}
                  placeholder="Ej. 12345678"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="numeric"
                  style={styles.textInput}
                  onFocus={() => setFocusedField('id')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
            </View>
          </View>

          {/* Phone (Only for Pago Movil) */}
          {accountType === 'pago_movil' ? (
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>TELÉFONO ASOCIADO</Text>
              <View style={[styles.inputWrapper, focusedField === 'phone' && { borderColor: formAccent + '88' }]}>
                <Phone
                  size={18}
                  color={focusedField === 'phone' ? formAccent : COLORS.textSecondary}
                  style={styles.inputIcon}
                />
                <TextInput
                  value={phoneNumber}
                  onChangeText={(t) => setPhoneNumber(t.replace(/[^0-9]/g, ''))}
                  placeholder="Ej. 04121234567"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="phone-pad"
                  maxLength={11}
                  style={styles.textInput}
                  onFocus={() => setFocusedField('phone')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
              <Text style={styles.inputHint}>Ingresa el número completo de 11 dígitos (ej. 04121234567).</Text>
            </View>
          ) : (
            // Account Number (Only for transfers)
            <View style={styles.formGroup}>
              <Text style={styles.inputLabel}>NÚMERO DE CUENTA (20 DÍGITOS)</Text>
              <View style={[styles.inputWrapper, focusedField === 'account' && { borderColor: formAccent + '88' }]}>
                <CreditCard
                  size={18}
                  color={focusedField === 'account' ? formAccent : COLORS.textSecondary}
                  style={styles.inputIcon}
                />
                <TextInput
                  value={accountNumber}
                  onChangeText={(t) => setAccountNumber(t.replace(/[^0-9]/g, ''))}
                  placeholder={selectedBank ? `${selectedBank.code}...` : '0102...'}
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="numeric"
                  maxLength={20}
                  style={styles.textInput}
                  onFocus={() => setFocusedField('account')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
              <Text style={styles.inputHint}>
                Debe tener 20 dígitos. Los primeros 4 deben coincidir con el banco seleccionado
                {selectedBank ? ` (${selectedBank.code})` : ''}.
              </Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.formActions}>
            <Pressable
              onPress={() => {
                resetForm();
                setViewMode('list');
              }}
              style={({ pressed }) => [styles.formCancelBtn, pressed && styles.formCancelBtnPressed]}
            >
              <Text style={styles.formCancelBtnText}>Cancelar</Text>
            </Pressable>

            <Pressable
              onPress={handleSave}
              style={({ pressed }) => [
                styles.formSaveBtn,
                { backgroundColor: formAccent, shadowColor: formAccent },
                pressed && styles.formSaveBtnPressed,
              ]}
            >
              <Text style={styles.formSaveBtnText}>Guardar Datos</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}

      {/* Bank modal list */}
      <Modal
        visible={bankModalVisible}
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setBankModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setBankModalVisible(false)} hitSlop={10} style={styles.modalBackBtn}>
              <X size={22} color={COLORS.text} />
            </Pressable>
            <Text style={styles.modalTitle}>Seleccionar Banco</Text>
            <View style={styles.spacer} />
          </View>

          <View style={styles.modalIntro}>
            <Text style={styles.modalIntroTitle}>Banco destino</Text>
            <Text style={styles.modalIntroText}>{filteredBanks.length} bancos disponibles</Text>
          </View>

          <View style={[styles.searchContainer, focusedField === 'bankSearch' && { borderColor: COLORS.bcvGreen + '80' }]}>
            <Search size={18} color={COLORS.textSecondary} style={styles.searchIcon} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Buscar banco..."
              placeholderTextColor={COLORS.textSecondary}
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
              onFocus={() => setFocusedField('bankSearch')}
              onBlur={() => setFocusedField(null)}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={6} style={styles.searchClearBtn}>
                <X size={16} color={COLORS.textSecondary} />
              </Pressable>
            )}
          </View>

          <FlatList
            data={filteredBanks}
            keyExtractor={(item) => item.code}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.bankListContent}
            renderItem={({ item }) => {
              const hasLogo = !!BANK_LOGOS[item.code];
              const logo = BANK_LOGOS[item.code];
              const isSelected = selectedBank?.code === item.code;

              return (
                <Pressable
                  onPress={() => {
                    setSelectedBank(item);
                    // Proactively pre-fill the first 4 digits of the account number for convenience!
                    if (accountType !== 'pago_movil') {
                      setAccountNumber((cur) => {
                        if (cur.length <= 4) return item.code;
                        return item.code + cur.substring(4);
                      });
                    }
                    setBankModalVisible(false);
                    setSearchQuery('');
                  }}
                  style={({ pressed }) => [
                    styles.bankItem,
                    isSelected && styles.bankItemActive,
                    pressed && styles.bankItemPressed,
                  ]}
                >
                  <View style={[styles.bankLogoContainerMini, { backgroundColor: hasLogo ? 'transparent' : COLORS.bcvGreen + '1A' }]}>
                    {hasLogo ? (
                      <Image source={logo} style={styles.bankLogoMini} resizeMode="contain" />
                    ) : (
                      <Building2 size={18} color={COLORS.bcvGreen} />
                    )}
                  </View>
                  <View style={styles.bankItemInfo}>
                    <Text style={[styles.bankItemName, isSelected && styles.bankItemNameActive]}>
                      {item.name}
                    </Text>
                    <Text style={styles.bankItemCode}>Código: {item.code}</Text>
                  </View>
                  {isSelected && (
                    <View style={styles.selectedMark}>
                      <Check size={14} color={COLORS.bcvGreen} />
                    </View>
                  )}
                </Pressable>
              );
            }}
          />
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // Transparente: el panel (SheetModal) aporta el fondo translúcido sobre el blur.
    backgroundColor: 'transparent',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },

  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 42,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.divider,
    paddingHorizontal: 24,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.16,
        shadowRadius: 18,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  emptyIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 18,
    backgroundColor: COLORS.bcvGreen + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: COLORS.bcvGreen + '24',
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: 26,
    textAlign: 'center',
    lineHeight: 21,
  },
  addButton: {
    flexDirection: 'row',
    minHeight: 50,
    backgroundColor: COLORS.bcvGreen,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    alignSelf: 'stretch',
  },
  addButtonText: {
    color: '#1c1c1e',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 6,
  },
  listToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  sectionEyebrow: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  listTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
  },
  addPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: COLORS.bcvGreen,
    paddingHorizontal: 14,
  },
  addPillText: {
    color: '#1c1c1e',
    fontSize: 13,
    fontWeight: '800',
    marginLeft: 5,
  },
  // Card List Styles
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.divider,
    marginBottom: 16,
    overflow: 'hidden',
    position: 'relative',
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
  cardWash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 92,
  },
  cardInner: {
    flex: 1,
    padding: 17,
    zIndex: 1,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  bankLogoBox: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  bankLogo: {
    width: 30,
    height: 30,
  },
  bankMeta: {
    flex: 1,
    marginLeft: 12,
  },
  bankNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bankName: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '800',
  },
  bankCodeText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  holderName: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.2,
    marginBottom: 12,
  },
  fieldsBox: {
    backgroundColor: COLORS.glass,
    borderRadius: 12,
    marginBottom: 15,
    overflow: 'hidden',
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  fieldRowPressed: {
    backgroundColor: COLORS.glassStrong,
  },
  fieldDivider: {
    height: 1,
    backgroundColor: COLORS.divider,
    marginHorizontal: 14,
  },
  fieldTextWrap: {
    flex: 1,
    marginRight: 12,
  },
  fieldLabel: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  fieldValue: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
  },
  copyIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 38,
    paddingHorizontal: 15,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  shareBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  iconActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: COLORS.glass,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  iconBtnDanger: {
    backgroundColor: COLORS.negative + '10',
    borderColor: COLORS.negative + '24',
  },
  // Form Styles
  formHeader: {
    marginBottom: 14,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 7,
    paddingRight: 8,
  },
  backBtnText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  formHero: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.divider,
    padding: 16,
    marginBottom: 20,
  },
  formHeroIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  formHeroCopy: {
    flex: 1,
  },
  formHeroTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 3,
  },
  formHeroSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  typeSelectorRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 18,
    marginTop: 8,
  },
  typeSelectBtn: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 70,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.divider,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  typeSelectBtnText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '800',
  },
  typeIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: COLORS.glass,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  typeCopy: {
    flex: 1,
  },
  typeSelectHint: {
    color: COLORS.textSecondary,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 3,
  },
  subTypeContainer: {
    backgroundColor: COLORS.glass,
    borderRadius: 16,
    padding: 13,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  subTypeLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 8,
  },
  subTypeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  subTypeBtn: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    backgroundColor: COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  subTypeBtnText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  formGroup: {
    marginBottom: 18,
  },
  inputLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  bankSelector: {
    flexDirection: 'row',
    minHeight: 56,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.divider,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  bankSelectorPressed: {
    opacity: 0.8,
  },
  selectedBankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  bankLogoContainerMini: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  bankLogoMini: {
    width: 20,
    height: 20,
  },
  selectedBankText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 10,
    flex: 1,
  },
  bankPlaceholderText: {
    color: COLORS.textSecondary,
    fontSize: 15,
  },
  inputWrapper: {
    flexDirection: 'row',
    minHeight: 56,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.divider,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    height: '100%',
    padding: 0,
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  idInputWrapper: {
    flex: 1,
    marginLeft: 10,
  },
  prefixGroup: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.divider,
    minHeight: 56,
    alignItems: 'center',
  },
  prefixButton: {
    width: 36,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefixButtonActive: {
    backgroundColor: COLORS.bcvGreen + '24',
  },
  prefixText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  prefixTextActive: {
    color: COLORS.bcvGreen,
  },
  inputHint: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 7,
    marginLeft: 4,
    opacity: 0.8,
  },
  formActions: {
    flexDirection: 'row',
    marginTop: 30,
    gap: 12,
  },
  formCancelBtn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.divider,
    backgroundColor: COLORS.glass,
  },
  formCancelBtnPressed: {
    opacity: 0.7,
  },
  formCancelBtnText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
  },
  formSaveBtn: {
    flex: 2,
    height: 52,
    backgroundColor: COLORS.bcvGreen,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: COLORS.bcvGreen,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 14,
      },
      android: {
        elevation: 3,
      },
    }),
  },
  formSaveBtnPressed: {
    opacity: 0.85,
  },
  formSaveBtnText: {
    color: '#1c1c1e',
    fontSize: 15,
    fontWeight: '700',
  },
  // Modal bank selection
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
  },
  modalBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  spacer: {
    width: 40,
  },
  modalIntro: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 2,
  },
  modalIntroTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: '800',
  },
  modalIntroText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    minHeight: 50,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    height: '100%',
    padding: 0,
  },
  searchClearBtn: {
    padding: 4,
  },
  bankListContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  bankItem: {
    flexDirection: 'row',
    paddingVertical: 13,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.divider,
    borderRadius: 16,
    backgroundColor: COLORS.card,
    marginBottom: 10,
  },
  bankItemActive: {
    backgroundColor: COLORS.bcvGreen + '10',
    borderColor: COLORS.bcvGreen + '55',
  },
  bankItemPressed: {
    opacity: 0.82,
  },
  bankItemInfo: {
    marginLeft: 14,
    flex: 1,
  },
  bankItemName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  bankItemNameActive: {
    color: COLORS.bcvGreen,
    fontWeight: '700',
  },
  bankItemCode: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  selectedMark: {
    width: 26,
    height: 26,
    borderRadius: 9,
    backgroundColor: COLORS.bcvGreen + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 10,
  },
});
