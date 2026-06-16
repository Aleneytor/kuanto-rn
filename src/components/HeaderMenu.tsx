import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Settings, Smartphone } from 'lucide-react-native';
import { COLORS } from '../theme/colors';

export type MenuKey = 'pago' | 'ajustes';

const ITEMS: { key: MenuKey; label: string; icon: React.ComponentType<{ size?: number; color?: string }> }[] = [
  { key: 'pago', label: 'Mis datos', icon: Smartphone },
  { key: 'ajustes', label: 'Ajustes', icon: Settings },
];

interface Props {
  visible: boolean;
  topOffset: number;
  onClose: () => void;
  onSelect: (key: MenuKey) => void;
  /** Resalta un ítem (tutorial): fondo verde + pill "Empieza aquí". */
  highlightKey?: MenuKey;
}

/**
 * Menú desplegable anclado arriba-derecha. Se renderiza como overlay dentro de
 * la vista (no como Modal nativo) para que cerrarlo sea instantáneo y no retrase
 * la apertura de la pantalla destino (que sí es un Modal).
 */
export function HeaderMenu({ visible, topOffset, onClose, onSelect, highlightKey }: Props) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      anim.setValue(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, anim]);

  if (!visible) return null;

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <Animated.View
        style={[styles.menu, { top: topOffset, opacity: anim, transform: [{ translateY }] }]}
      >
        {ITEMS.map((it, i) => {
          const highlighted = it.key === highlightKey;
          return (
            <Pressable
              key={it.key}
              style={({ pressed }) => [
                styles.item,
                i > 0 && styles.itemBorderTop,
                highlighted && styles.itemHighlight,
                pressed && styles.itemPressed,
              ]}
              onPress={() => onSelect(it.key)}
            >
              <it.icon size={19} color={highlighted ? COLORS.bcvGreen : COLORS.text} />
              <Text style={[styles.itemText, highlighted && styles.itemTextHighlight]}>
                {it.label}
              </Text>
              {highlighted && (
                <View style={styles.hintPill}>
                  <Text style={styles.hintPillText}>Empieza aquí</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </Animated.View>
    </View>
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
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 14,
  },
  itemTextHighlight: {
    color: COLORS.bcvGreen,
  },
  itemHighlight: {
    backgroundColor: COLORS.bcvGreen + '14',
  },
  hintPill: {
    backgroundColor: COLORS.bcvGreen,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginLeft: 8,
  },
  hintPillText: {
    color: '#0a1a0e',
    fontSize: 11,
    fontWeight: '800',
  },
});
