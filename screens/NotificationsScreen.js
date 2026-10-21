import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, Alert, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  collection, query, orderBy, onSnapshot,
  doc, updateDoc, deleteDoc, getDocs, getDoc, writeBatch,
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import ScreenHeader from '../components/ScreenHeader';
import { COLORS, RADIUS } from '../constants/theme';

const GREEN = COLORS.primary;

const NOTIF_ICONS = {
  message:     { icon: 'chatbubble',       color: '#2980b9' },
  follow:      { icon: 'person-add',       color: '#1B6B3A' },
  review:      { icon: 'star',             color: '#F4C542' },
  offer:       { icon: 'pricetag',         color: GREEN },
  sold:        { icon: 'checkmark-circle', color: GREEN },
  new_listing: { icon: 'bag-handle',       color: '#e67e22' },
  barter:      { icon: 'swap-horizontal',  color: '#e67e22' },
  donate:      { icon: 'gift',             color: '#e74c3c' },
  system:      { icon: 'megaphone',        color: '#9b59b6' },
};

function timeAgo(date) {
  if (!date) return '';
  const d = date?.toDate ? date.toDate() : new Date(date);
  const seconds = Math.floor((new Date() - d) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function NotificationsScreen({ navigation }) {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const user = auth.currentUser;

  useEffect(() => {
    if (!user?.uid) { setLoading(false); return; }
    const q = query(
      collection(db, 'users', user.uid, 'notifications'),
      orderBy('createdAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
      setRefreshing(false);
    }, (e) => { console.log('Notifications error:', e.message); setLoading(false); setRefreshing(false); });
    return unsub;
  }, []);

  const markAsRead = async (id) => {
    try { await updateDoc(doc(db, 'users', user.uid, 'notifications', id), { read: true }); } catch (e) {}
  };
  const markAllAsRead = async () => {
    try {
      const batch = writeBatch(db);
      notifications.filter(n => !n.read).forEach(n => {
        batch.update(doc(db, 'users', user.uid, 'notifications', n.id), { read: true });
      });
      await batch.commit();
    } catch (e) {}
  };
  const deleteNotification = async (id) => {
    try { await deleteDoc(doc(db, 'users', user.uid, 'notifications', id)); } catch (e) {}
  };
  const clearAll = () => Alert.alert('Clear All', 'Remove all notifications?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Clear', style: 'destructive', onPress: async () => {
      try {
        const snap = await getDocs(collection(db, 'users', user.uid, 'notifications'));
        const batch = writeBatch(db);
        snap.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      } catch (e) {}
    }},
  ]);
  const onRefresh = () => { setRefreshing(true); setTimeout(() => setRefreshing(false), 800); };

  const openNotif = async (notif) => {
    markAsRead(notif.id);
    const nav = notif.nav || notif.type;

    if (nav === 'chat' || notif.type === 'message') {
      navigation.navigate("Main", { screen: "Messages" });
      return;
    }

    if (nav === 'self') {
      navigation.navigate("Main", { screen: "Profile" });
      return;
    }

    if (nav === 'profile') {
      if (notif.profileId) {
        navigation.navigate('SellerProfile', {
          sellerId: notif.profileId,
          sellerName: notif.profileName || 'User',
        });
      } else {
        navigation.navigate("Main", { screen: "Profile" });
      }
      return;
    }

    if (nav === 'verification') {
      navigation.navigate('Verification');
      return;
    }

    if (nav === 'listing' && notif.listingId) {
      try {
        const snap = await getDoc(doc(db, 'listings', notif.listingId));
        if (snap.exists()) {
          const listing = { id: snap.id, ...snap.data() };
          if (notif.edit === '1' || listing.status === 'rejected') {
            navigation.navigate('CreateListing', { editListing: listing });
          } else {
            navigation.navigate('ProductDetail', { product: listing });
          }
        } else {
          Alert.alert('Listing unavailable', 'This listing no longer exists.');
        }
      } catch (e) {
        Alert.alert('Error', 'Could not open this listing.');
      }
      return;
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <View style={styles.safe}>
      <ScreenHeader
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : null}
        onBack={() => navigation.goBack()}
        right={unreadCount > 0 ? (
          <TouchableOpacity onPress={markAllAsRead} style={styles.markAllBtn}>
            <Text style={styles.markAllText}>Mark all read</Text>
          </TouchableOpacity>
        ) : null}
        border
      />

      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[GREEN]} />}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={GREEN} />
            <Text style={styles.loadingText}>Loading notifications...</Text>
          </View>
        ) : notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="notifications-outline" size={44} color={GREEN} />
            </View>
            <Text style={styles.emptyTitle}>No Notifications</Text>
            <Text style={styles.emptySub}>You're all caught up!</Text>
          </View>
        ) : (
          <>
            {notifications.filter(n => !n.read).length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>New</Text>
                {notifications.filter(n => !n.read).map(notif => (
                  <NotifCard key={notif.id} notif={notif} onPress={() => openNotif(notif)} onDelete={() => deleteNotification(notif.id)} />
                ))}
              </View>
            )}
            {notifications.filter(n => n.read).length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionRow}>
                  <Text style={styles.sectionLabel}>Earlier</Text>
                  <TouchableOpacity onPress={clearAll}>
                    <Text style={styles.clearText}>Clear all</Text>
                  </TouchableOpacity>
                </View>
                {notifications.filter(n => n.read).map(notif => (
                  <NotifCard key={notif.id} notif={notif} onPress={() => openNotif(notif)} onDelete={() => deleteNotification(notif.id)} />
                ))}
              </View>
            )}
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function NotifCard({ notif, onPress, onDelete }) {
  const conf = NOTIF_ICONS[notif.type] || NOTIF_ICONS.system;
  return (
    <TouchableOpacity
      style={[styles.notifCard, !notif.read && styles.notifCardUnread]}
      onPress={onPress}
      activeOpacity={0.8}
      onLongPress={() => Alert.alert('Delete', 'Remove this notification?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ])}
    >
      <View style={[styles.notifIconBox, { backgroundColor: conf.color + '18' }]}>
        <Ionicons name={conf.icon} size={20} color={conf.color} />
      </View>
      <View style={styles.notifContent}>
        <View style={styles.notifTopRow}>
          <Text style={[styles.notifTitle, !notif.read && styles.notifTitleUnread]}>{notif.title}</Text>
          <Text style={styles.notifTime}>{timeAgo(notif.createdAt)}</Text>
        </View>
        <Text style={styles.notifBody} numberOfLines={2}>{notif.body}</Text>
      </View>
      {!notif.read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  markAllBtn: { paddingHorizontal: 10, height: 44, justifyContent: 'center' },
  markAllText: { fontSize: 13, color: COLORS.primary, fontWeight: '700' },
  loadingWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 90 },
  loadingText: { marginTop: 14, fontSize: 13, color: COLORS.textMuted, fontWeight: '500' },
  section: { paddingHorizontal: 16, paddingTop: 16 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionLabel: { fontSize: 15, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 8 },
  clearText: { fontSize: 13, color: COLORS.error, fontWeight: '600' },
  notifCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: 12, marginBottom: 8 },
  notifCardUnread: { backgroundColor: COLORS.primaryPale },
  notifIconBox: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  notifContent: { flex: 1 },
  notifTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  notifTitle: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, flex: 1 },
  notifTitleUnread: { color: COLORS.textPrimary, fontWeight: '700' },
  notifTime: { fontSize: 11, color: COLORS.textMuted, marginLeft: 8 },
  notifBody: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: GREEN, marginLeft: 8 },
  emptyState: { alignItems: 'center', paddingVertical: 80 },
  emptyIconBox: { width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.primaryPale, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 6 },
  emptySub: { fontSize: 14, color: COLORS.textMuted },
});
