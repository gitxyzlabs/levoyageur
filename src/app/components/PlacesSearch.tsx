import { useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import { Search, X } from 'lucide-react';
import { Input } from './ui/input';
import { motion } from 'motion/react';

interface PlacesSearchProps {
  onPlacesChanged: (places: google.maps.places.PlaceResult[]) => void;
}

export function PlacesSearch({ onPlacesChanged }: PlacesSearchProps) {
  const [searchValue, setSearchValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const places = useMapsLibrary('places');
  const [searchBox, setSearchBox] = useState<google.maps.places.SearchBox | null>(null);

  // Initialize SearchBox when places library is loaded
  useState(() => {
    if (!places || !inputRef.current) return;
    
    const box = new places.SearchBox(inputRef.current);
    setSearchBox(box);
    
    box.addListener('places_changed', () => {
      const results = box.getPlaces();
      if (results && results.length > 0) {
        onPlacesChanged(results);
      }
    });
  });

  return (
    <div className="relative group">
      <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none z-10">
        <Search className="h-5 w-5 text-gray-400 group-focus-within:text-amber-500 transition-colors duration-300" />
      </div>
      <input
        ref={inputRef}
        type="text"
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        placeholder="Search for restaurants, hotels, cafes..."
        className="w-full pl-12 pr-12 py-4 text-base rounded-2xl bg-white/95 backdrop-blur-2xl border-2 border-white/40 shadow-2xl focus:outline-none focus:ring-4 focus:ring-amber-400/30 focus:border-amber-400/50 text-gray-900 placeholder-gray-400 transition-all duration-300 hover:shadow-amber-200/50"
      />
      {searchValue && (
        <motion.button
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          onClick={() => {
            setSearchValue('');
            if (inputRef.current) {
              inputRef.current.value = '';
            }
          }}
          className="absolute inset-y-0 right-4 flex items-center text-gray-400 hover:text-gray-700 transition duration-200"
        >
          <X size={18} />
        </motion.button>
      )}
    </div>
  );
}
