import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Database, Settings, Smartphone } from 'lucide-react-native';
import { COLORS } from '../theme/colors';

export type MenuKey = 'fuentes' | 'pago' | 'ajustes';

const ITEMS: { key: MenuKey; label: string; icon: React.ComponentType<{ size?: number; color?: string }> }[] = [
  { key: 'fuentes', label: 'Fuentes', icon: Database },
  { key: 'pago', label: 'Mis datos de pago móvil', icon: Smartphone },
  { key: 'ajustes', label: 'Ajustes', icon: Settings },
];

interface Props {
  visible: boolean;
  topOffset: number;
  onClose: () => void;
  onSelect: (key: MenuKey) => void;
}

export function HeaderMenu({ visible, topOffset, onClose, onSelect }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.menu, { top: topOffset }]}>
        {ITEMS.map((it, i) => (
          <Pressable
            key={it.key}
            style={({ pressed }) => [
              styles.item,
              i > 0 && styles.itemBorderTop,
              pressed && styles.itemPressed,
            ]}
            onPress={() => onSelect(it.key)}
          >
            <it.icon size={19} color={COLORS.text} />
            <Text style={styles.itemText}>{it.label}</Text>
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  menu: {
    position: 'absolute',
    right: 20,
    minWidth: 240,
    backgroundColor: COLORS.cardElevated,
    borderRadius: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.divider,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  itemBorderTop: {
    borderTopWidth: 1,
    borderTopColor: COLORS.divider,
  },
  itemPressed: {
    backgroundColor: COLORS.glass,
  },
  itemText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 14,
  },
});
