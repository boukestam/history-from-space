import { OrbitControls } from 'three/examples/jsm/Addons.js';
import { fetchClimate, getSeaLevel, getClimateYear, getIceYear } from './climate';

import vertexShader from './vertex.glsl?raw';
import fragmentShader from './fragment.glsl?raw';
import { coordinateToVec3, vec3ToCoordinate } from './coordinate';
import { WebGLRenderer } from 'three/src/renderers/WebGLRenderer.js';
import { AmbientLight, BufferAttribute, LinearFilter, PerspectiveCamera, Scene, SRGBColorSpace, TextureLoader, BufferGeometry, CanvasTexture, CatmullRomCurve3, DirectionalLight, Mesh, MeshBasicMaterial, MeshStandardMaterial, Raycaster, RepeatWrapping, ShaderMaterial, Sphere, SphereGeometry, Sprite, SpriteMaterial, Vector2, Vector3 } from 'three/src/Three.WebGPU.js';
import { Earcut } from 'three/src/extras/Earcut.js';

export interface EarthItem {
  remove: () => void;
}

export async function initEarth(
  wrapper: HTMLDivElement,
  year: number,
  onClick: (coordinate: [number, number], button: number) => void
) {
  const bounds = wrapper.getBoundingClientRect();

  const renderer = new WebGLRenderer({ antialias: true });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setSize(bounds.width, bounds.height);
  renderer.setPixelRatio(window.devicePixelRatio);
  wrapper.appendChild(renderer.domElement);

  window.addEventListener("resize", () => {
    const bounds = wrapper.getBoundingClientRect();
    renderer.setSize(bounds.width, bounds.height);
    camera.aspect = bounds.width / bounds.height;
    camera.updateProjectionMatrix();
    render();
  });

  const scene = new Scene();

  const camera = new PerspectiveCamera(45, bounds.width / bounds.height, 0.01, 10);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.enablePan = false;

  // Load camera position from local storage for development
  const cameraPosition = localStorage.getItem("camera");
  if (cameraPosition) {
    camera.position.copy(JSON.parse(cameraPosition));
  } else {
    camera.position.set(0, 0, 3);
  }
  controls.update();

  // Add terrain
  const loader = new TextureLoader();
  const heightTexture = await loader.loadAsync("height.png");
  const featuresTexture = await loader.loadAsync("features.png");
  const normalTexture = await loader.loadAsync("normal.png");
  const climate = await fetchClimate();

  heightTexture.magFilter = LinearFilter;
  heightTexture.minFilter = LinearFilter;
  heightTexture.wrapS = RepeatWrapping;
  heightTexture.wrapT = RepeatWrapping;
  heightTexture.needsUpdate = true;

  featuresTexture.magFilter = LinearFilter;
  featuresTexture.minFilter = LinearFilter;
  featuresTexture.wrapS = RepeatWrapping;
  featuresTexture.wrapT = RepeatWrapping;
  featuresTexture.needsUpdate = true;

  normalTexture.magFilter = LinearFilter;
  normalTexture.minFilter = LinearFilter;
  normalTexture.wrapS = RepeatWrapping;
  normalTexture.wrapT = RepeatWrapping;
  normalTexture.needsUpdate = true;

  const geometry = new SphereGeometry(1, 720, 360);
  //const geometry = new PlaneGeometry(2, 1, 720, 360);

  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      heightTexture: { value: heightTexture },
      featuresTexture: { value: featuresTexture },
      normalTexture: { value: normalTexture },
      tempTexture: { value: climate.climateTextures.temp },
      precTexture: { value: climate.climateTextures.prec },
      iceTexture: { value: climate.climateTextures.ice },
      sealevel: { value: getSeaLevel(climate, year) },
      climateYear: { value: getClimateYear(climate, year) },
      iceYear: { value: getIceYear(climate, year) },
      visualisation: { value: 0 },
    }
  });

  const earth = new Mesh(geometry, material);
  scene.add(earth);

  // Add ambient light
  const ambientLight = new AmbientLight(0xffffff, 0.75);
  scene.add(ambientLight);

  // Add directional light
  const sun = new DirectionalLight(0xffffff, 3);
  sun.target = earth;
  scene.add(sun);

  function onControlChange() {
    // Store camera position in local storage for development
    localStorage.setItem("camera", JSON.stringify(camera.position));

    const dx = camera.position.x - earth.position.x;
    const dz = camera.position.z - earth.position.z;

    const angleBetweenCameraAndEarth = Math.atan2(dz, dx);
    const angleBetweenSunAndEarth = angleBetweenCameraAndEarth - 1;

    sun.position.set(
      Math.cos(angleBetweenSunAndEarth) * 3,
      0,
      Math.sin(angleBetweenSunAndEarth) * 3,
    );
    sun.target.position.set(0, 0, 0);
  }

  function render() {
    renderer.render(scene, camera);
  }

  render();

  const raycaster = new Raycaster();
  const earthSphere = new Sphere(new Vector3(), 1);

  function getLatLon(position: Vector2): Vector2 | undefined {
    // Set the raycaster based on camera and screen position
    raycaster.setFromCamera(position, camera);

    // Check for intersections with the globe
    const intersection = raycaster.ray.intersectSphere(earthSphere, new Vector3());
    if (intersection) {
      const coordinate = vec3ToCoordinate(intersection);
      return new Vector2(coordinate[0], coordinate[1]);
    }
  }

  let cameraCoordinate = getLatLon(new Vector2(0, 0))!;
  let targetCoordinate: Vector2 | undefined;

  function animate() {
    if (!targetCoordinate) return;

    const current = getLatLon(new Vector2(0, 0))!;
    const target = targetCoordinate;

    const delta = target.clone().sub(current).multiplyScalar(0.1);

    cameraCoordinate = current.clone().add(delta);

    // Update camera position
    const position = coordinateToVec3(cameraCoordinate.x, cameraCoordinate.y);
    const cameraDistance = camera.position.length();
    camera.position.copy(position).multiplyScalar(cameraDistance);
    camera.lookAt(new Vector3());

    render();

    if (delta.length() < 0.01) {
      targetCoordinate = undefined;
      return;
    }

    requestAnimationFrame(animate);
  }

  controls.addEventListener("change", () => {
    const coordinate = getLatLon(new Vector2(0, 0))!;
    cameraCoordinate = coordinate;
    targetCoordinate = undefined;

    onControlChange();
    render();
  });

  let mouseDown: Vector2 | undefined;

  function getNormalisedMouse(event: MouseEvent) {
    const rect = renderer.domElement.getBoundingClientRect();

    const mouse = new Vector2();

    // Normalize mouse position to [-1, 1]
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    return mouse;
  }

  renderer.domElement.addEventListener("mousedown", (event) => {
    mouseDown = getNormalisedMouse(event);
  });

  renderer.domElement.addEventListener("mouseup", (event) => {
    const mouse = getNormalisedMouse(event);

    if (mouseDown && mouse.distanceTo(mouseDown) > 0.01) {
      mouseDown = undefined;
      return;
    }

    const coordinate = getLatLon(mouse);
    if (coordinate) onClick([coordinate.x, coordinate.y], event.button);
  });

  function addLabel(label: string, position: Vector3) {
    const lines = label.split("\n");

    const canvas = document.createElement("canvas");

    const fontSize = 48;

    const ctx = canvas.getContext("2d")!;
    ctx.font = fontSize + "px Tahoma";
    ctx.lineWidth = 4;

    const textSizes = lines.map(line => ctx.measureText(line));
    canvas.width = Math.max(...textSizes.map(t => t.width)) + 20;
    canvas.height = fontSize * lines.length + fontSize / 2;

    ctx.font = fontSize + "px Tahoma";
    ctx.lineWidth = fontSize / 6;
    ctx.textAlign = "center";
    ctx.strokeStyle = "black";
    ctx.fillStyle = "white";

    for (let i = 0; i < lines.length; i++) {
      ctx.strokeText(lines[i], canvas.width / 2, fontSize * i + fontSize);
      ctx.fillText(lines[i], canvas.width / 2, fontSize * i + fontSize);
    }

    const texture = new CanvasTexture(canvas);
    texture.needsUpdate = true;

    const size = canvas.height / 1400;
    const ratio = canvas.width / canvas.height;

    const sprite = new Sprite(new SpriteMaterial({ map: texture }));
    sprite.scale.set(size * ratio, size, 1);
    sprite.position.copy(position).multiplyScalar(1.05);
    scene.add(sprite);

    return sprite;
  }

  return {
    clean: () => {
      wrapper.removeChild(renderer.domElement);

      renderer.dispose();
    },

    setYear: (year: number) => {
      material.uniforms.climateYear.value = getClimateYear(climate, year + 1);
      material.uniforms.iceYear.value = getIceYear(climate, year);
      material.uniforms.sealevel.value = getSeaLevel(climate, year);

      render();
    },

    setVisualisation: (visualisation: number) => {
      material.uniforms.visualisation.value = visualisation;

      render();
    },

    setTarget: (coordinate: [number, number]) => {
      targetCoordinate = new Vector2(coordinate[0], coordinate[1]);
      animate();
    },

    // Latitude and longitude are in degrees
    addMarker: (coordinate: [number, number], text: string) => {
      const marker = new Mesh(
        new SphereGeometry(0.01, 32, 32),
        new MeshBasicMaterial({ color: 0x000000 })
      );

      marker.position.copy(coordinateToVec3(coordinate[0], coordinate[1]));

      scene.add(marker);

      const label = addLabel(text, marker.position);

      render();

      return {
        marker,
        label,
        remove: () => {
          scene.remove(marker);
          scene.remove(label);

          render();
        }
      };
    },

    addArrow: (coordinates: [number, number][], text?: string) => {
      const curve = new CatmullRomCurve3(
        coordinates.map(([latitude, longitude]) => coordinateToVec3(latitude, longitude).multiplyScalar(1.01))
      );
      const curveLength = curve.getLength();
      const curveSegments = Math.round(curveLength * 100);
      const segmentLength = curveLength / curveSegments;
      const curvePoints = curve.getPoints(curveSegments);

      const vertices: number[] = [];

      let previousTopLeft: Vector3 | undefined;
      let previousTopRight: Vector3 | undefined;

      const arrowRadius = 0.01;
      const arrowHeadRadius = 0.03;
      const arrowHeadLength = 0.05;

      for (let i = 0; i < curvePoints.length - 1; i++) {
        const from = curvePoints[i];
        const to = curvePoints[i + 1];
        const next: Vector3 | undefined = curvePoints[i + 2];

        const forward = (next || to).clone().sub(from).normalize();
        const up = to.clone().normalize();
        const right = new Vector3().crossVectors(forward, up).normalize();

        const bottomLeft = previousTopLeft || from.clone().sub(right.clone().multiplyScalar(arrowRadius));
        const bottomRight = previousTopRight || from.clone().add(right.clone().multiplyScalar(arrowRadius));
        const topLeft = to.clone().sub(right.clone().multiplyScalar(arrowRadius));
        const topRight = to.clone().add(right.clone().multiplyScalar(arrowRadius));

        vertices.push(
          bottomLeft.x, bottomLeft.y, bottomLeft.z,
          bottomRight.x, bottomRight.y, bottomRight.z,
          topRight.x, topRight.y, topRight.z,

          bottomLeft.x, bottomLeft.y, bottomLeft.z,
          topRight.x, topRight.y, topRight.z,
          topLeft.x, topLeft.y, topLeft.z
        );

        // Arrow head
        if (i === curvePoints.length - 2) {
          // Remove the last part that overlaps
          const overlappingSegments = Math.floor(arrowHeadLength / segmentLength) - 2;
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

      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new BufferAttribute(new Float32Array(vertices), 3));
      geometry.computeVertexNormals();

      const material = new MeshStandardMaterial({ color: 0xff0000 });
      const arrow = new Mesh(geometry, material);
      scene.add(arrow);

      let label: Sprite | undefined;

      if (text) {
        const middle = curvePoints[Math.floor(curvePoints.length / 2)];
        label = addLabel(text, middle);
      }

      render();

      return {
        arrow,
        label,
        remove: () => {
          scene.remove(arrow);
          if (label) scene.remove(label);

          render();
        }
      };
    },

    addArea: (coordinates: [number, number][], text?: string) => {
      const points = coordinates.map(([latitude, longitude]) => coordinateToVec3(latitude, longitude).multiplyScalar(1.01));

      const curve = new CatmullRomCurve3(points, true);
      const curveLength = curve.getLength();
      const curveSegments = Math.round(curveLength * 100);
      const curvePoints = curve.getPoints(curveSegments);

      const averagePoint = new Vector3();
      for (const point of points) {
        averagePoint.add(point);
      }
      averagePoint.divideScalar(points.length);
      const normal = averagePoint.clone().normalize();

      const project2D = (point: Vector3): Vector2 => {
        const projected = point.clone().sub(averagePoint).projectOnPlane(normal);
        return new Vector2(projected.x, projected.y);
      };

      const project3D = (point: Vector2): Vector3 => {
        const projected = new Vector3(point.x, point.y, 0);
        return projected.add(averagePoint);
      };

      const projectedPoints = curvePoints.map(project2D);

      const indices = Earcut.triangulate(projectedPoints.flatMap(p => [p.x, p.y]), [], 2);
      const triangles: number[] = indices.flatMap(i => [curvePoints[i].x, curvePoints[i].y, curvePoints[i].z]);

      for (let i = 0; i < triangles.length; i += 9) {
        const triangleNormal = new Vector3(
          triangles[i + 3] - triangles[i],
          triangles[i + 4] - triangles[i + 1],
          triangles[i + 5] - triangles[i + 2]
        ).cross(new Vector3(
          triangles[i + 6] - triangles[i],
          triangles[i + 7] - triangles[i + 1],
          triangles[i + 8] - triangles[i + 2]
        )).normalize();

        // Check if normal is pointing in the right direction
        if (triangleNormal.dot(normal) < 0) {
          // Reverse the order of the vertices
          let temp = triangles[i + 3];
          triangles[i + 3] = triangles[i + 6];
          triangles[i + 6] = temp;

          temp = triangles[i + 4];
          triangles[i + 4] = triangles[i + 7];
          triangles[i + 7] = temp;

          temp = triangles[i + 5];
          triangles[i + 5] = triangles[i + 8];
          triangles[i + 8] = temp;
        }
      }

      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new BufferAttribute(new Float32Array(triangles), 3));
      geometry.computeVertexNormals();

      const material = new MeshStandardMaterial({ color: 0xff0000, opacity: 0.5, transparent: true });
      const area = new Mesh(geometry, material);
      scene.add(area);

      let label: Sprite | undefined;

      if (text) {
        const middle = curvePoints[Math.floor(curvePoints.length / 2)];
        label = addLabel(text, middle);
      }

      render();

      return {
        area,
        label,
        remove: () => {
          scene.remove(area);
          if (label) scene.remove(label);

          render();
        }
      };
    }
  };
}

export type Earth = Awaited<ReturnType<typeof initEarth>>;