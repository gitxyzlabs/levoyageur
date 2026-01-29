/**
 * Michelin Guide Integration
 * Handles syncing and querying Michelin restaurant data
 */

interface MichelinRestaurant {
  name: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  price: string;
  cuisine: string;
  award: string; // "1 MICHELIN Star", "2 MICHELIN Stars", "3 MICHELIN Stars", "Bib Gourmand"
}

/**
 * Fallback mock Michelin data for prototyping when Kaggle is unavailable
 */
async function fetchMockMichelinData(offset: number = 0, limit: number = 500): Promise<{ restaurants: MichelinRestaurant[]; totalAvailable: number }> {
  console.log('📦 Using mock Michelin data for prototyping...');
  
  // Sample Michelin-starred restaurants from major cities
  const mockRestaurants: MichelinRestaurant[] = [
    // Paris
    { name: "Le Cinq", city: "Paris", country: "France", latitude: 48.8698, longitude: 2.3048, price: "$$$$", cuisine: "French", award: "3 MICHELIN Stars" },
    { name: "Arpège", city: "Paris", country: "France", latitude: 48.8566, longitude: 2.3172, price: "$$$$", cuisine: "French", award: "3 MICHELIN Stars" },
    { name: "Guy Savoy", city: "Paris", country: "France", latitude: 48.8584, longitude: 2.3352, price: "$$$$", cuisine: "French", award: "3 MICHELIN Stars" },
    { name: "L'Astrance", city: "Paris", country: "France", latitude: 48.8606, longitude: 2.2946, price: "$$$", cuisine: "French", award: "2 MICHELIN Stars" },
    { name: "Le Pré Catelan", city: "Paris", country: "France", latitude: 48.8629, longitude: 2.2510, price: "$$$$", cuisine: "French", award: "2 MICHELIN Stars" },
    
    // New York
    { name: "Eleven Madison Park", city: "New York", country: "USA", latitude: 40.7417, longitude: -73.9871, price: "$$$$", cuisine: "Contemporary", award: "3 MICHELIN Stars" },
    { name: "Le Bernardin", city: "New York", country: "USA", latitude: 40.7614, longitude: -73.9776, price: "$$$$", cuisine: "Seafood", award: "3 MICHELIN Stars" },
    { name: "Per Se", city: "New York", country: "USA", latitude: 40.7684, longitude: -73.9826, price: "$$$$", cuisine: "French", award: "3 MICHELIN Stars" },
    { name: "Atera", city: "New York", country: "USA", latitude: 40.7217, longitude: -74.0087, price: "$$$", cuisine: "Contemporary", award: "2 MICHELIN Stars" },
    { name: "Aquavit", city: "New York", country: "USA", latitude: 40.7580, longitude: -73.9719, price: "$$$", cuisine: "Scandinavian", award: "2 MICHELIN Stars" },
    
    // Tokyo
    { name: "Sukiyabashi Jiro", city: "Tokyo", country: "Japan", latitude: 35.6711, longitude: 139.7630, price: "$$$$", cuisine: "Sushi", award: "3 MICHELIN Stars" },
    { name: "Kanda", city: "Tokyo", country: "Japan", latitude: 35.6897, longitude: 139.7700, price: "$$$$", cuisine: "Japanese", award: "3 MICHELIN Stars" },
    { name: "Quintessence", city: "Tokyo", country: "Japan", latitude: 35.6476, longitude: 139.7129, price: "$$$$", cuisine: "French", award: "3 MICHELIN Stars" },
    { name: "Sushi Saito", city: "Tokyo", country: "Japan", latitude: 35.6654, longitude: 139.7298, price: "$$$$", cuisine: "Sushi", award: "3 MICHELIN Stars" },
    { name: "Narisawa", city: "Tokyo", country: "Japan", latitude: 35.6716, longitude: 139.7273, price: "$$$$", cuisine: "Contemporary", award: "2 MICHELIN Stars" },
    
    // London
    { name: "Restaurant Gordon Ramsay", city: "London", country: "UK", latitude: 51.4864, longitude: -0.1615, price: "$$$$", cuisine: "French", award: "3 MICHELIN Stars" },
    { name: "The Araki", city: "London", country: "UK", latitude: 51.5106, longitude: -0.1427, price: "$$$$", cuisine: "Sushi", award: "3 MICHELIN Stars" },
    { name: "Alain Ducasse", city: "London", country: "UK", latitude: 51.5074, longitude: -0.1489, price: "$$$$", cuisine: "French", award: "3 MICHELIN Stars" },
    { name: "The Ledbury", city: "London", country: "UK", latitude: 51.5156, longitude: -0.2053, price: "$$$", cuisine: "Contemporary", award: "2 MICHELIN Stars" },
    { name: "Sketch", city: "London", country: "UK", latitude: 51.5138, longitude: -0.1422, price: "$$$", cuisine: "French", award: "2 MICHELIN Stars" },
    
    // Hong Kong
    { name: "8 1/2 Otto e Mezzo Bombana", city: "Hong Kong", country: "Hong Kong", latitude: 22.2783, longitude: 114.1747, price: "$$$$", cuisine: "Italian", award: "3 MICHELIN Stars" },
    { name: "L'Atelier de Joël Robuchon", city: "Hong Kong", country: "Hong Kong", latitude: 22.2774, longitude: 114.1722, price: "$$$$", cuisine: "French", award: "3 MICHELIN Stars" },
    { name: "Lung King Heen", city: "Hong Kong", country: "Hong Kong", latitude: 22.2842, longitude: 114.1580, price: "$$$$", cuisine: "Cantonese", award: "3 MICHELIN Stars" },
    { name: "Bo Innovation", city: "Hong Kong", country: "Hong Kong", latitude: 22.2766, longitude: 114.1735, price: "$$$", cuisine: "Chinese", award: "2 MICHELIN Stars" },
    { name: "Amber", city: "Hong Kong", country: "Hong Kong", latitude: 22.2793, longitude: 114.1628, price: "$$$$", cuisine: "French", award: "2 MICHELIN Stars" },
    
    // San Francisco
    { name: "Benu", city: "San Francisco", country: "USA", latitude: 37.7855, longitude: -122.3990, price: "$$$$", cuisine: "Contemporary", award: "3 MICHELIN Stars" },
    { name: "Quince", city: "San Francisco", country: "USA", latitude: 37.7986, longitude: -122.4052, price: "$$$$", cuisine: "Italian", award: "3 MICHELIN Stars" },
    { name: "Atelier Crenn", city: "San Francisco", country: "USA", latitude: 37.8003, longitude: -122.4362, price: "$$$$", cuisine: "French", award: "3 MICHELIN Stars" },
    { name: "Lazy Bear", city: "San Francisco", country: "USA", latitude: 37.7599, longitude: -122.4148, price: "$$$", cuisine: "Contemporary", award: "2 MICHELIN Stars" },
    { name: "Saison", city: "San Francisco", country: "USA", latitude: 37.7799, longitude: -122.3952, price: "$$$$", cuisine: "Contemporary", award: "2 MICHELIN Stars" },
  ];
  
  const totalAvailable = mockRestaurants.length;
  const paginatedRestaurants = mockRestaurants.slice(offset, Math.min(offset + limit, totalAvailable));
  
  console.log(`✅ Returning ${paginatedRestaurants.length} mock Michelin restaurants (total: ${totalAvailable})`);
  
  return {
    restaurants: paginatedRestaurants,
    totalAvailable,
  };
}

