import { 
  collection, 
  getDocs, 
  doc, 
  getDoc,
  addDoc, 
  updateDoc, 
  deleteDoc,
  setDoc,
  query,
  orderBy,
  onSnapshot,
  writeBatch,
  serverTimestamp,
  increment
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import fishDataFallback from "../data/fishData.json";
import { normalizeDeliveryChargeRupees } from "../utils/moneyUtils";
import { applyOrderCustomerOwnership } from "./orderCustomerOwnership.js";
import { isValidConversionNonce } from "./guestCheckoutConversion.js";

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

/**
 * Firestore Service - Handles all Firestore operations for fish data
 */

// Collection names
const COLLECTIONS = {
  FISHES: "fishes",
  REVIEWS: "reviews",
  CONFIG: "config",
  DAILY_STOCK: "daily",
  RATE_HISTORY: "rateHistory",
  SHOP_SETTING: "shopSetting",
  PROMOTION_AND_DISCOUNTS: "promotionAndDiscounts",
  ADMIN_LOGS: "AdminLogs",
  OFFERS: "offers",
  ORDERS: "orders",
};

/**
 * Comprehensive Firestore Diagnostic Tool
 * Tests all aspects of Firestore connectivity and configuration
 */
export const runFirestoreDiagnostics = async () => {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    tests: {},
    overallStatus: 'unknown',
    recommendations: []
  };

  console.log('🔍 ========== FIRESTORE DIAGNOSTICS START ==========');

  // Test 1: Check if db object exists
  try {
    if (!db) {
      diagnostics.tests.dbInitialized = {
        status: 'FAIL',
        message: 'db object is null or undefined',
        recommendation: 'Check firebaseConfig.js - ensure db is exported correctly'
      };
      diagnostics.recommendations.push('❌ CRITICAL: db object not found. Check firebaseConfig.js exports');
    } else {
      diagnostics.tests.dbInitialized = {
        status: 'PASS',
        message: 'db object exists',
        details: { type: typeof db }
      };
      console.log('✅ Test 1: db object exists');
    }
  } catch (error) {
    diagnostics.tests.dbInitialized = {
      status: 'ERROR',
      message: error.message,
      error: error.toString()
    };
  }

  // Test 2: Check Firebase app initialization
  try {
    if (!db?.app) {
      diagnostics.tests.appInitialized = {
        status: 'FAIL',
        message: 'Firebase app is not initialized',
        recommendation: 'Check firebaseConfig.js - ensure initializeApp() is called correctly'
      };
      diagnostics.recommendations.push('❌ CRITICAL: Firebase app not initialized');
    } else {
      const appOptions = db.app.options;
      diagnostics.tests.appInitialized = {
        status: 'PASS',
        message: 'Firebase app is initialized',
        details: {
          projectId: appOptions.projectId || 'NOT FOUND',
          authDomain: appOptions.authDomain || 'NOT FOUND',
          apiKey: appOptions.apiKey ? `${appOptions.apiKey.substring(0, 10)}...` : 'NOT FOUND'
        }
      };
      console.log('✅ Test 2: Firebase app initialized');
      
      if (!appOptions.projectId) {
        diagnostics.recommendations.push('⚠️ WARNING: Project ID not found in config');
      }
    }
  } catch (error) {
    diagnostics.tests.appInitialized = {
      status: 'ERROR',
      message: error.message,
      error: error.toString()
    };
  }

  // Test 3: Test basic Firestore connection (try to read a test document)
  try {
    console.log('🔄 Test 3: Testing Firestore connection...');
    const testCollection = collection(db, '_test_connection');
    const testSnapshot = await getDocs(testCollection);
    diagnostics.tests.connectionTest = {
      status: 'PASS',
      message: 'Successfully connected to Firestore',
      details: { documentCount: testSnapshot.docs.length }
    };
    console.log('✅ Test 3: Firestore connection successful');
  } catch (error) {
    const errorCode = error.code || 'UNKNOWN';
    const errorMessage = error.message || 'Unknown error';
    
    diagnostics.tests.connectionTest = {
      status: 'FAIL',
      message: `Connection failed: ${errorMessage}`,
      errorCode: errorCode,
      error: error.toString()
    };

    // Provide specific recommendations based on error code
    if (errorCode === 'permission-denied') {
      diagnostics.recommendations.push('🔒 PERMISSION DENIED: Check Firestore security rules');
      diagnostics.recommendations.push('   → Go to Firebase Console → Firestore Database → Rules');
      diagnostics.recommendations.push('   → Add: allow read: if true;');
      diagnostics.recommendations.push('   → Click "Publish"');
    } else if (errorCode === 'unavailable' || errorCode === 'deadline-exceeded') {
      diagnostics.recommendations.push('🌐 CONNECTION UNAVAILABLE: Check network connectivity');
      diagnostics.recommendations.push('   → Check your internet connection');
      diagnostics.recommendations.push('   → Check if Firebase project is active');
      diagnostics.recommendations.push('   → Try refreshing the page');
    } else if (errorCode === 'failed-precondition') {
      diagnostics.recommendations.push('⚠️ DATABASE NOT INITIALIZED: Create Firestore database');
      diagnostics.recommendations.push('   → Go to Firebase Console → Firestore Database');
      diagnostics.recommendations.push('   → Click "Create database"');
      diagnostics.recommendations.push('   → Choose location and start in test mode');
    } else if (errorCode === 'invalid-argument') {
      diagnostics.recommendations.push('❌ INVALID ARGUMENT: Check Firebase configuration');
      diagnostics.recommendations.push('   → Verify firebaseConfig.js has correct values');
      diagnostics.recommendations.push('   → Check for typos in projectId, apiKey, etc.');
    } else {
      diagnostics.recommendations.push(`❌ UNKNOWN ERROR (${errorCode}): ${errorMessage}`);
      diagnostics.recommendations.push('   → Check browser console for more details');
      diagnostics.recommendations.push('   → Verify Firebase project is active');
    }
    
    console.error('❌ Test 3: Firestore connection failed:', errorCode, errorMessage);
  }

  // Test 4: Check if fishes collection exists and is accessible
  try {
    console.log('🔄 Test 4: Testing fishes collection access...');
    const fishesRef = collection(db, COLLECTIONS.FISHES);
    const fishesSnapshot = await getDocs(fishesRef);
    
    diagnostics.tests.fishesCollection = {
      status: 'PASS',
      message: `Fishes collection accessible with ${fishesSnapshot.docs.length} documents`,
      details: {
        documentCount: fishesSnapshot.docs.length,
        collectionName: COLLECTIONS.FISHES
      }
    };
    
    if (fishesSnapshot.docs.length === 0) {
      diagnostics.recommendations.push('⚠️ Fishes collection is empty - will use fallback JSON data');
      diagnostics.recommendations.push('   → Data will be automatically migrated from JSON on first run');
    }
    
    console.log(`✅ Test 4: Fishes collection accessible (${fishesSnapshot.docs.length} documents)`);
  } catch (error) {
    const errorCode = error.code || 'UNKNOWN';
    diagnostics.tests.fishesCollection = {
      status: 'FAIL',
      message: `Cannot access fishes collection: ${error.message}`,
      errorCode: errorCode,
      error: error.toString()
    };
    
    if (errorCode === 'permission-denied') {
      diagnostics.recommendations.push('🔒 PERMISSION DENIED on fishes collection');
      diagnostics.recommendations.push('   → Update Firestore rules to allow read access');
    }
    
    console.error('❌ Test 4: Cannot access fishes collection:', errorCode, error.message);
  }

  // Test 5: Check network connectivity
  try {
    const response = await fetch('https://www.google.com/favicon.ico', { 
      method: 'HEAD', 
      mode: 'no-cors',
      cache: 'no-cache'
    });
    diagnostics.tests.networkConnectivity = {
      status: 'PASS',
      message: 'Network connectivity confirmed'
    };
    console.log('✅ Test 5: Network connectivity OK');
  } catch (error) {
    diagnostics.tests.networkConnectivity = {
      status: 'FAIL',
      message: 'Network connectivity issue detected',
      error: error.toString()
    };
    diagnostics.recommendations.push('🌐 NETWORK ISSUE: Check your internet connection');
    console.error('❌ Test 5: Network connectivity issue');
  }

  // Determine overall status
  const failedTests = Object.values(diagnostics.tests).filter(test => test.status === 'FAIL');
  const errorTests = Object.values(diagnostics.tests).filter(test => test.status === 'ERROR');
  
  if (errorTests.length > 0) {
    diagnostics.overallStatus = 'ERROR';
  } else if (failedTests.length > 0) {
    diagnostics.overallStatus = 'FAIL';
  } else {
    diagnostics.overallStatus = 'PASS';
  }

  // Log summary
  console.log('📊 ========== DIAGNOSTICS SUMMARY ==========');
  console.log(`Overall Status: ${diagnostics.overallStatus}`);
  console.log('Test Results:');
  Object.entries(diagnostics.tests).forEach(([testName, result]) => {
    const icon = result.status === 'PASS' ? '✅' : result.status === 'FAIL' ? '❌' : '⚠️';
    console.log(`  ${icon} ${testName}: ${result.status} - ${result.message}`);
  });
  
  if (diagnostics.recommendations.length > 0) {
    console.log('\n📋 Recommendations:');
    diagnostics.recommendations.forEach(rec => console.log(`  ${rec}`));
  }
  
  console.log('🔍 ========== FIRESTORE DIAGNOSTICS END ==========');

  return diagnostics;
};

