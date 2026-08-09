import { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { isAuthorizedAdminUser, normalizeAdminEmail } from '../utils/adminAuth';

const friendlyAuthError = (error) => {
  const code = error?.code || '';
  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found' ||
    code === 'auth/invalid-email'
  ) {
    return 'Invalid email or password. Please try again.';
  }
  if (code === 'auth/too-many-requests') {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  if (code === 'auth/network-request-failed') {
    return 'Network error. Check your connection and try again.';
  }
  return 'Unable to sign in. Please try again.';
};

const AdminLogin = ({ authError = '', onClearAuthError }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    onClearAuthError?.();

    const normalizedEmail = normalizeAdminEmail(email);
    if (!normalizedEmail || !password) {
      setError('Enter your management email and password.');
      setIsLoading(false);
      return;
    }

    // Reject non-allowlisted emails before calling Firebase when possible
    if (
      !isAuthorizedAdminUser({ email: normalizedEmail })
    ) {
      setError('This account is not authorized for admin access.');
      setPassword('');
      setIsLoading(false);
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, normalizedEmail, password);
      // Admin.jsx onAuthStateChanged will open AdminPanel for allowlisted users
    } catch (err) {
      console.error('Admin Firebase login failed:', err);
      setError(friendlyAuthError(err));
      setPassword('');
    } finally {
      setIsLoading(false);
    }
  };

  const displayError = error || authError;

  return (
    <div className="min-h-screen bg-cyan-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🔐</span>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Admin Login</h2>
          <p className="mt-2 text-gray-600">
            Sign in with your management email to access the admin panel
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="card p-8">
            <div className="space-y-4">
              <div>
                <label htmlFor="admin-email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  id="admin-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  placeholder="management@prnexusgroup.com"
                />
              </div>

              <div>
                <label htmlFor="admin-password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  id="admin-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent"
                  placeholder="Enter password"
                />
              </div>

              {displayError && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl text-sm">
                  {displayError}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full btn-primary text-lg py-3 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                    Signing in...
                  </div>
                ) : (
                  'Sign In'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AdminLogin;
