import { Vector3 } from "three";

export class Projection {

  center: Vector3;
  up: Vector3;
  right: Vector3;
  forward: Vector3;

  constructor(center: Vector3) {
    this.center = center;

    this.up = center.clone().normalize();

    // Find the right vector
    this.right = new Vector3().crossVectors(this.up, new Vector3(0, 0, 1)).normalize();

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