/**
 * Load all data from Firestore
 * Falls back to JSON if Firestore is empty
 */
export const loadFishDataFromFirestore = async () => {
  try {
    console.log('🔄 ========== STARTING FIRESTORE DATA LOAD ==========');

    // Skip diagnostics here: they duplicate the fishes read and add a Google probe.
    
    // Validate db is initialized
    if (!db) {
      console.error('❌ CRITICAL: Firestore db is not initialized!');
      console.error('❌ This means firebaseConfig.js did not export db properly');
      throw new Error('Firestore database not initialized. Check firebaseConfig.js');
    }
    
    console.log('✅ db object exists:', typeof db);
    
    // Check Firebase app initialization
    if (!db.app) {
      console.error('❌ CRITICAL: Firebase app is not initialized!');
      console.error('❌ This means Firebase initializeApp() failed or db was not created correctly');
      throw new Error('Firebase app not initialized. Check firebaseConfig.js');
    }
    
    console.log('✅ Firebase app is initialized');
    
    // Log Firebase config details
    try {
      const config = {
        projectId: db.app?.options?.projectId || 'NOT FOUND',
        authDomain: db.app?.options?.authDomain || 'NOT FOUND',
        databaseURL: db.app?.options?.databaseURL || 'NOT FOUND',
        apiKey: db.app?.options?.apiKey ? `${db.app.options.apiKey.substring(0, 10)}...` : 'NOT FOUND'
      };
      console.log('📋 Firebase Config:', config);
      
      if (config.projectId === 'NOT FOUND') {
        console.error('❌ WARNING: Project ID not found in Firebase config');
      }
    } catch (configError) {
      console.error('❌ Error reading Firebase config:', configError);
    }
    
    // Start independent reads together. Fishes failure still throws after
    // the existing error handling; supporting reads catch and continue.
    const fishesPromise = (async () => {
      console.log(`🔄 Attempting to load from collection: "${COLLECTIONS.FISHES}"`);
      console.log('🔄 Calling getDocs(collection(db, "fishes"))...');
      const fishesSnapshot = await getDocs(collection(db, COLLECTIONS.FISHES));
      console.log(`✅ getDocs completed successfully`);
      console.log(`📊 Firestore: Found ${fishesSnapshot.docs.length} documents in 'fishes' collection`);

      if (fishesSnapshot.docs.length === 0) {
        console.log('⚠️ WARNING: Fishes collection exists but is empty');
      }

      const mappedFishes = fishesSnapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        const docId = docSnapshot.id;

        // Canonical identity for Firestore operations is the document ID.
        // data.id is a legacy catalog field only — never parseInt(docId).

        // Map Firestore document to app structure
        return {
          id: docId,
          name: data.name || '',
          category: data.category || '',
          rate: data.rate || 0,
          unit: data.unit || 'KG',
          image: data.image || '',
          available: data.available !== undefined ? data.available : (data.inStock !== undefined ? data.inStock : true),
          inStock: data.available !== undefined ? data.available : (data.inStock !== undefined ? data.inStock : true),
          Fish_description: data.Fish_description || data.description || '',
          Other_info: data.Other_info || '',
          description: data.Fish_description || data.description || '',
          rateHistory: data.rateHistory || []
        };
      });

      console.log(`✅ Successfully mapped ${mappedFishes.length} fish documents`);
      return mappedFishes;
    })();

    const reviewsPromise = (async () => {
      try {
        console.log(`🔄 Loading reviews from collection: "${COLLECTIONS.REVIEWS}"`);
        const reviewsSnapshot = await getDocs(collection(db, COLLECTIONS.REVIEWS));
        const loadedReviews = reviewsSnapshot.docs.map(doc => ({
          id: doc.data().id || parseInt(doc.id) || doc.id,
          ...doc.data()
        })).sort((a, b) => {
          const dateA = new Date(a.date || a.createdAt || 0).getTime();
          const dateB = new Date(b.date || b.createdAt || 0).getTime();
          if (dateB !== dateA) return dateB - dateA;
          const idA = typeof a.id === 'number' ? a.id : parseInt(a.id, 10) || 0;
          const idB = typeof b.id === 'number' ? b.id : parseInt(b.id, 10) || 0;
          return idB - idA;
        });
        console.log(`📊 Firestore: Found ${loadedReviews.length} reviews`);
        return loadedReviews;
      } catch (reviewsError) {
        console.error('❌ Error fetching reviews:', reviewsError);
        console.log('⚠️ Continuing without reviews...');
        return [];
      }
    })();

    const configPromise = (async () => {
      try {
        console.log(`🔄 Loading config from: "${COLLECTIONS.CONFIG}/app"`);
        const configDoc = await getDoc(doc(db, COLLECTIONS.CONFIG, "app"));
        const loadedConfig = configDoc.exists() ? configDoc.data() : null;
        if (loadedConfig) {
          console.log('📊 Firestore: Config document found');
        } else {
          console.log('⚠️ Firestore: Config document not found (using fallback)');
        }
        return loadedConfig;
      } catch (configError) {
        console.error('❌ Error fetching config:', configError);
        console.log('⚠️ Continuing without config (using fallback)...');
        return null;
      }
    })();

    const shopSettingPromise = (async () => {
      try {
        return await loadShopSettingFromFirestore();
      } catch (error) {
        console.log('⚠️ Could not load shopSetting, will use config fallback');
        return null;
      }
    })();

    const promotionBannerPromise = (async () => {
      try {
        return await loadPromotionBannerFromFirestore();
      } catch (error) {
        console.log('⚠️ Could not load promotionBanner, will use config fallback');
        return null;
      }
    })();

    const discountSettingsPromise = (async () => {
      try {
        return await loadDiscountSettingsFromFirestore();
      } catch (error) {
        console.log('⚠️ Could not load discountSettings, will use config fallback');
        return null;
      }
    })();

    const offersPromise = (async () => {
      try {
        return await loadOffersFromFirestore();
      } catch (error) {
        console.log('⚠️ Could not load offers, continuing with empty list');
        return [];
      }
    })();

    let fishes = [];
    try {
      fishes = await fishesPromise;
    } catch (fetchError) {
      console.error('❌ ========== ERROR FETCHING FISHES ==========');
      console.error('❌ Error fetching fishes collection:', fetchError);
      console.error('❌ Error type:', fetchError.constructor.name);
      console.error('❌ Error details:', {
        code: fetchError.code || 'NO CODE',
        message: fetchError.message || 'NO MESSAGE',
        name: fetchError.name || 'NO NAME',
        stack: fetchError.stack?.substring(0, 500) || 'NO STACK'
      });

      // Provide specific guidance based on error code
      const errorCode = fetchError.code || 'UNKNOWN';
      if (errorCode === 'permission-denied') {
        console.error('🔒 ========== PERMISSION DENIED ==========');
        console.error('   → Go to Firebase Console → Firestore Database → Rules');
        console.error('   → Update rules to allow read access:');
        console.error('   rules_version = \'2\';');
        console.error('   service cloud.firestore {');
        console.error('     match /databases/{database}/documents {');
        console.error('       match /{document=**} {');
        console.error('         allow read: if true;');
        console.error('       }');
        console.error('     }');
        console.error('   }');
        console.error('   → Click "Publish" to save rules');
      } else if (errorCode === 'unavailable' || errorCode === 'deadline-exceeded') {
        console.error('🌐 ========== CONNECTION UNAVAILABLE ==========');
        console.error('   → Check your internet connection');
        console.error('   → Check if Firebase project is active');
        console.error('   → Check if Firestore database is created');
        console.error('   → Try refreshing the page');
      } else if (errorCode === 'failed-precondition') {
        console.error('⚠️ ========== DATABASE NOT INITIALIZED ==========');
        console.error('   → Go to Firebase Console → Firestore Database');
        console.error('   → Click "Create database"');
        console.error('   → Choose location (closest to your users)');
        console.error('   → Select "Start in test mode" for development');
      } else if (errorCode === 'invalid-argument') {
        console.error('❌ ========== INVALID CONFIGURATION ==========');
        console.error('   → Verify firebaseConfig.js has correct values');
        console.error('   → Check projectId, apiKey, authDomain for typos');
        console.error('   → Ensure all fields are properly formatted');
      } else {
        console.error(`❌ ========== UNKNOWN ERROR (${errorCode}) ==========`);
        console.error('   → Check browser console for more details');
        console.error('   → Verify Firebase project is active');
        console.error('   → Check Firebase Console for any service issues');
      }

      // Run diagnostics again to get more detailed info
      try {
        console.log('🔄 Running diagnostics to get detailed error information...');
        const diagnostics = await runFirestoreDiagnostics();
        console.log('📊 Diagnostic results:', diagnostics);
      } catch (diagError) {
        console.warn('⚠️ Could not run diagnostics:', diagError);
      }

      throw fetchError; // Re-throw to be caught by outer catch
    }

    // Log sample of loaded data for debugging
    if (fishes.length > 0) {
      console.log('📊 Sample Firestore data:', {
        count: fishes.length,
        firstFew: fishes.slice(0, 5).map(f => ({ name: f.name, id: f.id, idType: typeof f.id }))
      });
      console.log('✅ Fetched fish:', fishes.length, 'items loaded successfully');
    } else {
      console.log('⚠️ No fish data found in Firestore (collection may be empty)');
    }

    const [
      reviews,
      config,
      shopSetting,
      promotionBanner,
      discountSettings,
      offers,
    ] = await Promise.all([
      reviewsPromise,
      configPromise,
      shopSettingPromise,
      promotionBannerPromise,
      discountSettingsPromise,
      offersPromise,
    ]);

    // If no data in Firestore, use JSON fallback and initialize Firestore
    if (fishes.length === 0 && !config) {
      console.log("📦 ========== FIRESTORE IS EMPTY ==========");
      console.log("📦 Firestore is empty, loading from JSON fallback and initializing Firestore...");
      try {
        await initializeFirestoreFromJSON(fishDataFallback);
        console.log("✅ Firestore initialized with JSON data, reloading...");
        // Reload after initialization
        return await loadFishDataFromFirestore();
      } catch (initError) {
        console.error('❌ Error initializing Firestore:', initError);
        console.log('⚠️ Falling back to JSON data without initialization');
      }
    }

    const rawShopInfo = shopSetting
      ? { ...shopSetting }
      : (config?.shopInfo || fishDataFallback.shopInfo);

    // Build data structure with new collections (preferred) or fallback to config
    const data = {
      fishes: fishes.length > 0 ? deduplicateFish(fishes) : (config?.fishes || fishDataFallback.fishes),
      reviews: reviews.length > 0 ? reviews : (config?.reviews || fishDataFallback.reviews),
      // Shop info: prefer shopSetting collection, fallback to config, then fallback JSON
      shopInfo: {
        ...rawShopInfo,
        deliveryCharge: normalizeDeliveryChargeRupees(rawShopInfo?.deliveryCharge),
      },
      // Promotions: prefer promotionBanner collection, fallback to config, then fallback JSON
      promotions: promotionBanner ? { ...promotionBanner } : (config?.promotions || fishDataFallback.promotions),
      // Discount settings: prefer discountSettings collection, fallback to config, then fallback JSON
      discountSettings: discountSettings ? { ...discountSettings } : (config?.discountSettings || fishDataFallback.discountSettings),
      offers: Array.isArray(offers) ? offers : []
    };

    // Ensure fishes are deduplicated
    if (data.fishes) {
      data.fishes = deduplicateFish(data.fishes);
    }

    console.log("✅ ========== FIRESTORE DATA LOAD COMPLETE ==========");
    console.log("✅ Loaded data from Firestore:", {
      fishes: data.fishes.length,
      reviews: data.reviews.length,
      hasShopInfo: !!data.shopInfo,
      hasPromotions: !!data.promotions,
      hasDiscountSettings: !!data.discountSettings,
      offers: data.offers?.length || 0
    });
    
    // Log source of data
    if (fishes.length > 0) {
      console.log('📊 Data source: FISHES from Firestore collection');
    } else if (config?.fishes) {
      console.log('📊 Data source: FISHES from Firestore config document');
    } else {
      console.log('📊 Data source: FISHES from JSON fallback');
    }

    return data;
  } catch (error) {
    // Check if this is a SyntaxError (JSON parsing issue)
    console.error('❌ ========== FIRESTORE LOAD ERROR ==========');
    
    if (error instanceof SyntaxError || error.name === 'SyntaxError') {
      console.error("❌ JSON Parse Error:", error.message);
      console.error("   This usually means:");
      console.error("   1. Firebase config has invalid characters (check for semicolons)");
      console.error("   2. A response is being parsed as JSON incorrectly");
      console.error("   3. Firestore data contains invalid JSON strings");
      console.error("   Error details:", {
        message: error.message,
        name: error.name,
        stack: error.stack?.substring(0, 300)
      });
    } else {
      console.error("❌ Error loading from Firestore:", error);
      console.error("❌ Error type:", error.constructor.name);
      console.error("❌ Error details:", {
        message: error.message,
        code: error.code || 'NO CODE',
        name: error.name,
        stack: error.stack?.substring(0, 500)
      });
      
      // Provide specific error guidance
      if (error.code === 'permission-denied') {
        console.error("🔒 PERMISSION DENIED: Check your Firestore security rules");
        console.error("   Go to Firebase Console → Firestore Database → Rules");
        console.error("   Make sure rules allow read access");
      } else if (error.code === 'unavailable') {
        console.error("🌐 UNAVAILABLE: Firestore service is unavailable");
        console.error("   Check your internet connection");
        console.error("   Check if Firebase project is active");
      } else if (error.code === 'failed-precondition') {
        console.error("⚠️ FAILED PRECONDITION: Firestore may not be initialized");
        console.error("   Go to Firebase Console → Firestore Database → Create database");
      } else if (error.message?.includes('firebase')) {
        console.error("🔥 FIREBASE ERROR: Check Firebase configuration");
        console.error("   Verify firebaseConfig.js has correct credentials");
      }
    }
    
    console.log("📦 ========== FALLING BACK TO JSON DATA ==========");
    console.log("📦 Returning fallback JSON data");
    return fishDataFallback;
  }
};

