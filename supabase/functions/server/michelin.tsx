/**
 * Michelin Guide Data Scraper
 * 
 * Data sources:
 * - Kaggle Dataset: ngshiheng/michelin-guide-restaurants-2021
 * - Fallback: GitHub repos
 * - Fallback: Sample data
 * 
 * This module fetches Michelin Guide restaurant data and stores it in our database.
 * Michelin ratings:
 * - 1-3 stars: Official Michelin star ratings
 * - 4: Bib Gourmand
 * - 5: Michelin Plate (Selected Restaurants)
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";

// Types
interface MichelinRestaurant {
  name: string;
  location: string;
  address?: string;
  city: string;
  region?: string;
  country: string;
  latitude: number;
  longitude: number;
  stars: number; // 1-3 for stars, 4 for Bib Gourmand, 5 for Plate
  cuisines?: string[];
  url?: string;
  price?: string;
  award?: string;
}

/**
 * Get sample Michelin data (fallback when APIs are unavailable)
 */
function getSampleMichelinData(): MichelinRestaurant[] {
  return [
    // Three-star restaurants
    { name: "Alain Ducasse au Plaza Athénée", location: "Paris", latitude: 48.8664, longitude: 2.3041, stars: 3, city: "Paris", country: "France", cuisines: ["French"] },
    { name: "L'Ambroisie", location: "Paris", latitude: 48.8534, longitude: 2.3626, stars: 3, city: "Paris", country: "France", cuisines: ["French"] },
    { name: "Arpège", location: "Paris", latitude: 48.8566, longitude: 2.3160, stars: 3, city: "Paris", country: "France", cuisines: ["Contemporary"] },
    { name: "Guy Savoy", location: "Paris", latitude: 48.8576, longitude: 2.3385, stars: 3, city: "Paris", country: "France", cuisines: ["French"] },
    { name: "Le Pré Catelan", location: "Paris", latitude: 48.8634, longitude: 2.2497, stars: 3, city: "Paris", country: "France", cuisines: ["French"] },
    { name: "Pierre Gagnaire", location: "Paris", latitude: 48.8738, longitude: 2.3044, stars: 3, city: "Paris", country: "France", cuisines: ["French"] },
    { name: "Alléno Paris au Pavillon Ledoyen", location: "Paris", latitude: 48.8661, longitude: 2.3153, stars: 3, city: "Paris", country: "France", cuisines: ["French"] },
    { name: "Le Cinq", location: "Paris", latitude: 48.8683, longitude: 2.3038, stars: 3, city: "Paris", country: "France", cuisines: ["French"] },
    
    // Two-star restaurants
    { name: "Astrance", location: "Paris", latitude: 48.8584, longitude: 2.2945, stars: 2, city: "Paris", country: "France", cuisines: ["Contemporary"] },
    { name: "L'Atelier de Joël Robuchon Étoile", location: "Paris", latitude: 48.8738, longitude: 2.2950, stars: 2, city: "Paris", country: "France", cuisines: ["French"] },
    { name: "Le Gabriel", location: "Paris", latitude: 48.8697, longitude: 2.3147, stars: 2, city: "Paris", country: "France", cuisines: ["French"] },
    { name: "David Toutain", location: "Paris", latitude: 48.8566, longitude: 2.3172, stars: 2, city: "Paris", country: "France", cuisines: ["Contemporary"] },
    { name: "Kei", location: "Paris", latitude: 48.8656, longitude: 2.3322, stars: 2, city: "Paris", country: "France", cuisines: ["French"] },
    { name: "Septime", location: "Paris", latitude: 48.8534, longitude: 2.3810, stars: 2, city: "Paris", country: "France", cuisines: ["Contemporary"] },
    
    // One-star restaurants
    { name: "Frenchie", location: "Paris", latitude: 48.8656, longitude: 2.3410, stars: 1, city: "Paris", country: "France", cuisines: ["Contemporary"] },
    { name: "Yam'Tcha", location: "Paris", latitude: 48.8656, longitude: 2.3322, stars: 1, city: "Paris", country: "France", cuisines: ["Fusion"] },
    { name: "Quinsou", location: "Paris", latitude: 48.8502, longitude: 2.3292, stars: 1, city: "Paris", country: "France", cuisines: ["French"] },
    { name: "Le Chateaubriand", location: "Paris", latitude: 48.8699, longitude: 2.3832, stars: 1, city: "Paris", country: "France", cuisines: ["Contemporary"] },
    
    // International (New York)
    { name: "Eleven Madison Park", location: "New York", latitude: 40.7421, longitude: -73.9876, stars: 3, city: "New York", country: "USA", cuisines: ["Contemporary"] },
    { name: "Le Bernardin", location: "New York", latitude: 40.7614, longitude: -73.9776, stars: 3, city: "New York", country: "USA", cuisines: ["Seafood"] },
    { name: "Per Se", location: "New York", latitude: 40.7686, longitude: -73.9830, stars: 3, city: "New York", country: "USA", cuisines: ["French"] },
    
    // International (Tokyo)
    { name: "Kanda", location: "Tokyo", latitude: 35.6751, longitude: 139.7706, stars: 3, city: "Tokyo", country: "Japan", cuisines: ["Japanese"] },
    { name: "Quintessence", location: "Tokyo", latitude: 35.6484, longitude: 139.7274, stars: 3, city: "Tokyo", country: "Japan", cuisines: ["French"] },
    
    // International (Spain)
    { name: "Azurmendi", location: "Larrabetzu", latitude: 43.2345, longitude: -2.8418, stars: 3, city: "Larrabetzu", country: "Spain", cuisines: ["Basque"] },
    { name: "Martín Berasategui", location: "Lasarte-Oria", latitude: 43.2697, longitude: -2.0192, stars: 3, city: "Lasarte-Oria", country: "Spain", cuisines: ["Basque"] },
    { name: "ABaC", location: "Barcelona", latitude: 41.4036, longitude: 2.1364, stars: 3, city: "Barcelona", country: "Spain", cuisines: ["Contemporary"] },
  ];
}

