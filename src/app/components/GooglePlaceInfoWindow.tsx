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
  onFavoriteToggle?: (locationId: string, placeData?: { name?: string; lat?: number; lng?: number; formatted_address?: string; place_id?: string }) => void;
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
      zIndex={9999}
    >
      <div className="w-[380px] max-h-[calc(100vh-120px)] overflow-y-auto">
        {/* Header with Title and Quick Actions */}
        <div className="flex items-start justify-between mb-3 px-4 pt-4 sticky top-0 bg-white z-10">
          <div className="flex-1 min-w-0 pr-3">
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
          
          {/* Quick Access Icons */}
          <div className="flex items-center gap-2">
            {/* Favorite Heart Icon */}
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
                    formatted_address: place.formatted_address,
                    place_id: place.place_id
                  });
                }
              }}
              className={`p-2 rounded-full transition-all hover:scale-110 ${ 
                favoriteIds?.has(place.place_id || '')
                  ? 'bg-red-100 hover:bg-red-200 ring-2 ring-red-300'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
              title="Favorite"
            >
              <Heart className={`w-4 h-4 ${
                favoriteIds?.has(place.place_id || '') 
                  ? 'fill-red-500 stroke-red-500' 
                  : 'stroke-gray-600'
              }`} />
            </button>
            
            {/* Want to Go Bookmark Icon */}
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
              className={`p-2 rounded-full transition-all hover:scale-110 ${
                wantToGoIds?.has(place.place_id || '')
                  ? 'bg-green-50 hover:bg-green-100'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
              title="Want to Go"
            >
              <Bookmark className={`w-4 h-4 ${
                wantToGoIds?.has(place.place_id || '') 
                  ? 'fill-green-500 stroke-green-500' 
                  : 'stroke-gray-600'
              }`} />
            </button>
            
            {/* Editor Icon (if editor) */}
            {isAuthenticated && user?.role === 'editor' && (
              <button 
                onClick={() => setShowEditorModal(true)}
                className="p-2 rounded-full bg-amber-50 hover:bg-amber-100 transition-all hover:scale-110"
                title="Edit LV Rating"
              >
                <Edit3 className="w-4 h-4 text-amber-600" />
              </button>
            )}
          </div>
        </div>

        {/* Photo Carousel */}
        {photos.length > 0 ? (
          <div className="relative mb-3 bg-gray-100 rounded-lg overflow-hidden mx-4">
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
          <div className="mb-3 bg-gradient-to-br from-amber-50 to-rose-50 rounded-lg p-6 text-center mx-4">
            <Award className="w-10 h-10 text-amber-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600">No photos available</p>
          </div>
        )}

        <div className="px-4 pb-4">
          {/* Ratings Section - Unified Style */}
          <div className="space-y-2 mb-3">
            {/* LV Editors Score - if available */}
            {lvLocation?.lvEditorsScore && (
              <div className="flex items-center justify-between text-sm pb-2 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-600" />
                  <span className="text-gray-600">Le Voyageur</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium text-amber-700 w-8 text-right">
                    {lvLocation.lvEditorsScore.toFixed(1)}
                  </span>
                  <span className="text-xs text-gray-500">/10</span>
                </div>
              </div>
            )}

            {/* Favorites Counter - only show if count > 0 */}
            {lvLocation && lvLocation.favoritesCount && lvLocation.favoritesCount > 0 && (
              <div className="flex items-center justify-between text-sm pb-2 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <Heart className="w-4 h-4 text-red-500" />
                  <span className="text-gray-600">Favorite</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium text-red-600">
                    {lvLocation.favoritesCount}
                  </span>
                </div>
              </div>
            )}

            {/* Google Rating */}
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-600" />
                <span className="text-gray-600">Google Rating</span>
              </div>
              <div className="flex items-center gap-2">
                {renderStars(place.rating ?? null)}
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium text-gray-900 w-8 text-right">
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
          </div>

          {/* LV Tags - Show when available */}
          {lvLocation?.tags && lvLocation.tags.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center gap-1.5 mb-2">
                <svg className="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <p className="text-xs font-semibold text-amber-700">tags</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {lvLocation.tags.map((tag, idx) => (
                  <span 
                    key={idx}
                    className="text-xs px-3 py-1.5 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-800 rounded-full font-medium border border-amber-300 shadow-sm"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Types/Categories */}
          {place.types && place.types.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">Categories</p>
              <div className="flex flex-wrap gap-1">
                {place.types.slice(0, 3).map((type, idx) => (
                  <span 
                    key={idx}
                    className="text-xs px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full"
                  >
                    {type.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 mb-3">
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
                    formatted_address: place.formatted_address,
                    place_id: place.place_id
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
            <div className="mt-3">
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
              placeData={{
                name: place.name || 'Unknown Place',
                lat,
                lng,
                formatted_address: place.formatted_address,
                rating: place.rating,
              }}
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