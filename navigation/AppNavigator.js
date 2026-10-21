import React, { useRef, useEffect, useState } from 'react';
import { View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, query, where, onSnapshot, doc, getDoc } from 'firebase/firestore';

import { useAuth } from '../context/AuthContext';
import { COLORS, GRADIENTS } from '../constants/theme';

// ── Built screens ──
import HomeScreen from '../screens/HomeScreen';
import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import TermsScreen from '../screens/TermsScreen';
import AboutScreen from '../screens/AboutScreen';
import MessagesScreen from '../screens/MessagesScreen';
import CreateListingScreen from '../screens/CreateListingScreen';
import ChatScreen from '../screens/ChatScreen';
import CartScreen from '../screens/CartScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';
import VerificationScreen from '../screens/VerificationScreen';
import AdminPanelScreen from '../screens/AdminPanelScreen';
import SellerProfileScreen from '../screens/SellerProfileScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import SearchScreen from '../screens/SearchScreen';
import FollowingScreen from '../screens/FollowingScreen';
import EmailVerificationScreen from '../screens/EmailVerificationScreen';
import BannedScreen from '../screens/BannedScreen';
import SplashScreen from '../screens/SplashScreen';
import WelcomeScreen from '../screens/WelcomeScreen';
import CategoriesScreen from '../screens/CategoriesScreen';
import MyListingsScreen from '../screens/MyListingsScreen';
import { addNotificationResponseListener } from '../utils/notifications';
import { auth, db } from '../firebaseConfig';

const Stack = createStackNavigator();

const tabStyles = {
  iconWrap: { width: 46, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  iconWrapActive: { backgroundColor: COLORS.primaryPale },
  sellBtn: {
    width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', marginTop: -22,
    borderWidth: 4, borderColor: COLORS.white, elevation: 6,
    shadowColor: '#F97316', shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 4 },
  },
};
const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Home:       ['home', 'home-outline'],
  Categories: ['grid', 'grid-outline'],
  Sell:       ['add-circle', 'add-circle-outline'],
  Messages:   ['chatbubble-ellipses', 'chatbubble-ellipses-outline'],
  Profile:    ['person', 'person-outline'],
};

// "Sell" opens the CreateListing screen on top of the tabs instead of being a
// real tab, so the form always starts fresh.
function SellPlaceholder() {
  return null;
}

function useUnreadConversationCount() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const q = query(collection(db, 'conversations'), where('participants', 'array-contains', uid));
    return onSnapshot(
      q,
      (snap) => setCount(snap.docs.filter((d) => (d.data().unreadCount?.[uid] || 0) > 0).length),
      () => {},
    );
  }, []);
  return count;
}

function MainTabs() {
  const unread = useUnreadConversationCount();
  // Room for icon + label, plus the phone's gesture/navigation bar.
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8);
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarStyle: {
          borderTopColor: COLORS.border,
          backgroundColor: COLORS.white,
          height: 64 + bottomPad,
          paddingTop: 8,
          paddingBottom: bottomPad,
        },
        tabBarItemStyle: { height: 56 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
        tabBarIcon: ({ focused, color }) => (
          route.name === 'Sell' ? (
            <LinearGradient colors={GRADIENTS.sunset} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={tabStyles.sellBtn}>
              <Ionicons name="add" size={28} color="#fff" />
            </LinearGradient>
          ) : (
            <View style={[tabStyles.iconWrap, focused && tabStyles.iconWrapActive]}>
              <Ionicons name={TAB_ICONS[route.name][focused ? 0 : 1]} size={22} color={color} />
            </View>
          )
        ),
      })}
    >
      <Tab.Screen name="Home"       component={HomeScreen} />
      <Tab.Screen name="Categories" component={CategoriesScreen} />
      <Tab.Screen
        name="Sell"
        component={SellPlaceholder}
        options={{ tabBarLabelStyle: { fontSize: 11, fontWeight: '700', color: '#EA580C', marginTop: 2 } }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigation.navigate('CreateListing');
          },
        })}
      />
      <Tab.Screen
        name="Messages"
        component={MessagesScreen}
        options={{
          tabBarBadge: unread > 0 ? (unread > 9 ? '9+' : unread) : undefined,
          tabBarBadgeStyle: { backgroundColor: COLORS.error, fontSize: 10 },
        }}
      />
      <Tab.Screen name="Profile"    component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function AppStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main"          component={MainTabs} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <Stack.Screen name="Chat"          component={ChatScreen} />
      <Stack.Screen name="SellerProfile" component={SellerProfileScreen} />
      <Stack.Screen name="Cart"          component={CartScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Settings"      component={SettingsScreen} />
      <Stack.Screen name="MyListings"    component={MyListingsScreen} />
      <Stack.Screen name="About"         component={AboutScreen} />
      <Stack.Screen name="Terms"         component={TermsScreen} />
      <Stack.Screen name="AdminPanel"    component={AdminPanelScreen} />
      <Stack.Screen name="CreateListing" component={CreateListingScreen} />
      <Stack.Screen name="Following"     component={FollowingScreen} />
      <Stack.Screen name="Search"        component={SearchScreen} />
      <Stack.Screen name="Verification"  component={VerificationScreen} />
    </Stack.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Welcome"      component={WelcomeScreen} />
      <Stack.Screen name="Login"        component={LoginScreen} />
      <Stack.Screen name="Signup"       component={SignupScreen} />
      <Stack.Screen name="Verification" component={VerificationScreen} />
      <Stack.Screen name="Terms"        component={TermsScreen} />
    </Stack.Navigator>
  );
}

function EmailVerifyStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="EmailVerification" component={EmailVerificationScreen} />
    </Stack.Navigator>
  );
}

function BannedStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Banned" component={BannedScreen} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading, emailVerified, isBanned } = useAuth();
  const navigationRef = useRef(null);

  useEffect(() => {
    const unsubscribe = addNotificationResponseListener(async (data) => {
      const navRef = navigationRef.current;
      if (!navRef) return;
      const nav = data.nav || data.type;

      if (nav === 'chat' || data.type === 'message') {
        navRef.navigate('Main', { screen: 'Messages' });
      } else if (nav === 'self') {
        navRef.navigate('Main', { screen: 'Profile' });
      } else if (nav === 'profile') {
        if (data.profileId) {
          navRef.navigate('SellerProfile', { sellerId: data.profileId, sellerName: data.profileName || 'User' });
        } else {
          navRef.navigate('Main', { screen: 'Profile' });
        }
      } else if (nav === 'verification') {
        navRef.navigate('Verification');
      } else if (nav === 'listing' && data.listingId) {
        try {
          const snap = await getDoc(doc(db, 'listings', data.listingId));
          if (snap.exists()) {
            const listing = { id: snap.id, ...snap.data() };
            if (data.edit === '1' || listing.status === 'rejected') {
              navRef.navigate('CreateListing', { editListing: listing });
            } else {
              navRef.navigate('ProductDetail', { product: listing });
            }
          }
        } catch (e) {}
      }
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return <SplashScreen />;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      {!user
        ? <AuthStack />
        : !emailVerified
          ? <EmailVerifyStack />
          : isBanned
            ? <BannedStack />
            : <AppStack />}
    </NavigationContainer>
  );
}
