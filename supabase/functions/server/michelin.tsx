/**
 * Michelin Guide Data Scraper
 * 
 * Based on: https://github.com/NicolaFerracin/michelin-stars-restaurants-api
 * 
 * This module scrapes Michelin Guide restaurant data and stores it in our database.
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
}

/**
 * Sample Michelin data for testing when GitHub repos are unavailable
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
 * Fetch Michelin data from GitHub repositories
 */
export async function fetchMichelinDataFromAPI(): Promise<MichelinRestaurant[]> {
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
    console.error('❌ Error fetching Michelin data from API:', error);
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
    
    // Try to fetch from GitHub API first
    let restaurants = await fetchMichelinDataFromAPI();
    
    // If GitHub fetch fails, use sample data
    if (restaurants.length === 0) {
      console.log('⚠️ GitHub repositories unavailable, using sample Michelin data...');
      restaurants = getSampleMichelinData();
    }
    
    if (restaurants.length === 0) {
      console.error('❌ No Michelin restaurants available (not even sample data)');
      return {
        success: false,
        count: 0,
        message: 'No Michelin data available. Please contact support.'
      };
    }
    
    console.log(`📊 Processing ${restaurants.length} Michelin restaurants...`);
    
    // Store restaurants in database
    const storedCount = await storeMichelinRestaurants(restaurants);
    
    console.log(`✅ Sync complete: ${storedCount} locations processed out of ${restaurants.length} fetched`);
    
    const message = restaurants === getSampleMichelinData() 
      ? `Successfully processed ${storedCount} sample Michelin restaurants (GitHub data unavailable)`
      : `Successfully processed ${storedCount} Michelin restaurants from GitHub`;
    
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
