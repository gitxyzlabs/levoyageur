import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom/client';
import { X } from 'lucide-react';
import { Award, Users, Star, ChevronLeft, ChevronRight, MapPin, Edit3, Navigation, Heart, Bookmark, Calendar } from 'lucide-react';
import { EditorRatingModal } from './EditorRatingModal';
import { api, type Location } from '../../utils/api';
import { InfoWindow } from '@vis.gl/react-google-maps';
import { toast } from 'sonner';
import { MichelinFlower, MichelinStar, MichelinBib, MichelinPlate, MichelinGreenStar } from '@/app/components/MichelinIcons';
import { GoogleReviewsModal } from './GoogleReviewsModal';
import { PhotoGalleryModal } from './PhotoGalleryModal';
import { projectId, publicAnonKey } from '/utils/supabase/info';

// GooglePlaceInfoWindow - Displays detailed information about a selected place
interface GooglePlaceInfoWindowProps {
  place: google.maps.places.PlaceResult;
  onClose: () => void;
  user: { id: string; email: string; name: string; role: 'user' | 'editor' } | null;
  isAuthenticated: boolean;
  onFavoriteToggle?: (locationId: string, placeData?: { name?: string; lat?: number; lng?: number; formatted_address?: string; place_id?: string }) => void;
  onWantToGoToggle?: (locationId: string, placeData?: { name?: string; lat?: number; lng?: number; formatted_address?: string; place_id?: string }) => void;
  onRatingAdded?: () => void;
  favoriteIds?: Set<string>;
  wantToGoIds?: Set<string>;
  lvLocation?: Location | null;
  onRefresh?: () => void;
}

