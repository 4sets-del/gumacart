import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import Sheet, { FormField, SheetSection } from './Sheet';
import { Alert } from './AppAlert';
import { RADIUS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

export const FEEDBACK_TYPES = [
  { id: 'bug', label: 'Something is broken', icon: 'bug' },
  { id: 'idea', label: 'Suggestion', icon: 'bulb' },
  { id: 'other', label: 'Other', icon: 'chatbox-ellipses' },
];

// Settings → Send Feedback. Saved to the `feedback` collection; admins read
// it in Admin Panel → Insights.
export default function FeedbackSheet({ visible, onClose }) {
  const { COLORS, styles } = useTheme(createStyles);
  const [type, setType] = useState('bug');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => { if (visible) { setType('bug'); setMessage(''); } }, [visible]);

  const send = async () => {
    const text = message.trim();
    if (text.length < 5) { Alert.alert('Tell us a bit more', 'Please write at least a few words.'); return; }
    const user = auth.currentUser;
    setSending(true);
    try {
      await addDoc(collection(db, 'feedback'), {
        userId: user.uid,
        userName: user.displayName || '',
        email: user.email || '',
        type,
        message: text,
        appVersion: Constants.expoConfig?.version || '',
        platform: `${Platform.OS} ${Platform.Version}`,
        status: 'new',
        createdAt: serverTimestamp(),
      });
      onClose();
      Alert.alert('Thank you!', 'Your feedback was sent to the GumaCart team.');
    } catch (e) {
      Alert.alert('Error', 'Could not send your feedback. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Send Feedback"
      subtitle="Found a problem or have an idea? We read every message."
      icon="chatbox-ellipses"
      busy={sending}
      action={{ title: 'Send', icon: 'send', onPress: send, loading: sending }}
    >
      <SheetSection title="What is it about?" />
      <View style={styles.types}>
        {FEEDBACK_TYPES.map((t) => {
          const on = type === t.id;
          return (
            <TouchableOpacity key={t.id} style={[styles.type, on && styles.typeOn]} activeOpacity={0.8} onPress={() => setType(t.id)} accessibilityRole="radio" accessibilityState={{ selected: on }}>
              <Ionicons name={on ? t.icon : `${t.icon}-outline`} size={18} color={on ? COLORS.primary : COLORS.textMuted} />
              <Text style={[styles.typeText, on && styles.typeTextOn]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <FormField
        label="Message"
        icon="create-outline"
        placeholder={type === 'bug' ? 'What happened, and on which screen?' : 'Tell us your idea'}
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={1000}
        hint={`${message.length}/1000 · Your name, email and app version are included so we can follow up.`}
      />
    </Sheet>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  types: { gap: 8, marginTop: 10 },
  type: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceAlt, borderWidth: 1.5, borderColor: 'transparent' },
  typeOn: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryPale },
  typeText: { fontSize: 14.5, fontWeight: '600', color: COLORS.textSecondary },
  typeTextOn: { color: COLORS.primary },
});
