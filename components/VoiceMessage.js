import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  useAudioRecorder, useAudioRecorderState, useAudioPlayer, useAudioPlayerStatus,
  RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync,
} from 'expo-audio';
import { Alert } from './AppAlert';
import { useTheme } from '../context/ThemeContext';

const MAX_MS = 2 * 60 * 1000; // voice messages up to 2 minutes
const fmt = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

// Recording bar shown in place of the message box: timer, Cancel, Send.
// Starts recording when it appears; `onSend(uri, durationMs)` hands the file
// back to the chat, which uploads it.
export function VoiceRecorder({ onSend, onCancel, bottomInset = 0 }) {
  const { COLORS, styles } = useTheme(createStyles);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 250);
  const [ready, setReady] = useState(false);
  const finished = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Microphone needed', 'Allow microphone access to send voice messages.');
        onCancel();
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      if (cancelled) return;
      await recorder.prepareToRecordAsync();
      recorder.record();
      setReady(true);
    })().catch(() => { Alert.alert('Error', 'Could not start recording.'); onCancel(); });
    return () => {
      cancelled = true;
      if (!finished.current) recorder.stop().catch(() => {});
      setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = async (send) => {
    if (finished.current) return;
    finished.current = true;
    const duration = state.durationMillis;
    try { await recorder.stop(); } catch (e) {}
    if (!send) { onCancel(); return; }
    if (duration < 1000 || !recorder.uri) {
      Alert.alert('Too short', 'Record for at least a second.');
      onCancel();
      return;
    }
    onSend(recorder.uri, duration);
  };

  // Stop automatically at the time limit.
  useEffect(() => {
    if (state.durationMillis >= MAX_MS) finish(true);
  }, [state.durationMillis]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={[styles.bar, { paddingBottom: 10 + bottomInset }]}>
      <TouchableOpacity style={styles.cancel} onPress={() => finish(false)} accessibilityRole="button" accessibilityLabel="Cancel recording">
        <Ionicons name="trash-outline" size={22} color={COLORS.error} />
      </TouchableOpacity>
      <View style={styles.middle}>
        {ready ? <View style={styles.dot} /> : <ActivityIndicator size="small" color={COLORS.error} />}
        <Text style={styles.timer}>{fmt(state.durationMillis)}</Text>
        <Text style={styles.hint}>Recording… max 2:00</Text>
      </View>
      <TouchableOpacity style={styles.send} onPress={() => finish(true)} disabled={!ready} accessibilityRole="button" accessibilityLabel="Send voice message">
        <Ionicons name="send" size={19} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

// A voice message in the chat: play / pause, progress, length.
export function VoiceBubble({ uri, durationMs, isMe }) {
  const { COLORS, styles } = useTheme(createStyles);
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const total = (status.duration || 0) * 1000 || durationMs || 0;
  const pos = (status.currentTime || 0) * 1000;
  const progress = total ? Math.min(1, pos / total) : 0;
  const fg = isMe ? '#fff' : COLORS.primary;

  useEffect(() => {
    if (status.didJustFinish) { player.pause(); player.seekTo(0); }
  }, [status.didJustFinish, player]);

  const toggle = async () => {
    if (status.playing) { player.pause(); return; }
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => {});
    player.play();
  };

  return (
    <View style={styles.bubble}>
      <TouchableOpacity onPress={toggle} style={[styles.play, { backgroundColor: isMe ? 'rgba(255,255,255,0.22)' : COLORS.primaryPale }]} accessibilityRole="button" accessibilityLabel={status.playing ? 'Pause voice message' : 'Play voice message'}>
        <Ionicons name={status.playing ? 'pause' : 'play'} size={18} color={fg} />
      </TouchableOpacity>
      <View style={styles.trackWrap}>
        <View style={[styles.track, { backgroundColor: isMe ? 'rgba(255,255,255,0.35)' : COLORS.border }]}>
          <View style={[styles.fill, { width: `${progress * 100}%`, backgroundColor: fg }]} />
        </View>
        <Text style={[styles.len, { color: isMe ? 'rgba(255,255,255,0.85)' : COLORS.textMuted }]}>
          {status.playing || pos > 0 ? fmt(pos) : fmt(total)}
        </Text>
      </View>
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 10, paddingTop: 10, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border },
  cancel: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.errorLight },
  middle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: 42, paddingHorizontal: 14, borderRadius: 21, backgroundColor: COLORS.surfaceAlt },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.error },
  timer: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary },
  hint: { flex: 1, fontSize: 12, color: COLORS.textMuted, textAlign: 'right' },
  send: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.primary },
  bubble: { flexDirection: 'row', alignItems: 'center', gap: 10, width: 210, paddingVertical: 2 },
  play: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  trackWrap: { flex: 1, gap: 5 },
  track: { height: 4, borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
  len: { fontSize: 11, fontWeight: '600' },
});
