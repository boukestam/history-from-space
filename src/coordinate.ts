import { Vector3 } from "three/src/math/Vector3.js";

export function coordinateToVec3(latitude: number, longitude: number) {
  const latitudeRad = latitude * Math.PI / 180;
  const longitudeRad = -longitude * Math.PI / 180;

  return new Vector3(
    Math.cos(latitudeRad) * Math.cos(longitudeRad),
    Math.sin(latitudeRad),
    Math.cos(latitudeRad) * Math.sin(longitudeRad),
  );
}

export function vec3ToCoordinate(point: Vector3): [number, number] {
  const latitude = Math.asin(point.y / 1) * (180 / Math.PI);
  const longitude = -Math.atan2(point.z, point.x) * (180 / Math.PI);

  return [latitude, longitude];
}

export function getCoordinateCenter(coordinates: [number, number][]): [number, number] {
  const vec3s = coordinates.map(([latitude, longitude]) => coordinateToVec3(latitude, longitude));
  const center = vec3s.reduce((a, b) => a.add(b), new Vector3()).normalize();
  return vec3ToCoordinate(center);
}