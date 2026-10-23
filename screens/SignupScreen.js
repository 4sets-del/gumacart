import React, { useState, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, KeyboardAvoidingView, Platform, StatusBar,
} from 'react-native';
import KeyboardScrollView from '../components/KeyboardScrollView';
import { Alert } from '../components/AppAlert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { createUserWithEmailAndPassword, updateProfile, sendEmailVerification } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { RADIUS, FONTS } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import GradientButton from '../components/GradientButton';
import { SCHOOL_DOMAIN, isSchoolEmail } from '../constants/school';
import AcademicFields from '../components/AcademicFields';

export default function SignupScreen({ navigation }) {
  const { COLORS, styles } = useTheme(createStyles);
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [age, setAge] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState('student'); // 'student' | 'faculty'
  const [course, setCourse] = useState(null);
  const [yearLevel, setYearLevel] = useState(null);

  // Shown in red once they've typed a full email that isn't an SLSU one.
  const emailWrong = email.includes('@') && !isSchoolEmail(email);

  const addressRef = useRef(null);
  const ageRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  const handleSignup = async () => {
    if (!name || !address || !age || !email || !password) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    if (!course) {
      Alert.alert('Course', 'Please choose your course.');
      return;
    }
    if (role === 'student' && !yearLevel) {
      Alert.alert('Year level', 'Please choose your year level.');
      return;
    }
    if (isNaN(age) || Number(age) < 12 || Number(age) > 100) {
      Alert.alert('Invalid age', 'Please enter a valid age.');
      return;
    }
    if (!isSchoolEmail(email)) {
      Alert.alert('SLSU email required', `GumaCart is only for the SLSU community. Please sign up with your institutional email ending in @${SCHOOL_DOMAIN}.`);
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
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      const user = userCredential.user;
      await updateProfile(user, { displayName: name });
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid, name, address,
        age: Number(age), email: email.trim().toLowerCase(),
        createdAt: serverTimestamp(),
        role: 'student',
        facultyRequest: isFacultyRequest ? 'pending' : 'none',
        course,
        yearLevel: isFacultyRequest ? null : yearLevel,
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
      <StatusBar barStyle={COLORS.statusBar} />

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <KeyboardScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>

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

            <AcademicFields
              course={course}
              onCourse={setCourse}
              yearLevel={yearLevel}
              onYearLevel={setYearLevel}
              showYear={role === 'student'}
              labelStyle={styles.fieldLabel}
            />

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

            <Text style={styles.fieldLabel}>SLSU Email</Text>
            <View style={styles.inputBox}>
              <Ionicons name="mail-outline" size={20} color={COLORS.textMuted} style={styles.inputIcon} />
              <TextInput
                ref={emailRef}
                style={styles.input}
                placeholder={`yourname@${SCHOOL_DOMAIN}`}
                placeholderTextColor={COLORS.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
              />
              {isSchoolEmail(email) && <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />}
            </View>
            <View style={styles.helpRow}>
              <Ionicons name="school-outline" size={14} color={emailWrong ? COLORS.error : COLORS.textMuted} />
              <Text style={[styles.helpText, emailWrong && { color: COLORS.error }]}>
                Use your institutional email (@{SCHOOL_DOMAIN}). Personal emails aren't accepted.
              </Text>
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

        </KeyboardScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const createStyles = (COLORS) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.surface },
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
  helpRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8 },
  helpText: { flex: 1, fontSize: 12.5, lineHeight: 17, color: COLORS.textMuted },
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
