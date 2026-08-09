import { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import AdminLogin from '../components/AdminLogin';
import AdminPanel from '../components/AdminPanel';
import { auth } from '../firebaseConfig';
import { isAuthorizedAdminUser } from '../utils/adminAuth';

const Admin = ({ fishData, refreshFishData }) => {
  const [authReady, setAuthReady] = useState(false);
  const [adminUser, setAdminUser] = useState(null);
  const [authError, setAuthError] = useState('');

  // Clear legacy localStorage admin flags (never used as auth truth)
  useEffect(() => {
    try {
      localStorage.removeItem('isAdmin');
      localStorage.removeItem('adminMode');
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAdminUser(null);
        setAuthReady(true);
        // Keep authError if we just denied/signed out an unauthorized account
        return;
      }

      if (!isAuthorizedAdminUser(user)) {
        setAdminUser(null);
        setAuthReady(true);
        setAuthError(
          'This account is not authorized for admin access. Please use a management email.',
        );
        try {
          await signOut(auth);
        } catch {
          /* ignore */
        }
        return;
      }

      setAuthError('');
      setAdminUser(user);
      setAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    setAuthError('');
    try {
      localStorage.removeItem('isAdmin');
      localStorage.removeItem('adminMode');
    } catch {
      /* ignore */
    }
    await signOut(auth);
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
          <p className="text-gray-600 text-sm">Checking admin session…</p>
        </div>
      </div>
    );
  }

  if (!adminUser) {
    return <AdminLogin authError={authError} onClearAuthError={() => setAuthError('')} />;
  }

  return (
    <AdminPanel
      fishData={fishData}
      refreshFishData={refreshFishData}
      onLogout={handleLogout}
    />
  );
};

export default Admin;
