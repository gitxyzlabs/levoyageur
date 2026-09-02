import { useEffect, useRef, useState, useMemo } from 'react';
import { useMap } from '@vis.gl/react-google-maps';
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

// Real-world radius of influence for each point, in meters (~75 miles). Using a real-world
// distance rather than a fixed pixel radius keeps the heat map's geographic footprint
// consistent across zoom levels — a sparse set of points shouldn't blanket a whole continent
// just because the map is zoomed out. Sized generously so that with sparse data (a handful of
// points spread across a country), nearby-ish points still blend into a connected surface
// instead of rendering as isolated islands with dead gaps between them.
const HEAT_SIGMA_METERS = 120000;

// Standard Web Mercator meters-per-pixel at a given zoom/latitude (256px tiles)
const metersPerPixel = (latitude: number, zoom: number): number => {
  return (156543.03392 * Math.cos((latitude * Math.PI) / 180)) / Math.pow(2, zoom);
};

// Score values (0-11 scale) at which to draw contour lines, like elevation bands on a topo map
const CONTOUR_THRESHOLDS = [4, 5, 6, 7, 8, 9, 10, 11];

interface WeightedPoint {
  x: number;
  y: number;
  score: number;
}

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

        // Convert the real-world influence radius to pixels at the current zoom/latitude
        // so the heat map's footprint stays geographically consistent as the user zooms.
        const center = map.getCenter();
        const zoom = map.getZoom();
        const sigmaPixels =
          center && zoom !== undefined
            ? HEAT_SIGMA_METERS / metersPerPixel(center.lat(), zoom)
            : 90; // fallback if zoom/center briefly unavailable

        // Topographic-style density-weighted rendering for any number of points
        this.drawTopographicHeatMap(ctx, adjustedPoints, width, height, sigmaPixels);
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

      // Topographic rendering: each sample's "elevation" (score) is a density-weighted
      // average of nearby points (Gaussian kernel), and its opacity reflects how much data
      // supports that reading. This means a cluster of points pulls the local average toward
      // their combined score, and a single outlier point can't outweigh a nearby cluster —
      // its contribution is just one term in the weighted average, not a dominant overlay.
      // The field is sampled on a coarse grid, then upscaled with bilinear smoothing (instead
      // of flat-filled cells) so it reads as a continuous surface, with true contour lines
      // (marching squares) traced on top for the topo-map look.
      private drawTopographicHeatMap(
        ctx: CanvasRenderingContext2D,
        points: WeightedPoint[],
        width: number,
        height: number,
        sigmaPixels: number
      ) {
        try {
          if (width <= 0 || height <= 0) return;

          // Floor sigma so points don't vanish to sub-pixel size when zoomed far out
          const sigma = Math.max(sigmaPixels, 15);
          const maxDistance = sigma * 2.5; // cutoff for performance; negligible weight beyond this
          const cellSize = 20; // sampling spacing in pixels
          const maxAlpha = 0.55;

          const cols = Math.max(2, Math.floor(width / cellSize) + 1);
          const rows = Math.max(2, Math.floor(height / cellSize) + 1);

          // Bucket points spatially so each sample only checks nearby points instead of all
          // of them — keeps this fast as the number of data points grows.
          const buckets = this.buildSpatialBuckets(points, maxDistance);

          const scores = new Float32Array(cols * rows).fill(NaN);
          const confidences = new Float32Array(cols * rows);

          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const x = Math.min(c * cellSize, width);
              const y = Math.min(r * cellSize, height);
              const nearby = this.nearbyPoints(buckets, x, y, maxDistance);
              const result = this.gaussianWeightedScore(x, y, nearby, sigma, maxDistance);

              if (result) {
                const idx = r * cols + c;
                scores[idx] = result.score;
                confidences[idx] = result.confidence;
              }
            }
          }

          this.paintSmoothedField(ctx, scores, confidences, cols, rows, width, height, maxAlpha);
          this.drawContours(ctx, scores, cols, rows, cellSize);
        } catch (error) {
          console.error('Error drawing topographic heat map:', error);
          // Fallback to simple radial gradients
          points.forEach(point => {
            this.drawRadialGradient(ctx, point, width, height);
          });
        }
      }

      // Bins points into a uniform grid of buckets sized to the search radius, so a 3x3
      // neighborhood lookup is guaranteed to find every point within that radius.
      private buildSpatialBuckets(
        points: WeightedPoint[],
        bucketSize: number
      ): Map<string, WeightedPoint[]> {
        const buckets = new Map<string, WeightedPoint[]>();
        for (const point of points) {
          const key = `${Math.floor(point.x / bucketSize)},${Math.floor(point.y / bucketSize)}`;
          const bucket = buckets.get(key);
          if (bucket) {
            bucket.push(point);
          } else {
            buckets.set(key, [point]);
          }
        }
        return buckets;
      }

      private nearbyPoints(
        buckets: Map<string, WeightedPoint[]>,
        x: number,
        y: number,
        bucketSize: number
      ): WeightedPoint[] {
        const cx = Math.floor(x / bucketSize);
        const cy = Math.floor(y / bucketSize);
        const result: WeightedPoint[] = [];

        for (let dx = -1; dx <= 1; dx++) {
          for (let dy = -1; dy <= 1; dy++) {
            const bucket = buckets.get(`${cx + dx},${cy + dy}`);
            if (bucket) result.push(...bucket);
          }
        }

        return result;
      }

      // Gaussian-kernel density-weighted average: each nearby point contributes a score
      // weighted by proximity. `confidence` is the summed weight, i.e. how much nearby data
      // backs this sample up — a lone close point yields confidence near 1, while a cluster of
      // points stacks confidence above 1, producing a stronger/more saturated reading.
      private gaussianWeightedScore(
        x: number,
        y: number,
        points: WeightedPoint[],
        sigma: number,
        maxDistance: number
      ): { score: number; confidence: number } | null {
        let weightSum = 0;
        let valueSum = 0;

        for (const point of points) {
          const dx = x - point.x;
          const dy = y - point.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance > maxDistance) continue;

          const weight = Math.exp(-(distance * distance) / (2 * sigma * sigma));
          weightSum += weight;
          valueSum += weight * point.score;
        }

        if (weightSum === 0) return null;

        return { score: valueSum / weightSum, confidence: weightSum };
      }

      // Renders the sampled field to a tiny offscreen canvas (one pixel per sample), then
      // scales it up with bilinear smoothing — this is what turns a coarse grid of samples
      // into a continuous-looking gradient instead of visible flat-filled squares, without
      // having to compute the Gaussian sum at every screen pixel.
      private paintSmoothedField(
        ctx: CanvasRenderingContext2D,
        scores: Float32Array,
        confidences: Float32Array,
        cols: number,
        rows: number,
        width: number,
        height: number,
        maxAlpha: number
      ) {
        const offscreen = document.createElement('canvas');
        offscreen.width = cols;
        offscreen.height = rows;
        const offCtx = offscreen.getContext('2d');
        if (!offCtx) return;

        const imageData = offCtx.createImageData(cols, rows);

        for (let i = 0; i < cols * rows; i++) {
          const score = scores[i];
          const idx = i * 4;

          if (Number.isNaN(score)) {
            imageData.data[idx + 3] = 0; // no data here — fully transparent
            continue;
          }

          const color = getLVScoreColor(score);
          imageData.data[idx] = parseInt(color.slice(1, 3), 16);
          imageData.data[idx + 1] = parseInt(color.slice(3, 5), 16);
          imageData.data[idx + 2] = parseInt(color.slice(5, 7), 16);
          imageData.data[idx + 3] = Math.round(Math.min(confidences[i], 1) * maxAlpha * 255);
        }

        offCtx.putImageData(imageData, 0, 0);

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(offscreen, 0, 0, cols, rows, 0, 0, width, height);
      }

      // Traces contour lines through the sampled field via marching squares: for each cell of
      // the sample grid, find where each threshold crosses the 4 surrounding edges and connect
      // those crossing points. Adjacent cells share edge points, so the segments chain into
      // continuous lines — the actual topo-map effect the earlier per-triangle-dot code never
      // achieved (it only plotted isolated dots at crossings, never connected them).
      private drawContours(
        ctx: CanvasRenderingContext2D,
        scores: Float32Array,
        cols: number,
        rows: number,
        cellSize: number
      ) {
        const interpolate = (v0: number, v1: number, p0: number, p1: number, threshold: number) =>
          p0 + ((threshold - v0) / (v1 - v0)) * (p1 - p0);

        ctx.lineWidth = 1;
        ctx.setLineDash([]);

        for (const threshold of CONTOUR_THRESHOLDS) {
          ctx.strokeStyle = getColorWithAlpha(threshold, 0.5);
          ctx.beginPath();

          for (let r = 0; r < rows - 1; r++) {
            for (let c = 0; c < cols - 1; c++) {
              const tl = scores[r * cols + c];
              const tr = scores[r * cols + c + 1];
              const bl = scores[(r + 1) * cols + c];
              const br = scores[(r + 1) * cols + c + 1];

              if (Number.isNaN(tl) || Number.isNaN(tr) || Number.isNaN(bl) || Number.isNaN(br)) {
                continue;
              }

              const x0 = c * cellSize;
              const y0 = r * cellSize;
              const x1 = (c + 1) * cellSize;
              const y1 = (r + 1) * cellSize;

              const crossings: Array<{ x: number; y: number }> = [];

              if ((tl < threshold) !== (tr < threshold)) {
                crossings.push({ x: interpolate(tl, tr, x0, x1, threshold), y: y0 });
              }
              if ((tr < threshold) !== (br < threshold)) {
                crossings.push({ x: x1, y: interpolate(tr, br, y0, y1, threshold) });
              }
              if ((bl < threshold) !== (br < threshold)) {
                crossings.push({ x: interpolate(bl, br, x0, x1, threshold), y: y1 });
              }
              if ((tl < threshold) !== (bl < threshold)) {
                crossings.push({ x: x0, y: interpolate(tl, bl, y0, y1, threshold) });
              }

              // The common case is exactly 2 crossings (the contour passes straight through);
              // 4 crossings is the rare saddle case, paired up as an acceptable approximation.
              if (crossings.length === 2) {
                ctx.moveTo(crossings[0].x, crossings[0].y);
                ctx.lineTo(crossings[1].x, crossings[1].y);
              } else if (crossings.length === 4) {
                ctx.moveTo(crossings[0].x, crossings[0].y);
                ctx.lineTo(crossings[1].x, crossings[1].y);
                ctx.moveTo(crossings[2].x, crossings[2].y);
                ctx.lineTo(crossings[3].x, crossings[3].y);
              }
            }
          }

          ctx.stroke();
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