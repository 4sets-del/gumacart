import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert, StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { COLORS, RADIUS, FONTS } from '../constants/theme';
import GradientButton from '../components/GradientButton';

export default function SignupScreen({ navigation }) {
  const insets = useSafeAreaInsets();
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
    <View style={[styles.safe, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Go back" style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textPrimary} />
          </TouchableOpacity>

          <View style={styles.logoSection}>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.tagline}>Join the SLSU campus marketplace.</Text>
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
                  color={role === 'student' ? '#fff' : COLORS.textSecondary}
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
                  color={role === 'faculty' ? '#fff' : COLORS.textSecondary}
                  style={{ marginRight: 6 }}
                />
                <Text style={[styles.roleText, role === 'faculty' && styles.roleTextActive]}>
                  Faculty
                </Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.fieldLabel}>Name</Text>
            <View style={styles.inputBox}>
              <Ionicons name="person-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Enter your full name"
                placeholderTextColor={COLORS.textMuted}
                value={name}
                onChangeText={setName}
                returnKeyType="next"
                onSubmitEditing={() => addressRef.current?.focus()}
              />
            </View>

            <Text style={styles.fieldLabel}>Address</Text>
            <View style={styles.inputBox}>
              <Ionicons name="location-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
              <TextInput
                ref={addressRef}
                style={styles.input}
                placeholder="Enter your address"
                placeholderTextColor={COLORS.textMuted}
                value={address}
                onChangeText={setAddress}
                returnKeyType="next"
                onSubmitEditing={() => ageRef.current?.focus()}
              />
            </View>

            <Text style={styles.fieldLabel}>Age</Text>
            <View style={styles.inputBox}>
              <Ionicons name="calendar-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
              <TextInput
                ref={ageRef}
                style={styles.input}
                placeholder="Enter your age"
                placeholderTextColor={COLORS.textMuted}
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
              <Ionicons name="mail-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
              <TextInput
                ref={emailRef}
                style={styles.input}
                placeholder="Enter your email"
                placeholderTextColor={COLORS.textMuted}
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
              <Ionicons name="lock-closed-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
              <TextInput
                ref={passwordRef}
                style={[styles.input, { flex: 1 }]}
                placeholder="Create a password"
                placeholderTextColor={COLORS.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleSignup}
              />
              <TouchableOpacity accessibilityRole="button" accessibilityLabel={showPassword ? "Hide password" : "Show password"} onPress={() => setShowPassword(!showPassword)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <GradientButton title="Sign Up" icon="person-add-outline" onPress={handleSignup} loading={loading} style={{ marginTop: 28 }} />

            <View style={styles.termsRow}>
              <Text style={styles.terms}>By signing up, you agree to our </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Terms')}>
                <Text style={styles.termsLink}>Terms and Conditions</Text>
              </TouchableOpacity>
              <Text style={styles.terms}> and </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Privacy')}>
                <Text style={styles.termsLink}>Privacy Policy</Text>
              </TouchableOpacity>
              <Text style={styles.terms}>.</Text>
            </View>

            <View style={styles.loginRow}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.loginLink}>Login</Text>
              </TouchableOpacity>
            </View>

          </View>

        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  backBtn: { width: 44, height: 44, justifyContent: 'center', marginTop: 4, marginLeft: -6 },
  container: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 32 },
  logoSection: { paddingTop: 12, paddingBottom: 4 },
  title: { fontSize: 26, fontFamily: FONTS.heading, color: COLORS.textPrimary, letterSpacing: -0.5 },
  tagline: { fontSize: 14.5, color: COLORS.textSecondary, marginTop: 6 },
  form: { flex: 1 },
  fieldLabel: { fontSize: 13.5, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 8, marginTop: 16 },
  roleToggle: { flexDirection: 'row', backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.full, padding: 4, gap: 4 },
  roleOption: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: RADIUS.full },
  roleOptionActive: { backgroundColor: COLORS.primary },
  roleText: { color: COLORS.textSecondary, fontWeight: '700', fontSize: 14 },
  roleTextActive: { color: '#fff' },
  inputBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.md, paddingHorizontal: 14, height: 52 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: COLORS.textPrimary, paddingVertical: 0 },
  signupBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: 28 },
  signupBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  termsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginTop: 16 },
  terms: { fontSize: 12.5, color: COLORS.textMuted, lineHeight: 18 },
  termsLink: { fontSize: 12.5, color: COLORS.primary, fontWeight: '700', lineHeight: 18 },
  loginRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 },
  loginText: { fontSize: 14, color: COLORS.textSecondary },
  loginLink: { fontSize: 14, color: COLORS.primary, fontWeight: '700' },
});