/**
 * Fetch Michelin data from Kaggle Dataset
 * Dataset: ngshiheng/michelin-guide-restaurants-2021
 */
export async function fetchMichelinDataFromKaggle(): Promise<MichelinRestaurant[]> {
  const restaurants: MichelinRestaurant[] = [];
  
  try {
    const kaggleToken = Deno.env.get('KAGGLE_API_TOKEN');
    
    if (!kaggleToken) {
      console.error('❌ KAGGLE_API_TOKEN not found in environment variables');
      return restaurants;
    }
    
    console.log('🔍 Fetching Michelin data from Kaggle...');
    console.log('📍 Kaggle token present:', kaggleToken.substring(0, 15) + '...');
    
    // Kaggle API endpoint for dataset files
    const datasetOwner = 'ngshiheng';
    const datasetName = 'michelin-guide-restaurants-2021';
    const metadataUrl = `https://www.kaggle.com/api/v1/datasets/download/${datasetOwner}/${datasetName}`;
    
    console.log(`📥 Downloading dataset from: ${metadataUrl}`);
    
    const response = await fetch(metadataUrl, {
      headers: {
        'Authorization': `Bearer ${kaggleToken}`,
        'User-Agent': 'Le-Voyageur-App/1.0',
      },
    });
    
    console.log(`📊 Response status: ${response.status} ${response.statusText}`);
    console.log(`📊 Response headers:`, Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      console.error(`❌ Failed to fetch from Kaggle API: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      return restaurants;
    }
    
    // Check content type
    const contentType = response.headers.get('content-type');
    console.log('📋 Content-Type:', contentType);
    console.log('📍 Final URL:', response.url);
    
    // The response is a ZIP file - we need to decompress it
    const arrayBuffer = await response.arrayBuffer();
    console.log(`✅ Received ${arrayBuffer.byteLength} bytes of data`);
    
    // Check if it's a ZIP file (starts with "PK")
    const uint8Array = new Uint8Array(arrayBuffer);
    const isPKZip = uint8Array[0] === 0x50 && uint8Array[1] === 0x4B;
    console.log(`📦 Is ZIP file: ${isPKZip}`);
    
    if (!isPKZip) {
      console.error('❌ Response is not a ZIP file');
      return restaurants;
    }
    
    // Import JSZip for decompression (Deno-compatible)
    const JSZip = (await import('npm:jszip@3.10.1')).default;
    const zip = await JSZip.loadAsync(arrayBuffer);
    
    console.log('📦 ZIP contents:', Object.keys(zip.files));
    
    // Find the CSV file in the ZIP
    let csvContent: string | null = null;
    for (const [filename, file] of Object.entries(zip.files)) {
      if (filename.endsWith('.csv') && !file.dir) {
        console.log(`📄 Found CSV file: ${filename}`);
        csvContent = await file.async('text');
        break;
      }
    }
    
    if (!csvContent) {
      console.error('❌ No CSV file found in ZIP archive');
      return restaurants;
    }
    
    console.log(`✅ Extracted CSV with ${csvContent.length} characters`);
    console.log(`📄 First 500 characters:`, csvContent.substring(0, 500));
    
    // Parse CSV data
    const lines = csvContent.split('\n');
    console.log(`📊 Total lines in CSV: ${lines.length}`);
    
    if (lines.length < 2) {
      console.error('❌ No data found in CSV (less than 2 lines)');
      return restaurants;
    }
    
    // Get headers
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    console.log('📋 CSV Headers:', headers);
    console.log('📋 Number of columns:', headers.length);
    
    // Parse rows
    let parsedCount = 0;
    let skippedCount = 0;
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      try {
        // Simple CSV parsing (handles quoted fields)
        const values: string[] = [];
        let currentValue = '';
        let inQuotes = false;
        
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(currentValue.trim().replace(/^"|"$/g, ''));
            currentValue = '';
          } else {
            currentValue += char;
          }
        }
        values.push(currentValue.trim().replace(/^"|"$/g, ''));
        
        // Create record object
        const record: any = {};
        headers.forEach((header, index) => {
          record[header] = values[index] || '';
        });
        
        // Log first record for debugging
        if (i === 1) {
          console.log('📄 First record sample:', JSON.stringify(record, null, 2));
        }
        
        // Extract location components
        const name = record.Name || record.name || '';
        const address = record.Address || record.address || '';
        const location = record.Location || record.location || '';
        const price = record.Price || record.price || '';
        const cuisine = record.Cuisine || record.cuisine || '';
        const latitude = parseFloat(record.Latitude || record.latitude || '0');
        const longitude = parseFloat(record.Longitude || record.longitude || '0');
        const url = record.Url || record.url || record.WebsiteUrl || '';
        const award = (record.Award || record.award || '').toLowerCase();
        
        // Skip if no valid coordinates
        if (!latitude || !longitude || latitude === 0 || longitude === 0) {
          skippedCount++;
          continue;
        }
        
        // Skip if no name
        if (!name) {
          skippedCount++;
          continue;
        }
        
        // Determine star rating from award field
        let stars = 0;
        if (award.includes('3 stars') || award.includes('three stars')) {
          stars = 3;
        } else if (award.includes('2 stars') || award.includes('two stars')) {
          stars = 2;
        } else if (award.includes('1 star') || award.includes('one star')) {
          stars = 1;
        } else if (award.includes('bib gourmand')) {
          stars = 4;
        } else if (award.includes('selected') || award.includes('plate')) {
          stars = 5;
        } else {
          // Default to 1 star if no award specified but in Michelin guide
          stars = 1;
        }
        
        // Parse location for city and country
        const locationParts = location.split(',').map(p => p.trim());
        const city = locationParts[0] || '';
        const country = locationParts[locationParts.length - 1] || '';
        
        restaurants.push({
          name,
          location,
          address,
          city,
          region: locationParts[1] || '',
          country,
          latitude,
          longitude,
          stars,
          cuisines: cuisine ? [cuisine] : [],
          url,
          price,
          award,
        });
        
        parsedCount++;
      } catch (err) {
        console.error(`⚠️ Error parsing line ${i}:`, err);
        skippedCount++;
      }
    }
    
    console.log(`✅ Parsed ${parsedCount} restaurants from Kaggle dataset`);
    console.log(`⚠️ Skipped ${skippedCount} entries (missing coordinates or invalid data)`);
    
    return restaurants;
  } catch (error) {
    console.error('❌ Error fetching Michelin data from Kaggle:', error);
    if (error instanceof Error) {
      console.error('❌ Error stack:', error.stack);
    }
    return restaurants;
  }
}

/**
 * Fetch Michelin data from GitHub repositories (legacy fallback)
 */
export async function fetchMichelinDataFromGitHub(): Promise<MichelinRestaurant[]> {
  const restaurants: MichelinRestaurant[] = [];
  
  // Try multiple GitHub repositories with Michelin data
  const repositories = [
    'https://raw.githubusercontent.com/NicolaFerracin/michelin-stars-restaurants-api/master/data',
    'https://raw.githubusercontent.com/NicolaFerracin/michelin-stars-restaurants-api/main/data',
    'https://raw.githubusercontent.com/ngshiheng/michelin-my-maps/main/data',
  ];
  
  const starFiles = ['one-star.json', 'two-stars.json', 'three-stars.json'];
  
  for (const repo of repositories) {
    console.log(`🔍 Trying repository: ${repo}`);
    let repoHasData = false;
    
    for (const file of starFiles) {
      try {
        const url = `${repo}/${file}`;
        console.log(`📥 Fetching: ${url}`);
        
        const response = await fetch(url);
        
        if (response.ok) {
          const data = await response.json();
          
          if (Array.isArray(data) && data.length > 0) {
            repoHasData = true;
            
            // Determine star level from filename
            let starLevel = 1;
            if (file.includes('two')) starLevel = 2;
            if (file.includes('three')) starLevel = 3;
            
            // Parse each restaurant
            for (const item of data) {
              const name = item.name || item.Name || '';
              const location = item.location || item.Location || '';
              const latitude = parseFloat(item.latitude || item.Latitude || '0');
              const longitude = parseFloat(item.longitude || item.Longitude || '0');
              
              if (name && latitude && longitude && latitude !== 0 && longitude !== 0) {
                // Parse location for city and country
                const locationParts = location.split(',').map((p: string) => p.trim());
                const city = locationParts[0] || '';
                const country = locationParts[locationParts.length - 1] || '';
                
                restaurants.push({
                  name,
                  location,
                  address: item.address || item.Address || '',
                  city,
                  region: locationParts[1] || '',
                  country,
                  latitude,
                  longitude,
                  stars: starLevel,
                  cuisines: item.cuisine ? [item.cuisine] : [],
                  url: item.url || item.Url || '',
                  price: item.price || item.Price || '',
                  award: `${starLevel} star${starLevel > 1 ? 's' : ''}`,
                });
              }
            }
            
            console.log(`✅ Fetched ${data.length} ${file} restaurants from ${repo}`);
          }
        } else {
          console.log(`⚠️ Failed to fetch ${file} from ${repo}: ${response.status} ${response.statusText}`);
        }
      } catch (error) {
        console.error(`⚠️ Error fetching ${file} from ${repo}:`, error);
      }
    }
    
    // If we successfully got data from this repo, no need to try others
    if (repoHasData) {
      console.log(`✅ Successfully fetched data from ${repo}`);
      break;
    }
  }
  
  console.log(`✅ Total fetched: ${restaurants.length} Michelin restaurants`);
  return restaurants;
}

/**
 * Main sync function - fetches and stores Michelin data
 */
export async function syncMichelinData(): Promise<{ success: boolean; count: number; message: string; added?: number; updated?: number; errors?: number }> {
  try {
    console.log('🔍 Starting Michelin data sync...');
    
    let restaurants: MichelinRestaurant[] = [];
    let dataSource = 'Unknown';
    
    // Try to fetch from Kaggle API first
    restaurants = await fetchMichelinDataFromKaggle();
    if (restaurants.length > 0) {
      dataSource = 'Kaggle';
      console.log('✅ Successfully fetched from Kaggle dataset');
    }
    
    // If Kaggle fetch fails, use GitHub API as fallback
    if (restaurants.length === 0) {
      console.log('⚠️ Kaggle dataset unavailable, trying GitHub API...');
      restaurants = await fetchMichelinDataFromGitHub();
      if (restaurants.length > 0) {
        dataSource = 'GitHub';
        console.log('✅ Successfully fetched from GitHub');
      }
    }
    
    // If both fail, use sample data
    if (restaurants.length === 0) {
      console.log('⚠️ GitHub repositories unavailable, using sample Michelin data...');
      restaurants = getSampleMichelinData();
      dataSource = 'Sample Data';
    }
    
    console.log(`📊 Processing ${restaurants.length} Michelin restaurants from ${dataSource}...`);
    
    // Store in database
    console.log('📊 Storing restaurants in database...');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials');
    }
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    let added = 0;
    let updated = 0;
    let errors = 0;
    
    for (const restaurant of restaurants) {
      try {
        // Generate a unique key for this restaurant
        const key = `location:michelin:${restaurant.name.toLowerCase().replace(/\s+/g, '-')}:${restaurant.city.toLowerCase().replace(/\s+/g, '-')}`;
        
        // Check if location already exists
        const existingLocations = await kv.getByPrefix('location:');
        const existing = existingLocations.find((loc: any) => {
          const distance = Math.sqrt(
            Math.pow(loc.value.latitude - restaurant.latitude, 2) +
            Math.pow(loc.value.longitude - restaurant.longitude, 2)
          );
          return distance < 0.001 && loc.value.name.toLowerCase() === restaurant.name.toLowerCase();
        });
        
        const locationData = {
          id: existing?.value.id || crypto.randomUUID(),
          name: restaurant.name,
          latitude: restaurant.latitude,
          longitude: restaurant.longitude,
          place_id: existing?.value.place_id || `michelin_${restaurant.name.toLowerCase().replace(/\s+/g, '_')}`,
          formatted_address: restaurant.address || restaurant.location,
          types: ['restaurant'],
          tags: ['michelin', ...(restaurant.cuisines || []).map(c => c.toLowerCase())],
          lv_editor_score: existing?.value.lv_editor_score || null,
          lv_crowdsource_score: existing?.value.lv_crowdsource_score || null,
          google_rating: existing?.value.google_rating || null,
          michelin_score: convertMichelinStarsToScore(restaurant.stars),
          created_at: existing?.value.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        
        await kv.set(existing ? existing.key : key, locationData);
        
        if (existing) {
          updated++;
        } else {
          added++;
        }
      } catch (error) {
        console.error(`❌ Error storing restaurant ${restaurant.name}:`, error);
        errors++;
      }
    }
    
    console.log(`✅ Sync complete: ${added + updated} locations processed out of ${restaurants.length} fetched`);
    console.log(`✅ Michelin sync completed: Successfully processed ${added + updated} Michelin restaurants from ${dataSource}`);
    
    return {
      success: true,
      count: added + updated,
      added,
      updated,
      errors,
      message: `Successfully processed ${added + updated} Michelin restaurants from ${dataSource}`,
    };
  } catch (error) {
    console.error('❌ Error syncing Michelin data:', error);
    return {
      success: false,
      count: 0,
      message: `Error: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Convert Michelin stars to LV score (0-11 scale)
 */
function convertMichelinStarsToScore(stars: number): number {
  // Michelin ratings mapping to LV 0-11 scale:
  // 3 stars = 11.0 (exceptional)
  // 2 stars = 10.0 (excellent)
  // 1 star = 9.0 (very good)
  // Bib Gourmand (4) = 8.0 (good value)
  // Plate/Selected (5) = 7.0 (quality cooking)
  
  switch (stars) {
    case 3: return 11.0;
    case 2: return 10.0;
    case 1: return 9.0;
    case 4: return 8.0; // Bib Gourmand
    case 5: return 7.0; // Plate
    default: return 0;
  }
}

/**
 * Get Michelin rating for a specific location
 */
export async function getMichelinRating(lat: number, lng: number, name?: string): Promise<number | null> {
  try {
    // Get all locations from database
    const locations = await kv.getByPrefix('location:');
    
    // Find location near these coordinates
    const nearbyLocations = locations.filter((loc: any) => {
      const distance = Math.sqrt(
        Math.pow(loc.value.latitude - lat, 2) +
        Math.pow(loc.value.longitude - lng, 2)
      );
      // Within ~100 meters
      return distance < 0.001;
    });
    
    // If name is provided, try to match by name
    if (name && nearbyLocations.length > 0) {
      const matchedLocation = nearbyLocations.find((loc: any) => 
        loc.value.name.toLowerCase() === name.toLowerCase()
      );
      
      if (matchedLocation && matchedLocation.value.michelin_score) {
        return matchedLocation.value.michelin_score;
      }
    }
    
    // Otherwise, return the first nearby location with a Michelin score
    const michelinLocation = nearbyLocations.find((loc: any) => loc.value.michelin_score);
    return michelinLocation ? michelinLocation.value.michelin_score : null;
  } catch (error) {
    console.error('❌ Error getting Michelin rating:', error);
    return null;
  }
}
