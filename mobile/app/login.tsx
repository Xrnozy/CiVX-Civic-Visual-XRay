import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator, Platform } from 'react-native';
import { createUserWithEmailAndPassword, GoogleAuthProvider, signInWithCredential, signInWithEmailAndPassword, signInWithPopup, updateProfile } from 'firebase/auth';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirebaseAuth, isFirebaseConfigured } from '../lib/firebase';
import { api } from '../lib/api';
import { router, useLocalSearchParams } from 'expo-router';
import { colors, productShadow, radii, type } from '../styles/theme';

WebBrowser.maybeCompleteAuthSession();

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

const GOOGLE_CLIENT_IDS = {
  expoClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
};

function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code;
  if (code === 'auth/operation-not-allowed') {
    return 'Enable Email/Password in Firebase Console > Authentication.';
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
  const [loading, setLoading] = useState(false);
  const [googleRequest, googleResponse, promptGoogleAsync] = Google.useAuthRequest(GOOGLE_CLIENT_IDS);
  const hasGoogleButton =
    Platform.OS === 'web'
    || Boolean(
      GOOGLE_CLIENT_IDS.expoClientId
      || GOOGLE_CLIENT_IDS.webClientId
      || (Platform.OS === 'android' ? GOOGLE_CLIENT_IDS.androidClientId : GOOGLE_CLIENT_IDS.iosClientId),
    );

  useEffect(() => {
    if (!inviteToken) return;
    api<{ valid: boolean; barangay?: string }>(`/api/registration-invites/validate?token=${encodeURIComponent(inviteToken)}`)
      .then((info) => {
        if (info.barangay) setBarangay(info.barangay);
      })
      .catch(() => undefined);
  }, [inviteToken]);

  useEffect(() => {
    if (googleResponse?.type !== 'success') return;
    const idToken = googleResponse.params.id_token;
    if (!idToken) {
      Alert.alert('Google sign-in failed', 'Google did not return an ID token. Check the configured OAuth client IDs.');
      setLoading(false);
      return;
    }

    const finishGoogleSignIn = async () => {
      try {
        const credential = GoogleAuthProvider.credential(idToken);
        const cred = await signInWithCredential(getFirebaseAuth(), credential);
        const token = await cred.user.getIdToken(true);
        await afterAuth(token, mode === 'register');
      } catch (err) {
        Alert.alert('Google sign-in failed', authErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };

    void finishGoogleSignIn();
  }, [googleResponse]);

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
      setLoading(true);
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
    } finally {
      setLoading(false);
    }
  }

  async function submitGoogle() {
    if (!isFirebaseConfigured) {
      Alert.alert('Firebase not configured', 'Set EXPO_PUBLIC_FIREBASE_* in infra/.env');
      return;
    }
    if (mode === 'register' && !accountType) {
      Alert.alert('Select account type', 'Choose how you will use CiVX before continuing with Google.');
      return;
    }
    if (Platform.OS !== 'web') {
      if (!googleRequest) return;
      setLoading(true);
      const result = await promptGoogleAsync();
      if (result.type !== 'success') setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const cred = await signInWithPopup(getFirebaseAuth(), provider);
      const token = await cred.user.getIdToken(true);
      await afterAuth(token, mode === 'register');
    } catch (err) {
      Alert.alert('Google sign-in failed', authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
      <Text style={styles.eyebrow}>Account</Text>
      <Text style={styles.title}>{mode === 'signin' ? 'Sign in' : 'Join CiVX'}</Text>
      <Text style={styles.subtitleText}>Access the community map, report issues, and volunteer tools.</Text>

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, mode === 'signin' && styles.tabActive]} onPress={() => setMode('signin')}>
          <Text style={mode === 'signin' ? styles.tabTextActive : styles.tabText}>Sign in</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, mode === 'register' && styles.tabActive]} onPress={() => setMode('register')}>
          <Text style={mode === 'register' ? styles.tabTextActive : styles.tabText}>Register</Text>
        </TouchableOpacity>
      </View>

      {hasGoogleButton && (
        <>
          <TouchableOpacity
            style={styles.googleButton}
            onPress={submitGoogle}
            disabled={loading || (Platform.OS !== 'web' && !googleRequest)}
          >
            <Text style={styles.googleMark}>G</Text>
            <Text style={styles.googleText}>Continue with Google</Text>
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or use email</Text>
            <View style={styles.divider} />
          </View>
        </>
      )}

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
      <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={submit} disabled={loading}>
        {loading ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.btnText}>{mode === 'signin' ? 'Sign In' : 'Create Account'}</Text>}
      </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, padding: 20, justifyContent: 'center', backgroundColor: colors.parchment },
  card: { backgroundColor: colors.canvas, borderRadius: radii.card, borderWidth: 1, borderColor: colors.hairline, padding: 24, ...productShadow },
  eyebrow: { ...type.eyebrow, color: colors.primary },
  title: { fontSize: 40, fontWeight: '600', color: colors.ink, marginTop: 4 },
  subtitleText: { fontSize: 14, color: colors.muted, marginTop: 6, lineHeight: 20, marginBottom: 22 },
  subtitle: { fontSize: 14, color: colors.primary, marginBottom: 12, fontWeight: '600' },
  tabs: { flexDirection: 'row', marginBottom: 16, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.hairline, padding: 4, backgroundColor: colors.parchment },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 999 },
  tabActive: { backgroundColor: colors.canvas },
  tabText: { color: colors.muted },
  tabTextActive: { color: colors.ink, fontWeight: '600' },
  googleButton: { minHeight: 48, borderRadius: radii.pill, borderWidth: 1, borderColor: colors.hairline, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, backgroundColor: colors.canvas },
  googleMark: { width: 24, height: 24, borderRadius: 12, textAlign: 'center', lineHeight: 24, color: colors.primary, fontWeight: '700', backgroundColor: colors.parchment },
  googleText: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 20 },
  divider: { height: 1, backgroundColor: colors.hairline, flex: 1 },
  dividerText: { color: colors.muted, fontSize: 12 },
  section: { marginBottom: 12 },
  choice: { borderWidth: 1, borderColor: colors.hairline, borderRadius: radii.card, padding: 16, marginBottom: 10, backgroundColor: colors.canvas },
  choiceActive: { borderColor: colors.primary, backgroundColor: '#f0f7ff' },
  choiceTitle: { fontWeight: '600', color: colors.ink },
  fieldLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: colors.ink },
  input: { borderWidth: 1, borderColor: colors.hairline, borderRadius: radii.pill, padding: 16, marginBottom: 12, backgroundColor: colors.canvas, color: colors.ink },
  btn: { backgroundColor: colors.primary, borderRadius: radii.pill, padding: 16, alignItems: 'center', marginTop: 8, minHeight: 52 },
  btnDisabled: { opacity: 0.72 },
  btnText: { color: '#fff', fontSize: 17 },
});
