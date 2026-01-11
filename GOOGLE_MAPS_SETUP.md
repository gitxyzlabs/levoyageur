# Google Maps API Setup Guide

## Overview
Le Voyageur uses the Google Maps JavaScript API to display interactive maps with location markers and heat maps. You'll need a Google Maps API key to run the application.

## Getting Your API Key

### Step 1: Create a Google Cloud Project
1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable billing for the project (Google provides $200 free credit monthly)

### Step 2: Enable Required APIs
Enable the following APIs in your Google Cloud project:
- **Maps JavaScript API** - For rendering the map
- **Places API** - For searching and displaying place details
- **Geocoding API** - For converting addresses to coordinates

To enable these:
1. Go to **APIs & Services** > **Library**
2. Search for each API listed above
3. Click on it and press **Enable**

### Step 3: Create an API Key
1. Go to **APIs & Services** > **Credentials**
2. Click **Create Credentials** > **API Key**
3. Copy the generated API key

### Step 4: (Recommended) Restrict Your API Key
For security, restrict your API key:
1. Click on your API key in the Credentials page
2. Under **Application restrictions**, select:
   - **HTTP referrers (web sites)** for production
   - Add your website URLs (e.g., `https://yourdomain.com/*`)
3. Under **API restrictions**, select **Restrict key**
4. Choose the APIs you enabled in Step 2
5. Save changes

## Configuration

### For Local Development (Vite)
1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Open `.env.local` and add your API key:
   ```
   VITE_GOOGLE_MAPS_API_KEY=your_api_key_here
   ```

3. Restart your development server

### For Figma Make / Supabase Deployment
The app is already configured to use the `GOOGLE_MAPS_API_KEY` environment variable that you've set in Supabase secrets.

### For Vercel Deployment
1. Go to your Vercel project settings
2. Navigate to **Environment Variables**
3. Add a new variable:
   - **Name**: `VITE_GOOGLE_MAPS_API_KEY`
   - **Value**: Your Google Maps API key
4. Redeploy your application

## How It Works

The app uses a dual-loading strategy:

1. **First**: Tries to load the API key from `.env.local` (Vite environment variable `VITE_GOOGLE_MAPS_API_KEY`)
2. **Fallback**: If not found, fetches from the Supabase server endpoint (uses `GOOGLE_MAPS_API_KEY` from Supabase secrets)

This ensures the app works in both local development and production environments.

## Troubleshooting

### Error: "This page can't load Google Maps correctly"
- Make sure your API key is correct
- Check that billing is enabled in Google Cloud Console
- Verify that the required APIs are enabled

### Error: "ApiProjectMapError"
- Ensure your Google Cloud project has billing enabled
- Check that Maps JavaScript API is enabled

### Error: "RefererNotAllowedMapError"
- Your API key has HTTP referrer restrictions
- Add your domain to the allowed referrers list
- For local development, add `http://localhost:*` and `http://127.0.0.1:*`

### Map not loading / Blank screen
- Open browser console (F12) to check for error messages
- Verify the API key is being loaded (check console logs for "Google Maps Debug" messages)
- Ensure `.env.local` file is in the root directory and has correct syntax

## Cost & Usage

Google Maps provides:
- **$200 free credit** per month
- Maps JavaScript API: ~$7 per 1,000 loads
- Places API: ~$17 per 1,000 requests

For a small to medium app, you'll likely stay within the free tier.

## Resources

- [Google Maps Platform Documentation](https://developers.google.com/maps/documentation)
- [API Key Best Practices](https://developers.google.com/maps/api-security-best-practices)
- [Pricing Calculator](https://mapsplatform.google.com/pricing/)
