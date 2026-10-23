import React, { useEffect, useState } from 'react';
import { StyleSheet, Animated, StatusBar, ActivityIndicator, ImageBackground } from 'react-native';

// Shown while the session loads, right after the native splash screen. It
// draws the very same image (assets/splash.png) so the hand-off is seamless,
// and adds a spinner under the tagline.
export default function SplashScreen() {
  const [spinner] = useState(() => new Animated.Value(0));

  useEffect(() => {
    // Only show the spinner if loading takes a moment.
    Animated.timing(spinner, { toValue: 1, duration: 300, delay: 400, useNativeDriver: true }).start();
  }, [spinner]);

  return (
    <ImageBackground source={require('../assets/splash.png')} style={styles.container} resizeMode="cover">
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
      <Animated.View style={[styles.spinner, { opacity: spinner }]}>
        <ActivityIndicator size="small" color="#14532B" />
      </Animated.View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F9F5' },
  // Just below "Southern Luzon State University · Gumaca" in splash.png.
  spinner: { position: 'absolute', top: '66.5%', left: 0, right: 0, alignItems: 'center' },
});
