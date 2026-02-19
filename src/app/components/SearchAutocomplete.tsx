import { useRef, useState, useEffect } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { Search, X, MapPin, Tag, Star, Heart, Bookmark } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LVIcon } from './LVIcon';
import { api, Location } from '../../utils/api';
import { MichelinFlower, MichelinStar, MichelinKey } from '@/app/components/MichelinIcons';

// Color palette for different LV rating tiers (matches marker colors)
const getLVScoreColor = (rating: number) => {
  // 10+ Best in the World - Deep burgundy/maroon
  if (rating >= 10) return {
    bg: '#7a1f35',
    text: '#ffffff',
  };
  // 9+ World Class - Purple burgundy
  if (rating >= 9) return {
    bg: '#8e2d54',
    text: '#ffffff',
  };
  // 8+ Exceptional - Warm burgundy
  if (rating >= 8) return {
    bg: '#a84848',
    text: '#ffffff',
  };
  // 7+ Very Good - Terra cotta
  if (rating >= 7) return {
    bg: '#c27d56',
    text: '#ffffff',
  };
  // 6+ Good - Warm terracotta
  if (rating >= 6) return {
    bg: '#d4936f',
    text: '#ffffff',
  };
  // 5+ Above Average - Beige/tan
  if (rating >= 5) return {
    bg: '#d9a574',
    text: '#ffffff',
  };
  // Default - Light gray
  return {
    bg: '#e5e7eb',
    text: '#374151',
  };
};

interface SearchAutocompleteProps {
  onPlaceSelect: (place: any, location?: Location) => void; // Updated type
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
  const [googleTextSearchResults, setGoogleTextSearchResults] = useState<any[]>([]);
  const [supabaseTags, setSupabaseTags] = useState<string[]>([]);
  const [michelinLocations, setMichelinLocations] = useState<Location[]>([]);
  const [lvLocations, setLvLocations] = useState<Location[]>([]);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [justSelected, setJustSelected] = useState(false); // Track if user just made a selection
  
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const places = useMapsLibrary('places');

