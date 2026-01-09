// src/app/map/page.tsx
'use client';

import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from '@react-google-maps/api';
import { StandaloneSearchBox } from '@react-google-maps/api';
import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Search, Heart, Share2, Navigation, Menu } from 'lucide-react';

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
  google_rating?: number | null;
  google_count?: number | null;
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
  const [searchValue, setSearchValue] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);

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

  // Auto-focus search input
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

  const fetchGoogleRating = (placeId: string) => {
    if (!placeId || !mapRef.current) return;

    const service = new google.maps.places.PlacesService(mapRef.current);
    service.getDetails(
      { placeId, fields: ['rating', 'user_ratings_total'] },
      (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
          setSelected((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              google_rating: place.rating ?? null,
              google_count: place.user_ratings_total ?? null,
            };
          });
        }
      }
    );
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

  if (!isLoaded) return <div className="flex h-screen items-center justify-center bg-gray-50 text-gray-700 text-xl font-medium">Loading map...</div>;

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Premium fixed top header */}
      <div className="absolute top-0 left-0 right-0 z-30 px-6 pt-6 pb-4 bg-gradient-to-b from-white/95 to-transparent backdrop-blur-md border-b border-white/20 shadow-sm">
        <div className="flex items-center justify-between max-w-5xl mx-auto">
          {/* Logo */}
          <h1 className="text-3xl md:text-4xl font-serif font-extrabold text-amber-900 tracking-tight drop-shadow-md">
            Le Voyageur
          </h1>

          {/* Menu button */}
          <button className="p-3 rounded-full bg-white/80 backdrop-blur-sm border border-gray-200/50 shadow-sm hover:bg-white/90 transition">
            <Menu size={26} className="text-gray-700" />
          </button>
        </div>
      </div>

      {/* Map */}
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={mapCenter}
        zoom={14}
        onLoad={(map) => {
          mapRef.current = map;
        }}
      >
        {/* Existing curated LV markers */}
        {locations.map((loc) => (
          <Marker
            key={loc.id || loc.place_id}
            position={{ lat: loc.lat, lng: loc.lng }}
            onClick={() => {
              setSelected(loc);
              if (loc.place_id) fetchGoogleRating(loc.place_id);
            }}
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

        {/* Premium Info Window / Action Menu */}
        {selected && (
          <InfoWindow
            position={{ lat: selected.lat, lng: selected.lng }}
            onCloseClick={() => setSelected(null)}
          >
            <div className="w-96 bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100">
              {/* Hero image */}
              {selected.image ? (
                <img
                  src={selected.image}
                  alt={selected.name}
                  className="w-full h-48 object-cover"
                />
              ) : (
                <div className="w-full h-48 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                  <p className="text-gray-500 font-medium">No photo available</p>
                </div>
              )}

              {/* Content */}
              <div className="p-6">
                <h3 className="text-2xl font-serif font-bold text-gray-900 mb-1">{selected.name}</h3>
                <p className="text-sm text-gray-600 mb-6">
                  {selected.cuisine || 'Restaurant'} • {selected.area || 'San Diego'}
                </p>

                {/* Ratings */}
                <div className="flex items-center gap-8 mb-8">
                  {/* LV Rating */}
                  <div className="text-center">
                    <div className="text-5xl font-extrabold text-amber-800">
                      {selected.editor_rating?.toFixed(1) || '—'}
                    </div>
                    <p className="text-sm text-amber-700 font-medium">LV Rating</p>
                  </div>

                  {/* Google User Rating */}
                  <div className="text-center">
                    <div className="text-5xl font-extrabold text-gray-800">
                      {selected.google_rating?.toFixed(1) || '—'}
                    </div>
                    <p className="text-sm text-gray-600 font-medium">
                      User Rating ({selected.google_count || 0} reviews)
                    </p>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="grid grid-cols-3 gap-4">
                  <button className="flex flex-col items-center gap-2 p-4 bg-amber-50 hover:bg-amber-100 rounded-xl transition">
                    <Heart size={28} className="text-amber-600" />
                    <span className="text-sm font-medium text-gray-800">Favorite</span>
                  </button>

                  <button className="flex flex-col items-center gap-2 p-4 bg-amber-50 hover:bg-amber-100 rounded-xl transition">
                    <Share2 size={28} className="text-amber-600" />
                    <span className="text-sm font-medium text-gray-800">Share</span>
                  </button>

                  <button className="flex flex-col items-center gap-2 p-4 bg-amber-50 hover:bg-amber-100 rounded-xl transition">
                    <Navigation size={28} className="text-amber-600" />
                    <span className="text-sm font-medium text-gray-800">Directions</span>
                  </button>
                </div>
              </div>
            </div>
          </InfoWindow>
        )}
      </GoogleMap>

      {/* Premium floating bottom-centered search bar */}
      <div className="absolute bottom-[calc(5rem + env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-10 w-full max-w-xl px-8 pb-8">
        <div className="relative group">
          <StandaloneSearchBox onLoad={(ref) => setSearchBox(ref)} onPlacesChanged={onPlacesChanged}>
            <div className="relative">
              {/* Search Icon */}
              <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
                <Search className="h-6 w-6 text-gray-500 group-focus-within:text-amber-600 transition-colors duration-300" />
              </div>

              {/* Input */}
              <input
                ref={searchInputRef}
                type="text"
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                placeholder="Search places to add (tacos, sushi, rooftop bar...)"
                className="w-full pl-16 pr-16 py-5 text-lg rounded-3xl bg-white/90 backdrop-blur-2xl border border-white/30 shadow-2xl focus:outline-none focus:ring-4 focus:ring-amber-400/40 focus:border-amber-400/50 text-gray-900 placeholder-gray-500 transition-all duration-300 transform group-focus-within:scale-[1.02]"
              />

              {/* Clear button */}
              {searchValue && (
                <button
                  onClick={() => {
                    setSearchValue('');
                    if (searchInputRef.current) searchInputRef.current.value = '';
                    setPlaces([]);
                  }}
                  className="absolute inset-y-0 right-6 flex items-center text-gray-400 hover:text-gray-700 transition duration-200"
                >
                  <X size={20} />
                </button>
              )}
            </div>
          </StandaloneSearchBox>
        </div>
      </div>

      {/* Add New Location Modal */}
      {showAddModal && newPlace && (
        <div className="absolute inset-0 bg-black/60 z-20 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 max-h-[90vh] overflow-y-auto border border-white/20">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-serif font-bold text-gray-900">Add to Le Voyageur</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-3 hover:bg-gray-100 rounded-full transition"
              >
                <X size={28} />
              </button>
            </div>

            <h3 className="text-2xl font-medium mb-6">{newPlace.name}</h3>

            {newPlace.image ? (
              <img
                src={newPlace.image}
                alt={newPlace.name}
                className="w-full h-64 object-cover rounded-2xl mb-8 shadow-md"
              />
            ) : (
              <div className="bg-gradient-to-br from-gray-100 to-gray-200 h-64 rounded-2xl mb-8 flex items-center justify-center">
                <p className="text-gray-500 text-lg">No photo available</p>
              </div>
            )}

            <div className="space-y-10">
              {/* Hot Decimal Slider */}
              <div>
                <label className="block text-lg font-semibold mb-5 text-center">LV Editor Rating</label>
                <div className="text-center mb-8">
                  <span className="text-8xl font-extrabold tracking-tight" style={{ color: getHotColor(rating) }}>
                    {rating.toFixed(1)}
                  </span>
                  <span className="text-4xl text-gray-600 ml-3">/11</span>
                </div>

                <div className="relative px-6">
                  <input
                    type="range"
                    min="0"
                    max="11"
                    step="0.1"
                    value={rating}
                    onChange={(e) => setRating(parseFloat(e.target.value))}
                    className="w-full h-12 bg-transparent cursor-pointer appearance-none focus:outline-none [&::-webkit-slider-runnable-track]:h-12 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-20 [&::-webkit-slider-thumb]:w-20 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:-mt-4 [&::-webkit-slider-thumb]:shadow-2xl [&::-webkit-slider-thumb]:cursor-grab [&::-moz-range-track]:h-12 [&::-moz-range-track]:rounded-full [&::-moz-range-thumb]:h-20 [&::-moz-range-thumb]:w-20 [&::-moz-range-thumb]:rounded-full"
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
                      box-shadow: 0 0 30px ${getHotColor(rating)}a0;
                    }
                    input[type="range"]::-moz-range-thumb {
                      background: ${getHotColor(rating)};
                      box-shadow: 0 0 30px ${getHotColor(rating)}a0;
                    }
                  `}</style>
                  
                  <div className="flex justify-between text-base text-gray-500 mt-5 px-4">
                    <span>0.0</span>
                    <span>5.5</span>
                    <span>11.0</span>
                  </div>
                </div>
              </div>

              <input
                placeholder="Cuisine (e.g., Mexican, Italian, fusion)"
                value={cuisine}
                onChange={(e) => setCuisine(e.target.value)}
                className="w-full px-7 py-6 border border-gray-200/50 rounded-2xl bg-white/80 backdrop-blur-lg focus:outline-none focus:ring-4 focus:ring-amber-300/30 text-lg shadow-inner"
              />

              <input
                placeholder="Area (e.g., North Park, Gaslamp Quarter)"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                className="w-full px-7 py-6 border border-gray-200/50 rounded-2xl bg-white/80 backdrop-blur-lg focus:outline-none focus:ring-4 focus:ring-amber-300/30 text-lg shadow-inner"
              />

              <input
                placeholder="Tags (comma separated: tacos, casual, rooftop, late-night)"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="w-full px-7 py-6 border border-gray-200/50 rounded-2xl bg-white/80 backdrop-blur-lg focus:outline-none focus:ring-4 focus:ring-amber-300/30 text-lg shadow-inner"
              />

              <button
                onClick={saveNewLocation}
                className="w-full bg-gradient-to-r from-amber-600 to-amber-800 hover:from-amber-700 hover:to-amber-900 text-white font-bold py-6 rounded-2xl text-xl transition shadow-lg transform hover:scale-[1.02] duration-300"
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