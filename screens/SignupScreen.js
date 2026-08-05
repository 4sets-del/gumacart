import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
  ActivityIndicator, StatusBar, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Rect, Ellipse, Circle } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
const STATUSBAR_TOP = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;

const GREEN = '#2E6B3E';
const BG = '#EAEDE8';
const W = Dimensions.get('window').width;

function CampusSilhouette() {
  const c = '#B8CCAF';
  return (
    <Svg width={W} height={110} viewBox="0 0 390 110" preserveAspectRatio="xMidYMid meet">
      <Rect x="0" y="95" width="390" height="15" fill={c} opacity="0.35" />
      <Ellipse cx="12" cy="72" rx="12" ry="18" fill={c} opacity="0.45" />
      <Rect x="9" y="86" width="5" height="9" fill={c} opacity="0.4" />
      <Ellipse cx="30" cy="66" rx="15" ry="24" fill={c} opacity="0.5" />
      <Rect x="27" y="85" width="6" height="10" fill={c} opacity="0.4" />
      <Rect x="50" y="58" width="50" height="37" fill={c} opacity="0.4" />
      <Rect x="60" y="50" width="30" height="12" fill={c} opacity="0.4" />
      <Rect x="56" y="68" width="8" height="12" fill={c} opacity="0.25" rx="1" />
      <Rect x="72" y="68" width="8" height="12" fill={c} opacity="0.25" rx="1" />
      <Rect x="88" y="68" width="8" height="12" fill={c} opacity="0.25" rx="1" />
      <Rect x="130" y="52" width="130" height="43" fill={c} opacity="0.45" />
      <Rect x="115" y="62" width="20" height="33" fill={c} opacity="0.4" />
      <Rect x="255" y="62" width="20" height="33" fill={c} opacity="0.4" />
      <Rect x="148" y="42" width="94" height="14" fill={c} opacity="0.45" />
      <Rect x="178" y="28" width="34" height="16" fill={c} opacity="0.48" />
      <Path d="M178 28 Q195 8 212 28 Z" fill={c} opacity="0.52" />
      <Rect x="190" y="4" width="10" height="14" fill={c} opacity="0.45" />
      <Circle cx="195" cy="22" r="5" fill={c} opacity="0.3" />
      <Rect x="140" y="65" width="9" height="13" fill={c} opacity="0.25" rx="1" />
      <Rect x="158" y="65" width="9" height="13" fill={c} opacity="0.25" rx="1" />
      <Rect x="176" y="65" width="9" height="13" fill={c} opacity="0.25" rx="1" />
      <Rect x="195" y="65" width="9" height="13" fill={c} opacity="0.25" rx="1" />
      <Rect x="213" y="65" width="9" height="13" fill={c} opacity="0.25" rx="1" />
      <Rect x="231" y="65" width="9" height="13" fill={c} opacity="0.25" rx="1" />
      <Rect x="249" y="65" width="9" height="13" fill={c} opacity="0.25" rx="1" />
      <Rect x="285" y="58" width="52" height="37" fill={c} opacity="0.4" />
      <Rect x="293" y="50" width="36" height="12" fill={c} opacity="0.4" />
      <Rect x="290" y="68" width="8" height="12" fill={c} opacity="0.25" rx="1" />
      <Rect x="306" y="68" width="8" height="12" fill={c} opacity="0.25" rx="1" />
      <Rect x="322" y="68" width="8" height="12" fill={c} opacity="0.25" rx="1" />
      <Ellipse cx="352" cy="66" rx="15" ry="24" fill={c} opacity="0.5" />
      <Rect x="348" y="85" width="6" height="10" fill={c} opacity="0.4" />
      <Ellipse cx="374" cy="72" rx="13" ry="20" fill={c} opacity="0.45" />
      <Rect x="371" y="87" width="5" height="8" fill={c} opacity="0.4" />
    </Svg>
  );
}

