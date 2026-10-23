import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { FONTS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

const PADDING = 8;
const TIP_W = 300;
const DIM = 'rgba(8,24,14,0.78)';
const HOLE = 2000; // border thickness: far bigger than any phone screen

// Interactive walkthrough: dims the screen, cuts a dashed "window" around one
// element at a time (measured live from a ref), and shows a speech-bubble
// tooltip with a step counter and Next / Back. The ✕ in the tooltip ends it.
//
// steps: [{ ref?, title, text, icon?, shape?: 'circle', optional? }]
//   ref.current must have measureInWindow (any View, or a fake one). Steps
//   without a ref show the tooltip in the middle of the screen.
//   optional steps are skipped when their target isn't on screen.
// originRef: a view whose top-left is the top-left of the screen (e.g. the
//   screen's root view). Android reports positions without the status bar,
//   while this overlay covers the whole screen, so we measure the origin too
//   and use the difference.
export default function CoachMark({ visible, steps, onFinish, originRef }) {
  const { COLORS, styles } = useTheme(createStyles);
  const [stepIndex, setStepIndex] = useState(0);
  const [target, setTarget] = useState(null);
  const [frame, setFrame] = useState(null); // size of the overlay itself
  const [fade] = useState(() => new Animated.Value(0));

  const step = steps?.[stepIndex];
  const isLast = stepIndex === (steps?.length || 0) - 1;
  const finish = useCallback(() => onFinish?.(), [onFinish]);
  const next = useCallback(() => (isLast ? finish() : setStepIndex((i) => i + 1)), [isLast, finish]);

  useEffect(() => { if (visible) setStepIndex(0); }, [visible]);

  // Measure the current step's element (after a short delay so layout settles).
  useEffect(() => {
    if (!visible || !step) return;
    setTarget(null);
    fade.setValue(0);
    const id = setTimeout(() => {
      const node = step.ref?.current;
      const done = (rect) => {
        setTarget(rect);
        Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
      };
      if (!node?.measureInWindow) { done(null); return; }
      const measureTarget = (ox, oy) => node.measureInWindow((x, y, width, height) => (
        done(width > 0 && height > 0 ? { x: x - ox, y: y - oy, width, height } : null)
      ));
      const origin = originRef?.current;
      if (origin?.measureInWindow) origin.measureInWindow((ox, oy) => measureTarget(ox || 0, oy || 0));
      else measureTarget(0, 0);
    }, 120);
    return () => clearTimeout(id);
  }, [visible, step, fade, originRef]);

  // Skip optional steps whose element is scrolled off screen.
  useEffect(() => {
    if (!visible || !step?.optional || !frame) return;
    const off = target && (target.y + target.height > frame.height - 90 || target.y < 0);
    if (off) next();
  }, [visible, step, target, frame, next]);

  if (!visible || !steps?.length || !step) return null;

  const W = frame?.width || 0;
  const H = frame?.height || 0;
  const circle = step.shape === 'circle';
  let box = null;
  if (target) {
    const pad = circle ? PADDING + 2 : PADDING;
    if (circle) {
      const size = Math.max(target.width, target.height) + pad * 2;
      box = { x: target.x + target.width / 2 - size / 2, y: target.y + target.height / 2 - size / 2, width: size, height: size, r: size / 2 };
    } else {
      box = { x: Math.max(target.x - pad, 4), y: Math.max(target.y - pad, 4), width: target.width + pad * 2, height: target.height + pad * 2, r: 16 };
      box.width = Math.min(box.width, W - box.x - 4);
    }
  }

  const below = box ? box.y + box.height / 2 < H / 2 : true;
  const centerX = box ? box.x + box.width / 2 : W / 2;
  const tipLeft = Math.min(Math.max(centerX - TIP_W / 2, 16), Math.max(W - TIP_W - 16, 16));
  const arrowLeft = Math.min(Math.max(centerX - tipLeft - 10, 18), TIP_W - 38);

  return (
    <Modal statusBarTranslucent visible={visible} transparent animationType="fade" onRequestClose={finish}>
      <View style={StyleSheet.absoluteFill} onLayout={(e) => setFrame(e.nativeEvent.layout)}>
        {!box ? (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: DIM }]} />
        ) : (
          <>
            {/* One huge border around the target = dark everywhere except a
                rounded hole over the highlighted element. */}
            <View
              pointerEvents="auto"
              style={{
                position: 'absolute', borderColor: DIM, borderWidth: HOLE,
                top: box.y - HOLE, left: box.x - HOLE, width: box.width + HOLE * 2, height: box.height + HOLE * 2,
                borderRadius: box.r + HOLE,
              }}
            />
            <View pointerEvents="none" style={[styles.spotlight, { top: box.y, left: box.x, width: box.width, height: box.height, borderRadius: box.r }]} />
          </>
        )}

        {frame ? (
          <Animated.View
            pointerEvents="box-none"
            style={[
              styles.tipWrap,
              { left: tipLeft, opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [below ? -6 : 6, 0] }) }] },
              !box ? { top: H / 2 - 130 } : below ? { top: box.y + box.height + 14 } : { bottom: H - box.y + 14 },
            ]}
          >
            {box ? (
              <View style={[styles.arrow, { left: arrowLeft }, below ? styles.arrowUp : styles.arrowDown]} />
            ) : null}
            <View style={styles.tip}>
              {!box && step.icon ? (
                <View style={styles.hero}><Ionicons name={step.icon} size={32} color={COLORS.primary} /></View>
              ) : null}
              <View style={styles.tipHeader}>
                {step.icon && box ? (
                  <View style={styles.tipIcon}><Ionicons name={step.icon} size={16} color={COLORS.primary} /></View>
                ) : null}
                <Text style={styles.tipTitle}>{step.title}</Text>
                <TouchableOpacity onPress={finish} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel="End tour">
                  <Ionicons name="close" size={16} color={COLORS.textSecondary} />
                </TouchableOpacity>
              </View>
              <Text style={styles.tipText}>{step.text}</Text>
              <View style={styles.tipFooter}>
                <Text style={styles.counter}>
                  <Text style={styles.counterNow}>{stepIndex + 1}</Text> / {steps.length}
                </Text>
                <View style={styles.actions}>
                  {stepIndex > 0 ? (
                    <TouchableOpacity onPress={() => setStepIndex((i) => i - 1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={styles.backText}>Back</Text>
                    </TouchableOpacity>
                  ) : null}
                  <TouchableOpacity onPress={next} style={styles.nextBtn} activeOpacity={0.85}>
                    <Text style={styles.nextText}>{isLast ? 'OK' : 'Next'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Animated.View>
        ) : null}

      </View>
    </Modal>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  spotlight: { position: 'absolute', borderWidth: 2, borderStyle: 'dashed', borderColor: '#FFFFFF' },
  tipWrap: { position: 'absolute', width: TIP_W },
  tip: {
    backgroundColor: COLORS.surface, borderRadius: 16, padding: 14,
    elevation: 10, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 5 },
  },
  arrow: { position: 'absolute', width: 0, height: 0, borderLeftWidth: 10, borderRightWidth: 10, borderLeftColor: 'transparent', borderRightColor: 'transparent', zIndex: 2 },
  arrowUp: { top: -9, borderBottomWidth: 10, borderBottomColor: COLORS.surface },
  arrowDown: { bottom: -9, borderTopWidth: 10, borderTopColor: COLORS.surface },
  tipHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  tipIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.primaryPale, alignItems: 'center', justifyContent: 'center' },
  tipTitle: { flex: 1, fontSize: 16, fontFamily: FONTS.heading, color: COLORS.textPrimary },
  tipText: { fontSize: 13.5, color: COLORS.textSecondary, lineHeight: 19 },
  tipFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  counter: { fontSize: 13, color: COLORS.textMuted, fontWeight: '600' },
  counterNow: { color: COLORS.textPrimary, fontWeight: '800' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  backText: { fontSize: 13.5, fontWeight: '700', color: COLORS.textSecondary },
  nextBtn: { backgroundColor: COLORS.primary, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 8 },
  nextText: { color: '#fff', fontFamily: FONTS.heading, fontSize: 13.5 },
  closeBtn: { width: 26, height: 26, borderRadius: 13, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  hero: { alignSelf: 'center', width: 64, height: 64, borderRadius: 32, backgroundColor: COLORS.primaryPale, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
});
