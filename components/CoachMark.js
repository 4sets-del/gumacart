import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Modal } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { FONTS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const PADDING = 8;

// A sequential "coach mark" walkthrough: dims the screen, spotlights one
// icon at a time (measured live via a ref), draws an arrow toward it, and
// shows a small tooltip card explaining what it does.
export default function CoachMark({ visible, steps, onFinish }) {
  const { styles } = useTheme(createStyles);
  const [stepIndex, setStepIndex] = useState(0);
  const [target, setTarget] = useState(null);

  const measureCurrent = useCallback(() => {
    const step = steps[stepIndex];
    if (!step?.ref?.current?.measureInWindow) {
      setTarget(null);
      return;
    }
    step.ref.current.measureInWindow((x, y, width, height) => {
      if (width > 0 && height > 0) {
        setTarget({ x, y, width, height });
      }
    });
  }, [steps, stepIndex]);

  useEffect(() => {
    if (visible) setStepIndex(0);
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    setTarget(null);
    const id = setTimeout(measureCurrent, 100);
    return () => clearTimeout(id);
  }, [visible, stepIndex, measureCurrent]);

  if (!visible || !steps || steps.length === 0) return null;

  const step = steps[stepIndex];
  const isLast = stepIndex === steps.length - 1;

  const finish = () => onFinish?.();
  const next = () => (isLast ? finish() : setStepIndex((i) => i + 1));

  const box = target
    ? {
        x: Math.max(target.x - PADDING, 4),
        y: Math.max(target.y - PADDING, 4),
        width: target.width + PADDING * 2,
        height: target.height + PADDING * 2,
      }
    : null;

  const tooltipBelow = box ? box.y < SCREEN_H / 2 : true;
  const arrowLeft = box
    ? Math.min(Math.max(box.x + box.width / 2 - 11, 16), SCREEN_W - 38)
    : 0;

  return (
    <Modal statusBarTranslucent visible={visible} transparent animationType="fade" onRequestClose={finish}>
      <View style={StyleSheet.absoluteFill}>
        {!box ? (
          <View style={styles.dimFull} />
        ) : (
          <>
            <View style={[styles.dim, { top: 0, left: 0, right: 0, height: box.y }]} />
            <View
              style={[
                styles.dim,
                { top: box.y + box.height, left: 0, right: 0, bottom: 0 },
              ]}
            />
            <View
              style={[
                styles.dim,
                { top: box.y, left: 0, width: box.x, height: box.height },
              ]}
            />
            <View
              style={[
                styles.dim,
                { top: box.y, left: box.x + box.width, right: 0, height: box.height },
              ]}
            />

            <View
              pointerEvents="none"
              style={[
                styles.spotlightBorder,
                { top: box.y, left: box.x, width: box.width, height: box.height },
              ]}
            />

            <View
              pointerEvents="box-none"
              style={[
                styles.tooltipWrap,
                tooltipBelow
                  ? { top: box.y + box.height + 16 }
                  : { bottom: SCREEN_H - box.y + 16 },
              ]}
            >
              <View style={styles.tooltip}>
                <Text style={styles.tooltipTitle}>{step.title}</Text>
                <Text style={styles.tooltipText}>{step.text}</Text>
                <View style={styles.tooltipFooter}>
                  <TouchableOpacity onPress={finish} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Text style={styles.skipText}>Skip</Text>
                  </TouchableOpacity>
                  <View style={styles.dotsRow}>
                    {steps.map((_, i) => (
                      <View key={i} style={[styles.dot, i === stepIndex && styles.dotActive]} />
                    ))}
                  </View>
                  <TouchableOpacity onPress={next} style={styles.nextBtn} activeOpacity={0.85}>
                    <Text style={styles.nextBtnText}>{isLast ? 'Got it' : 'Next'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <Ionicons
                name={tooltipBelow ? 'caret-up' : 'caret-down'}
                size={22}
                color="#fff"
                style={[
                  styles.arrow,
                  { left: arrowLeft },
                  tooltipBelow ? { top: -14 } : { bottom: -14 },
                ]}
              />
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  dimFull: { flex: 1, backgroundColor: 'rgba(8,24,14,0.82)' },
  dim: { position: 'absolute', backgroundColor: 'rgba(8,24,14,0.82)' },
  spotlightBorder: {
    position: 'absolute',
    borderRadius: 16,
    borderWidth: 3,
    borderColor: COLORS.accent,
  },
  tooltipWrap: { position: 'absolute', left: 20, right: 20 },
  arrow: { position: 'absolute' },
  tooltip: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 16,
    borderLeftWidth: 5,
    borderLeftColor: COLORS.primary,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
  },
  tooltipTitle: { fontSize: 17, fontFamily: FONTS.heading, color: COLORS.textPrimary, marginBottom: 4 },
  tooltipText: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 },
  tooltipFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  skipText: { color: COLORS.textMuted, fontWeight: '600', fontSize: 13.5 },
  dotsRow: { flexDirection: 'row', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.border },
  dotActive: { backgroundColor: COLORS.accent, width: 18 },
  nextBtn: { backgroundColor: COLORS.primary, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 9 },
  nextBtnText: { color: '#fff', fontFamily: FONTS.heading, fontSize: 13.5 },
});
