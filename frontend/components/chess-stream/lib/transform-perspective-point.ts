/** Точка (x,y) в системе кадра → warped через perspective_matrix 3×3 (homography). */
export function transformPointToWarped(
  x: number,
  y: number,
  matrix: number[][],
): [number, number] | null {
  if (!matrix || matrix.length !== 3 || matrix[0].length !== 3) {
    return null;
  }
  const m = matrix;
  const w = m[2][0] * x + m[2][1] * y + m[2][2];
  if (Math.abs(w) < 1e-6) {
    return null;
  }
  const xWarped = (m[0][0] * x + m[0][1] * y + m[0][2]) / w;
  const yWarped = (m[1][0] * x + m[1][1] * y + m[1][2]) / w;
  return [xWarped, yWarped];
}