export function GooglePlaceInfoWindow({ 
  place, 
  onClose,
  user,
  isAuthenticated,
  onFavoriteToggle,
  onWantToGoToggle,
  onRatingAdded,
  favoriteIds,
  wantToGoIds,
  lvLocation,
  onRefresh
}: GooglePlaceInfoWindowProps) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [showReviewsModal, setShowReviewsModal] = useState(false);
  const [showPhotoGallery, setShowPhotoGallery] = useState(false);
  const [placeDetails, setPlaceDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [michelinData, setMichelinData] = useState<{ score: number | null; loading: boolean }>({ 
    score: null, 
    loading: true 
  });

  // Fetch Michelin rating from database when place changes
  useEffect(() => {
    async function fetchMichelinRating() {
      if (!place.geometry?.location) {
        setMichelinData({ score: null, loading: false });
        return;
      }

      setMichelinData({ score: null, loading: true });

      try {
        const lat = typeof place.geometry.location.lat === 'function' 
          ? place.geometry.location.lat() 
          : place.geometry.location.lat;
        const lng = typeof place.geometry.location.lng === 'function' 
          ? place.geometry.location.lng() 
          : place.geometry.location.lng;

        const result = await api.getMichelinRating(lat, lng, place.name);
        setMichelinData({ score: result.michelinScore, loading: false });
      } catch (error) {
        console.error('Error fetching Michelin rating:', error);
        setMichelinData({ score: null, loading: false });
      }
    }

    fetchMichelinRating();
  }, [place.place_id, place.name, place.geometry?.location]);

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

  // Function to fetch full place details with reviews and all photos
  const fetchPlaceDetails = async () => {
    if (!place.place_id || loadingDetails || placeDetails) return;
    
    setLoadingDetails(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-48182530/google-places/${place.place_id}/details`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch place details');
      }
      
      const data = await response.json();
      setPlaceDetails(data);
      console.log('📍 Fetched place details:', data);
    } catch (error) {
      console.error('Error fetching place details:', error);
      toast.error('Failed to load reviews and photos');
    } finally {
      setLoadingDetails(false);
    }
  };

  // Function to open reviews modal
  const handleOpenReviews = async () => {
    if (!placeDetails) {
      await fetchPlaceDetails();
    }
    setShowReviewsModal(true);
  };

  // Function to open photo gallery
  const handleOpenPhotoGallery = async () => {
    if (!placeDetails) {
      await fetchPlaceDetails();
    }
    setShowPhotoGallery(true);
  };

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
    placeId: place.place_id,
    michelinStars: lvLocation?.michelinStars,
    michelinDistinction: lvLocation?.michelinDistinction,
    michelinGreenStar: lvLocation?.michelinGreenStar,
    cuisine: lvLocation?.cuisine
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
            
            {/* Want to Go Button */}
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
                  // Extract lat/lng from place
                  const lat = place.geometry?.location?.lat ? 
                    (typeof place.geometry.location.lat === 'function' ? place.geometry.location.lat() : place.geometry.location.lat) : undefined;
                  const lng = place.geometry?.location?.lng ? 
                    (typeof place.geometry.location.lng === 'function' ? place.geometry.location.lng() : place.geometry.location.lng) : undefined;
                  
                  onWantToGoToggle(place.place_id, {
                    name: place.name,
                    lat,
                    lng,
                    formatted_address: place.formatted_address,
                    place_id: place.place_id
                  });
                }
              }}
              className={`p-2 rounded-full transition-all hover:scale-110 ${
                wantToGoIds?.has(place.place_id || '')
                  ? 'bg-green-500 hover:bg-green-600'
                  : 'bg-gray-100 hover:bg-gray-200'
              }`}
              title={wantToGoIds?.has(place.place_id || '') ? 'Remove from Want to Go' : 'Add to Want to Go'}
            >
              <Bookmark className={`w-4 h-4 ${
                wantToGoIds?.has(place.place_id || '') 
                  ? 'fill-white stroke-white' 
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
          <div 
            className="relative mb-3 bg-gray-100 rounded-lg overflow-hidden mx-4 cursor-pointer group"
            onClick={handleOpenPhotoGallery}
            title="Click to view all photos"
          >
            <div className="aspect-video">
              <img
                src={photos[currentPhotoIndex].photoReference}
                alt={`${place.name} - Photo ${currentPhotoIndex + 1}`}
                className="w-full h-full object-cover"
              />
            </div>
            
            {/* View All Photos overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 flex items-center justify-center">
              <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium text-gray-900">
                View All Photos
              </div>
            </div>
            
            {photos.length > 1 && (
              <>
                {/* Navigation Buttons */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    prevPhoto();
                  }}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-1.5 rounded-full shadow-lg transition-all z-10"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-800" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    nextPhoto();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-1.5 rounded-full shadow-lg transition-all z-10"
                >
                  <ChevronRight className="w-4 h-4 text-gray-800" />
                </button>

                {/* Photo Indicators */}
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                  {photos.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentPhotoIndex(idx);
                      }}
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

            {/* Michelin Guide - Show when Michelin data is available */}
            {(lvLocation?.michelinStars || lvLocation?.michelinDistinction || lvLocation?.michelinGreenStar) && (
              <div className="flex items-center justify-between text-sm pb-2 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <MichelinFlower className="w-4 h-4 text-red-600" />
                  <span className="text-gray-600">MICHELIN Guide</span>
                </div>
                <div className="flex items-center gap-1">
                  {/* Stars */}
                  {lvLocation.michelinStars && (
                    <div className="flex items-center gap-0.5">
                      {Array.from({ length: lvLocation.michelinStars }).map((_, i) => (
                        <MichelinStar key={i} className="w-4 h-4" />
                      ))}
                    </div>
                  )}
                  
                  {/* Bib Gourmand - just icon */}
                  {lvLocation.michelinDistinction === 'Bib Gourmand' && (
                    <MichelinBib className="w-5 h-5" />
                  )}
                  
                  {/* Other distinctions */}
                  {lvLocation.michelinDistinction && lvLocation.michelinDistinction !== 'Bib Gourmand' && (
                    <MichelinPlate className="w-5 h-5" />
                  )}
                  
                  {/* Green Star */}
                  {lvLocation.michelinGreenStar && (
                    <MichelinGreenStar className="w-4 h-4" />
                  )}
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
            {/* Google Rating - Clickable to view reviews */}
            <button 
              onClick={handleOpenReviews}
              className="flex items-center justify-between text-sm pb-2 border-b border-gray-100 w-full hover:bg-blue-50 transition-colors px-2 -mx-2 rounded cursor-pointer group"
              title="Click to read Google reviews"
            >
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-600" />
                <span className="text-gray-600 group-hover:text-blue-600 transition-colors">Google Rating</span>
              </div>
              <div className="flex items-center gap-2">
                {renderStars(place.rating ?? null)}
                <div className="flex items-center gap-1">
                  <span className="text-sm font-medium text-gray-900 w-8 text-right">
                    {place.rating?.toFixed(1) || 'N/A'}
                  </span>
                  {place.user_ratings_total && (
                    <span className="text-xs text-gray-500 group-hover:text-blue-600 transition-colors">
                      ({place.user_ratings_total.toLocaleString()})
                    </span>
                  )}
                </div>
              </div>
            </button>

            {/* Cuisine - below Google rating */}
            {lvLocation?.cuisine && (
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <span className="text-gray-600">Cuisine</span>
                </div>
                <span className="text-sm text-gray-900">{lvLocation.cuisine}</span>
              </div>
            )}
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
                  // Extract lat/lng from place
                  const lat = place.geometry?.location?.lat ? 
                    (typeof place.geometry.location.lat === 'function' ? place.geometry.location.lat() : place.geometry.location.lat) : undefined;
                  const lng = place.geometry?.location?.lng ? 
                    (typeof place.geometry.location.lng === 'function' ? place.geometry.location.lng() : place.geometry.location.lng) : undefined;
                  
                  onWantToGoToggle(place.place_id, {
                    name: place.name,
                    lat,
                    lng,
                    formatted_address: place.formatted_address,
                    place_id: place.place_id
                  });
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
              currentMichelinScore={lvLocation?.michelinScore}
              currentTags={lvLocation?.tags || []}
              michelinId={lvLocation?.michelinId}
              placeData={{
                name: place.name || 'Unknown Place',
                lat,
                lng,
                formatted_address: place.formatted_address,
                rating: place.rating,
              }}
              onClose={() => setShowEditorModal(false)}
              onSuccess={() => {
                // Reload locations after rating is updated
                onRefresh?.();
              }}
            />
          )}

          {/* Reviews Modal */}
          {showReviewsModal && placeDetails && (
            <GoogleReviewsModal
              reviews={placeDetails.reviews || []}
              placeName={place.name || 'Unknown Place'}
              googleMapsUrl={placeDetails.google_maps_url}
              onClose={() => setShowReviewsModal(false)}
            />
          )}

          {/* Photo Gallery Modal */}
          {showPhotoGallery && placeDetails && placeDetails.photos && placeDetails.photos.length > 0 && (
            <PhotoGalleryModal
              photos={placeDetails.photos}
              initialIndex={0}
              placeName={place.name || 'Unknown Place'}
              onClose={() => setShowPhotoGallery(false)}
            />
          )}
        </div>
      </div>
    </InfoWindow>
  );
}