import { useRef, useState, useEffect } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { Search, X } from 'lucide-react';
import { motion } from 'motion/react';

interface PlacesSearchOverlayProps {
  onPlacesChanged: (places: google.maps.places.PlaceResult[]) => void;
  onClearSearch: () => void;
}

export function PlacesSearchOverlay({ onPlacesChanged, onClearSearch }: PlacesSearchOverlayProps) {
  const [searchValue, setSearchValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const places = useMapsLibrary('places');
  const [searchBox, setSearchBox] = useState<google.maps.places.SearchBox | null>(null);

  // Initialize SearchBox when places library is loaded
  useEffect(() => {
    if (!places || !inputRef.current || searchBox) return;
    
    const box = new places.SearchBox(inputRef.current);
    setSearchBox(box);
    
    box.addListener('places_changed', () => {
      const results = box.getPlaces();
      if (results && results.length > 0) {
        console.log('Places search results:', results);
        onPlacesChanged(results);
      }
    });
  }, [places, onPlacesChanged, searchBox]);

  const handleClear = () => {
    setSearchValue('');
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    onClearSearch();
  };

  return (
    <motion.div
      initial={{ y: -50, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="absolute top-6 left-1/2 -translate-x-1/2 z-20 w-full max-w-2xl px-6"
    >
      <div className="relative group">
        <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none z-10">
          <Search className="h-5 w-5 text-gray-400 group-focus-within:text-amber-500 transition-colors duration-300" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="Search for restaurants, hotels, cafes..."
          className="w-full pl-14 pr-14 py-4 text-base rounded-2xl bg-white/95 backdrop-blur-2xl border-2 border-white/40 shadow-2xl focus:outline-none focus:ring-4 focus:ring-amber-400/30 focus:border-amber-400/50 text-gray-900 placeholder-gray-400 transition-all duration-300 hover:shadow-amber-200/50"
        />
        {searchValue && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            onClick={handleClear}
            className="absolute inset-y-0 right-5 flex items-center text-gray-400 hover:text-gray-700 transition duration-200"
          >
            <X size={18} />
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
