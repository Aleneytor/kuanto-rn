import React, { useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
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
import {
  BANK_LOGOS,
  VENEZUELAN_BANKS,
  type Bank,
  type PaymentMethod,
  type AccountType,
} from '../constants/banks';

const STORAGE_KEY = '@payment_methods_data';
// iOS: id de la barra "Listo" sobre el teclado numérico (que no trae botón de cerrar).
const KEYBOARD_ACCESSORY_ID = 'kuanto-keyboard-done';
const ID_PREFIXES = ['V', 'E', 'J', 'G'] as const;
type IdPrefix = (typeof ID_PREFIXES)[number];

// Inserta un espacio cada 4 dígitos para legibilidad del número de cuenta.
const formatLongNumber = (value: string) => value.replace(/(\d{4})(?=\d)/g, '$1 ').trim();

const getMethodVisuals = (type: AccountType) => {
  const isPagoMovil = type === 'pago_movil';
  return {
    accent: isPagoMovil ? COLORS.bcvGreen : COLORS.euroBlue,
    label: isPagoMovil
      ? 'PAGO MÓVIL'
      : type === 'cuenta_corriente'
      ? 'CTA. CORRIENTE'
      : 'CTA. AHORRO',
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
  initialMode = 'list',
  initialEditingId = null,
}: Props) {
  const [viewMode, setViewMode] = useState<'list' | 'form'>(initialMode);
  const [editingId, setEditingId] = useState<string | null>(initialEditingId);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Formulario
  const [accountType, setAccountType] = useState<AccountType>('pago_movil');
  const [selectedBank, setSelectedBank] = useState<Bank | null>(null);
  const [holderName, setHolderName] = useState('');
  const [idPrefix, setIdPrefix] = useState<IdPrefix>('V');
  const [holderId, setHolderId] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

  // Buscador de banco (overlay en pantalla, no Modal nativo anidado)
  const [bankPickerVisible, setBankPickerVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isTransfer = accountType === 'cuenta_corriente' || accountType === 'cuenta_ahorro';
  const formAccent = accountType === 'pago_movil' ? COLORS.bcvGreen : COLORS.euroBlue;

  // Carga el método a editar en el formulario.
  useEffect(() => {
    if (!editingId) return;
    const method = paymentMethods.find((m) => m.id === editingId);
    if (!method) return;
    setAccountType(method.type);
    setSelectedBank({ code: method.bankCode, name: method.bankName });
    setHolderName(method.holderName);
    setIdPrefix((method.idPrefix || 'V') as IdPrefix);
    setHolderId(method.holderId);
    setPhoneNumber(method.phoneNumber || '');
    setAccountNumber(method.accountNumber || '');
    setViewMode('form');
  }, [editingId, paymentMethods]);

  const copyField = async (key: string, value: string) => {
    await Clipboard.setStringAsync(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 1400);
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

  const startAdd = () => {
    resetForm();
    setViewMode('form');
  };

  const backToList = () => {
    resetForm();
    setViewMode('list');
  };

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
          `Los primeros 4 dígitos de la cuenta deben ser el código del banco (${selectedBank.code}).`
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
      ...(accountType === 'pago_movil'
        ? { phoneNumber: cleanPhone }
        : { accountNumber: cleanAccount }),
    };

    try {
      const updatedList = editingId
        ? paymentMethods.map((m) => (m.id === editingId ? newMethod : m))
        : [...paymentMethods, newMethod];
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));
      await onRefresh();
      backToList();
      Alert.alert('Guardado', 'Los datos de pago se guardaron correctamente.');
    } catch (err) {
      console.error('Error saving payment method:', err);
      Alert.alert('Error', 'No se pudieron guardar los datos.');
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert('Eliminar método', '¿Estás seguro de que deseas borrar este método de pago?', [
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
    ]);
  };

  const handleShare = async (item: PaymentMethod) => {
    const bankDisplay = `${item.bankName} (${item.bankCode})`;
    let message = '';
    if (item.type === 'pago_movil') {
      message += `Pago Movil ${item.holderName}\n\n`;
      message += ` ${bankDisplay}\n`;
      message += ` ${item.idPrefix}-${item.holderId}\n`;
      message += ` ${item.phoneNumber}\n`;
    } else {
      const typeLabel = item.type === 'cuenta_corriente' ? 'Cuenta Corriente' : 'Cuenta de Ahorro';
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
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) || b.code.includes(searchQuery)
  );

  const selectBank = (bank: Bank) => {
    setSelectedBank(bank);
    // Prerellena los primeros 4 dígitos (código de banco) en transferencias.
    if (accountType !== 'pago_movil') {
      setAccountNumber((cur) => (cur.length <= 4 ? bank.code : bank.code + cur.substring(4)));
    }
    setBankPickerVisible(false);
    setSearchQuery('');
  };

  const closeBankPicker = () => {
    setBankPickerVisible(false);
    setSearchQuery('');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.container}
    >
      {viewMode === 'list' ? (
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {paymentMethods.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <CreditCard size={30} color={COLORS.bcvGreen} />
              </View>
              <Text style={styles.emptyTitle}>Sin métodos guardados</Text>
              <Text style={styles.emptyText}>
                Agrega un método de pago móvil o una cuenta bancaria para tenerlo a mano.
              </Text>
              <Pressable onPress={startAdd} style={styles.primaryBtn}>
                <Plus size={18} color="#0a1a0e" />
                <Text style={styles.primaryBtnText}>Agregar método</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.toolbar}>
                <Text style={styles.toolbarTitle}>Métodos guardados</Text>
                <Pressable onPress={startAdd} style={styles.addPill}>
                  <Plus size={16} color="#0a1a0e" />
                  <Text style={styles.addPillText}>Agregar</Text>
                </Pressable>
              </View>

              {paymentMethods.map((item) => {
                const logo = BANK_LOGOS[item.bankCode];
                const isPM = item.type === 'pago_movil';
                const visuals = getMethodVisuals(item.type);
                const idKey = `${item.id}-id`;
                const contactKey = `${item.id}-contact`;
                const contactValue = isPM ? item.phoneNumber! : item.accountNumber!;
                const contactDisplay = isPM ? contactValue : formatLongNumber(contactValue);

                return (
                  <View key={item.id} style={[styles.card, { borderLeftColor: visuals.accent }]}>
                    <View style={styles.cardTop}>
                      <View
                        style={[
                          styles.logoBox,
                          { backgroundColor: logo ? '#fff' : visuals.accent + '20' },
                        ]}
                      >
                        {logo ? (
                          <Image source={logo} style={styles.logo} resizeMode="contain" />
                        ) : (
                          <Building2 size={20} color={visuals.accent} />
                        )}
                      </View>
                      <View style={styles.cardMeta}>
                        <Text style={styles.bankName} numberOfLines={1}>
                          {item.bankName}
                        </Text>
                        <View style={[styles.badge, { backgroundColor: visuals.accent + '18' }]}>
                          <Text style={[styles.badgeText, { color: visuals.accent }]}>
                            {visuals.label}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <Text style={styles.holder} numberOfLines={1}>
                      {item.holderName}
                    </Text>

                    <Pressable
                      onPress={() => copyField(idKey, `${item.idPrefix}-${item.holderId}`)}
                      style={({ pressed }) => [styles.field, pressed && styles.pressed]}
                    >
                      <View style={styles.fieldText}>
                        <Text style={styles.fieldLabel}>Cédula / RIF</Text>
                        <Text style={styles.fieldValue} numberOfLines={1}>
                          {item.idPrefix}-{item.holderId}
                        </Text>
                      </View>
                      {copiedKey === idKey ? (
                        <Check size={16} color={visuals.accent} />
                      ) : (
                        <Copy size={16} color={COLORS.textSecondary} />
                      )}
                    </Pressable>

                    <Pressable
                      onPress={() => copyField(contactKey, contactValue)}
                      style={({ pressed }) => [styles.field, pressed && styles.pressed]}
                    >
                      <View style={styles.fieldText}>
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
                      {copiedKey === contactKey ? (
                        <Check size={16} color={visuals.accent} />
                      ) : (
                        <Copy size={16} color={COLORS.textSecondary} />
                      )}
                    </Pressable>

                    <View style={styles.cardFooter}>
                      <Pressable
                        onPress={() => handleShare(item)}
                        style={[
                          styles.shareBtn,
                          { borderColor: visuals.accent + '45', backgroundColor: visuals.accent + '12' },
                        ]}
                      >
                        <Share2 size={14} color={visuals.accent} />
                        <Text style={[styles.shareBtnText, { color: visuals.accent }]}>Compartir</Text>
                      </Pressable>
                      <Pressable onPress={() => setEditingId(item.id)} hitSlop={8} style={styles.iconBtn}>
                        <Edit2 size={16} color={COLORS.textSecondary} />
                      </Pressable>
                      <Pressable onPress={() => handleDelete(item.id)} hitSlop={8} style={styles.iconBtn}>
                        <Trash2 size={16} color={COLORS.negative} />
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <Pressable onPress={backToList} style={styles.back} hitSlop={8}>
            <ArrowLeft size={20} color={COLORS.text} />
            <Text style={styles.backText}>Volver a la lista</Text>
          </Pressable>

          <Text style={styles.formTitle}>{editingId ? 'Editar método' : 'Nuevo método'}</Text>

          <Text style={styles.label}>¿QUÉ DESEAS AGREGAR?</Text>
          <View style={styles.typeRow}>
            <Pressable
              onPress={() => setAccountType('pago_movil')}
              style={[
                styles.typeBtn,
                accountType === 'pago_movil' && {
                  borderColor: COLORS.bcvGreen + '66',
                  backgroundColor: COLORS.bcvGreen + '10',
                },
              ]}
            >
              <Phone size={18} color={accountType === 'pago_movil' ? COLORS.bcvGreen : COLORS.textSecondary} />
              <Text style={[styles.typeBtnText, accountType === 'pago_movil' && { color: COLORS.bcvGreen }]}>
                Pago Móvil
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setAccountType('cuenta_corriente')}
              style={[
                styles.typeBtn,
                isTransfer && { borderColor: COLORS.euroBlue + '66', backgroundColor: COLORS.euroBlue + '10' },
              ]}
            >
              <CreditCard size={18} color={isTransfer ? COLORS.euroBlue : COLORS.textSecondary} />
              <Text style={[styles.typeBtnText, isTransfer && { color: COLORS.euroBlue }]}>Transferencia</Text>
            </Pressable>
          </View>

          {isTransfer && (
            <View style={styles.subRow}>
              <Pressable
                onPress={() => setAccountType('cuenta_corriente')}
                style={[
                  styles.subBtn,
                  accountType === 'cuenta_corriente' && {
                    backgroundColor: COLORS.euroBlue + '18',
                    borderColor: COLORS.euroBlue + '60',
                  },
                ]}
              >
                <Text style={[styles.subBtnText, accountType === 'cuenta_corriente' && { color: COLORS.text }]}>
                  Corriente
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setAccountType('cuenta_ahorro')}
                style={[
                  styles.subBtn,
                  accountType === 'cuenta_ahorro' && {
                    backgroundColor: COLORS.euroBlue + '18',
                    borderColor: COLORS.euroBlue + '60',
                  },
                ]}
              >
                <Text style={[styles.subBtnText, accountType === 'cuenta_ahorro' && { color: COLORS.text }]}>
                  Ahorro
                </Text>
              </Pressable>
            </View>
          )}

          <Text style={styles.label}>BANCO</Text>
          <Pressable
            onPress={() => setBankPickerVisible(true)}
            style={[styles.bankSelect, selectedBank && { borderColor: formAccent + '55' }]}
          >
            {selectedBank ? (
              <View style={styles.bankSelRow}>
                <View style={styles.bankSelLogo}>
                  {BANK_LOGOS[selectedBank.code] ? (
                    <Image source={BANK_LOGOS[selectedBank.code]} style={styles.bankSelLogoImg} resizeMode="contain" />
                  ) : (
                    <Building2 size={18} color={formAccent} />
                  )}
                </View>
                <Text style={styles.bankSelText} numberOfLines={1}>
                  {selectedBank.name} ({selectedBank.code})
                </Text>
              </View>
            ) : (
              <Text style={styles.bankPlaceholder}>Selecciona el banco</Text>
            )}
            <ChevronDown size={20} color={COLORS.textSecondary} />
          </Pressable>

          <Text style={styles.label}>TITULAR (NOMBRE Y APELLIDO)</Text>
          <View style={[styles.input, focusedField === 'holder' && { borderColor: formAccent + '88' }]}>
            <User size={18} color={focusedField === 'holder' ? formAccent : COLORS.textSecondary} />
            <TextInput
              value={holderName}
              onChangeText={setHolderName}
              placeholder="Ej. Juan Pérez"
              placeholderTextColor={COLORS.textSecondary}
              style={styles.inputText}
              autoCapitalize="words"
              onFocus={() => setFocusedField('holder')}
              onBlur={() => setFocusedField(null)}
            />
          </View>

          <Text style={styles.label}>CÉDULA DE IDENTIDAD / RIF</Text>
          <View style={styles.idRow}>
            <View style={styles.prefixGroup}>
              {ID_PREFIXES.map((p) => (
                <Pressable
                  key={p}
                  onPress={() => setIdPrefix(p)}
                  style={[styles.prefixBtn, idPrefix === p && { backgroundColor: formAccent + '24' }]}
                >
                  <Text style={[styles.prefixText, idPrefix === p && { color: formAccent }]}>{p}</Text>
                </Pressable>
              ))}
            </View>
            <View
              style={[styles.input, styles.idInput, focusedField === 'id' && { borderColor: formAccent + '88' }]}
            >
              <FileText size={18} color={focusedField === 'id' ? formAccent : COLORS.textSecondary} />
              <TextInput
                value={holderId}
                onChangeText={(t) => setHolderId(t.replace(/[^0-9]/g, ''))}
                placeholder="Ej. 12345678"
                placeholderTextColor={COLORS.textSecondary}
                keyboardType="numeric"
                inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
                style={styles.inputText}
                onFocus={() => setFocusedField('id')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </View>

          {accountType === 'pago_movil' ? (
            <>
              <Text style={styles.label}>TELÉFONO ASOCIADO</Text>
              <View style={[styles.input, focusedField === 'phone' && { borderColor: formAccent + '88' }]}>
                <Phone size={18} color={focusedField === 'phone' ? formAccent : COLORS.textSecondary} />
                <TextInput
                  value={phoneNumber}
                  onChangeText={(t) => setPhoneNumber(t.replace(/[^0-9]/g, ''))}
                  placeholder="Ej. 04121234567"
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="phone-pad"
                  maxLength={11}
                  inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
                  style={styles.inputText}
                  onFocus={() => setFocusedField('phone')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
              <Text style={styles.hint}>11 dígitos, empieza con 04 (ej. 04121234567).</Text>
            </>
          ) : (
            <>
              <Text style={styles.label}>NÚMERO DE CUENTA (20 DÍGITOS)</Text>
              <View style={[styles.input, focusedField === 'account' && { borderColor: formAccent + '88' }]}>
                <CreditCard size={18} color={focusedField === 'account' ? formAccent : COLORS.textSecondary} />
                <TextInput
                  value={accountNumber}
                  onChangeText={(t) => setAccountNumber(t.replace(/[^0-9]/g, ''))}
                  placeholder={selectedBank ? `${selectedBank.code}...` : '0102...'}
                  placeholderTextColor={COLORS.textSecondary}
                  keyboardType="numeric"
                  maxLength={20}
                  inputAccessoryViewID={KEYBOARD_ACCESSORY_ID}
                  style={styles.inputText}
                  onFocus={() => setFocusedField('account')}
                  onBlur={() => setFocusedField(null)}
                />
              </View>
              <Text style={styles.hint}>
                20 dígitos. Los primeros 4 deben coincidir con el banco
                {selectedBank ? ` (${selectedBank.code})` : ''}.
              </Text>
            </>
          )}

          <View style={styles.formActions}>
            <Pressable onPress={backToList} style={styles.cancelBtn}>
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </Pressable>
            <Pressable onPress={handleSave} style={[styles.saveBtn, { backgroundColor: formAccent }]}>
              <Text style={[styles.saveBtnText, { color: isTransfer ? '#fff' : '#0a1a0e' }]}>
                Guardar
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      )}

      {/* iOS: barra "Listo" sobre el teclado numérico (no tiene botón de cerrar) */}
      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={KEYBOARD_ACCESSORY_ID}>
          <View style={styles.accessory}>
            <Pressable onPress={() => Keyboard.dismiss()} hitSlop={8} style={styles.accessoryBtn}>
              <Text style={styles.accessoryText}>Listo</Text>
            </Pressable>
          </View>
        </InputAccessoryView>
      )}

      {/* Buscador de banco: overlay en pantalla (no Modal nativo anidado) */}
      {bankPickerVisible && (
        <View style={styles.picker}>
          <View style={styles.pickerHeader}>
            <Pressable onPress={closeBankPicker} hitSlop={10} style={styles.pickerBack}>
              <X size={22} color={COLORS.text} />
            </Pressable>
            <Text style={styles.pickerTitle}>Seleccionar banco</Text>
            <View style={styles.pickerHeaderSpacer} />
          </View>

          <View style={[styles.search, focusedField === 'bankSearch' && { borderColor: COLORS.bcvGreen + '80' }]}>
            <Search size={18} color={COLORS.textSecondary} />
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
              <Pressable onPress={() => setSearchQuery('')} hitSlop={6}>
                <X size={16} color={COLORS.textSecondary} />
              </Pressable>
            )}
          </View>

          <FlatList
            data={filteredBanks}
            keyExtractor={(b) => b.code}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.pickerList}
            renderItem={({ item }) => {
              const logo = BANK_LOGOS[item.code];
              const isSel = selectedBank?.code === item.code;
              return (
                <Pressable
                  onPress={() => selectBank(item)}
                  style={({ pressed }) => [styles.bankItem, isSel && styles.bankItemActive, pressed && styles.pressed]}
                >
                  <View style={[styles.bankItemLogo, { backgroundColor: logo ? '#fff' : COLORS.bcvGreen + '1A' }]}>
                    {logo ? (
                      <Image source={logo} style={styles.bankSelLogoImg} resizeMode="contain" />
                    ) : (
                      <Building2 size={18} color={COLORS.bcvGreen} />
                    )}
                  </View>
                  <View style={styles.bankItemInfo}>
                    <Text style={styles.bankItemName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.bankItemCode}>Código: {item.code}</Text>
                  </View>
                  {isSel && <Check size={16} color={COLORS.bcvGreen} />}
                </Pressable>
              );
            }}
          />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    padding: 20,
    paddingBottom: 40,
  },
  pressed: {
    opacity: 0.7,
  },

  // Estado vacío
  empty: {
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 18,
    backgroundColor: COLORS.bcvGreen + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
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
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 50,
    borderRadius: 14,
    backgroundColor: COLORS.bcvGreen,
    alignSelf: 'stretch',
  },
  primaryBtnText: {
    color: '#0a1a0e',
    fontSize: 15,
    fontWeight: '700',
  },

  // Lista
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  toolbarTitle: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '800',
  },
  addPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 38,
    borderRadius: 11,
    backgroundColor: COLORS.bcvGreen,
    paddingHorizontal: 14,
  },
  addPillText: {
    color: '#0a1a0e',
    fontSize: 13,
    fontWeight: '800',
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.divider,
    borderLeftWidth: 3,
    padding: 16,
    marginBottom: 14,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: {
    width: 30,
    height: 30,
  },
  cardMeta: {
    flex: 1,
    marginLeft: 12,
  },
  bankName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 5,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  holder: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '700',
    marginTop: 12,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.glass,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 8,
  },
  fieldText: {
    flex: 1,
    marginRight: 10,
  },
  fieldLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginBottom: 2,
  },
  fieldValue: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  shareBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
  },
  shareBtnText: {
    fontSize: 13,
    fontWeight: '700',
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },

  // Formulario
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  backText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  formTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  label: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginTop: 18,
    marginBottom: 8,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.divider,
    backgroundColor: COLORS.card,
  },
  typeBtnText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  subRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  subBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.divider,
    backgroundColor: COLORS.card,
  },
  subBtnText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '700',
  },
  bankSelect: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.divider,
    paddingHorizontal: 14,
    height: 56,
  },
  bankSelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  bankSelLogo: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginRight: 10,
  },
  bankSelLogoImg: {
    width: 24,
    height: 24,
  },
  bankSelText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  bankPlaceholder: {
    color: COLORS.textSecondary,
    fontSize: 15,
  },
  input: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.divider,
    paddingHorizontal: 14,
    height: 52,
  },
  inputText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    paddingVertical: 0,
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  prefixGroup: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.divider,
    overflow: 'hidden',
  },
  prefixBtn: {
    paddingHorizontal: 11,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefixText: {
    color: COLORS.textSecondary,
    fontWeight: '700',
    fontSize: 14,
  },
  idInput: {
    flex: 1,
  },
  hint: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 6,
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 28,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  cancelBtnText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '700',
  },
  saveBtn: {
    flex: 2,
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 14,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '800',
  },

  // Buscador de banco (overlay)
  picker: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.background,
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  pickerBack: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  pickerHeaderSpacer: {
    width: 40,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.divider,
    paddingHorizontal: 14,
    height: 50,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    paddingVertical: 0,
  },
  pickerList: {
    paddingBottom: 24,
  },
  bankItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 12,
    marginBottom: 6,
  },
  bankItemActive: {
    backgroundColor: COLORS.bcvGreen + '14',
  },
  bankItemLogo: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  bankItemInfo: {
    flex: 1,
  },
  bankItemName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  bankItemCode: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },

  // Barra "Listo" del teclado (iOS)
  accessory: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: COLORS.cardElevated,
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  accessoryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  accessoryText: {
    color: COLORS.bcvGreen,
    fontSize: 16,
    fontWeight: '700',
  },
});
