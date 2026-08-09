# Production Deployment — PR Nexus FishMart

**Repository:** https://github.com/SanjTiksha/PR_Nexus_FishMart

## Quick production build

```bash
npm install
npm run build
npm run preview
```

Output folder: `dist/` (ready to host on Netlify, Vercel, Firebase Hosting, or any static host).

## Option 1: Netlify (recommended)

1. Go to [netlify.com](https://netlify.com) → **Add new site** → **Import from Git**
2. Select `SanjTiksha/PR_Nexus_FishMart`
3. Build settings (also in `netlify.toml`):
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
   - **Node version:** `20`
4. Deploy — SPA routes are handled via `_redirects` / `netlify.toml`

## Option 2: Vercel

1. Import `SanjTiksha/PR_Nexus_FishMart` at [vercel.com](https://vercel.com)
2. Framework: Vite (auto-detected via `vercel.json`)
3. Deploy

## Option 3: GitHub Pages

```bash
npm run deploy
```

Uses `vite build --mode gh-pages` with base path `/PR_Nexus_FishMart/`.  
Site URL: `https://sanjtiksha.github.io/PR_Nexus_FishMart/`

Enable Pages in repo **Settings → Pages → Deploy from branch `gh-pages`**.

## Firebase Hosting (optional)

```bash
npm install -g firebase-tools
firebase login
firebase init hosting   # public directory = dist
npm run build
firebase deploy --only hosting
```

## Post-deploy checklist

- [ ] Open site on mobile (primary users)
- [ ] Fish catalog loads from Firestore
- [ ] Cart → checkout → map pin → UPI / WhatsApp flow works
- [ ] Contact / WhatsApp / phone links work
- [ ] Confirm admin password is known only to authorized operators (not published in UI/docs)
- [ ] Confirm UPI QR / ID is correct for production payments

## Notes

- Client Firebase config is intentional for this SPA; protect data with **Firestore security rules**.
- Do not commit `.env` files (see `.gitignore`). Use `.env.example` as a template.
- For custom domain on Netlify/Vercel, keep `base: '/'` (default `npm run build`).