export default function SignupScreen({ navigation }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [age, setAge] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState('student'); // 'student' | 'faculty'

  const addressRef = useRef(null);
  const ageRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const handleSignup = async () => {
    if (!name || !address || !age || !email || !password) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    if (isNaN(age) || Number(age) < 12 || Number(age) > 100) {
      Alert.alert('Invalid age', 'Please enter a valid age.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak password', 'Password must be at least 6 characters.');
      return;
    }

    if (role === 'faculty') {
      Alert.alert(
        'Requesting Faculty status?',
        'Your account will be created as a student and your faculty status will be reviewed by an admin before it\'s granted.',
        [
          { text: 'Go back', style: 'cancel' },
          { text: 'Continue', onPress: () => createAccount(true) },
        ]
      );
      return;
    }

    createAccount(false);
  };

  const createAccount = async (isFacultyRequest) => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;
      await updateProfile(user, { displayName: name });
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid, name, address,
        age: Number(age), email: email.trim(),
        createdAt: serverTimestamp(),
        role: 'student',
        facultyRequest: isFacultyRequest ? 'pending' : 'none',
      });
      await sendEmailVerification(user);
      // No popup needed — the EmailVerification screen already explains this
      // and shows automatically since user.emailVerified is false.
    } catch (error) {
      let message = 'Something went wrong. Please try again.';
      if (error.code === 'auth/email-already-in-use') message = 'That email is already registered.';
      else if (error.code === 'auth/invalid-email') message = 'Please enter a valid email address.';
      Alert.alert('Sign Up Failed', message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['left','right']}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />

      <View style={styles.blobTopRight} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={20} color="#444" />
          </TouchableOpacity>

          <View style={styles.logoSection}>
            <View style={styles.logoCircle}>
              <Text style={styles.logoEmoji}>🛒</Text>
            </View>
            <Text style={styles.appName}>SLSU-GumaCart</Text>
            <Text style={styles.tagline}>Create your account</Text>
          </View>

          <View style={styles.form}>

            <Text style={styles.fieldLabel}>I am a</Text>
            <View style={styles.roleToggle}>
              <TouchableOpacity
                style={[styles.roleOption, role === 'student' && styles.roleOptionActive]}
                onPress={() => setRole('student')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="school-outline"
                  size={18}
                  color={role === 'student' ? '#fff' : GREEN}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.roleText, role === 'student' && styles.roleTextActive]}>
                  Student
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.roleOption, role === 'faculty' && styles.roleOptionActive]}
                onPress={() => setRole('faculty')}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="briefcase-outline"
                  size={18}
                  color={role === 'faculty' ? '#fff' : GREEN}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.roleText, role === 'faculty' && styles.roleTextActive]}>
                  Faculty
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Name</Text>
            <View style={styles.inputBox}>
              <Ionicons name="person-outline" size={20} color={GREEN} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                placeholderTextColor="#B0BBA8"
                value={name}
                onChangeText={setName}
                returnKeyType="next"
                onSubmitEditing={() => addressRef.current?.focus()}
              />
            </View>

            <Text style={styles.fieldLabel}>Address</Text>
            <View style={styles.inputBox}>
              <Ionicons name="location-outline" size={20} color={GREEN} style={styles.inputIcon} />
              <TextInput
                ref={addressRef}
                style={styles.input}
                placeholder="Enter your address"
                placeholderTextColor="#B0BBA8"
                value={address}
                onChangeText={setAddress}
                returnKeyType="next"
                onSubmitEditing={() => ageRef.current?.focus()}
              />
            </View>

            <Text style={styles.fieldLabel}>Age</Text>
            <View style={styles.inputBox}>
              <Ionicons name="calendar-outline" size={20} color={GREEN} style={styles.inputIcon} />
              <TextInput
                ref={ageRef}
                style={styles.input}
                placeholder="Enter your age"
                placeholderTextColor="#B0BBA8"
                value={age}
                onChangeText={setAge}
                keyboardType="numeric"
                maxLength={3}
                returnKeyType="next"
                onSubmitEditing={() => emailRef.current?.focus()}
              />
            </View>

            <Text style={styles.fieldLabel}>Email</Text>
            <View style={styles.inputBox}>
              <Ionicons name="mail-outline" size={20} color={GREEN} style={styles.inputIcon} />
              <TextInput
                ref={emailRef}
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor="#B0BBA8"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
            </View>

            <Text style={styles.fieldLabel}>Password</Text>
            <View style={styles.inputBox}>
              <Ionicons name="lock-closed-outline" size={20} color={GREEN} style={styles.inputIcon} />
              <TextInput
                ref={passwordRef}
                style={[styles.input, { flex: 1 }]}
                placeholder="Create a password"
                placeholderTextColor="#B0BBA8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleSignup}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={GREEN} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[styles.signupBtn, loading && { opacity: 0.7 }]}
              onPress={handleSignup}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.signupBtnText}>Sign Up</Text>}
            </TouchableOpacity>

            <View style={styles.termsRow}>
              <Text style={styles.terms}>
                By signing up, you agree to our{' '}
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Terms')}>
                <Text style={styles.termsLink}>Terms and Conditions</Text>
              </TouchableOpacity>
            </View>

          </View>

          <View style={styles.silhouetteSection}>
            <CampusSilhouette />
            <View style={styles.termsOverlay}>
              <Text style={styles.termsOverlayText}>By signing up, you agree to our </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Terms')}>
                <Text style={styles.termsOverlayLink}>Terms and Conditions</Text>
              </TouchableOpacity>
              <Text style={styles.termsOverlayText}>.</Text>
            </View>
          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG, paddingTop: STATUSBAR_TOP },
  blobTopRight: {
    position: 'absolute', top: -60, right: -100,
    width: 280, height: 280, borderRadius: 140,
    backgroundColor: '#C8D9C0', opacity: 0.6,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#D8E0D4', elevation: 1,
    marginBottom: 8,
  },
  container: { flexGrow: 1, paddingHorizontal: 28, paddingTop: 20 },
  logoSection: { alignItems: 'center', paddingTop: 40, paddingBottom: 20 },
  logoCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: '#D6E8D0', alignItems: 'center', justifyContent: 'center', marginBottom: 14,
  },
  logoEmoji: { fontSize: 40 },
  appName: { fontSize: 26, fontWeight: '800', color: GREEN, marginBottom: 4, letterSpacing: -0.5 },
  tagline: { fontSize: 14, color: '#888' },
  form: { flex: 1 },
  fieldLabel: { fontSize: 14, fontWeight: '700', color: GREEN, marginBottom: 8, marginTop: 16 },
  roleToggle: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#D0DBD0',
    padding: 5,
    gap: 5,
  },
  roleOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
  },
  roleOptionActive: {
    backgroundColor: GREEN,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  roleText: { color: GREEN, fontWeight: '700', fontSize: 14 },
  roleTextActive: { color: '#fff' },
  inputBox: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14,
    borderWidth: 1.5, borderColor: '#D0DBD0',
    paddingHorizontal: 16, height: 56,
  },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 15, color: '#333' },
  signupBtn: {
    backgroundColor: GREEN, borderRadius: 14, height: 58,
    alignItems: 'center', justifyContent: 'center', marginTop: 28, elevation: 2,
  },
  signupBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  termsRow: { display: 'none' },
  terms: { textAlign: 'center', fontSize: 13, color: '#888', lineHeight: 20 },
  termsLink: { color: GREEN, fontWeight: '700', textDecorationLine: 'underline', fontSize: 13 },
  silhouetteSection: { position: 'relative', marginTop: 16, marginHorizontal: -28 },
  termsOverlay: {
    position: 'absolute', top: 8, left: 0, right: 0,
    flexDirection: 'row', flexWrap: 'wrap',
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 20,
  },
  termsOverlayText: { fontSize: 13, color: '#555' },
  termsOverlayLink: { fontSize: 13, color: GREEN, fontWeight: '700', textDecorationLine: 'underline' },
});
