import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirebaseAuth, isFirebaseConfigured } from '../lib/firebase';
import { api } from '../lib/api';
import { router, useLocalSearchParams } from 'expo-router';

type Mode = 'signin' | 'register';
type AccountType = 'citizen' | 'organizer' | 'street_sweeper';

type PublicWorkerType =
  | 'street_sweeper'
  | 'garbage_collector'
  | 'public_driver'
  | 'barangay_worker'
  | 'lgu_vehicle_operator'
  | 'patrol';

const ACCOUNT_LABELS: Record<AccountType, string> = {
  citizen: 'Community member',
  organizer: 'Community leader (NGO)',
  street_sweeper: 'Public Workers',
};

const PUBLIC_WORKER_TYPES: Record<PublicWorkerType, string> = {
  street_sweeper: 'Street sweeper',
  garbage_collector: 'Garbage collector',
  public_driver: 'Public driver',
  barangay_worker: 'Barangay worker',
  lgu_vehicle_operator: 'LGU vehicle operator',
  patrol: 'Patrol / security',
};

function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code;
  if (code === 'auth/operation-not-allowed') {
    return 'Enable Email/Password in Firebase Console → Authentication.';
  }
  if (code === 'auth/email-already-in-use') return 'Email already registered. Try signing in.';
  if (code === 'auth/weak-password') return 'Password must be at least 6 characters.';
  if (code === 'auth/invalid-credential') return 'Incorrect email or password.';
  return err instanceof Error ? err.message : 'Authentication failed.';
}

async function completeRegistration(payload: {
  account_type: AccountType;
  full_name: string;
  phone_number: string;
  barangay: string;
  organization_name?: string;
  invite_token?: string;
  public_worker_type?: string;
}) {
  return api<{ role: string; registration_completed?: boolean }>('/api/users/complete-registration', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

function homeForRole(role: string) {
  if (role === 'street_sweeper') return '/(tabs)/camera';
  return '/';
}

export default function LoginScreen() {
  const params = useLocalSearchParams<{ invite?: string }>();
  const inviteFromUrl = typeof params.invite === 'string' ? params.invite : '';
  const [mode, setMode] = useState<Mode>(inviteFromUrl ? 'register' : 'signin');
  const [accountType, setAccountType] = useState<AccountType | null>(inviteFromUrl ? 'street_sweeper' : null);
  const [inviteToken, setInviteToken] = useState(inviteFromUrl);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [barangay, setBarangay] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [publicWorkerType, setPublicWorkerType] = useState<PublicWorkerType | ''>('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (!inviteToken) return;
    api<{ valid: boolean; barangay?: string }>(`/api/registration-invites/validate?token=${encodeURIComponent(inviteToken)}`)
      .then((info) => {
        if (info.barangay) setBarangay(info.barangay);
      })
      .catch(() => undefined);
  }, [inviteToken]);

  async function afterAuth(token: string, isRegister: boolean) {
    await AsyncStorage.setItem('civx_token', token);
    const me = await api<{ registration_completed?: boolean; role: string }>('/api/users/me');
    if (!me.registration_completed && isRegister && accountType) {
      const profile = await completeRegistration({
        account_type: accountType,
        full_name: fullName,
        phone_number: phone,
        barangay,
        organization_name: accountType === 'organizer' ? organizationName : undefined,
        invite_token: accountType === 'street_sweeper' ? inviteToken : undefined,
        public_worker_type: accountType === 'street_sweeper' ? publicWorkerType || undefined : undefined,
      });
      router.replace(homeForRole(profile.role));
      return;
    }
    if (!me.registration_completed) {
      Alert.alert('Complete registration', 'Finish your profile on the web app.');
      return;
    }
    router.replace(homeForRole(me.role));
  }

  async function submit() {
    if (!isFirebaseConfigured) {
      Alert.alert('Firebase not configured', 'Set EXPO_PUBLIC_FIREBASE_* in infra/.env');
      return;
    }
    if (mode === 'register' && !accountType) {
      Alert.alert('Select account type', 'Choose how you will use CiVX.');
      return;
    }
    if (mode === 'register' && accountType === 'street_sweeper' && !inviteToken) {
      Alert.alert('Worker invite required', 'Scan the LGU QR code or open the invite link.');
      return;
    }
    if (mode === 'register' && accountType === 'street_sweeper' && !publicWorkerType) {
      Alert.alert('Worker type required', 'Select what type of public worker you are.');
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
      await afterAuth(token, mode === 'register');
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

      {mode === 'register' && !accountType && (
        <View style={styles.section}>
          {(['citizen', 'organizer'] as AccountType[]).map((type) => (
            <TouchableOpacity key={type} style={styles.choice} onPress={() => setAccountType(type)}>
              <Text style={styles.choiceTitle}>{ACCOUNT_LABELS[type]}</Text>
            </TouchableOpacity>
          ))}
          <TextInput
            style={styles.input}
            placeholder="Worker invite code (from LGU QR)"
            value={inviteToken}
            onChangeText={setInviteToken}
          />
          <TouchableOpacity
            style={styles.choice}
            onPress={() => inviteToken && setAccountType('street_sweeper')}
            disabled={!inviteToken}
          >
            <Text style={styles.choiceTitle}>{ACCOUNT_LABELS.street_sweeper}</Text>
          </TouchableOpacity>
        </View>
      )}

      {mode === 'register' && accountType && (
        <>
          <Text style={styles.subtitle}>{ACCOUNT_LABELS[accountType]}</Text>
          <TextInput style={styles.input} placeholder="Full name" value={fullName} onChangeText={setFullName} />
          <TextInput style={styles.input} placeholder="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <TextInput style={styles.input} placeholder="Barangay" value={barangay} onChangeText={setBarangay} />
          {accountType === 'organizer' && (
            <TextInput style={styles.input} placeholder="Organization name" value={organizationName} onChangeText={setOrganizationName} />
          )}
          {accountType === 'street_sweeper' && (
            <TextInput style={styles.input} placeholder="Invite code" value={inviteToken} onChangeText={setInviteToken} />
          )}
          {accountType === 'street_sweeper' && (
            <View style={styles.section}>
              <Text style={styles.fieldLabel}>Type of public worker</Text>
              {(Object.entries(PUBLIC_WORKER_TYPES) as [PublicWorkerType, string][]).map(([key, label]) => (
                <TouchableOpacity
                  key={key}
                  style={[styles.choice, publicWorkerType === key && styles.choiceActive]}
                  onPress={() => setPublicWorkerType(key)}
                >
                  <Text style={styles.choiceTitle}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
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
  subtitle: { fontSize: 14, color: '#0066cc', marginBottom: 12, fontWeight: '600' },
  tabs: { flexDirection: 'row', marginBottom: 16, borderRadius: 999, borderWidth: 1, borderColor: '#e0e0e0', padding: 4 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 999 },
  tabActive: { backgroundColor: '#fff' },
  tabText: { color: '#7a7a7a' },
  tabTextActive: { color: '#1d1d1f', fontWeight: '600' },
  section: { marginBottom: 12 },
  choice: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 16, padding: 14, marginBottom: 8 },
  choiceActive: { borderColor: '#0066cc', backgroundColor: '#f0f7ff' },
  choiceTitle: { fontWeight: '600' },
  fieldLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: '#1d1d1f' },
  input: { borderWidth: 1, borderColor: '#e0e0e0', borderRadius: 999, padding: 16, marginBottom: 12 },
  btn: { backgroundColor: '#0066cc', borderRadius: 999, padding: 16, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#fff', fontSize: 17 },
});
