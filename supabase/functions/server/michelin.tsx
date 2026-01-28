/**
 * Michelin Restaurant interface
 */
export interface MichelinRestaurant {
  name: string;
  location: string;
  address: string;
  city: string;
  region: string;
  country: string;
  latitude: number;
  longitude: number;
  stars: number; // 1-3 for Michelin stars, 4 for Bib Gourmand, 5 for Michelin Plate/Selected
  cuisines: string[];
  url: string;
  price: string;
  award: string;
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
    
    if (!response.ok) {
      console.error(`❌ Failed to fetch from Kaggle API: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      return restaurants;
    }
    
    console.log('📍 Starting to download arrayBuffer...');
    
    // The response is a ZIP file - we need to decompress it
    const arrayBuffer = await response.arrayBuffer();
    console.log(`✅ Downloaded ${arrayBuffer.byteLength} bytes`);
    
    // Check if it's a ZIP file (starts with "PK")
    const uint8Array = new Uint8Array(arrayBuffer);
    const isPKZip = uint8Array[0] === 0x50 && uint8Array[1] === 0x4B;
    console.log(`📦 Is ZIP file: ${isPKZip}`);
    
    if (!isPKZip) {
      console.error('❌ Response is not a ZIP file');
      return restaurants;
    }
    
    console.log('📦 Importing JSZip...');
    // Import JSZip for decompression (Deno-compatible)
    const JSZip = (await import('npm:jszip@3.10.1')).default;
    console.log('✅ JSZip imported');
    
    console.log('📦 Loading ZIP archive...');
    const zip = await JSZip.loadAsync(arrayBuffer);
    console.log('✅ ZIP loaded successfully');
    
    console.log('📦 ZIP contents:', Object.keys(zip.files));
    
    // Find the CSV file in the ZIP
    let csvContent: string | null = null;
    for (const [filename, file] of Object.entries(zip.files)) {
      if (filename.endsWith('.csv') && !file.dir) {
        console.log(`📄 Found CSV file: ${filename}`);
        csvContent = await file.async('text');
        console.log(`✅ Extracted CSV with ${csvContent.length} characters`);
        break;
      }
    }
    
    if (!csvContent) {
      console.error('❌ No CSV file found in ZIP archive');
      return restaurants;
    }
    
    console.log(`📄 First 200 characters of CSV:`, csvContent.substring(0, 200));
    
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
    
    // Parse rows (limit to first 500 to avoid timeout)
    let parsedCount = 0;
    let skippedCount = 0;
    const maxRows = Math.min(lines.length, 501); // 500 data rows + 1 header
    
    console.log(`📊 Processing ${maxRows - 1} rows (limited to avoid timeout)`);
    
    for (let i = 1; i < maxRows; i++) {
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
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
    }
    return restaurants;
  }
}

/**
 * Get Michelin rating for a location
 */
export async function getMichelinRating(latitude: number, longitude: number): Promise<MichelinRestaurant | null> {
  try {
    // Import KV store utilities
    const kv = await import('./kv_store.tsx');
    
    // Search for nearby Michelin restaurants (within ~100m)
    const allMichelinData = await kv.getByPrefix('michelin:restaurant:');
    
    if (!allMichelinData || allMichelinData.length === 0) {
      return null;
    }
    
    // Find the closest restaurant within 100 meters
    const threshold = 0.001; // Approximately 100 meters in degrees
    let closestRestaurant: MichelinRestaurant | null = null;
    let minDistance = Infinity;
    
    // getByPrefix returns an array of values directly, not objects
    for (const restaurant of allMichelinData) {
      if (!restaurant || typeof restaurant.latitude !== 'number' || typeof restaurant.longitude !== 'number') {
        continue;
      }
      
      // Calculate distance (simple Euclidean distance for small areas)
      const distance = Math.sqrt(
        Math.pow(restaurant.latitude - latitude, 2) +
        Math.pow(restaurant.longitude - longitude, 2)
      );
      
      if (distance < threshold && distance < minDistance) {
        minDistance = distance;
        closestRestaurant = restaurant as MichelinRestaurant;
      }
    }
    
    return closestRestaurant;
  } catch (error) {
    console.error('❌ Error getting Michelin rating:', error);
    return null;
  }
}

/**
 * Sync Michelin data from Kaggle to KV store
 */
export async function syncMichelinData(): Promise<{ success: boolean; message: string; count?: number }> {
  try {
    console.log('🔄 Starting Michelin data sync from Kaggle...');
    
    // Fetch data from Kaggle
    const restaurants = await fetchMichelinDataFromKaggle();
    
    if (restaurants.length === 0) {
      return {
        success: false,
        message: 'No restaurants fetched from Kaggle'
      };
    }
    
    console.log(`📊 Fetched ${restaurants.length} restaurants from Kaggle`);
    
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
      count: storedCount
    };
  } catch (error) {
    console.error('❌ Error syncing Michelin data:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    };
  }
}
