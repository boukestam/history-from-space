import { MathUtils, Vector2, Vector3 } from "three";

export class Projection {
  center: Vector3;
  up: Vector3;
  right: Vector3;
  forward: Vector3;

  constructor(center: Vector3) {
    this.center = center;

    this.up = center.clone().normalize();

    // Find the right vector
    this.right = new Vector3()
      .crossVectors(this.up, new Vector3(0, 0, 1))
      .normalize();

    if (this.right.length() === 0) {
      this.right.crossVectors(this.up, new Vector3(0, 1, 0)).normalize();
    }

    // Find the forward vector
    this.forward = new Vector3().crossVectors(this.up, this.right).normalize();
  }

  project3DTo2D(point: Vector3): Vector3 {
    const delta = point.clone().sub(this.center);
    const x = delta.dot(this.right);
    const y = delta.dot(this.forward);
    return new Vector3(x, y, 0);
  }

  project2DTo3D(point: Vector3): Vector3 {
    const x = this.right.clone().multiplyScalar(point.x);
    const y = this.forward.clone().multiplyScalar(point.y);
    return this.center.clone().add(x).add(y).normalize();
  }
}

// Define the Robinson table as an array of Vector2
const robinsonTable: Vector2[] = [
  new Vector2(1.0, 0.0),
  new Vector2(0.9986, 0.062),
  new Vector2(0.9954, 0.124),
  new Vector2(0.99, 0.186),
  new Vector2(0.9822, 0.248),
  new Vector2(0.973, 0.31),
  new Vector2(0.96, 0.372),
  new Vector2(0.9427, 0.434),
  new Vector2(0.9216, 0.4958),
  new Vector2(0.8962, 0.5571),
  new Vector2(0.8679, 0.6176),
  new Vector2(0.835, 0.6769),
  new Vector2(0.7986, 0.7346),
  new Vector2(0.7597, 0.7903),
  new Vector2(0.7186, 0.8435),
  new Vector2(0.6732, 0.8936),
  new Vector2(0.6213, 0.9394),
  new Vector2(0.5722, 0.9761),
  new Vector2(0.5322, 1.0),
  new Vector2(0.506, 1.02),
  new Vector2(0.4958, 1.06),
];

// Robinson projection function
export function robinsonProjection(lat: number, lon: number): Vector2 {
  // Normalize latitude and longitude
  const absLat = Math.abs(lat);
  const lonRad = MathUtils.degToRad(lon); // Convert longitude to radians

  // Find the latitude index in the table
  let latIndex = Math.floor(absLat / 5.0); // Index for 5° increments
  const latFraction = (absLat % 5.0) / 5.0; // Fraction between table entries

  // Safeguard against out-of-bounds access for the table
  latIndex = MathUtils.clamp(latIndex, 0, 19);

  // Interpolate between the table entries
  const entry1 = robinsonTable[latIndex];
  const entry2 = robinsonTable[latIndex + 1];

  const xScale = MathUtils.lerp(entry1.x, entry2.x, latFraction);
  const yScale = MathUtils.lerp(entry1.y, entry2.y, latFraction);

  // Compute projected X and Y coordinates
  const x = xScale * lonRad;
  const y = yScale * Math.sign(lat);

  return new Vector2(x, y);
}
