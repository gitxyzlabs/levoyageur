import { Heart, Bookmark } from 'lucide-react';

interface LuxuryMarkerProps {
  rating?: number; // Optional now - some markers may not have LV ratings
  scale?: number;
  showHeatMap?: boolean;
  isFavorite?: boolean;
  isWantToGo?: boolean;
  type?: 'lv-location' | 'search-result';
  hasLVRating?: boolean; // Whether this location has an LV rating
}

// Color palette for different rating tiers
const getMarkerStyle = (rating: number) => {
  if (rating >= 10.5) return {
    primary: '#9b2743', // Legendary
    secondary: '#7a1f35',
    glow: 'rgba(155, 39, 67, 0.4)',
  };
  if (rating >= 9.5) return {
    primary: '#8e4452', // Exceptional
    secondary: '#6e3340',
    glow: 'rgba(142, 68, 82, 0.4)',
  };
  if (rating >= 8.5) return {
    primary: '#c97b63', // Outstanding
    secondary: '#a8624f',
    glow: 'rgba(201, 123, 99, 0.4)',
  };
  if (rating >= 7.5) return {
    primary: '#d99370', // Excellent
    secondary: '#c17a59',
    glow: 'rgba(217, 147, 112, 0.4)',
  };
  if (rating >= 6.5) return {
    primary: '#2d6261', // Very Good
    secondary: '#224a49',
    glow: 'rgba(45, 98, 97, 0.4)',
  };
  if (rating >= 4) return {
    primary: '#5383a8', // Good
    secondary: '#416888',
    glow: 'rgba(83, 131, 168, 0.4)',
  };
  if (rating >= 2) return {
    primary: '#8a9a9d', // Fair
    secondary: '#6d7d80',
    glow: 'rgba(138, 154, 157, 0.3)',
  };
  return {
    primary: '#f0f1f2', // Poor
    secondary: '#e0e1e2',
    glow: 'rgba(240, 241, 242, 0.2)',
  };
};

export function LuxuryMarker({ 
  rating = 5, 
  scale = 1, 
  showHeatMap = false,
  isFavorite = false,
  isWantToGo = false,
  type = 'lv-location',
  hasLVRating = true
}: LuxuryMarkerProps) {
  // Determine marker appearance based on state
  let markerColor: string;
  let markerGlow: string;
  let IconComponent: any = null;
  let iconColor: string;

  if (!hasLVRating && isFavorite) {
    // Red circle with heart for favorited non-LV locations
    markerColor = '#ef4444';
    markerGlow = 'rgba(239, 68, 68, 0.4)';
    IconComponent = Heart;
    iconColor = '#ffffff';
  } else if (!hasLVRating && isWantToGo) {
    // Green circle with bookmark for want-to-go non-LV locations
    markerColor = '#10b981';
    markerGlow = 'rgba(16, 185, 129, 0.4)';
    IconComponent = Bookmark;
    iconColor = '#ffffff';
  } else if (type === 'search-result') {
    // Use 0-score color for Google search results
    const style = getMarkerStyle(0);
    markerColor = style.primary;
    markerGlow = style.glow;
    iconColor = '#1a73e8'; // Google blue for the logo
  } else {
    // Use rating-based colors for LV locations
    const style = getMarkerStyle(rating);
    markerColor = style.primary;
    markerGlow = style.glow;
    iconColor = '#ffffff';
  }

  const size = 36;
  const scaledSize = size * scale;

  return (
    <div
      className="relative cursor-pointer transition-all duration-300 hover:scale-110"
      style={{
        width: `${scaledSize}px`,
        height: `${scaledSize}px`,
      }}
    >
      {/* Glow effect */}
      <div
        className="absolute inset-0 rounded-full blur-lg opacity-60 animate-pulse"
        style={{
          background: markerGlow,
        }}
      />

      {/* Main circle marker */}
      <div
        className="absolute inset-0 rounded-full shadow-lg flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${markerColor} 0%, ${markerColor}dd 100%)`,
          border: '2px solid rgba(255, 255, 255, 0.3)',
        }}
      >
        {/* Center icon */}
        {IconComponent ? (
          <IconComponent 
            className="fill-current" 
            style={{ 
              width: `${scaledSize * 0.5}px`, 
              height: `${scaledSize * 0.5}px`,
              color: iconColor 
            }} 
          />
        ) : type === 'search-result' ? (
          // Google "G" logo for search results
          <svg 
            viewBox="0 0 24 24" 
            style={{ 
              width: `${scaledSize * 0.55}px`, 
              height: `${scaledSize * 0.55}px` 
            }}
          >
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
        ) : (
          // LV monogram for rated locations
          <svg 
            viewBox="0 0 24 24" 
            style={{ 
              width: `${scaledSize * 0.6}px`, 
              height: `${scaledSize * 0.6}px` 
            }}
          >
            <text
              x="12"
              y="12"
              textAnchor="middle"
              dominantBaseline="central"
              style={{
                fontSize: '14px',
                fontWeight: '700',
                fontFamily: 'Georgia, serif',
                fill: iconColor,
                letterSpacing: '-0.5px'
              }}
            >
              LV
            </text>
          </svg>
        )}
      </div>

      {/* Rating badge - only for LV locations with ratings */}
      {hasLVRating && type === 'lv-location' && (
        <div
          className="absolute -top-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full shadow-lg backdrop-blur-sm border border-white/30 flex items-center gap-1"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.9) 100%)',
            fontSize: `${9 * scale}px`,
            fontWeight: '700',
            color: markerColor,
            minWidth: `${22 * scale}px`,
            textAlign: 'center',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            letterSpacing: '-0.3px'
          }}
        >
          {isFavorite && (
            <Heart 
              className="fill-current" 
              style={{ 
                width: `${10 * scale}px`, 
                height: `${10 * scale}px`,
                color: '#ef4444'
              }} 
            />
          )}
          <span>{rating.toFixed(1)}</span>
        </div>
      )}

      {/* Google rating badge for search results */}
      {type === 'search-result' && (
        <div
          className="absolute -top-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full shadow-lg backdrop-blur-sm border border-indigo-300"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(238,242,255,0.9) 100%)',
            fontSize: `${9 * scale}px`,
            fontWeight: '700',
            color: '#1a73e8', // Google blue for the rating text
            minWidth: `${22 * scale}px`,
            textAlign: 'center',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            letterSpacing: '-0.3px'
          }}
        >
          {rating.toFixed(1)}
        </div>
      )}

      {/* Small green dot for want-to-go when location HAS LV rating */}
      {hasLVRating && isWantToGo && (
        <div
          className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full shadow-md border border-white"
          style={{
            background: '#10b981',
          }}
        />
      )}
    </div>
  );
}