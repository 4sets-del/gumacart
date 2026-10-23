import React, { useRef, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { Image } from 'expo-image';

const MAX = 4;

// Full-screen photo you can pinch to zoom (up to 4×), drag around while
// zoomed, and double-tap to zoom in / reset. Dragging is only active while
// zoomed, so swiping between photos in a pager still works.
export default function ZoomableImage({ uri, style, onZoomChange }) {
  const [scale] = useState(() => new Animated.Value(1));
  const [tx] = useState(() => new Animated.Value(0));
  const [ty] = useState(() => new Animated.Value(0));
  const cur = useRef({ scale: 1, x: 0, y: 0, startScale: 1, startX: 0, startY: 0 });
  const [zoomed, setZoomed] = useState(false);

  const setZoom = (z) => { setZoomed(z); onZoomChange?.(z); };

  const animateTo = (s, x, y) => {
    cur.current.scale = s; cur.current.x = x; cur.current.y = y;
    Animated.parallel([
      Animated.spring(scale, { toValue: s, useNativeDriver: true, friction: 7 }),
      Animated.spring(tx, { toValue: x, useNativeDriver: true, friction: 7 }),
      Animated.spring(ty, { toValue: y, useNativeDriver: true, friction: 7 }),
    ]).start();
    setZoom(s > 1.01);
  };

  const pinch = Gesture.Pinch()
    .runOnJS(true)
    .onStart(() => { cur.current.startScale = cur.current.scale; })
    .onUpdate((e) => {
      const s = Math.min(Math.max(cur.current.startScale * e.scale, 0.8), MAX);
      cur.current.scale = s;
      scale.setValue(s);
    })
    .onEnd(() => {
      if (cur.current.scale <= 1) animateTo(1, 0, 0);
      else setZoom(true);
    });

  const pan = Gesture.Pan()
    .runOnJS(true)
    .enabled(zoomed)
    .onStart(() => { cur.current.startX = cur.current.x; cur.current.startY = cur.current.y; })
    .onUpdate((e) => {
      cur.current.x = cur.current.startX + e.translationX / cur.current.scale;
      cur.current.y = cur.current.startY + e.translationY / cur.current.scale;
      tx.setValue(cur.current.x);
      ty.setValue(cur.current.y);
    });

  const doubleTap = Gesture.Tap()
    .runOnJS(true)
    .numberOfTaps(2)
    .onEnd(() => (cur.current.scale > 1.01 ? animateTo(1, 0, 0) : animateTo(2.5, 0, 0)));

  // Its own gesture root: these viewers live in Modals, which on Android sit
  // outside the app's root gesture view.
  return (
    <GestureHandlerRootView style={style}>
      <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, doubleTap)}>
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale }, { translateX: tx }, { translateY: ty }] }]}>
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" cachePolicy="memory-disk" />
        </Animated.View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}
