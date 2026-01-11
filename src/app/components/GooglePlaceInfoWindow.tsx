import { useState, useEffect } from 'react';
import { InfoWindow } from '@vis.gl/react-google-maps';
import { Award, Users, Star, ChevronLeft, ChevronRight, MapPin, Edit3 } from 'lucide-react';

interface GooglePlaceInfoWindowProps {
  place: google.maps.places.PlaceResult;
  onClose: () => void;
  user: { id: string; email: string; name: string; role: 'user' | 'editor' } | null;
  isAuthenticated: boolean;
}

interface GooglePhoto {
  photoReference: string;
  width: number;
  height: number;
}

export function GooglePlaceInfoWindow({ 
  place, 
  onClose,
  user,
  isAuthenticated
}: GooglePlaceInfoWindowProps) {
  const [photos, setPhotos] = useState<GooglePhoto[]>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [googleRating, setGoogleRating] = useState<{ rating: number | null; count: number | null }>({ 
    rating: null, 
    count: null 
  });
  const [showRatingSlider, setShowRatingSlider] = useState(false);
  const [editorRating, setEditorRating] = useState(5.5);

  useEffect(() => {
    if (place.place_id) {
      fetchGooglePlaceDetails();
    }
  }, [place]);

  const fetchGooglePlaceDetails = async () => {
    if (!place.place_id || !window.google) return;

    try {
      const { Place } = await google.maps.importLibrary("places") as google.maps.PlacesLibrary;
      
      const placeObj = new Place({
        id: place.place_id,
      });

      await placeObj.fetchFields({
        fields: ['photos', 'rating', 'userRatingCount'],
      });

      // Convert photos
      if (placeObj.photos && placeObj.photos.length > 0) {
        const photoData = placeObj.photos.slice(0, 5).map((photo: any) => ({
          photoReference: photo.getURI({ maxWidth: 400 }),
          width: photo.widthPx || 400,
          height: photo.heightPx || 300,
        }));
        setPhotos(photoData);
      }

      setGoogleRating({
        rating: placeObj.rating ?? place.rating ?? null,
        count: placeObj.userRatingCount ?? null,
      });
    } catch (error) {
      console.error('Error fetching Google place details:', error);
      // Use fallback data from place object
      setGoogleRating({
        rating: place.rating ?? null,
        count: null,
      });
    }
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

  return (
    <InfoWindow
      position={{ lat, lng }}
      onCloseClick={onClose}
      headerDisabled
    >
      <div className="max-w-sm">
        {/* Header with Title */}
        <div className="flex items-start justify-between mb-3 px-4 pt-4">
          <div className="flex-1">
            <h3 className="font-bold text-lg text-gray-900 mb-1">{place.name || 'Unknown Place'}</h3>
            {place.formatted_address && (
              <p className="text-xs text-gray-600 flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {place.formatted_address}
              </p>
            )}
          </div>
          {isAuthenticated && user?.role === 'editor' && (
            <button className="text-gray-500 hover:text-gray-700">
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
          {/* Google Rating */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 text-amber-600" />
                <span className="text-gray-600">Google Rating</span>
              </div>
              <div className="flex items-center gap-2">
                {renderStars(googleRating.rating)}
                <span className="text-sm font-medium text-gray-900">
                  {googleRating.rating?.toFixed(1) || 'N/A'}
                </span>
                {googleRating.count && (
                  <span className="text-xs text-gray-500">
                    ({googleRating.count.toLocaleString()})
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Editor Rating Section - Only visible to editors */}
          {isAuthenticated && user?.role === 'editor' && (
            <div className="mt-4">
              {!showRatingSlider ? (
                <button
                  onClick={() => setShowRatingSlider(true)}
                  className="w-full p-3 bg-gradient-to-br from-amber-50 to-rose-50 hover:from-amber-100 hover:to-rose-100 rounded-lg border border-amber-200 transition-all"
                >
                  <p className="text-xs text-gray-700 text-center font-medium flex items-center justify-center gap-2">
                    <Award className="w-4 h-4 text-amber-600" />
                    Rate this location as LV Editor
                  </p>
                </button>
              ) : (
                <div className="p-4 bg-gradient-to-br from-amber-50 to-rose-50 rounded-lg border border-amber-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-600" />
                      LV Editor Score
                    </p>
                    <span className="text-lg font-bold text-amber-600">{editorRating.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="11"
                    step="0.1"
                    value={editorRating}
                    onChange={(e) => setEditorRating(parseFloat(e.target.value))}
                    className="w-full h-2 bg-gradient-to-r from-slate-200 via-amber-300 to-rose-400 rounded-lg appearance-none cursor-pointer accent-amber-600"
                    style={{
                      background: `linear-gradient(to right, #e2e8f0 0%, #fbbf24 ${(editorRating / 11) * 50}%, #fb7185 ${(editorRating / 11) * 100}%)`
                    }}
                  />
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>0.0</span>
                    <span>11.0</span>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => {
                        setShowRatingSlider(false);
                        // TODO: Submit rating to database
                        console.log('Rating:', editorRating);
                      }}
                      className="flex-1 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-lg transition-colors"
                    >
                      Submit Rating
                    </button>
                    <button
                      onClick={() => setShowRatingSlider(false)}
                      className="px-3 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-medium rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Types/Categories */}
          {place.types && place.types.length > 0 && (
            <div className="mt-3">
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
        </div>
      </div>
    </InfoWindow>
  );
}