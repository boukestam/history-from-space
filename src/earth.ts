import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/Addons.js';
import { fetchClimate, getSeaLevel, getClimateYear, getIceYear } from './climate';

import vertexShader from './vertex.glsl?raw';
import fragmentShader from './fragment.glsl?raw';
import { coordinateToVec3, vec3ToCoordinate } from './coordinate';

export interface EarthItem {
  remove: () => void;
}

export async function initEarth(
  wrapper: HTMLDivElement,
  year: number,
  onClick: (coordinate: [number, number], button: number) => void
) {
  const bounds = wrapper.getBoundingClientRect();

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
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

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(45, bounds.width / bounds.height, 0.01, 10);

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
  const loader = new THREE.TextureLoader();
  const heightTexture = await loader.loadAsync("/height.png");
  const normalTexture = await loader.loadAsync("/normal.png");
  const climate = await fetchClimate();

  heightTexture.magFilter = THREE.LinearFilter;
  heightTexture.minFilter = THREE.LinearFilter;
  heightTexture.wrapS = THREE.RepeatWrapping;
  heightTexture.wrapT = THREE.RepeatWrapping;
  heightTexture.needsUpdate = true;

  normalTexture.magFilter = THREE.LinearFilter;
  normalTexture.minFilter = THREE.LinearFilter;
  normalTexture.wrapS = THREE.RepeatWrapping;
  normalTexture.wrapT = THREE.RepeatWrapping;
  normalTexture.needsUpdate = true;

  const geometry = new THREE.SphereGeometry(1, 720, 360);
  //const geometry = new THREE.PlaneGeometry(2, 1, 720, 360);

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms: {
      heightTexture: { value: heightTexture },
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

  const earth = new THREE.Mesh(geometry, material);
  scene.add(earth);

  // Add ambient light
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
  scene.add(ambientLight);

  // Add directional light
  const sun = new THREE.DirectionalLight(0xffffff, 3);
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

  const raycaster = new THREE.Raycaster();
  const earthSphere = new THREE.Sphere(new THREE.Vector3(), 1);

  function getLatLon(position: THREE.Vector2): THREE.Vector2 | undefined {
    // Set the raycaster based on camera and screen position
    raycaster.setFromCamera(position, camera);

    // Check for intersections with the globe
    const intersection = raycaster.ray.intersectSphere(earthSphere, new THREE.Vector3());
    if (intersection) {
      const coordinate = vec3ToCoordinate(intersection);
      return new THREE.Vector2(coordinate[0], coordinate[1]);
    }
  }

  let cameraCoordinate = getLatLon(new THREE.Vector2(0, 0))!;
  let targetCoordinate: THREE.Vector2 | undefined;

  function animate() {
    if (!targetCoordinate) return;

    const current = getLatLon(new THREE.Vector2(0, 0))!;
    const target = targetCoordinate;

    const delta = target.clone().sub(current).multiplyScalar(0.1);

    cameraCoordinate = current.clone().add(delta);

    // Update camera position
    const position = coordinateToVec3(cameraCoordinate.x, cameraCoordinate.y);
    const cameraDistance = camera.position.length();
    camera.position.copy(position).multiplyScalar(cameraDistance);
    camera.lookAt(new THREE.Vector3());

    render();

    if (delta.length() < 0.01) {
      targetCoordinate = undefined;
      return;
    }

    requestAnimationFrame(animate);
  }

  controls.addEventListener("change", () => {
    const coordinate = getLatLon(new THREE.Vector2(0, 0))!;
    cameraCoordinate = coordinate;
    targetCoordinate = undefined;

    onControlChange();
    render();
  });

  let mouseDown: THREE.Vector2 | undefined;

  function getNormalisedMouse(event: MouseEvent) {
    const rect = renderer.domElement.getBoundingClientRect();

    const mouse = new THREE.Vector2();

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

  function addLabel(label: string, position: THREE.Vector3) {
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

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const size = canvas.height / 1400;
    const ratio = canvas.width / canvas.height;

    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
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

    // Latitude and longitude are in degrees
    addMarker: (coordinate: [number, number], text: string) => {
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.01, 32, 32),
        new THREE.MeshBasicMaterial({ color: 0x000000 })
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
      const curve = new THREE.CatmullRomCurve3(
        coordinates.map(([latitude, longitude]) => coordinateToVec3(latitude, longitude).multiplyScalar(1.01))
      );
      const curveLength = curve.getLength();
      const curveSegments = Math.round(curveLength * 100);
      const segmentLength = curveLength / curveSegments;
      const curvePoints = curve.getPoints(curveSegments);

      const vertices: number[] = [];

      let previousTopLeft: THREE.Vector3 | undefined;
      let previousTopRight: THREE.Vector3 | undefined;

      const arrowRadius = 0.01;
      const arrowHeadRadius = 0.03;
      const arrowHeadLength = 0.05;

      for (let i = 0; i < curvePoints.length - 1; i++) {
        const from = curvePoints[i];
        const to = curvePoints[i + 1];
        const next: THREE.Vector3 | undefined = curvePoints[i + 2];

        const forward = (next || to).clone().sub(from).normalize();
        const up = to.clone().normalize();
        const right = new THREE.Vector3().crossVectors(forward, up).normalize();

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

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(vertices), 3));
      geometry.computeVertexNormals();

      const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
      const arrow = new THREE.Mesh(geometry, material);
      scene.add(arrow);

      let label: THREE.Sprite | undefined;

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

    setTarget: (coordinate: [number, number]) => {
      targetCoordinate = new THREE.Vector2(coordinate[0], coordinate[1]);
      animate();
    }
  };
}

export type Earth = Awaited<ReturnType<typeof initEarth>>;