// src/app/map/page.tsx
'use client';

import { GoogleMap, Marker, InfoWindow, useJsApiLoader } from '@react-google-maps/api';
import { StandaloneSearchBox } from '@react-google-maps/api';
import { useState, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

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

  // Form fields
  const [rating, setRating] = useState(8.0);
  const [cuisine, setCuisine] = useState('');
  const [area, setArea] = useState('');
  const [tags, setTags] = useState('');

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
    libraries: ['places'],
  });

  // Get user's current location on initial load
  useEffect(() => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const pos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setMapCenter(pos);
        },
        () => setMapCenter(fallbackCenter)
      );
    } else {
      setMapCenter(fallbackCenter);
    }
  }, []);

  // Load existing LV locations
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

  if (!isLoaded) return <div className="flex h-screen items-center justify-center bg-gray-50 text-gray-700">Loading map...</div>;

  return (
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
  );
}