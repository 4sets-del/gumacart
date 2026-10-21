import React from 'react';
import { StatusBar, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

// For screens whose top is a photo: a soft dark fade behind the phone's
// status bar so the white clock/battery icons stay readable on any image.
export default function StatusBarScrim() {
  const insets = useSafeAreaInsets();
  return (
    <>
      <StatusBar barStyle="light-content" hidden={false} />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0.55)', 'rgba(0,0,0,0)']}
        style={[styles.scrim, { height: Math.max(insets.top, 24) + 56 }]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5 },
});
