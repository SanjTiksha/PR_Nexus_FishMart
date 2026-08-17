import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import EnhancedLoadingSpinner from '../components/EnhancedLoadingSpinner';
import { isCustomerUser } from '../services/customerSession';
import {
  initializeCustomerLoginOtp,
  isCustomerLoginCaptchaVerified,
  MSG91_LOGIN_CAPTCHA_RENDER_ID,
  onCustomerLoginCaptchaChange,
} from '../services/msg91LoginOtp';
import {
  exchangeVerifiedTokenForSession,
  requestCustomerOtp,
  resendCustomerOtp,
  verifyCustomerOtp,
} from '../services/customerAuth';
import {
  isValidIndianMobile,
  maskMobile,
  normalizeIndianMobile,
} from '../services/msg91Otp';

const RESEND_SECONDS = 10;
const GENERIC_VERIFY_ERROR = 'Unable to verify. Please try again.';
const GENERIC_SESSION_ERROR = 'Unable to complete login. Please try again.';

const Login = () => {
  const navigate = useNavigate();
  const [mobileNumber, setMobileNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [showOtpPanel, setShowOtpPanel] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [loginSuccessful, setLoginSuccessful] = useState(false);
  const [otpMessage, setOtpMessage] = useState('');
  const [otpError, setOtpError] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [captchaReady, setCaptchaReady] = useState(false);
  const [captchaSolved, setCaptchaSolved] = useState(false);
  const [captchaInitError, setCaptchaInitError] = useState('');
  const [authReady, setAuthReady] = useState(false);
  const [existingUser, setExistingUser] = useState(null);

  const otpInputRef = useRef(null);
  const mobileInputRef = useRef(null);
  const reqIdRef = useRef('');
  const verifiedTokenRef = useRef('');
  const customTokenRef = useRef('');
  const busyRef = useRef(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setExistingUser(user);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady) return undefined;
    if (isCustomerUser(existingUser)) {
      navigate('/account', { replace: true });
    }
    return undefined;
  }, [authReady, existingUser, navigate]);

  useEffect(() => {
    if (!authReady || isCustomerUser(existingUser)) return undefined;

    let cancelled = false;
    const unsub = onCustomerLoginCaptchaChange((ok) => {
      if (!cancelled) setCaptchaSolved(!!ok);
    });

    const timer = window.setTimeout(async () => {
      try {
        await initializeCustomerLoginOtp();
        if (cancelled) return;
        setCaptchaReady(true);
        setCaptchaInitError('');
        setCaptchaSolved(isCustomerLoginCaptchaVerified());
      } catch (err) {
        if (cancelled) return;
        setCaptchaReady(false);
        setCaptchaInitError(
          err?.message || 'Captcha failed to load. Please refresh and try again.',
        );
      }
    }, 80);

    const poll = window.setInterval(() => {
      if (!cancelled) setCaptchaSolved(isCustomerLoginCaptchaVerified());
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearInterval(poll);
      unsub();
    };
  }, [authReady, existingUser]);

  useEffect(() => {
    return () => {
      verifiedTokenRef.current = '';
      customTokenRef.current = '';
    };
  }, []);

  useEffect(() => {
    if (resendSeconds <= 0) return undefined;
    const timer = setInterval(() => {
      setResendSeconds((s) => (s <= 1 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendSeconds]);

  useEffect(() => {
    if (showOtpPanel && otpInputRef.current) {
      otpInputRef.current.focus();
    }
  }, [showOtpPanel]);

  const resetLoginFlow = () => {
    setShowOtpPanel(false);
    setOtpVerified(false);
    setOtp('');
    setOtpMessage('');
    setOtpError('');
    setResendSeconds(0);
    reqIdRef.current = '';
    verifiedTokenRef.current = '';
    customTokenRef.current = '';
    setLoginSuccessful(false);
  };

  const handleMobileChange = (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
    setMobileNumber(digits);
    if (showOtpPanel || otpVerified) {
      resetLoginFlow();
    }
  };

  const handleSendOtp = async () => {
    if (busyRef.current || sendingOtp) return;

    setOtpError('');
    setOtpMessage('');

    const mobile = normalizeIndianMobile(mobileNumber);
    if (!mobile) {
      setOtpError('Please enter your 10-digit mobile number.');
      return;
    }
    if (!isValidIndianMobile(mobile)) {
      setOtpError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    busyRef.current = true;
    setSendingOtp(true);

    try {
      await initializeCustomerLoginOtp();
      if (!isCustomerLoginCaptchaVerified()) {
        setOtpError('Please complete the captcha below, then click Send OTP.');
        setCaptchaSolved(false);
        return;
      }

      const result = await requestCustomerOtp(mobile);
      if (result.reqId) reqIdRef.current = String(result.reqId);

      setMobileNumber(mobile);
      setShowOtpPanel(true);
      setOtp('');
      setOtpVerified(false);
      setLoginSuccessful(false);
      verifiedTokenRef.current = '';
      customTokenRef.current = '';
      setOtpMessage('OTP sent successfully.');
      setResendSeconds(RESEND_SECONDS);
    } catch (err) {
      setCaptchaSolved(isCustomerLoginCaptchaVerified());
      setOtpError(err?.message || 'Could not send OTP. Please try again.');
      setShowOtpPanel(false);
    } finally {
      setSendingOtp(false);
      busyRef.current = false;
    }
  };

  const handleVerifyOtp = async () => {
    if (busyRef.current || verifyingOtp) return;

    setOtpError('');
    setOtpMessage('');

    if (!/^\d{4}$/.test(otp)) {
      setOtpError('Please enter the 4-digit OTP.');
      return;
    }

    busyRef.current = true;
    setVerifyingOtp(true);

    try {
      let token = '';
      try {
        const verified = await verifyCustomerOtp(otp, reqIdRef.current || undefined);
        token = verified?.token || '';
      } catch {
        verifiedTokenRef.current = '';
        customTokenRef.current = '';
        setOtpVerified(false);
        setLoginSuccessful(false);
        setOtpError(GENERIC_VERIFY_ERROR);
        return;
      }

      if (typeof token !== 'string' || !token.trim()) {
        verifiedTokenRef.current = '';
        customTokenRef.current = '';
        setOtpVerified(false);
        setLoginSuccessful(false);
        setOtpError(GENERIC_VERIFY_ERROR);
        return;
      }

      verifiedTokenRef.current = token;

      let customToken = '';
      try {
        const exchanged = await exchangeVerifiedTokenForSession(token);
        customToken = exchanged.customToken;
      } finally {
        verifiedTokenRef.current = '';
      }

      if (typeof customToken !== 'string' || !customToken.trim()) {
        customTokenRef.current = '';
        setOtpVerified(false);
        setLoginSuccessful(false);
        setOtpError(GENERIC_SESSION_ERROR);
        return;
      }

      customTokenRef.current = customToken;
      try {
        await signInWithCustomToken(auth, customToken);
      } finally {
        customTokenRef.current = '';
        customToken = '';
      }

      setOtpVerified(true);
      setLoginSuccessful(true);
      setShowOtpPanel(false);
      setOtp('');
      setOtpError('');
      setResendSeconds(0);
      navigate('/account', { replace: true });
    } catch {
      verifiedTokenRef.current = '';
      customTokenRef.current = '';
      setOtpVerified(false);
      setLoginSuccessful(false);
      setOtpError(GENERIC_SESSION_ERROR);
    } finally {
      setVerifyingOtp(false);
      busyRef.current = false;
    }
  };

  const handleResendOtp = async () => {
    if (busyRef.current || resendingOtp || resendSeconds > 0) return;

    setOtpError('');
    setOtpMessage('');
    busyRef.current = true;
    setResendingOtp(true);

    try {
      const result = await resendCustomerOtp(reqIdRef.current || undefined);
      if (result.reqId) reqIdRef.current = String(result.reqId);
      setOtp('');
      setOtpMessage('OTP resent successfully.');
      setResendSeconds(RESEND_SECONDS);
      otpInputRef.current?.focus();
    } catch (err) {
      setOtpError(err?.message || 'Could not resend OTP. Please try again.');
    } finally {
      setResendingOtp(false);
      busyRef.current = false;
    }
  };

  const handleChangeMobile = () => {
    resetLoginFlow();
    setTimeout(() => mobileInputRef.current?.focus(), 50);
  };

  const mobileValid = isValidIndianMobile(normalizeIndianMobile(mobileNumber));

  if (!authReady || isCustomerUser(existingUser)) {
    return <EnhancedLoadingSpinner message="Loading your account..." size="large" />;
  }

  return (
    <div className="min-h-screen bg-cyan-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">🐟</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Login to FishMart</h1>
          <p className="mt-2 text-gray-600">
            Verify your Indian mobile number to continue
          </p>
        </div>

        <div className="card p-8 space-y-5">
          {loginSuccessful && (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-800 space-y-3">
              <p className="font-semibold">Login successful</p>
            </div>
          )}

          {otpVerified && !loginSuccessful && (
            <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-800 space-y-3">
              <p className="font-semibold">
                OTP verified successfully. Session setup will be completed in the next step.
              </p>
              <p className="text-green-700">
                Verified mobile: {maskMobile(mobileNumber)}
              </p>
              <button
                type="button"
                onClick={handleChangeMobile}
                className="font-semibold text-blue-700 underline"
              >
                Change mobile number
              </button>
            </div>
          )}

          {!otpVerified && (
            <div>
              <label htmlFor="login-mobile" className="block text-sm font-medium text-gray-700 mb-2">
                Mobile number
              </label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-gray-300 bg-gray-50 text-gray-600 text-sm font-semibold">
                  +91
                </span>
                <input
                  ref={mobileInputRef}
                  id="login-mobile"
                  name="mobileNumber"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  maxLength={10}
                  value={mobileNumber}
                  onChange={handleMobileChange}
                  disabled={showOtpPanel}
                  className="w-full px-4 py-3 border border-gray-300 rounded-r-xl focus:ring-2 focus:ring-blue-600 focus:border-transparent disabled:bg-gray-100"
                  placeholder="10-digit mobile number"
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Enter your 10-digit Indian mobile number. Country code +91 is added automatically.
              </p>
            </div>
          )}

          <div className={otpVerified ? 'hidden' : 'rounded-xl border border-amber-200 bg-amber-50/60 p-3 space-y-2'}>
            <p className="text-sm font-semibold text-gray-800">Security check</p>
            <p className="text-xs text-gray-600">
              Complete the captcha, then tap Send OTP.
            </p>
            <div
              id={MSG91_LOGIN_CAPTCHA_RENDER_ID}
              className="min-h-[78px] flex justify-center items-center overflow-x-auto"
            />
            {captchaInitError && (
              <p className="text-xs text-red-600">{captchaInitError}</p>
            )}
            {!captchaInitError && captchaReady && (
              <p
                className={`text-xs font-medium ${
                  captchaSolved ? 'text-green-700' : 'text-amber-800'
                }`}
              >
                {captchaSolved
                  ? 'Captcha completed ✓ — you can send OTP now.'
                  : 'Waiting for captcha…'}
              </p>
            )}
          </div>

          {!otpVerified && !showOtpPanel && (
            <button
              type="button"
              onClick={handleSendOtp}
              disabled={
                sendingOtp || !mobileValid || !captchaReady || !captchaSolved
              }
              className="w-full btn-primary text-lg py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sendingOtp ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                  Sending…
                </div>
              ) : (
                'Send OTP'
              )}
            </button>
          )}

          {!otpVerified && showOtpPanel && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-3">
              <div>
                <h2 className="text-base font-bold text-gray-900">Verify mobile number</h2>
                <p className="text-sm text-gray-600">
                  Enter the 4-digit OTP sent to {maskMobile(mobileNumber)}
                </p>
              </div>

              <input
                ref={otpInputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                maxLength={4}
                value={otp}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
                  setOtp(digits);
                  setOtpError('');
                }}
                className="w-full px-3 py-3 border border-gray-300 rounded-lg text-center text-2xl tracking-[0.4em] font-semibold focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••"
                aria-label="4-digit OTP"
              />

              {otpMessage && (
                <p className="text-sm text-green-700">{otpMessage}</p>
              )}

              <button
                type="button"
                onClick={handleVerifyOtp}
                disabled={verifyingOtp || otp.length !== 4}
                className="w-full min-h-[48px] rounded-xl bg-green-600 text-white font-semibold active:bg-green-800 disabled:bg-gray-300 disabled:text-gray-500"
              >
                {verifyingOtp ? 'Verifying…' : 'Verify OTP'}
              </button>

              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={resendSeconds > 0 || resendingOtp}
                  className="font-semibold text-blue-700 disabled:text-gray-400"
                >
                  {resendingOtp
                    ? 'Resending…'
                    : resendSeconds > 0
                      ? `Resend OTP in ${resendSeconds}s`
                      : 'Resend OTP'}
                </button>
                <button
                  type="button"
                  onClick={handleChangeMobile}
                  className="font-semibold text-gray-700 underline"
                >
                  Change mobile number
                </button>
              </div>
            </div>
          )}

          {otpError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl text-sm">
              {otpError}
            </div>
          )}

          <p className="text-center text-sm text-gray-500">
            <Link to="/" className="text-blue-700 font-semibold hover:underline">
              Return to FishMart
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
