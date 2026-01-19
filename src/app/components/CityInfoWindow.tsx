import { X, MapPin, Navigation, Star, Heart, BookOpen } from 'lucide-react';
import { motion } from 'motion/react';

interface CityInfoWindowProps {
  place: google.maps.places.PlaceResult;
  onClose: () => void;
  totalLVRatings: number;
  totalFavorites: number;
}

export function CityInfoWindow({ place, onClose, totalLVRatings, totalFavorites }: CityInfoWindowProps) {
  // Get city name and region from the place details
  const cityName = place.name || place.formatted_address?.split(',')[0] || 'City';
  const region = place.formatted_address || '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200"
      style={{ minWidth: '380px', maxWidth: '420px' }}
    >
      {/* Header with gradient */}
      <div className="relative bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 p-6 text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors backdrop-blur-sm"
        >
          <X size={16} className="text-white" />
        </button>
        
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex-shrink-0">
            <MapPin className="w-6 h-6 text-white" />
          </div>
          
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-1">{cityName}</h2>
            <p className="text-blue-100 text-sm">{region}</p>
          </div>
        </div>
      </div>

      {/* Stats Section */}
      <div className="p-6 space-y-4">
        {/* City Stats */}
        <div className="grid grid-cols-2 gap-3">
          {/* LV Rated Venues */}
          <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <Star className="w-4 h-4 text-white fill-white" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{totalLVRatings}</div>
            <div className="text-xs text-gray-600 font-medium">LV Rated Venues</div>
          </div>

          {/* Total Favorites */}
          <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-xl p-4 border border-rose-200">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
                <Heart className="w-4 h-4 text-white fill-white" />
              </div>
            </div>
            <div className="text-2xl font-bold text-gray-900">{totalFavorites}</div>
            <div className="text-xs text-gray-600 font-medium">Community Favorites</div>
          </div>
        </div>

        {/* Weekend Guide Placeholder */}
        <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl p-5 border-2 border-dashed border-slate-300">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-gray-900 mb-1">LV Weekend Guide</h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Curated itineraries and insider recommendations coming soon for {cityName}
              </p>
            </div>
          </div>
        </div>

        {/* Helper Text */}
        <div className="pt-4 border-t border-slate-200">
          <div className="flex items-center gap-2 text-gray-600">
            <Navigation className="w-4 h-4 text-blue-600" />
            <p className="text-xs">
              Map centered on this location
            </p>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Search for specific venues or tags to explore this area
          </p>
        </div>
      </div>
    </motion.div>
  );
}