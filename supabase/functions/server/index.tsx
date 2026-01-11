import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Helper function to create Supabase client
const getSupabaseClient = () => {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  );
};

// Helper function to verify user authentication
const verifyAuth = async (request: Request) => {
  const accessToken = request.headers.get('Authorization')?.split(' ')[1];
  if (!accessToken) {
    return null;
  }
  
  const supabase = getSupabaseClient();
  const { data: { user }, error } = await supabase.auth.getUser(accessToken);
  
  if (error || !user) {
    return null;
  }
  
  return user;
};

// Helper function to get user metadata from database
const getUserMetadata = async (userId: string) => {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('user_metadata')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  
  if (error) {
    console.error('Error fetching user metadata:', error);
    return null;
  }
  
  return data;
};

// Helper function to check if user is an editor
const isEditor = async (userId: string): Promise<boolean> => {
  const metadata = await getUserMetadata(userId);
  return metadata?.role === 'editor';
};

// Health check endpoint
app.get("/make-server-48182530/health", (c) => {
  return c.json({ status: "ok" });
});

// Get Google Maps API key
app.get("/make-server-48182530/config/google-maps-key", (c) => {
  const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
  if (!apiKey) {
    return c.json({ error: 'Google Maps API key not configured' }, 500);
  }
  return c.json({ apiKey });
});

// Sign up endpoint
app.post("/make-server-48182530/signup", async (c) => {
  const { email, password, name } = await c.req.json();
  
  const supabase = getSupabaseClient();
  
  // Create auth user
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    user_metadata: { name },
    // Automatically confirm the user's email since an email server hasn't been configured.
    email_confirm: true
  });
  
  if (error) {
    console.error('Error creating auth user:', error);
    return c.json({ error: error.message }, 400);
  }
  
  // Check if this is the first user ever - if so, make them an editor
  const { count } = await supabase
    .from('user_metadata')
    .select('*', { count: 'exact', head: true });
  
  const isFirstUser = count === 0;
  const role = isFirstUser ? 'editor' : 'user';
  
  if (isFirstUser) {
    console.log('🎉 First user detected! Automatically granting editor role.');
  }
  
  // Store user metadata in database
  const { error: metadataError } = await supabase
    .from('user_metadata')
    .insert({
      user_id: data.user.id,
      email,
      name,
      role,
    });
  
  if (metadataError) {
    console.error('Error creating user metadata:', metadataError);
    // Note: Auth user is already created, so we don't roll back
  }
  
  console.log(`User ${email} created with role: ${role}`);
  
  return c.json({ user: data.user });
});

// Create OAuth user endpoint (called when user logs in via OAuth for the first time)
app.post("/make-server-48182530/create-oauth-user", async (c) => {
  const userData = await c.req.json();
  
  console.log('Creating OAuth user:', userData);
  
  const supabase = getSupabaseClient();
  
  // Check if user metadata already exists
  const existing = await getUserMetadata(userData.id);
  if (existing) {
    console.log('User metadata already exists, skipping creation');
    return c.json({ success: true, user: { ...userData, role: existing.role } });
  }
  
  // Check if this is the first user ever - if so, make them an editor
  const { count } = await supabase
    .from('user_metadata')
    .select('*', { count: 'exact', head: true });
  
  const isFirstUser = count === 0;
  const role = isFirstUser ? 'editor' : 'user';
  
  if (isFirstUser) {
    console.log('🎉 First user detected! Automatically granting editor role.');
  }
  
  // Store user metadata in database
  const { error } = await supabase
    .from('user_metadata')
    .insert({
      user_id: userData.id,
      email: userData.email,
      name: userData.name,
      role,
    });
  
  if (error) {
    console.error('Error creating OAuth user metadata:', error);
    return c.json({ error: error.message }, 500);
  }
  
  console.log(`OAuth user created successfully with role: ${role}`);
  
  return c.json({ success: true, user: { ...userData, role } });
});

