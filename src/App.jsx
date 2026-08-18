import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import FishCatalog from './pages/FishCatalog';
import PromoPopup from './components/PromoPopup';
import PromoBanner from './components/PromoBanner';
import AndroidAppPromo from './components/AndroidAppPromo';
import ShoppingCart from './components/ShoppingCart';
import Toast from './components/Toast';
import ThemeToggle from './components/ThemeToggle';
import EnhancedLoadingSpinner from './components/EnhancedLoadingSpinner';
import { useNotifications } from './hooks/useNotifications';
import { useLocalStorage } from './hooks/useLocalStorage';
import useTheme from './hooks/useTheme';
import './index.css';
import {
  normalizeQuantity,
  validateQuantity,
  QUANTITY_LIMITS,
} from './utils/quantityUtils';
import { resolveMerchantName, resolveMerchantUpiId } from './config/paymentConfig';
import { createPaymentReference, logPaymentAttempt } from './utils/upiPayment';
import {
  calculateCartSummary,
  DEFAULT_DISCOUNT_SETTINGS,
} from './utils/cartPricing';
import { normalizeDeliveryChargeRupees } from './utils/moneyUtils';
import { auth } from './firebaseConfig';
import { signInWithCustomToken } from 'firebase/auth';
import { isDeliveryReadyForPaymentGate } from './services/checkoutCustomerDelivery';
import { createCustomerOrder, incrementOfferUsage } from './services/firestoreService';
import { ensureCustomerProfile } from './services/customerProfile';
import { createCustomerAddress } from './services/customerAddresses';
import {
  exchangeVerifiedTokenForGuestConversion,
  generateConversionNonce,
  isValidConversionNonce,
  shouldOfferGuestConversion,
  stripConversionSecrets,
  toSavedAddressInputFromDelivery,
} from './services/guestCheckoutConversion';
import {
  normalizeDeliveryPreference,
  normalizeSlot,
  validateDeliverySelection,
} from './utils/deliverySlot';

