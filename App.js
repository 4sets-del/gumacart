import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './context/AuthContext';
import AppNavigator from './navigation/AppNavigator';
import OfflineNotice from './components/OfflineNotice';

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" backgroundColor="#FFFFFF" />
        <AppNavigator />
        <OfflineNotice />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
