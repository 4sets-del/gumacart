import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, ActivityIndicator,
} from 'react-native';
import { Alert } from '../components/AppAlert';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  collection, query, orderBy, onSnapshot, limit,
  doc, updateDoc, deleteDoc, getDocs, getDoc, writeBatch,
} from 'firebase/firestore';
import { Swipeable } from 'react-native-gesture-handler';
import { auth, db } from '../firebaseConfig';
import ScreenHeader from '../components/ScreenHeader';
import { COLORS, RADIUS, FONTS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';


const NOTIF_ICONS = (COLORS) => ({
  message:     { icon: 'chatbubble-ellipses', color: '#2563EB' },
  follow:      { icon: 'person-add',          color: '#7C3AED' },
  review:      { icon: 'star',                color: '#F59E0B' },
  rate_prompt: { icon: 'star-half',           color: '#F59E0B' },
  listing_update: { icon: 'pricetags',        color: '#EA580C' },
  search_alert: { icon: 'notifications',      color: '#0D9488' },
  listing_expired: { icon: 'hourglass',       color: '#D9822B' },
  offer:       { icon: 'pricetag',            color: COLORS.primary },
  sold:        { icon: 'checkmark-circle',    color: COLORS.primary },
  new_listing: { icon: 'bag-handle',          color: '#EA580C' },
  barter:      { icon: 'swap-horizontal',     color: '#EA580C' },
  donate:      { icon: 'gift',                color: '#E11D48' },
  system:      { icon: 'megaphone',           color: '#0D9488' },
});

// Filter chips. Notifications are grouped by where tapping them leads.
const FILTERS = [
  { id: 'all',      label: 'All',      icon: 'apps' },
  { id: 'messages', label: 'Messages', icon: 'chatbubble-ellipses' },
  { id: 'listings', label: 'Listings', icon: 'pricetags' },
  { id: 'social',   label: 'Social',   icon: 'people' },
  { id: 'account',  label: 'Account',  icon: 'shield-checkmark' },
];

function categoryOf(n) {
  if (n.type === 'message' || n.nav === 'chat') return 'messages';
  if (n.nav === 'listing') return 'listings';
  if (n.type === 'follow' || n.type === 'review' || n.type === 'rate_prompt') return 'social';
  return 'account';
}

// "Today", "Yesterday", "This week" or "Earlier" for a notification time.
function dayGroup(ts) {
  const d = ts?.toDate ? ts.toDate() : new Date();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((startOfToday - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
  if (diffDays <= 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return 'This week';
  return 'Earlier';
}

const PAGE = 50;

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
  const { COLORS, styles } = useTheme(createStyles);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all');
  // Only the newest notifications are loaded; "Load older" grows the window.
  const [notifLimit, setNotifLimit] = useState(PAGE);
  const [hasOlder, setHasOlder] = useState(false);
  const user = auth.currentUser;

  useEffect(() => {
    if (!user?.uid) { setLoading(false); return; }
    const q = query(
      collection(db, 'users', user.uid, 'notifications'),
      orderBy('createdAt', 'desc'),
      limit(notifLimit),
    );
    const unsub = onSnapshot(q, (snap) => {
      setHasOlder(snap.size >= notifLimit);
      setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
      setRefreshing(false);
    }, (e) => { console.log('Notifications error:', e.message); setLoading(false); setRefreshing(false); });
    return unsub;
  }, [notifLimit]);

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
          openRating: notif.rate === '1',
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

    if (nav === 'admin') {
      navigation.navigate('AdminPanel', { tab: notif.tab || 'insights' });
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
  const shown = filter === 'all' ? notifications : notifications.filter((n) => categoryOf(n) === filter);

  // Group into Today / Yesterday / This week / Earlier, keeping order.
  const groups = [];
  shown.forEach((n) => {
    const label = dayGroup(n.createdAt);
    if (!groups.length || groups[groups.length - 1].label !== label) groups.push({ label, items: [] });
    groups[groups.length - 1].items.push(n);
  });

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
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow} style={styles.filterScroll}>
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <TouchableOpacity key={f.id} style={[styles.filterChip, active && styles.filterChipActive]} activeOpacity={0.8} onPress={() => setFilter(f.id)}>
              <Ionicons name={f.icon} size={14} color={active ? '#fff' : COLORS.textSecondary} />
              <Text style={[styles.filterText, active && styles.filterTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : shown.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconBox}>
              <Ionicons name="notifications-off-outline" size={42} color={COLORS.primary} />
            </View>
            <Text style={styles.emptyTitle}>{filter === 'all' ? 'No notifications' : 'Nothing here'}</Text>
            <Text style={styles.emptySub}>You're all caught up!</Text>
          </View>
        ) : (
          <>
            {groups.map((g, gi) => (
              <View key={g.label} style={styles.section}>
                <View style={styles.sectionRow}>
                  <Text style={styles.sectionLabel}>{g.label}</Text>
                  {gi === 0 && (
                    <TouchableOpacity onPress={clearAll} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Text style={styles.clearText}>Clear all</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {g.items.map((notif) => (
                  <NotifCard key={notif.id} notif={notif} onPress={() => openNotif(notif)} onDelete={() => deleteNotification(notif.id)} />
                ))}
              </View>
            ))}
            <Text style={styles.swipeHint}>Swipe left on a notification to delete it</Text>
            {hasOlder && (
              <TouchableOpacity style={styles.loadOlderBtn} activeOpacity={0.8} onPress={() => setNotifLimit((n) => n + PAGE)}>
                <Text style={styles.loadOlderText}>Load older notifications</Text>
              </TouchableOpacity>
            )}
          </>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

function NotifCard({ notif, onPress, onDelete }) {
  const { styles } = useTheme(createStyles);
  const conf = NOTIF_ICONS(COLORS)[notif.type] || NOTIF_ICONS(COLORS).system;
  // Swipe left to reveal a red Delete action; a full swipe deletes.
  const renderDelete = () => (
    <TouchableOpacity style={styles.deleteAction} activeOpacity={0.8} onPress={onDelete}>
      <Ionicons name="trash" size={20} color="#fff" />
      <Text style={styles.deleteActionText}>Delete</Text>
    </TouchableOpacity>
  );
  return (
    <Swipeable renderRightActions={renderDelete} onSwipeableOpen={(dir) => { if (dir === 'right') onDelete(); }} rightThreshold={90} overshootRight={false}>
      <TouchableOpacity style={[styles.notifCard, !notif.read && styles.notifCardUnread]} onPress={onPress} activeOpacity={0.8}>
        <View style={[styles.notifIconBox, { backgroundColor: conf.color + '1A' }]}>
          <Ionicons name={conf.icon} size={20} color={conf.color} />
        </View>
        <View style={styles.notifContent}>
          <View style={styles.notifTopRow}>
            <Text style={[styles.notifTitle, !notif.read && styles.notifTitleUnread]} numberOfLines={1}>{notif.title}</Text>
            <Text style={styles.notifTime}>{timeAgo(notif.createdAt)}</Text>
          </View>
          <Text style={styles.notifBody} numberOfLines={2}>{notif.body}</Text>
        </View>
        {!notif.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    </Swipeable>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface },
  markAllBtn: { paddingHorizontal: 10, height: 44, justifyContent: 'center' },
  markAllText: { fontSize: 13, color: COLORS.primary, fontWeight: '700' },
  loadingWrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 90 },
  loadingText: { marginTop: 14, fontSize: 13, color: COLORS.textMuted, fontWeight: '500' },
  filterScroll: { flexGrow: 0, flexShrink: 0 },
  filterRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 13, paddingVertical: 7, borderRadius: RADIUS.full, backgroundColor: COLORS.surfaceAlt },
  filterChipActive: { backgroundColor: COLORS.primary },
  filterText: { fontSize: 12.5, fontWeight: '700', color: COLORS.textSecondary },
  filterTextActive: { color: '#fff' },
  deleteAction: { width: 88, marginBottom: 8, borderRadius: RADIUS.lg, backgroundColor: COLORS.error, alignItems: 'center', justifyContent: 'center', gap: 2, marginLeft: 8 },
  deleteActionText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  swipeHint: { textAlign: 'center', fontSize: 11.5, color: COLORS.textMuted, marginTop: 8 },
  loadOlderBtn: { alignSelf: 'center', marginTop: 12, paddingHorizontal: 18, paddingVertical: 9, borderRadius: RADIUS.full, backgroundColor: COLORS.primaryPale },
  loadOlderText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  section: { paddingHorizontal: 16, paddingTop: 8 },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionLabel: { fontSize: 15, fontFamily: FONTS.heading, color: COLORS.textPrimary, marginBottom: 8 },
  clearText: { fontSize: 13, color: COLORS.error, fontWeight: '600' },
  notifCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: 12, marginBottom: 8 },
  notifCardUnread: { backgroundColor: COLORS.primaryPale },
  notifIconBox: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  notifContent: { flex: 1 },
  notifTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
  notifTitle: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, flex: 1 },
  notifTitleUnread: { color: COLORS.textPrimary, fontWeight: '700' },
  notifTime: { fontSize: 11, color: COLORS.textMuted, marginLeft: 8 },
  notifBody: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginLeft: 8 },
  emptyState: { alignItems: 'center', paddingVertical: 80 },
  emptyIconBox: { width: 96, height: 96, borderRadius: 48, backgroundColor: COLORS.primaryPale, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontFamily: FONTS.heading, color: COLORS.textPrimary, marginBottom: 6 },
  emptySub: { fontSize: 14, color: COLORS.textMuted },
});
