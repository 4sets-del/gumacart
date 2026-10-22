import React, { useEffect } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
// Import only the three weights used, so the other 15 font files aren't bundled.
import { Poppins_600SemiBold } from '@expo-google-fonts/poppins/600SemiBold';
import { Poppins_700Bold } from '@expo-google-fonts/poppins/700Bold';
import { Poppins_800ExtraBold } from '@expo-google-fonts/poppins/800ExtraBold';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import AppNavigator from './navigation/AppNavigator';
import OfflineNotice from './components/OfflineNotice';
import ErrorBoundary from './components/ErrorBoundary';
import { initCrashReporting } from './utils/crashReporting';

// Start crash reporting first so errors during startup are captured too.
initCrashReporting();

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
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SafeAreaProvider>
      <ThemeProvider>
      <AuthProvider>
        <RootStatusBar />
        <ErrorBoundary>
          <AppNavigator />
        </ErrorBoundary>
        <OfflineNotice />
      </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Transparent status bar on every screen: each screen paints its own color
// behind it and picks light or dark icons to match (dark icons by default in
// light mode, light icons in dark mode).
function RootStatusBar() {
  const { COLORS } = useTheme();
  return <StatusBar translucent backgroundColor="transparent" barStyle={COLORS.statusBar} hidden={false} />;
}
