import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import NetInfo from '@react-native-community/netinfo';
import { FONTS } from '../constants/theme';

const GREEN = '#1B6B3A';
const { width } = Dimensions.get('window');

export default function OfflineNotice() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      // Offline when not connected OR connected but no real internet reachability
      const offline = !(state.isConnected && state.isInternetReachable !== false);
      setIsOffline(offline);
    });
    return unsubscribe;
  }, []);

  if (!isOffline) return null;

  return (
    <Modal transparent visible={isOffline} animationType="fade" onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="cloud-offline" size={40} color={GREEN} />
          </View>
          <Text style={styles.title}>No Internet Connection</Text>
          <Text style={styles.subtitle}>
            Please check your Wi-Fi or mobile data and reconnect to continue using SLSU-GumaCart.
          </Text>
          <View style={styles.waitingRow}>
            <Ionicons name="sync" size={15} color="#999" style={{ marginRight: 6 }} />
            <Text style={styles.waitingText}>Waiting for connection…</Text>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 30 },
  card: { width: width - 60, backgroundColor: '#fff', borderRadius: 24, padding: 28, alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 8 } },
  iconCircle: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#E8F4EC', alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  title: { fontSize: 20, fontFamily: FONTS.heading, color: '#111', marginBottom: 10, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', lineHeight: 21, marginBottom: 20 },
  waitingRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F4F7F1', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  waitingText: { fontSize: 13, color: '#999', fontWeight: '500' },
});
