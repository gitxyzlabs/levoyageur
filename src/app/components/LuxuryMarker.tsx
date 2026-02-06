import { Heart, Bookmark, Star } from 'lucide-react';
import { MichelinFlower, MichelinStar, MichelinBib, MichelinPlate } from '@/app/components/MichelinIcons';

interface LuxuryMarkerProps {
  rating?: number; // Optional now - some markers may not have LV ratings
  scale?: number;
  showHeatMap?: boolean;
  isFavorite?: boolean;
  isWantToGo?: boolean;
  type?: 'lv-location' | 'search-result' | 'want-to-go';
  hasLVRating?: boolean; // Whether this location has an LV rating
  locationName?: string; // Place name to display when zoomed in
  currentZoom?: number; // Current map zoom level
  michelinScore?: number; // Michelin rating (1-5)
  favoritesCount?: number; // Total favorites count
  wantToGoCount?: number; // Total want-to-go count
}

// Color palette for different rating tiers
const getMarkerStyle = (rating: number) => {
  // 10+ Best in the World - Deep burgundy/maroon
  if (rating >= 10) return {
    primary: '#7a1f35', // Rich deep red
    secondary: '#5a1728',
    glow: 'rgba(122, 31, 53, 0.5)',
  };
  // 9+ World Class - Purple burgundy
  if (rating >= 9) return {
    primary: '#8e2d54', // Rich purple-burgundy
    secondary: '#6e2340',
    glow: 'rgba(142, 45, 84, 0.4)',
  };
  // 8+ Exceptional - Warm burgundy
  if (rating >= 8) return {
    primary: '#a84848', // Warm red-brown
    secondary: '#8a3838',
    glow: 'rgba(168, 72, 72, 0.4)',
  };
  // 7+ Very Good - Terra cotta
  if (rating >= 7) return {
    primary: '#c97b63', // Terra cotta
    secondary: '#a8624f',
    glow: 'rgba(201, 123, 99, 0.4)',
  };
  // 6+ Noteworthy - Teal
  if (rating >= 6) return {
    primary: '#2d6261', // Deep teal
    secondary: '#224a49',
    glow: 'rgba(45, 98, 97, 0.4)',
  };
  // 5+ Acceptable - Blue
  if (rating >= 5) return {
    primary: '#5383a8', // Medium blue
    secondary: '#416888',
    glow: 'rgba(83, 131, 168, 0.4)',
  };
  // 4+ Sub Par - Cool gray-blue
  if (rating >= 4) return {
    primary: '#6b7f8a', // Cool gray-blue
    secondary: '#556672',
    glow: 'rgba(107, 127, 138, 0.3)',
  };
  // 3+ Poor - Gray
  if (rating >= 3) return {
    primary: '#8a9a9d', // Medium gray
    secondary: '#6d7d80',
    glow: 'rgba(138, 154, 157, 0.3)',
  };
  // 2+ Awful - Light gray
  if (rating >= 2) return {
    primary: '#a8b5b8', // Light gray
    secondary: '#8a9799',
    glow: 'rgba(168, 181, 184, 0.2)',
  };
  // 0+ Worst in the World - Very light gray
  return {
    primary: '#d1d5d7', // Very light gray
    secondary: '#b8bfc2',
    glow: 'rgba(209, 213, 215, 0.2)',
  };
};