/**
 * Initialize Firestore with data from JSON (one-time migration)
 */
const initializeFirestoreFromJSON = async (jsonData) => {
  try {
    console.log("🔄 Initializing Firestore with JSON data...");
    
    // Add fishes - map to Firestore structure
    for (const fish of jsonData.fishes) {
      const firestoreDoc = {
        name: fish.name || '',
        category: fish.category || '',
        rate: parseInt(fish.rate) || 0,
        unit: (fish.unit || 'KG').toUpperCase(),
        image: fish.image || '',
        available: fish.available !== undefined ? fish.available : (fish.inStock !== undefined ? fish.inStock : true),
        Fish_description: fish.Fish_description || fish.description || '',
        Other_info: fish.Other_info || ''
      };
      await addDoc(collection(db, COLLECTIONS.FISHES), firestoreDoc);
    }

    // Add reviews
    for (const review of jsonData.reviews) {
      await addDoc(collection(db, COLLECTIONS.REVIEWS), review);
    }

    // Save config
    await setDoc(doc(db, COLLECTIONS.CONFIG, "app"), {
      shopInfo: jsonData.shopInfo,
      promotions: jsonData.promotions,
      discountSettings: jsonData.discountSettings
    });

    console.log("✅ Firestore initialized successfully!");
  } catch (error) {
    console.error("❌ Error initializing Firestore:", error);
    throw error;
  }
};

