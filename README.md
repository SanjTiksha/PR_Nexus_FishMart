# 🐟 PR Nexus FishMart

A modern, mobile-first seafood marketplace for **PR Nexus FishMart** (a venture of PR Nexus Group), built with React, Vite, Tailwind CSS, and Firebase Firestore.

**Live repo:** https://github.com/SanjTiksha/PR_Nexus_FishMart

## 🎯 Features

### 🏠 **Home Page**
- Brand-first introduction for PR Nexus Group
- Featured fish showcase
- Quick contact buttons (Call, WhatsApp)
- Business highlights

### 🐠 **Fish Catalog** (default landing `/`)
- Live rates from Firestore
- Search and filter
- Thumb-friendly mobile cards (Add to Cart / Buy Now)
- Delivery map pin at checkout
- UPI QR payment + WhatsApp order share

### 👤 **About & Contact**
- Group office details (Pune)
- Maps, emails, phone / WhatsApp

### 🔑 **Admin Panel** (`/admin`)
- Fish rates & stock
- Shop settings
- Promotions
- Backup / restore

### 📱 **Mobile-first**
- Safe-area support, large touch targets
- Bottom-sheet cart / checkout / payment flows
- Optimized for phone users (~90% of traffic)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (20 recommended)
- npm

### Installation

```bash
git clone https://github.com/SanjTiksha/PR_Nexus_FishMart.git
cd PR_Nexus_FishMart
npm install
npm run dev
```

Open `http://localhost:5173` (or the port Vite prints).

### Production build

```bash
npm run build
npm run preview
```

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for Netlify, Vercel, and GitHub Pages.│   ├── PromoBanner.jsx # Promotional banner
│   ├── AdminLogin.jsx  # Admin authentication
│   ├── AdminPanel.jsx  # Admin dashboard
│   └── FeedbackButton.jsx # Feedback widget
├── pages/              # Page components
│   ├── Home.jsx        # Landing page
│   ├── About.jsx       # About us page
│   ├── FishCatalog.jsx # Fish listing page
│   ├── Contact.jsx     # Contact page
│   └── Admin.jsx       # Admin page
├── data/               # Data files
│   └── fishData.json   # Fish data and shop info
├── App.jsx             # Main app component
├── main.jsx            # Application entry point
└── index.css           # Global styles
```

## 🎨 Design System

### Colors
- **Primary**: Ocean Blue (#005f73)
- **Secondary**: Coral Red (#ee6c4d)
- **Accent**: Seafoam White (#e0fbfc)
- **Text**: Dark Navy (#001219)

### Typography
- **Font**: Poppins (Google Fonts)
- **Weights**: 300, 400, 500, 600, 700

### Components
- **Buttons**: Rounded corners (12px), hover effects
- **Cards**: Modern shadows, smooth animations
- **Layout**: Card-based design with consistent spacing

## 🔧 Configuration

### Admin Access
- **Default Password**: `admin123`
- **Access URL**: `/admin`

### Data Management
- Fish data stored in `src/data/fishData.json`
- Admin panel allows CRUD operations
- Export/Import functionality for backups

### Customization
- Update shop information in `fishData.json`
- Modify colors in `tailwind.config.js`
- Add new fish images in `public/images/fish/`

## 📱 Mobile Features

- **Touch-friendly buttons**
- **Swipe gestures** (where applicable)
- **Responsive images**
- **Optimized navigation**
- **Fast loading**

## 🚀 Deployment

### Build for Production
```bash
npm run build
```

### Deploy to Netlify
1. Connect your GitHub repository
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Deploy!

### Deploy to Vercel
1. Import project from GitHub
2. Framework preset: Vite
3. Deploy!

## 🔄 Daily Updates

### Admin Workflow
1. Login to admin panel
2. Update fish rates
3. Modify stock status
4. Update promotions
5. Export data backup

### Data Backup
- Automatic localStorage backup
- Manual export/import functionality
- Version control for data changes

## 🛠️ Technical Stack

- **Frontend**: React 18
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router
- **QR Codes**: qrcode.react
- **PDF Export**: html2canvas + jsPDF
- **Charts**: Chart.js (optional)

## 📞 Support

For technical support or customization requests:
- **Email**: rajeshfishmarket@gmail.com
- **Phone**: +917666293267

## 📄 License

This project is proprietary software developed for Rajesh Fish Market.

---

**Designed by PR Nexus FishMart** 🎨