/**
 * Fetch Michelin data from Kaggle dataset
 */
async function fetchMichelinDataFromKaggle(offset: number = 0, limit: number = 500): Promise<{ restaurants: MichelinRestaurant[]; totalAvailable: number }> {
  const apiToken = Deno.env.get('KAGGLE_API_TOKEN');
  
  if (!apiToken) {
    console.log('⚠️ KAGGLE_API_TOKEN not set, using mock data...');
    return await fetchMockMichelinData(offset, limit);
  }

  console.log(`📡 Fetching Michelin data from Kaggle...`);

  // Try multiple known Michelin datasets
  const datasets = [
    { owner: 'jackywang529', name: 'michelin-restaurants' },
    { owner: 'ngshiheng', name: 'michelin-guide-restaurants-2021' },
  ];
  
  try {
    // Check if it's the new token format (starts with KGAT_)
    const isNewTokenFormat = apiToken.startsWith('KGAT_');
    
    let requestHeaders: Record<string, string>;
    
    if (isNewTokenFormat) {
      // New format: Bearer token
      console.log('Using new Kaggle API token format (KGAT_)');
      requestHeaders = {
        'Authorization': `Bearer ${apiToken}`,
      };
    } else {
      // Old format: username:key with Basic auth
      let username: string;
      let key: string;
      
      try {
        // Try parsing as JSON first (format: {"username":"...", "key":"..."})
        const parsed = JSON.parse(apiToken);
        username = parsed.username;
        key = parsed.key;
      } catch (e) {
        // If not JSON, try colon-separated format (format: username:key)
        if (apiToken.includes(':')) {
          const parts = apiToken.split(':');
          if (parts.length === 2) {
            username = parts[0];
            key = parts[1];
          } else {
            throw new Error('Invalid KAGGLE_API_TOKEN format');
          }
        } else {
          throw new Error('Invalid KAGGLE_API_TOKEN format');
        }
      }

      if (!username || !key) {
        throw new Error('KAGGLE_API_TOKEN missing username or key');
      }

      console.log(`Using old Kaggle API token format (user: ${username})`);
      const auth = btoa(`${username}:${key}`);
      requestHeaders = {
        'Authorization': `Basic ${auth}`,
      };
    }
    
    // Try each dataset until one works
    for (const dataset of datasets) {
      try {
        console.log(`📥 Trying dataset: ${dataset.owner}/${dataset.name}...`);
        
        const response = await fetch(
          `https://www.kaggle.com/api/v1/datasets/download/${dataset.owner}/${dataset.name}`,
          { headers: requestHeaders }
        );

        if (!response.ok) {
          console.log(`⚠️ Dataset ${dataset.owner}/${dataset.name} not available: ${response.status}`);
          continue;
        }

        // Successfully got data, parse it
        const csvText = await response.text();
        const lines = csvText.split('\n');
        
        if (lines.length < 2) {
          console.log(`⚠️ Dataset ${dataset.owner}/${dataset.name} has no data`);
          continue;
        }
        
        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const restaurants: MichelinRestaurant[] = [];
        
        // Parse each line (skip header)
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          
          const values = parseCSVLine(lines[i]);
          
          if (values.length < headers.length) continue;
          
          const restaurant: any = {};
          headers.forEach((header, index) => {
            restaurant[header] = values[index];
          });
          
          // Map to our interface (try different column name variations)
          const name = restaurant.Name || restaurant.name || restaurant.restaurant || '';
          const city = restaurant.Location || restaurant.City || restaurant.city || restaurant.location || '';
          
          if (name && city) {
            restaurants.push({
              name: name,
              city: city,
              country: restaurant.Country || restaurant.country || restaurant.Region || '',
              latitude: parseFloat(restaurant.Latitude || restaurant.latitude || restaurant.lat || '0') || 0,
              longitude: parseFloat(restaurant.Longitude || restaurant.longitude || restaurant.lng || restaurant.lon || '0') || 0,
              price: restaurant.Price || restaurant.price || restaurant.pricing || '',
              cuisine: restaurant.Cuisine || restaurant.cuisine || restaurant.type || '',
              award: restaurant.Award || restaurant.award || restaurant.distinction || '1 MICHELIN Star',
            });
          }
        }
        
        if (restaurants.length === 0) {
          console.log(`⚠️ No valid restaurants parsed from ${dataset.owner}/${dataset.name}`);
          continue;
        }
        
        const totalAvailable = restaurants.length;
        const paginatedRestaurants = restaurants.slice(offset, offset + limit);
        
        console.log(`✅ Fetched ${paginatedRestaurants.length} restaurants from Kaggle (total: ${totalAvailable})`);
        
        return {
          restaurants: paginatedRestaurants,
          totalAvailable,
        };
      } catch (error) {
        console.error(`❌ Error with dataset ${dataset.owner}/${dataset.name}:`, error);
        // Continue to next dataset
      }
    }
    
    // If we get here, all datasets failed - use mock data
    console.log('⚠️ All Kaggle datasets failed, falling back to mock data...');
    return await fetchMockMichelinData(offset, limit);
    
  } catch (error) {
    console.error('❌ Error fetching from Kaggle, using mock data:', error);
    return await fetchMockMichelinData(offset, limit);
  }
}

