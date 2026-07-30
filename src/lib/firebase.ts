import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

const ProviderCtor = typeof GoogleAuthProvider === 'function' ? GoogleAuthProvider : (GoogleAuthProvider as any)?.default;
export const googleProvider = ProviderCtor ? new ProviderCtor() : null;
if (googleProvider && typeof googleProvider.addScope === 'function') {
  googleProvider.addScope('https://www.googleapis.com/auth/spreadsheets.readonly');
}
