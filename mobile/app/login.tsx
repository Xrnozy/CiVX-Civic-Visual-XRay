import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirebaseAuth, isFirebaseConfigured } from '../lib/firebase';
import { router } from 'expo-router';

type Mode = 'signin' | 'register';

function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code;
  if (code === 'auth/operation-not-allowed') {
    return 'Enable Email/Password in Firebase Console → Authentication.';
  }
  if (code === 'auth/email-already-in-use') return 'Email already registered. Try signing in.';
  if (code === 'auth/weak-password') return 'Password must be at least 6 characters.';
  if (code === 'auth/invalid-credential') return 'Incorrect email or password.';
  return 'Authentication failed.';
}

export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>('signin');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function submit() {
    if (!isFirebaseConfigured) {
      Alert.alert('Firebase not configured', 'Set EXPO_PUBLIC_FIREBASE_* in infra/.env');
      return;
    }
    try {
      const auth = getFirebaseAuth();
      const cred =
        mode === 'register'
          ? await createUserWithEmailAndPassword(auth, email, password)
          : await signInWithEmailAndPassword(auth, email, password);
      if (mode === 'register' && fullName.trim()) {
        await updateProfile(cred.user, { displayName: fullName.trim() });
        await cred.user.reload();
      }
      const token = await cred.user.getIdToken(true);
      await AsyncStorage.setItem('civx_token', token);
      router.replace('/');
    } catch (err) {
      Alert.alert(mode === 'register' ? 'Registration failed' : 'Login failed', authErrorMessage(err));
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{mode === 'signin' ? 'Sign in to CiVX' : 'Create your account'}</Text>
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, mode === 'signin' && styles.tabActive]} onPress={() => setMode('signin')}>
          <Text style={mode === 'signin' ? styles.tabTextActive : styles.tabText}>Sign in</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, mode === 'register' && styles.tabActive]} onPress={() => setMode('register')}>
          <Text style={mode === 'register' ? styles.tabTextActive : styles.tabText}>Register</Text>
        </TouchableOpacity>
      </View>
      {mode === 'register' && (
        <TextInput style={styles.input} placeholder="Full name" value={fullName} onChangeText={setFullName} />
      )}
      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={styles.input} placeholder="Password (min. 6)" value={password} onChangeText={setPassword} secureTextEntry />
      <TouchableOpacity style={styles.btn} onPress={submit}>
        <Text style={styles.btnText}>{mode === 'signin' ? 'Sign In' : 'Create Account'}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '600', marginBottom: 24 },
  tabs: { flexDirection: 'row', marginBottom: 16, borderRadius: 999, borderWidth: 1, borderColor: '#e0e0e0', padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 999 },
  tabActive: { backgroundColor: '#fff' },
  tabText: { color: '#7a7a7a' },
  tabTextActive: { color: '#1d1d1f', fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 999, padding: 16, marginBottom: 12 },
  btn: { backgroundColor: '#0066cc', borderRadius: 999, padding: 16, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontSize: 17 },
});
