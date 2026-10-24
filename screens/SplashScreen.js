import React, { useEffect, useState } from 'react';
import { StyleSheet, Animated, StatusBar, ActivityIndicator, ImageBackground } from 'react-native';

// Shown while the session loads, right after Android's system splash (which
// can only show the logo circle, assets/splash-icon.png). The full design,
// assets/splash.jpg, has that circle at the same spot, so the waves, name and
// campus simply appear around the logo. Regenerate both with
// scripts/make-splash.sh.
export default function SplashScreen() {
  const [spinner] = useState(() => new Animated.Value(0));

  useEffect(() => {
    // Only show the spinner if loading takes a moment.
    Animated.timing(spinner, { toValue: 1, duration: 300, delay: 400, useNativeDriver: true }).start();
  }, [spinner]);

  return (
    <ImageBackground source={require('../assets/splash.jpg')} style={styles.container} resizeMode="cover">
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <Animated.View style={[styles.spinner, { opacity: spinner }]}>
        <ActivityIndicator size="small" color="#14532B" />
      </Animated.View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6FAF7' },
  // Just below "Southern Luzon State University · Gumaca" in splash.jpg.
  spinner: { position: 'absolute', top: '71.5%', left: 0, right: 0, alignItems: 'center' },
});