  // Fetch suggestions when search value changes
  useEffect(() => {
    // Don't fetch suggestions if user just made a selection
    if (justSelected) {
      return;
    }
    
    if (!searchValue.trim()) {
      setGooglePredictions([]);
      setGoogleTextSearchResults([]);
      setSupabaseTags([]);
      setMichelinLocations([]);
      setLvLocations([]);
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
          
          console.log('🔍 Fetching autocomplete suggestions for:', searchValue);
          
          // Access AutocompleteSuggestion from the places library
          const { AutocompleteSuggestion } = await google.maps.importLibrary("places") as any;
          const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions(request);
          
          if (suggestions && suggestions.length > 0) {
            console.log('✅ Google predictions received:', suggestions.length);
            // Convert new format to old format for compatibility
            const predictions = suggestions.slice(0, 20).map((s: any) => {
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
            
            // Filter by map bounds if available
            if (mapBounds && predictions.length > 0) {
              console.log('🗺️ Filtering Google Places by map bounds...');
              
              try {
                // Fetch place details for predictions in parallel (limit to first 10 for performance)
                const { Place } = await google.maps.importLibrary("places") as google.maps.PlacesLibrary;
                const ne = mapBounds.getNorthEast();
                const sw = mapBounds.getSouthWest();
                
                // Process up to 10 predictions in parallel
                const predictionsToCheck = predictions.slice(0, 10);
                const locationChecks = await Promise.all(
                  predictionsToCheck.map(async (prediction) => {
                    try {
                      const place = new Place({ id: prediction.place_id });
                      await place.fetchFields({ fields: ['location'] });
                      
                      if (place.location) {
                        const lat = place.location.lat();
                        const lng = place.location.lng();
                        
                        // Check if within bounds
                        const isInBounds = lat >= sw.lat() && lat <= ne.lat() && 
                                          lng >= sw.lng() && lng <= ne.lng();
                        
                        return { prediction, isInBounds };
                      }
                    } catch (error) {
                      console.error('Error fetching place location:', error);
                    }
                    return { prediction, isInBounds: false };
                  })
                );
                
                // Get predictions within bounds
                const filteredPredictions = locationChecks
                  .filter(item => item.isInBounds)
                  .map(item => item.prediction)
                  .slice(0, 5);
                
                console.log('✅ Google predictions in map bounds:', filteredPredictions.length);
                
                // Only show predictions if we found results in bounds
                setGooglePredictions(filteredPredictions);
              } catch (error) {
                console.error('❌ Error filtering Google Places:', error);
                // Don't show unfiltered results - better to show nothing than wrong location
                setGooglePredictions([]);
              }
            } else {
              console.log('✅ Converted predictions:', predictions.length);
              setGooglePredictions(predictions.slice(0, 5));
            }
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
        let matchingLocations = locations
          .filter(loc => 
            loc.michelinScore > 0 && // Only Michelin-rated locations
            loc.name.toLowerCase().includes(searchValue.toLowerCase())
          );
        
        // Filter by map bounds if available
        if (mapBounds) {
          const ne = mapBounds.getNorthEast();
          const sw = mapBounds.getSouthWest();
          
          matchingLocations = matchingLocations.filter(loc => {
            return loc.lat >= sw.lat() && loc.lat <= ne.lat() &&
                   loc.lng >= sw.lng() && loc.lng <= ne.lng();
          });
          
          console.log('✅ Matching Michelin locations in map bounds:', matchingLocations.length);
        }
        
        setMichelinLocations(matchingLocations.slice(0, 5));
        console.log('✅ Matching Michelin locations found:', matchingLocations.length);
      } catch (error) {
        console.error('❌ Error fetching Michelin locations:', error);
        setMichelinLocations([]);
      }

      // Fetch Le Voyageur locations
      try {
        const { locations } = await api.getLocations();
        let matchingLocations = locations
          .filter(loc => 
            loc.tags?.some(tag => 
              tag.toLowerCase().includes(searchValue.toLowerCase())
            )
          );
        
        // Filter by map bounds if available
        if (mapBounds) {
          const ne = mapBounds.getNorthEast();
          const sw = mapBounds.getSouthWest();
          
          matchingLocations = matchingLocations.filter(loc => {
            return loc.lat >= sw.lat() && loc.lat <= ne.lat() &&
                   loc.lng >= sw.lng() && loc.lng <= ne.lng();
          });
          
          console.log('✅ Matching Le Voyageur locations in map bounds:', matchingLocations.length);
        }
        
        // Sort by LV Editor Score in descending order (highest score first)
        matchingLocations.sort((a, b) => {
          const scoreA = a.lvEditorScore || 0;
          const scoreB = b.lvEditorScore || 0;
          return scoreB - scoreA;
        });
        
        setLvLocations(matchingLocations.slice(0, 5));
        console.log('✅ Matching Le Voyageur locations found:', matchingLocations.length);
      } catch (error) {
        console.error('❌ Error fetching Le Voyageur locations:', error);
        setLvLocations([]);
      }

      // Fetch Google Places using Text Search (for queries like "tacos")
      if (places && mapBounds) {
        try {
          console.log('🔍 Performing Google Text Search for:', searchValue);
          
          const { Place } = await google.maps.importLibrary("places") as google.maps.PlacesLibrary;
          
          // Calculate center and radius for circular search
          const ne = mapBounds.getNorthEast();
          const sw = mapBounds.getSouthWest();
          const centerLat = (ne.lat() + sw.lat()) / 2;
          const centerLng = (ne.lng() + sw.lng()) / 2;
          const center = new google.maps.LatLng(centerLat, centerLng);
          
          // Calculate radius (distance from center to corner in meters)
          const latDiff = ne.lat() - sw.lat();
          const lngDiff = ne.lng() - sw.lng();
          const radius = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) / 2 * 111000;
          
          // Use searchNearby for location-based searches
          const request = {
            textQuery: searchValue,
            fields: ['id', 'displayName', 'formattedAddress', 'location', 'rating', 'userRatingCount'],
            locationBias: center,
            maxResultCount: 10,
          };
          
          const { places: searchResults } = await Place.searchByText(request);
          
          if (searchResults && searchResults.length > 0) {
            console.log('✅ Google Text Search results:', searchResults.length);
            
            // Filter results within map bounds
            const filteredResults = searchResults
              .filter(place => {
                if (!place.location) return false;
                const lat = place.location.lat();
                const lng = place.location.lng();
                return lat >= sw.lat() && lat <= ne.lat() && lng >= sw.lng() && lng <= ne.lng();
              })
              .map(place => ({
                place_id: place.id,
                description: `${place.displayName} - ${place.formattedAddress}`,
                structured_formatting: {
                  main_text: place.displayName || 'Unknown',
                  secondary_text: place.formattedAddress || '',
                },
                rating: place.rating,
                user_ratings_total: place.userRatingCount,
              }));
            
            // Sort by review count tiers, then by rating within each tier
            const sortedResults = filteredResults.sort((a, b) => {
              const reviewsA = a.user_ratings_total || 0;
              const reviewsB = b.user_ratings_total || 0;
              const ratingA = a.rating || 0;
              const ratingB = b.rating || 0;
              
              // Determine tier for each place
              const getTier = (reviews: number) => {
                if (reviews >= 10000) return 4;
                if (reviews >= 5000) return 3;
                if (reviews >= 1000) return 2;
                return 1;
              };
              
              const tierA = getTier(reviewsA);
              const tierB = getTier(reviewsB);
              
              // If different tiers, higher tier comes first
              if (tierA !== tierB) {
                return tierB - tierA;
              }
              
              // Same tier: sort by rating (descending)
              return ratingB - ratingA;
            }).slice(0, 5);
            
            console.log('✅ Filtered and sorted Google Text Search results in map bounds:', sortedResults.length);
            setGoogleTextSearchResults(sortedResults);
          } else {
            console.log('⚠️ No Google Text Search results returned');
            setGoogleTextSearchResults([]);
          }
        } catch (error) {
          console.error('❌ Error performing Google Text Search:', error);
          setGoogleTextSearchResults([]);
        }
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
    setGoogleTextSearchResults([]);
    setSupabaseTags([]);
    setMichelinLocations([]);
    setLvLocations([]);

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
      setJustSelected(true);
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
      setJustSelected(true);
    }
  };

  const handleTagSelect = (tag: string) => {
    onTagSelect(tag);
    setSearchValue(tag);
    setShowDropdown(false);
    setGooglePredictions([]);
    setGoogleTextSearchResults([]);
    setSupabaseTags([]);
    setMichelinLocations([]);
    setLvLocations([]);
    // Blur the input to prevent dropdown from reopening
    inputRef.current?.blur();
    setJustSelected(true);
  };

  const handleMichelinLocationSelect = async (location: Location) => {
    // Close dropdown and clear predictions immediately
    setShowDropdown(false);
    setGooglePredictions([]);
    setGoogleTextSearchResults([]);
    setSupabaseTags([]);
    setMichelinLocations([]);
    setLvLocations([]);

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
          } as google.maps.places.PlaceGeometry : {
            location: new google.maps.LatLng(location.lat, location.lng)
          } as google.maps.places.PlaceGeometry,
          formatted_address: place.formattedAddress || location.address,
          rating: place.rating,
          photos: place.photos,
          types: place.types,
        };

        // Pass both the place result AND the location data
        onPlaceSelect(placeResult, location);
        setSearchValue(location.name);
        inputRef.current?.blur();
        setJustSelected(true);
      } catch (error) {
        console.error('Error fetching place details for Michelin location:', error);
        
        // Fallback: use location data directly
        const fallbackResult: google.maps.places.PlaceResult = {
          name: location.name,
          place_id: placeId,
          formatted_address: location.address,
          geometry: {
            location: new google.maps.LatLng(location.lat, location.lng)
          } as google.maps.places.PlaceGeometry,
        };
        
        // Pass both the place result AND the location data
        onPlaceSelect(fallbackResult, location);
        setSearchValue(location.name);
        inputRef.current?.blur();
        setJustSelected(true);
      }
    } else {
      // No place_id, use location data directly
      const placeResult: google.maps.places.PlaceResult = {
        name: location.name,
        place_id: location.id,
        formatted_address: location.address,
        geometry: {
          location: new google.maps.LatLng(location.lat, location.lng)
        } as google.maps.places.PlaceGeometry,
      };
      
      // Pass both the place result AND the location data
      onPlaceSelect(placeResult, location);
      setSearchValue(location.name);
      inputRef.current?.blur();
      setJustSelected(true);
    }
  };

  const handleLvLocationSelect = async (location: Location) => {
    // Close dropdown and clear predictions immediately
    setShowDropdown(false);
    setGooglePredictions([]);
    setGoogleTextSearchResults([]);
    setSupabaseTags([]);
    setMichelinLocations([]);
    setLvLocations([]);

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
          } as google.maps.places.PlaceGeometry : {
            location: new google.maps.LatLng(location.lat, location.lng)
          } as google.maps.places.PlaceGeometry,
          formatted_address: place.formattedAddress || location.address,
          rating: place.rating,
          photos: place.photos,
          types: place.types,
        };

        // Pass both the place result AND the location data
        onPlaceSelect(placeResult, location);
        setSearchValue(location.name);
        inputRef.current?.blur();
        setJustSelected(true);
      } catch (error) {
        console.error('Error fetching place details for Le Voyageur location:', error);
        
        // Fallback: use location data directly
        const fallbackResult: google.maps.places.PlaceResult = {
          name: location.name,
          place_id: placeId,
          formatted_address: location.address,
          geometry: {
            location: new google.maps.LatLng(location.lat, location.lng)
          } as google.maps.places.PlaceGeometry,
        };
        
        // Pass both the place result AND the location data
        onPlaceSelect(fallbackResult, location);
        setSearchValue(location.name);
        inputRef.current?.blur();
        setJustSelected(true);
      }
    } else {
      // No place_id, use location data directly
      const placeResult: google.maps.places.PlaceResult = {
        name: location.name,
        place_id: location.id,
        formatted_address: location.address,
        geometry: {
          location: new google.maps.LatLng(location.lat, location.lng)
        } as google.maps.places.PlaceGeometry,
      };
      
      // Pass both the place result AND the location data
      onPlaceSelect(placeResult, location);
      setSearchValue(location.name);
      inputRef.current?.blur();
      setJustSelected(true);
    }
  };

  const handleClear = () => {
    setSearchValue('');
    setGooglePredictions([]);
    setGoogleTextSearchResults([]);
    setSupabaseTags([]);
    setMichelinLocations([]);
    setLvLocations([]);
    setShowDropdown(false);
    onClear?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const totalItems = michelinLocations.length + lvLocations.length + supabaseTags.length + googleTextSearchResults.length + googlePredictions.length + 1; // +1 for generic search option
    
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
      } else if (focusedIndex < michelinLocations.length) {
        handleMichelinLocationSelect(michelinLocations[focusedIndex]);
      } else if (focusedIndex < michelinLocations.length + lvLocations.length) {
        handleLvLocationSelect(lvLocations[focusedIndex - michelinLocations.length]);
      } else if (focusedIndex < michelinLocations.length + lvLocations.length + supabaseTags.length) {
        handleTagSelect(supabaseTags[focusedIndex - michelinLocations.length - lvLocations.length]);
      } else if (focusedIndex < michelinLocations.length + lvLocations.length + supabaseTags.length + googleTextSearchResults.length) {
        handleGooglePlaceSelect(googleTextSearchResults[focusedIndex - michelinLocations.length - lvLocations.length - supabaseTags.length]);
      } else {
        handleGooglePlaceSelect(googlePredictions[focusedIndex - michelinLocations.length - lvLocations.length - supabaseTags.length - googleTextSearchResults.length]);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const handleGenericSearch = () => {
    if (!searchValue.trim()) return;
    
    setShowDropdown(false);
    setGooglePredictions([]);
    setGoogleTextSearchResults([]);
    setSupabaseTags([]);
    setMichelinLocations([]);
    setLvLocations([]);
    
    if (onGenericSearch) {
      onGenericSearch(searchValue.trim());
    }
    
    inputRef.current?.blur();
    setJustSelected(true);
  };

  const hasResults = googlePredictions.length > 0 || googleTextSearchResults.length > 0 || supabaseTags.length > 0 || michelinLocations.length > 0 || lvLocations.length > 0;

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
          onChange={(e) => {
            setSearchValue(e.target.value);
            setJustSelected(false); // Reset flag when user starts typing
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            // Only show dropdown if there are results AND user didn't just make a selection
            if (hasResults && !justSelected) {
              setShowDropdown(true);
            }
            // Reset the flag after a small delay to allow user to refocus later
            if (justSelected) {
              setTimeout(() => setJustSelected(false), 100);
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
                className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left border-b border-slate-100 ${
                  focusedIndex === 0 ? 'bg-slate-50' : ''
                }`}
              >
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 flex-shrink-0">
                  <Search className="w-4 h-4 text-slate-600" />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-900">Search for "{searchValue}"</div>
                  <div className="text-xs text-gray-500">Find "{searchValue}" on your map area</div>
                </div>
              </button>
            )}
          
            {/* Michelin Locations Section */}
            {michelinLocations.length > 0 && (
              <div className="border-b border-slate-100">
                <div className="px-4 py-2 bg-gradient-to-r from-red-50 to-rose-50 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    <MichelinFlower className="w-3.5 h-3.5" />
                    <span>Michelin Guide</span>
                  </div>
                </div>
                {michelinLocations.map((location, index) => {
                  // Determine which Michelin icon to show
                  const getMichelinIcon = () => {
                    const score = location.michelinScore || 0;
                    const isHotel = location.tags?.some(tag => 
                      tag.toLowerCase().includes('hotel') || 
                      tag.toLowerCase().includes('accommodation')
                    );
                    
                    if (isHotel) {
                      return <MichelinKey className="w-5 h-5" />;
                    } else {
                      return <MichelinStar className="w-5 h-5" />;
                    }
                  };

                  // Get star count for display
                  const starCount = Math.round(location.michelinScore || 0);
                  
                  return (
                    <button
                      key={location.id}
                      onClick={() => handleMichelinLocationSelect(location)}
                      className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-red-50 transition-colors text-left ${
                        focusedIndex === index + 1 ? 'bg-red-50' : ''
                      }`}
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-red-100 to-rose-100 flex-shrink-0">
                        {getMichelinIcon()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 truncate">
                            {location.name}
                          </span>
                          {starCount > 0 && (
                            <div className="flex items-center gap-0.5">
                              {Array.from({ length: Math.min(starCount, 3) }).map((_, i) => (
                                <MichelinStar key={i} className="w-3 h-3" />
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {location.address}
                        </div>
                        {/* Favorites and Want to Go counters */}
                        {((location.favoritesCount !== undefined && location.favoritesCount > 0) || 
                          (location.wantToGoCount !== undefined && location.wantToGoCount > 0)) && (
                          <div className="flex items-center gap-3 mt-1.5">
                            {location.favoritesCount !== undefined && location.favoritesCount > 0 && (
                              <div className="flex items-center gap-1">
                                <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
                                <span className="text-xs text-gray-600 font-medium">{location.favoritesCount}</span>
                              </div>
                            )}
                            {location.wantToGoCount !== undefined && location.wantToGoCount > 0 && (
                              <div className="flex items-center gap-1">
                                <Bookmark className="w-3 h-3 text-amber-600 fill-amber-600" />
                                <span className="text-xs text-gray-600 font-medium">{location.wantToGoCount}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Le Voyageur Locations Section */}
            {lvLocations.length > 0 && (
              <div className="border-b border-slate-100">
                <div className="px-4 py-2 bg-gradient-to-r from-amber-50 to-rose-50 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    <LVIcon className="w-3 h-3 text-amber-600" />
                    <span>Le Voyageur Guide</span>
                  </div>
                </div>
                {lvLocations.map((location, index) => {
                  const lvScoreColor = getLVScoreColor(location.lvEditorScore || 0);
                  return (
                    <button
                      key={location.id}
                      onClick={() => handleLvLocationSelect(location)}
                      className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-amber-50 transition-colors text-left ${
                        focusedIndex === index + michelinLocations.length + 1 ? 'bg-amber-50' : ''
                      }`}
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-amber-100 to-rose-100 flex-shrink-0">
                        <LVIcon className="w-4 h-4 text-amber-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">
                          {location.name}
                        </div>
                        <div className="text-xs text-gray-500 truncate">
                          {location.address}
                        </div>
                        {/* Favorites and Want to Go counters */}
                        {((location.favoritesCount !== undefined && location.favoritesCount > 0) || 
                          (location.wantToGoCount !== undefined && location.wantToGoCount > 0)) && (
                          <div className="flex items-center gap-3 mt-1.5">
                            {location.favoritesCount !== undefined && location.favoritesCount > 0 && (
                              <div className="flex items-center gap-1">
                                <Heart className="w-3 h-3 text-rose-500 fill-rose-500" />
                                <span className="text-xs text-gray-600 font-medium">{location.favoritesCount}</span>
                              </div>
                            )}
                            {location.wantToGoCount !== undefined && location.wantToGoCount > 0 && (
                              <div className="flex items-center gap-1">
                                <Bookmark className="w-3 h-3 text-amber-600 fill-amber-600" />
                                <span className="text-xs text-gray-600 font-medium">{location.wantToGoCount}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {location.googleRating !== undefined && location.googleRatingsCount !== undefined && location.googleRatingsCount > 0 && (
                          <>
                            <div className="text-xs text-gray-500 font-medium">
                              {location.googleRatingsCount} reviews
                            </div>
                            <div className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 rounded-full">
                              <Star className="w-3.5 h-3.5 text-gray-600 fill-gray-600" />
                              <span className="text-sm font-semibold text-gray-700">
                                {location.googleRating.toFixed(1)}
                              </span>
                            </div>
                          </>
                        )}
                        {(location.lvEditorScore !== undefined && location.lvEditorScore !== null && location.lvEditorScore > 0) && (
                          <div 
                            className="flex items-center justify-center px-2.5 py-1 rounded-full min-w-[44px]"
                            style={{ backgroundColor: lvScoreColor.bg }}
                          >
                            <span className="text-sm font-semibold" style={{ color: lvScoreColor.text }}>
                              {location.lvEditorScore.toFixed(1)}
                            </span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Supabase Tags Section */}
            {supabaseTags.length > 0 && (
              <div className="border-b border-slate-100">
                <div className="px-4 py-2 bg-gradient-to-r from-blue-50 to-sky-50 border-b border-slate-100">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    <LVIcon className="w-3 h-3 text-blue-600" />
                    <span>Le Voyageur Tags</span>
                  </div>
                </div>
                {supabaseTags.map((tag, index) => {
                  const itemIndex = index + michelinLocations.length + lvLocations.length + 1;
                  return (
                    <button
                      key={tag}
                      onClick={() => handleTagSelect(tag)}
                      className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-blue-50 transition-colors text-left ${
                        focusedIndex === itemIndex ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-blue-100 to-sky-100 flex-shrink-0">
                        <LVIcon className="w-4 h-4 text-blue-700" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{tag}</div>
                        <div className="text-xs text-gray-500">Search Le Voyageur collection</div>
                      </div>
                      <Tag className="w-4 h-4 text-blue-600" />
                    </button>
                  );
                })}
              </div>
            )}

            {/* Google Text Search Results Section */}
            {googleTextSearchResults.length > 0 && (
              <div className="border-b border-slate-100">
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-100">
                  <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                    On Your Map
                  </div>
                </div>
                {googleTextSearchResults.map((prediction, index) => (
                  <button
                    key={prediction.place_id}
                    onClick={() => handleGooglePlaceSelect(prediction)}
                    className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left ${
                      focusedIndex === index + michelinLocations.length + lvLocations.length + 1 ? 'bg-slate-50' : ''
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
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {prediction.user_ratings_total !== undefined && (
                        <div className="text-xs text-gray-500 font-medium">
                          {prediction.user_ratings_total} reviews
                        </div>
                      )}
                      {prediction.rating !== undefined && (
                        <div className="flex items-center gap-1 px-2.5 py-1 bg-gray-100 rounded-full">
                          <Star className="w-3.5 h-3.5 text-gray-600 fill-gray-600" />
                          <span className="text-sm font-semibold text-gray-700">
                            {prediction.rating.toFixed(1)}
                          </span>
                        </div>
                      )}
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
                      focusedIndex === index + michelinLocations.length + lvLocations.length + supabaseTags.length + googleTextSearchResults.length + 1 ? 'bg-slate-50' : ''
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