/**
 * Fish CRUD Operations
 */
export const addFish = async (fishData) => {
  try {
    // Get all fishes to determine new ID
    const fishesSnapshot = await getDocs(collection(db, COLLECTIONS.FISHES));
    const existingIds = fishesSnapshot.docs.map(doc => {
      const data = doc.data();
      return parseInt(data.id) || parseInt(doc.id) || 0;
    });
    const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
    const newId = maxId + 1;

    // Map to Firestore document structure
    const firestoreDoc = {
      id: newId, // Store the ID in the document data for easier lookup
      name: fishData.name || '',
      category: fishData.category || '',
      rate: parseInt(fishData.rate) || 0,
      unit: fishData.unit?.toUpperCase() || 'KG',
      image: fishData.image || '',
      available: fishData.available !== undefined ? fishData.available : (fishData.inStock !== undefined ? fishData.inStock : true),
      Fish_description: fishData.Fish_description || fishData.description || '',
      Other_info: fishData.Other_info || ''
    };

    await addDoc(collection(db, COLLECTIONS.FISHES), firestoreDoc);
    console.log("✅ Fish added to Firestore:", firestoreDoc);
    return { ...fishData, id: newId };
  } catch (error) {
    console.error("❌ Error adding fish:", error);
    throw error;
  }
};

export const updateFish = async (fishId, updatedData) => {
  try {
    console.log(`🔄 Starting single-record update for fish ID: ${fishId}`);
    
    // Find the document reference first
    let fishDocRef = null;
    let documentId = null;
    
    // Try to use fishId as direct document ID first (most efficient)
    try {
      const directDocRef = doc(db, COLLECTIONS.FISHES, fishId.toString());
      const directDoc = await getDoc(directDocRef);
      if (directDoc.exists()) {
        fishDocRef = directDocRef;
        documentId = directDoc.id;
        console.log(`✅ Found document by direct ID: ${documentId}`);
      }
    } catch (e) {
      // Document doesn't exist with that ID, continue to search
      console.log(`⚠️ Document not found by direct ID, searching by data.id field...`);
    }

    // If not found by direct ID, search by data.id field
    if (!fishDocRef) {
      console.log(`🔄 Searching for document with data.id = ${fishId}...`);
      const fishesSnapshot = await getDocs(collection(db, COLLECTIONS.FISHES));
      const fishDoc = fishesSnapshot.docs.find(doc => {
        const data = doc.data();
        return data.id?.toString() === fishId.toString() || doc.id === fishId.toString();
      });

      if (fishDoc) {
        fishDocRef = fishDoc.ref;
        documentId = fishDoc.id;
        console.log(`✅ Found document by data.id field: ${documentId}`);
      }
    }

    if (!fishDocRef) {
      throw new Error(`Fish with ID ${fishId} not found in Firestore`);
    }

    // Build update object - map to Firestore document structure
    // Only include fields that are explicitly provided and not undefined/null
    const firestoreUpdate = {};
    
    // Map fields from updatedData to Firestore structure
    // Only add fields that are explicitly set (not undefined/null)
    if (updatedData.name !== undefined && updatedData.name !== null && updatedData.name !== '') {
      firestoreUpdate.name = String(updatedData.name).trim();
    }
    
    if (updatedData.category !== undefined && updatedData.category !== null && updatedData.category !== '') {
      firestoreUpdate.category = String(updatedData.category).trim();
    }
    
    if (updatedData.rate !== undefined && updatedData.rate !== null) {
      const rateValue = parseInt(updatedData.rate);
      if (!isNaN(rateValue)) {
        firestoreUpdate.rate = rateValue;
      }
    }
    
    if (updatedData.unit !== undefined && updatedData.unit !== null && updatedData.unit !== '') {
      firestoreUpdate.unit = String(updatedData.unit).toUpperCase().trim();
    }
    
    if (updatedData.image !== undefined && updatedData.image !== null && updatedData.image !== '') {
      firestoreUpdate.image = String(updatedData.image).trim();
    }
    
    // Handle available/inStock - prioritize available field
    if (updatedData.available !== undefined && updatedData.available !== null) {
      firestoreUpdate.available = Boolean(updatedData.available);
    } else if (updatedData.inStock !== undefined && updatedData.inStock !== null) {
      // Support backward compatibility with inStock field
      firestoreUpdate.available = Boolean(updatedData.inStock);
    }
    
    // Handle description fields - prioritize Fish_description
    if (updatedData.Fish_description !== undefined && updatedData.Fish_description !== null) {
      firestoreUpdate.Fish_description = String(updatedData.Fish_description).trim();
    } else if (updatedData.description !== undefined && updatedData.description !== null && updatedData.description !== '') {
      // Support backward compatibility with description field
      firestoreUpdate.Fish_description = String(updatedData.description).trim();
    }
    
    if (updatedData.Other_info !== undefined && updatedData.Other_info !== null && updatedData.Other_info !== '') {
      firestoreUpdate.Other_info = String(updatedData.Other_info).trim();
    }
    
    // Handle rateHistory if provided (array field)
    if (updatedData.rateHistory !== undefined && updatedData.rateHistory !== null && Array.isArray(updatedData.rateHistory)) {
      firestoreUpdate.rateHistory = updatedData.rateHistory;
    }
    
    // Handle id field if provided (store in document data for easier lookup)
    if (updatedData.id !== undefined && updatedData.id !== null) {
      firestoreUpdate.id = typeof updatedData.id === 'number' ? updatedData.id : parseInt(updatedData.id) || updatedData.id;
    }

    // Final safety check: Remove any undefined, null, or empty string values
    // Firestore will delete fields if undefined is passed, so we filter them out
    Object.keys(firestoreUpdate).forEach(key => {
      const value = firestoreUpdate[key];
      if (value === undefined || value === null || 
          (typeof value === 'string' && value.trim() === '') ||
          (Array.isArray(value) && value.length === 0)) {
        delete firestoreUpdate[key];
      }
    });

    // Validate that we have at least one field to update
    if (Object.keys(firestoreUpdate).length === 0) {
      console.warn(`⚠️ No valid fields to update for fish ID: ${fishId}`);
      return { ...updatedData, id: fishId };
    }

    // CRITICAL: Update ONLY the specific fish document using updateDoc
    // This is a single-document update operation - no bulk updates
    // updateDoc only updates the fields provided, preserving all other existing fields
    console.log(`📝 Updating single document: ${documentId}`);
    console.log(`📝 Fields to update:`, Object.keys(firestoreUpdate));
    console.log(`📝 Update data:`, firestoreUpdate);
    
    await updateDoc(fishDocRef, firestoreUpdate);
    
    console.log(`✅ Updated Fish: ID=${fishId}, Document=${documentId}`);
    console.log(`✅ Updated fields:`, Object.keys(firestoreUpdate).join(', '));
    console.log(`✅ Single-record update completed successfully`);
    
    return { ...updatedData, id: fishId };
  } catch (error) {
    console.error(`❌ Error updating fish ID ${fishId}:`, error);
    console.error(`❌ Error details:`, {
      code: error.code,
      message: error.message,
      stack: error.stack?.substring(0, 300)
    });
    throw error;
  }
};

