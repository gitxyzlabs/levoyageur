import { useRef, useState, useEffect } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { Search, X, MapPin, Tag, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LVIcon } from './LVIcon';
import { api, Location } from '../../utils/api';

interface SearchAutocompleteProps {
  onPlaceSelect: (place: any) => void; // Updated type
  onTagSelect: (tag: string) => void;
  onClear?: () => void;
  mapBounds?: google.maps.LatLngBounds | null;
  onGenericSearch?: (query: string) => void;
  searchResults?: google.maps.places.PlaceResult[];
  showSearchResults?: boolean;
}

export function SearchAutocomplete({ onPlaceSelect, onTagSelect, onClear, mapBounds, onGenericSearch, searchResults = [], showSearchResults = false }: SearchAutocompleteProps) {
  const [searchValue, setSearchValue] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [googlePredictions, setGooglePredictions] = useState<any[]>([]);
  const [supabaseTags, setSupabaseTags] = useState<string[]>([]);
  const [michelinLocations, setMichelinLocations] = useState<Location[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const places = useMapsLibrary('places');

  // Fetch suggestions when search value changes
  useEffect(() => {
    if (!searchValue.trim()) {
      setGooglePredictions([]);
      setSupabaseTags([]);
      setMichelinLocations([]);
      setShowDropdown(false);
      return;
    }

    const fetchSuggestions = async () => {
      // Fetch Google Places predictions using new AutocompleteSuggestion API
      if (places) {
        try {
          // Use the fetchAutocompleteSuggestions method from places library
          const request: any = {
            input: searchValue,
            // Remove type restrictions to allow cities, regions, and all place types
            // This allows searches like "Austin, TX" to work alongside "tacos"
          };
          
          // Optional: Add region code for better results in specific countries
          request.region = 'us'; // Can be made dynamic based on map location
          
          console.log('🔍 Fetching autocomplete suggestions for:', searchValue);
          
          // Access AutocompleteSuggestion from the places library
          const { AutocompleteSuggestion } = await google.maps.importLibrary("places") as any;
          const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
          
          if (suggestions && suggestions.length > 0) {
            console.log('✅ Google predictions received:', suggestions.length);
            // Convert new format to old format for compatibility
            const predictions = suggestions.slice(0, 5).map((s: any) => {
              const placePrediction = s.placePrediction;
              return {
                place_id: placePrediction?.placeId || placePrediction?.place,
                description: placePrediction?.text?.text || placePrediction?.text || '',
                structured_formatting: {
                  main_text: placePrediction?.structuredFormat?.mainText?.text || placePrediction?.mainText?.text || placePrediction?.text?.text || 'Unknown',
                  secondary_text: placePrediction?.structuredFormat?.secondaryText?.text || placePrediction?.secondaryText?.text || '',
                }
              };
            });
            console.log('✅ Converted predictions:', predictions.length);
            setGooglePredictions(predictions);
          } else {
            console.log('⚠️ No Google predictions returned');
            setGooglePredictions([]);
          }
        } catch (error) {
          console.error('❌ Error fetching autocomplete suggestions:', error);
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
        console.log('✅ Matching tags found:', matchingTags.length);
        setSupabaseTags(matchingTags);
      } catch (error) {
        console.error('❌ Error fetching tags:', error);
        setSupabaseTags([]);
      }

      // Fetch Michelin locations
      try {
        const { locations } = await api.getLocations();
        const matchingLocations = locations
          .filter(loc => 
            loc.michelinScore > 0 && // Only Michelin-rated locations
            loc.name.toLowerCase().includes(searchValue.toLowerCase())
          )
          .slice(0, 5);
        console.log('✅ Matching Michelin locations found:', matchingLocations.length);
        setMichelinLocations(matchingLocations);
      } catch (error) {
        console.error('❌ Error fetching Michelin locations:', error);
        setMichelinLocations([]);
      }
    };

    const timeoutId = setTimeout(async () => {
      await fetchSuggestions();
      // Always show dropdown after fetching, even if results are empty (will show "no results")
      setShowDropdown(true);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchValue, places, mapBounds]);

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

    // Close dropdown and clear predictions immediately
    setShowDropdown(false);
    setGooglePredictions([]);
    setSupabaseTags([]);
    setMichelinLocations([]);

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
      // Blur the input to prevent dropdown from reopening
      inputRef.current?.blur();
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
      // Blur the input to prevent dropdown from reopening
      inputRef.current?.blur();
    }
  };

  const handleTagSelect = (tag: string) => {
    onTagSelect(tag);
    setSearchValue(tag);
    setShowDropdown(false);
    setGooglePredictions([]);
    setSupabaseTags([]);
    setMichelinLocations([]);
    // Blur the input to prevent dropdown from reopening
    inputRef.current?.blur();
  };

  const handleMichelinLocationSelect = async (location: Location) => {
    // Close dropdown and clear predictions immediately
    setShowDropdown(false);
    setGooglePredictions([]);
    setSupabaseTags([]);
    setMichelinLocations([]);

    // If location has a place_id, fetch full Google details
    const placeId = location.placeId || location.place_id;
    
    if (placeId) {
      try {
        const { Place } = await google.maps.importLibrary("places") as google.maps.PlacesLibrary;
        
        const place = new Place({
          id: placeId,
        });

        await place.fetchFields({
          fields: ['displayName', 'location', 'formattedAddress', 'id', 'rating', 'photos', 'types'],
        });

        const placeResult: google.maps.places.PlaceResult = {
          name: place.displayName || location.name,
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
        setSearchValue(location.name);
        inputRef.current?.blur();
      } catch (error) {
        console.error('Error fetching place details for Michelin location:', error);
        
        // Fallback: use location data directly
        const fallbackResult: google.maps.places.PlaceResult = {
          name: location.name,
          place_id: placeId,
          formatted_address: location.address,
          geometry: {
            location: new google.maps.LatLng(location.lat, location.lng)
          },
        };
        
        onPlaceSelect(fallbackResult);
        setSearchValue(location.name);
        inputRef.current?.blur();
      }
    } else {
      // No place_id, use location data directly
      const placeResult: google.maps.places.PlaceResult = {
        name: location.name,
        place_id: location.id,
        formatted_address: location.address,
        geometry: {
          location: new google.maps.LatLng(location.lat, location.lng)
        },
      };
      
      onPlaceSelect(placeResult);
      setSearchValue(location.name);
      inputRef.current?.blur();
    }
  };

  const handleClear = () => {
    setSearchValue('');
    setGooglePredictions([]);
    setSupabaseTags([]);
    setMichelinLocations([]);
    setShowDropdown(false);
    onClear?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const totalItems = supabaseTags.length + googlePredictions.length + michelinLocations.length + 1; // +1 for generic search option
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(prev => (prev + 1) % totalItems);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(prev => (prev - 1 + totalItems) % totalItems);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedIndex === -1 || focusedIndex === totalItems - 1) {
        // Generic search (last item or no selection + Enter)
        handleGenericSearch();
      } else if (focusedIndex < supabaseTags.length) {
        handleTagSelect(supabaseTags[focusedIndex]);
      } else if (focusedIndex < supabaseTags.length + michelinLocations.length) {
        handleMichelinLocationSelect(michelinLocations[focusedIndex - supabaseTags.length]);
      } else {
        handleGooglePlaceSelect(googlePredictions[focusedIndex - supabaseTags.length - michelinLocations.length]);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const handleGenericSearch = () => {
    if (!searchValue.trim()) return;
    
    setShowDropdown(false);
    setGooglePredictions([]);
    setSupabaseTags([]);
    setMichelinLocations([]);
    
    if (onGenericSearch) {
      onGenericSearch(searchValue.trim());
    }
    
    inputRef.current?.blur();
  };

  const hasResults = googlePredictions.length > 0 || supabaseTags.length > 0 || michelinLocations.length > 0;

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
          onFocus={() => {
            if (hasResults) {
              setShowDropdown(true);
            }
          }}
          placeholder="Search cities, tags, or places"
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
        {showDropdown && (hasResults || searchValue.trim()) && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
          >
            {/* Generic Search Button - Now at the top */}
            {searchValue.trim() && onGenericSearch && (
              <button
                onClick={handleGenericSearch}
                className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-blue-50 transition-colors text-left border-b border-slate-100 ${
                  focusedIndex === 0 ? 'bg-blue-50' : ''
                }`}
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 flex-shrink-0">
                  <Search className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">Search for "{searchValue}"</div>
                  <div className="text-xs text-gray-500">Find "{searchValue}" on your map area</div>
                </div>
              </button>
            )}
          
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
                  const itemIndex = index + 1; // +1 because generic search is now at index 0
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

            {/* Michelin Locations Section */}
            {michelinLocations.length > 0 && (
              <div className="border-b border-slate-100">
                <div className="px-4 py-2 bg-gradient-to-r from-amber-50 to-rose-50 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    <LVIcon className="w-3 h-3 text-amber-600" />
                    <span>Michelin Locations</span>
                  </div>
                </div>
                {michelinLocations.map((location, index) => (
                  <button
                    key={location.id}
                    onClick={() => handleMichelinLocationSelect(location)}
                    className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-amber-50 transition-colors text-left ${
                      focusedIndex === index + supabaseTags.length + 1 ? 'bg-amber-50' : ''
                    }`}
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-amber-100 to-rose-100 flex-shrink-0">
                      <Star className="w-4 h-4 text-amber-700" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-gray-900 truncate">
                        {location.name}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {location.address}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Google Places Section */}
            {googlePredictions.length > 0 && (
              <div className="border-b border-slate-100">
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
                      focusedIndex === index + supabaseTags.length + michelinLocations.length + 1 ? 'bg-slate-50' : ''
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