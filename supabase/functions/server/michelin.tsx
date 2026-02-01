/**
 * Michelin Guide Integration
 * Handles querying Michelin restaurant data from Supabase database
 */

import { createClient } from 'npm:@supabase/supabase-js@2';

interface MichelinRestaurant {
  id?: number;
  Name: string;
  Address?: string;
  Location?: string;
  Price: string;
  Cuisine: string;
  Longitude: number;
  Latitude: number;
  PhoneNumber?: string;
  Url?: string;
  WebsiteUrl?: string;
  Award: string; // "1 Stars", "2 Stars", "3 Stars", "Bib Gourmand"
  GreenStar?: number;
  FacilitiesAndServices?: string;
  Description?: string;
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
 * Convert Michelin award to numeric score
 */
function awardToScore(award: string): number | null {
  if (!award) return null;
  
  const awardLower = award.toLowerCase();
  
  if (awardLower.includes('3 star')) return 3;
  if (awardLower.includes('2 star')) return 2;
  if (awardLower.includes('1 star')) return 1;
  if (awardLower.includes('bib gourmand')) return 0.5;
  
  return null;
}

/**
 * Get Michelin rating for a location
 * Returns numeric score (0.5 for Bib Gourmand, 1-3 for stars)
 */
export async function getMichelinRating(lat: number, lng: number, name?: string): Promise<number | null> {
  try {
    console.log(`🔍 Searching for Michelin rating near (${lat}, ${lng})${name ? ` for "${name}"` : ''}`);
    
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Query all Michelin restaurants from database
    const { data: restaurants, error } = await supabase
      .from('michelin_restaurants')
      .select('*');
    
    if (error) {
      console.error('❌ Error querying Michelin restaurants:', error);
      return null;
    }
    
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
      if (!restaurant || !restaurant.Latitude || !restaurant.Longitude) continue;
      
      const distance = calculateDistance(
        lat,
        lng,
        restaurant.Latitude,
        restaurant.Longitude
      );
      
      // If name is provided, prefer exact name matches within reasonable distance
      if (name && restaurant.Name) {
        const nameMatch = restaurant.Name.toLowerCase().includes(name.toLowerCase()) ||
                         name.toLowerCase().includes(restaurant.Name.toLowerCase());
        
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
    
    console.log(`✅ Found Michelin restaurant: ${closestMatch.Name} (${closestDistance.toFixed(3)} km away) - ${closestMatch.Award}`);
    
    // Convert Michelin award to score
    const score = awardToScore(closestMatch.Award);
    
    return score;
  } catch (error) {
    console.error('❌ Error getting Michelin rating:', error);
    return null;
  }
}

/**
 * Get detailed Michelin restaurant info for a location
 * Returns full restaurant details if found
 */
export async function getMichelinRestaurantDetails(lat: number, lng: number, name?: string): Promise<MichelinRestaurant | null> {
  try {
    console.log(`🔍 Searching for Michelin restaurant details near (${lat}, ${lng})${name ? ` for "${name}"` : ''}`);
    
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    // Query all Michelin restaurants from database
    const { data: restaurants, error } = await supabase
      .from('michelin_restaurants')
      .select('*');
    
    if (error) {
      console.error('❌ Error querying Michelin restaurants:', error);
      return null;
    }
    
    if (!restaurants || restaurants.length === 0) {
      console.log('📊 No Michelin restaurants in database');
      return null;
    }
    
    // Find closest matching restaurant
    let closestMatch: MichelinRestaurant | null = null;
    let closestDistance = Infinity;
    const MAX_DISTANCE_KM = 0.5;
    
    for (const restaurant of restaurants) {
      if (!restaurant || !restaurant.Latitude || !restaurant.Longitude) continue;
      
      const distance = calculateDistance(
        lat,
        lng,
        restaurant.Latitude,
        restaurant.Longitude
      );
      
      // If name is provided, prefer exact name matches
      if (name && restaurant.Name) {
        const nameMatch = restaurant.Name.toLowerCase().includes(name.toLowerCase()) ||
                         name.toLowerCase().includes(restaurant.Name.toLowerCase());
        
        if (nameMatch && distance < MAX_DISTANCE_KM * 5) {
          if (distance < closestDistance) {
            closestDistance = distance;
            closestMatch = restaurant as MichelinRestaurant;
          }
        }
      }
      
      // Proximity-based matching
      if (distance < MAX_DISTANCE_KM && distance < closestDistance) {
        closestDistance = distance;
        closestMatch = restaurant as MichelinRestaurant;
      }
    }
    
    if (!closestMatch) {
      console.log('❌ No Michelin restaurant found within range');
      return null;
    }
    
    console.log(`✅ Found Michelin restaurant details: ${closestMatch.Name}`);
    
    return closestMatch;
  } catch (error) {
    console.error('❌ Error getting Michelin restaurant details:', error);
    return null;
  }
}