export const deleteFish = async (fishId) => {
  try {
    // Find the document - check both document ID and data.id field
    const fishesSnapshot = await getDocs(collection(db, COLLECTIONS.FISHES));
    const fishDoc = fishesSnapshot.docs.find(doc => {
      const data = doc.data();
      return data.id?.toString() === fishId.toString() || doc.id === fishId.toString();
    });

    if (fishDoc) {
      await deleteDoc(fishDoc.ref);
      console.log("✅ Fish deleted from Firestore:", fishId);
    } else {
      throw new Error(`Fish with ID ${fishId} not found`);
    }
  } catch (error) {
    console.error("❌ Error deleting fish:", error);
    throw error;
  }
};

/**
 * Update multiple fishes (bulk operations)
 */
export const updateMultipleFishes = async (updates) => {
  try {
    const fishesSnapshot = await getDocs(collection(db, COLLECTIONS.FISHES));
    const updatesPromises = updates.map(({ id, data }) => {
      const fishDoc = fishesSnapshot.docs.find(doc => 
        doc.data().id === id.toString() || doc.id === id.toString()
      );
      if (fishDoc) {
        return updateDoc(fishDoc.ref, { ...data, id: id.toString() });
      }
    });
    
    await Promise.all(updatesPromises.filter(Boolean));
    console.log("✅ Multiple fishes updated in Firestore");
  } catch (error) {
    console.error("❌ Error updating multiple fishes:", error);
    throw error;
  }
};

/**
 * Config Operations (shopInfo, promotions, discountSettings)
 */
export const updateShopInfo = async (shopInfo) => {
  try {
    const configRef = doc(db, COLLECTIONS.CONFIG, "app");
    const configDoc = await getDoc(configRef);
    
    if (configDoc.exists()) {
      const currentConfig = configDoc.data();
      await updateDoc(configRef, {
        ...currentConfig,
        shopInfo: {
          ...shopInfo,
          updatedOn: new Date().toISOString()
        }
      });
    } else {
      await setDoc(configRef, { shopInfo });
    }
    console.log("✅ Shop info updated in Firestore");
  } catch (error) {
    console.error("❌ Error updating shop info:", error);
    throw error;
  }
};

export const updatePromotions = async (promotions) => {
  try {
    const configRef = doc(db, COLLECTIONS.CONFIG, "app");
    const configDoc = await getDoc(configRef);
    
    if (configDoc.exists()) {
      await updateDoc(configRef, { promotions });
    } else {
      await setDoc(configRef, { promotions });
    }
    console.log("✅ Promotions updated in Firestore");
  } catch (error) {
    console.error("❌ Error updating promotions:", error);
    throw error;
  }
};

export const updateDiscountSettings = async (discountSettings) => {
  try {
    const configRef = doc(db, COLLECTIONS.CONFIG, "app");
    const configDoc = await getDoc(configRef);
    
    if (configDoc.exists()) {
      await updateDoc(configRef, { discountSettings });
    } else {
      await setDoc(configRef, { discountSettings });
    }
    console.log("✅ Discount settings updated in Firestore");
  } catch (error) {
    console.error("❌ Error updating discount settings:", error);
    throw error;
  }
};

/**
 * Reviews Operations
 */
export const addReview = async (review) => {
  try {
    await addDoc(collection(db, COLLECTIONS.REVIEWS), review);
    console.log("✅ Review added to Firestore");
    return review;
  } catch (error) {
    console.error("❌ Error adding review:", error);
    throw error;
  }
};

export const updateReviews = async (reviews) => {
  try {
    // Delete all existing reviews
    const reviewsSnapshot = await getDocs(collection(db, COLLECTIONS.REVIEWS));
    const deletePromises = reviewsSnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deletePromises);

    // Add all reviews
    const addPromises = reviews.map(review => addDoc(collection(db, COLLECTIONS.REVIEWS), review));
    await Promise.all(addPromises);

    console.log("✅ Reviews updated in Firestore");
  } catch (error) {
    console.error("❌ Error updating reviews:", error);
    throw error;
  }
};

/**
 * Complete data update (bulk operation - used sparingly)
 * Note: Individual operations (updateFish, addFish, deleteFish) are preferred
 */
export const updateAllFishData = async (fishData) => {
  try {
    // Update fishes
    const existingFishes = await getDocs(collection(db, COLLECTIONS.FISHES));
    const existingFishDocs = existingFishes.docs;

    // Delete all existing fishes
    for (const docSnapshot of existingFishDocs) {
      await deleteDoc(docSnapshot.ref);
    }

    // Add all fishes - map to Firestore structure
    for (const fish of fishData.fishes) {
      const firestoreDoc = {
        id: fish.id || parseInt(fish.id) || 0, // Store the ID in the document data
        name: fish.name || '',
        category: fish.category || '',
        rate: parseInt(fish.rate) || 0,
        unit: (fish.unit || 'KG').toUpperCase(),
        image: fish.image || '',
        available: fish.available !== undefined ? fish.available : (fish.inStock !== undefined ? fish.inStock : true),
        Fish_description: fish.Fish_description || fish.description || '',
        Other_info: fish.Other_info || ''
      };
      await addDoc(collection(db, COLLECTIONS.FISHES), firestoreDoc);
    }

    // Update config
    await setDoc(doc(db, COLLECTIONS.CONFIG, "app"), {
      shopInfo: {
        ...fishData.shopInfo,
        updatedOn: new Date().toISOString()
      },
      promotions: fishData.promotions,
      discountSettings: fishData.discountSettings
    });

    // Update reviews
    await updateReviews(fishData.reviews || []);

    console.log("✅ All fish data updated in Firestore");
  } catch (error) {
    console.error("❌ Error updating all fish data:", error);
    throw error;
  }
};

/**
 * Daily Stock Operations
 */

// Load all daily stock entries from Firestore
export const loadDailyStockFromFirestore = async () => {
  try {
    const stockSnapshot = await getDocs(collection(db, COLLECTIONS.DAILY_STOCK));
    const stockEntries = stockSnapshot.docs.map(docSnapshot => ({
      id: docSnapshot.id,
      ...docSnapshot.data()
    }));
    
    console.log("✅ Loaded daily stock from Firestore:", stockEntries.length, "entries");
    return stockEntries;
  } catch (error) {
    console.error("❌ Error loading daily stock from Firestore:", error);
    return [];
  }
};

// Save daily stock entry to Firestore
export const saveDailyStockEntry = async (entry) => {
  try {
    // Check if entry already exists (by Firestore document ID or by fishId + date)
    const existingSnapshot = await getDocs(collection(db, COLLECTIONS.DAILY_STOCK));
    const existingDoc = existingSnapshot.docs.find(doc => {
      const data = doc.data();
      // Check by Firestore document ID first (most reliable)
      if (entry.id && (doc.id === entry.id.toString() || doc.id === String(entry.id))) {
        return true;
      }
      // Fallback: check by fishId + date combination
      return data.fishId?.toString() === entry.fishId?.toString() && data.date === entry.date;
    });

    const entryData = {
      fishId: entry.fishId,
      fishName: entry.fishName,
      date: entry.date,
      yesterdayNet: entry.yesterdayNet || 0,
      todayQuantity: entry.todayQuantity || 0,
      total: entry.total || 0,
      todaySale: entry.todaySale || 0,
      returnToMarket: entry.returnToMarket || 0,
      adjustQuantity: entry.adjustQuantity || 0,
      netAmount: entry.netAmount || 0,
      updatedAt: new Date().toISOString()
    };

    if (existingDoc) {
      // Update existing entry
      await updateDoc(existingDoc.ref, entryData);
      console.log("✅ Updated daily stock entry in Firestore:", existingDoc.id);
      return existingDoc.id;
    } else {
      // Create new entry
      entryData.createdAt = entry.createdAt || new Date().toISOString();
      const docRef = await addDoc(collection(db, COLLECTIONS.DAILY_STOCK), entryData);
      console.log("✅ Added daily stock entry to Firestore:", docRef.id);
      return docRef.id;
    }
  } catch (error) {
    console.error("❌ Error saving daily stock entry to Firestore:", error);
    throw error;
  }
};