/**
 * Parse a CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  values.push(current.trim());
  return values;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Get Michelin rating for a location
 */
export async function getMichelinRating(lat: number, lng: number, name?: string): Promise<number | null> {
  try {
    console.log(`🔍 Searching for Michelin rating near (${lat}, ${lng})${name ? ` for "${name}"` : ''}`);
    
    // Import KV store utilities
    const kv = await import('./kv_store.tsx');
    
    // Get all Michelin restaurants
    const restaurants = await kv.getByPrefix('michelin:restaurant:');
    
    if (!restaurants || restaurants.length === 0) {
      console.log('📊 No Michelin restaurants in database');
      return null;
    }
    
    console.log(`📊 Searching ${restaurants.length} Michelin restaurants`);
    
    // Find closest matching restaurant
    let closestMatch: MichelinRestaurant | null = null;
    let closestDistance = Infinity;
    const MAX_DISTANCE_KM = 0.5; // Maximum distance to consider a match (500 meters)
    
    for (const restaurant of restaurants) {
      if (!restaurant || !restaurant.latitude || !restaurant.longitude) continue;
      
      const distance = calculateDistance(
        lat,
        lng,
        restaurant.latitude,
        restaurant.longitude
      );
      
      // If name is provided, prefer exact name matches within reasonable distance
      if (name && restaurant.name) {
        const nameMatch = restaurant.name.toLowerCase().includes(name.toLowerCase()) ||
                         name.toLowerCase().includes(restaurant.name.toLowerCase());
        
        if (nameMatch && distance < MAX_DISTANCE_KM * 5) { // Allow larger distance for name matches
          if (distance < closestDistance) {
            closestDistance = distance;
            closestMatch = restaurant as MichelinRestaurant;
          }
        }
      }
      
      // Also check proximity-based matching
      if (distance < MAX_DISTANCE_KM && distance < closestDistance) {
        closestDistance = distance;
        closestMatch = restaurant as MichelinRestaurant;
      }
    }
    
    if (!closestMatch) {
      console.log('❌ No Michelin restaurant found within range');
      return null;
    }
    
    console.log(`✅ Found Michelin restaurant: ${closestMatch.name} (${closestDistance.toFixed(3)} km away)`);
    
    // Convert Michelin award to score
    const award = closestMatch.award;
    if (award.includes('3')) return 3;
    if (award.includes('2')) return 2;
    if (award.includes('1')) return 1;
    if (award.toLowerCase().includes('bib gourmand')) return 0.5;
    
    return null;
  } catch (error) {
    console.error('❌ Error getting Michelin rating:', error);
    return null;
  }
}

