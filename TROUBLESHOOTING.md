# Troubleshooting Guide

## Error: "SyntaxError: Importing binding name 'default' cannot be resolved by star export entries"

### What I Fixed:

1. **Fixed incorrect module imports in `App.tsx`**
   - Changed `import * as api from '../utils/api'` → `import { api, supabase } from '../utils/api'`
   - Changed to use type imports: `import type { Location as APILocation, User as APIUser } from '../utils/api'`
   - The `api.ts` file exports a named export `api`, not a default export or namespace

2. **Removed non-existent imports**
   - Removed `import { initializeSupabase } from '../utils/api'` - this function doesn't exist
   - Removed the `initializeSupabase()` call in useEffect

3. **Fixed duplicate type definitions**
   - App.tsx was defining Location and User types that already exist in api.ts
   - Now imports types from api.ts and extends them as needed

## Error: "TypeError: Importing a module script failed"

### What I Fixed:

1. **Simplified CSS imports in `main.tsx`**
   - Changed from importing multiple CSS files individually
   - Now only imports `index.css` which imports the others
   - This prevents circular dependencies

2. **Fixed import paths in `App.tsx`**
   - Changed `import * as api from '../../utils/api'` → `import * as api from '../utils/api'`
   - All imports now use correct relative paths from `/src/app/App.tsx`

3. **Added TypeScript type definitions**
   - Created `/src/vite-env.d.ts` for Vite environment types
   - Added `@types/google.maps` to devDependencies
   - Updated `tsconfig.json` with proper module resolution

4. **Enhanced TypeScript configuration**
   - Added `esModuleInterop` and `allowSyntheticDefaultImports`
   - Added `forceConsistentCasingInFileNames`
   - Added `types: ["vite/client"]` for proper Vite types

### Testing Locally

Before deploying to Vercel, test locally:

```bash
# Install dependencies (if you haven't)
npm install

# Create .env.local file
cp .env.example .env.local

# Edit .env.local and add your Google Maps API key
# VITE_GOOGLE_MAPS_API_KEY=your_actual_key_here

# Run dev server
npm run dev
```

Visit `http://localhost:5173` and check the browser console for errors.

### Common Issues & Solutions

#### Issue 1: Module not found errors
**Symptoms:** `Cannot find module './components/Map'`

**Solution:**
- Check that all imported files exist
- Verify import paths are correct (case-sensitive!)
- Make sure file extensions match (`.tsx` vs `.ts`)

#### Issue 2: CSS import errors
**Symptoms:** `Failed to load CSS` or style not applying

**Solution:**
- Only import `./styles/index.css` in `main.tsx`
- Don't import CSS files individually
- Clear browser cache and rebuild

#### Issue 3: TypeScript errors
**Symptoms:** Red squiggly lines, type errors in IDE

**Solution:**
- Run `npm install` to install all type definitions
- Restart your IDE/editor
- Check `tsconfig.json` is properly configured
- Run `npx tsc --noEmit` to check for type errors

#### Issue 4: Google Maps API errors
**Symptoms:** Map doesn't load, console shows API key errors

**Solution:**
- Make sure `.env.local` exists with `VITE_GOOGLE_MAPS_API_KEY`
- Restart the dev server after creating/editing `.env.local`
- Check API key is valid in Google Cloud Console
- Enable required APIs (Maps JavaScript API, Places API, Geocoding API)

#### Issue 5: Build errors on Vercel
**Symptoms:** Deployment fails during build

**Solution:**
- Check build logs in Vercel dashboard
- Verify all dependencies are in `package.json`
- Make sure `VITE_GOOGLE_MAPS_API_KEY` is set in Vercel environment variables
- Try "Clear Build Cache" and redeploy

### File Structure Verification

Make sure these files exist:

```
✅ /index.html
✅ /src/main.tsx
✅ /src/vite-env.d.ts
✅ /src/app/App.tsx
✅ /src/styles/index.css
✅ /src/styles/tailwind.css
✅ /src/styles/theme.css
✅ /src/styles/fonts.css
✅ /src/utils/api.ts
✅ /vite.config.ts
✅ /tsconfig.json
✅ /tsconfig.node.json
✅ /package.json
✅ /vercel.json
✅ /.gitignore
✅ /.env.example
```

### Browser Console Checks

When running locally (`npm run dev`), check browser console:

**Good signs:**
```
✅ === Google Maps Debug ===
✅ API Key loaded: ✅ Yes
✅ No module errors
✅ No 404 errors
```

**Bad signs (fix these):**
```
❌ TypeError: Importing a module script failed
❌ Failed to fetch dynamically imported module
❌ 404 errors for .tsx files
❌ CORS errors
❌ Module not found errors
```

### Deployment Checklist

Before deploying to Vercel:

- [ ] All files committed to Git
- [ ] `.env.local` is in `.gitignore` (don't commit API keys!)
- [ ] `npm run build` works locally
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] Pushed to GitHub
- [ ] Environment variables set in Vercel
- [ ] Vercel build settings correct (see DEPLOYMENT.md)

### Getting More Help

If you're still having issues:

1. **Check build logs:** Vercel Dashboard → Your Project → Deployments → View Logs
2. **Check browser console:** Right-click → Inspect → Console tab
3. **Check Network tab:** Right-click → Inspect → Network tab (look for 404s)
4. **Clear caches:**
   - Browser: Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
   - Vercel: Deployments → ⋯ → "Clear Build Cache"
   - Local: Delete `node_modules` and `dist`, then `npm install`

### Still Not Working?

Try a clean rebuild:

```bash
# Delete build artifacts
rm -rf node_modules dist .vite

# Reinstall dependencies
npm install

# Try building
npm run build

# If build succeeds, try running
npm run preview
```

If the build works locally but fails on Vercel:
- Compare `package.json` versions
- Check Node.js version (Vercel uses Node 18+ by default)
- Verify all environment variables are set
- Check Vercel build logs for specific error messages

---

**Last Updated:** January 11, 2026