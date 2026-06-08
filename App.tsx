import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RatesProvider } from './src/context/RatesContext';
import { HomeScreen } from './src/screens/HomeScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <RatesProvider>
        <StatusBar style="light" />
        <HomeScreen />
      </RatesProvider>
    </SafeAreaProvider>
  );
}
