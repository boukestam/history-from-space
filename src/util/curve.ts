import { BufferAttribute, BufferGeometry, CatmullRomCurve3, Vector3 } from "three";
import { coordinateToVec3, vec3ToCoordinate } from "./coordinate";
import Delaunator from 'delaunator';
import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon";
import { polygon, point } from "@turf/helpers";
import { bbox } from "@turf/bbox";
import { Projection } from "./projection";

function uvAtPosition(position: Vector3) {
  const [lat, lon] = vec3ToCoordinate(position);
  const u = (lon + 180) / 360;
  const v = (lat + 90) / 180;
  return [u, v];
}

function createGeometry(vertices: number[]) {
  const uvs = [];

  for (let i = 0; i < vertices.length; i += 3) {
    const position = new Vector3(vertices[i], vertices[i + 1], vertices[i + 2]);
    const uv = uvAtPosition(position);
    uvs.push(uv[0], uv[1]);
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(vertices), 3));
  geometry.setAttribute("uv", new BufferAttribute(new Float32Array(uvs), 2));

  geometry.computeVertexNormals();

  return geometry;
}

export function generateSphere(radius: number, widthSegments: number, heightSegments: number) {
  const vertices: number[] = [];
  const indices: number[] = [];

  for (let y = 0; y <= heightSegments; y++) {
    for (let x = 0; x <= widthSegments; x++) {
      const u = x / widthSegments;
      const v = y / heightSegments;

      const theta = u * Math.PI * 2;
      const phi = v * Math.PI;

      const vertex = new Vector3(
        -radius * Math.cos(theta) * Math.sin(phi),
        radius * Math.cos(phi),
        radius * Math.sin(theta) * Math.sin(phi)
      );

      vertices.push(vertex.x, vertex.y, vertex.z);

      if (x < widthSegments && y < heightSegments) {
        const i = x + y * (widthSegments + 1);
        const j = x + (y + 1) * (widthSegments + 1);

        indices.push(i, j, j + 1);
        indices.push(i, j + 1, i + 1);
      }
    }
  }

  const geometry = createGeometry(vertices);
  geometry.setIndex(indices);

  return geometry;
}


export function curveToGeometry(curve: CatmullRomCurve3, radius: number, head: boolean, quality: number = 100) {
  const curveLength = curve.getLength();
  const curveSegments = Math.round(curveLength * quality);
  const segmentLength = curveLength / curveSegments;
  const curvePoints = curve.getPoints(curveSegments);

  const vertices: number[] = [];

  let previousTopLeft: Vector3 | undefined;
  let previousTopRight: Vector3 | undefined;

  const arrowHeadRadius = 0.03;
  const arrowHeadLength = 0.05;

  for (let i = 0; i < curvePoints.length - 1; i++) {
    const from = curvePoints[i];
    const to = curvePoints[i + 1];
    const next: Vector3 | undefined = curvePoints[i + 2];

    const forward = (next || to).clone().sub(from).normalize();
    const up = to.clone().normalize();
    const right = new Vector3().crossVectors(forward, up).normalize();

    const bottomLeft = previousTopLeft || from.clone().sub(right.clone().multiplyScalar(radius));
    const bottomRight = previousTopRight || from.clone().add(right.clone().multiplyScalar(radius));
    const topLeft = to.clone().sub(right.clone().multiplyScalar(radius));
    const topRight = to.clone().add(right.clone().multiplyScalar(radius));

    vertices.push(
      bottomLeft.x, bottomLeft.y, bottomLeft.z,
      bottomRight.x, bottomRight.y, bottomRight.z,
      topRight.x, topRight.y, topRight.z,

      bottomLeft.x, bottomLeft.y, bottomLeft.z,
      topRight.x, topRight.y, topRight.z,
      topLeft.x, topLeft.y, topLeft.z
    );

    // Arrow head
    if (head && i === curvePoints.length - 2) {
      // Remove the last part that overlaps
      const overlappingSegments = Math.floor(arrowHeadLength / segmentLength) - 1;
      vertices.splice(-18 * overlappingSegments, 18 * overlappingSegments);

      const headLength = forward.clone().multiplyScalar(arrowHeadLength);
      const headBase = to.clone().sub(headLength);
      const headSide = right.clone().multiplyScalar(arrowHeadRadius);

      const headTop = to;
      const headLeft = headBase.clone().sub(headSide);
      const headRight = headBase.clone().add(headSide);

      vertices.push(
        headLeft.x, headLeft.y, headLeft.z,
        headRight.x, headRight.y, headRight.z,
        headTop.x, headTop.y, headTop.z
      );
    }

    previousTopLeft = topLeft;
    previousTopRight = topRight;
  }

  const geometry = createGeometry(vertices);

  return { geometry, curvePoints };
}

