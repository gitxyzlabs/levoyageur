import React, { useState } from 'react';
import { X, MapPin, Star, DollarSign, Check, HelpCircle, XCircle } from 'lucide-react';

interface PlaceIdValidationPopupProps {
  michelinData: {
    id: number;
    name: string;
    address: string;
    location: string;
    lat: number;
    lng: number;
  };
  suggestedPlace: {
    id: string;
    displayName: string;
    formattedAddress: string;
    distance: number; // in meters
    rating?: number;
    userRatingCount?: number;
    priceLevel?: string;
    types?: string[];
    photoUri?: string;
  };
  confidenceScore: number; // 0-100
  onValidate: (status: 'confirmed' | 'rejected' | 'unsure') => void;
  onClose: () => void;
  isAuthenticated: boolean;
}

export function PlaceIdValidationPopup({
  michelinData,
  suggestedPlace,
  confidenceScore,
  onValidate,
  onClose,
  isAuthenticated,
}: PlaceIdValidationPopupProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleValidation = async (status: 'confirmed' | 'rejected' | 'unsure') => {
    setIsSubmitting(true);
    try {
      await onValidate(status);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getDistanceText = (meters: number) => {
    if (meters < 1) return 'Same location';
    if (meters < 1000) return `${Math.round(meters)}m away`;
    return `${(meters / 1000).toFixed(1)}km away`;
  };

  const getPriceLevelText = (priceLevel?: string) => {
    if (!priceLevel) return null;
    const levels: Record<string, string> = {
      'PRICE_LEVEL_FREE': 'Free',
      'PRICE_LEVEL_INEXPENSIVE': '$',
      'PRICE_LEVEL_MODERATE': '$$',
      'PRICE_LEVEL_EXPENSIVE': '$$$',
      'PRICE_LEVEL_VERY_EXPENSIVE': '$$$$',
    };
    return levels[priceLevel] || priceLevel;
  };

  const getTypeDisplay = (types?: string[]) => {
    if (!types || types.length === 0) return null;
    const displayTypes = types
      .filter(t => !['point_of_interest', 'establishment'].includes(t))
      .slice(0, 2)
      .map(t => t.replace(/_/g, ' '))
      .map(t => t.charAt(0).toUpperCase() + t.slice(1));
    return displayTypes.join(' • ');
  };

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-xl font-semibold text-slate-900">Sign In Required</h3>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-slate-600 mb-6">
            Please sign in to help validate Michelin restaurant locations.
          </p>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 rounded-t-2xl">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-xl font-semibold text-slate-900 mb-1">
                Help us confirm this location
              </h3>
              <p className="text-sm text-slate-500">
                Is this Google Place the same as our Michelin restaurant?
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 transition-colors ml-4"
              disabled={isSubmitting}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {/* Confidence Indicator */}
          {confidenceScore >= 70 && (
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 bg-slate-100 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    confidenceScore >= 90
                      ? 'bg-green-500'
                      : confidenceScore >= 70
                      ? 'bg-yellow-500'
                      : 'bg-orange-500'
                  }`}
                  style={{ width: `${confidenceScore}%` }}
                />
              </div>
              <span className="text-xs font-medium text-slate-600">
                {confidenceScore >= 90
                  ? 'High confidence'
                  : confidenceScore >= 70
                  ? 'Good match'
                  : 'Possible match'}
              </span>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          {/* Michelin Data */}
          <div className="mb-6">
            <div className="flex items-start gap-2 mb-2">
              <div className="mt-0.5">
                <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
                  <Star className="w-4 h-4 text-white fill-white" />
                </div>
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                  Michelin Guide
                </p>
                <h4 className="text-lg font-semibold text-slate-900 mb-1">
                  {michelinData.name}
                </h4>
                <div className="flex items-start gap-1.5 text-sm text-slate-600">
                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-400" />
                  <span>{michelinData.address || michelinData.location}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center">
              <span className="px-3 bg-white text-sm font-medium text-slate-500">
                Is this the same place?
              </span>
            </div>
          </div>

          {/* Google Place Data */}
          <div className="mb-6">
            {/* Photo if available */}
            {suggestedPlace.photoUri && (
              <div className="mb-4 rounded-lg overflow-hidden">
                <img 
                  src={suggestedPlace.photoUri} 
                  alt={suggestedPlace.displayName}
                  className="w-full h-48 object-cover"
                />
              </div>
            )}
            
            <div className="flex items-start gap-2 mb-2">
              <div className="mt-0.5">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-white" />
                </div>
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                  Google Places
                </p>
                <h4 className="text-lg font-semibold text-slate-900 mb-1">
                  {suggestedPlace.displayName}
                </h4>
                <div className="space-y-1.5">
                  <div className="flex items-start gap-1.5 text-sm text-slate-600">
                    <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-slate-400" />
                    <div>
                      <span className="block">{suggestedPlace.formattedAddress}</span>
                      <span className="text-xs text-green-600 font-medium mt-0.5 inline-block">
                        {getDistanceText(suggestedPlace.distance)}
                      </span>
                    </div>
                  </div>
                  
                  {/* Rating and details */}
                  <div className="flex items-center gap-3 text-sm">
                    {suggestedPlace.rating && (
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        <span className="font-medium text-slate-900">
                          {suggestedPlace.rating.toFixed(1)}
                        </span>
                        {suggestedPlace.userRatingCount && (
                          <span className="text-slate-500">
                            ({suggestedPlace.userRatingCount.toLocaleString()})
                          </span>
                        )}
                      </div>
                    )}
                    
                    {getPriceLevelText(suggestedPlace.priceLevel) && (
                      <div className="flex items-center gap-1 text-slate-600">
                        <DollarSign className="w-4 h-4" />
                        <span>{getPriceLevelText(suggestedPlace.priceLevel)}</span>
                      </div>
                    )}
                  </div>

                  {getTypeDisplay(suggestedPlace.types) && (
                    <p className="text-xs text-slate-500">
                      {getTypeDisplay(suggestedPlace.types)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2">
            <button
              onClick={() => handleValidation('confirmed')}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              <Check className="w-5 h-5" />
              Yes, Same Place
            </button>
            
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleValidation('unsure')}
                disabled={isSubmitting}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                <HelpCircle className="w-4 h-4" />
                Not Sure
              </button>
              
              <button
                onClick={() => handleValidation('rejected')}
                disabled={isSubmitting}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                <XCircle className="w-4 h-4" />
                No
              </button>
            </div>
          </div>

          {/* Helper Text */}
          <p className="mt-4 text-xs text-center text-slate-500">
            Your validation helps improve location data for all Le Voyageur users
          </p>
        </div>
      </div>
    </div>
  );
}