// Save multiple daily stock entries to Firestore
export const saveDailyStockEntries = async (entries) => {
  try {
    const savePromises = entries.map(entry => saveDailyStockEntry(entry));
    await Promise.all(savePromises);
    console.log("✅ Saved", entries.length, "daily stock entries to Firestore");
  } catch (error) {
    console.error("❌ Error saving daily stock entries to Firestore:", error);
    throw error;
  }
};

// Delete daily stock entry from Firestore
export const deleteDailyStockEntry = async (entryId) => {
  try {
    const stockSnapshot = await getDocs(collection(db, COLLECTIONS.DAILY_STOCK));
    const entryDoc = stockSnapshot.docs.find(doc => 
      doc.id === entryId.toString() || doc.data().id === entryId.toString()
    );

    if (entryDoc) {
      await deleteDoc(entryDoc.ref);
      console.log("✅ Deleted daily stock entry from Firestore:", entryId);
    } else {
      throw new Error(`Daily stock entry with ID ${entryId} not found`);
    }
  } catch (error) {
    console.error("❌ Error deleting daily stock entry from Firestore:", error);
    throw error;
  }
};

/**
 * Rate History Operations
 * Dynamic form-to-Firestore mapping - no hardcoded fields
 */

// Add rate history entry (created when fish rate changes)
export const addRateHistoryEntry = async (rateHistoryData) => {
  try {
    // Build payload dynamically from provided data
    const payload = {
      ...rateHistoryData,
      timestamp: rateHistoryData.timestamp || new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    
    // Remove undefined/null/empty fields (preserve empty arrays if explicitly set)
    Object.keys(payload).forEach(key => {
      if (payload[key] === undefined || payload[key] === null || 
          (typeof payload[key] === 'string' && payload[key].trim() === '')) {
        delete payload[key];
      }
    });
    
    await addDoc(collection(db, COLLECTIONS.RATE_HISTORY), payload);
    console.log("✅ Rate history entry added to Firestore");
    return payload;
  } catch (error) {
    console.error("❌ Error adding rate history entry:", error);
    throw error;
  }
};

// Load all rate history entries
export const loadRateHistoryFromFirestore = async () => {
  try {
    const q = query(collection(db, COLLECTIONS.RATE_HISTORY), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    const entries = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    console.log("✅ Loaded rate history from Firestore:", entries.length, "entries");
    return entries;
  } catch (error) {
    console.error("❌ Error loading rate history from Firestore:", error);
    return [];
  }
};

/**
 * Shop Setting Operations
 * Dynamic form-to-Firestore mapping - stores single document at shopSetting/main
 */

// Save shop setting (dynamic form data)
export const saveShopSetting = async (formData) => {
  try {
    // Build payload dynamically from form data
    const payload = {
      ...formData,
      updatedAt: new Date().toISOString()
    };
    
    // Remove undefined/null fields (preserve empty strings if explicitly set)
    Object.keys(payload).forEach(key => {
      if (payload[key] === undefined || payload[key] === null) {
        delete payload[key];
      }
    });
    
    const shopSettingRef = doc(db, COLLECTIONS.SHOP_SETTING, "main");
    await setDoc(shopSettingRef, payload, { merge: true });
    console.log("✅ Shop setting saved to Firestore");
    return payload;
  } catch (error) {
    console.error("❌ Error saving shop setting:", error);
    throw error;
  }
};

// Load shop setting
export const loadShopSettingFromFirestore = async () => {
  try {
    const shopSettingDoc = await getDoc(doc(db, COLLECTIONS.SHOP_SETTING, "main"));
    if (shopSettingDoc.exists()) {
      const data = shopSettingDoc.data();
      console.log("✅ Loaded shop setting from Firestore");
      return {
        ...data,
        deliveryCharge: normalizeDeliveryChargeRupees(data?.deliveryCharge),
      };
    } else {
      console.log("⚠️ Shop setting document not found in Firestore");
      return null;
    }
  } catch (error) {
    console.error("❌ Error loading shop setting from Firestore:", error);
    return null;
  }
};

// Subscribe to shop setting changes (realtime)
export const subscribeToShopSetting = (callback) => {
  const shopSettingRef = doc(db, COLLECTIONS.SHOP_SETTING, "main");
  return onSnapshot(shopSettingRef, (docSnapshot) => {
    if (docSnapshot.exists()) {
      callback(docSnapshot.data());
    } else {
      callback(null);
    }
  }, (error) => {
    console.error("❌ Error subscribing to shop setting:", error);
    callback(null);
  });
};

/**
 * Promotion and Discounts Operations
 * Dynamic form-to-Firestore mapping - stores documents at promotionAndDiscounts/banner and promotionAndDiscounts/discount
 */

// Save promotion banner (dynamic form data)
export const savePromotionBanner = async (formData) => {
  try {
    // Build payload dynamically from form data
    const payload = {
      ...formData,
      updatedAt: new Date().toISOString()
    };
    
    // Remove undefined/null fields (preserve empty strings/arrays if explicitly set)
    Object.keys(payload).forEach(key => {
      if (payload[key] === undefined || payload[key] === null) {
        delete payload[key];
      }
    });
    
    const promotionRef = doc(db, COLLECTIONS.PROMOTION_AND_DISCOUNTS, "banner");
    await setDoc(promotionRef, payload, { merge: true });
    console.log("✅ Promotion banner saved to Firestore");
    return payload;
  } catch (error) {
    console.error("❌ Error saving promotion banner:", error);
    throw error;
  }
};

// Save discount settings (dynamic form data)
export const saveDiscountSettings = async (formData) => {
  try {
    // Build payload dynamically from form data
    const payload = {
      ...formData,
      updatedAt: new Date().toISOString()
    };
    
    // Remove undefined/null fields (preserve empty strings/arrays if explicitly set)
    Object.keys(payload).forEach(key => {
      if (payload[key] === undefined || payload[key] === null) {
        delete payload[key];
      }
    });
    
    const discountRef = doc(db, COLLECTIONS.PROMOTION_AND_DISCOUNTS, "discount");
    await setDoc(discountRef, payload, { merge: true });
    console.log("✅ Discount settings saved to Firestore");
    return payload;
  } catch (error) {
    console.error("❌ Error saving discount settings:", error);
    throw error;
  }
};

// Load promotion banner
export const loadPromotionBannerFromFirestore = async () => {
  try {
    const promotionDoc = await getDoc(doc(db, COLLECTIONS.PROMOTION_AND_DISCOUNTS, "banner"));
    if (promotionDoc.exists()) {
      const data = promotionDoc.data();
      console.log("✅ Loaded promotion banner from Firestore");
      return data;
    } else {
      console.log("⚠️ Promotion banner document not found in Firestore");
      return null;
    }
  } catch (error) {
    console.error("❌ Error loading promotion banner from Firestore:", error);
    return null;
  }
};

// Load discount settings
export const loadDiscountSettingsFromFirestore = async () => {
  try {
    const discountDoc = await getDoc(doc(db, COLLECTIONS.PROMOTION_AND_DISCOUNTS, "discount"));
    if (discountDoc.exists()) {
      const data = discountDoc.data();
      console.log("✅ Loaded discount settings from Firestore");
      return data;
    } else {
      console.log("⚠️ Discount settings document not found in Firestore");
      return null;
    }
  } catch (error) {
    console.error("❌ Error loading discount settings from Firestore:", error);
    return null;
  }
};

// Subscribe to promotion banner changes (realtime)
export const subscribeToPromotionBanner = (callback) => {
  const promotionRef = doc(db, COLLECTIONS.PROMOTION_AND_DISCOUNTS, "banner");
  return onSnapshot(promotionRef, (docSnapshot) => {
    if (docSnapshot.exists()) {
      callback(docSnapshot.data());
    } else {
      callback(null);
    }
  }, (error) => {
    console.error("❌ Error subscribing to promotion banner:", error);
    callback(null);
  });
};

// Subscribe to discount settings changes (realtime)
export const subscribeToDiscountSettings = (callback) => {
  const discountRef = doc(db, COLLECTIONS.PROMOTION_AND_DISCOUNTS, "discount");
  return onSnapshot(discountRef, (docSnapshot) => {
    if (docSnapshot.exists()) {
      callback(docSnapshot.data());
    } else {
      callback(null);
    }
  }, (error) => {
    console.error("❌ Error subscribing to discount settings:", error);
    callback(null);
  });
};

/**
 * Offers & Promotions Operations
 * Collection: offers/{offerId}
 */

const sanitizeOfferPayload = (formData = {}) => {
  const nowIso = new Date().toISOString();
  const maxUsesRaw = formData.maxUses;
  const maxUses =
    maxUsesRaw === '' || maxUsesRaw === null || maxUsesRaw === undefined
      ? null
      : Number(maxUsesRaw);

  const payload = {
    title: String(formData.title || '').trim(),
    description: String(formData.description || '').trim(),
    type: formData.type || 'general',
    bannerImage: String(formData.bannerImage || '').trim(),
    discountType: formData.discountType === 'fixed' ? 'fixed' : 'percentage',
    discountValue: Number(formData.discountValue) || 0,
    minimumOrderAmount: Number(formData.minimumOrderAmount) || 0,
    maximumDiscount: Number(formData.maximumDiscount) || 0,
    applyTo: formData.applyTo || 'entire_store',
    productIds: Array.isArray(formData.productIds)
      ? formData.productIds.map(String)
      : [],
    categoryIds: Array.isArray(formData.categoryIds)
      ? formData.categoryIds.map(String)
      : [],
    startDate: formData.startDate || '',
    startTime: formData.startTime || '00:00',
    endDate: formData.endDate || '',
    endTime: formData.endTime || '23:59',
    maxUses: Number.isFinite(maxUses) && maxUses > 0 ? maxUses : null,
    enabled: formData.enabled !== false,
    updatedAt: nowIso,
  };

  Object.keys(payload).forEach((key) => {
    if (payload[key] === undefined) delete payload[key];
  });

  return payload;
};

export const loadOffersFromFirestore = async () => {
  try {
    const offersRef = collection(db, COLLECTIONS.OFFERS);
    let snapshot;
    try {
      snapshot = await getDocs(query(offersRef, orderBy('createdAt', 'desc')));
    } catch (orderError) {
      // Fallback if createdAt index/order unavailable
      console.warn('⚠️ Offers orderBy failed, loading unordered:', orderError.message);
      snapshot = await getDocs(offersRef);
    }

    const offers = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));
    console.log(`✅ Loaded ${offers.length} offers from Firestore`);
    return offers;
  } catch (error) {
    console.error('❌ Error loading offers from Firestore:', error);
    return [];
  }
};

