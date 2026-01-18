import { Heart, Bookmark } from 'lucide-react';

interface LuxuryMarkerProps {
  rating: number;
  scale?: number;
  showHeatMap?: boolean;
  isFavorite?: boolean;
  isWantToGo?: boolean;
  type?: 'lv-location' | 'search-result';
}

// Color palette for different rating tiers
const getMarkerStyle = (rating: number) => {
  // Luxury color palette based on PANTONE® colors
  if (rating >= 10.5) return {
    // Amaranth - Legendary (10-11)
    primary: '#9b2743',
    secondary: '#7a1f35',
    accent: '#fce7ec',
    gradient: 'linear-gradient(135deg, #9b2743 0%, #7a1f35 100%)',
    glow: 'rgba(155, 39, 67, 0.4)',
    label: 'Legendary'
  };
  if (rating >= 9.5) return {
    // Lava Falls - Exceptional (9-10)
    primary: '#8e4452',
    secondary: '#6e3340',
    accent: '#fdeef1',
    gradient: 'linear-gradient(135deg, #8e4452 0%, #6e3340 100%)',
    glow: 'rgba(142, 68, 82, 0.4)',
    label: 'Exceptional'
  };
  if (rating >= 8.5) return {
    // Burnt Sienna - Outstanding (8-9)
    primary: '#c97b63',
    secondary: '#a8624f',
    accent: '#fef0ec',
    gradient: 'linear-gradient(135deg, #c97b63 0%, #a8624f 100%)',
    glow: 'rgba(201, 123, 99, 0.4)',
    label: 'Outstanding'
  };
  if (rating >= 7.5) return {
    // Muskmelon - Excellent (7-8)
    primary: '#d99370',
    secondary: '#c17a59',
    accent: '#fef3ed',
    gradient: 'linear-gradient(135deg, #d99370 0%, #c17a59 100%)',
    glow: 'rgba(217, 147, 112, 0.4)',
    label: 'Excellent'
  };
  if (rating >= 6.5) return {
    // Alexandrite - Very Good (6-7)
    primary: '#2d6261',
    secondary: '#224a49',
    accent: '#e8f3f3',
    gradient: 'linear-gradient(135deg, #2d6261 0%, #224a49 100%)',
    glow: 'rgba(45, 98, 97, 0.4)',
    label: 'Very Good'
  };
  if (rating >= 4) return {
    // Marina - Good (4-6)
    primary: '#5383a8',
    secondary: '#416888',
    accent: '#edf4f9',
    gradient: 'linear-gradient(135deg, #5383a8 0%, #416888 100%)',
    glow: 'rgba(83, 131, 168, 0.4)',
    label: 'Good'
  };
  if (rating >= 2) return {
    // Silver Sage - Fair (2-4) - transitional between cool and warm
    primary: '#8a9a9d',
    secondary: '#6d7d80',
    accent: '#f4f6f6',
    gradient: 'linear-gradient(135deg, #8a9a9d 0%, #6d7d80 100%)',
    glow: 'rgba(138, 154, 157, 0.3)',
    label: 'Fair'
  };
  return {
    // Cloud Dancer - Poor (0-2) - PANTONE Color of the Year 2026
    primary: '#f0f1f2',
    secondary: '#e0e1e2',
    accent: '#ffffff',
    gradient: 'linear-gradient(135deg, #f0f1f2 0%, #e0e1e2 100%)',
    glow: 'rgba(240, 241, 242, 0.2)',
    label: 'Poor'
  };
};

