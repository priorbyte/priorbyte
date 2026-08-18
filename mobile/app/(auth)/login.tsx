import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { COLORS, FONTS, SPACING } from '@/lib/theme';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);

  async function handleSignIn() {
    if (!email.trim() || !password) {
      Alert.alert('Missing info', 'Enter your email and password.');
      return;
    }
    setPending(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setPending(false);
    if (error) {
      Alert.alert('Sign in failed', error.message);
    }
    // On success, RouteGuard in app/_layout.tsx redirects to (tabs)
    // automatically once onAuthStateChange fires.
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        <Text style={styles.title}>Priorbyte</Text>
        <Text style={styles.tagline}>Predict. Protect. Perfect.</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="yourname@karunya.edu.in"
            placeholderTextColor={COLORS.muted}
            style={[styles.input, { marginBottom: SPACING.md }]}
          />

          <Text style={styles.label}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="password"
              style={[styles.input, styles.passwordInput]}
            />
            <Pressable onPress={() => setShowPassword((v) => !v)} style={styles.showButton}>
              <Text style={styles.showButtonText}>{showPassword ? 'Hide' : 'Show'}</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={handleSignIn}
            disabled={pending}
            style={[styles.submitButton, pending && { opacity: 0.5 }]}
          >
            {pending ? (
              <ActivityIndicator color={COLORS.background} />
            ) : (
              <Text style={styles.submitButtonText}>Sign in</Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.footnote}>
          New accounts sign up on the Priorbyte website — this app is for signed-in students and
          faculty.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: COLORS.background },
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: SPACING.lg },
  title: {
    fontFamily: FONTS.display,
    fontSize: 32,
    color: COLORS.cyan,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  tagline: {
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: COLORS.muted,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: SPACING.xl,
  },
  card: {
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: SPACING.lg,
  },
  label: {
    fontFamily: FONTS.label,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: COLORS.muted,
    marginBottom: SPACING.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.line,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    color: COLORS.white,
    fontFamily: FONTS.sans,
    fontSize: 15,
  },
  passwordRow: { position: 'relative', marginBottom: SPACING.lg },
  passwordInput: { paddingRight: 64 },
  showButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
  },
  showButtonText: {
    fontFamily: FONTS.label,
    fontSize: 11,
    textTransform: 'uppercase',
    color: COLORS.cyan,
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: COLORS.cyan,
    borderRadius: 8,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  submitButtonText: {
    fontFamily: FONTS.display,
    fontSize: 16,
    textTransform: 'uppercase',
    color: COLORS.background,
  },
  footnote: {
    marginTop: SPACING.lg,
    textAlign: 'center',
    fontFamily: FONTS.sans,
    fontSize: 11,
    color: COLORS.muted,
  },
});
