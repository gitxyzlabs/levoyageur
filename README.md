# Le Voyageur 🗺️

A luxury travel discovery app for jet setters that rates restaurants, hotels and other travel lifestyle venues.

## Features

- 🗺️ **Interactive Google Maps** with custom markers
- 🏆 **Multi-score system** (LV Editors, LV Crowdsource, Google Rating, Michelin)
- 🔥 **Heat map visualization** with topographic-style color gradients
- 🔐 **Supabase authentication** with user roles (Traveler & Editor)
- ✨ **Modern, minimal design** inspired by iOS design principles

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS 4
- **Maps**: Google Maps API (@vis.gl/react-google-maps)
- **Backend**: Supabase (Auth + Database + Storage)
- **UI Components**: Radix UI + shadcn/ui
- **Animations**: Motion (Framer Motion)
- **Deployment**: Vercel

## Setup

### 1. Clone the repository

```bash
git clone https://github.com/gitxyzlabs/levoyageur.git
cd levoyageur
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file in the root directory:

```env
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
```

> 📖 **Need help getting a Google Maps API key?** See the [Google Maps Setup Guide](./GOOGLE_MAPS_SETUP.md) for detailed instructions.

### 4. Run development server

```bash
npm run dev
```

## Deployment to Vercel

### Quick Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/gitxyzlabs/levoyageur)

### Manual Deployment

1. Push your code to GitHub
2. Import the project in Vercel
3. **Add environment variables** in Vercel dashboard:
   - `VITE_GOOGLE_MAPS_API_KEY` - Your Google Maps API key
4. Deploy!

### Important Vercel Configuration

The project includes a `vercel.json` file that configures:
- Build command: `npm run build`
- Output directory: `dist`
- SPA routing (all routes redirect to index.html)

## Supabase Configuration

The app uses Supabase for:
- **Authentication**: Email/password + social login
- **Database**: Key-value store for location data
- **User roles**: Normal users and editors

Environment variables for Supabase are already configured in the deployment.

## Project Structure

```
levoyageur/
├── src/
│   ├── app/
│   │   ├── App.tsx                 # Main app component
│   │   └── components/             # React components
│   ├── lib/                        # Utilities
│   ├── styles/                     # CSS files
│   └── main.tsx                    # App entry point
├── supabase/
│   └── functions/server/           # Supabase Edge Functions
├── public/                         # Static assets
├── index.html                      # HTML entry point
├── vite.config.ts                  # Vite configuration
├── vercel.json                     # Vercel deployment config
└── package.json
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build locally

## License

Private - All rights reserved

---

Built with ❤️ using Figma Make