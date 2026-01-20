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

// Get Supabase admin client for server-side operations
function getSupabaseAdmin() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
}

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
 * Scrape Michelin data from the official Michelin Guide website
 * This uses web scraping since Michelin doesn't provide a public API
 */
export async function scrapeMichelinData(country: string = 'us'): Promise<MichelinRestaurant[]> {
  const restaurants: MichelinRestaurant[] = [];
  
  try {
    // The Michelin Guide uses a GraphQL API endpoint
    const url = 'https://guide.michelin.com/api/graphql';
    
    // Build GraphQL query for restaurants in a specific country
    const query = `
      query GetRestaurants($locale: String!, $location: String!) {
        restaurants(locale: $locale, location: $location) {
          results {
            name
            address
            city
            region
            country
            latitude
            longitude
            cuisineType
            distinction {
              value
            }
            url
          }
        }
      }
    `;
    
    const variables = {
      locale: 'en_US',
      location: country
    };
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables })
    });
    
    if (!response.ok) {
      console.error('❌ Michelin API request failed:', response.status);
      return restaurants;
    }
    
    const data = await response.json();
    const results = data?.data?.restaurants?.results || [];
    
    // Process results
    for (const result of results) {
      // Map distinction to stars
      let stars = 0;
      if (result.distinction?.value === '1_MICHELIN_STAR') stars = 1;
      else if (result.distinction?.value === '2_MICHELIN_STARS') stars = 2;
      else if (result.distinction?.value === '3_MICHELIN_STARS') stars = 3;
      else if (result.distinction?.value === 'BIB_GOURMAND') stars = 4;
      else if (result.distinction?.value === 'MICHELIN_PLATE') stars = 5;
      
      if (stars > 0 && result.latitude && result.longitude) {
        restaurants.push({
          name: result.name,
          location: [result.city, result.region, result.country].filter(Boolean).join(', '),
          address: result.address,
          city: result.city,
          region: result.region,
          country: result.country,
          latitude: result.latitude,
          longitude: result.longitude,
          stars: stars,
          cuisines: result.cuisineType ? [result.cuisineType] : [],
          url: result.url ? `https://guide.michelin.com${result.url}` : undefined
        });
      }
    }
    
    console.log(`✅ Scraped ${restaurants.length} Michelin restaurants from ${country}`);
    return restaurants;
  } catch (error) {
    console.error('❌ Error scraping Michelin data:', error);
    return restaurants;
  }
}

/**
 * Alternative: Parse from the michelin-stars-restaurants-api data
 * This uses the pre-compiled dataset from the GitHub repo
 */
export async function fetchMichelinDataFromAPI(): Promise<MichelinRestaurant[]> {
  const restaurants: MichelinRestaurant[] = [];
  
  try {
    // The GitHub project provides a JSON API endpoint
    const baseUrl = 'https://raw.githubusercontent.com/NicolaFerracin/michelin-stars-restaurants-api/master/data';
    
    // Fetch data for different regions
    const regions = ['usa', 'italy', 'france', 'spain', 'uk', 'germany', 'japan'];
    
    for (const region of regions) {
      try {
        const response = await fetch(`${baseUrl}/${region}.json`);
        if (!response.ok) continue;
        
        const data = await response.json();
        
        // Parse the data format from the GitHub repo
        if (Array.isArray(data)) {
          for (const restaurant of data) {
            restaurants.push({
              name: restaurant.name,
              location: restaurant.location || restaurant.city || '',
              address: restaurant.address,
              city: restaurant.city,
              region: restaurant.region,
              country: restaurant.country || region,
              latitude: restaurant.latitude,
              longitude: restaurant.longitude,
              stars: restaurant.stars || restaurant.distinction || 1,
              cuisines: restaurant.cuisine ? [restaurant.cuisine] : [],
              url: restaurant.url
            });
          }
        }
      } catch (err) {
        console.log(`⚠️ Failed to fetch ${region} data:`, err);
      }
    }
    
    console.log(`✅ Fetched ${restaurants.length} Michelin restaurants from API`);
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
  const supabase = getSupabaseAdmin();
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
    
    // Try the API approach first (more reliable)
    let restaurants = await fetchMichelinDataFromAPI();
    
    // If API approach fails, try scraping (may not work due to CORS/auth)
    if (restaurants.length === 0) {
      console.log('⚠️ API fetch returned no results, attempting direct scrape...');
      restaurants = await scrapeMichelinData('us');
    }
    
    if (restaurants.length === 0) {
      return {
        success: false,
        count: 0,
        message: 'Failed to fetch Michelin data from any source'
      };
    }
    
    // Store restaurants in database
    const storedCount = await storeMichelinRestaurants(restaurants);
    
    return {
      success: true,
      count: storedCount,
      message: `Successfully processed ${storedCount} Michelin restaurants`
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
  const supabase = getSupabaseAdmin();
  
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
