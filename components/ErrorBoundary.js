import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { COLORS, FONTS, RADIUS } from '../constants/theme';

// Catches unexpected errors while drawing a screen and shows a friendly
// "Try again" page instead of a blank screen or crash.
export default class ErrorBoundary extends React.Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.log('App error:', error?.message, info?.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.container}>
        <View style={styles.iconCircle}>
          <Ionicons name="sad-outline" size={44} color={COLORS.primary} />
        </View>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.text}>
          Sorry about that. Please try again. If it keeps happening, restart the app.
        </Text>
        {__DEV__ ? <Text style={styles.devText} numberOfLines={4}>{String(this.state.error?.message || this.state.error)}</Text> : null}
        <TouchableOpacity style={styles.button} activeOpacity={0.85} onPress={this.reset}>
          <Ionicons name="refresh" size={18} color="#fff" />
          <Text style={styles.buttonText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: COLORS.white },
  iconCircle: { width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.primaryPale, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: 22, fontFamily: FONTS.heading, color: COLORS.textPrimary, marginBottom: 8, textAlign: 'center' },
  text: { fontSize: 14.5, color: COLORS.textSecondary, textAlign: 'center', lineHeight: 21, marginBottom: 20 },
  devText: { fontSize: 12, color: COLORS.error, textAlign: 'center', marginBottom: 20 },
  button: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: COLORS.primary, borderRadius: RADIUS.md, paddingHorizontal: 26, paddingVertical: 14 },
  buttonText: { color: '#fff', fontSize: 15.5, fontWeight: '700' },
});
