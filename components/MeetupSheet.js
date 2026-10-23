import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Sheet, { FormField, SheetSection } from './Sheet';
import { RADIUS } from '../constants/theme';
import { MEETUP_SPOTS } from '../constants/school';
import { useTheme } from '../context/ThemeContext';

// Half-hour slots during campus hours.
const TIMES = [];
for (let h = 7; h <= 18; h++) for (const m of [0, 30]) TIMES.push({ h, m });

const timeLabel = ({ h, m }) => `${((h + 11) % 12) + 1}:${m ? '30' : '00'} ${h < 12 ? 'AM' : 'PM'}`;

// "Plan a Meet-up": choose a campus spot, a day (next 7 days) and a time.
export default function MeetupSheet({ visible, onClose, onSend, sending }) {
  const { styles } = useTheme(createStyles);
  const [spot, setSpot] = useState(MEETUP_SPOTS[0]);
  const [otherSpot, setOtherSpot] = useState('');
  const [dayIndex, setDayIndex] = useState(0);
  const [time, setTime] = useState(null);

  const days = useMemo(() => {
    const out = [];
    const base = new Date();
    for (let i = 0; i < 7; i++) {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
      out.push({ date: d, label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) });
    }
    return out;
  }, [visible]); // recompute each time it opens (the date may have changed)

  useEffect(() => {
    if (visible) { setSpot(MEETUP_SPOTS[0]); setOtherSpot(''); setDayIndex(0); setTime(null); }
  }, [visible]);

  const now = new Date();
  const at = (t) => {
    const d = days[dayIndex].date;
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), t.h, t.m);
  };
  // Times already past today can't be picked.
  const isPast = (t) => at(t) <= now;
  const place = spot === 'Other' ? otherSpot.trim() : spot;
  const ready = place && time && !isPast(time);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      title="Plan a Meet-up"
      subtitle="Pick a safe, public spot on campus. You'll both get a reminder."
      icon="location"
      busy={sending}
      action={{ title: 'Send Meet-up', icon: 'send', onPress: () => ready && onSend(place, at(time)), loading: sending, disabled: !ready }}
    >
      <SheetSection title="Where" />
      <View style={styles.wrap}>
        {MEETUP_SPOTS.map((s) => (
          <Chip key={s} label={s} on={spot === s} onPress={() => setSpot(s)} />
        ))}
      </View>
      {spot === 'Other' ? (
        <FormField icon="location-outline" placeholder="e.g. Canteen, Gym, Room 204" value={otherSpot} onChangeText={setOtherSpot} maxLength={40} />
      ) : null}

      <SheetSection title="Day" />
      <View style={styles.wrap}>
        {days.map((d, i) => (
          <Chip key={d.label} label={d.label} on={dayIndex === i} onPress={() => { setDayIndex(i); }} />
        ))}
      </View>

      <SheetSection title="Time" />
      <View style={styles.wrap}>
        {TIMES.map((t) => {
          const past = isPast(t);
          return <Chip key={timeLabel(t)} label={timeLabel(t)} small on={time === t && !past} disabled={past} onPress={() => setTime(t)} />;
        })}
      </View>
    </Sheet>
  );
}

function Chip({ label, on, onPress, disabled, small }) {
  const { styles } = useTheme(createStyles);
  return (
    <TouchableOpacity
      style={[styles.chip, small && styles.chipSmall, on && styles.chipOn, disabled && styles.chipDisabled]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      accessibilityRole="radio"
      accessibilityState={{ selected: !!on, disabled: !!disabled }}
    >
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </TouchableOpacity>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { paddingHorizontal: 13, height: 36, borderRadius: RADIUS.full, backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border, justifyContent: 'center' },
  chipSmall: { paddingHorizontal: 10, height: 32 },
  chipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipDisabled: { opacity: 0.35 },
  chipText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
  chipTextOn: { color: '#fff' },
});
