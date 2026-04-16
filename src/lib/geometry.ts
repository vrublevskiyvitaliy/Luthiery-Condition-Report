
/**
 * Geometry utilities for line and area regularization.
 */

export interface Point {
  x: number;
  y: number;
}

/**
 * Regularizes a path (crack) toward a straight line between its endpoints.
 * @param points Flat array of coordinates [x1, y1, x2, y2, ...]
 * @param factor 0 (original) to 1 (perfectly straight)
 */
export function regularizePath(points: number[], factor: number): number[] {
  if (points.length < 4 || factor === 0) return points;

  const startX = points[0];
  const startY = points[1];
  const endX = points[points.length - 2];
  const endY = points[points.length - 1];

  const result = [];
  const numPoints = points.length / 2;

  for (let i = 0; i < numPoints; i++) {
    const px = points[i * 2];
    const py = points[i * 2 + 1];

    // Target is a point linearly interpolated between start and end
    const t = i / (numPoints - 1);
    const qx = startX + t * (endX - startX);
    const qy = startY + t * (endY - startY);

    // Interpolate original to target
    result.push(px + (qx - px) * factor);
    result.push(py + (qy - py) * factor);
  }

  return result;
}

/**
 * Regularizes a closed area toward an ellipse.
 * @param points Flat array of coordinates [x1, y1, x2, y2, ...]
 * @param factor 0 (original) to 1 (perfect ellipse)
 */
export function regularizeArea(points: number[], factor: number): number[] {
  if (points.length < 6 || factor === 0) return points;

  // Calculate bounding box and center
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  const numPoints = points.length / 2;
  
  for (let i = 0; i < numPoints; i++) {
    const x = points[i * 2];
    const y = points[i * 2 + 1];
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const radiusX = (maxX - minX) / 2;
  const radiusY = (maxY - minY) / 2;

  // Handle cases where the area has no width or height
  if (radiusX <= 0 || radiusY <= 0) return points;

  const result = [];

  for (let i = 0; i < numPoints; i++) {
    const px = points[i * 2];
    const py = points[i * 2 + 1];

    const dx = px - centerX;
    const dy = py - centerY;
    
    // Target is a point on the ellipse at the same angle from the center
    // Special case for center point
    if (dx === 0 && dy === 0) {
      result.push(px);
      result.push(py);
      continue;
    }

    // Find intersection with ellipse (x/a)^2 + (y/b)^2 = 1
    const t = 1 / Math.sqrt(Math.pow(dx / radiusX, 2) + Math.pow(dy / radiusY, 2));
    
    const qx = centerX + t * dx;
    const qy = centerY + t * dy;

    // Interpolate original to target
    result.push(px + (qx - px) * factor);
    result.push(py + (qy - py) * factor);
  }

  return result;
}
