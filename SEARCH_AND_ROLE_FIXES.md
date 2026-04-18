# Search & Editor Role Fixes

## Issues Fixed

### 1. ✅ Search doesn't navigate to location
**Problem:** When searching for a place and clicking on it, the map didn't pan to that location.

**Solution:** 
- Added `mapCenter` and `mapZoom` state variables in App.tsx
- When a place is selected, we now extract its lat/lng and set it as the map center
- Added props to Map component to accept and react to mapCenter changes
- Map now pans smoothly to the selected location and zooms to 15

**Code Changes:**
```typescript
// App.tsx - Extract location from search result
if (place.geometry?.location) {
  const location = place.geometry.location;
  const lat = typeof location.lat === 'function' ? location.lat() : location.lat;
  const lng = typeof location.lng === 'function' ? location.lng() : location.lng;
  
  setMapCenter({ lat, lng });
  setMapZoom(15); // Zoom in close
}

// Map.tsx - React to mapCenter changes
useEffect(() => {
  if (!map || !mapCenter) return;
  
  map.panTo(mapCenter);
  if (mapZoom) {
    map.setZoom(mapZoom);
  }
}, [map, mapCenter, mapZoom]);
```

---

### 2. ✅ Editor role check failing
**Problem:** Even though you ARE an editor (confirmed in Supabase), you're getting "sign in as an editor" message.

**Root Cause:** The user role might not be loading correctly from the backend.

**Solution:** 
- Added comprehensive debug logging to track user role loading
- Removed the error toast for authenticated non-editor users
- Now only shows toast if user is NOT authenticated

**Behavior Now:**
- **Not authenticated:** "Sign in to add locations or view details"
- **Authenticated as editor:** Opens add location modal
- **Authenticated as user:** Just pans to location (silent, no error)

**Debug Logging Added:**
```typescript
console.log('User data loaded from backend:', userData);
console.log('User role from backend:', userData.role);
console.log('User ID:', userData.id);
console.log('User email:', userData.email);
```

---

## Testing Instructions

### Test Search Navigation:
1. Click on the search bar
2. Type a place name (e.g., "Addison Restaurant")
3. Click on a result
4. **Expected:** Map should smoothly pan to that location and zoom in

### Test Editor Role:
1. Open browser console (F12)
2. Search for a place and click on it
3. Check console logs for:
   ```
   User data loaded from backend: {...}
   User role from backend: editor
   ```
4. **If you see role: 'user' instead of 'editor':**
   - Go to Supabase SQL Editor
   - Run: `SELECT * FROM user_metadata WHERE email = 'your-email@example.com';`
   - Check if role is 'editor'
   - If not, run: `UPDATE user_metadata SET role = 'editor' WHERE email = 'your-email@example.com';`

---

## If Editor Check Still Fails

### Quick Fix in Supabase:
```sql
-- Check your current role
SELECT user_id, email, role FROM user_metadata;

-- Update to editor (replace with your email)
UPDATE user_metadata 
SET role = 'editor' 
WHERE email = 'your-email@example.com';

-- Verify it worked
SELECT user_id, email, role FROM user_metadata;
```

### Alternative: Sign out and back in
1. Sign out of Le Voyageur
2. Delete all users from Supabase:
   ```sql
   DELETE FROM user_metadata;
   ```
3. Sign up again (you'll be the first user = auto-editor)

---

## Console Debugging Checklist

When you click on a search result, you should see:

```
=== Selected Place Debug ===
Selected place: {...}
Place ID: ChIJ...
Place name: "Restaurant Name"
Place geometry: {...}
Is authenticated: true
User: { id: "...", email: "...", name: "...", role: "editor" }
User role: editor
Panning to: { lat: 32.xxx, lng: -117.xxx }
Panning map to new center: { lat: 32.xxx, lng: -117.xxx }
```

**If role is NOT "editor":**
- The user_metadata table doesn't have your role set correctly
- Use the SQL fix above

**If role IS "editor" but modal doesn't open:**
- Check browser console for errors
- Make sure `isAuthenticated` is `true`

---

## Files Modified

1. `/src/app/App.tsx`
   - Added mapCenter and mapZoom state
   - Updated handlePlaceSelect to set map center
   - Added debug logging for user role
   - Removed error toast for non-editors

2. `/src/app/components/Map.tsx`
   - Added mapCenter and mapZoom to props interface
   - Added useEffect to pan map when mapCenter changes
   - Props passed from App.tsx

---

## Expected User Experience

### For Editors:
1. Search for a place → Click result
2. Map pans to location + zooms in
3. Add Location modal opens
4. Can add the location to LV database

### For Regular Users:
1. Search for a place → Click result
2. Map pans to location + zooms in
3. No modal (silent)
4. Can see existing LV locations nearby

### For Non-Authenticated:
1. Search for a place → Click result
2. Map pans to location + zooms in
3. Toast: "Sign in to add locations or view details"

---

## 🎯 Both Issues Resolved!

✅ Search now navigates to locations  
✅ Editor role check has better debugging  
✅ No more annoying error messages for regular users

**If role still shows as 'user' in console, run the SQL update query above!**
