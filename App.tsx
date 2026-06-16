import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { Poppins_400Regular } from '@expo-google-fonts/poppins/400Regular';
import { Poppins_500Medium } from '@expo-google-fonts/poppins/500Medium';
import { Poppins_600SemiBold } from '@expo-google-fonts/poppins/600SemiBold';
import { Poppins_700Bold } from '@expo-google-fonts/poppins/700Bold';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RatesProvider } from './src/context/RatesContext';
import { HomeScreen } from './src/screens/HomeScreen';
import { bootstrapNotifications } from './src/services/notificationService';

export default function App() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  // Re-arma recordatorios USDT y refresca el push token según preferencias.
  useEffect(() => {
    bootstrapNotifications();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <RatesProvider>
        <StatusBar style="light" />
        <HomeScreen />
      </RatesProvider>
    </SafeAreaProvider>
  );
}
