import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '../lib/firebase';
import { router } from 'expo-router';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function login() {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
      const token = await cred.user.getIdToken();
      await AsyncStorage.setItem('civx_token', token);
      router.replace('/');
    } catch {
      Alert.alert('Login failed');
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sign in to CiVX</Text>
      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />
      <TouchableOpacity style={styles.btn} onPress={login}><Text style={styles.btnText}>Sign In</Text></TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 32, fontWeight: '600', marginBottom: 24 },
  input: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 999, padding: 16, marginBottom: 12 },
  btn: { backgroundColor: '#0066cc', borderRadius: 999, padding: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 17 },
});
