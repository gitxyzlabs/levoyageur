import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MapPin, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';

interface AddLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    lat: number;
    lng: number;
    place_id?: string | null;
    image?: string | null;
    lvEditorsScore: number;
    lvCrowdsourceScore: number;
    googleRating: number;
    michelinScore: number;
    cuisine?: string;
    area?: string;
    tags: string[];
    description?: string;
  }) => void;
  initialPlace?: any; // Changed to any to accept google.maps.places.PlaceResult
  onLocationAdded: () => void;
  selectedPlace?: any;
}

const getHotColor = (rating: number) => {
  if (rating >= 10.5) return '#991b1b';
  if (rating >= 9.5) return '#be123c';
  if (rating >= 8.5) return '#dc2626';
  if (rating >= 7.5) return '#ea580c';
  if (rating >= 6.5) return '#f59e0b';
  return '#fcd34d';
};

const getRatingLabel = (rating: number) => {
  if (rating >= 10.5) return 'Legendary';
  if (rating >= 9.5) return 'Exceptional';
  if (rating >= 8.5) return 'Outstanding';
  if (rating >= 7.5) return 'Excellent';
  if (rating >= 6.5) return 'Very Good';
  return 'Good';
};

export function AddLocationModal({ isOpen, onClose, onSave, initialPlace, onLocationAdded, selectedPlace }: AddLocationModalProps) {
  const [name, setName] = useState(initialPlace?.name || '');
  const [rating, setRating] = useState(8.0);
  const [cuisine, setCuisine] = useState('');
  const [area, setArea] = useState(initialPlace?.vicinity || '');
  const [tags, setTags] = useState('');
  const [description, setDescription] = useState('');

  const handleSave = () => {
    if (!name || !initialPlace) return;

    console.log('=== AddLocationModal Save Debug ===');
    console.log('initialPlace:', initialPlace);
    console.log('place_id:', initialPlace.place_id);
    console.log('geometry:', initialPlace.geometry);
    
    // Extract lat/lng from Google Place geometry
    const lat = initialPlace.geometry?.location?.lat() || initialPlace.lat;
    const lng = initialPlace.geometry?.location?.lng() || initialPlace.lng;
    
    console.log('Extracted lat:', lat);
    console.log('Extracted lng:', lng);

    onSave({
      name,
      lat,
      lng,
      place_id: initialPlace.place_id || null,
      image: initialPlace.image || null,
      lvEditorsScore: rating,
      lvCrowdsourceScore: 0,
      googleRating: 0,
      michelinScore: 0,
      cuisine: cuisine || undefined,
      area: area || undefined,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      description: description || undefined,
    });

    // Reset form
    setName('');
    setRating(8.0);
    setCuisine('');
    setArea('');
    setTags('');
    setDescription('');

    // Call the onLocationAdded callback
    onLocationAdded();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 50 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border-2 border-white/50"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 bg-gradient-to-r from-amber-50 via-rose-50 to-amber-50 border-b border-gray-200/50 backdrop-blur-xl">
              <div className="flex justify-between items-center p-6">
                <div>
                  <h2 className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-rose-600 bg-clip-text text-transparent">
                    Add to Collection
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">Curate your culinary journey</p>
                </div>
                <motion.button
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onClose}
                  className="p-3 hover:bg-white/80 rounded-full transition"
                >
                  <X size={24} className="text-gray-700" />
                </motion.button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6">
              {/* Image placeholder */}
              <div className="bg-gradient-to-br from-amber-100 via-rose-100 to-amber-100 h-48 rounded-2xl mb-6 flex items-center justify-center shadow-inner overflow-hidden">
                {initialPlace?.image ? (
                  <img 
                    src={initialPlace.image} 
                    alt={initialPlace.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <MapPin className="text-gray-400" size={64} />
                )}
              </div>

              <div className="space-y-5">
                {/* Name */}
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">Restaurant Name</Label>
                  <Input
                    placeholder="Restaurant Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 text-base shadow-sm transition-all"
                  />
                </div>

                {/* Rating Slider */}
                <div>
                  <Label className="text-sm font-semibold mb-4 text-gray-700 text-center block">
                    Your Expert Rating
                  </Label>
                  <div className="text-center mb-6">
                    <motion.div
                      key={rating}
                      initial={{ scale: 1.2 }}
                      animate={{ scale: 1 }}
                      className="inline-block"
                    >
                      <span
                        className="text-7xl font-extrabold tracking-tight"
                        style={{ color: getHotColor(rating) }}
                      >
                        {rating.toFixed(1)}
                      </span>
                      <span className="text-3xl text-gray-400 ml-2">/11</span>
                    </motion.div>
                    <div className="mt-2">
                      <span
                        className="inline-block px-4 py-1 rounded-full text-sm font-bold text-white shadow-lg"
                        style={{ backgroundColor: getHotColor(rating) }}
                      >
                        {getRatingLabel(rating)}
                      </span>
                    </div>
                  </div>
                  <div className="relative px-2">
                    <input
                      type="range"
                      min="0"
                      max="11"
                      step="0.1"
                      value={rating}
                      onChange={(e) => setRating(parseFloat(e.target.value))}
                      className="w-full h-3 bg-transparent cursor-pointer appearance-none focus:outline-none rounded-full"
                      style={{
                        background: `linear-gradient(to right,
                          #fcd34d 0%,
                          #f59e0b ${(6.5 / 11) * 100}%,
                          #ea580c ${(7.5 / 11) * 100}%,
                          #dc2626 ${(8.5 / 11) * 100}%,
                          #be123c ${(9.5 / 11) * 100}%,
                          #991b1b 100%)`,
                      }}
                    />
                    <style>{`
                      input[type="range"]::-webkit-slider-thumb {
                        appearance: none;
                        height: 28px;
                        width: 28px;
                        rounded: full;
                        background: ${getHotColor(rating)};
                        cursor: grab;
                        border: 4px solid white;
                        box-shadow: 0 0 20px ${getHotColor(rating)}80, 0 4px 10px rgba(0,0,0,0.2);
                        border-radius: 50%;
                      }
                      input[type="range"]::-moz-range-thumb {
                        height: 28px;
                        width: 28px;
                        background: ${getHotColor(rating)};
                        cursor: grab;
                        border: 4px solid white;
                        box-shadow: 0 0 20px ${getHotColor(rating)}80, 0 4px 10px rgba(0,0,0,0.2);
                        border-radius: 50%;
                      }
                      input[type="range"]::-webkit-slider-runnable-track {
                        height: 12px;
                        border-radius: 9999px;
                      }
                      input[type="range"]::-moz-range-track {
                        height: 12px;
                        border-radius: 9999px;
                      }
                    `}</style>
                    <div className="flex justify-between text-xs text-gray-400 mt-3 px-2">
                      <span>0</span>
                      <span>5.5</span>
                      <span>11</span>
                    </div>
                  </div>
                </div>

                {/* Cuisine */}
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">Cuisine</Label>
                  <Input
                    placeholder="e.g., Modern Italian, Farm-to-Table"
                    value={cuisine}
                    onChange={(e) => setCuisine(e.target.value)}
                    className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl bg-gray-50/50"
                  />
                </div>

                {/* Area */}
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">Neighborhood</Label>
                  <Input
                    placeholder="e.g., Little Italy, Gaslamp"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl bg-gray-50/50"
                  />
                </div>

                {/* Tags */}
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">Tags</Label>
                  <Input
                    placeholder="romantic, outdoor seating, craft cocktails"
                    value={tags}
                    onChange={(e) => setTags(e.target.value)}
                    className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl bg-gray-50/50"
                  />
                </div>

                {/* Description */}
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">Description (optional)</Label>
                  <textarea
                    placeholder="Share your experience..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className="w-full px-5 py-4 border-2 border-gray-200 rounded-xl bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:border-amber-400 text-base shadow-sm transition-all resize-none"
                  />
                </div>

                {/* Save Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSave}
                  disabled={!name}
                  className="w-full bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500 hover:from-amber-600 hover:via-rose-600 hover:to-amber-600 text-white font-bold py-5 rounded-xl text-lg transition-all shadow-lg hover:shadow-xl bg-[length:200%_100%] hover:bg-right-bottom duration-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="flex items-center justify-center gap-2">
                    <Sparkles size={20} />
                    Add to My Guide
                  </span>
                </motion.button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}