import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { RADIUS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import Sheet, { FormField, SheetSection } from './Sheet';

const REASON_ICONS = {
  'Spam or misleading': 'megaphone-outline',
  'Inappropriate content': 'eye-off-outline',
  'Scam or fraud': 'warning-outline',
  'Prohibited item': 'ban-outline',
  'Harassment': 'hand-left-outline',
  'Fake account': 'person-remove-outline',
  'Inappropriate behavior': 'sad-outline',
  'Harassment or threats': 'hand-left-outline',
  'Spam': 'megaphone-outline',
  'Other': 'ellipsis-horizontal-circle-outline',
};

// Two-step report form shared by listings, user profiles and chat messages:
// pick a reason, then add details (and a proof photo) and submit. The
// reporter must confirm it's a real problem, since false reports count
// against them. The screen owns the form state.
// `preview` shows what is being reported (e.g. the chat message); message
// reports pass allowProof={false} because the message itself is attached.
export default function ReportSheet({
  visible, onClose, title, question, reasons, reason, onReason,
  details, onDetails, proof, onPickProof, onRemoveProof, onSubmit, submitting,
  allowProof = true, preview = null,
}) {
  const { COLORS, styles } = useTheme(createStyles);
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => { if (!visible || !reason) setConfirmed(false); }, [visible, reason]);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title={title}
      subtitle={reason ? 'Add details and proof, then submit.' : question}
      icon="flag"
      tone="danger"
      busy={submitting}
      cancelText="Back"
      onCancel={() => onReason(null)}
      footer={reason ? undefined : null}
      action={{ title: 'Submit Report', icon: 'send', onPress: onSubmit, loading: submitting, danger: true, disabled: !confirmed }}
    >
      {preview}
      {!reason ? (
        <View style={styles.list}>
          {reasons.map((r) => (
            <TouchableOpacity key={r} style={styles.reasonRow} activeOpacity={0.75} onPress={() => onReason(r)}>
              <View style={styles.reasonIcon}>
                <Ionicons name={REASON_ICONS[r] || 'flag-outline'} size={18} color={COLORS.error} />
              </View>
              <Text style={styles.reasonText}>{r}</Text>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <>
          <TouchableOpacity style={styles.selected} activeOpacity={0.8} onPress={() => onReason(null)} disabled={submitting}>
            <Ionicons name={REASON_ICONS[reason] || 'flag'} size={18} color={COLORS.error} />
            <Text style={styles.selectedText}>{reason}</Text>
            <Text style={styles.change}>Change</Text>
          </TouchableOpacity>

          {reason === 'Other' && (
            <FormField
              label="Describe the issue"
              icon="create-outline"
              value={details}
              onChangeText={onDetails}
              placeholder="Tell us what's wrong…"
              multiline
              maxLength={200}
              hint={`${details.length}/200`}
            />
          )}

          {allowProof ? <SheetSection title="Proof (optional)" /> : null}
          {!allowProof ? null : proof ? (
            <View style={styles.proofWrap}>
              <Image source={{ uri: proof }} style={styles.proof} contentFit="cover" />
              <TouchableOpacity style={styles.proofRemove} onPress={onRemoveProof} accessibilityRole="button" accessibilityLabel="Remove proof photo">
                <Ionicons name="close" size={16} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.proofAdd} activeOpacity={0.8} onPress={onPickProof}>
              <Ionicons name="image-outline" size={22} color={COLORS.primary} />
              <Text style={styles.proofAddText}>Add a screenshot or photo</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.confirm}
            activeOpacity={0.8}
            onPress={() => setConfirmed(!confirmed)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: confirmed }}
          >
            <Ionicons name={confirmed ? 'checkbox' : 'square-outline'} size={22} color={confirmed ? COLORS.error : COLORS.textMuted} />
            <Text style={styles.confirmText}>
              This is a real problem, not a joke. I understand false reports can get my own account restricted.
            </Text>
          </TouchableOpacity>
        </>
      )}
    </Sheet>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  list: { marginTop: 10, gap: 8 },
  reasonRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 11,
    borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceAlt,
  },
  reasonIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: COLORS.errorLight, alignItems: 'center', justifyContent: 'center' },
  reasonText: { flex: 1, fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  selected: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 14, padding: 12,
    borderRadius: RADIUS.md, backgroundColor: COLORS.errorLight,
  },
  selectedText: { flex: 1, fontSize: 15, fontWeight: '700', color: COLORS.error },
  change: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  proofWrap: { marginTop: 10, borderRadius: RADIUS.md, overflow: 'hidden' },
  proof: { width: '100%', height: 170 },
  proofRemove: { position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  proofAdd: {
    marginTop: 10, height: 90, borderRadius: RADIUS.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: COLORS.borderStrong,
    alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: COLORS.surfaceAlt,
  },
  proofAddText: { fontSize: 13.5, fontWeight: '600', color: COLORS.primary },
  confirm: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 16, padding: 12, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceAlt },
  confirmText: { flex: 1, fontSize: 13, lineHeight: 18, color: COLORS.textSecondary },
});
