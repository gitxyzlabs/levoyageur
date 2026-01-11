# Quick Setup Instructions

## Fixing the Google Maps API Error

You're seeing Google Maps errors because the app needs an API key to display maps. Here's how to fix it:

### Option 1: For Local Development (Recommended)

1. **Get a Google Maps API Key**
   - Follow the detailed guide in [GOOGLE_MAPS_SETUP.md](./GOOGLE_MAPS_SETUP.md)
   - Quick link: [Google Cloud Console](https://console.cloud.google.com/)

2. **Add the key to `.env.local`**
   - Open the `.env.local` file in the root directory
   - Replace the empty value with your API key:
     ```
     VITE_GOOGLE_MAPS_API_KEY=AIzaSy...your_actual_key_here
     ```

3. **Restart your development server**
   - Stop the server (Ctrl+C)
   - Run `npm run dev` again
   - The map should now load! 🎉

### Option 2: For Figma Make Environment

The app will automatically use the `GOOGLE_MAPS_API_KEY` that's already configured in your Supabase secrets. No additional setup needed!

## Verification

After adding your API key, you should see in the browser console:

```
=== Google Maps Debug ===
API Key loaded from .env.local: ✅ Yes
API Key (first 10 chars): AIzaSy...
API Key length: 39
```

If you see this, the map will load successfully!

## What Changed

The app now supports **two ways** to load the Google Maps API key:

1. **Priority**: From `.env.local` file (for local development and Vercel deployments)
2. **Fallback**: From Supabase server (for Figma Make environment)

This dual approach ensures the app works everywhere!

## Common Issues

### "Map still not loading"
- Make sure `.env.local` is in the **root directory** (same level as `package.json`)
- Check the file name is exactly `.env.local` (not `.env.local.txt`)
- Verify there's no space before or after the `=` sign
- Restart your development server after making changes

### "ApiProjectMapError"
- Enable billing in Google Cloud Console
- Enable the required APIs (Maps JavaScript API, Places API, Geocoding API)

### "RefererNotAllowedMapError"  
- Remove API key restrictions temporarily for testing
- Or add `http://localhost:*` to allowed referrers

## Next Steps

Once the map loads:
1. Click "Add Sample Locations" to populate the database
2. Try searching for "tacos" to see the heat map feature
3. Sign up to become an editor and add your own locations

---

Need more help? Check out:
- [GOOGLE_MAPS_SETUP.md](./GOOGLE_MAPS_SETUP.md) - Detailed API setup guide
- [README.md](./README.md) - Full project documentation
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - Common issues and solutions