// Get current user endpoint
app.get("/make-server-48182530/user", async (c) => {
  const accessToken = c.req.header('Authorization')?.split(' ')[1];
  
  if (!accessToken || accessToken === Deno.env.get('SUPABASE_ANON_KEY')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const supabase = getSupabaseClient();
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(accessToken);
  
  if (authError || !authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  // Get user metadata from database
  const metadata = await getUserMetadata(authUser.id);
  
  if (!metadata) {
    return c.json({ error: 'User metadata not found' }, 404);
  }
  
  // Combine auth data with metadata
  const user = {
    id: authUser.id,
    email: authUser.email,
    name: metadata.name,
    role: metadata.role,
  };
  
  return c.json({ user });
});

// Admin: Get all users
app.get("/make-server-48182530/admin/users", async (c) => {
  const accessToken = c.req.header('Authorization')?.split(' ')[1];
  
  if (!accessToken || accessToken === Deno.env.get('SUPABASE_ANON_KEY')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const supabase = getSupabaseClient();
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(accessToken);
  
  if (authError || !authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  // Check if user is an editor (only editors can access admin panel)
  if (!await isEditor(authUser.id)) {
    return c.json({ error: 'Forbidden: Only editors can access this endpoint' }, 403);
  }
  
  // Get all users from user_metadata table
  const { data: allUsers, error } = await supabase
    .from('user_metadata')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching users:', error);
    return c.json({ error: error.message }, 500);
  }
  
  // Transform to match expected format
  const transformedUsers = allUsers?.map(user => ({
    id: user.user_id,
    email: user.email,
    name: user.name,
    role: user.role,
  })) || [];
  
  return c.json({ users: transformedUsers });
});

// Admin: Update user role
app.put("/make-server-48182530/admin/users/:userId/role", async (c) => {
  const accessToken = c.req.header('Authorization')?.split(' ')[1];
  const userId = c.req.param('userId');
  const { role } = await c.req.json();
  
  if (!accessToken || accessToken === Deno.env.get('SUPABASE_ANON_KEY')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const supabase = getSupabaseClient();
  const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(accessToken);
  
  if (authError || !authUser) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  // Check if user is an editor (only editors can modify roles)
  // BUT: If there are no editors yet, allow the first user to promote themselves
  const isCurrentUserEditor = await isEditor(authUser.id);
  const { count: editorCount } = await supabase
    .from('user_metadata')
    .select('*', { count: 'exact', head: true })
    .eq('role', 'editor');
  
  const noEditorsExist = editorCount === 0;
  const isSelfPromotion = authUser.id === userId;
  
  // Allow if: current user is already an editor, OR no editors exist and user is promoting themselves
  if (!isCurrentUserEditor && !(noEditorsExist && isSelfPromotion)) {
    return c.json({ error: 'Forbidden: Only editors can modify user roles' }, 403);
  }
  
  // Validate role
  if (role !== 'user' && role !== 'editor') {
    return c.json({ error: 'Invalid role. Must be "user" or "editor"' }, 400);
  }
  
  // Update user role in database
  const { data: updatedUser, error } = await supabase
    .from('user_metadata')
    .update({ role, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating user role:', error);
    return c.json({ error: error.message }, 500);
  }
  
  if (!updatedUser) {
    return c.json({ error: 'User not found' }, 404);
  }
  
  console.log(`Updated user ${userId} role to: ${role}`);
  
  // Return transformed user
  const transformedUser = {
    id: updatedUser.user_id,
    email: updatedUser.email,
    name: updatedUser.name,
    role: updatedUser.role,
  };
  
  return c.json({ user: transformedUser });
});

// Get all locations
app.get("/make-server-48182530/locations", async (c) => {
  try {
    const supabase = getSupabaseClient();
    const { data: locations, error } = await supabase
      .from('locations')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching locations from Supabase:', error);
      return c.json({ error: error.message }, 500);
    }
    
    console.log('GET /locations - Found locations:', locations?.length || 0);
    
    // Transform snake_case to camelCase for frontend
    const transformedLocations = locations?.map(loc => ({
      id: loc.id,
      name: loc.name,
      lat: loc.lat,
      lng: loc.lng,
      lvEditorsScore: loc.lv_editors_score,
      lvCrowdsourceScore: loc.lv_crowdsource_score,
      googleRating: loc.google_rating,
      michelinScore: loc.michelin_score,
      tags: loc.tags,
      description: loc.description,
      place_id: loc.place_id,
      image: loc.image,
      cuisine: loc.cuisine,
      area: loc.area,
      createdBy: loc.created_by,
      createdAt: loc.created_at,
    })) || [];
    
    return c.json({ locations: transformedLocations });
  } catch (error: any) {
    console.error('Error in /locations endpoint:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Get locations by tag (for heat map)
app.get("/make-server-48182530/locations/tag/:tag", async (c) => {
  try {
    const tag = c.req.param('tag');
    const supabase = getSupabaseClient();
    
    console.log('Searching for locations with tag:', tag);
    
    const { data: locations, error } = await supabase
      .from('locations')
      .select('*')
      .contains('tags', [tag.toLowerCase()]);
    
    if (error) {
      console.error('Error fetching locations by tag:', error);
      return c.json({ error: error.message }, 500);
    }
    
    console.log(`Found ${locations?.length || 0} locations with tag: ${tag}`);
    
    // Transform snake_case to camelCase for frontend
    const transformedLocations = locations?.map(loc => ({
      id: loc.id,
      name: loc.name,
      lat: loc.lat,
      lng: loc.lng,
      lvEditorsScore: loc.lv_editors_score,
      lvCrowdsourceScore: loc.lv_crowdsource_score,
      googleRating: loc.google_rating,
      michelinScore: loc.michelin_score,
      tags: loc.tags,
      description: loc.description,
      place_id: loc.place_id,
      image: loc.image,
      cuisine: loc.cuisine,
      area: loc.area,
      createdBy: loc.created_by,
      createdAt: loc.created_at,
    })) || [];
    
    return c.json({ locations: transformedLocations });
  } catch (error: any) {
    console.error('Error in /locations/tag endpoint:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Add location (editor only)
app.post("/make-server-48182530/locations", async (c) => {
  const user = await verifyAuth(c.req.raw);
  
  if (!user) {
    return c.json({ error: 'Unauthorized - Please log in' }, 401);
  }
  
  // Check if user is an editor
  if (!await isEditor(user.id)) {
    return c.json({ error: 'Forbidden - Editor access required' }, 403);
  }
  
  const locationData = await c.req.json();
  
  // Sanitize place_id - ensure it's either a valid string or null
  let placeId = locationData.place_id;
  if (placeId === 'undefined' || placeId === 'null' || placeId === '' || !placeId) {
    placeId = null;
  } else if (typeof placeId === 'string') {
    placeId = placeId.trim();
  }
  
  console.log('=== Adding Location ===');
  console.log('Name:', locationData.name);
  console.log('Editor:', user.email);
  console.log('Original place_id:', locationData.place_id);
  console.log('Sanitized place_id:', placeId);
  
  try {
    const supabase = getSupabaseClient();
    
    const { data: location, error } = await supabase
      .from('locations')
      .insert({
        name: locationData.name,
        lat: locationData.lat,
        lng: locationData.lng,
        lv_editors_score: locationData.lvEditorsScore,
        lv_crowdsource_score: locationData.lvCrowdsourceScore || 0,
        google_rating: locationData.googleRating || 0,
        michelin_score: locationData.michelinScore || 0,
        tags: locationData.tags || [],
        description: locationData.description,
        place_id: placeId,
        image: locationData.image,
        cuisine: locationData.cuisine,
        area: locationData.area,
        created_by: user.id,
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error inserting location:', error);
      return c.json({ error: error.message }, 500);
    }
    
    console.log('✅ Location saved successfully with place_id:', location.place_id);
    
    // Transform snake_case to camelCase for frontend
    const transformedLocation = {
      id: location.id,
      name: location.name,
      lat: location.lat,
      lng: location.lng,
      lvEditorsScore: location.lv_editors_score,
      lvCrowdsourceScore: location.lv_crowdsource_score,
      googleRating: location.google_rating,
      michelinScore: location.michelin_score,
      tags: location.tags,
      description: location.description,
      place_id: location.place_id,
      image: location.image,
      cuisine: location.cuisine,
      area: location.area,
      createdBy: location.created_by,
      createdAt: location.created_at,
    };
    
    return c.json({ location: transformedLocation });
  } catch (error: any) {
    console.error('Error in add location endpoint:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Update location (editor only)
app.put("/make-server-48182530/locations/:id", async (c) => {
  const user = await verifyAuth(c.req.raw);
  
  if (!user) {
    return c.json({ error: 'Unauthorized - Please log in' }, 401);
  }
  
  // Check if user is an editor
  if (!await isEditor(user.id)) {
    return c.json({ error: 'Forbidden - Editor access required' }, 403);
  }
  
  const locationId = c.req.param('id');
  const updates = await c.req.json();
  
  console.log('=== Updating Location ===');
  console.log('Location ID:', locationId);
  console.log('Editor:', user.email);
  
  try {
    const supabase = getSupabaseClient();
    
    // Transform camelCase to snake_case for database
    const dbUpdates: any = {
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };
    
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.lat !== undefined) dbUpdates.lat = updates.lat;
    if (updates.lng !== undefined) dbUpdates.lng = updates.lng;
    if (updates.lvEditorsScore !== undefined) dbUpdates.lv_editors_score = updates.lvEditorsScore;
    if (updates.lvCrowdsourceScore !== undefined) dbUpdates.lv_crowdsource_score = updates.lvCrowdsourceScore;
    if (updates.googleRating !== undefined) dbUpdates.google_rating = updates.googleRating;
    if (updates.michelinScore !== undefined) dbUpdates.michelin_score = updates.michelinScore;
    if (updates.tags !== undefined) dbUpdates.tags = updates.tags;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.place_id !== undefined) dbUpdates.place_id = updates.place_id;
    if (updates.image !== undefined) dbUpdates.image = updates.image;
    if (updates.cuisine !== undefined) dbUpdates.cuisine = updates.cuisine;
    if (updates.area !== undefined) dbUpdates.area = updates.area;
    
    const { data: location, error } = await supabase
      .from('locations')
      .update(dbUpdates)
      .eq('id', locationId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating location:', error);
      return c.json({ error: error.message }, 500);
    }
    
    console.log('✅ Location updated successfully');
    
    // Transform snake_case to camelCase for frontend
    const transformedLocation = {
      id: location.id,
      name: location.name,
      lat: location.lat,
      lng: location.lng,
      lvEditorsScore: location.lv_editors_score,
      lvCrowdsourceScore: location.lv_crowdsource_score,
      googleRating: location.google_rating,
      michelinScore: location.michelin_score,
      tags: location.tags,
      description: location.description,
      place_id: location.place_id,
      image: location.image,
      cuisine: location.cuisine,
      area: location.area,
      createdBy: location.created_by,
      createdAt: location.created_at,
      updatedBy: location.updated_by,
      updatedAt: location.updated_at,
    };
    
    return c.json({ location: transformedLocation });
  } catch (error: any) {
    console.error('Error in update location endpoint:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Delete location (editor only)
app.delete("/make-server-48182530/locations/:id", async (c) => {
  const user = await verifyAuth(c.req.raw);
  
  if (!user) {
    return c.json({ error: 'Unauthorized - Please log in' }, 401);
  }
  
  // Check if user is an editor
  if (!await isEditor(user.id)) {
    return c.json({ error: 'Forbidden - Editor access required' }, 403);
  }
  
  const locationId = c.req.param('id');
  
  console.log('=== Deleting Location ===');
  console.log('Location ID:', locationId);
  console.log('Editor:', user.email);
  
  try {
    const supabase = getSupabaseClient();
    
    const { error } = await supabase
      .from('locations')
      .delete()
      .eq('id', locationId);
    
    if (error) {
      console.error('Error deleting location:', error);
      return c.json({ error: error.message }, 500);
    }
    
    console.log('✅ Location deleted successfully');
    
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error in delete location endpoint:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Favorites endpoints
app.get("/make-server-48182530/favorites", async (c) => {
  const accessToken = c.req.header('Authorization')?.split(' ')[1];
  
  if (!accessToken || accessToken === Deno.env.get('SUPABASE_ANON_KEY')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const supabase = getSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
  
  if (authError || !user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  try {
    // Get favorites with location details
    const { data: favorites, error } = await supabase
      .from('favorites')
      .select(`
        location_id,
        locations (*)
      `)
      .eq('user_id', user.id);
    
    if (error) {
      console.error('Error fetching favorites:', error);
      return c.json({ error: error.message }, 500);
    }
    
    // Transform to match expected format
    const transformedFavorites = favorites?.map(fav => {
      const loc = fav.locations as any;
      return {
        id: loc.id,
        name: loc.name,
        lat: loc.lat,
        lng: loc.lng,
        lvEditorsScore: loc.lv_editors_score,
        lvCrowdsourceScore: loc.lv_crowdsource_score,
        googleRating: loc.google_rating,
        michelinScore: loc.michelin_score,
        tags: loc.tags,
        description: loc.description,
        place_id: loc.place_id,
        image: loc.image,
        cuisine: loc.cuisine,
        area: loc.area,
      };
    }) || [];
    
    return c.json({ favorites: transformedFavorites });
  } catch (error: any) {
    console.error('Error in /favorites endpoint:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.post("/make-server-48182530/favorites/:locationId", async (c) => {
  const accessToken = c.req.header('Authorization')?.split(' ')[1];
  const locationId = c.req.param('locationId');
  
  if (!accessToken || accessToken === Deno.env.get('SUPABASE_ANON_KEY')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const supabase = getSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
  
  if (authError || !user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  try {
    const { error } = await supabase
      .from('favorites')
      .insert({
        user_id: user.id,
        location_id: locationId,
      });
    
    if (error) {
      // Ignore duplicate errors (already favorited)
      if (error.code === '23505') {
        return c.json({ success: true });
      }
      console.error('Error adding favorite:', error);
      return c.json({ error: error.message }, 500);
    }
    
    console.log(`✅ User ${user.email} favorited location ${locationId}`);
    
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error in add favorite endpoint:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.delete("/make-server-48182530/favorites/:locationId", async (c) => {
  const accessToken = c.req.header('Authorization')?.split(' ')[1];
  const locationId = c.req.param('locationId');
  
  if (!accessToken || accessToken === Deno.env.get('SUPABASE_ANON_KEY')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const supabase = getSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
  
  if (authError || !user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  try {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('location_id', locationId);
    
    if (error) {
      console.error('Error removing favorite:', error);
      return c.json({ error: error.message }, 500);
    }
    
    console.log(`✅ User ${user.email} unfavorited location ${locationId}`);
    
    return c.json({ success: true });
  } catch (error: any) {
    console.error('Error in remove favorite endpoint:', error);
    return c.json({ error: error.message }, 500);
  }
});

// Ratings endpoints
app.get("/make-server-48182530/ratings/:locationId", async (c) => {
  const accessToken = c.req.header('Authorization')?.split(' ')[1];
  const locationId = c.req.param('locationId');
  
  if (!accessToken || accessToken === Deno.env.get('SUPABASE_ANON_KEY')) {
    return c.json({ rating: null });
  }
  
  const supabase = getSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
  
  if (authError || !user) {
    return c.json({ rating: null });
  }
  
  try {
    const { data, error } = await supabase
      .from('user_ratings')
      .select('rating')
      .eq('user_id', user.id)
      .eq('location_id', locationId)
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching rating:', error);
      return c.json({ rating: null });
    }
    
    return c.json({ rating: data?.rating || null });
  } catch (error: any) {
    console.error('Error in get rating endpoint:', error);
    return c.json({ rating: null });
  }
});

app.post("/make-server-48182530/ratings/:locationId", async (c) => {
  const accessToken = c.req.header('Authorization')?.split(' ')[1];
  const locationId = c.req.param('locationId');
  const { rating } = await c.req.json();
  
  if (!accessToken || accessToken === Deno.env.get('SUPABASE_ANON_KEY')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  const supabase = getSupabaseClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
  
  if (authError || !user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  // Validate rating (0.0-10.0 for users)
  if (rating < 0 || rating > 10) {
    return c.json({ error: 'Rating must be between 0.0 and 10.0' }, 400);
  }
  
  try {
    // Upsert rating (insert or update)
    const { error } = await supabase
      .from('user_ratings')
      .upsert({
        user_id: user.id,
        location_id: locationId,
        rating: rating,
      }, {
        onConflict: 'user_id,location_id'
      });
    
    if (error) {
      console.error('Error saving rating:', error);
      return c.json({ error: error.message }, 500);
    }
    
    console.log(`✅ User ${user.email} rated location ${locationId}: ${rating}`);
    
    return c.json({ success: true, rating });
  } catch (error: any) {
    console.error('Error in save rating endpoint:', error);
    return c.json({ error: error.message }, 500);
  }
});

app.get("/make-server-48182530/ratings/:locationId/count", async (c) => {
  const locationId = c.req.param('locationId');
  
  try {
    const supabase = getSupabaseClient();
    
    const { count, error } = await supabase
      .from('user_ratings')
      .select('*', { count: 'exact', head: true })
      .eq('location_id', locationId);
    
    if (error) {
      console.error('Error counting ratings:', error);
      return c.json({ count: 0 });
    }
    
    return c.json({ count: count || 0 });
  } catch (error: any) {
    console.error('Error in rating count endpoint:', error);
    return c.json({ count: 0 });
  }
});

// Google Places API endpoint
app.get("/make-server-48182530/google/place/:placeId", async (c) => {
  const placeId = c.req.param('placeId');
  const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY');
  
  console.log('Fetching Google place details for place_id:', placeId);
  
  if (!placeId || placeId === 'undefined' || placeId === 'null') {
    console.error('Invalid place_id:', placeId);
    return c.json({ error: 'Invalid place_id parameter' }, 400);
  }
  
  if (!apiKey) {
    console.error('Google Maps API key not configured');
    return c.json({ error: 'Google Maps API key not configured' }, 500);
  }
  
  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}&fields=rating,user_ratings_total,photos&key=${apiKey}`;
    console.log('Fetching from URL:', url.replace(apiKey, 'API_KEY_HIDDEN'));
    
    const response = await fetch(url);
    
    const data = await response.json();
    
    console.log('Google Places API response status:', data.status);
    
    if (data.status !== 'OK') {
      console.error('Google Places API error:', data.status, data.error_message);
      // Return empty data instead of error to prevent InfoWindow from breaking
      return c.json({
        details: {
          rating: null,
          user_ratings_total: null,
          photos: [],
        },
      });
    }
    
    // Transform photos to just include photo_reference
    const photos = data.result?.photos?.map((photo: any) => ({
      photoReference: photo.photo_reference,
      width: photo.width,
      height: photo.height,
    })) || [];
    
    console.log('✅ Successfully fetched place details. Photos count:', photos.length);
    
    return c.json({
      details: {
        rating: data.result?.rating || null,
        user_ratings_total: data.result?.user_ratings_total || null,
        photos,
      },
    });
  } catch (error) {
    console.error('Error fetching Google place details:', error);
    // Return empty data instead of error to prevent InfoWindow from breaking
    return c.json({
      details: {
        rating: null,
        user_ratings_total: null,
        photos: [],
      },
    });
  }
});

// Catch-all route for any unmatched paths
app.all('*', (c) => {
  console.log('❌ Unmatched route:', c.req.path);
  console.log('Method:', c.req.method);
  return c.json({ error: 'Requested path is invalid' }, 404);
});

Deno.serve(app.fetch);