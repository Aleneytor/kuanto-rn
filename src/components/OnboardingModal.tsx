import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Calculator, Smartphone, type LucideIcon } from 'lucide-react-native';
import { COLORS } from '../theme/colors';

interface Props {
  visible: boolean;
  /** Termina el tutorial (Saltar o "Empezar"). */
  onClose: () => void;
}

type Slide = {
  kind: 'logo' | 'icon';
  icon?: LucideIcon;
  accent?: string;
  title: string;
  desc: string;
};

const SLIDES: Slide[] = [
  {
    kind: 'logo',
    title: 'Bienvenido a Kuanto',
    desc: 'Las tasas de Venezuela —BCV (USD/EUR) y paralelo (USDT)— siempre a mano y al instante.',
  },
  {
    kind: 'icon',
    icon: Calculator,
    accent: COLORS.euroBlue,
    title: 'Calcula y comparte',
    desc: 'Toca cualquier tarjeta para convertir entre divisa y bolívares, y compártela en un toque.',
  },
  {
    kind: 'icon',
    icon: Smartphone,
    accent: COLORS.bcvGreen,
    title: 'Tus datos de pago, listos',
    desc: 'Guarda tu pago móvil o cuenta una sola vez y compártelos junto a la tasa cuando quieras.',
  },
];

export function OnboardingModal({ visible, onClose }: Props) {
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      setPage(0);
      Animated.timing(anim, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else if (mounted) {
      Animated.timing(anim, {
        toValue: 0,
        duration: 300,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!mounted) return null;

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });

  const isLast = page === SLIDES.length - 1;

  const goNext = () => {
    if (page < SLIDES.length - 1) {
      scrollRef.current?.scrollTo({ x: (page + 1) * width, animated: true });
    }
  };

  const onMomentumEnd = (e: { nativeEvent: { contentOffset: { x: number } } }) => {
    const p = Math.round(e.nativeEvent.contentOffset.x / width);
    if (p !== page) setPage(p);
  };

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: anim, transform: [{ scale }] }]}>
      <LinearGradient
        colors={[COLORS.bcvGreen + '1F', 'transparent']}
        style={styles.backdrop}
        pointerEvents="none"
      />
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Saltar */}
        <View style={styles.topBar}>
          <Pressable onPress={onClose} hitSlop={10} style={styles.skipBtn}>
            <Text style={styles.skipText}>Saltar</Text>
          </Pressable>
        </View>

        {/* Slides */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onMomentumEnd}
          style={styles.scroll}
        >
          {SLIDES.map((slide, i) => {
            const Icon = slide.icon;
            const accent = slide.accent ?? COLORS.bcvGreen;
            return (
              <View key={i} style={[styles.page, { width }]}>
                {slide.kind === 'logo' ? (
                  <Image
                    source={require('../../assets/kuanto-logo.png')}
                    style={styles.logo}
                    resizeMode="contain"
                    accessibilityLabel="Kuanto"
                  />
                ) : (
                  <View style={[styles.iconBadge, { backgroundColor: accent + '1A', borderColor: accent + '33' }]}>
                    {Icon ? <Icon size={44} color={accent} /> : null}
                  </View>
                )}
                <Text style={styles.title}>{slide.title}</Text>
                <Text style={styles.desc}>{slide.desc}</Text>
              </View>
            );
          })}
        </ScrollView>

        {/* Dots */}
        <View style={styles.dots}>
          {SLIDES.map((_, i) => (
            <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
          ))}
        </View>

        {/* CTA */}
        <View style={styles.cta}>
          {isLast ? (
            <Pressable onPress={onClose} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Empezar</Text>
            </Pressable>
          ) : (
            <Pressable onPress={goNext} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Continuar</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    backgroundColor: COLORS.background,
    zIndex: 100,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 380,
  },
  safe: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingTop: 8,
    height: 44,
  },
  skipBtn: {
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  skipText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
  },
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 36,
  },
  logo: {
    width: 230,
    height: 230 * (629 / 2504),
    marginBottom: 36,
  },
  iconBadge: {
    width: 116,
    height: 116,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 36,
  },
  title: {
    color: COLORS.text,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  desc: {
    color: COLORS.textSecondary,
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginTop: 14,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  dotActive: {
    width: 22,
    backgroundColor: COLORS.bcvGreen,
  },
  cta: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  primaryBtn: {
    height: 54,
    borderRadius: 16,
    backgroundColor: COLORS.bcvGreen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: {
    color: '#0a1a0e',
    fontSize: 16,
    fontWeight: '800',
  },
  laterBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginTop: 4,
  },
  laterText: {
    color: COLORS.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
});
