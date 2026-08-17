import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import AdminLogin from '../components/AdminLogin';
import AdminPanel from '../components/AdminPanel';
import { auth } from '../firebaseConfig';
import { isAuthorizedAdminUser } from '../utils/adminAuth';

const Admin = ({ fishData, refreshFishData }) => {
  const [authReady, setAuthReady] = useState(false);
  const [adminUser, setAdminUser] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);

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
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setAdminUser(null);
        setAccessDenied(false);
        setAuthReady(true);
        return;
      }

      if (!isAuthorizedAdminUser(user)) {
        setAdminUser(null);
        setAccessDenied(true);
        setAuthReady(true);
        return;
      }

      setAccessDenied(false);
      setAdminUser(user);
      setAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
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

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-cyan-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">🔐</span>
            </div>
            <h2 className="text-3xl font-bold text-gray-900">Access denied</h2>
            <p className="mt-2 text-gray-600">
              This account is not authorized for admin access. Please use a management email.
            </p>
          </div>
          <div className="card p-8 text-center">
            <Link to="/" className="inline-flex w-full btn-primary text-lg py-3 justify-center">
              Return to FishMart
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!adminUser) {
    return <AdminLogin />;
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
