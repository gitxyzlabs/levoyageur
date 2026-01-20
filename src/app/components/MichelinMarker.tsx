/**
 * MichelinMarker Component
 * 
 * Displays custom Michelin-branded markers with appropriate logos:
 * - 1-3 Stars: Michelin star markers
 * - Bib Gourmand: Michelin Bib icon
 * - Plate: Michelin Plate icon
 * 
 * When combined with LV ratings, shows Michelin badge on left side of marker
 */

interface MichelinMarkerProps {
  michelinScore: number; // 1-3 stars, 4 = Bib Gourmand, 5 = Plate
  scale?: number;
  currentZoom?: number;
  locationName?: string;
  hasLVRating?: boolean; // If true, shows smaller badge on left side
  lvRating?: number; // LV rating for combined markers
}

const getMichelinColor = (score: number) => {
  if (score >= 1 && score <= 3) {
    // Michelin stars: Use red for star ratings
    return {
      primary: '#D02F2F', // Michelin red
      secondary: '#A52424',
      glow: 'rgba(208, 47, 47, 0.4)',
    };
  } else if (score === 4) {
    // Bib Gourmand: Red/Orange
    return {
      primary: '#D02F2F',
      secondary: '#A52424',
      glow: 'rgba(208, 47, 47, 0.4)',
    };
  } else {
    // Michelin Plate: Gray
    return {
      primary: '#6B7280',
      secondary: '#4B5563',
      glow: 'rgba(107, 116, 128, 0.3)',
    };
  }
};

const renderMichelinIcon = (score: number, size: number) => {
  if (score >= 1 && score <= 3) {
    // Render Michelin stars
    return (
      <div className="flex items-center justify-center gap-0.5">
        {Array.from({ length: score }).map((_, i) => (
          <svg
            key={i}
            viewBox="0 0 24 24"
            fill="#FFFFFF"
            style={{ width: `${size * 0.35}px`, height: `${size * 0.35}px` }}
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        ))}
      </div>
    );
  } else if (score === 4) {
    // Bib Gourmand - Michelin Man face
    return (
      <svg
        viewBox="0 0 24 24"
        fill="#FFFFFF"
        style={{ width: `${size * 0.6}px`, height: `${size * 0.6}px` }}
      >
        {/* Simplified Bib Gourmand icon - smiling face */}
        <circle cx="12" cy="12" r="10" fill="none" stroke="#FFFFFF" strokeWidth="2" />
        <circle cx="9" cy="10" r="1.5" fill="#FFFFFF" />
        <circle cx="15" cy="10" r="1.5" fill="#FFFFFF" />
        <path d="M 8 14 Q 12 17 16 14" stroke="#FFFFFF" strokeWidth="2" fill="none" strokeLinecap="round" />
      </svg>
    );
  } else {
    // Michelin Plate - Fork and Knife
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ width: `${size * 0.55}px`, height: `${size * 0.55}px` }}
      >
        <path d="M3 2v7c0 1.1.9 2 2 2h0c1.1 0 2-.9 2-2V2M7 2v20M21 15V2M17 15V2M21 15c0 1.1-.9 2-2 2s-2-.9-2-2" />
      </svg>
    );
  }
};

export function MichelinMarker({
  michelinScore,
  scale = 1,
  currentZoom,
  locationName,
  hasLVRating = false,
  lvRating,
}: MichelinMarkerProps) {
  const style = getMichelinColor(michelinScore);
  const size = hasLVRating ? 28 : 36; // Smaller if combined with LV
  const scaledSize = size * scale;
  const showLabel = currentZoom !== undefined && currentZoom >= 15 && locationName;

  // If this is a combined marker (has LV rating), render as a badge
  if (hasLVRating && lvRating !== undefined) {
    return (
      <div
        className="absolute -left-2 top-1/2 -translate-y-1/2 px-1.5 py-1 rounded-full shadow-lg border-2 border-white flex items-center justify-center z-10"
        style={{
          background: `linear-gradient(135deg, ${style.primary} 0%, ${style.secondary} 100%)`,
          width: `${scaledSize}px`,
          height: `${scaledSize}px`,
        }}
        title={`Michelin ${michelinScore <= 3 ? michelinScore + ' Star' + (michelinScore > 1 ? 's' : '') : michelinScore === 4 ? 'Bib Gourmand' : 'Plate'}`}
      >
        {renderMichelinIcon(michelinScore, scaledSize)}
      </div>
    );
  }

  // Standalone Michelin marker
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
          background: style.glow,
        }}
      />

      {/* Main circle marker */}
      <div
        className="absolute inset-0 rounded-full shadow-lg flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${style.primary} 0%, ${style.secondary} 100%)`,
          border: '2px solid rgba(255, 255, 255, 0.3)',
        }}
      >
        {renderMichelinIcon(michelinScore, scaledSize)}
      </div>

      {/* Michelin badge with text */}
      <div
        className="absolute -top-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full shadow-lg backdrop-blur-sm border border-white/30"
        style={{
          background: 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.9) 100%)',
          fontSize: `${9 * scale}px`,
          fontWeight: '700',
          color: style.primary,
          minWidth: `${22 * scale}px`,
          textAlign: 'center',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          letterSpacing: '-0.3px',
        }}
      >
        {michelinScore <= 3 
          ? `${michelinScore}★` 
          : michelinScore === 4 
            ? 'BIB' 
            : 'PLATE'}
      </div>

      {/* Location name label */}
      {showLabel && (
        <div
          className="absolute left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-lg shadow-lg backdrop-blur-md border border-white/40 whitespace-nowrap"
          style={{
            top: `${scaledSize + 4}px`,
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
    </div>
  );
}
