import { toast } from 'sonner';
import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence, PanInfo, useMotionValue, useTransform } from 'motion/react';
import { Award, Users, Star, ChevronLeft, ChevronRight, MapPin, Edit3, Navigation, Heart, Bookmark, Calendar, X, ExternalLink } from 'lucide-react';
import { EditorRatingModal } from './EditorRatingModal';
import { api, type Location } from '../../utils/api';

interface MobileInfoSheetProps {
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
}

export function MobileInfoSheet({ 
  place, 
  onClose,
  user,
  isAuthenticated,
  onFavoriteToggle,
  onWantToGoToggle,
  onRatingAdded,
  favoriteIds,
  wantToGoIds,
  lvLocation
}: MobileInfoSheetProps) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showEditorModal, setShowEditorModal] = useState(false);
  const [dragProgress, setDragProgress] = useState(0);
  const y = useMotionValue(0);
  const opacity = useTransform(y, [0, 300], [1, 0]);

  // Process photos from the place object
  const photos = useMemo(() => {
    if (!place.photos || place.photos.length === 0) return [];
    
    return place.photos.slice(0, 5).map((photo: any) => {
      if (typeof photo.getURI === 'function') {
        return {
          photoReference: photo.getURI({ maxWidth: 600 }),
          width: photo.widthPx || 600,
          height: photo.heightPx || 400,
        };
      } else if (photo.getUrl) {
        return {
          photoReference: photo.getUrl({ maxWidth: 600 }),
          width: 600,
          height: 400,
        };
      }
      return null;
    }).filter(Boolean);
  }, [place.photos]);

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

  const handleDragEnd = (event: any, info: PanInfo) => {
    if (info.offset.y > 150) {
      onClose();
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 z-[60]"
        onClick={onClose}
      />
      
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.5 }}
        onDragEnd={handleDragEnd}
        style={{ y, opacity }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-[70] bg-white rounded-t-3xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Drag Handle */}
        <div className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing">
          <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          {/* Photo Carousel */}
          {photos.length > 0 && (
            <div className="relative bg-gray-100">
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
                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-2 rounded-full shadow-lg transition-all"
                  >
                    <ChevronLeft className="w-5 h-5 text-gray-800" />
                  </button>
                  <button
                    onClick={nextPhoto}
                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-2 rounded-full shadow-lg transition-all"
                  >
                    <ChevronRight className="w-5 h-5 text-gray-800" />
                  </button>

                  {/* Photo Indicators */}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                    {photos.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setCurrentPhotoIndex(idx)}
                        className={`w-2 h-2 rounded-full transition-all ${
                          idx === currentPhotoIndex 
                            ? 'bg-white w-6' 
                            : 'bg-white/60'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}

              {/* Close Button */}
              <button
                onClick={onClose}
                className="absolute top-3 right-3 p-2 bg-white/90 hover:bg-white rounded-full shadow-lg transition-all"
              >
                <X className="w-5 h-5 text-gray-800" />
              </button>
            </div>
          )}

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Header */}
            <div>
              <h2 className="font-bold text-2xl text-gray-900 mb-2">{place.name || 'Unknown Place'}</h2>
              {place.formatted_address && (
                <button
                  onClick={() => {
                    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.formatted_address || '')}`;
                    window.open(url, '_blank');
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1.5"
                >
                  <MapPin className="w-4 h-4" />
                  {place.formatted_address}
                </button>
              )}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-3">
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
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all ${
                  favoriteIds?.has(place.place_id || '')
                    ? 'bg-red-50 text-red-600 border-2 border-red-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Heart className={`w-5 h-5 ${
                  favoriteIds?.has(place.place_id || '') ? 'fill-red-500 stroke-red-500' : ''
                }`} />
                {favoriteIds?.has(place.place_id || '') ? 'Favorited' : 'Favorite'}
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
                className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-medium transition-all ${
                  wantToGoIds?.has(place.place_id || '')
                    ? 'bg-green-50 text-green-600 border-2 border-green-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Bookmark className={`w-5 h-5 ${
                  wantToGoIds?.has(place.place_id || '') ? 'fill-green-500 stroke-green-500' : ''
                }`} />
                Want to Go
              </button>
            </div>

            {/* Ratings */}
            <div className="space-y-3">
              {lvLocation && (lvLocation.lvEditorsScore || lvLocation.lvCrowdsourceScore) && (
                <>
                  {lvLocation.lvEditorsScore && (
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl border border-amber-200">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-100 rounded-lg">
                          <Award className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                          <div className="text-xs font-medium text-amber-900 uppercase tracking-wide">LV Editors Score</div>
                          <div className="text-sm text-amber-700">Hand-picked excellence</div>
                        </div>
                      </div>
                      <div className="text-3xl font-bold text-amber-900">
                        {lvLocation.lvEditorsScore.toFixed(1)}
                      </div>
                    </div>
                  )}

                  {lvLocation.lvCrowdsourceScore && (
                    <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Users className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <div className="text-xs font-medium text-blue-900 uppercase tracking-wide">LV Crowd Score</div>
                          <div className="text-sm text-blue-700">Community favorite</div>
                        </div>
                      </div>
                      <div className="text-3xl font-bold text-blue-900">
                        {lvLocation.lvCrowdsourceScore.toFixed(1)}
                      </div>
                    </div>
                  )}
                </>
              )}

              {place.rating && (
                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg">
                      <Star className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <div className="text-xs font-medium text-slate-700 uppercase tracking-wide">Google Rating</div>
                      {place.user_ratings_total && (
                        <div className="text-sm text-slate-500">{place.user_ratings_total.toLocaleString()} reviews</div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-slate-900">{place.rating.toFixed(1)}</div>
                    <div className="mt-1">{renderStars(place.rating)}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Tags */}
            {lvLocation?.tags && lvLocation.tags.length > 0 && (
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">Tags</div>
                <div className="flex flex-wrap gap-2">
                  {lvLocation.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-full text-sm font-medium"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Get Directions Button */}
            <button
              onClick={() => {
                const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
                window.open(url, '_blank');
              }}
              className="w-full flex items-center justify-center gap-2 py-4 bg-blue-500 hover:bg-blue-600 text-white rounded-xl font-medium transition-all"
            >
              <Navigation className="w-5 h-5" />
              Get Directions
            </button>

            {/* Editor Button */}
            {isAuthenticated && user?.role === 'editor' && (
              <button 
                onClick={() => setShowEditorModal(true)}
                className="w-full flex items-center justify-center gap-2 py-4 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium transition-all"
              >
                <Edit3 className="w-5 h-5" />
                Edit LV Rating
              </button>
            )}
          </div>
        </div>

        {/* Editor Modal */}
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
              setShowEditorModal(false);
              toast.success('Rating updated successfully!');
              if (onRatingAdded) {
                onRatingAdded();
              }
            }}
          />
        )}
      </motion.div>
    </>
  );
}