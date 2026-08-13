import { useState, useEffect, useRef } from 'react';
import {
  X,
  ShoppingBag,
  CreditCard,
  ArrowRight,
  MapPin,
  Phone,
  User,
  ShieldCheck,
} from 'lucide-react';
import { getFishImageUrl, handleImageError } from '../utils/imageUtils';
import { normalizeQuantity, calculateLineTotal } from '../utils/quantityUtils';
import DeliveryLocationPicker from './DeliveryLocationPicker';
import {
  ensureMsg91OtpReady,
  isMsg91CaptchaVerified,
  isValidIndianMobile,
  maskMobile,
  MSG91_CAPTCHA_RENDER_ID,
  normalizeIndianMobile,
  onMsg91CaptchaChange,
  retryMsg91Otp,
  sendMsg91Otp,
  toMsg91Identifier,
  verifyMsg91Otp,
} from '../services/msg91Otp';
import {
  groupAvailableOptionsByDay,
  isTodayDeliveryClosed,
  normalizeDeliveryPreference,
  normalizeSlot,
  slotDisplayLabel,
  slotEmoji,
  validateDeliverySelection,
} from '../utils/deliverySlot';

const RESEND_SECONDS = 10;

const CheckoutConfirmation = ({
  isOpen,
  onClose,
  cart,
  totalPrice,
  orderSummary = null,
  onProceedToPayment,
  deliveryPreference = null,
  onDeliveryPreferenceChange,
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [showDeliveryForm, setShowDeliveryForm] = useState(false);
  const [deliverySlotError, setDeliverySlotError] = useState('');
  const [availabilityTick, setAvailabilityTick] = useState(0);
  const pref = normalizeDeliveryPreference(deliveryPreference);
  // Recompute when the 30s availability tick advances
  const dayGroups = groupAvailableOptionsByDay(availabilityTick ? new Date() : new Date());
  const todayClosed = isTodayDeliveryClosed();
  const [deliveryInfo, setDeliveryInfo] = useState({
    customerName: '',
    mobileNumber: '',
    address: '',
    location: null,
  });

  const [mobileVerified, setMobileVerified] = useState(false);
  const [verifiedMobile, setVerifiedMobile] = useState('');
  const [showOtpPanel, setShowOtpPanel] = useState(false);
  const [otp, setOtp] = useState('');
  const [otpMessage, setOtpMessage] = useState('');
  const [otpError, setOtpError] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [resendingOtp, setResendingOtp] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [captchaReady, setCaptchaReady] = useState(false);
  const [captchaSolved, setCaptchaSolved] = useState(false);
  const [captchaInitError, setCaptchaInitError] = useState('');

  const otpInputRef = useRef(null);
  const mobileInputRef = useRef(null);
  const reqIdRef = useRef('');
  const busyRef = useRef(false);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => setIsAnimating(true), 10);
    } else {
      setIsAnimating(false);
      // Fresh session on close — never assume verified after refresh/reopen
      setShowDeliveryForm(false);
      setMobileVerified(false);
      setVerifiedMobile('');
      setShowOtpPanel(false);
      setOtp('');
      setOtpMessage('');
      setOtpError('');
      setResendSeconds(0);
      setCaptchaReady(false);
      setCaptchaSolved(false);
      setCaptchaInitError('');
      setDeliverySlotError('');
      reqIdRef.current = '';
      busyRef.current = false;
      setDeliveryInfo({
        customerName: '',
        mobileNumber: '',
        address: '',
        location: null,
      });
    }
  }, [isOpen]);

  // Re-check cutoffs while checkout is open (do not silently switch slots)
  useEffect(() => {
    if (!isOpen) return undefined;
    const id = window.setInterval(() => setAvailabilityTick((n) => n + 1), 30000);
    return () => window.clearInterval(id);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const rawSlot = normalizeSlot(deliveryPreference?.deliverySlot);
    if (!rawSlot) return;
    const stillOk = validateDeliverySelection(
      deliveryPreference?.deliveryDate,
      deliveryPreference?.deliverySlot,
    );
    if (!stillOk.ok) {
      setDeliverySlotError(stillOk.reason);
    }
    // availabilityTick forces re-eval against wall clock
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, deliveryPreference, availabilityTick]);

  // Init MSG91 only when delivery form (and visible captcha mount) is shown.
  // H-Captcha often fails if the mount node is display:none during init.
  useEffect(() => {
    if (!isOpen || !showDeliveryForm) return undefined;

    let cancelled = false;
    const unsub = onMsg91CaptchaChange((ok) => {
      if (!cancelled) setCaptchaSolved(!!ok);
    });

    const timer = window.setTimeout(async () => {
      try {
        await ensureMsg91OtpReady();
        if (cancelled) return;
        setCaptchaReady(true);
        setCaptchaInitError('');
        setCaptchaSolved(isMsg91CaptchaVerified());
      } catch (err) {
        if (cancelled) return;
        setCaptchaReady(false);
        setCaptchaInitError(
          err?.message || 'Captcha failed to load. Please refresh and try again.',
        );
      }
    }, 80);

    // Poll often — MSG91 may not flip isCaptchaVerified even when H-Captcha UI shows ✓
    const poll = window.setInterval(() => {
      if (!cancelled) setCaptchaSolved(isMsg91CaptchaVerified());
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      clearInterval(poll);
      unsub();
    };
  }, [isOpen, showDeliveryForm]);

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

  const resetMobileVerification = () => {
    setMobileVerified(false);
    setVerifiedMobile('');
    setShowOtpPanel(false);
    setOtp('');
    setOtpMessage('');
    setOtpError('');
    setResendSeconds(0);
    reqIdRef.current = '';
  };

  const handleProceed = () => {
    setDeliverySlotError('');
    const locked = validateDeliverySelection(
      deliveryPreference?.deliveryDate,
      deliveryPreference?.deliverySlot,
    );
    if (!locked.ok) {
      setDeliverySlotError(locked.reason);
      return;
    }
    setShowDeliveryForm(true);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    if (name === 'mobileNumber') {
      const digits = value.replace(/\D/g, '').slice(0, 10);
      setDeliveryInfo((prev) => ({ ...prev, mobileNumber: digits }));
      if (mobileVerified || showOtpPanel) {
        resetMobileVerification();
      }
      return;
    }

    setDeliveryInfo((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSendOtp = async () => {
    if (busyRef.current || sendingOtp) return;

    const mobile = normalizeIndianMobile(deliveryInfo.mobileNumber);
    setOtpError('');
    setOtpMessage('');

    if (!mobile) {
      setOtpError('Please enter your mobile number.');
      return;
    }
    if (!isValidIndianMobile(mobile)) {
      setOtpError('Please enter a valid 10-digit Indian mobile number.');
      return;
    }

    busyRef.current = true;
    setSendingOtp(true);

    try {
      await ensureMsg91OtpReady();
      if (!isMsg91CaptchaVerified()) {
        setOtpError('Please complete the captcha below, then click Verify Mobile.');
        setCaptchaSolved(false);
        return;
      }
      const identifier = toMsg91Identifier(mobile);
      const result = await sendMsg91Otp(identifier);
      if (result.reqId) reqIdRef.current = String(result.reqId);

      setDeliveryInfo((prev) => ({ ...prev, mobileNumber: mobile }));
      setShowOtpPanel(true);
      setOtp('');
      setOtpMessage('OTP sent successfully.');
      setResendSeconds(RESEND_SECONDS);
    } catch (err) {
      setCaptchaSolved(isMsg91CaptchaVerified());
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
      await ensureMsg91OtpReady();
      await verifyMsg91Otp(otp, reqIdRef.current || undefined);

      const mobile = normalizeIndianMobile(deliveryInfo.mobileNumber);
      setMobileVerified(true);
      setVerifiedMobile(mobile);
      setShowOtpPanel(false);
      setOtp('');
      setOtpMessage('');
      setOtpError('');
      setResendSeconds(0);
    } catch {
      setMobileVerified(false);
      setVerifiedMobile('');
      setOtpError('Invalid or expired OTP. Please try again.');
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
      await ensureMsg91OtpReady();
      const result = await retryMsg91Otp(reqIdRef.current || undefined);
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
    resetMobileVerification();
    setTimeout(() => mobileInputRef.current?.focus(), 50);
  };

  const handleDeliverySubmit = (e) => {
    e.preventDefault();
    setDeliverySlotError('');

    const locked = validateDeliverySelection(
      deliveryPreference?.deliveryDate,
      deliveryPreference?.deliverySlot,
    );
    if (!locked.ok) {
      setDeliverySlotError(locked.reason);
      return;
    }

    if (!deliveryInfo.customerName || !deliveryInfo.mobileNumber || !deliveryInfo.address) {
      alert('Please fill in all required fields');
      return;
    }

    const mobile = normalizeIndianMobile(deliveryInfo.mobileNumber);
    if (!isValidIndianMobile(mobile)) {
      alert('Please enter a valid 10-digit mobile number');
      return;
    }

    if (!deliveryInfo.location?.confirmed || !deliveryInfo.location?.lat || !deliveryInfo.location?.lng) {
      alert('Please set and confirm your delivery location on the map.');
      return;
    }

    // Critical: payment must not start without MSG91 OTP success
    if (!mobileVerified || verifiedMobile !== mobile) {
      alert('Please verify your mobile number before proceeding to payment.');
      return;
    }

    if (onProceedToPayment) {
      onProceedToPayment({
        ...deliveryInfo,
        mobileNumber: mobile,
        mobileVerified: true,
        mobileVerifiedAt: new Date().toISOString(),
        deliveryDate: locked.deliveryDate,
        deliverySlot: locked.deliverySlot,
      });
    }
  };

  if (!isOpen) return null;

  const currentMobile = normalizeIndianMobile(deliveryInfo.mobileNumber);
  const isCurrentMobileVerified =
    mobileVerified && verifiedMobile && verifiedMobile === currentMobile;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ zIndex: 9999 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        className={`bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[94vh] overflow-y-auto transform transition-all duration-300 pb-safe ${
          isAnimating
            ? 'translate-y-0 sm:scale-100 opacity-100'
            : 'translate-y-8 sm:translate-y-0 sm:scale-95 opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <ShoppingBag className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Checkout</h2>
              <p className="text-sm text-gray-600">Review your order</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            type="button"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-h-[78vh] overflow-y-auto">
          {!showDeliveryForm ? (
            <>
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900">Order Summary</h3>
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div key={item.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <img
                          src={getFishImageUrl(item.image)}
                          alt={item.name}
                          className="w-12 h-12 object-cover rounded-lg"
                          onError={handleImageError}
                        />
                        <div>
                          <p className="font-medium text-gray-900">{item.name}</p>
                          <p className="text-sm text-gray-600">
                            Qty: {normalizeQuantity(item.quantity).toFixed(1)} kg
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-blue-600">
                          ₹{calculateLineTotal(item.price || item.rate, item.quantity).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t pt-4 space-y-2">
                {orderSummary && (
                  <>
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Order Subtotal</span>
                      <span>₹{Number(orderSummary.subtotal || 0).toFixed(2)}</span>
                    </div>
                    {Number(orderSummary.discount || 0) > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Offer Discount</span>
                        <span>-₹{Number(orderSummary.discount).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm text-gray-600">
                      <span>Delivery Charges</span>
                      <span>₹{Number(orderSummary.deliveryCharge || 0).toFixed(2)}</span>
                    </div>
                    <div className="rounded-xl border border-cyan-100 bg-sky-50/80 px-3 py-2.5 space-y-2">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="font-semibold text-slate-700">🚚 Delivery</span>
                        <span className="text-[#087EA4] font-bold text-xs sm:text-sm">
                          Choose time
                        </span>
                      </div>
                      {todayClosed && (
                        <p className="text-[11px] sm:text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5">
                          Today&apos;s delivery slots are closed after 9:00 PM. Please choose Tomorrow.
                        </p>
                      )}
                      <div className="space-y-2">
                        {dayGroups.map((day) => (
                          <div key={day.dateKey} className="space-y-1">
                            <p className="text-[11px] font-semibold text-slate-600">
                              {day.dayLabel} · {day.dateShort}
                            </p>
                            <div className="inline-flex w-full rounded-lg border border-cyan-200 bg-white p-0.5">
                              {day.slots.map((slot) => {
                                const selected =
                                  pref.deliveryDate === day.dateKey &&
                                  normalizeSlot(pref.deliverySlot) === slot;
                                return (
                                  <button
                                    key={`${day.dateKey}-${slot}`}
                                    type="button"
                                    onClick={() => {
                                      setDeliverySlotError('');
                                      onDeliveryPreferenceChange?.(day.dateKey, slot);
                                    }}
                                    className={`flex-1 min-h-[40px] rounded-md text-xs font-bold transition-colors ${
                                      selected
                                        ? 'bg-[#087EA4] text-white'
                                        : 'text-slate-700'
                                    }`}
                                    aria-pressed={selected}
                                  >
                                    {slotEmoji(slot)} {slotDisplayLabel(slot)}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                      {deliverySlotError && (
                        <p className="text-xs text-red-600 font-medium">{deliverySlotError}</p>
                      )}
                    </div>
                    {orderSummary.appliedOffer?.title && (
                      <p className="text-xs text-green-700 bg-green-50 rounded-lg px-2 py-1.5">
                        {orderSummary.appliedOffer.title}
                      </p>
                    )}
                  </>
                )}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-lg font-medium text-gray-900">Payable Amount:</span>
                  <span className="text-2xl font-bold text-blue-600">
                    ₹{parseFloat(totalPrice).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <CreditCard className="w-6 h-6 text-gray-600" />
                  <div>
                    <p className="font-medium text-gray-900">Payment Method</p>
                    <p className="text-sm text-gray-600">UPI QR Code Payment</p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:space-x-3 sm:gap-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 min-h-[48px] py-3 px-4 border border-gray-300 text-gray-700 rounded-xl font-medium active:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleProceed();
                  }}
                  className="flex-1 min-h-[48px] flex items-center justify-center space-x-2 py-3 px-4 bg-blue-600 text-white rounded-xl font-semibold active:bg-blue-800"
                >
                  <span>Add Delivery Info</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="space-y-4">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <MapPin className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Delivery Information</h3>
                    <p className="text-sm text-gray-600">Please provide your delivery details</p>
                  </div>
                </div>

                <form onSubmit={handleDeliverySubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <User className="w-4 h-4 inline mr-1" />
                      Customer Name *
                    </label>
                    <input
                      type="text"
                      name="customerName"
                      value={deliveryInfo.customerName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                      placeholder="Enter your full name"
                      required
                    />
                  </div>

                  {/* Mobile + MSG91 OTP (H-Captcha must be visible before Verify Mobile) */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <Phone className="w-4 h-4 inline mr-1" />
                      Mobile Number *
                    </label>
                    <div className="flex gap-2">
                      <input
                        ref={mobileInputRef}
                        type="tel"
                        name="mobileNumber"
                        value={deliveryInfo.mobileNumber}
                        onChange={handleInputChange}
                        className="flex-1 px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                        placeholder="Enter 10-digit mobile number"
                        maxLength={10}
                        inputMode="numeric"
                        autoComplete="tel"
                        required
                        disabled={showOtpPanel && !isCurrentMobileVerified}
                      />
                      {!isCurrentMobileVerified && (
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          disabled={
                            sendingOtp ||
                            !deliveryInfo.mobileNumber ||
                            deliveryInfo.mobileNumber.length !== 10 ||
                            !captchaReady ||
                            !captchaSolved
                          }
                          className="min-h-[48px] px-3 sm:px-4 rounded-lg bg-blue-600 text-white text-sm font-semibold whitespace-nowrap active:bg-blue-800 disabled:bg-gray-300 disabled:text-gray-500"
                          title={
                            captchaSolved
                              ? 'Send OTP'
                              : 'Complete captcha first, then tap Verify Mobile'
                          }
                        >
                          {sendingOtp ? 'Sending…' : 'Verify Mobile'}
                        </button>
                      )}
                    </div>

                    {!isCurrentMobileVerified && (
                      <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3 space-y-2">
                        <p className="text-sm font-semibold text-gray-800">Security check</p>
                        <p className="text-xs text-gray-600">
                          Complete the captcha, then tap Verify Mobile.
                        </p>
                        <div
                          id={MSG91_CAPTCHA_RENDER_ID}
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
                              ? 'Captcha completed ✓ — you can verify mobile now.'
                              : 'Waiting for captcha…'}
                          </p>
                        )}
                      </div>
                    )}

                    {isCurrentMobileVerified && (
                      <div className="mt-2 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
                        <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                        <span className="font-medium">Mobile Verified ✓</span>
                        <span className="text-green-700">{maskMobile(verifiedMobile)}</span>
                        <button
                          type="button"
                          onClick={handleChangeMobile}
                          className="ml-auto text-xs font-semibold text-blue-700 underline"
                        >
                          Change
                        </button>
                      </div>
                    )}

                    {!isCurrentMobileVerified && otpError && !showOtpPanel && (
                      <p className="mt-2 text-sm text-red-600">{otpError}</p>
                    )}
                  </div>

                  {/* Custom OTP panel — not MSG91 default popup */}
                  {showOtpPanel && !isCurrentMobileVerified && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-3">
                      <div>
                        <h4 className="text-base font-bold text-gray-900">Verify Mobile Number</h4>
                        <p className="text-sm text-gray-600">
                          Enter the 4-digit OTP sent to {maskMobile(deliveryInfo.mobileNumber)}
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
                      {otpError && <p className="text-sm text-red-600">{otpError}</p>}

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
                          Change Mobile Number
                        </button>
                      </div>
                    </div>
                  )}

                  <DeliveryLocationPicker
                    key="delivery-location-picker"
                    onChange={(location) => {
                      setDeliveryInfo((prev) => ({ ...prev, location }));
                    }}
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      <MapPin className="w-4 h-4 inline mr-1" />
                      Complete Address *
                    </label>
                    <textarea
                      name="address"
                      value={deliveryInfo.address}
                      onChange={handleInputChange}
                      rows="3"
                      className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-base"
                      placeholder="House/Flat No., Building, Street, City, Pincode"
                      required
                    />
                  </div>

                  <div className="flex flex-col-reverse sm:flex-row gap-2 sm:space-x-3 sm:gap-0 pt-4 sticky bottom-0 bg-white pb-1">
                    <button
                      type="button"
                      onClick={() => setShowDeliveryForm(false)}
                      className="flex-1 min-h-[48px] py-3 px-4 border border-gray-300 text-gray-700 rounded-xl font-medium active:bg-gray-100"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      className={`flex-1 min-h-[48px] flex items-center justify-center space-x-2 py-3 px-4 rounded-xl font-semibold ${
                        isCurrentMobileVerified
                          ? 'bg-green-600 text-white active:bg-green-800'
                          : 'bg-gray-300 text-gray-600'
                      }`}
                    >
                      <span>Proceed to Payment</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                  {!isCurrentMobileVerified && (
                    <p className="text-xs text-center text-amber-700">
                      Verify your mobile number with OTP before payment.
                    </p>
                  )}
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CheckoutConfirmation;