const Home = lazy(() => import('./pages/Home'));
const About = lazy(() => import('./pages/About'));
const Contact = lazy(() => import('./pages/Contact'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const Admin = lazy(() => import('./pages/Admin'));
const Login = lazy(() => import('./pages/Login'));
const Account = lazy(() => import('./pages/Account'));
const CustomerOrders = lazy(() => import('./pages/CustomerOrders'));
const CustomerAddresses = lazy(() => import('./pages/CustomerAddresses'));
const CheckoutConfirmation = lazy(() => import('./components/CheckoutConfirmation'));
const QRModal = lazy(() => import('./components/QRModal'));
const TransactionSuccess = lazy(() => import('./components/TransactionSuccess'));
const BasketEstimator = lazy(() => import('./components/BasketEstimator'));
const PriceAlerts = lazy(() => import('./components/PriceAlerts'));
const VoiceSearch = lazy(() => import('./components/VoiceSearch'));

const lazyFallback = (
  <EnhancedLoadingSpinner message="Loading Fresh Fish Data..." size="large" />
);

const ScrollToTop = ({ enabled }) => {
  const location = useLocation();

  useEffect(() => {
    if (enabled) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [location.pathname, enabled]);

  return null;
};

// Helper to deduplicate fish array by id and name (keep first occurrence)
const deduplicateFish = (fishArray) => {
  const seenIds = new Set();
  const seenNames = new Set();
  const uniqueFish = [];
  let duplicatesRemoved = 0;
  
  for (const fish of fishArray) {
    const fishId = fish.id?.toString() || fish.id;
    const fishName = (fish.name || '').toLowerCase().trim();
    
    // Skip if we've already seen this ID
    if (fishId && seenIds.has(fishId)) {
      duplicatesRemoved++;
      continue;
    }
    
    // Skip if we've already seen this name (duplicate name with different ID)
    if (fishName && seenNames.has(fishName)) {
      console.log(`⚠️ Duplicate fish name found: "${fish.name}" (ID: ${fishId}). Keeping first occurrence.`);
      duplicatesRemoved++;
      continue;
    }
    
    // Add to unique list
    if (fishId) seenIds.add(fishId);
    if (fishName) seenNames.add(fishName);
    uniqueFish.push(fish);
  }
  
  if (duplicatesRemoved > 0) {
    console.log(`✅ Deduplication complete: Removed ${duplicatesRemoved} duplicate fish entries`);
  }
  
  return uniqueFish;
};

function App() {
  const [fishData, setFishData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useLocalStorage('shoppingCart', []);
  const [favorites, setFavorites] = useLocalStorage('favorites', []);
  const [deliveryPreference, setDeliveryPreferenceRaw] = useLocalStorage(
    'deliveryPreference',
    normalizeDeliveryPreference(null),
  );

  // Drop expired selections (do not silently switch to another slot)
  useEffect(() => {
    const normalized = normalizeDeliveryPreference(deliveryPreference);
    if (
      normalized.deliveryDate !== deliveryPreference?.deliveryDate ||
      normalizeSlot(normalized.deliverySlot) !== normalizeSlot(deliveryPreference?.deliverySlot)
    ) {
      setDeliveryPreferenceRaw(normalized);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh once on mount / calendar change
  }, []);

  const setDeliveryPreference = (dateKey, slot) => {
    const result = validateDeliverySelection(dateKey, slot);
    if (!result.ok) return;
    setDeliveryPreferenceRaw({
      deliveryDate: result.deliveryDate,
      deliverySlot: result.deliverySlot,
    });
  };
  const [showCart, setShowCart] = useState(false);
  const [showVoiceSearch, setShowVoiceSearch] = useState(false);
  const [showPriceAlerts, setShowPriceAlerts] = useState(false);
  const [showBasketEstimator, setShowBasketEstimator] = useState(false);
  const [showTransactionSuccess, setShowTransactionSuccess] = useState({ show: false, order: null });
  const [voiceSearchQuery, setVoiceSearchQuery] = useState('');
  const [isVoiceSearchActive, setIsVoiceSearchActive] = useState(false);
  const [currentCheckoutSummary, setCurrentCheckoutSummary] = useState({
    subtotal: 0,
    discount: 0,
    deliveryCharge: 0,
    total: 0,
  });
  const cartSnapshotRef = useRef([]);
  const checkoutVerifiedTokenRef = useRef('');
  const conversionNonceRef = useRef('');
  
  // 3-Step Checkout Flow States
  const [showCheckoutConfirmation, setShowCheckoutConfirmation] = useState(false);
  const [showQRPayment, setShowQRPayment] = useState(false);
  const [currentCheckoutCart, setCurrentCheckoutCart] = useState([]);
  const [currentCheckoutTotal, setCurrentCheckoutTotal] = useState(0);
  const [paymentSession, setPaymentSession] = useState(null);
  
  // Debug logging for checkout flow states
  console.log('App render - showCheckoutConfirmation:', showCheckoutConfirmation, 'showQRPayment:', showQRPayment);
  

  // Monitor state changes
  useEffect(() => {
    console.log('🔄 App.jsx: showQRPayment state changed to:', showQRPayment);
  }, [showQRPayment]);

  useEffect(() => {
    console.log('🔄 App.jsx: showCheckoutConfirmation state changed to:', showCheckoutConfirmation);
  }, [showCheckoutConfirmation]);
  
  const { notifications, addNotification, removeNotification } = useNotifications();
  const { theme } = useTheme();

  useEffect(() => {
    // Load fish data directly from Firestore (no caching)
    const loadFishData = async () => {
      try {
        console.log('🔄 Loading fish data from Firestore...');
        const { loadFishDataFromFirestore } = await import('./services/firestoreService');
        const data = await loadFishDataFromFirestore();
        
        // Validate data structure before processing
        if (!data || typeof data !== 'object') {
          throw new Error('Invalid data structure received from Firestore');
        }
        
        // Deduplicate fishes array
        if (data.fishes && Array.isArray(data.fishes)) {
          data.fishes = deduplicateFish(data.fishes);
        }
        
        console.log('✅ Loaded fish data from Firestore:', data.fishes?.length || 0);
        console.log('📊 Firestore fish names:', data.fishes?.slice(0, 10).map(f => f.name).join(', '));
        
        // Update state directly from Firestore
        setFishData(data);
        
        // Success - data loaded silently (no notification for end users)
      } catch (error) {
        console.error('❌ Error loading from Firestore:', error);
        
        // Check if it's a SyntaxError (JSON parsing issue)
        if (error instanceof SyntaxError || error.name === 'SyntaxError') {
          console.error('🔍 SYNTAX ERROR DETECTED - This is likely a JSON parsing issue');
          console.error('   Possible causes:');
          console.error('   1. Firebase config has trailing semicolons or invalid characters');
          console.error('   2. Firestore response contains invalid JSON');
          console.error('   3. Error response is being parsed as JSON');
          console.error('   Error message:', error.message);
          
          addNotification(`❌ JSON Parse Error\n\nThis usually means:\n1. Firebase config has invalid characters\n2. Firestore response contains invalid JSON\n\nError: ${error.message}`, 'error', 10000);
        } else {
          console.error('❌ Error details:', {
            message: error.message,
            code: error.code,
            name: error.name,
            stack: error.stack?.substring(0, 300)
          });
          
          // Build detailed error message for user notification
          const errorCode = error.code || 'UNKNOWN';
          const errorMessage = error.message || 'Unknown error occurred';
          let notificationMessage = '';
          let errorType = 'error';
          
          if (errorCode === 'permission-denied') {
            notificationMessage = `🔒 Permission Denied\n\nFirestore security rules are blocking access.\n\nTo fix:\n1. Go to Firebase Console → Firestore Database → Rules\n2. Add: allow read: if true;\n3. Click "Publish"`;
            errorType = 'error';
          } else if (errorCode === 'unavailable') {
            notificationMessage = `🌐 Service Unavailable\n\nFirestore service is unavailable.\n\nPlease check:\n1. Your internet connection\n2. Firebase project is active\n3. Firestore database is created`;
            errorType = 'warning';
          } else if (errorCode === 'failed-precondition') {
            notificationMessage = `⚠️ Database Not Initialized\n\nFirestore database may not be initialized.\n\nTo fix:\n1. Go to Firebase Console → Firestore Database\n2. Click "Create database"\n3. Choose location and start in test mode`;
            errorType = 'error';
          } else {
            notificationMessage = `❌ Firestore Error\n\nCode: ${errorCode}\nMessage: ${errorMessage}\n\nPossible causes:\n1. Firebase config is incorrect\n2. Firestore database not created\n3. Network connectivity issues`;
            errorType = 'error';
          }
          
          addNotification(notificationMessage, errorType, 12000);
        }
        
        // Try JSON fallback only if Firestore fails
        try {
          console.log('📦 Attempting to load fallback JSON data...');
          const response = await fetch('/src/data/fishData.json');
          
          // Check if response is OK (status 200-299)
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          // Check if response is actually JSON
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            throw new Error(`Expected JSON but got: ${contentType || 'unknown content type'}`);
          }
          
          // Parse JSON safely
          const jsonData = await response.json();
          
          // Validate JSON structure
          if (!jsonData || typeof jsonData !== 'object') {
            throw new Error('Invalid JSON structure in fallback file');
          }
          
          // Deduplicate
          if (jsonData.fishes) {
            jsonData.fishes = deduplicateFish(jsonData.fishes);
          }
          if (!Array.isArray(jsonData.offers)) {
            jsonData.offers = [];
          }
          
          console.log('📦 Loaded fallback data from JSON:', jsonData.fishes?.length || 0);
          setFishData(jsonData);
          addNotification('📦 Using fallback data from local JSON file\n\nFirestore data will be unavailable until connection is restored.', 'warning', 6000);
        } catch (jsonError) {
          console.error('❌ Error loading fallback JSON:', jsonError);
          
          // Check if it's a JSON parse error
          if (jsonError instanceof SyntaxError || jsonError.name === 'SyntaxError') {
            console.error('❌ JSON Parse Error in fallback file:', jsonError.message);
            addNotification(`❌ Critical Error\n\nFailed to parse fallback JSON file.\n\nError: ${jsonError.message}\n\nThis usually means the JSON file is corrupted or contains invalid characters.`, 'error', 12000);
          } else {
            addNotification(`❌ Critical Error\n\nFailed to load data from:\n1. Firestore\n2. Fallback JSON file\n\nError: ${jsonError.message}\n\nPlease check:\n1. Your internet connection\n2. Firebase setup\n3. Application files are intact`, 'error', 12000);
          }
        }
      } finally {
        setLoading(false);
      }
    };

    loadFishData();
  }, [addNotification]);

  // Refresh fish data directly from Firestore (no caching)
  const refreshFishData = async () => {
    try {
      console.log('🔄 Refreshing fish data from Firestore...');
      const { loadFishDataFromFirestore } = await import('./services/firestoreService');
      const data = await loadFishDataFromFirestore();
      
      // Deduplicate fishes array
      if (data.fishes) {
        data.fishes = deduplicateFish(data.fishes);
      }
      
      // Update local state with fresh Firestore data
      setFishData(data);
      
      console.log('✅ Fish data refreshed from Firestore:', data.fishes?.length || 0);
    } catch (error) {
      console.error('❌ Error refreshing fish data:', error);
      addNotification('⚠️ Failed to refresh data from Firestore.', 'warning');
    }
  };

  useEffect(() => {
    cartSnapshotRef.current = cart.map((item) => ({ ...item }));
  }, [cart]);

  const restoreCartSnapshot = () => {
    setCart(cartSnapshotRef.current.map((item) => ({ ...item })));
    addNotification('Cart data restored due to quantity error.', 'warning');
  };

  const addToCart = (fish, quantity = QUANTITY_LIMITS.MIN) => {
    const { valid, normalized, message } = validateQuantity(quantity);

    if (!valid && message.includes('between')) {
      addNotification('Update failed — please re-check quantity or try again.', 'error');
      return false;
    }

    const safeQuantity = normalizeQuantity(normalized);

    // Financial unit price = catalog rate only.
    // Legacy banner promo is display-only; cart discounts come from cartPricing.
    const catalogUnitPrice = Number(fish.rate);
    const unitPrice =
      Number.isFinite(catalogUnitPrice) && catalogUnitPrice > 0 ? catalogUnitPrice : 0;

    const existingItem = cart.find((item) => item.id === fish.id);
    if (existingItem) {
      const combinedQuantity = normalizeQuantity(existingItem.quantity + safeQuantity);

      if (combinedQuantity > QUANTITY_LIMITS.MAX) {
        addNotification('Update failed — please re-check quantity or try again.', 'error');
        return false;
      }

      setCart(
        cart.map((item) =>
          item.id === fish.id
            ? {
                ...item,
                quantity: combinedQuantity,
                price: unitPrice,
                rate: fish.rate,
              }
            : item,
        ),
      );
    } else {
      setCart([
        ...cart,
        {
          ...fish,
          quantity: safeQuantity,
          price: unitPrice,
          originalRate: fish.rate,
        },
      ]);
    }
    addNotification(`${safeQuantity.toFixed(1)} kg ${fish.name} added to cart!`, 'success');

    return true;
  };

  const updateCartItem = (fishId, quantity) => {
    const { valid, normalized, message } = validateQuantity(quantity);

    if (!valid && message.includes('between')) {
      addNotification('Update failed — please re-check quantity or try again.', 'error');
      return false;
    }

    const safeQuantity = normalizeQuantity(normalized);

    setCart(
      cart.map((item) => (item.id === fishId ? { ...item, quantity: safeQuantity } : item)),
    );

    return true;
  };

  const removeFromCart = (fishId) => {
    setCart(cart.filter(item => item.id !== fishId));
    addNotification('Item removed from cart', 'info');
  };

  const clearCart = () => {
    if (cart.length === 0) return;
    
    if (window.confirm(`Are you sure you want to remove all ${cart.length} item(s) from your cart?`)) {
      setCart([]);
      addNotification('Cart cleared successfully', 'success');
    }
  };

  const handleCheckout = (cartItems, totalPrice) => {
    console.log('Checkout initiated with items:', cartItems);
    console.log('Total price:', totalPrice);

    const discountSettings = fishData?.discountSettings || DEFAULT_DISCOUNT_SETTINGS;
    const offers = fishData?.offers || [];
    const deliveryCharge = normalizeDeliveryChargeRupees(fishData?.shopInfo?.deliveryCharge);
    const summary = calculateCartSummary(
      cartItems,
      discountSettings,
      offers,
      new Date(),
      deliveryCharge,
    );

    // Compare via paise when available (avoids float drift)
    const incomingPaise = Math.round(parseFloat(totalPrice) * 100);
    if (
      !Number.isFinite(incomingPaise) ||
      Math.abs(summary.totalPaise - incomingPaise) > 0
    ) {
      addNotification('Quantity or total mismatch detected — please review your cart before checkout.', 'error');
      restoreCartSnapshot();
      setShowCart(true);
      return;
    }
    
    // Store cart data for checkout flow
    setCurrentCheckoutCart(summary.items);
    setCurrentCheckoutSummary(summary);
    setCurrentCheckoutTotal(summary.total);
    
    // Close cart modal
    setShowCart(false);
    
    // Start 3-step checkout flow - Step 1: Checkout Confirmation
    setShowCheckoutConfirmation(true);
  };

  // Single fish Buy Now - same process as cart checkout
  const handleBuyNow = (fish, quantity = QUANTITY_LIMITS.MIN) => {
    console.log('Buy Now initiated for fish:', fish, 'quantity:', quantity);

    const { valid, normalized, message } = validateQuantity(quantity);

    if (!valid && message.includes('between')) {
      addNotification('Update failed — please re-check quantity or try again.', 'error');
      return;
    }

    const safeQuantity = normalizeQuantity(normalized);
    
    // Create single item cart for checkout flow (offers may still apply; basket % off)
    const singleItemCart = [{ ...fish, quantity: safeQuantity, price: fish.rate }];
    const offers = fishData?.offers || [];
    const deliveryCharge = normalizeDeliveryChargeRupees(fishData?.shopInfo?.deliveryCharge);
    const summary = calculateCartSummary(
      singleItemCart,
      { ...DEFAULT_DISCOUNT_SETTINGS, isEnabled: false },
      offers,
      new Date(),
      deliveryCharge,
    );
    
    // Store cart data for checkout flow
    setCurrentCheckoutCart(summary.items);
    setCurrentCheckoutSummary(summary);
    setCurrentCheckoutTotal(summary.total);
    
    // Start 3-step checkout flow - Step 1: Checkout Confirmation
    setShowCheckoutConfirmation(true);
  };

  // Step 1 to Step 2: Proceed to Payment — recalculate & lock amount + payment ref
  const handleProceedToPayment = (deliveryInfo, checkoutProof) => {
    const verifiedToken =
      typeof checkoutProof?.verifiedToken === 'string'
        ? checkoutProof.verifiedToken.trim()
        : '';
    checkoutVerifiedTokenRef.current = verifiedToken;

    // Payment gate — MSG91 OTP or approved Auth-mobile match. Do not start QR/payment without it.
    if (!isDeliveryReadyForPaymentGate(auth.currentUser, deliveryInfo)) {
      addNotification(
        'Please verify your mobile number before proceeding to payment.',
        'error',
      );
      return;
    }

    const lockedPref = validateDeliverySelection(
      deliveryInfo?.deliveryDate || deliveryPreference?.deliveryDate,
      deliveryInfo?.deliverySlot || deliveryPreference?.deliverySlot,
    );
    if (!lockedPref.ok) {
      addNotification(lockedPref.reason, 'error');
      setDeliveryPreferenceRaw(
        normalizeDeliveryPreference({
          deliveryDate: deliveryInfo?.deliveryDate || deliveryPreference?.deliveryDate,
          deliverySlot: deliveryInfo?.deliverySlot || deliveryPreference?.deliverySlot,
        }),
      );
      return;
    }
    const pref = {
      deliveryDate: lockedPref.deliveryDate,
      deliverySlot: lockedPref.deliverySlot,
    };

    const discountSettings = fishData?.discountSettings || DEFAULT_DISCOUNT_SETTINGS;
    const offers = fishData?.offers || [];
    const deliveryCharge = normalizeDeliveryChargeRupees(fishData?.shopInfo?.deliveryCharge);
    // Recalculate from cart line items — do not trust a browser-edited total alone.
    // Live deliveryCharge is used; if Admin changed it, totalPaise will not match the lock.
    const summary = calculateCartSummary(
      currentCheckoutCart,
      discountSettings,
      offers,
      new Date(),
      deliveryCharge,
    );

    if (!summary.items.length || summary.totalPaise <= 0) {
      addNotification('Unable to start payment — cart total is invalid.', 'error');
      return;
    }

    const lockedPaise = currentCheckoutSummary?.totalPaise;
    if (
      Number.isFinite(lockedPaise) &&
      Math.abs(summary.totalPaise - lockedPaise) > 0
    ) {
      addNotification('Quantity or total mismatch detected — please review your cart before checkout.', 'error');
      restoreCartSnapshot();
      setShowCheckoutConfirmation(false);
      setShowCart(true);
      return;
    }

    const paymentRef = createPaymentReference();
    const orderId = `ORDER_${Date.now()}`;
    const merchantUpiId = resolveMerchantUpiId(fishData?.shopInfo);
    const merchantName = resolveMerchantName(fishData?.shopInfo);

    // Payment amount is locked from canonical calculateCartSummary — do not recompute elsewhere
    const session = {
      orderId,
      paymentRef,
      amount: summary.total,
      amountPaise: summary.totalPaise,
      subtotal: summary.subtotal,
      subtotalPaise: summary.subtotalPaise,
      discount: summary.discount,
      discountPaise: summary.discountPaise,
      deliveryCharge: summary.deliveryCharge,
      deliveryChargePaise: summary.deliveryChargePaise,
      items: summary.items,
      offerId: summary.offerId,
      offerName: summary.offerName,
      offerDiscount: summary.discountSource === 'offer' ? summary.discount : 0,
      discountSource: summary.discountSource,
      merchantUpiId,
      merchantName,
      deliveryDate: pref.deliveryDate,
      deliverySlot: pref.deliverySlot,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    setCurrentCheckoutCart(summary.items);
    setCurrentCheckoutSummary(summary);
    setCurrentCheckoutTotal(summary.total);
    setPaymentSession(session);

    logPaymentAttempt({
      orderId,
      paymentRef,
      amount: summary.total.toFixed(2),
      merchantUpiId,
      params: { cu: 'INR', tn: paymentRef, pn: merchantName },
    });

    if (deliveryInfo) {
      localStorage.setItem(
        'currentOrderDeliveryInfo',
        JSON.stringify({
          ...deliveryInfo,
          deliveryDate: pref.deliveryDate,
          deliverySlot: pref.deliverySlot,
        }),
      );
    }

    setDeliveryPreferenceRaw(pref);
    setShowCheckoutConfirmation(false);
    setShowQRPayment(true);
  };

  // User claims payment complete — record order in Firestore first, then show success.
  // WhatsApp is never part of this path; success only after a successful write.
  const handlePaymentDone = async (transactionId, meta = {}) => {
    const deliveryInfo = JSON.parse(localStorage.getItem('currentOrderDeliveryInfo') || '{}');
    const lockedPref = validateDeliverySelection(
      deliveryInfo.deliveryDate ||
        paymentSession?.deliveryDate ||
        deliveryPreference?.deliveryDate,
      deliveryInfo.deliverySlot ||
        paymentSession?.deliverySlot ||
        deliveryPreference?.deliverySlot,
    );

    if (!lockedPref.ok) {
      addNotification(lockedPref.reason, 'error', 8000);
      setDeliveryPreferenceRaw(
        normalizeDeliveryPreference({
          deliveryDate:
            deliveryInfo.deliveryDate ||
            paymentSession?.deliveryDate ||
            deliveryPreference?.deliveryDate,
          deliverySlot:
            deliveryInfo.deliverySlot ||
            paymentSession?.deliverySlot ||
            deliveryPreference?.deliverySlot,
        }),
      );
      return { success: false, error: new Error(lockedPref.reason) };
    }
    const pref = {
      deliveryDate: lockedPref.deliveryDate,
      deliverySlot: lockedPref.deliverySlot,
    };

    // Always use locked payment-session amount — never recompute at claim time
    const lockedAmount = paymentSession?.amount ?? currentCheckoutTotal;
    const orderId = paymentSession?.orderId || `ORDER_${Date.now()}`;
    const paymentRef = paymentSession?.paymentRef || meta.paymentRef || createPaymentReference();

    const {
      deliveryDate: _dd,
      deliverySlot: _ds,
      ...customerDelivery
    } = deliveryInfo;

    const orderSummary = {
      items: paymentSession?.items || currentCheckoutCart,
      totalPrice: lockedAmount,
      amountPaise: paymentSession?.amountPaise ?? Math.round(Number(lockedAmount) * 100),
      subtotal: paymentSession?.subtotal ?? currentCheckoutSummary?.subtotal,
      discount: paymentSession?.discount ?? currentCheckoutSummary?.discount,
      deliveryCharge:
        paymentSession?.deliveryCharge ?? currentCheckoutSummary?.deliveryCharge ?? 0,
      deliveryChargePaise:
        paymentSession?.deliveryChargePaise ?? currentCheckoutSummary?.deliveryChargePaise ?? 0,
      offerId: paymentSession?.offerId || null,
      offerName: paymentSession?.offerName || null,
      offerDiscount: paymentSession?.offerDiscount || 0,
      discountSource: paymentSession?.discountSource || currentCheckoutSummary?.discountSource || 'none',
      deliveryInfo: customerDelivery,
      // Canonical delivery preference (order-level; optional on legacy orders)
      deliveryDate: pref.deliveryDate,
      deliverySlot: pref.deliverySlot,
      transactionId,
      paymentRef,
      paymentStatus: 'PENDING_CONFIRMATION',
      paidVerified: false,
      timestamp: new Date().toISOString(),
      orderId,
      merchantUpiId: paymentSession?.merchantUpiId || resolveMerchantUpiId(fishData?.shopInfo),
    };

    const conversionNonce = generateConversionNonce();
    if (isValidConversionNonce(conversionNonce)) {
      orderSummary.conversionNonce = conversionNonce;
      conversionNonceRef.current = conversionNonce;
    }

    try {
      // Firestore write must succeed before TransactionSuccess is shown
      const savedOrder = await createCustomerOrder(orderSummary);
      const publicOrder = stripConversionSecrets(savedOrder);
      if (publicOrder.customerUid) {
        conversionNonceRef.current = '';
        checkoutVerifiedTokenRef.current = '';
      }

      const orders = JSON.parse(localStorage.getItem('orders') || '[]');
      const withoutSameId = orders.filter((o) => o?.orderId !== publicOrder.orderId);
      withoutSameId.push(publicOrder);
      localStorage.setItem('orders', JSON.stringify(withoutSameId));

      // Count offer use only after the order is recorded
      if (paymentSession?.offerId) {
        incrementOfferUsage(paymentSession.offerId).catch(() => {});
      }

      setCart([]);
      setShowQRPayment(false);
      setPaymentSession(null);

      setShowTransactionSuccess({
        show: true,
        order: publicOrder,
      });

      addNotification(
        `Order submitted successfully. Ref: ${paymentRef}`,
        'success',
      );

      return { success: true, order: publicOrder };
    } catch (error) {
      console.error('Failed to record order in Firestore:', error);
      addNotification(
        'Unable to record your order. Please try again.',
        'error',
        8000,
      );
      // Keep QR modal / payment session intact so customer can retry without a new order ID
      return { success: false, error };
    }
  };

  const clearGuestConversionSecrets = () => {
    checkoutVerifiedTokenRef.current = '';
    conversionNonceRef.current = '';
  };

  const handleCreateAccountFromOrder = async () => {
    const orderId = showTransactionSuccess.order?.orderId;
    try {
      const exchanged = await exchangeVerifiedTokenForGuestConversion({
        token: checkoutVerifiedTokenRef.current,
        orderId,
        conversionNonce: conversionNonceRef.current,
      });
      await signInWithCustomToken(auth, exchanged.customToken);
      checkoutVerifiedTokenRef.current = '';
      await ensureCustomerProfile(auth.currentUser);
      if (exchanged.orderLinked) {
        conversionNonceRef.current = '';
        return { status: 'linked' };
      }
      return { status: 'unlinked' };
    } catch {
      return { status: 'failed' };
    }
  };

  const handleSaveConvertedAddress = async () => {
    const input = toSavedAddressInputFromDelivery(
      showTransactionSuccess.order?.deliveryInfo,
    );
    if (!input) return { status: 'failed' };
    const result = await createCustomerAddress(auth.currentUser, input);
    return result?.status === 'ok' ? { status: 'ok' } : { status: 'failed' };
  };

  const toggleFavorite = (fishId) => {
    if (favorites.includes(fishId)) {
      setFavorites(favorites.filter(id => id !== fishId));
      addNotification('Removed from favorites', 'info');
    } else {
      setFavorites([...favorites, fishId]);
      addNotification('Added to favorites!', 'success');
    }
  };

  if (loading) {
    return <EnhancedLoadingSpinner message="Loading Fresh Fish Data..." size="large" />;
  }

  if (!fishData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cyan-50">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Data</h2>
          <p className="text-gray-600">Please refresh the page or contact support.</p>
        </div>
      </div>
    );
  }

  return (
    <Router basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>
      <div className={`min-h-screen ${theme === 'dark' ? 'bg-gray-900' : 'bg-cyan-50'}`}>
        <ScrollToTop enabled={!isVoiceSearchActive} />
        {/* Promotion Popup (Professional) */}
        <PromoPopup promotion={fishData.promotions} />
        
        {/* Promotion Banner */}
        <PromoBanner promotion={fishData.promotions} />
        
        <Header 
          shopInfo={fishData.shopInfo} 
          cartCount={cart.length} 
          onCartClick={() => setShowCart(true)}
        />

        <AndroidAppPromo />

        <main>
          <Suspense fallback={lazyFallback}>
            <Routes>
            <Route path="/" element={
              <FishCatalog 
                fishData={fishData} 
                addToCart={addToCart}
                onBuyNow={handleBuyNow}
                toggleFavorite={toggleFavorite}
                favorites={favorites}
                cart={cart}
                voiceSearchQuery={voiceSearchQuery}
              />
            } />
            <Route path="/fish" element={<Navigate to="/" replace />} />
            <Route path="/home" element={<Home fishData={fishData} addToCart={addToCart} refreshFishData={refreshFishData} />} />
            <Route path="/about" element={<About shopInfo={fishData.shopInfo} />} />
            <Route path="/contact" element={<Contact shopInfo={fishData.shopInfo} />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy shopInfo={fishData.shopInfo} />} />
            <Route path="/login" element={<Login />} />
            <Route path="/account" element={<Account />} />
            <Route path="/account/orders" element={<CustomerOrders />} />
            <Route path="/account/addresses" element={<CustomerAddresses />} />
            <Route path="/admin" element={<Admin fishData={fishData} refreshFishData={refreshFishData} />} />
            </Routes>
          </Suspense>
        </main>
        
        <Footer shopInfo={fishData.shopInfo} />

        {/* Shopping Cart */}
        <ShoppingCart
          isOpen={showCart}
          onClose={() => setShowCart(false)}
          cart={cart}
          onUpdateCart={updateCartItem}
          onRemoveItem={removeFromCart}
          onClearCart={clearCart}
          fishData={fishData}
          onCheckout={handleCheckout}
        />

        {/* 3-Step Checkout Flow */}
        {/* Step 1: Checkout Confirmation */}
        {showCheckoutConfirmation && (
          <Suspense fallback={lazyFallback}>
            <CheckoutConfirmation
              isOpen={showCheckoutConfirmation}
              onClose={() => setShowCheckoutConfirmation(false)}
              cart={currentCheckoutCart}
              totalPrice={currentCheckoutTotal}
              orderSummary={currentCheckoutSummary}
              deliveryPreference={deliveryPreference}
              onDeliveryPreferenceChange={setDeliveryPreference}
              onProceedToPayment={(deliveryInfo, checkoutProof) => {
                handleProceedToPayment(deliveryInfo, checkoutProof);
              }}
            />
          </Suspense>
        )}

        {/* Step 2: QR Payment with Transaction ID Input */}
        {showQRPayment && fishData && paymentSession && (
          <Suspense fallback={lazyFallback}>
            <QRModal
              fish={{ name: 'Order', rate: paymentSession.amount }}
              shopInfo={fishData.shopInfo}
              onClose={() => {
                setShowQRPayment(false);
                // Keep session until cancelled fully — clear locked session on cancel
                setPaymentSession(null);
              }}
              isCheckoutFlow={true}
              cart={paymentSession.items || currentCheckoutCart}
              totalPrice={paymentSession.amount}
              paymentSession={paymentSession}
              onPaymentDone={handlePaymentDone}
            />
          </Suspense>
        )}

        {/* Step 3: Transaction Success Modal */}
        {showTransactionSuccess.show && (
          <Suspense fallback={lazyFallback}>
            <TransactionSuccess
              isOpen={showTransactionSuccess.show}
              order={showTransactionSuccess.order}
              shopInfo={fishData?.shopInfo}
              offerConversion={shouldOfferGuestConversion(
                showTransactionSuccess.order,
                auth.currentUser,
              )}
              onCreateAccount={handleCreateAccountFromOrder}
              onSaveConvertedAddress={handleSaveConvertedAddress}
              onContinueAsGuest={clearGuestConversionSecrets}
              onClose={() => {
                setShowTransactionSuccess({ show: false, order: null });
                clearGuestConversionSecrets();
                localStorage.removeItem('currentOrderDeliveryInfo');
              }}
              onContinueShopping={() => {
                setShowTransactionSuccess({ show: false, order: null });
                clearGuestConversionSecrets();
                localStorage.removeItem('currentOrderDeliveryInfo');
              }}
            />
          </Suspense>
        )}

        {/* Basket Estimator */}
        {showBasketEstimator && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">Basket Estimator</h2>
                  <button
                    onClick={() => setShowBasketEstimator(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
                <Suspense fallback={lazyFallback}>
                  <BasketEstimator fishData={fishData} onAddToCart={addToCart} />
                </Suspense>
              </div>
            </div>
          </div>
        )}

        {/* Price Alerts */}
        {showPriceAlerts && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-bold text-gray-900">Price Alerts</h2>
                  <button
                    onClick={() => setShowPriceAlerts(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    ✕
                  </button>
                </div>
                <Suspense fallback={lazyFallback}>
                  <PriceAlerts fishData={fishData} addNotification={addNotification} />
                </Suspense>
              </div>
            </div>
          </div>
        )}

        {/* Voice Search */}
        {showVoiceSearch && (
          <Suspense fallback={lazyFallback}>
            <VoiceSearch
            fishList={fishData?.fishes || []}
            onSearch={(query) => {
              if (query) {
                setVoiceSearchQuery(query);
                addNotification(`Voice search: showing results for "${query}"`, 'info', 4000);
                setIsVoiceSearchActive(true);
                if (window.location.pathname !== '/fish') {
                  window.history.pushState({}, '', '/fish');
                  window.dispatchEvent(new PopStateEvent('popstate'));
                }
              }
              setShowVoiceSearch(false);
              setTimeout(() => setIsVoiceSearchActive(false), 300);
            }}
            onClose={() => {
              setShowVoiceSearch(false);
              setIsVoiceSearchActive(false);
            }}
            />
          </Suspense>
        )}



        {/* Theme Toggle */}
        <div className="fixed top-4 right-4 z-40">
          <ThemeToggle />
        </div>

        {/* Notifications */}
        {notifications.map(notification => (
          <Toast
            key={notification.id}
            message={notification.message}
            type={notification.type}
            onClose={() => removeNotification(notification.id)}
          />
        ))}
      </div>
    </Router>
  );
}

export default App;