export function outlineToTriangles(coordinates: [number, number][], step: number = 0.025) {
  const poly = polygon([coordinates]);
  const box = bbox(poly);
  const [minX, minY, maxX, maxY] = box;

  const points = coordinates.slice();

  for (let y = minY; y <= maxY; y += step) {
    for (let x = minX; x <= maxX; x += step) {
      if (booleanPointInPolygon(point([x, y]), poly)) {
        points.push([x, y]);
      }
    }
  }

  const delaunay = Delaunator.from(points);

  // Filter out triangles that are not part of the outline
  const indices = [];
  for (let i = 0; i < delaunay.triangles.length; i += 3) {
    const [c, b, a] = [delaunay.triangles[i], delaunay.triangles[i + 1], delaunay.triangles[i + 2]];
    const [x, y, z] = [points[a], points[b], points[c]];

    const middle = point([(x[0] + y[0] + z[0]) / 3, (x[1] + y[1] + z[1]) / 3]);
    if (booleanPointInPolygon(middle, poly)) {
      indices.push(a, b, c);
    }
  }

  return { points, indices, box };
}

export function areaToGeometry(coordinates: [number, number][]) {
  const outlinePoints = coordinates.map(([latitude, longitude]) => coordinateToVec3(latitude, longitude));
  const averagePoint = outlinePoints.reduce((total, point) => total.add(point), new Vector3()).divideScalar(outlinePoints.length);

  const projection = new Projection(averagePoint);
  const projectedPoints = outlinePoints.map(point => projection.project3DTo2D(point));

  const curve = new CatmullRomCurve3(projectedPoints, true);
  const curveLength = curve.getLength();
  const curveSegments = Math.round(curveLength * 200);
  const curvePoints = curve.getPoints(curveSegments);

  const { points, indices, box } = outlineToTriangles(curvePoints.map(p => [p.x, p.y]));

  const points3D = points.map(p => projection.project2DTo3D(new Vector3(p[0], p[1], 0)));

  // Debug draw triangles on a canvas
  // const canvas = document.createElement("canvas");
  // canvas.width = 1000;
  // canvas.height = 500;
  // document.body.appendChild(canvas);
  // const ctx = canvas.getContext("2d")!;
  // ctx.fillStyle = "black";
  // ctx.fillRect(0, 0, canvas.width, canvas.height);
  // ctx.strokeStyle = "white";
  // ctx.lineWidth = 1;
  // const scaleToCanvas = (point: [number, number]) => {
  //   const [x, y] = point;
  //   const [minX, minY, maxX, maxY] = box;
  //   const canvasX = (x - minX) / (maxX - minX) * canvas.width;
  //   const canvasY = (y - minY) / (maxY - minY) * canvas.height;
  //   return [canvasX, canvasY];
  // };
  // for (let i = 0; i < indices.length; i += 3) {
  //   const [a, b, c] = [indices[i], indices[i + 1], indices[i + 2]];
  //   const [x, y, z] = [points[a], points[b], points[c]];

  //   ctx.beginPath();
  //   ctx.moveTo(scaleToCanvas(x)[0], scaleToCanvas(x)[1]);
  //   ctx.lineTo(scaleToCanvas(y)[0], scaleToCanvas(y)[1]);
  //   ctx.lineTo(scaleToCanvas(z)[0], scaleToCanvas(z)[1]);
  //   ctx.closePath();
  //   ctx.stroke();
  // }
  // ctx.fillStyle = "red";
  // for (const point of points) {
  //   const [x, y] = scaleToCanvas(point);
  //   ctx.fillRect(x - 1, y - 1, 2, 2);
  // }

  const vertices = [];

  for (const i of indices) {
    const vertex = points3D[i];
    vertices.push(vertex.x, vertex.y, vertex.z);
  }

  const geometry = createGeometry(vertices);

  return { geometry, averagePoint };
}