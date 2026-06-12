import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Smartphone } from 'lucide-react-native';
import { COLORS } from '../theme/colors';

interface Props {
  visible: boolean;
  onDismiss: () => void;
  /** Distancia desde arriba (normalmente insets.top + alto del header). */
  topOffset: number;
}

/**
 * Globo flotante (coach-mark) anclado bajo el botón de menú (☰), con una flechita
 * apuntando hacia él. No intrusivo: el resto de la pantalla sigue siendo usable
 * (`box-none`). Se descarta al tocarlo o tras unos segundos.
 */
export function CoachMark({ visible, onDismiss, topOffset }: Props) {
  const anim = useRef(new Animated.Value(0)).current; // entrada (fade + slide)
  const bob = useRef(new Animated.Value(0)).current; // flotación continua
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      anim.setValue(0);
      Animated.spring(anim, {
        toValue: 1,
        friction: 7,
        tension: 55,
        useNativeDriver: true,
      }).start();

      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(bob, { toValue: 1, duration: 950, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(bob, { toValue: 0, duration: 950, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ])
      );
      loop.start();

      const t = setTimeout(onDismiss, 8000);
      return () => {
        clearTimeout(t);
        loop.stop();
      };
    }
    if (mounted) {
      Animated.timing(anim, {
        toValue: 0,
        duration: 200,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!mounted) return null;

  const translateY = Animated.add(
    anim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }),
    bob.interpolate({ inputRange: [0, 1], outputRange: [0, -5] })
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View
        style={[styles.wrap, { top: topOffset, opacity: anim, transform: [{ translateY }] }]}
      >
        <View style={styles.arrow} />
        <Pressable onPress={onDismiss} style={styles.bubble}>
          <Smartphone size={18} color="#0a1a0e" />
          <Text style={styles.text}>Aquí puedes configurar tus datos de pago</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 16,
    maxWidth: 280,
  },
  arrow: {
    position: 'absolute',
    top: -7,
    right: 20,
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: COLORS.bcvGreen,
  },
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.bcvGreen,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  text: {
    color: '#0a1a0e',
    fontSize: 14,
    fontWeight: '700',
    flexShrink: 1,
  },
});
