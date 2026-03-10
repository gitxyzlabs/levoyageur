import { useEffect, useRef, useState, useMemo } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
import { Delaunay } from 'd3-delaunay';
import type { Location } from '@/utils/api';

interface HeatMapOverlayProps {
  locations: Location[];
  enabled: boolean;
}

// LV Score color scheme matching the app's design system
const getLVScoreColor = (score: number): string => {
  if (score >= 10) return '#7a1f35'; // Deep burgundy/maroon
  if (score >= 9) return '#8e2d54';  // Purple burgundy
  if (score >= 8) return '#a84848';  // Warm burgundy
  if (score >= 7) return '#c27d56';  // Terra cotta
  if (score >= 6) return '#d4936f';  // Warm terracotta
  if (score >= 5) return '#4a9ebb';  // Teal blue - for scores like 5.4
  if (score >= 4) return '#6bb8d6';  // Light blue
  if (score >= 3) return '#8fd3e8';  // Lighter blue
  return '#e5e7eb';                  // Light gray
};

// Get color with alpha channel for contours
const getColorWithAlpha = (score: number, alpha: number = 0.4): string => {
  const color = getLVScoreColor(score);
  const r = parseInt(color.slice(1, 3), 16);
  const g = parseInt(color.slice(3, 5), 16);
  const b = parseInt(color.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// Contour band thresholds (0-11 scale)
const CONTOUR_THRESHOLDS = [5, 6, 7, 8, 9, 10, 11];

export function HeatMapOverlay({ locations, enabled }: HeatMapOverlayProps) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const overlayRef = useRef<google.maps.OverlayView | null>(null);
  const [isRendering, setIsRendering] = useState(false);

  // Memoize valid locations to prevent unnecessary re-renders
  const validLocations = useMemo(() => {
    if (!enabled || locations.length === 0) return [];
    return locations.filter(
      loc => loc.lvEditorScore && loc.lvEditorScore > 0 && loc.lat && loc.lng
    );
  }, [locations, enabled]);

  // Create a stable key for the locations to detect actual changes
  const locationsKey = useMemo(() => {
    return validLocations
      .map(loc => `${loc.id}-${loc.lat}-${loc.lng}-${loc.lvEditorScore}`)
      .join('|');
  }, [validLocations]);

  useEffect(() => {
    if (!map || !enabled || validLocations.length === 0) {
      // Clean up overlay if disabled or no data
      if (overlayRef.current) {
        overlayRef.current.setMap(null);
        overlayRef.current = null;
      }
      return;
    }

    console.log(`🔥 Rendering heat map with ${validLocations.length} locations`);
    setIsRendering(true);

    // Create custom overlay
    class HeatMapCanvasOverlay extends google.maps.OverlayView {
      private canvas: HTMLCanvasElement;
      private locations: Location[];

      constructor(locations: Location[]) {
        super();
        this.locations = locations;
        this.canvas = document.createElement('canvas');
        this.canvas.style.position = 'absolute';
        this.canvas.style.pointerEvents = 'none'; // Allow map interactions
      }

      onAdd() {
        const panes = this.getPanes();
        if (panes) {
          panes.overlayLayer.appendChild(this.canvas);
        }
      }

      draw() {
        const projection = this.getProjection();
        const bounds = map.getBounds();
        
        if (!projection || !bounds) return;

        // Convert lat/lng to pixel coordinates first
        const points: Array<{ x: number; y: number; score: number }> = [];
        
        for (const loc of this.locations) {
          const latLng = new google.maps.LatLng(loc.lat!, loc.lng!);
          const pixel = projection.fromLatLngToDivPixel(latLng);
          
          if (pixel) {
            points.push({
              x: pixel.x,
              y: pixel.y,
              score: loc.lvEditorScore || 0
            });
          }
        }

        if (points.length === 0) return;

        // Calculate bounding box for all points with padding
        const padding = 800; // Extra padding to ensure coverage
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        points.forEach(p => {
          minX = Math.min(minX, p.x);
          minY = Math.min(minY, p.y);
          maxX = Math.max(maxX, p.x);
          maxY = Math.max(maxY, p.y);
        });

        minX -= padding;
        minY -= padding;
        maxX += padding;
        maxY += padding;

        const width = maxX - minX;
        const height = maxY - minY;

        // Set canvas size and position
        this.canvas.width = width;
        this.canvas.height = height;
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
        this.canvas.style.left = `${minX}px`;
        this.canvas.style.top = `${minY}px`;

        const ctx = this.canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Adjust points relative to canvas origin
        const adjustedPoints = points.map(p => ({
          x: p.x - minX,
          y: p.y - minY,
          score: p.score
        }));

        // Handle different cases based on number of points
        if (adjustedPoints.length === 1) {
          // Single point: draw radial gradient
          this.drawRadialGradient(ctx, adjustedPoints[0], width, height);
        } else if (adjustedPoints.length === 2) {
          // Two points: draw two radial gradients
          adjustedPoints.forEach(point => {
            this.drawRadialGradient(ctx, point, width, height);
          });
        } else {
          // Three or more points: use Delaunay triangulation
          this.drawDelaunayHeatMap(ctx, adjustedPoints, width, height);
        }
      }

      private drawRadialGradient(
        ctx: CanvasRenderingContext2D,
        point: { x: number; y: number; score: number },
        width: number,
        height: number
      ) {
        // Reduced radius by 50% for more precise gradients
        const maxRadius = 75; // pixels (was 150)
        
        const gradient = ctx.createRadialGradient(
          point.x, point.y, 0,
          point.x, point.y, maxRadius
        );

        gradient.addColorStop(0, getColorWithAlpha(point.score, 0.6));
        gradient.addColorStop(0.5, getColorWithAlpha(point.score, 0.3));
        gradient.addColorStop(1, getColorWithAlpha(point.score, 0));

        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
      }

      private drawDelaunayHeatMap(
        ctx: CanvasRenderingContext2D,
        points: Array<{ x: number; y: number; score: number }>,
        width: number,
        height: number
      ) {
        try {
          console.log(`Drawing heat map - Canvas size: ${width}x${height}`);
          console.log(`Points:`, points.map(p => ({ x: Math.round(p.x), y: Math.round(p.y), score: p.score })));
          
          // Reduced influence radius by 50% for more precise gradients
          const influenceRadius = 100; // pixels (was 200) - only show heat within 100px of a data point
          console.log(`Influence radius: ${influenceRadius}px`);
          
          // Use Inverse Distance Weighting (IDW) for better results with sparse distant points
          const gridSize = 20; // pixels per grid cell
          
          // Render each grid cell
          for (let y = 0; y < height; y += gridSize) {
            for (let x = 0; x < width; x += gridSize) {
              const interpolatedScore = this.interpolateIDW(x + gridSize / 2, y + gridSize / 2, points, 2, influenceRadius);
              
              if (interpolatedScore !== null) {
                ctx.fillStyle = getColorWithAlpha(interpolatedScore, 0.45);
                ctx.fillRect(x, y, gridSize, gridSize);
              }
            }
          }

          // LAYERED RENDERING: Sort points by score (lowest to highest)
          // This ensures higher scores are drawn on top and visually dominate
          const sortedPoints = [...points].sort((a, b) => a.score - b.score);
          
          // Reduced halo radius by 50% for more precise gradients
          const haloRadius = Math.min(75, influenceRadius * 0.75); // (was 150)
          
          sortedPoints.forEach(point => {
            // Higher scores get stronger opacity for visual dominance
            const baseOpacity = point.score >= 8 ? 0.85 : point.score >= 7 ? 0.75 : 0.7;
            const midOpacity = point.score >= 8 ? 0.5 : point.score >= 7 ? 0.4 : 0.3;
            
            const gradient = ctx.createRadialGradient(
              point.x, point.y, 0,
              point.x, point.y, haloRadius
            );
            gradient.addColorStop(0, getColorWithAlpha(point.score, baseOpacity));
            gradient.addColorStop(0.5, getColorWithAlpha(point.score, midOpacity));
            gradient.addColorStop(1, getColorWithAlpha(point.score, 0));
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(point.x, point.y, haloRadius, 0, Math.PI * 2);
            ctx.fill();
          });
        } catch (error) {
          console.error('Error drawing Delaunay heat map:', error);
          // Fallback to simple radial gradients
          points.forEach(point => {
            this.drawRadialGradient(ctx, point, width, height);
          });
        }
      }

      // Inverse Distance Weighting interpolation
      private interpolateIDW(
        x: number,
        y: number,
        points: Array<{ x: number; y: number; score: number }>,
        power: number = 2,
        maxDistance: number = 500 // pixels
      ): number | null {
        let weightSum = 0;
        let valueSum = 0;
        let hasNearbyPoint = false;

        for (const point of points) {
          const dx = x - point.x;
          const dy = y - point.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // Only influence within maxDistance
          if (distance > maxDistance) continue;

          hasNearbyPoint = true;

          // Handle points very close to data points
          if (distance < 1) {
            return point.score;
          }

          const weight = 1 / Math.pow(distance, power);
          weightSum += weight;
          valueSum += weight * point.score;
        }

        if (!hasNearbyPoint || weightSum === 0) {
          return null;
        }

        return valueSum / weightSum;
      }

      private getBarycentricCoords(
        px: number,
        py: number,
        p0: { x: number; y: number },
        p1: { x: number; y: number },
        p2: { x: number; y: number }
      ): { w0: number; w1: number; w2: number } | null {
        const v0x = p1.x - p0.x;
        const v0y = p1.y - p0.y;
        const v1x = p2.x - p0.x;
        const v1y = p2.y - p0.y;
        const v2x = px - p0.x;
        const v2y = py - p0.y;

        const den = v0x * v1y - v1x * v0y;
        if (Math.abs(den) < 0.0001) return null;

        const w1 = (v2x * v1y - v1x * v2y) / den;
        const w2 = (v0x * v2y - v2x * v0y) / den;
        const w0 = 1 - w1 - w2;

        // Check if point is inside triangle (with small epsilon for edge cases)
        const epsilon = -0.01;
        if (w0 >= epsilon && w1 >= epsilon && w2 >= epsilon) {
          return { w0, w1, w2 };
        }

        return null;
      }

      private drawContourLines(
        ctx: CanvasRenderingContext2D,
        delaunay: Delaunay<Delaunay.Point>,
        points: Array<{ x: number; y: number; score: number }>,
        width: number,
        height: number
      ) {
        // Draw contour lines at each threshold
        for (const threshold of CONTOUR_THRESHOLDS) {
          ctx.strokeStyle = getColorWithAlpha(threshold, 0.6);
          ctx.lineWidth = 1.5;
          ctx.setLineDash([4, 4]); // Dashed lines like topo maps

          // Check each triangle edge for contour crossings
          for (let i = 0; i < delaunay.triangles.length; i += 3) {
            const t0 = delaunay.triangles[i];
            const t1 = delaunay.triangles[i + 1];
            const t2 = delaunay.triangles[i + 2];

            const p0 = points[t0];
            const p1 = points[t1];
            const p2 = points[t2];

            // Check each edge for contour crossing
            this.drawContourSegment(ctx, p0, p1, threshold);
            this.drawContourSegment(ctx, p1, p2, threshold);
            this.drawContourSegment(ctx, p2, p0, threshold);
          }

          ctx.setLineDash([]); // Reset line dash
        }
      }

      private drawContourSegment(
        ctx: CanvasRenderingContext2D,
        p0: { x: number; y: number; score: number },
        p1: { x: number; y: number; score: number },
        threshold: number
      ) {
        // Check if contour line crosses this edge
        if ((p0.score < threshold && p1.score >= threshold) ||
            (p0.score >= threshold && p1.score < threshold)) {
          
          // Linear interpolation to find crossing point
          const t = (threshold - p0.score) / (p1.score - p0.score);
          const x = p0.x + t * (p1.x - p0.x);
          const y = p0.y + t * (p1.y - p0.y);

          // Draw small marker at crossing
          ctx.beginPath();
          ctx.arc(x, y, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      onRemove() {
        if (this.canvas.parentNode) {
          this.canvas.parentNode.removeChild(this.canvas);
        }
      }
    }

    // Create and add overlay
    const overlay = new HeatMapCanvasOverlay(validLocations);
    overlay.setMap(map);
    overlayRef.current = overlay;

    // Redraw on map changes
    const listeners = [
      google.maps.event.addListener(map, 'bounds_changed', () => {
        overlay.draw();
      }),
      google.maps.event.addListener(map, 'zoom_changed', () => {
        overlay.draw();
      })
    ];

    setIsRendering(false);

    // Cleanup
    return () => {
      listeners.forEach(listener => google.maps.event.removeListener(listener));
      overlay.setMap(null);
    };
  }, [map, enabled, locationsKey]);

  return null;
}