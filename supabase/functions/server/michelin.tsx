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
 * - 0: No Michelin rating (Bib Gourmand or Plate)
 * - 1: One star - High quality cooking, worth a stop
 * - 2: Two stars - Excellent cooking, worth a detour
 * - 3: Three stars - Exceptional cuisine, worth a special journey
 * - 4: Bib Gourmand - Good quality, good value cooking
 * - 5: Michelin Plate - Good cooking
 */

import { createClient } from "npm:@supabase/supabase-js@2";

interface MichelinRestaurant {
  name: string;
  location: string;
  address?: string;
  city?: string;
  region?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  stars: number; // 1, 2, or 3
  cuisines?: string[];
  url?: string;
  price?: string;
  award?: string;
}

/**
 * Sample Michelin data for testing when other sources are unavailable
 */
function getSampleMichelinData(): MichelinRestaurant[] {
  return [
    // New York
    { name: "Eleven Madison Park", location: "New York, NY", latitude: 40.7413, longitude: -73.9871, stars: 3, city: "New York", country: "USA", cuisines: ["Contemporary"] },
    { name: "Le Bernardin", location: "New York, NY", latitude: 40.7614, longitude: -73.9776, stars: 3, city: "New York", country: "USA", cuisines: ["Seafood"] },
    { name: "Per Se", location: "New York, NY", latitude: 40.7686, longitude: -73.9830, stars: 3, city: "New York", country: "USA", cuisines: ["French"] },
    { name: "Masa", location: "New York, NY", latitude: 40.7686, longitude: -73.9830, stars: 3, city: "New York", country: "USA", cuisines: ["Japanese"] },
    { name: "Chef's Table at Brooklyn Fare", location: "New York, NY", latitude: 40.6880, longitude: -73.9881, stars: 2, city: "New York", country: "USA", cuisines: ["Contemporary"] },
    
    // San Francisco
    { name: "The French Laundry", location: "Yountville, CA", latitude: 38.4036, longitude: -122.3630, stars: 3, city: "Yountville", country: "USA", cuisines: ["French"] },
    { name: "Benu", location: "San Francisco, CA", latitude: 37.7830, longitude: -122.3932, stars: 3, city: "San Francisco", country: "USA", cuisines: ["Asian"] },
    { name: "Quince", location: "San Francisco, CA", latitude: 37.7978, longitude: -122.4045, stars: 3, city: "San Francisco", country: "USA", cuisines: ["Italian"] },
    { name: "Atelier Crenn", location: "San Francisco, CA", latitude: 37.7909, longitude: -122.4358, stars: 3, city: "San Francisco", country: "USA", cuisines: ["French"] },
    { name: "SingleThread", location: "Healdsburg, CA", latitude: 38.6102, longitude: -122.8697, stars: 3, city: "Healdsburg", country: "USA", cuisines: ["Contemporary"] },
    
    // Los Angeles
    { name: "Providence", location: "Los Angeles, CA", latitude: 34.0522, longitude: -118.2437, stars: 2, city: "Los Angeles", country: "USA", cuisines: ["Seafood"] },
    { name: "n/naka", location: "Los Angeles, CA", latitude: 34.0522, longitude: -118.2437, stars: 2, city: "Los Angeles", country: "USA", cuisines: ["Japanese"] },
    { name: "Hayato", location: "Los Angeles, CA", latitude: 34.0430, longitude: -118.2537, stars: 2, city: "Los Angeles", country: "USA", cuisines: ["Japanese"] },
    
    // Chicago
    { name: "Alinea", location: "Chicago, IL", latitude: 41.9217, longitude: -87.6561, stars: 3, city: "Chicago", country: "USA", cuisines: ["Contemporary"] },
    { name: "Smyth", location: "Chicago, IL", latitude: 41.8781, longitude: -87.6298, stars: 2, city: "Chicago", country: "USA", cuisines: ["Contemporary"] },
    
    // Paris
    { name: "Guy Savoy", location: "Paris", latitude: 48.8606, longitude: 2.3376, stars: 3, city: "Paris", country: "France", cuisines: ["French"] },
    { name: "L'Arpège", location: "Paris", latitude: 48.8566, longitude: 2.3137, stars: 3, city: "Paris", country: "France", cuisines: ["French"] },
    { name: "Alain Ducasse au Plaza Athénée", location: "Paris", latitude: 48.8662, longitude: 2.3049, stars: 3, city: "Paris", country: "France", cuisines: ["French"] },
    { name: "Arpège", location: "Paris", latitude: 48.8556, longitude: 2.3137, stars: 3, city: "Paris", country: "France", cuisines: ["French"] },
    
    // Tokyo
    { name: "Kanda", location: "Tokyo", latitude: 35.6762, longitude: 139.7654, stars: 3, city: "Tokyo", country: "Japan", cuisines: ["Japanese"] },
    { name: "Quintessence", location: "Tokyo", latitude: 35.6466, longitude: 139.7294, stars: 3, city: "Tokyo", country: "Japan", cuisines: ["French"] },
    { name: "Ryugin", location: "Tokyo", latitude: 35.6655, longitude: 139.7303, stars: 3, city: "Tokyo", country: "Japan", cuisines: ["Japanese"] },
    { name: "Sushi Saito", location: "Tokyo", latitude: 35.6638, longitude: 139.7284, stars: 3, city: "Tokyo", country: "Japan", cuisines: ["Sushi"] },
    
    // London
    { name: "Restaurant Gordon Ramsay", location: "London", latitude: 51.4875, longitude: -0.1619, stars: 3, city: "London", country: "UK", cuisines: ["French"] },
    { name: "Alain Ducasse at The Dorchester", location: "London", latitude: 51.5074, longitude: -0.1522, stars: 3, city: "London", country: "UK", cuisines: ["French"] },
    { name: "The Ledbury", location: "London", latitude: 51.5155, longitude: -0.2058, stars: 2, city: "London", country: "UK", cuisines: ["Contemporary"] },
    
    // Barcelona
    { name: "Lasarte", location: "Barcelona", latitude: 41.3851, longitude: 2.1734, stars: 3, city: "Barcelona", country: "Spain", cuisines: ["Mediterranean"] },
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
    
    // Kaggle API endpoint for dataset files
    const datasetOwner = 'ngshiheng';
    const datasetName = 'michelin-guide-restaurants-2021';
    const metadataUrl = `https://www.kaggle.com/api/v1/datasets/download/${datasetOwner}/${datasetName}`;
    
    console.log(`📥 Downloading dataset from: ${metadataUrl}`);
    
    const response = await fetch(metadataUrl, {
      headers: {
        'Authorization': `Bearer ${kaggleToken}`,
      },
    });
    
    if (!response.ok) {
      console.error(`❌ Failed to fetch from Kaggle API: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error('Error details:', errorText);
      return restaurants;
    }
    
    // The response should be a CSV file
    const csvText = await response.text();
    console.log(`✅ Received ${csvText.length} bytes of data`);
    
    // Parse CSV data
    const lines = csvText.split('\n');
    if (lines.length < 2) {
      console.error('❌ No data found in CSV');
      return restaurants;
    }
    
    // Get headers
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    console.log('📋 CSV Headers:', headers);
    
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
    return restaurants;
  }
}

/**
 * Fetch Michelin data from GitHub repositories (legacy fallback)
 */
export async function fetchMichelinDataFromGitHub(): Promise<MichelinRestaurant[]> {
  const restaurants: MichelinRestaurant[] = [];
  
  try {
    // Try multiple possible GitHub repo structures
    const repoUrls = [
      'https://raw.githubusercontent.com/NicolaFerracin/michelin-stars-restaurants-api/master/data',
      'https://raw.githubusercontent.com/NicolaFerracin/michelin-stars-restaurants-api/main/data',
      'https://raw.githubusercontent.com/ngshiheng/michelin-my-maps/main/data',
    ];
    
    const files = [
      'one-star.json',
      'two-stars.json', 
      'three-stars.json'
    ];
    
    let successfulFetch = false;
    
    for (const baseUrl of repoUrls) {
      console.log(`🔍 Trying repository: ${baseUrl}`);
      
      for (const file of files) {
        try {
          console.log(`📥 Fetching: ${baseUrl}/${file}`);
          const response = await fetch(`${baseUrl}/${file}`, {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'Le-Voyageur-App/1.0',
            }
          });
          
          if (!response.ok) {
            console.log(`⚠️ Failed to fetch ${file} from ${baseUrl}: ${response.status} ${response.statusText}`);
            continue;
          }
          
          const data = await response.json();
          
          // Parse the data format from the GitHub repo
          if (Array.isArray(data)) {
            let addedCount = 0;
            for (const restaurant of data) {
              // Determine star count from filename
              let stars = 1;
              if (file.includes('two')) stars = 2;
              else if (file.includes('three')) stars = 3;
              
              // Only add if we have valid coordinates
              if (restaurant.latitude && restaurant.longitude) {
                restaurants.push({
                  name: restaurant.name,
                  location: restaurant.location || restaurant.city || '',
                  address: restaurant.address,
                  city: restaurant.city,
                  region: restaurant.region,
                  country: restaurant.country,
                  latitude: parseFloat(restaurant.latitude),
                  longitude: parseFloat(restaurant.longitude),
                  stars: stars,
                  cuisines: restaurant.cuisine ? [restaurant.cuisine] : [],
                  url: restaurant.url
                });
                addedCount++;
              }
            }
            console.log(`✅ Fetched ${addedCount} restaurants from ${file}`);
            successfulFetch = true;
          }
        } catch (err) {
          console.log(`⚠️ Error fetching ${file} from ${baseUrl}:`, err);
        }
      }
      
      // If we successfully fetched data from this repo, break
      if (successfulFetch && restaurants.length > 0) {
        console.log(`✅ Successfully fetched from ${baseUrl}`);
        break;
      }
    }
    
    console.log(`✅ Total fetched: ${restaurants.length} Michelin restaurants`);
    return restaurants;
  } catch (error) {
    console.error('❌ Error fetching Michelin data from GitHub API:', error);
    return restaurants;
  }
}

/**
 * Store Michelin restaurants in the database
 */
export async function storeMichelinRestaurants(restaurants: MichelinRestaurant[]): Promise<number> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  let stored = 0;
  
  console.log(`📊 Storing ${restaurants.length} restaurants in database...`);
  
  for (const restaurant of restaurants) {
    try {
      // Check if restaurant already exists by name and approximate location
      const { data: existing, error: searchError } = await supabase
        .from('locations')
        .select('id, michelin_score')
        .eq('name', restaurant.name)
        .limit(1);
      
      if (searchError) {
        console.error('❌ Error searching for restaurant:', searchError);
        continue;
      }
      
      if (existing && existing.length > 0) {
        // Update existing location with Michelin data if not already set
        const location = existing[0];
        if (!location.michelin_score || location.michelin_score === 0) {
          const { error: updateError } = await supabase
            .from('locations')
            .update({
              michelin_score: restaurant.stars,
              cuisine: restaurant.cuisines?.[0] || null,
              updated_at: new Date().toISOString()
            })
            .eq('id', location.id);
          
          if (!updateError) {
            stored++;
            console.log(`✅ Updated Michelin score for: ${restaurant.name}`);
          }
        }
      } else {
        // Create new location
        const { error: insertError } = await supabase
          .from('locations')
          .insert({
            name: restaurant.name,
            description: `${restaurant.location} • ${restaurant.stars <= 3 ? restaurant.stars + ' Michelin Star' + (restaurant.stars > 1 ? 's' : '') : restaurant.stars === 4 ? 'Bib Gourmand' : 'Michelin Plate'}`,
            lat: restaurant.latitude,
            lng: restaurant.longitude,
            michelin_score: restaurant.stars,
            cuisine: restaurant.cuisines?.[0] || null,
            area: restaurant.city || restaurant.region || null,
            tags: ['michelin', 'restaurant', ...(restaurant.cuisines || [])],
            lv_editors_score: null,
            lv_crowdsource_score: null,
            google_rating: null,
          });
        
        if (!insertError) {
          stored++;
          console.log(`✅ Added new Michelin restaurant: ${restaurant.name}`);
        } else {
          console.error(`❌ Error inserting ${restaurant.name}:`, insertError);
        }
      }
    } catch (error) {
      console.error(`❌ Error processing restaurant ${restaurant.name}:`, error);
    }
  }
  
  return stored;
}

/**
 * Main function to sync Michelin data
 * This can be called periodically to update the database
 */
export async function syncMichelinData(): Promise<{ success: boolean; count: number; message: string }> {
  try {
    console.log('🍽️ Starting Michelin data sync...');
    
    let restaurants: MichelinRestaurant[] = [];
    let dataSource = '';
    
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
    
    // If GitHub fetch fails, use sample data
    if (restaurants.length === 0) {
      console.log('⚠️ GitHub repositories unavailable, using sample Michelin data...');
      restaurants = getSampleMichelinData();
      dataSource = 'Sample Data';
    }
    
    if (restaurants.length === 0) {
      console.error('❌ No Michelin restaurants available (not even sample data)');
      return {
        success: false,
        count: 0,
        message: 'No Michelin data available. Please contact support.'
      };
    }
    
    console.log(`📊 Processing ${restaurants.length} Michelin restaurants from ${dataSource}...`);
    
    // Store restaurants in database
    const storedCount = await storeMichelinRestaurants(restaurants);
    
    console.log(`✅ Sync complete: ${storedCount} locations processed out of ${restaurants.length} fetched`);
    
    const message = `Successfully processed ${storedCount} Michelin restaurants from ${dataSource}`;
    
    return {
      success: true,
      count: storedCount,
      message: message
    };
  } catch (error) {
    console.error('❌ Error syncing Michelin data:', error);
    return {
      success: false,
      count: 0,
      message: `Error during sync: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

/**
 * Get Michelin rating for a specific location by coordinates
 * This can be used to check if a Google Place has a Michelin rating
 */
export async function getMichelinRating(lat: number, lng: number, name?: string): Promise<number | null> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  
  try {
    // Search for nearby restaurants with Michelin ratings
    // Using a simple bounding box search (±0.001 degrees ≈ 100m)
    const { data: locations, error } = await supabase
      .from('locations')
      .select('id, name, lat, lng, michelin_score')
      .gte('lat', lat - 0.001)
      .lte('lat', lat + 0.001)
      .gte('lng', lng - 0.001)
      .lte('lng', lng + 0.001)
      .not('michelin_score', 'is', null)
      .gt('michelin_score', 0);
    
    if (error || !locations || locations.length === 0) {
      return null;
    }
    
    // If name provided, try to match by name first
    if (name) {
      const nameMatch = locations.find(loc => 
        loc.name.toLowerCase().includes(name.toLowerCase()) || 
        name.toLowerCase().includes(loc.name.toLowerCase())
      );
      if (nameMatch) {
        return nameMatch.michelin_score;
      }
    }
    
    // Otherwise return the closest one
    return locations[0].michelin_score;
  } catch (error) {
    console.error('❌ Error getting Michelin rating:', error);
    return null;
  }
}
