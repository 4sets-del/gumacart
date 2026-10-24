import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { RADIUS, FONTS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { messageSummary } from '../utils/reportMessage';

const SHOW_AROUND = 3; // messages shown on each side before "Show full context"

function time(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

// Admin Panel → Reports: one reported chat message. Shows the message in the
// middle of the conversation around it (both people), each side's report
// history, and the actions. `history` = { reported: {...}, reporter: {...} }.
export default function MessageReportCard({ group, history, onWarn, onDelete, onSuspend, onDismiss, onOpenImage }) {
  const { COLORS, styles } = useTheme(createStyles);
  const [expanded, setExpanded] = useState(false);
  const first = group.reports[0];
  const context = first.context || (first.message ? [first.message] : []);
  const at = context.findIndex((m) => m.reported);
  const shown = expanded || at < 0 ? context : context.slice(Math.max(0, at - SHOW_AROUND), at + SHOW_AROUND + 1);
  const reasons = [...new Set(group.reports.map((r) => r.reason).filter(Boolean))];
  const reporters = [...new Set(group.reports.map((r) => r.reporterName || 'Someone'))];
  const reportedId = first.reportedUserId;
  const reporterId = first.reporterId;
  const { reported, reporter } = history;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headIcon}><Ionicons name="chatbubble-ellipses" size={20} color={COLORS.error} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{first.reportedUserName || 'User'}</Text>
          <Text style={styles.sub} numberOfLines={1}>
            Reported by {reporters.slice(0, 2).join(', ')}{reporters.length > 2 ? ` +${reporters.length - 2}` : ''}
          </Text>
          {reasons.map((r) => <Text key={r} style={styles.reason} numberOfLines={1}>• {r}</Text>)}
        </View>
        <View style={styles.kindPill}><Text style={styles.kindText}>MESSAGE</Text></View>
      </View>

      {/* Who's who: how often each side reports / gets reported. */}
      <View style={styles.historyRow}>
        <View style={styles.historyBox}>
          <Text style={styles.historyTitle}>Reported user</Text>
          <Text style={styles.historyText}>
            {reported.total} report{reported.total !== 1 ? 's' : ''} from {reported.people} {reported.people === 1 ? 'person' : 'people'}
          </Text>
          <Text style={[styles.historyText, reported.upheld > 0 && { color: COLORS.error, fontWeight: '700' }]}>
            {reported.upheld} upheld before · {reported.warnings} warning{reported.warnings !== 1 ? 's' : ''}
          </Text>
        </View>
        <View style={styles.historyBox}>
          <Text style={styles.historyTitle}>Reporter</Text>
          <Text style={styles.historyText}>{reporter.total} report{reporter.total !== 1 ? 's' : ''} made</Text>
          <Text style={[styles.historyText, reporter.falseCount > 0 && { color: COLORS.warning, fontWeight: '700' }]}>
            {reporter.falseCount} marked false
          </Text>
        </View>
      </View>

      {/* The conversation around the reported message. */}
      <View style={styles.thread}>
        {at > SHOW_AROUND && !expanded ? <Text style={styles.more}>… {at - SHOW_AROUND} earlier message(s)</Text> : null}
        {shown.map((m) => {
          const fromReported = m.senderId === reportedId;
          const fromReporter = m.senderId === reporterId;
          return (
            <View key={m.id} style={[styles.msgRow, !fromReported && styles.msgRowRight]}>
              <View style={[styles.bubble, fromReported ? styles.bubbleReported : styles.bubbleReporter, m.reported && styles.bubbleFlagged]}>
                <Text style={styles.sender}>
                  {m.senderName || (fromReported ? 'Reported user' : 'Reporter')}
                  {fromReporter ? ' (reporter)' : ''}
                  {m.reported ? '  🚩' : ''}
                </Text>
                {m.type === 'image' && m.mediaUrl ? (
                  <TouchableOpacity onPress={() => onOpenImage(m.mediaUrl)} activeOpacity={0.9}>
                    <Image source={{ uri: m.mediaUrl }} style={styles.msgImage} contentFit="cover" />
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.msgText}>{messageSummary(m)}</Text>
                )}
                <Text style={styles.msgTime}>{time(m.createdAtMs)}</Text>
              </View>
            </View>
          );
        })}
        {!expanded && at >= 0 && context.length - at - 1 > SHOW_AROUND ? (
          <Text style={styles.more}>… {context.length - at - 1 - SHOW_AROUND} later message(s)</Text>
        ) : null}
        {context.length > shown.length || expanded ? (
          <TouchableOpacity onPress={() => setExpanded(!expanded)} style={styles.expand}>
            <Text style={styles.expandText}>{expanded ? 'Show less' : `Show full context (${context.length} messages)`}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <Text style={styles.guide}>
        Check the tone of both people. Mutual joking isn't harassment. For a first offense, a warning is usually enough.
      </Text>

      <View style={styles.actions}>
        <Action icon="warning" label="Warn" color={COLORS.warning} onPress={() => onWarn(group)} styles={styles} />
        <Action icon="trash" label="Delete msg" color={COLORS.error} onPress={() => onDelete(group)} styles={styles} />
        <Action icon="ban" label="Suspend" color={COLORS.error} onPress={() => onSuspend(group)} styles={styles} solid />
        <Action icon="checkmark" label="Dismiss" color={COLORS.textSecondary} onPress={() => onDismiss(group)} styles={styles} />
      </View>
    </View>
  );
}

function Action({ icon, label, color, onPress, styles, solid }) {
  return (
    <TouchableOpacity style={[styles.action, solid ? { backgroundColor: color } : { borderColor: color + '66' }]} onPress={onPress} activeOpacity={0.85}>
      <Ionicons name={icon} size={15} color={solid ? '#fff' : color} />
      <Text style={[styles.actionText, { color: solid ? '#fff' : color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  card: { backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  head: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  headIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: COLORS.errorLight, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 15.5, fontFamily: FONTS.heading, color: COLORS.textPrimary },
  sub: { fontSize: 12.5, color: COLORS.textMuted, marginTop: 1 },
  reason: { fontSize: 12.5, color: COLORS.error, fontWeight: '700', marginTop: 2 },
  kindPill: { backgroundColor: '#0EA5E9', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  kindText: { color: '#fff', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.3 },
  historyRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  historyBox: { flex: 1, backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.md, padding: 10 },
  historyTitle: { fontSize: 11, fontWeight: '800', color: COLORS.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  historyText: { fontSize: 12.5, color: COLORS.textSecondary, lineHeight: 17 },
  thread: { marginTop: 12, padding: 10, borderRadius: RADIUS.md, backgroundColor: COLORS.background, gap: 6 },
  msgRow: { flexDirection: 'row' },
  msgRowRight: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '82%', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
  bubbleReported: { backgroundColor: COLORS.surfaceAlt },
  bubbleReporter: { backgroundColor: COLORS.primaryPale },
  bubbleFlagged: { borderWidth: 2, borderColor: COLORS.error },
  sender: { fontSize: 11, fontWeight: '800', color: COLORS.textSecondary, marginBottom: 2 },
  msgText: { fontSize: 13.5, color: COLORS.textPrimary, lineHeight: 19 },
  msgImage: { width: 160, height: 120, borderRadius: 8, marginTop: 2 },
  msgTime: { fontSize: 10, color: COLORS.textMuted, marginTop: 3, alignSelf: 'flex-end' },
  more: { fontSize: 11.5, color: COLORS.textMuted, textAlign: 'center' },
  expand: { alignSelf: 'center', paddingVertical: 4 },
  expandText: { fontSize: 12.5, fontWeight: '700', color: COLORS.primary },
  guide: { fontSize: 12, color: COLORS.textMuted, lineHeight: 17, marginTop: 10 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  action: { flexGrow: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, height: 38, borderRadius: 10, borderWidth: 1.5, borderColor: 'transparent', paddingHorizontal: 10 },
  actionText: { fontSize: 13, fontWeight: '800' },
});