export function LuxuryMarker({ 
  rating = 5, 
  scale = 1, 
  showHeatMap = false,
  isFavorite = false,
  isWantToGo = false,
  type = 'lv-location',
  hasLVRating = true,
  locationName,
  currentZoom,
  michelinScore,
  favoritesCount,
  wantToGoCount
}: LuxuryMarkerProps) {
  // Michelin red color from the logo
  const michelinRed = '#9b2743';
  
  // Determine marker appearance based on state
  let markerColor: string;
  let innerGradientColor: string;
  let markerGlow: string;
  let IconComponent: any = null;
  let iconColor: string;

  // Special handling for Michelin locations
  if (michelinScore && michelinScore > 0 && type === 'lv-location') {
    if (!hasLVRating) {
      // Michelin rating but NO LV rating
      // If it's in Want to Go list, use green outer ring, otherwise use Michelin red
      if (isWantToGo) {
        markerColor = '#10b981'; // Green for Want to Go
        innerGradientColor = '#ffffff';
        markerGlow = 'rgba(16, 185, 129, 0.4)';
        iconColor = '#ffffff';
      } else {
        // Standard Michelin red
        markerColor = michelinRed;
        innerGradientColor = '#ffffff';
        markerGlow = 'rgba(155, 39, 67, 0.4)';
        iconColor = '#ffffff';
      }
    } else {
      // Michelin rating AND LV rating: LV color outer, white inner gradient
      const style = getMarkerStyle(rating);
      markerColor = style.primary;
      innerGradientColor = '#ffffff';
      markerGlow = style.glow;
      iconColor = '#ffffff';
    }
  } else if (!hasLVRating && isFavorite) {
    // Red circle with heart for favorited non-LV locations
    markerColor = '#ef4444';
    innerGradientColor = '#ef4444dd';
    markerGlow = 'rgba(239, 68, 68, 0.4)';
    IconComponent = Heart;
    iconColor = '#ffffff';
  } else if (!hasLVRating && isWantToGo) {
    // Green circle with bookmark for want-to-go non-LV locations
    markerColor = '#10b981';
    innerGradientColor = '#10b981dd';
    markerGlow = 'rgba(16, 185, 129, 0.4)';
    IconComponent = Bookmark;
    iconColor = '#ffffff';
  } else if (type === 'search-result') {
    // Use 0-score color for Google search results
    const style = getMarkerStyle(0);
    markerColor = style.primary;
    innerGradientColor = `${style.primary}dd`;
    markerGlow = style.glow;
    iconColor = '#1a73e8'; // Google blue for the logo
  } else {
    // Use rating-based colors for LV locations
    const style = getMarkerStyle(rating);
    markerColor = style.primary;
    innerGradientColor = `${style.primary}dd`;
    markerGlow = style.glow;
    iconColor = '#ffffff';
  }

  const size = 36;
  const scaledSize = size * scale;
  
  // Show labels when zoomed in beyond level 15
  const showLabel = currentZoom !== undefined && currentZoom >= 15 && locationName;
  
  // Show Michelin badge when zoomed in beyond level 14
  const showMichelinBadge = currentZoom !== undefined && currentZoom >= 14;

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

      {/* Outer ring - colored border */}
      <div
        className="absolute inset-0 rounded-full shadow-lg flex items-center justify-center"
        style={{
          background: markerColor,
          border: '2px solid rgba(255, 255, 255, 0.3)',
        }}
      >
        {/* Inner white circle - for Michelin locations */}
        {michelinScore && michelinScore > 0 && type === 'lv-location' && (
          <div
            className="absolute rounded-full"
            style={{
              width: `${scaledSize * 0.7}px`,
              height: `${scaledSize * 0.7}px`,
              background: '#ffffff',
            }}
          />
        )}

        {/* Center icon */}
        {IconComponent ? (
          <IconComponent 
            className="fill-current relative z-10" 
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
            className="relative z-10"
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
          // LV monogram for rated locations (or Michelin clover if has Michelin score)
          michelinScore && michelinScore > 0 ? (
            // Show Michelin clover logo
            <MichelinFlower 
              className="relative z-10" 
              style={{ 
                width: `${scaledSize * 0.50}px`, 
                height: `${scaledSize * 0.50}px`
              }} 
            />
          ) : (
            // Show LV monogram
            <svg 
              viewBox="0 0 24 24" 
              className="relative z-10"
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
          )
        )}
      </div>

      {/* Rating badge - only for LV locations with ratings */}
      {hasLVRating && type === 'lv-location' && (
        <div
          className="absolute left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full shadow-lg backdrop-blur-sm border border-white/30 flex items-center gap-1"
          style={{
            top: `${-12 * scale}px`, // Position higher above the marker
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
          {isWantToGo ? (
            <Bookmark 
              className="fill-current" 
              style={{ 
                width: `${10 * scale}px`, 
                height: `${10 * scale}px`,
                color: '#10b981' // Green for want-to-go
              }} 
            />
          ) : isFavorite ? (
            <Heart 
              className="fill-current" 
              style={{ 
                width: `${10 * scale}px`, 
                height: `${10 * scale}px`,
                color: '#ef4444' // Red for favorites
              }} 
            />
          ) : null}
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

      {/* Michelin Score Badge - shows on the right side */}
      {michelinScore && michelinScore > 0 && type === 'lv-location' && showMichelinBadge && (
        <div
          className="absolute top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg shadow-xl backdrop-blur-md border border-white/40 flex items-center justify-center"
          style={{
            right: `${-40 * scale}px`,
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.97) 0%, rgba(250, 250, 251, 0.94) 100%)',
            minWidth: `${32 * scale}px`,
            height: `${24 * scale}px`,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.08)',
          }}
        >
          {michelinScore <= 3 ? (
            // Show 1-3 Michelin stars
            <div className="flex items-center justify-center gap-0.5">
              {Array.from({ length: michelinScore }).map((_, i) => (
                <MichelinStar 
                  key={i}
                  style={{ 
                    width: `${8 * scale}px`, 
                    height: `${8 * scale}px`
                  }} 
                />
              ))}
            </div>
          ) : michelinScore === 4 ? (
            // Bib Gourmand
            <MichelinBib 
              style={{ 
                width: `${16 * scale}px`, 
                height: `${16 * scale}px`
              }} 
            />
          ) : (
            // Michelin Plate
            <MichelinPlate 
              style={{ 
                width: `${16 * scale}px`, 
                height: `${16 * scale}px`
              }} 
            />
          )}
        </div>
      )}

      {/* Location name label - appears below marker when zoomed in */}
      {showLabel && (
        <div
          className="absolute left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg shadow-lg backdrop-blur-md border border-white/40 whitespace-nowrap"
          style={{
            top: `${scaledSize + 4}px`, // Position below the marker with 4px gap
            background: 'linear-gradient(135deg, rgba(255,255,255,0.98) 0%, rgba(248,250,252,0.95) 100%)',
            fontSize: '11px',
            fontWeight: '600',
            color: '#1f2937',
            textAlign: 'center',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            letterSpacing: '-0.2px',
            maxWidth: '150px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {locationName}
        </div>
      )}

      {/* Favorites Counter - 10 o'clock position (upper left) */}
      {favoritesCount !== undefined && favoritesCount > 0 && (
        <div
          className="absolute flex items-center gap-1 px-1.5 py-0.5 rounded-full shadow-md backdrop-blur-sm border border-white/40"
          style={{
            left: `${-30 * scale}px`,
            top: `${-7 * scale}px`,
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.97) 0%, rgba(254, 242, 242, 0.95) 100%)',
            fontSize: `${8 * scale}px`,
            fontWeight: '600',
            color: '#ef4444',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            zIndex: 20,
          }}
        >
          <Heart 
            className="fill-current" 
            style={{ 
              width: `${8 * scale}px`, 
              height: `${8 * scale}px`,
              color: '#ef4444'
            }} 
          />
          <span>{favoritesCount}</span>
        </div>
      )}

      {/* Want to Go Counter - 9 o'clock position (left side) */}
      {wantToGoCount !== undefined && wantToGoCount > 0 && (
        <div
          className="absolute flex items-center gap-1 px-1.5 py-0.5 rounded-full shadow-md backdrop-blur-sm border border-white/40"
          style={{
            left: `${-18 * scale}px`,
            top: `${8 * scale}px`,
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.97) 0%, rgba(240, 253, 244, 0.95) 100%)',
            fontSize: `${8 * scale}px`,
            fontWeight: '600',
            color: '#10b981',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            zIndex: 20,
          }}
        >
          <Bookmark 
            className="fill-current" 
            style={{ 
              width: `${8 * scale}px`, 
              height: `${8 * scale}px`,
              color: '#10b981'
            }} 
          />
          <span>{wantToGoCount}</span>
        </div>
      )}
    </div>
  );
}