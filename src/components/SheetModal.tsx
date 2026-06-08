import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  BackHandler,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { X } from 'lucide-react-native';
import { COLORS } from '../theme/colors';

const SCREEN_H = Dimensions.get('window').height;

interface Props {
  visible: boolean;
  title: string;
  onClose: () => void;
  children?: ReactNode;
  /** Proporción de la altura de pantalla que ocupa el sheet (0–1). */
  heightRatio?: number;
}

/**
 * Hoja inferior (bottom sheet) que deja el contenido previo VISIBLE y DIFUMINADO
 * detrás. Se renderiza como overlay dentro del árbol de la vista (no como Modal
 * nativo) para que el BlurView componga y difumine el Home en la misma capa.
 * Solo el panel desliza hacia arriba; el backdrop hace fade. Se desmonta tras la
 * animación de salida para un cierre suave.
 */
export function SheetModal({ visible, title, onClose, children, heightRatio = 0.92 }: Props) {
  const insets = useSafeAreaInsets();
  const sheetH = Math.round(SCREEN_H * heightRatio);
  const anim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(anim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else if (mounted) {
      Animated.timing(anim, {
        toValue: 0,
        duration: 240,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Botón atrás de Android cierra la hoja.
  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  if (!mounted) return null;

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [sheetH + 60, 0],
  });

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Backdrop: Home difuminado */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: anim }]}>
        <BlurView
          intensity={Platform.OS === 'android' ? 18 : 32}
          tint="dark"
          experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.dim} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Panel */}
      <Animated.View
        style={[
          styles.sheet,
          { height: sheetH, paddingBottom: insets.bottom, transform: [{ translateY }] },
        ]}
      >
        <View style={styles.handle} />
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
            <X size={20} color={COLORS.text} />
          </Pressable>
        </View>
        <View style={styles.body}>{children}</View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    // Translúcido: deja ver el Home difuminado a través del panel (no negro sólido).
    backgroundColor: 'rgba(28,28,30,0.86)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderBottomWidth: 0,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.3,
        shadowRadius: 24,
      },
      android: {
        elevation: 24,
      },
    }),
  },
  handle: {
    width: 38,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignSelf: 'center',
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.text,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.glass,
    borderWidth: 1,
    borderColor: COLORS.divider,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
  },
});
