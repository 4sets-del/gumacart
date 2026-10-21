import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './context/AuthContext';
import AppNavigator from './navigation/AppNavigator';
import OfflineNotice from './components/OfflineNotice';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        {/* Transparent status bar on every screen: each screen paints its own
            color behind it and picks light or dark icons to match. */}
        <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" hidden={false} />
        <AppNavigator />
        <OfflineNotice />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
