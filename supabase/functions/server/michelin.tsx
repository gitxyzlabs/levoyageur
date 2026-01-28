/**
 * Fetch Michelin data from Kaggle dataset
 */
async function fetchMichelinDataFromKaggle(offset: number = 0, limit: number = 500): Promise<{ restaurants: MichelinRestaurant[]; totalAvailable: number }> {
  const apiToken = Deno.env.get('KAGGLE_API_TOKEN');
  
  if (!apiToken) {
    throw new Error('KAGGLE_API_TOKEN environment variable not set');
  }

  console.log(`📡 Fetching Michelin data from Kaggle...`);

  // Kaggle dataset URL for Michelin restaurants
  const datasetOwner = 'ngshiheng';
  const datasetName = 'michelin-guide-restaurants-2021';
  const fileName = 'one-star-michelin-restaurants.csv';
  
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
    
    // Fetch the CSV file from Kaggle
    const response = await fetch(
      `https://www.kaggle.com/api/v1/datasets/download/${datasetOwner}/${datasetName}/${fileName}`,
      { headers: requestHeaders }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Kaggle API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    // Parse CSV data
    const csvText = await response.text();
    const lines = csvText.split('\n');
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
      
      // Map to our interface
      if (restaurant.Name && restaurant.Location) {
        restaurants.push({
          name: restaurant.Name || '',
          city: restaurant.Location || '',
          country: restaurant.Country || '',
          latitude: parseFloat(restaurant.Latitude) || 0,
          longitude: parseFloat(restaurant.Longitude) || 0,
          price: restaurant.Price || '',
          cuisine: restaurant.Cuisine || '',
          award: restaurant.Award || '1 MICHELIN Star',
        });
      }
    }
    
    const totalAvailable = restaurants.length;
    
    // Apply offset and limit
    const paginatedRestaurants = restaurants.slice(offset, offset + limit);
    
    console.log(`✅ Fetched ${paginatedRestaurants.length} restaurants (total: ${totalAvailable})`);
    
    return {
      restaurants: paginatedRestaurants,
      totalAvailable,
    };
  } catch (error) {
    console.error('❌ Error fetching from Kaggle:', error);
    throw error;
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
    
    // Fetch data from Kaggle
    const { restaurants, totalAvailable } = await fetchMichelinDataFromKaggle(offset, limit);
    
    if (restaurants.length === 0) {
      return {
        success: false,
        message: 'No restaurants fetched from Kaggle',
        totalAvailable
      };
    }
    
    console.log(`📊 Fetched ${restaurants.length} restaurants from Kaggle (total available: ${totalAvailable})`);
    
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