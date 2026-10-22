import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COURSES, YEAR_LEVELS, yearLabel, courseName } from '../constants/school';
import { RADIUS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

// Course + year level pickers as tappable chips (used on Sign Up and in
// Edit Profile). Faculty only pick a course/program.
export default function AcademicFields({ course, onCourse, yearLevel, onYearLevel, showYear = true, labelStyle }) {
  const { styles } = useTheme(createStyles);
  const fullName = courseName(course);

  return (
    <View>
      <Text style={labelStyle}>Course</Text>
      <View style={styles.wrap}>
        {COURSES.map((d) => {
          const on = d.code === course;
          return (
            <TouchableOpacity
              key={d.code}
              style={[styles.chip, on && styles.chipOn]}
              activeOpacity={0.8}
              onPress={() => onCourse(d.code)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              accessibilityLabel={courseName(d.code)}
            >
              <Text style={[styles.chipText, on && styles.chipTextOn]}>{d.code}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {fullName ? <Text style={styles.fullName}>{fullName}</Text> : null}

      {showYear && (
        <>
          <Text style={labelStyle}>Year Level</Text>
          <View style={styles.row}>
            {YEAR_LEVELS.map((y) => {
              const on = Number(yearLevel) === y;
              return (
                <TouchableOpacity
                  key={y}
                  style={[styles.chip, styles.yearChip, on && styles.chipOn]}
                  activeOpacity={0.8}
                  onPress={() => onYearLevel(y)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={yearLabel(y)}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{yearLabel(y).replace(' Year', '')}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  chip: {
    paddingHorizontal: 14, height: 38, borderRadius: RADIUS.full, alignItems: 'center', justifyContent: 'center',
    backgroundColor: COLORS.surfaceAlt, borderWidth: 1, borderColor: COLORS.border,
  },
  yearChip: { flex: 1, paddingHorizontal: 0 },
  chipOn: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { fontSize: 13.5, fontWeight: '700', color: COLORS.textSecondary },
  chipTextOn: { color: '#fff' },
  fullName: { fontSize: 12.5, color: COLORS.primary, fontWeight: '600', marginTop: 8 },
});