/**
 * Sync Michelin data from Kaggle to KV store
 */
export async function syncMichelinData(offset: number = 0, limit: number = 500): Promise<{ success: boolean; message: string; count?: number; totalAvailable?: number; imported?: number }> {
  try {
    console.log(`🔄 Starting Michelin data sync from Kaggle (offset: ${offset}, limit: ${limit})...`);
    
    // Fetch data from Kaggle (or mock data if Kaggle unavailable)
    const { restaurants, totalAvailable } = await fetchMichelinDataFromKaggle(offset, limit);
    
    if (restaurants.length === 0) {
      return {
        success: false,
        message: 'No restaurants fetched',
        totalAvailable
      };
    }
    
    console.log(`📊 Fetched ${restaurants.length} restaurants (total available: ${totalAvailable})`);
    
    // Import KV store utilities
    const kv = await import('./kv_store.tsx');
    
    // Get existing Michelin restaurants to avoid duplicates
    console.log('🔍 Checking for existing Michelin data...');
    const existingData = await kv.getByPrefix('michelin:restaurant:');
    const existingRestaurants = new Map<string, MichelinRestaurant>();
    
    // getByPrefix returns an array of values directly
    if (existingData && Array.isArray(existingData)) {
      for (const restaurant of existingData) {
        if (restaurant && restaurant.name && restaurant.city) {
          // Use name + city as unique key
          const key = `${restaurant.name.toLowerCase()}:${restaurant.city.toLowerCase()}`;
          existingRestaurants.set(key, restaurant as MichelinRestaurant);
        }
      }
    }
    
    console.log(`📊 Found ${existingRestaurants.size} existing Michelin restaurants`);
    
    // Store restaurants in batches to avoid timeout
    let storedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    const batchSize = 50;
    
    for (let i = 0; i < restaurants.length; i += batchSize) {
      const batch = restaurants.slice(i, Math.min(i + batchSize, restaurants.length));
      
      console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(restaurants.length / batchSize)} (${batch.length} restaurants)`);
      
      for (const restaurant of batch) {
        try {
          // Check if restaurant already exists
          const uniqueKey = `${restaurant.name.toLowerCase()}:${restaurant.city.toLowerCase()}`;
          
          if (existingRestaurants.has(uniqueKey)) {
            skippedCount++;
            continue;
          }
          
          // Generate unique ID for this restaurant
          const restaurantId = `${restaurant.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-${restaurant.city.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`;
          const key = `michelin:restaurant:${restaurantId}`;
          
          // Store in KV
          await kv.set(key, restaurant);
          storedCount++;
          
        } catch (error) {
          console.error(`❌ Error storing restaurant ${restaurant.name}:`, error);
          errorCount++;
        }
      }
      
      // Small delay between batches to avoid overwhelming the system
      if (i + batchSize < restaurants.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`✅ Sync complete: ${storedCount} stored, ${skippedCount} skipped (duplicates), ${errorCount} errors`);
    
    return {
      success: true,
      message: `Successfully synced ${storedCount} new Michelin restaurants (${skippedCount} duplicates skipped, ${errorCount} errors)`,
      count: storedCount,
      totalAvailable,
      imported: restaurants.length
    };
  } catch (error) {
    console.error('❌ Error syncing Michelin data:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}
