import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
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
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
