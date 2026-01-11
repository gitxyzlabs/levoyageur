import { useState, useEffect } from 'react';
import { InfoWindow } from '@vis.gl/react-google-maps';
import { Award, Users, Star, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';

interface GooglePlaceInfoWindowProps {
  place: google.maps.places.PlaceResult;
  onClose: () => void;
}

interface GooglePhoto {
  photoReference: string;
  width: number;
  height: number;
}

export function GooglePlaceInfoWindow({ 
  place, 
  onClose
}: GooglePlaceInfoWindowProps) {
  const [photos, setPhotos] = useState<GooglePhoto[]>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [googleRating, setGoogleRating] = useState<{ rating: number | null; count: number | null }>({ 
    rating: null, 
    count: null 
  });

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

          {/* Not in LV Database Notice */}
          <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-xs text-gray-600 text-center">
              <Award className="w-4 h-4 inline mr-1" />
              Not yet rated by LV
            </p>
          </div>

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