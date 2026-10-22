import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Pressable } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { FONTS, RADIUS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

// Drop-in replacement for React Native's Alert, drawn in the app's own style
// instead of the plain grey system dialog. Same call shape:
//   Alert.alert(title, message?, buttons?)
// Buttons may also carry an `icon` (Ionicons name), e.g. for photo pickers.
// Alerts opened while one is showing (e.g. "Saved" after a confirm) queue up.

const queue = [];
let notify = null;

export const Alert = {
  alert(title, message, buttons) {
    queue.push({
      title: title || '',
      message: message || '',
      buttons: buttons && buttons.length ? buttons : [{ text: 'OK' }],
    });
    notify?.();
  },
};

const ERROR_WORDS = /error|fail|denied|invalid|unavailable|missing|required|too |not allowed|limit/i;
const SUCCESS_WORDS = /success|sent|saved|updated|submitted|deleted|removed|changed|restored|resolved|added|thank|done|approved|welcome/i;

function headerIcon({ title, buttons }, COLORS) {
  if (buttons.some((b) => b.style === 'destructive')) return { name: 'warning', color: COLORS.error, bg: COLORS.errorLight };
  if (buttons.some((b) => b.icon)) return { name: 'images', color: COLORS.primary, bg: COLORS.primaryPale };
  if (ERROR_WORDS.test(title)) return { name: 'alert-circle', color: COLORS.error, bg: COLORS.errorLight };
  if (SUCCESS_WORDS.test(title)) return { name: 'checkmark-circle', color: COLORS.success, bg: COLORS.primaryPale };
  if (buttons.length > 1) return { name: 'help-circle', color: COLORS.primary, bg: COLORS.primaryPale };
  return { name: 'information-circle', color: COLORS.info, bg: COLORS.infoLight };
}

// Rendered once near the root of the app (App.js).
export function AlertHost() {
  const { COLORS, styles } = useTheme(createStyles);
  const [current, setCurrent] = useState(null);

  useEffect(() => {
    notify = () => setCurrent((c) => c || queue.shift() || null);
    notify();
    return () => { notify = null; };
  }, []);

  const close = (button) => {
    setCurrent(queue.shift() || null);
    // Run the handler after closing, so it can open another alert.
    button?.onPress?.();
  };

  if (!current) return null;

  const cancel = current.buttons.find((b) => b.style === 'cancel');
  const actions = current.buttons.filter((b) => b !== cancel);
  // Two short choices sit side by side; option lists stack vertically.
  const inline = current.buttons.length <= 2 && !actions.some((b) => b.icon);
  const icon = headerIcon(current, COLORS);
  const dismiss = () => close(cancel || (current.buttons.length === 1 ? current.buttons[0] : null));

  const renderButton = (b, i) => {
    const isCancel = b === cancel;
    const destructive = b.style === 'destructive';
    const variant = isCancel ? styles.btnGhost : destructive ? styles.btnDanger : (b.icon ? styles.btnOption : styles.btnPrimary);
    const textColor = isCancel ? COLORS.textSecondary : b.icon && !destructive ? COLORS.textPrimary : '#fff';
    return (
      <TouchableOpacity
        key={b.text + i}
        activeOpacity={0.85}
        onPress={() => close(b)}
        style={[styles.btn, inline && styles.btnInline, variant]}
        accessibilityRole="button"
      >
        {b.icon ? (
          <View style={[styles.optionIcon, { backgroundColor: destructive ? 'rgba(255,255,255,0.2)' : COLORS.primaryPale }]}>
            <Ionicons name={b.icon} size={18} color={destructive ? '#fff' : COLORS.primary} />
          </View>
        ) : null}
        <Text style={[styles.btnText, { color: textColor }, b.icon && styles.btnTextLeft]} numberOfLines={1}>{b.text}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={dismiss}>
      <Pressable style={styles.backdrop} onPress={dismiss}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={[styles.iconCircle, { backgroundColor: icon.bg }]}>
            <Ionicons name={icon.name} size={28} color={icon.color} />
          </View>
          {current.title ? <Text style={styles.title}>{current.title}</Text> : null}
          {current.message ? <Text style={styles.message}>{current.message}</Text> : null}
          <View style={inline ? styles.rowButtons : styles.stackButtons}>
            {inline
              ? [cancel, ...actions].filter(Boolean).map(renderButton)
              : [...actions, cancel].filter(Boolean).map(renderButton)}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  card: {
    width: '100%', maxWidth: 380, backgroundColor: COLORS.surface, borderRadius: RADIUS.xl,
    paddingTop: 24, paddingHorizontal: 20, paddingBottom: 18, alignItems: 'center',
    borderWidth: COLORS.isDark ? 1 : 0, borderColor: COLORS.border,
    elevation: 12, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 16, shadowOffset: { width: 0, height: 8 },
  },
  iconCircle: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { fontFamily: FONTS.heading, fontSize: 18, color: COLORS.textPrimary, textAlign: 'center' },
  message: { fontSize: 14, lineHeight: 20, color: COLORS.textSecondary, textAlign: 'center', marginTop: 6 },
  rowButtons: { flexDirection: 'row', gap: 10, alignSelf: 'stretch', marginTop: 20 },
  stackButtons: { gap: 10, alignSelf: 'stretch', marginTop: 20 },
  btn: { minHeight: 48, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', paddingHorizontal: 14, gap: 10 },
  btnInline: { flex: 1 },
  btnPrimary: { backgroundColor: COLORS.primary },
  btnDanger: { backgroundColor: COLORS.error },
  btnGhost: { backgroundColor: COLORS.surfaceAlt },
  btnOption: { backgroundColor: COLORS.surfaceAlt, justifyContent: 'flex-start', borderWidth: 1, borderColor: COLORS.border },
  btnText: { fontSize: 15, fontWeight: '700' },
  btnTextLeft: { flex: 1 },
  optionIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
