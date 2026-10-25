import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, KeyboardAvoidingView, Platform, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { GRADIENTS, RADIUS, FONTS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import GradientButton from './GradientButton';
import KeyboardScrollView from './KeyboardScrollView';

// Bottom sheet in the app's style: handle, colored icon + title, close button,
// scrollable body and a Cancel / main-action footer. Used for every form that
// pops up from the bottom (Edit Profile, Change Password, reports, ...).
// `footer` replaces the default buttons (pass null for none); `onCancel`
// overrides what the Cancel button does (e.g. go back a step).
//
//   <Sheet visible onClose title icon="person" subtitle="..."
//          action={{ title: 'Save', onPress, loading, danger }}>
//     ...fields...
//   </Sheet>
export default function Sheet({
  visible, onClose, title, subtitle, icon, tone = 'primary', action, cancelText = 'Cancel', onCancel,
  busy = false, children, scroll = true, footer,
}) {
  const { COLORS, styles } = useTheme(createStyles);
  const insets = useSafeAreaInsets();
  const close = () => { if (!busy) onClose?.(); };
  const toneColor = tone === 'danger' ? COLORS.error : tone === 'info' ? COLORS.info : COLORS.primary;
  const toneBg = tone === 'danger' ? COLORS.errorLight : tone === 'info' ? COLORS.infoLight : COLORS.primaryPale;
  const Body = scroll ? KeyboardScrollView : View;

  return (
    <Modal statusBarTranslucent visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={close} accessibilityLabel="Close" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            {icon ? (
              <View style={[styles.iconCircle, { backgroundColor: toneBg }]}>
                <Ionicons name={icon} size={22} color={toneColor} />
              </View>
            ) : null}
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, tone === 'danger' && { color: COLORS.error }]}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle} numberOfLines={3}>{subtitle}</Text> : null}
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={close} disabled={busy} accessibilityRole="button" accessibilityLabel="Close" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={20} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>

          <Body
            style={styles.body}
            {...(scroll ? { keyboardShouldPersistTaps: 'handled', showsVerticalScrollIndicator: false, contentContainerStyle: styles.bodyContent } : {})}
          >
            {children}
          </Body>

          {footer !== undefined ? footer : action ? (
            <View style={styles.footer}>
              <TouchableOpacity style={styles.cancelBtn} activeOpacity={0.85} onPress={onCancel || close} disabled={busy}>
                <Text style={styles.cancelText}>{cancelText}</Text>
              </TouchableOpacity>
              <GradientButton
                title={action.title}
                icon={action.icon}
                onPress={action.onPress}
                loading={action.loading}
                disabled={action.disabled}
                colors={action.danger ? GRADIENTS.rose : GRADIENTS.primary}
                style={{ flex: 2 }}
              />
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Labelled text field with a leading icon, matching the Sign Up form.
// `secure` adds a show/hide eye; `error` shows a red hint underneath.
export function FormField({ label, icon, secure, error, hint, style, ...inputProps }) {
  const { COLORS, styles } = useTheme(createStyles);
  const [hidden, setHidden] = useState(true);
  return (
    <View style={style}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={[styles.inputBox, !label && styles.inputBoxNoLabel, error && styles.inputBoxError, inputProps.multiline && styles.inputBoxMulti]}>
        {icon ? <Ionicons name={icon} size={19} color={error ? COLORS.error : COLORS.textMuted} style={styles.inputIcon} /> : null}
        <TextInput
          style={[styles.input, inputProps.multiline && styles.inputMulti]}
          placeholderTextColor={COLORS.textMuted}
          secureTextEntry={secure && hidden}
          {...inputProps}
        />
        {secure ? (
          <TouchableOpacity onPress={() => setHidden(!hidden)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel={hidden ? 'Show password' : 'Hide password'}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={19} color={COLORS.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

// Tappable choice row (icon, label, optional sub-line, chevron) for sheets
// where you pick one option from a list, e.g. a report or ban reason.
export function SheetOption({ icon, label, sub, onPress, tone = 'primary', right }) {
  const { COLORS, styles } = useTheme(createStyles);
  const color = tone === 'danger' ? COLORS.error : tone === 'warning' ? COLORS.warning : COLORS.primary;
  const bg = tone === 'danger' ? COLORS.errorLight : tone === 'warning' ? COLORS.warningLight : COLORS.primaryPale;
  return (
    <TouchableOpacity style={styles.option} activeOpacity={0.75} onPress={onPress}>
      {icon ? (
        <View style={[styles.optionIcon, { backgroundColor: bg }]}>
          <Ionicons name={icon} size={18} color={color} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <Text style={styles.optionLabel} numberOfLines={1}>{label}</Text>
        {sub ? <Text style={styles.optionSub}>{sub}</Text> : null}
      </View>
      {right}
      <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
    </TouchableOpacity>
  );
}

// The option picked in an earlier step, with a "Change" link to go back.
export function SheetChoice({ icon, label, onChange, tone = 'danger' }) {
  const { COLORS, styles } = useTheme(createStyles);
  const color = tone === 'warning' ? COLORS.warning : tone === 'primary' ? COLORS.primary : COLORS.error;
  const bg = tone === 'warning' ? COLORS.warningLight : tone === 'primary' ? COLORS.primaryPale : COLORS.errorLight;
  return (
    <TouchableOpacity style={[styles.choice, { backgroundColor: bg }]} activeOpacity={0.8} onPress={onChange} disabled={!onChange}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.choiceText, { color }]}>{label}</Text>
      {onChange ? <Text style={styles.choiceChange}>Change</Text> : null}
    </TouchableOpacity>
  );
}

// Small uppercase heading to group fields inside a sheet.
export function SheetSection({ title }) {
  const { styles } = useTheme(createStyles);
  return <Text style={styles.section}>{title}</Text>;
}

const createStyles = (COLORS) => StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  // Max 92% of the space above the keyboard, so the top never goes off-screen.
  sheet: {
    maxHeight: '92%',
    backgroundColor: COLORS.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 10,
    borderWidth: COLORS.isDark ? 1 : 0, borderBottomWidth: 0, borderColor: COLORS.border,
  },
  handle: { width: 42, height: 5, borderRadius: 3, backgroundColor: COLORS.borderStrong, alignSelf: 'center', marginBottom: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 19, fontFamily: FONTS.heading, color: COLORS.textPrimary },
  subtitle: { fontSize: 12.5, lineHeight: 17, color: COLORS.textMuted, marginTop: 1 },
  closeBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  body: { flexGrow: 0, flexShrink: 1 },
  bodyContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 8 },
  footer: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 14, borderTopWidth: 1, borderTopColor: COLORS.border },
  cancelBtn: { flex: 1, height: 52, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 15, fontWeight: '700', color: COLORS.textSecondary },
  section: { fontSize: 11.5, fontWeight: '800', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.7, marginTop: 18, marginBottom: 2 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 11, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceAlt, marginTop: 8 },
  optionIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  optionLabel: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  optionSub: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  choice: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12, padding: 12, borderRadius: RADIUS.md },
  choiceText: { flex: 1, fontSize: 15, fontWeight: '700' },
  choiceChange: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  label: { fontSize: 13.5, fontWeight: '600', color: COLORS.textPrimary, marginTop: 14, marginBottom: 7 },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.md, paddingHorizontal: 14, height: 52, borderWidth: 1, borderColor: 'transparent' },
  // Without a label (e.g. the "Other" place box under chips) keep a gap above.
  inputBoxNoLabel: { marginTop: 10 },
  inputBoxError: { borderColor: COLORS.error },
  inputBoxMulti: { height: undefined, minHeight: 96, alignItems: 'flex-start', paddingVertical: 12 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: COLORS.textPrimary, paddingVertical: 0 },
  inputMulti: { textAlignVertical: 'top', minHeight: 72 },
  error: { fontSize: 12, color: COLORS.error, marginTop: 6 },
  hint: { fontSize: 12, color: COLORS.textMuted, marginTop: 6 },
});
