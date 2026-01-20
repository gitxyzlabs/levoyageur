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
 * Parse from the michelin-stars-restaurants-api data
 * This uses the pre-compiled dataset from the GitHub repo
 */
export async function fetchMichelinDataFromAPI(): Promise<MichelinRestaurant[]> {
  const restaurants: MichelinRestaurant[] = [];
  
  try {
    // The GitHub project provides a JSON API endpoint
    const baseUrl = 'https://raw.githubusercontent.com/NicolaFerracin/michelin-stars-restaurants-api/master/data';
    
    // Fetch data for different star levels (updated to match actual repo structure)
    const files = [
      'one-star.json',
      'two-stars.json', 
      'three-stars.json'
    ];
    
    for (const file of files) {
      try {
        const response = await fetch(`${baseUrl}/${file}`);
        if (!response.ok) {
          console.log(`⚠️ Failed to fetch ${file}: ${response.status}`);
          continue;
        }
        
        const data = await response.json();
        
        // Parse the data format from the GitHub repo
        if (Array.isArray(data)) {
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
            }
          }
          console.log(`✅ Fetched ${data.length} restaurants from ${file}`);
        }
      } catch (err) {
        console.log(`⚠️ Failed to fetch ${file}:`, err);
      }
    }
    
    console.log(`✅ Total fetched: ${restaurants.length} Michelin restaurants from GitHub API`);
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
    
    // Fetch from GitHub API (most reliable source)
    const restaurants = await fetchMichelinDataFromAPI();
    
    if (restaurants.length === 0) {
      return {
        success: false,
        count: 0,
        message: 'Failed to fetch Michelin data from GitHub API. The repository may be unavailable.'
      };
    }
    
    console.log(`📊 Processing ${restaurants.length} Michelin restaurants...`);
    
    // Store restaurants in database
    const storedCount = await storeMichelinRestaurants(restaurants);
    
    return {
      success: true,
      count: storedCount,
      message: `Successfully processed ${storedCount} out of ${restaurants.length} Michelin restaurants`
    };
  } catch (error) {
    console.error('❌ Error syncing Michelin data:', error);
    return {
      success: false,
      count: 0,
      message: `Error: ${error instanceof Error ? error.message : String(error)}`
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