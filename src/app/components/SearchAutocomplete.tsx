import { useRef, useState, useEffect } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { Search, X, MapPin, Tag } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LVIcon } from './LVIcon';
import { api } from '../../utils/api';

interface SearchAutocompleteProps {
  onPlaceSelect: (place: any) => void; // Updated type
  onTagSelect: (tag: string) => void;
  onClear?: () => void;
}

export function SearchAutocomplete({ onPlaceSelect, onTagSelect, onClear }: SearchAutocompleteProps) {
  const [searchValue, setSearchValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [googlePredictions, setGooglePredictions] = useState<any[]>([]);
  const [supabaseTags, setSupabaseTags] = useState<string[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const places = useMapsLibrary('places');

  // Fetch suggestions when search value changes
  useEffect(() => {
    if (!searchValue.trim()) {
      setGooglePredictions([]);
      setSupabaseTags([]);
      setShowDropdown(false);
      return;
    }

    const fetchSuggestions = async () => {
      // Fetch Google Places predictions using new AutocompleteSuggestion API
      if (places) {
        try {
          const { AutocompleteSuggestion } = places as any;
          
          const request = {
            input: searchValue,
            includedPrimaryTypes: ['restaurant', 'cafe', 'bar', 'bakery', 'meal_takeaway', 'meal_delivery'],
          };
          
          const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
          
          if (suggestions && suggestions.length > 0) {
            console.log('Google predictions:', suggestions);
            // Convert new format to old format for compatibility
            const predictions = suggestions.slice(0, 5).map((s: any) => ({
              place_id: s.placePrediction?.placeId || s.placePrediction?.place,
              description: s.placePrediction?.text?.text || '',
              structured_formatting: {
                main_text: s.placePrediction?.structuredFormat?.mainText?.text || '',
                secondary_text: s.placePrediction?.structuredFormat?.secondaryText?.text || '',
              }
            }));
            setGooglePredictions(predictions);
          } else {
            setGooglePredictions([]);
          }
        } catch (error) {
          console.error('Error fetching autocomplete suggestions:', error);
          setGooglePredictions([]);
        }
      }

      // Fetch Supabase tags
      try {
        const { locations } = await api.getLocations();
        const allTags = locations.flatMap(loc => loc.tags || []);
        const uniqueTags = Array.from(new Set(allTags));
        const matchingTags = uniqueTags.filter(tag => 
          tag.toLowerCase().includes(searchValue.toLowerCase())
        ).slice(0, 5);
        setSupabaseTags(matchingTags);
      } catch (error) {
        console.error('Error fetching tags:', error);
        setSupabaseTags([]);
      }

      setShowDropdown(true);
    };

    const timeoutId = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timeoutId);
  }, [searchValue]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleGooglePlaceSelect = async (prediction: google.maps.places.AutocompletePrediction) => {
    if (!prediction.place_id) return;

    try {
      // Use the new Place API instead of deprecated PlacesService
      const { Place } = await google.maps.importLibrary("places") as google.maps.PlacesLibrary;
      
      const place = new Place({
        id: prediction.place_id,
      });

      // Fetch the place details with the new API
      await place.fetchFields({
        fields: ['displayName', 'location', 'formattedAddress', 'id', 'rating', 'photos', 'types'],
      });

      console.log('=== Fetched Place Details ===');
      console.log('Place:', place);
      console.log('Place ID:', place.id);
      console.log('Display Name:', place.displayName);
      console.log('Location:', place.location);

      // Convert to PlaceResult format for compatibility
      const placeResult: google.maps.places.PlaceResult = {
        name: place.displayName || prediction.structured_formatting.main_text,
        place_id: place.id,
        geometry: place.location ? {
          location: place.location,
        } as google.maps.places.PlaceGeometry : undefined,
        formatted_address: place.formattedAddress,
        rating: place.rating,
        photos: place.photos,
        types: place.types,
      };

      onPlaceSelect(placeResult);
      setSearchValue(prediction.description);
      setShowDropdown(false);
    } catch (error) {
      console.error('Error fetching place details:', error);
      
      // Fallback: create a basic place result from prediction
      const fallbackResult: google.maps.places.PlaceResult = {
        name: prediction.structured_formatting.main_text,
        place_id: prediction.place_id,
        formatted_address: prediction.description,
      };
      
      onPlaceSelect(fallbackResult);
      setSearchValue(prediction.description);
      setShowDropdown(false);
    }
  };

  const handleTagSelect = (tag: string) => {
    onTagSelect(tag);
    setSearchValue(tag);
    setShowDropdown(false);
  };

  const handleClear = () => {
    setSearchValue('');
    setGooglePredictions([]);
    setSupabaseTags([]);
    setShowDropdown(false);
    onClear?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const totalItems = supabaseTags.length + googlePredictions.length;
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(prev => (prev + 1) % totalItems);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(prev => (prev - 1 + totalItems) % totalItems);
    } else if (e.key === 'Enter' && focusedIndex >= 0) {
      e.preventDefault();
      if (focusedIndex < supabaseTags.length) {
        handleTagSelect(supabaseTags[focusedIndex]);
      } else {
        handleGooglePlaceSelect(googlePredictions[focusedIndex - supabaseTags.length]);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const hasResults = googlePredictions.length > 0 || supabaseTags.length > 0;

  return (
    <div className="relative">
      <div className="relative group">
        <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none z-10">
          <Search className="h-5 w-5 text-gray-400 group-focus-within:text-amber-500 transition-colors duration-300" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowDropdown(true)}
          placeholder="Search tags or places"
          className="w-full pl-12 pr-12 py-4 text-base rounded-2xl bg-white/95 backdrop-blur-2xl border-2 border-white/40 shadow-2xl focus:outline-none focus:ring-4 focus:ring-amber-400/30 focus:border-amber-400/50 text-gray-900 placeholder-gray-400 transition-all duration-300 hover:shadow-amber-200/50"
        />
        {searchValue && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            onClick={handleClear}
            className="absolute inset-y-0 right-4 flex items-center text-gray-400 hover:text-gray-700 transition duration-200 z-10"
          >
            <X size={18} />
          </motion.button>
        )}
      </div>

      <AnimatePresence>
        {showDropdown && hasResults && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
          >
            {/* Supabase Tags Section */}
            {supabaseTags.length > 0 && (
              <div className="border-b border-slate-100">
                <div className="px-4 py-2 bg-gradient-to-r from-amber-50 to-rose-50 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    <LVIcon className="w-3 h-3 text-amber-600" />
                    <span>Le Voyageur Tags</span>
                  </div>
                </div>
                {supabaseTags.map((tag, index) => {
                  const itemIndex = index;
                  return (
                    <button
                      key={tag}
                      onClick={() => handleTagSelect(tag)}
                      className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-amber-50 transition-colors text-left ${
                        focusedIndex === itemIndex ? 'bg-amber-50' : ''
                      }`}
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-amber-100 to-rose-100 flex-shrink-0">
                        <LVIcon className="w-4 h-4 text-amber-700" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{tag}</div>
                        <div className="text-xs text-gray-500">Search Le Voyageur collection</div>
                      </div>
                      <Tag className="w-4 h-4 text-amber-600" />
                    </button>
                  );
                })}
              </div>
            )}

            {/* Google Places Section */}
            {googlePredictions.length > 0 && (
              <div>
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                  <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    Google Places
                  </div>
                </div>
                {googlePredictions.map((prediction, index) => (
                  <button
                    key={prediction.place_id}
                    onClick={() => handleGooglePlaceSelect(prediction)}
                    className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left ${
                      focusedIndex === index + supabaseTags.length ? 'bg-slate-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 flex-shrink-0">
                      <MapPin className="w-4 h-4 text-slate-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">
                        {prediction.structured_formatting.main_text}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {prediction.structured_formatting.secondary_text}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}