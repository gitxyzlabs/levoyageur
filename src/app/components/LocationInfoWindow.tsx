import { useState, useEffect } from 'react';
import { InfoWindow } from '@vis.gl/react-google-maps';
import { Heart, Award, Users, Star, ChevronLeft, ChevronRight, Navigation, Bookmark, Calendar } from 'lucide-react';
import type { Location, User } from '../../utils/api';
import { api } from '../../utils/api';
import { toast } from 'sonner';
import { RatingSlider } from './RatingSlider';

interface LocationInfoWindowProps {
  location: Location;
  onClose: () => void;
  user: User | null;
  isAuthenticated: boolean;
  onFavoriteToggle?: () => void;
}

interface GooglePhoto {
  photoReference: string;
  width: number;
  height: number;
}

export function LocationInfoWindow({ 
  location, 
  onClose, 
  user, 
  isAuthenticated,
  onFavoriteToggle 
}: LocationInfoWindowProps) {
  const [isFavorite, setIsFavorite] = useState(false);
  const [photos, setPhotos] = useState<GooglePhoto[]>([]);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [googleRating, setGoogleRating] = useState<{ rating: number | null; count: number | null }>({ 
    rating: null, 
    count: null 
  });
  const [userRating, setUserRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [communityRatingCount, setCommunityRatingCount] = useState<number>(0);

  useEffect(() => {
    if (location.place_id) {
      fetchGooglePlaceDetails();
    }
    if (isAuthenticated && user) {
      checkIfFavorite();
      loadUserRating();
    }
    loadCommunityRatingCount();
  }, [location, isAuthenticated, user]);

  const checkIfFavorite = async () => {
    if (!user) return;
    try {
      const { favorites } = await api.getFavorites();
      setIsFavorite(favorites.some((fav: Location) => fav.id === location.id));
    } catch (error) {
      console.error('Failed to check favorite status:', error);
      // Silently fail - database may not be set up yet
    }
  };

  const loadUserRating = async () => {
    if (!user) return;
    try {
      const { rating } = await api.getUserRating(location.id);
      setUserRating(rating || 0);
    } catch (error) {
      console.error('Failed to load user rating:', error);
      // Silently fail - database may not be set up yet
    }
  };

  const loadCommunityRatingCount = async () => {
    try {
      const { count } = await api.getCommunityRatingCount(location.id);
      setCommunityRatingCount(count || 0);
    } catch (error) {
      console.error('Failed to load community rating count:', error);
      // Silently fail - database may not be set up yet
    }
  };

  const fetchGooglePlaceDetails = async () => {
    if (!location.place_id) {
      console.log('No place_id for location:', location.name);
      return;
    }

    // Validate place_id format - must be a non-empty string
    if (typeof location.place_id !== 'string' || location.place_id.trim() === '' || 
        location.place_id === 'undefined' || location.place_id === 'null') {
      console.log('Invalid place_id format for location:', location.name, 'place_id:', location.place_id);
      return;
    }

    console.log('Fetching place details for:', location.name, 'place_id:', location.place_id);

    try {
      const { details } = await api.getGooglePlaceDetails(location.place_id);
      
      console.log('Received place details:', details);
      
      // Set rating
      if (details.rating) {
        setGoogleRating({
          rating: details.rating,
          count: details.user_ratings_total || null,
        });
      }

      // Set photos
      if (details.photos && details.photos.length > 0) {
        setPhotos(details.photos.slice(0, 5)); // Limit to 5 photos
        console.log('Loaded', details.photos.length, 'photos');
      }
    } catch (error) {
      console.error('Failed to fetch Google place details:', error);
      // Don't show error to user, just fail silently
    }
  };

  const toggleFavorite = async () => {
    if (!isAuthenticated || !user) {
      toast.error('Please sign in to add favorites');
      return;
    }

    try {
      if (isFavorite) {
        await api.removeFavorite(location.id);
        setIsFavorite(false);
        toast.success('Removed from favorites');
      } else {
        await api.addFavorite(location.id);
        setIsFavorite(true);
        toast.success('Added to favorites ❤️');
      }
      onFavoriteToggle?.();
    } catch (error: any) {
      console.error('Failed to toggle favorite:', error);
      toast.error('Failed to update favorites');
    }
  };

  const handleRatingClick = async (rating: number) => {
    if (!isAuthenticated || !user) {
      toast.error('Please sign in to rate locations');
      return;
    }

    try {
      console.log('Saving rating:', rating, 'for location:', location.id);
      await api.setUserRating(location.id, rating);
      setUserRating(rating);
      toast.success(`Rated ${rating.toFixed(1)}/10!`);
      loadCommunityRatingCount(); // Refresh count
    } catch (error: any) {
      console.error('Failed to set rating:', error);
      console.error('Error details:', error.message);
      toast.error('Failed to save rating. Please try again.');
    }
  };

  const renderStars = (rating: number | null) => {
    if (!rating) return null;
    const stars = [];
    const fullStars = Math.floor(rating);
    
    for (let i = 0; i < 5; i++) {
      stars.push(
        <Star
          key={i}
          className={`w-3 h-3 ${
            i < fullStars ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'
          }`}
        />
      );
    }
    return <div className="flex gap-0.5">{stars}</div>;
  };

  const getRatingLabel = (score: number) => {
    if (score >= 10) return 'Exceptional';
    if (score >= 9) return 'Outstanding';
    if (score >= 8) return 'Excellent';
    if (score >= 7) return 'Very Good';
    if (score >= 6) return 'Good';
    return 'Fair';
  };

  const nextPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev + 1) % photos.length);
  };

  const prevPhoto = () => {
    setCurrentPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  return (
    <InfoWindow
      position={{ lat: location.lat, lng: location.lng }}
      onCloseClick={onClose}
      headerDisabled
      disableAutoPan={false}
      pixelOffset={[0, -10]}
    >
      <div className="max-w-sm">
        {/* Header with Title and Heart */}
        <div className="flex items-start justify-between mb-3 px-4 pt-4">
          <div className="flex-1">
            <h3 className="font-bold text-lg text-gray-900 mb-1">{location.name}</h3>
            {location.description && (
              <button
                onClick={() => {
                  const url = `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`;
                  window.open(url, '_blank');
                }}
                className="text-xs text-blue-600 hover:text-blue-700 hover:underline cursor-pointer transition-colors text-left"
              >
                {location.description}
              </button>
            )}
          </div>
          <button
            onClick={toggleFavorite}
            className="ml-2 flex-shrink-0 p-2 hover:bg-gray-100 rounded-full transition-colors"
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Heart 
              className={`w-6 h-6 transition-all ${
                isFavorite 
                  ? 'fill-red-500 text-red-500' 
                  : 'text-gray-400 hover:text-red-400'
              }`}
            />
          </button>
        </div>

        {/* Photo Carousel */}
        {photos.length > 0 ? (
          <div className="relative mb-4 bg-gray-100 rounded-lg overflow-hidden">
            <div className="aspect-video">
              <img
                src={`https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${photos[currentPhotoIndex].photoReference}&key=${(window as any).GOOGLE_MAPS_API_KEY}`}
                alt={`${location.name} - Photo ${currentPhotoIndex + 1}`}
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
          {/* My Rating (for logged-in users) */}
          {isAuthenticated && user && (
            <div className="mb-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-xs font-medium text-gray-600 mb-2">My Rating</p>
              <RatingSlider
                value={userRating}
                onChange={handleRatingClick}
                disabled={false}
                compact={true}
              />
            </div>
          )}

          {/* All Scores */}
          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-600" />
                <span className="text-gray-600">Le Voyageur</span>
              </div>
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span className="font-semibold">{location.lvEditorsScore?.toFixed(1) ?? '—'}</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="text-gray-600">LV Community</span>
              </div>
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-blue-400 text-blue-400" />
                <span className="font-semibold">{location.lvCrowdsourceScore?.toFixed(1) ?? '—'}</span>
                {communityRatingCount > 0 && (
                  <span className="text-xs text-gray-500 ml-1">({communityRatingCount})</span>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Michelin Score</span>
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-red-400 text-red-400" />
                <span className="font-semibold">{location.michelinScore?.toFixed(1) ?? '—'}</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Google Rating</span>
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span className="font-semibold">
                  {googleRating.rating ? (googleRating.rating.toFixed(1)) : '—'}
                </span>
                {googleRating.count && (
                  <span className="text-xs text-gray-500 ml-1">({googleRating.count})</span>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              onClick={toggleFavorite}
              className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                isFavorite
                  ? 'bg-red-50 text-red-700 border border-red-200'
                  : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'
              }`}
            >
              <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-red-500' : ''}`} />
              {isFavorite ? 'Saved' : 'Favorite'}
            </button>
            
            <button
              onClick={() => {
                if (!isAuthenticated) {
                  toast.error('Please sign in to add to Want to Go');
                  return;
                }
                toast.success('Added to Want to Go!');
              }}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-lg text-xs font-medium transition-all"
            >
              <Bookmark className="w-3.5 h-3.5" />
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
                const url = `https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`;
                window.open(url, '_blank');
              }}
              className="flex items-center justify-center gap-1.5 px-3 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-medium transition-all"
            >
              <Navigation className="w-3.5 h-3.5" />
              Directions
            </button>
          </div>

          {/* Tags */}
          {location.tags && location.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-3 border-t border-gray-200">
              {location.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 text-xs bg-gradient-to-r from-amber-100 to-rose-100 text-gray-700 font-medium rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </InfoWindow>
  );
}