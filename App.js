import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
// Import only the three weights used, so the other 15 font files aren't bundled.
import { Poppins_600SemiBold } from '@expo-google-fonts/poppins/600SemiBold';
import { Poppins_700Bold } from '@expo-google-fonts/poppins/700Bold';
import { Poppins_800ExtraBold } from '@expo-google-fonts/poppins/800ExtraBold';
import { AuthProvider } from './context/AuthContext';
import AppNavigator from './navigation/AppNavigator';
import OfflineNotice from './components/OfflineNotice';
import ErrorBoundary from './components/ErrorBoundary';

// Keep the native splash up until the fonts are ready, so text never
// flashes in the wrong font.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  const [fontsLoaded, fontError] = useFonts({ Poppins_600SemiBold, Poppins_700Bold, Poppins_800ExtraBold });
  const ready = fontsLoaded || !!fontError; // if a font fails, continue with the system font

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <AuthProvider>
        {/* Transparent status bar on every screen: each screen paints its own
            color behind it and picks light or dark icons to match. */}
        <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" hidden={false} />
        <ErrorBoundary>
          <AppNavigator />
        </ErrorBoundary>
        <OfflineNotice />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
