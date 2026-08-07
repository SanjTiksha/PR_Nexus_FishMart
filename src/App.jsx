import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import About from './pages/About';
import FishCatalog from './pages/FishCatalog';
import Contact from './pages/Contact';
import Admin from './pages/Admin';
import PromoPopup from './components/PromoPopup';
import PromoBanner from './components/PromoBanner';
import ShoppingCart from './components/ShoppingCart';
import CheckoutConfirmation from './components/CheckoutConfirmation';
import QRModal from './components/QRModal';
import TransactionSuccess from './components/TransactionSuccess';
import FloatingActionButton from './components/FloatingActionButton';
import Toast from './components/Toast';
import SmartBanner from './components/SmartBanner';
import CookingGuide from './components/CookingGuide';
import BasketEstimator from './components/BasketEstimator';
import PriceAlerts from './components/PriceAlerts';
import VoiceSearch from './components/VoiceSearch';
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
  calculateLineTotal,
} from './utils/quantityUtils';

const DEFAULT_DISCOUNT_SETTINGS = { isEnabled: true, percentage: 5, minimumAmount: 1000 };

const calculateCartSummary = (items, discountSettings = DEFAULT_DISCOUNT_SETTINGS) => {
  const sanitizedItems = items.map((item) => {
    const normalizedQuantity = normalizeQuantity(item.quantity ?? QUANTITY_LIMITS.MIN);
    return {
      ...item,
      quantity: normalizedQuantity,
    };
  });

  const subtotal = sanitizedItems.reduce((total, current) => {
    const unitPrice = current.price ?? current.rate ?? 0;
    return total + calculateLineTotal(unitPrice, current.quantity);
  }, 0);

  let discount = 0;
  if (
    discountSettings?.isEnabled &&
    subtotal >= (discountSettings?.minimumAmount ?? DEFAULT_DISCOUNT_SETTINGS.minimumAmount)
  ) {
    discount = parseFloat(
      (subtotal * ((discountSettings?.percentage ?? DEFAULT_DISCOUNT_SETTINGS.percentage) / 100)).toFixed(2),
    );
  }

  const total = parseFloat((subtotal - discount).toFixed(2));

  return {
    items: sanitizedItems,
    subtotal: parseFloat(subtotal.toFixed(2)),
    discount,
    total,
  };
};

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
  const [showCart, setShowCart] = useState(false);
  const [showVoiceSearch, setShowVoiceSearch] = useState(false);
  const [showPriceAlerts, setShowPriceAlerts] = useState(false);
  const [showBasketEstimator, setShowBasketEstimator] = useState(false);
  const [showTransactionSuccess, setShowTransactionSuccess] = useState({ show: false, order: null });
  const [voiceSearchQuery, setVoiceSearchQuery] = useState('');
  const [isVoiceSearchActive, setIsVoiceSearchActive] = useState(false);
  const [currentCheckoutSummary, setCurrentCheckoutSummary] = useState({ subtotal: 0, discount: 0, total: 0 });
  const cartSnapshotRef = useRef([]);
  
  // 3-Step Checkout Flow States
  const [showCheckoutConfirmation, setShowCheckoutConfirmation] = useState(false);
  const [showQRPayment, setShowQRPayment] = useState(false);
  const [currentCheckoutCart, setCurrentCheckoutCart] = useState([]);
  const [currentCheckoutTotal, setCurrentCheckoutTotal] = useState(0);
  
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

    // Import pricing utility to get promotional price
    import('./utils/pricing').then(({ getPromotionalPrice }) => {
      const promotionalPrice = getPromotionalPrice(fish, fishData.promotions);
      
      const existingItem = cart.find(item => item.id === fish.id);
      if (existingItem) {
        const combinedQuantity = normalizeQuantity(existingItem.quantity + safeQuantity);

        if (combinedQuantity > QUANTITY_LIMITS.MAX) {
          addNotification('Update failed — please re-check quantity or try again.', 'error');
          return;
        }

        setCart(
          cart.map((item) =>
            item.id === fish.id
              ? {
                  ...item,
                  quantity: combinedQuantity,
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
            price: promotionalPrice,
            originalRate: fish.rate, // Keep original rate for reference
          },
        ]);
      }
      addNotification(`${safeQuantity.toFixed(1)} kg ${fish.name} added to cart!`, 'success');
    });

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
    const summary = calculateCartSummary(cartItems, discountSettings);

    if (Math.abs(summary.total - parseFloat(totalPrice)) > 0.01) {
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
    
    // Create single item cart for checkout flow
    const singleItemCart = [{ ...fish, quantity: safeQuantity, price: fish.rate }];
    const summary = calculateCartSummary(singleItemCart, { ...DEFAULT_DISCOUNT_SETTINGS, isEnabled: false });
    
    // Store cart data for checkout flow
    setCurrentCheckoutCart(summary.items);
    setCurrentCheckoutSummary(summary);
    setCurrentCheckoutTotal(summary.total);
    
    // Start 3-step checkout flow - Step 1: Checkout Confirmation
    setShowCheckoutConfirmation(true);
  };

  // Step 1 to Step 2: Proceed to Payment
  const handleProceedToPayment = (deliveryInfo) => {
    console.log('🚀 App.jsx: handleProceedToPayment called with delivery info:', deliveryInfo);
    console.log('📊 App.jsx: Current showCheckoutConfirmation:', showCheckoutConfirmation);
    console.log('📊 App.jsx: Current showQRPayment:', showQRPayment);

    const discountSettings = fishData?.discountSettings || DEFAULT_DISCOUNT_SETTINGS;
    const summary = calculateCartSummary(currentCheckoutCart, discountSettings);

    if (Math.abs(summary.total - currentCheckoutSummary.total) > 0.01) {
      addNotification('Quantity or total mismatch detected — please review your cart before checkout.', 'error');
      restoreCartSnapshot();
      setShowCheckoutConfirmation(false);
      setShowCart(true);
      return;
    }
    
    // Store delivery information
    if (deliveryInfo) {
      console.log('📝 App.jsx: Storing delivery information:', deliveryInfo);
      // You can store this in state or localStorage for later use
      localStorage.setItem('currentOrderDeliveryInfo', JSON.stringify(deliveryInfo));
    }
    
    console.log('🔄 App.jsx: About to call setShowCheckoutConfirmation(false)');
    setShowCheckoutConfirmation(false);
    
    console.log('🔄 App.jsx: About to call setShowQRPayment(true)');
    setShowQRPayment(true);
    
    console.log('✅ App.jsx: State updates called');
  };

  // Step 2 to Step 3: Payment Done with Transaction ID
  const handlePaymentDone = (transactionId) => {
    console.log('Payment done with transaction ID:', transactionId);
    
    // Get delivery information from localStorage
    const deliveryInfo = JSON.parse(localStorage.getItem('currentOrderDeliveryInfo') || '{}');
    console.log('📦 App.jsx: Retrieved delivery info:', deliveryInfo);
    
    // Create order summary with transaction ID and delivery info
    const orderSummary = {
      items: currentCheckoutCart,
      totalPrice: currentCheckoutTotal,
      deliveryInfo: deliveryInfo,
      transactionId: transactionId,
      timestamp: new Date().toISOString(),
      orderId: `ORDER_${Date.now()}`
    };
    
    // Store order in localStorage
    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    orders.push(orderSummary);
    localStorage.setItem('orders', JSON.stringify(orders));
    
    // Clear cart after successful order
    setCart([]);
    
    // Close QR payment modal
    setShowQRPayment(false);
    
    // Show transaction success modal - Step 3
    setShowTransactionSuccess({
      show: true,
      order: orderSummary
    });
    
    // Show success notification
    addNotification(`Payment successful! Order ID: ${orderSummary.orderId}`, 'success');
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
        
        
        
        <main>
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
            <Route path="/admin" element={<Admin fishData={fishData} refreshFishData={refreshFishData} />} />
          </Routes>
        </main>
        
        <Footer shopInfo={fishData.shopInfo} />
        
        {/* Enhanced Features */}
        <FloatingActionButton>
          <button
            onClick={() => setShowCart(true)}
            className="w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center"
            title="Shopping Cart"
          >
            🛒
          </button>
          <button
            onClick={() => setShowBasketEstimator(true)}
            className="w-12 h-12 bg-purple-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center"
            title="Basket Estimator"
          >
            🧮
          </button>
          <button
            onClick={() => setShowPriceAlerts(true)}
            className="w-12 h-12 bg-yellow-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center"
            title="Price Alerts"
          >
            🔔
          </button>
          <button
            onClick={() => setShowVoiceSearch(true)}
            className="w-12 h-12 bg-indigo-600 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center"
            title="Voice Search"
          >
            🎤
          </button>
          <button
            onClick={() => {
              const phoneNumber = fishData.shopInfo.whatsapp || fishData.shopInfo.phone.replace(/[^0-9]/g, '');
              window.open(`https://wa.me/${phoneNumber}`, '_blank');
            }}
            className="w-12 h-12 bg-green-500 text-white rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center"
            title="WhatsApp Us"
          >
            💬
          </button>
        </FloatingActionButton>

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
        <CheckoutConfirmation
          isOpen={showCheckoutConfirmation}
          onClose={() => setShowCheckoutConfirmation(false)}
          cart={currentCheckoutCart}
          totalPrice={currentCheckoutTotal}
          onProceedToPayment={(deliveryInfo) => {
            console.log('📞 App.jsx: onProceedToPayment callback called with deliveryInfo:', deliveryInfo);
            handleProceedToPayment(deliveryInfo);
          }}
        />

        {/* Step 2: QR Payment with Transaction ID Input */}
        {showQRPayment && fishData && (
          <>
            {console.log('App.jsx: Rendering QRModal - showQRPayment is true, fishData:', fishData)}
            <QRModal
              fish={{ name: 'Order', rate: currentCheckoutTotal }}
              shopInfo={fishData.shopInfo}
              onClose={() => setShowQRPayment(false)}
              isCheckoutFlow={true}
              cart={currentCheckoutCart}
              totalPrice={currentCheckoutTotal}
              onPaymentDone={handlePaymentDone}
            />
          </>
        )}

        {/* Step 3: Transaction Success Modal */}
        <TransactionSuccess
          isOpen={showTransactionSuccess.show}
          order={showTransactionSuccess.order}
          shopInfo={fishData?.shopInfo}
          fishData={fishData}
          onClose={() => {
            setShowTransactionSuccess({ show: false, order: null });
            // Clean up temporary delivery info after modal is closed
            localStorage.removeItem('currentOrderDeliveryInfo');
          }}
          onContinueShopping={() => {
            setShowTransactionSuccess({ show: false, order: null });
            // Clean up temporary delivery info after modal is closed
            localStorage.removeItem('currentOrderDeliveryInfo');
            // Optionally redirect to fish catalog
          }}
        />

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
                <BasketEstimator fishData={fishData} onAddToCart={addToCart} />
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
                <PriceAlerts fishData={fishData} addNotification={addNotification} />
              </div>
            </div>
          </div>
        )}

        {/* Voice Search */}
        {showVoiceSearch && (
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

