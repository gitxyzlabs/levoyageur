# Le Voyageur - Vercel Deployment Guide

## ✅ Pre-Deployment Checklist

### Files Created/Updated:
- [x] `index.html` - HTML entry point for Vite
- [x] `src/main.tsx` - React app entry point
- [x] `vercel.json` - Vercel deployment configuration
- [x] `tsconfig.json` - TypeScript configuration
- [x] `tsconfig.node.json` - TypeScript config for Vite
- [x] `package.json` - Updated with React dependencies
- [x] `.gitignore` - Prevents committing sensitive files
- [x] `README.md` - Project documentation
- [x] `public/vite.svg` - Favicon

### Configuration Changes:
- [x] Added `react` and `react-dom` to dependencies (not just peerDependencies)
- [x] Added TypeScript types for React
- [x] Added proper imports to `App.tsx`
- [x] Configured SPA routing in `vercel.json`

## 🚀 Deployment Steps

### 1. Push to GitHub

```bash
git add .
git commit -m "Configure for Vercel deployment"
git push origin main
```

### 2. Deploy to Vercel

**Option A: Vercel Dashboard**
1. Go to https://vercel.com
2. Click "Add New Project"
3. Import `gitxyzlabs/levoyageur`
4. Configure:
   - **Framework Preset:** Other (automatic)
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
   - **Install Command:** `npm install`

**Option B: Vercel CLI**
```bash
npm i -g vercel
vercel login
vercel
```

### 3. Set Environment Variables

In Vercel Dashboard → Settings → Environment Variables:

| Variable Name | Value | Environment |
|--------------|-------|-------------|
| `VITE_GOOGLE_MAPS_API_KEY` | Your Google Maps API key | Production, Preview, Development |

**Important:** 
- The variable name MUST start with `VITE_` for Vite to expose it
- Add it to all three environments (Production, Preview, Development)

### 4. Redeploy

After adding environment variables:
- Go to Deployments
- Click the three dots (⋯) on the latest deployment
- Click "Redeploy"

## 🔧 Troubleshooting

### Issue: "No Next.js version detected"
**Solution:** Already fixed! The app now properly identifies as a Vite app with `vercel.json`.

### Issue: "Module not found: react"
**Solution:** Already fixed! React is now in dependencies, not just peerDependencies.

### Issue: Google Maps not loading
**Possible causes:**
1. `VITE_GOOGLE_MAPS_API_KEY` not set in Vercel
2. API key doesn't have the right permissions
3. API key has domain restrictions that block Vercel

**Solution:**
- Check Google Cloud Console → APIs & Services → Credentials
- Make sure these APIs are enabled:
  - Maps JavaScript API
  - Places API
  - Geocoding API
- Add your Vercel domain to "Application restrictions"

### Issue: Supabase functions not working
**Possible causes:**
1. CORS issues
2. Environment variables not set

**Solution:**
- Check Supabase project settings
- Ensure CORS is configured for your Vercel domain
- Check Edge Function logs in Supabase dashboard

## 📝 Build Configuration

The build process:
1. Vite reads `vite.config.ts`
2. Compiles TypeScript → JavaScript
3. Bundles React components
4. Processes Tailwind CSS
5. Outputs to `dist/` directory

The `dist/` folder structure:
```
dist/
├── index.html
├── assets/
│   ├── index-[hash].js
│   └── index-[hash].css
└── vite.svg
```

## 🌐 Custom Domain (Optional)

1. Go to Vercel Dashboard → Settings → Domains
2. Add your custom domain (e.g., `levoyageur.com`)
3. Configure DNS:
   - Type: `A` Record
   - Name: `@`
   - Value: `76.76.21.21`
4. For `www` subdomain:
   - Type: `CNAME`
   - Name: `www`
   - Value: `cname.vercel-dns.com`

## 🎯 Post-Deployment Checklist

After successful deployment:
- [ ] Test the app on the Vercel URL
- [ ] Verify Google Maps loads correctly
- [ ] Test authentication flow
- [ ] Test adding a location (as editor)
- [ ] Test heat map search
- [ ] Check browser console for errors
- [ ] Test on mobile devices

## 📊 Monitoring

Vercel provides:
- **Analytics:** Traffic and performance metrics
- **Logs:** Real-time function and build logs
- **Speed Insights:** Core Web Vitals
- **Error Tracking:** Runtime errors

Access these in: Vercel Dashboard → Your Project → Analytics/Logs

## 🔄 Continuous Deployment

Vercel automatically deploys when you push to GitHub:
- `main` branch → Production
- Other branches → Preview deployments
- Pull requests → Preview deployments with unique URLs

## 💡 Performance Tips

1. **Image Optimization:** Consider using Vercel's Image Optimization
2. **Caching:** Static assets are automatically cached
3. **CDN:** Vercel serves from 40+ edge locations globally
4. **Compression:** Gzip/Brotli enabled automatically

## 🆘 Support

If deployment fails:
1. Check build logs in Vercel dashboard
2. Review the error message
3. Check this checklist
4. Verify all environment variables are set
5. Try redeploying with "Clear Build Cache"

---

**Last Updated:** January 11, 2026
**Deployment Status:** ✅ Ready for Production