export const createOffer = async (formData) => {
  try {
    const payload = {
      ...sanitizeOfferPayload(formData),
      usedCount: 0,
      createdAt: new Date().toISOString(),
    };
    const docRef = await addDoc(collection(db, COLLECTIONS.OFFERS), payload);
    console.log('✅ Offer created:', docRef.id);
    return { id: docRef.id, ...payload };
  } catch (error) {
    console.error('❌ Error creating offer:', error);
    throw error;
  }
};

export const updateOffer = async (offerId, formData) => {
  try {
    if (!offerId) throw new Error('Offer ID is required');
    const payload = sanitizeOfferPayload(formData);
    // Do not reset usedCount on edit
    delete payload.usedCount;
    await updateDoc(doc(db, COLLECTIONS.OFFERS, String(offerId)), payload);
    console.log('✅ Offer updated:', offerId);
    return { id: offerId, ...payload };
  } catch (error) {
    console.error('❌ Error updating offer:', error);
    throw error;
  }
};

export const setOfferEnabled = async (offerId, enabled) => {
  try {
    await updateDoc(doc(db, COLLECTIONS.OFFERS, String(offerId)), {
      enabled: !!enabled,
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    console.error('❌ Error toggling offer:', error);
    throw error;
  }
};

/**
 * Soft-delete preferred when offer was used on orders.
 * Hard delete only when usedCount is 0.
 */
export const deleteOfferSafe = async (offer) => {
  try {
    if (!offer?.id) throw new Error('Offer ID is required');
    const usedCount = Number(offer.usedCount) || 0;
    if (usedCount > 0) {
      await updateDoc(doc(db, COLLECTIONS.OFFERS, String(offer.id)), {
        enabled: false,
        archived: true,
        updatedAt: new Date().toISOString(),
      });
      console.log('✅ Offer archived (was used):', offer.id);
      return { action: 'archived', id: offer.id };
    }
    await deleteDoc(doc(db, COLLECTIONS.OFFERS, String(offer.id)));
    console.log('✅ Offer deleted:', offer.id);
    return { action: 'deleted', id: offer.id };
  } catch (error) {
    console.error('❌ Error deleting offer:', error);
    throw error;
  }
};

/** Increment usage after a successful order / payment claim. Client-side trust model. */
export const incrementOfferUsage = async (offerId) => {
  try {
    if (!offerId) return false;
    await updateDoc(doc(db, COLLECTIONS.OFFERS, String(offerId)), {
      usedCount: increment(1),
      updatedAt: new Date().toISOString(),
    });
    console.log('✅ Offer usage incremented:', offerId);
    return true;
  } catch (error) {
    console.error('❌ Error incrementing offer usage:', error);
    return false;
  }
};

/**
 * Strip undefined values (Firestore rejects them) while preserving null/false/0.
 */
const stripUndefinedDeep = (value) => {
  if (Array.isArray(value)) {
    return value.map(stripUndefinedDeep);
  }
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out = {};
    Object.entries(value).forEach(([key, val]) => {
      if (val !== undefined) {
        out[key] = stripUndefinedDeep(val);
      }
    });
    return out;
  }
  return value;
};

/**
 * Persist a customer order to Firestore BEFORE showing success UI.
 * Uses orderId as document ID so retries with the same ID do not create duplicates.
 * @param {object} order - Locked checkout/payment snapshot
 * @returns {Promise<object>} Saved order payload (includes firestoreId)
 */
export const createCustomerOrder = async (order) => {
  if (!order?.orderId) {
    throw new Error('Order ID is required to record the order');
  }

  const ownedOrder = applyOrderCustomerOwnership(order, auth.currentUser);
  const payload = stripUndefinedDeep({
    ...ownedOrder,
    // Default fulfillment status for new orders (admin may update later)
    orderStatus: ownedOrder.orderStatus || 'Processing',
    createdAt: ownedOrder.createdAt || ownedOrder.timestamp || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  if (payload.customerUid == null) {
    delete payload.customerUid;
  } else {
    delete payload.conversionNonce;
  }
  if (!isValidConversionNonce(payload.conversionNonce)) {
    delete payload.conversionNonce;
  }

  const orderRef = doc(db, COLLECTIONS.ORDERS, String(ownedOrder.orderId));
  await setDoc(orderRef, payload, { merge: true });

  console.log('✅ Customer order recorded:', order.orderId);
  return {
    ...payload,
    firestoreId: orderRef.id,
  };
};

const sortOrdersNewestFirst = (orders) =>
  [...orders].sort((a, b) => {
    const ta = new Date(a.timestamp || a.createdAt || 0).getTime();
    const tb = new Date(b.timestamp || b.createdAt || 0).getTime();
    return tb - ta;
  });

/**
 * Load customer orders for Admin Orders module.
 * Collection: orders (same docs written by createCustomerOrder).
 */
export const getCustomerOrders = async () => {
  try {
    const ordersRef = collection(db, COLLECTIONS.ORDERS);
    let snapshot;
    try {
      snapshot = await getDocs(query(ordersRef, orderBy('timestamp', 'desc')));
    } catch (orderError) {
      console.warn('⚠️ Orders orderBy(timestamp) failed, loading unordered:', orderError.message);
      try {
        snapshot = await getDocs(query(ordersRef, orderBy('createdAt', 'desc')));
      } catch {
        snapshot = await getDocs(ordersRef);
      }
    }

    const orders = snapshot.docs.map((d) => {
      const data = d.data() || {};
      return {
        firestoreId: d.id,
        ...data,
        orderId: data.orderId || d.id,
        orderStatus: data.orderStatus || 'Processing',
      };
    });

    return sortOrdersNewestFirst(orders);
  } catch (error) {
    console.error('❌ Error loading customer orders:', error);
    throw new Error('Unable to load orders. Please try again.');
  }
};

/**
 * Update payment fields only — never touches totals, items, or UTR unless explicitly passed.
 * paymentStatus: PENDING_CONFIRMATION | VERIFIED | FAILED
 */
export const updateCustomerOrderPayment = async (orderId, paymentStatus) => {
  if (!orderId) throw new Error('Order ID is required');
  const allowed = ['PENDING_CONFIRMATION', 'VERIFIED', 'FAILED'];
  if (!allowed.includes(paymentStatus)) {
    throw new Error('Invalid payment status');
  }

  const paidVerified = paymentStatus === 'VERIFIED';
  const orderRef = doc(db, COLLECTIONS.ORDERS, String(orderId));
  await updateDoc(orderRef, {
    paymentStatus,
    paidVerified,
    updatedAt: new Date().toISOString(),
  });

  return { orderId: String(orderId), paymentStatus, paidVerified };
};

/**
 * Update fulfillment orderStatus only — never touches financial snapshot.
 */
export const updateCustomerOrderStatus = async (orderId, orderStatus) => {
  if (!orderId) throw new Error('Order ID is required');
  const allowed = [
    'Processing',
    'Preparing',
    'Out for Delivery',
    'Delivered',
    'Cancelled',
  ];
  if (!allowed.includes(orderStatus)) {
    throw new Error('Invalid order status');
  }

  const orderRef = doc(db, COLLECTIONS.ORDERS, String(orderId));
  await updateDoc(orderRef, {
    orderStatus,
    updatedAt: new Date().toISOString(),
  });

  return { orderId: String(orderId), orderStatus };
};

/**
 * Bulk Fish Rate Update Operations
 * Uses Firestore batch writes for atomic updates with rollback
 */

/**
 * Bulk update fish rates and availability using Firestore batch write
 * @param {Array<{fishId: string|number, rate: number, available: boolean}>} updates - Array of fish updates
 * @param {string} adminUser - Admin user identifier (email or name)
 * @param {number} maxRetries - Maximum retry attempts (default: 3)
 * @returns {Promise<{success: boolean, updated: number, errors: Array, fishNames: Array}>}
 */
export const bulkUpdateFishRates = async (updates, adminUser = 'admin', maxRetries = 3) => {
  let attempt = 0;
  let lastError = null;

  while (attempt < maxRetries) {
    try {
      console.log(`🔄 Bulk update attempt ${attempt + 1}/${maxRetries}`);
      
      // Validate updates
      const validatedUpdates = [];
      for (const update of updates) {
        if (!update.fishId) {
          throw new Error(`Invalid update: missing fishId`);
        }
        if (update.rate !== undefined && (isNaN(update.rate) || update.rate < 0)) {
          throw new Error(`Invalid rate for fish ${update.fishId}: ${update.rate}`);
        }
        if (update.available !== undefined && typeof update.available !== 'boolean') {
          throw new Error(`Invalid availability for fish ${update.fishId}: must be boolean`);
        }
        validatedUpdates.push(update);
      }

      if (validatedUpdates.length === 0) {
        throw new Error('No valid updates to process');
      }

      // Create batch
      const batch = writeBatch(db);
      const updatedFishNames = [];
      const fishDocRefs = [];

      // First, find all document references
      const fishesSnapshot = await getDocs(collection(db, COLLECTIONS.FISHES));
      const fishDocsMap = new Map();
      fishesSnapshot.docs.forEach((docSnap) => {
        const data = docSnap.data();
        const entry = { ref: docSnap.ref, data };
        // Primary key: real Firestore document ID
        fishDocsMap.set(docSnap.id, entry);
        // Legacy data.id may still appear in older UI state; never overwrite a real doc.id key
        if (data.id !== undefined && data.id !== null && data.id !== '') {
          const legacyId = String(data.id);
          if (legacyId && !fishDocsMap.has(legacyId)) {
            fishDocsMap.set(legacyId, entry);
          }
        }
      });

      // Prepare batch updates
      for (const update of validatedUpdates) {
        const fishIdStr = String(update.fishId);
        const fishDoc = fishDocsMap.get(fishIdStr);

        if (!fishDoc) {
          throw new Error(`Fish with ID ${fishIdStr} not found in Firestore`);
        }

        const updateData = {};
        
        if (update.rate !== undefined) {
          updateData.rate = parseFloat(update.rate);
        }
        
        if (update.available !== undefined) {
          updateData.available = Boolean(update.available);
          // Also update inStock for backward compatibility
          updateData.inStock = Boolean(update.available);
        }
        
        // Add timestamp
        updateData.updatedAt = serverTimestamp();

        // Add to batch
        batch.update(fishDoc.ref, updateData);
        updatedFishNames.push(fishDoc.data.name || fishIdStr);
        fishDocRefs.push(fishDoc.ref);
      }

      // Commit batch (atomic operation - all or nothing)
      await batch.commit();
      
      console.log(`✅ Batch update successful: ${validatedUpdates.length} fish updated`);

      // Log to AdminLogs collection
      try {
        const logEntry = {
          adminUser: adminUser,
          timestamp: serverTimestamp(),
          updatedRecords: updatedFishNames,
          recordCount: validatedUpdates.length,
          status: 'success',
          operation: 'bulk_rate_update'
        };
        await addDoc(collection(db, COLLECTIONS.ADMIN_LOGS), logEntry);
        console.log('✅ Admin log entry created');
      } catch (logError) {
        console.warn('⚠️ Failed to create admin log entry (non-critical):', logError);
        // Don't fail the whole operation if logging fails
      }

      return {
        success: true,
        updated: validatedUpdates.length,
        errors: [],
        fishNames: updatedFishNames
      };

    } catch (error) {
      lastError = error;
      attempt++;
      console.error(`❌ Batch update attempt ${attempt} failed:`, error);
      
      if (attempt < maxRetries) {
        // Wait before retry (exponential backoff)
        const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`⏳ Retrying in ${waitTime}ms...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  // All retries failed - log error
  try {
    const logEntry = {
      adminUser: adminUser,
      timestamp: serverTimestamp(),
      updatedRecords: [],
      recordCount: updates.length,
      status: 'failed',
      operation: 'bulk_rate_update',
      error: lastError?.message || 'Unknown error'
    };
    await addDoc(collection(db, COLLECTIONS.ADMIN_LOGS), logEntry);
  } catch (logError) {
    console.warn('⚠️ Failed to create error log entry:', logError);
  }

  // Return error result
  return {
    success: false,
    updated: 0,
    errors: [lastError?.message || 'Batch update failed after all retries'],
    fishNames: []
  };
};

/**
 * Load admin logs
 * @param {number} limit - Maximum number of logs to return (default: 50)
 * @returns {Promise<Array>}
 */
export const loadAdminLogs = async (limit = 50) => {
  try {
    const q = query(collection(db, COLLECTIONS.ADMIN_LOGS), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    const logs = snapshot.docs.slice(0, limit).map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    console.log(`✅ Loaded ${logs.length} admin logs`);
    return logs;
  } catch (error) {
    console.error('❌ Error loading admin logs:', error);
    return [];
  }
};

