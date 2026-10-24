import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  collection, query, where, orderBy, limit, getDocs, getCountFromServer, doc, updateDoc, deleteDoc,
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { Alert } from './AppAlert';
import { FEEDBACK_TYPES } from './FeedbackSheet';
import { RADIUS, FONTS, SHADOWS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

const DAY = 24 * 3600 * 1000;

// What the weekly numbers count: [label, icon, color, collection, date field].
const METRICS = [
  ['New users', 'person-add', '#EA580C', 'users', 'createdAt'],
  ['New listings', 'pricetags', '#2563EB', 'listings', 'createdAt'],
  ['Items sold', 'bag-check', '#16A34A', 'listings', 'soldAt'],
  ['New chats', 'chatbubbles', '#7C3AED', 'conversations', 'createdAt'],
];

// Count documents whose date field falls in [from, to).
const countBetween = (col, field, from, to) =>
  getCountFromServer(query(collection(db, col), where(field, '>=', new Date(from)), where(field, '<', new Date(to))))
    .then((r) => r.data().count)
    .catch(() => null);

function timeAgo(ts) {
  const ms = ts?.toMillis ? ts.toMillis() : 0;
  if (!ms) return '';
  const m = Math.floor((Date.now() - ms) / 60000);
  if (m < 60) return `${Math.max(m, 1)}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Admin Panel → Insights: activity this week vs last week, and the feedback
// users sent from Settings.
export default function AdminInsights({ refreshKey }) {
  const { COLORS, styles } = useTheme(createStyles);
  const [stats, setStats] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const load = useCallback(async () => {
    const now = Date.now();
    const [cur, prev, fb] = await Promise.all([
      Promise.all(METRICS.map(([, , , col, field]) => countBetween(col, field, now - 7 * DAY, now + DAY))),
      Promise.all(METRICS.map(([, , , col, field]) => countBetween(col, field, now - 14 * DAY, now - 7 * DAY))),
      getDocs(query(collection(db, 'feedback'), orderBy('createdAt', 'desc'), limit(50)))
        .then((snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        .catch(() => []),
    ]);
    setStats(METRICS.map((m, i) => ({ label: m[0], icon: m[1], color: m[2], cur: cur[i], prev: prev[i] })));
    setFeedback(fb);
  }, []);

  useEffect(() => { load(); }, [load, refreshKey]);

  const markRead = (f) => {
    updateDoc(doc(db, 'feedback', f.id), { status: 'read' }).catch(() => {});
    setFeedback((list) => list.map((x) => (x.id === f.id ? { ...x, status: 'read' } : x)));
  };
  const remove = (f) => Alert.alert('Delete feedback?', 'This removes it for all admins.', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Delete', style: 'destructive',
      onPress: () => deleteDoc(doc(db, 'feedback', f.id))
        .then(() => setFeedback((list) => list.filter((x) => x.id !== f.id)))
        .catch(() => Alert.alert('Error', 'Could not delete it.')),
    },
  ]);

  const unread = (feedback || []).filter((f) => f.status !== 'read').length;

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Last 7 days</Text>
      <Text style={styles.sub}>Compared with the 7 days before</Text>
      {!stats ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 24 }} />
      ) : (
        <View style={styles.grid}>
          {stats.map((s) => {
            const diff = s.cur != null && s.prev != null ? s.cur - s.prev : null;
            return (
              <View key={s.label} style={styles.tile}>
                <View style={[styles.tileIcon, { backgroundColor: s.color + '1F' }]}>
                  <Ionicons name={s.icon} size={18} color={s.color} />
                </View>
                <Text style={styles.tileNum}>{s.cur ?? '–'}</Text>
                <Text style={styles.tileLabel}>{s.label}</Text>
                {diff != null ? (
                  <Text style={[styles.trend, { color: diff > 0 ? COLORS.primary : diff < 0 ? COLORS.error : COLORS.textMuted }]}>
                    {diff > 0 ? `▲ ${diff}` : diff < 0 ? `▼ ${-diff}` : 'Same as before'}
                    {diff !== 0 ? ` vs last week` : ''}
                  </Text>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.fbHeader}>
        <Text style={styles.heading}>Feedback</Text>
        {unread > 0 ? <View style={styles.badge}><Text style={styles.badgeText}>{unread} new</Text></View> : null}
      </View>
      {!feedback ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginVertical: 24 }} />
      ) : feedback.length === 0 ? (
        <Text style={styles.empty}>No feedback yet. Users can send it from Settings → Send Feedback.</Text>
      ) : (
        feedback.map((f) => {
          const t = FEEDBACK_TYPES.find((x) => x.id === f.type) || FEEDBACK_TYPES[2];
          const isNew = f.status !== 'read';
          return (
            <TouchableOpacity key={f.id} style={[styles.fb, isNew && styles.fbNew]} activeOpacity={0.85} onPress={() => isNew && markRead(f)}>
              <View style={styles.fbTop}>
                <Ionicons name={t.icon} size={15} color={f.type === 'bug' ? COLORS.error : COLORS.primary} />
                <Text style={styles.fbType}>{t.label}</Text>
                {isNew ? <View style={styles.dot} /> : null}
                <Text style={styles.fbTime}>{timeAgo(f.createdAt)}</Text>
                <TouchableOpacity onPress={() => remove(f)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityLabel="Delete feedback">
                  <Ionicons name="trash-outline" size={16} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>
              <Text style={styles.fbMsg}>{f.message}</Text>
              <Text style={styles.fbMeta} numberOfLines={1}>{f.userName || 'User'} · {f.email} · v{f.appVersion} · {f.platform}</Text>
            </TouchableOpacity>
          );
        })
      )}
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  wrap: { padding: 16 },
  heading: { fontSize: 17, fontFamily: FONTS.heading, color: COLORS.textPrimary },
  sub: { fontSize: 12.5, color: COLORS.textMuted, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  tile: { width: '48%', flexGrow: 1, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 14, ...SHADOWS.sm },
  tileIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  tileNum: { fontSize: 24, fontFamily: FONTS.heading, color: COLORS.textPrimary },
  tileLabel: { fontSize: 12.5, color: COLORS.textSecondary, fontWeight: '600' },
  trend: { fontSize: 11.5, fontWeight: '700', marginTop: 4 },
  fbHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 26, marginBottom: 10 },
  badge: { backgroundColor: COLORS.error, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  empty: { fontSize: 13.5, color: COLORS.textMuted, lineHeight: 19 },
  fb: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  fbNew: { borderColor: COLORS.primary + '66' },
  fbTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fbType: { fontSize: 12.5, fontWeight: '800', color: COLORS.textSecondary },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.error },
  fbTime: { flex: 1, textAlign: 'right', fontSize: 11.5, color: COLORS.textMuted, marginRight: 8 },
  fbMsg: { fontSize: 14, lineHeight: 20, color: COLORS.textPrimary, marginTop: 6 },
  fbMeta: { fontSize: 11.5, color: COLORS.textMuted, marginTop: 6 },
});
