import { useState, useRef, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import { api } from '../../utils/api';
import type { Location } from '../../utils/api';
import { trackApiCall } from '../../utils/monitoring';

export type { Location };

/**
 * Owns the master locations list and the heat-map subset (from tag/text
 * search). filteredLocations is what the map should actually render: the
 * heat-map subset when one is active, otherwise everything.
 */
export function useLocations() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [heatMapLocations, setHeatMapLocations] = useState<Location[]>([]);
  const loadingRef = useRef(false); // prevents duplicate concurrent fetches

  const loadLocations = useCallback(async () => {
    if (loadingRef.current) {
      return;
    }

    loadingRef.current = true;

    try {
      const { locations: data } = await trackApiCall('getLocations', () => api.getLocations());
      setLocations(data);
    } catch (error: any) {
      console.error('Failed to load locations:', error);
      toast.error('Failed to load locations');
    } finally {
      loadingRef.current = false;
    }
  }, []);

  const filteredLocations = useMemo(() => {
    if (heatMapLocations.length > 0) {
      return heatMapLocations;
    }
    return locations;
  }, [locations, heatMapLocations]);

  return {
    locations,
    setLocations,
    heatMapLocations,
    setHeatMapLocations,
    loadLocations,
    filteredLocations,
  };
}
