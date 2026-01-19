import { toast } from 'sonner';
import { useState, useEffect, useMemo } from 'react';
import { InfoWindow } from '@vis.gl/react-google-maps';
import { Award, Users, Star, ChevronLeft, ChevronRight, MapPin, Edit3, Navigation, Heart, Bookmark, Calendar } from 'lucide-react';
import { EditorRatingModal } from './EditorRatingModal';
import { api, type Location } from '../../utils/api';

interface GooglePlaceInfoWindowProps {
  place: google.maps.places.PlaceResult;
  onClose: () => void;
  user: { id: string; email: string; name: string; role: 'user' | 'editor' } | null;
  isAuthenticated: boolean;
  onFavoriteToggle?: (locationId: string, placeData?: { name?: string; lat?: number; lng?: number; formatted_address?: string }) => void;
  onWantToGoToggle?: (locationId: string) => void;
  favoriteIds?: Set<string>;
  wantToGoIds?: Set<string>;
  lvLocation?: Location | null; // LV location data if this is an LV marker
}

export function GooglePlaceInfoWindow({ 
  place, 
  onClose,
  user,
  isAuthenticated,
  onFavoriteToggle,
  onWantToGoToggle,
  favoriteIds,
  wantToGoIds,
  lvLocation
}: GooglePlaceInfoWindowProps) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showEditorModal, setShowEditorModal] = useState(false);

  // Process photos from the place object (already fetched by Map component)
  const photos = useMemo(() => {
    if (!place.photos || place.photos.length === 0) return [];
    
    return place.photos.slice(0, 5).map((photo: any) => {
      // Handle both old and new Places API photo formats
      if (typeof photo.getURI === 'function') {
        return {
          photoReference: photo.getURI({ maxWidth: 400 }),
          width: photo.widthPx || 400,
          height: photo.heightPx || 300,
        };
      } else if (photo.getUrl) {
        return {
          photoReference: photo.getUrl({ maxWidth: 400 }),
          width: 400,
          height: 300,
        };
      }
      return null;
    }).filter(Boolean);
  }, [place.photos]);

  // Reset photo index when place changes
  useEffect(() => {
    setCurrentPhotoIndex(0);
  }, [place.place_id]);

  const nextPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev + 1) % photos.length);
  };

  const prevPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  const renderStars = (rating: number | null) => {
    if (rating == null) return <span className="text-xs text-gray-400">No rating</span>;
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5 ? 1 : 0;
    const empty = 5 - full - half;
    return (
      <span className="text-amber-400 text-sm">
        {'★'.repeat(full)}
        {half === 1 && '½'}
        {'☆'.repeat(empty)}
      </span>
    );
  };

  const lat = place.geometry?.location 
    ? (typeof place.geometry.location.lat === 'function' ? place.geometry.location.lat() : place.geometry.location.lat)
    : 0;
  const lng = place.geometry?.location 
    ? (typeof place.geometry.location.lng === 'function' ? place.geometry.location.lng() : place.geometry.location.lng)
    : 0;

  console.log('📊 InfoWindow Render:', {
    name: place.name,
    hasLVLocation: !!lvLocation,
    lvEditorsScore: lvLocation?.lvEditorsScore,
    lvCrowdScore: lvLocation?.lvCrowdsourceScore,
    googleRating: place.rating,
    googleRatingCount: place.user_ratings_total,
    photoCount: photos.length,
    rawPhotosLength: place.photos?.length || 0,
    tags: lvLocation?.tags,
    types: place.types,
    placeId: place.place_id
  });

  return (
    <InfoWindow
      position={{ lat, lng }}
      onCloseClick={onClose}
      headerDisabled
      disableAutoPan={false}
      pixelOffset={[0, -10]}
    >
      <div className="max-w-sm">
        {/* Header with Title */}
        <div className="flex items-start justify-between mb-3 px-4 pt-4">
          <div className="flex-1">
            <h3 className="font-bold text-lg text-gray-900 mb-1">{place.name || 'Unknown Place'}</h3>
            {place.formatted_address && (
              <button
                onClick={() => {
                  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.formatted_address || '')}`;
                  window.open(url, '_blank');
                }}
                className="text-xs text-blue-600 hover:text-blue-700 hover:underline cursor-pointer transition-colors text-left flex items-center gap-1"
              >
                <MapPin className="w-3 h-3" />
                {place.formatted_address}
              </button>
            )}
          </div>
          {isAuthenticated && user?.role === 'editor' && (
            <button 
              onClick={() => setShowEditorModal(true)}
              className="text-gray-500 hover:text-gray-700"
            >
              <Edit3 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Photo Carousel */}
        {photos.length > 0 ? (
          <div className="relative mb-4 bg-gray-100 rounded-lg overflow-hidden">
            <div className="aspect-video">
              <img
                src={photos[currentPhotoIndex].photoReference}
                alt={`${place.name} - Photo ${currentPhotoIndex + 1}`}
                className="w-full h-full object-cover"
              />
            </div>
            
            {photos.length > 1 && (
              <>
                {/* Navigation Buttons */}
                <button
                  onClick={prevPhoto}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-1.5 rounded-full shadow-lg transition-all"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-800" />
                </button>
                <button
                  onClick={nextPhoto}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-1.5 rounded-full shadow-lg transition-all"
                >
                  <ChevronRight className="w-4 h-4 text-gray-800" />
                </button>

                {/* Photo Indicators */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {photos.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentPhotoIndex(idx)}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${
                        idx === currentPhotoIndex 
                          ? 'bg-white w-4' 
                          : 'bg-white/60 hover:bg-white/80'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="mb-4 bg-gradient-to-br from-amber-50 to-rose-50 rounded-lg p-8 text-center">
            <Award className="w-12 h-12 text-amber-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600">No photos available</p>
          </div>
        )}

        <div className="px-4 pb-4">
          {/* LV Ratings - Show PROMINENTLY when available */}
          {lvLocation && (lvLocation.lvEditorsScore || lvLocation.lvCrowdsourceScore) && (
            <div className="space-y-2 mb-4 p-3 bg-gradient-to-br from-amber-50 to-rose-50 rounded-lg border border-amber-200">
              {lvLocation.lvEditorsScore && (
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-amber-600" />
                    <span className="text-gray-700 font-medium">LV Editors Score</span>
                  </div>
                  <span className="text-lg font-bold text-amber-700">
                    {lvLocation.lvEditorsScore.toFixed(1)}
                    <span className="text-xs text-gray-600 ml-1">/11.0</span>
                  </span>
                </div>
              )}
              {lvLocation.lvCrowdsourceScore && (
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-rose-600" />
                    <span className="text-gray-700 font-medium">LV Crowd Score</span>
                  </div>
                  <span className="text-lg font-bold text-rose-700">
                    {lvLocation.lvCrowdsourceScore.toFixed(1)}
                    <span className="text-xs text-gray-600 ml-1">/10.0</span>
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Google Rating */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-600" />
                <span className="text-gray-600">Google Rating</span>
              </div>
              <div className="flex items-center gap-2">
                {renderStars(place.rating ?? null)}
                <span className="text-sm font-medium text-gray-900">
                  {place.rating?.toFixed(1) || 'N/A'}
                </span>
                {place.user_ratings_total && (
                  <span className="text-xs text-gray-500">
                    ({place.user_ratings_total.toLocaleString()})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* LV Tags - Show when available */}
          {lvLocation?.tags && lvLocation.tags.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-amber-700 mb-1.5">LV Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {lvLocation.tags.map((tag, idx) => (
                  <span 
                    key={idx}
                    className="text-xs px-2.5 py-1 bg-gradient-to-r from-amber-100 to-rose-100 text-amber-900 rounded-full font-medium border border-amber-200"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Types/Categories */}
          {place.types && place.types.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-600 mb-1">Categories</p>
              <div className="flex flex-wrap gap-1">
                {place.types.slice(0, 3).map((type, idx) => (
                  <span 
                    key={idx}
                    className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full"
                  >
                    {type.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              onClick={async () => {
                if (!isAuthenticated) {
                  toast.error('Please sign in to add favorites');
                  return;
                }
                
                if (!place.place_id) {
                  toast.error('Unable to save this location');
                  return;
                }

                if (onFavoriteToggle) {
                  onFavoriteToggle(place.place_id, {
                    name: place.name,
                    lat,
                    lng,
                    formatted_address: place.formatted_address
                  });
                }
              }}
              className={`flex items-center justify-center gap-1.5 px-3 py-2.5 border rounded-lg text-xs font-medium transition-all ${
                favoriteIds?.has(place.place_id || '')
                  ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200'
                  : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${favoriteIds?.has(place.place_id || '') ? 'fill-red-500 stroke-red-500' : ''}`} />
              Favorite
            </button>
            
            <button
              onClick={async () => {
                if (!isAuthenticated) {
                  toast.error('Please sign in to add to Want to Go');
                  return;
                }

                if (!place.place_id) {
                  toast.error('Unable to save this location');
                  return;
                }

                if (onWantToGoToggle) {
                  onWantToGoToggle(place.place_id);
                }
              }}
              className={`flex items-center justify-center gap-1.5 px-3 py-2.5 border rounded-lg text-xs font-medium transition-all ${
                wantToGoIds?.has(place.place_id || '')
                  ? 'bg-green-50 hover:bg-green-100 text-green-700 border-green-200'
                  : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${wantToGoIds?.has(place.place_id || '') ? 'fill-green-500 stroke-green-500' : ''}`} />
              Want to Go
            </button>
            
            <button
              onClick={() => {
                toast.info('Reservations feature coming soon!');
              }}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-lg text-xs font-medium transition-all"
            >
              <Calendar className="w-3.5 h-3.5" />
              Reserve
            </button>
            
            <button
              onClick={() => {
                const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
                window.open(url, '_blank');
              }}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-medium transition-all"
            >
              <Navigation className="w-3.5 h-3.5" />
              Directions
            </button>
          </div>

          {/* Editor Rating Section - Only visible to editors */}
          {isAuthenticated && user?.role === 'editor' && (
            <div className="mt-4">
              <button
                onClick={() => setShowEditorModal(true)}
                className="w-full p-3 bg-gradient-to-br from-amber-50 to-rose-50 hover:from-amber-100 hover:to-rose-100 rounded-lg border border-amber-200 transition-all"
              >
                <p className="text-xs text-gray-700 text-center font-medium flex items-center justify-center gap-2">
                  <Award className="w-4 h-4 text-amber-600" />
                  {lvLocation?.lvEditorsScore ? 'Update LV Rating' : 'Add LV Rating'}
                </p>
              </button>
            </div>
          )}

          {/* Editor Rating Modal */}
          {showEditorModal && place.place_id && (
            <EditorRatingModal
              locationId={place.place_id}
              locationName={place.name || 'Unknown Place'}
              currentRating={lvLocation?.lvEditorsScore}
              currentTags={lvLocation?.tags || []}
              onClose={() => setShowEditorModal(false)}
              onSuccess={() => {
                toast.success('Rating updated successfully!');
                setShowEditorModal(false);
              }}
            />
          )}
        </div>
      </div>
    </InfoWindow>
  );
}