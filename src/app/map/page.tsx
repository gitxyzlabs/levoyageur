// src/app/map/page.tsx
'use client';

import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from '@react-google-maps/api';
import { StandaloneSearchBox } from '@react-google-maps/api';
import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Search } from 'lucide-react';

const mapContainerStyle = {
  width: '100%',
  height: '100vh',
};

const fallbackCenter = {
  lat: 32.7194,
  lng: -117.1591,
};

type Location = {
  id?: string;
  name: string;
  cuisine?: string;
  area?: string;
  editor_rating?: number;
  tags?: string[];
  image?: string | null;
  lat: number;
  lng: number;
  place_id?: string | null;
};

export default function MapPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [selected, setSelected] = useState<Location | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchBox, setSearchBox] = useState<any>(null);
  const [places, setPlaces] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newPlace, setNewPlace] = useState<any>(null);
  const [mapCenter, setMapCenter] = useState(fallbackCenter);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Form fields
  const [rating, setRating] = useState(8.0);
  const [cuisine, setCuisine] = useState('');
  const [area, setArea] = useState('');
  const [tags, setTags] = useState('');

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries: ['places'],
  });

  // Get user's current location
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setMapCenter({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        () => setMapCenter(fallbackCenter)
      );
    } else {
      setMapCenter(fallbackCenter);
    }
  }, []);

  // Load LV locations
  useEffect(() => {
    fetch('/api/locations')
      .then((res) => res.json())
      .then((data) => {
        setLocations(data || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load locations:', err);
        setLoading(false);
      });
  }, []);

  // Auto-focus search input when loaded
  useEffect(() => {
    if (isLoaded && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isLoaded]);

  const onPlacesChanged = () => {
    if (!searchBox) return;
    const results = searchBox.getPlaces();
    if (results) setPlaces(results);
  };

  const handleAddClick = (place: any) => {
    let photoUrl: string | null = null;
    if (place.photos && place.photos.length > 0) {
      photoUrl = place.photos[0].getUrl({ maxWidth: 800 });
    }

    const loc = {
      name: place.name,
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng(),
      place_id: place.place_id,
      image: photoUrl,
    };

    setNewPlace(loc);
    setShowAddModal(true);

    setCuisine(place.types?.includes('restaurant') || place.types?.includes('food') ? '' : '');
    setArea(place.vicinity || '');
  };

  const saveNewLocation = async () => {
    if (!newPlace) return;

    const body = {
      name: newPlace.name,
      cuisine: cuisine || null,
      area: area || null,
      editor_rating: rating,
      tags: tags.split(',').map((t: string) => t.trim()).filter(Boolean),
      image: newPlace.image || null,
      lat: newPlace.lat,
      lng: newPlace.lng,
      place_id: newPlace.place_id || null,
    };

    const res = await fetch('/api/locations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const saved = await res.json();
      setLocations((prev) => [...prev, ...saved]);
      setShowAddModal(false);
      setNewPlace(null);
      setRating(8.0);
      setCuisine('');
      setArea('');
      setTags('');
    } else {
      const errText = await res.text();
      alert('Save failed: ' + errText);
    }
  };

  const getMarkerColor = (r: number = 5) => {
    if (r >= 10.5) return '#991b1b';
    if (r >= 9.5) return '#be123c';
    if (r >= 8.5) return '#dc2626';
    if (r >= 7.5) return '#ea580c';
    if (r >= 6.5) return '#f59e0b';
    return '#fcd34d';
  };

  const getMarkerScale = (r: number = 5) => 8 + r;

  const getHotColor = (r: number) => {
    if (r >= 10.5) return '#991b1b';
    if (r >= 9.5) return '#be123c';
    if (r >= 8.5) return '#dc2626';
    if (r >= 7.5) return '#ea580c';
    if (r >= 6.5) return '#f59e0b';
    return '#fcd34d';
  };

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50 text-gray-700 text-xl font-medium">
        Loading map...
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen">
      <GoogleMap mapContainerStyle={mapContainerStyle} center={mapCenter} zoom={14}>
        {/* Existing curated LV markers */}
        {locations.map((loc) => (
          <Marker
            key={loc.id || loc.place_id}
            position={{ lat: loc.lat, lng: loc.lng }}
            onClick={() => setSelected(loc)}
            icon={{
              path: google.maps.SymbolPath.CIRCLE,
              fillColor: getMarkerColor(loc.editor_rating || 5),
              fillOpacity: 1,
              strokeColor: '#fff',
              strokeWeight: 4,
              scale: getMarkerScale(loc.editor_rating || 5),
            }}
            label={{
              text: loc.editor_rating != null ? loc.editor_rating.toFixed(1) : '?',
              color: 'white',
              fontSize: '14px',
              fontWeight: 'bold',
            }}
          />
        ))}

        {/* Search result pins (blue) */}
        {places.map((place, i) => (
          <Marker
            key={`search-${i}`}
            position={{
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
            }}
            icon={{
              url: 'http://maps.google.com/mapfiles/ms/micons/blue-dot.png',
            }}
            onClick={() => handleAddClick(place)}
          />
        ))}

        {/* Info window */}
        {selected && (
          <InfoWindow
            position={{ lat: selected.lat, lng: selected.lng }}
            onCloseClick={() => setSelected(null)}
          >
            <div className="p-4 max-w-xs">
              {selected.image ? (
                <img
                  src={selected.image}
                  alt={selected.name}
                  className="w-full h-40 object-cover rounded-lg mb-3"
                />
              ) : (
                <div className="bg-gray-200 border-2 border-dashed rounded-lg w-full h-40 mb-3 flex items-center justify-center">
                  <p className="text-gray-500 text-sm">No photo</p>
                </div>
              )}
              <h3 className="font-serif text-xl font-bold text-gray-900">{selected.name}</h3>
              <p className="text-sm text-gray-600 mt-1">
                {selected.cuisine || 'Restaurant'} • {selected.area || 'San Diego'}
              </p>
              <div className="mt-4">
                <span className="bg-amber-100 text-amber-800 px-4 py-2 rounded-full text-lg font-bold">
                  LV {selected.editor_rating != null ? selected.editor_rating.toFixed(1) : '—'}/11
                </span>
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {/* Floating bottom-centered search bar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10 w-full max-w-lg px-4">
        <div className="relative">
          <StandaloneSearchBox onLoad={(ref) => setSearchBox(ref)} onPlacesChanged={onPlacesChanged}>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search places to add (e.g., tacos, sushi, rooftop bar...)"
                className="w-full pl-12 pr-5 py-4 text-lg rounded-full bg-white/90 backdrop-blur-lg border border-gray-200/50 shadow-2xl focus:outline-none focus:ring-4 focus:ring-amber-300/50 text-gray-900 placeholder-gray-500 transition-all duration-300"
              />
            </div>
          </StandaloneSearchBox>
        </div>
      </div>

      {/* Add New Location Modal */}
      {showAddModal && newPlace && (
        <div className="absolute inset-0 bg-black/60 z-20 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 max-h-screen overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-serif font-bold text-gray-900">Add to Le Voyageur</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition"
              >
                <X size={28} />
              </button>
            </div>

            <h3 className="text-xl font-medium mb-4">{newPlace.name}</h3>

            {newPlace.image ? (
              <img
                src={newPlace.image}
                alt={newPlace.name}
                className="w-full h-48 object-cover rounded-lg mb-6"
              />
            ) : (
              <div className="bg-gray-100 h-48 rounded-lg mb-6 flex items-center justify-center">
                <p className="text-gray-500">No photo available</p>
              </div>
            )}

            <div className="space-y-8">
              {/* Hot Decimal Slider */}
              <div>
                <label className="block text-sm font-semibold mb-4 text-center">LV Editor Rating</label>
                <div className="text-center mb-6">
                  <span className="text-6xl font-bold" style={{ color: getHotColor(rating) }}>
                    {rating.toFixed(1)}
                  </span>
                  <span className="text-2xl text-gray-600 ml-2">/11</span>
                </div>

                <div className="relative px-4">
                  <input
                    type="range"
                    min="0"
                    max="11"
                    step="0.1"
                    value={rating}
                    onChange={(e) => setRating(parseFloat(e.target.value))}
                    className="w-full h-8 bg-transparent cursor-pointer appearance-none focus:outline-none [&::-webkit-slider-runnable-track]:h-8 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-12 [&::-webkit-slider-thumb]:w-12 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:-mt-2 [&::-webkit-slider-thumb]:shadow-2xl [&::-webkit-slider-thumb]:cursor-grab [&::-moz-range-track]:h-8 [&::-moz-range-track]:rounded-full [&::-moz-range-thumb]:h-12 [&::-moz-range-thumb]:w-12 [&::-moz-range-thumb]:rounded-full"
                    style={{
                      background: `linear-gradient(to right, 
                        #fcd34d 0%, 
                        #fcd34d ${(rating / 11) * 100}%, 
                        #f59e0b ${(rating / 11) * 100}%, 
                        #ea580c 70%, 
                        #dc2626 85%, 
                        #991b1b 100%)`,
                    }}
                  />
                  
                  <style jsx>{`
                    input[type="range"]::-webkit-slider-thumb {
                      background: ${getHotColor(rating)};
                      box-shadow: 0 0 20px ${getHotColor(rating)}80;
                    }
                    input[type="range"]::-moz-range-thumb {
                      background: ${getHotColor(rating)};
                      box-shadow: 0 0 20px ${getHotColor(rating)}80;
                    }
                  `}</style>
                  
                  <div className="flex justify-between text-xs text-gray-500 mt-3 px-2">
                    <span>0.0</span>
                    <span>5.5</span>
                    <span>11.0</span>
                  </div>
                </div>
              </div>

              <input
                placeholder="Cuisine (e.g., Mexican, Italian)"
                value={cuisine}
                onChange={(e) => setCuisine(e.target.value)}
                className="w-full px-5 py-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-4 focus:ring-amber-200"
              />

              <input
                placeholder="Area (e.g., North Park, Gaslamp)"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="w-full px-5 py-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-4 focus:ring-amber-200"
              />

              <input
                placeholder="Tags (comma separated: tacos, casual, rooftop)"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full px-5 py-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-4 focus:ring-amber-200"
              />

              <button
                onClick={saveNewLocation}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-5 rounded-xl text-lg transition shadow-lg"
              >
                Save to Guide
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}