export function LuxuryMarker({ 
  rating, 
  scale = 1, 
  showHeatMap = false,
  isFavorite = false,
  isWantToGo = false,
  type = 'lv-location'
}: LuxuryMarkerProps) {
  const style = type === 'search-result' 
    ? {
        primary: '#6366f1',
        secondary: '#4f46e5',
        accent: '#eef2ff',
        gradient: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
        glow: 'rgba(99, 102, 241, 0.4)',
        label: 'Search'
      }
    : getMarkerStyle(rating);

  const size = type === 'search-result' ? 36 : 44;
  const scaledSize = size * scale;

  return (
    <div
      className="relative cursor-pointer transition-all duration-300 hover:scale-110"
      style={{
        width: `${scaledSize}px`,
        height: `${scaledSize * 1.2}px`,
      }}
    >
      {/* Glow effect */}
      <div
        className="absolute inset-0 rounded-full blur-lg opacity-60 animate-pulse"
        style={{
          background: style.glow,
          top: '10%',
          left: '10%',
          right: '10%',
          bottom: '30%',
        }}
      />

      {/* Main marker body with luxury gradient */}
      <svg
        viewBox="0 0 40 52"
        className="relative"
        style={{
          width: `${scaledSize}px`,
          height: `${scaledSize * 1.2}px`,
          filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.25))',
        }}
      >
        {/* Outer border for depth */}
        <path
          d="M20 2C11.716 2 5 8.716 5 17c0 10 15 33 15 33s15-23 15-33c0-8.284-6.716-15-15-15z"
          fill={style.secondary}
        />
        
        {/* Main body with gradient */}
        <defs>
          <linearGradient id={`gradient-${rating}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={style.primary} />
            <stop offset="100%" stopColor={style.secondary} />
          </linearGradient>
          <filter id="inner-shadow">
            <feGaussianBlur in="SourceAlpha" stdDeviation="2"/>
            <feOffset dx="0" dy="1" result="offsetblur"/>
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.3"/>
            </feComponentTransfer>
            <feMerge>
              <feMergeNode/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        
        <path
          d="M20 4C12.82 4 7 9.82 7 17c0 9 13 30 13 30s13-21 13-30c0-7.18-5.82-13-13-13z"
          fill={`url(#gradient-${rating})`}
          filter="url(#inner-shadow)"
        />

        {/* Center circle with LV branding */}
        <circle 
          cx="20" 
          cy="17" 
          r="8" 
          fill={style.accent}
          opacity="0.95"
        />
        
        {/* LV monogram */}
        <text
          x="20"
          y="17"
          textAnchor="middle"
          dominantBaseline="central"
          style={{
            fontSize: '9px',
            fontWeight: '700',
            fontFamily: 'Georgia, serif',
            fill: style.primary,
            letterSpacing: '-0.5px'
          }}
        >
          LV
        </text>

        {/* Subtle highlight for glossy effect */}
        <ellipse
          cx="20"
          cy="13"
          rx="8"
          ry="3"
          fill="white"
          opacity="0.15"
        />
      </svg>

      {/* Rating badge - only for LV locations, not in heat map */}
      {!showHeatMap && type === 'lv-location' && (
        <div
          className="absolute -top-1 -right-1 px-2 py-0.5 rounded-full shadow-lg backdrop-blur-sm border"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.9) 100%)',
            borderColor: style.primary,
            fontSize: `${9 * scale}px`,
            fontWeight: '700',
            color: style.primary,
            minWidth: `${22 * scale}px`,
            textAlign: 'center',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            letterSpacing: '-0.3px'
          }}
        >
          {rating.toFixed(1)}
        </div>
      )}

      {/* Google rating badge for search results */}
      {type === 'search-result' && (
        <div
          className="absolute -top-1 -right-1 px-2 py-0.5 rounded-full shadow-lg backdrop-blur-sm border border-indigo-300"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(238,242,255,0.9) 100%)',
            fontSize: `${9 * scale}px`,
            fontWeight: '700',
            color: style.primary,
            minWidth: `${22 * scale}px`,
            textAlign: 'center',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            letterSpacing: '-0.3px'
          }}
        >
          {rating.toFixed(1)}
        </div>
      )}

      {/* Favorite indicator */}
      {isFavorite && (
        <div
          className="absolute -top-1 -left-1 w-5 h-5 rounded-full shadow-lg flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #fecaca 0%, #fca5a5 100%)',
          }}
        >
          <Heart className="w-3 h-3 fill-red-600 stroke-red-600" />
        </div>
      )}

      {/* Want to go indicator */}
      {isWantToGo && !isFavorite && (
        <div
          className="absolute -top-1 -left-1 w-5 h-5 rounded-full shadow-lg flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, #ddd6fe 0%, #c4b5fd 100%)',
          }}
        >
          <Bookmark className="w-3 h-3 fill-violet-600 stroke-violet-600" />
        </div>
      )}
    </div>
  );
}