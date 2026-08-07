# Firebase Firestore Setup Guide

## ✅ Integration Complete!

Your React fish website is now connected to Firebase Firestore. All fish data (fishes, reviews, shop info, promotions) is now managed through Firestore instead of the local JSON file.

## 🔧 Configuration Steps

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add Project" or select an existing project
3. Follow the setup wizard

### 2. Get Your Firebase Config

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll down to **"Your apps"** section
3. Click on the **Web** icon (`</>`) to add a web app
4. Register your app (give it a nickname)
5. Copy the Firebase SDK configuration object

### 3. Update `src/firebaseConfig.js`

Replace the placeholder values in `src/firebaseConfig.js`:

```javascript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",                    // ← Replace this
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",  // ← Replace this
  projectId: "YOUR_PROJECT_ID",              // ← Replace this
  storageBucket: "YOUR_PROJECT_ID.appspot.com",    // ← Replace this
  messagingSenderId: "YOUR_SENDER_ID",        // ← Replace this
  appId: "YOUR_APP_ID"                       // ← Replace this
};
```

**Example:**
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyC1234567890abcdefghijklmnopqrstuv",
  authDomain: "my-fish-shop.firebaseapp.com",
  projectId: "my-fish-shop",
  storageBucket: "my-fish-shop.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};
```

### 4. Set Up Firestore Database

1. In Firebase Console, go to **Firestore Database**
2. Click **"Create database"**
3. Choose **"Start in test mode"** (for development)
   - Or configure security rules if you prefer production mode
4. Select a location for your database (choose closest to your users)

### 5. Configure Firestore Security Rules (Recommended)

Go to **Firestore Database** → **Rules** and add:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read for everyone (public data)
    match /{document=**} {
      allow read: if true;
    }
    
    // Allow write only for authenticated users (or restrict further)
    // For now, allow all writes in test mode
    // TODO: Add proper authentication later
    match /{document=**} {
      allow write: if true;
    }
  }
}
```

**Note:** `allow write: if true` is only for development. In production, add proper authentication!

### 6. First-Time Data Migration

When you first run the app:
- If Firestore is empty, the app will automatically load data from `src/data/fishData.json`
- The data will be migrated to Firestore automatically
- After migration, all future operations will use Firestore

## 📊 Firestore Collections Structure

Your data is organized in Firestore as:

### Collection: `fishes`
Each document represents a fish:
```javascript
{
  id: 1,
  name: "Surmai (King Fish)",
  category: "Seawater",
  rate: 450,
  unit: "per kg",
  image: "https://...",
  inStock: true,
  description: "...",
  rateHistory: [...]
}
```

### Collection: `reviews`
Each document represents a review:
```javascript
{
  id: 1,
  name: "Priya Sharma",
  rating: 5,
  comment: "...",
  date: "2024-10-15",
  verified: true
}
```

### Collection: `config`
Single document `app` containing:
```javascript
{
  shopInfo: {
    name: "PR Nexus FishMart",
    owner: "...",
    phone: "...",
    // ... other shop info
  },
  promotions: {
    text: "...",
    isActive: true,
    // ...
  },
  discountSettings: {
    isEnabled: true,
    percentage: 5,
    // ...
  }
}
```

## 🎯 Features

✅ **Automatic Migration**: JSON data automatically loads into Firestore on first run  
✅ **Real-time Updates**: Changes sync to Firestore immediately  
✅ **Offline Support**: LocalStorage cache for offline access  
✅ **Error Handling**: Falls back to JSON if Firestore is unavailable  
✅ **Admin Panel**: All CRUD operations work with Firestore  

## 🧪 Testing

1. Run `npm start`
2. Open your app in the browser
3. Check browser console for Firestore connection logs
4. Go to Admin Panel → Add/Edit fish
5. Verify changes appear in Firebase Console → Firestore Database

## 🚀 Production Deployment

Before deploying to production:

1. ✅ Update Firebase config with production credentials
2. ✅ Configure proper Firestore security rules
3. ✅ Enable Firebase Authentication if needed
4. ✅ Test all CRUD operations
5. ✅ Verify data migration completed successfully

## 📝 Notes

- The old `src/data/fishData.json` file remains for fallback
- Once Firestore has data, it takes precedence over JSON
- All admin operations now sync to Firestore
- No backend server needed - everything runs client-side!

## 🐛 Troubleshooting

### "Firebase not initialized" error
- Check that you've updated `src/firebaseConfig.js` with your actual config
- Verify Firebase project is created and Firestore is enabled

### Data not loading
- Check browser console for errors
- Verify Firestore database is created
- Check network tab for Firestore API calls

### Can't write to Firestore
- Check Firestore security rules
- Ensure rules allow write operations
- Check Firebase console for quota/limits

---

**Need help?** Check Firebase documentation: https://firebase.google.com/docs/firestore

