import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Modal } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { FONTS } from '../constants/theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const GREEN = '#1B6B3A';
const PADDING = 8;

// A sequential "coach mark" walkthrough: dims the screen, spotlights one
// icon at a time (measured live via a ref), draws an arrow toward it, and
// shows a small tooltip card explaining what it does.
export default function CoachMark({ visible, steps, onFinish }) {
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={finish}>
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

const styles = StyleSheet.create({
  dimFull: { flex: 1, backgroundColor: 'rgba(10,20,10,0.8)' },
  dim: { position: 'absolute', backgroundColor: 'rgba(10,20,10,0.8)' },
  spotlightBorder: {
    position: 'absolute',
    borderRadius: 14,
    borderWidth: 2.5,
    borderColor: '#8BE28B',
  },
  tooltipWrap: { position: 'absolute', left: 20, right: 20 },
  arrow: { position: 'absolute' },
  tooltip: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  tooltipTitle: { fontSize: 16, fontFamily: FONTS.heading, color: '#1B1F1B', marginBottom: 4 },
  tooltipText: { fontSize: 13.5, color: '#555', lineHeight: 19 },
  tooltipFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  skipText: { color: '#999', fontWeight: '600', fontSize: 13.5 },
  dotsRow: { flexDirection: 'row', gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#DDD' },
  dotActive: { backgroundColor: GREEN, width: 16 },
  nextBtn: { backgroundColor: GREEN, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 8 },
  nextBtnText: { color: '#fff', fontFamily: FONTS.heading, fontSize: 13.5 },
});
