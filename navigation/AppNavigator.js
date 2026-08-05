import React, { useRef, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

import { useAuth } from '../context/AuthContext';
import { COLORS } from '../constants/theme';

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
import { addNotificationResponseListener } from '../utils/notifications';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

// ── Placeholder for screens not built yet ──
function ComingSoon({ route }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background }}>
      <Text style={{ fontSize: 40 }}>🚧</Text>
      <Text style={{ fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginTop: 12 }}>
        {route.name}
      </Text>
      <Text style={{ fontSize: 14, color: COLORS.textMuted, marginTop: 6 }}>Coming soon!</Text>
    </View>
  );
}

const Stack = createStackNavigator();

function AppStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home"          component={HomeScreen} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} />
      <Stack.Screen name="Chat"          component={ChatScreen} />
      <Stack.Screen name="SellerProfile" component={SellerProfileScreen} />
      <Stack.Screen name="Cart"          component={CartScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="Settings"      component={SettingsScreen} />
      <Stack.Screen name="EditProfile"   component={ComingSoon} />
      <Stack.Screen name="MyListings"    component={ComingSoon} />
      <Stack.Screen name="About"         component={AboutScreen} />
      <Stack.Screen name="Terms"         component={TermsScreen} />
      <Stack.Screen name="AdminPanel"    component={AdminPanelScreen} />
      <Stack.Screen name="CreateListing" component={CreateListingScreen} />
      <Stack.Screen name="Messages"      component={MessagesScreen} />
      <Stack.Screen name="Profile"       component={ProfileScreen} />
      <Stack.Screen name="Following"     component={FollowingScreen} />
      <Stack.Screen name="Search"        component={SearchScreen} />
      <Stack.Screen name="Verification"  component={VerificationScreen} />
    </Stack.Navigator>
  );
}

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
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
        navRef.navigate('Messages');
      } else if (nav === 'self') {
        navRef.navigate('Profile');
      } else if (nav === 'profile') {
        if (data.profileId) {
          navRef.navigate('SellerProfile', { sellerId: data.profileId, sellerName: data.profileName || 'User' });
        } else {
          navRef.navigate('Profile');
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
