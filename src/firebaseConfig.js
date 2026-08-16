import { initializeApp } from 'firebase/app';
import { initializeFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyDZMLYNgESnfNQk8fzBj2vfvEtD8irJfr0',
  authDomain: 'ajayseafoods-b6e6b.firebaseapp.com',
  projectId: 'ajayseafoods-b6e6b',
  storageBucket: 'ajayseafoods-b6e6b.appspot.com',
  messagingSenderId: '600898251069',
  appId: '1:600898251069:web:153633d7e1143059c8fd54',
};

const app = initializeApp(firebaseConfig);

// iPhone, iPad, iPod, and iPadOS (Macintosh UA + touch). iOS Chrome is WebKit.
const isIOSWebKit = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  if (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) return true;
  return false;
};

// useFetchStreams is an internal Firestore setting. On iOS/WebKit, disable fetch
// streams so WebChannel uses XHR and avoids the ~30s completion hang.
const firestoreSettings = isIOSWebKit() ? { useFetchStreams: false } : {};
const db = initializeFirestore(app, firestoreSettings);
const auth = getAuth(app);

export { db, auth };
