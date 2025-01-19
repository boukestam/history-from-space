import { fetchClimate, getSeaLevel, getClimateYear, getIceYear, FetchClimateResult } from '../climate';
import { coordinateToVec3, vec3ToCoordinate } from '../util/coordinate';
import { OrbitControls } from 'three/examples/jsm/Addons.js';
import { WebGLRenderer, LinearFilter, PerspectiveCamera, Scene, SRGBColorSpace, TextureLoader, CatmullRomCurve3, DirectionalLight, Mesh, MeshBasicMaterial, MeshStandardMaterial, Raycaster, RepeatWrapping, ShaderMaterial, Sphere, SphereGeometry, Vector2, Vector3, Texture } from 'three';
import { areaToGeometry, curveToGeometry, generateSphere } from '../util/curve';

import earthVertexShader from './earth-vertex.glsl?raw';
import earthFragmentShader from './earth-fragment.glsl?raw';
import riverFragmentShader from './river-fragment.glsl?raw';
import areaFragmentShader from './area-fragment.glsl?raw';
import arrowFragmentShader from './arrow-fragment.glsl?raw';
import iceFragmentShader from './ice-fragment.glsl?raw';
import { showInfo } from '../info';

export interface EarthItem {
  remove: () => void;
}

export interface EarthMarker extends EarthItem {
  marker: Mesh;
  label: EarthLabel;
}

export interface EarthArrow extends EarthItem {
  coordinates: [number, number][];
  arrow: Mesh;
  label?: EarthLabel;
}

export interface EarthArea extends EarthItem {
  coordinates: [number, number][];
  area: Mesh;
  label?: EarthLabel;
}

export interface EarthLabel {
  element: HTMLDivElement;
  position: Vector3;
  height: number;
}

const ABOVE_TERRAIN = 1.003;

const MIN_CAMERA_DISTANCE = 1.25;
const MAX_CAMERA_DISTANCE = 5;

const AREA_COLORS = [
  new Vector3(229 / 255, 57 / 255, 53 / 255),
  new Vector3(216 / 255, 27 / 255, 96 / 255),
  new Vector3(142 / 255, 36 / 255, 170 / 255),
  new Vector3(94 / 255, 53 / 255, 177 / 255),
  new Vector3(57 / 255, 73 / 255, 171 / 255),
  new Vector3(0 / 255, 172 / 255, 193 / 255),
  new Vector3(0 / 255, 137 / 255, 123 / 255),
  new Vector3(255 / 255, 179 / 255, 0 / 255),
  new Vector3(251 / 255, 140 / 255, 0 / 255),
  new Vector3(244 / 255, 81 / 255, 30 / 255),
];

export function getAreaColor(name: string) {
  const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AREA_COLORS[hash % AREA_COLORS.length];
}

function setTextureParameters(texture: Texture) {
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.needsUpdate = true;
}

export class Earth {

  wrapper: HTMLDivElement;
  overlay: HTMLDivElement;
  year: number;
  onClick: (coordinate: [number, number], button: number) => void;

  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  controls: OrbitControls;
  bounds: DOMRect;

  labels: EarthLabel[] = [];
  arrows: EarthArrow[] = [];
  areas: EarthArea[] = [];

  earth: Mesh;

  earthMaterial: ShaderMaterial;
  riverMaterial: ShaderMaterial;
  arrowMaterial: ShaderMaterial;
  iceMaterial: ShaderMaterial;

  climate!: FetchClimateResult;
  heightTexture!: Texture;
  lakeMaskTexture!: Texture;
  starsTexture!: Texture;

  raycaster = new Raycaster();
  earthSphere = new Sphere(new Vector3(), 1);

  cameraCoordinate: Vector2;
  targetCoordinate: Vector2 | undefined;

  mouseDown: Vector2 | undefined;

  projectionBlend: number = 0;

  iceMeshes: Mesh[][] = [];
  existingIceMeshes: Mesh[] = [];

  constructor(
    wrapper: HTMLDivElement,
    overlay: HTMLDivElement,
    year: number,
    onClick: (coordinate: [number, number], button: number) => void
  ) {
    this.wrapper = wrapper;
    this.overlay = overlay;
    this.year = year;
    this.onClick = onClick;

    this.bounds = this.wrapper.getBoundingClientRect();

    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.outputColorSpace = SRGBColorSpace;
    this.renderer.setSize(this.bounds.width, this.bounds.height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.wrapper.appendChild(this.renderer.domElement);

    window.addEventListener("resize", () => {
      this.bounds = this.wrapper.getBoundingClientRect();
      this.renderer.setSize(this.bounds.width, this.bounds.height);
      this.camera.aspect = this.bounds.width / this.bounds.height;
      this.camera.updateProjectionMatrix();
      this.render();
    });

    this.scene = new Scene();

    this.camera = new PerspectiveCamera(45, this.bounds.width / this.bounds.height, 0.01, 100);
    this.cameraCoordinate = this.getLatLon(new Vector2(0, 0))!;

    this.controls = new OrbitControls(this.camera, this.overlay);
    this.controls.enablePan = false;
    this.controls.enableDamping = false;

    // Load camera position from local storage for development
    const cameraPosition = localStorage.getItem("camera");
    if (cameraPosition) {
      const { position, blend } = JSON.parse(cameraPosition);
      this.camera.position.copy(position);
      this.projectionBlend = blend;
    } else {
      this.camera.position.set(0, 0, 3);
    }

    this.controls.target.set(0, 0, 0);
    this.controls.update();

    const geometry = generateSphere(1, 720, 360);
    //const geometry = new PlaneGeometry(2, 1, 720, 360);

    this.earthMaterial = new ShaderMaterial({
      vertexShader: earthVertexShader,
      fragmentShader: earthFragmentShader
    });

    this.earth = new Mesh(geometry, this.earthMaterial);
    this.scene.add(this.earth);

    this.riverMaterial = new ShaderMaterial({
      vertexShader: earthVertexShader,
      fragmentShader: riverFragmentShader,
    });

    this.arrowMaterial = new ShaderMaterial({
      vertexShader: earthVertexShader,
      fragmentShader: arrowFragmentShader,
      uniforms: {
        color: { value: new Vector3(229 / 255, 57 / 255, 53 / 255) },
        transparency: { value: 0.8 },
        projectionBlend: { value: this.projectionBlend }
      },
      transparent: true,
      depthWrite: true,
      depthTest: false
    });

    this.iceMaterial = new ShaderMaterial({
      vertexShader: earthVertexShader,
      fragmentShader: iceFragmentShader,
      uniforms: {
        projectionBlend: { value: this.projectionBlend }
      },
      depthWrite: true,
      depthTest: false
    });

    this.initControls();
  }

  async load() {
    const loader = new TextureLoader();

    const result = await Promise.all([
      loader.loadAsync("height.png"),
      loader.loadAsync("lake-mask.png"),
      loader.loadAsync("stars.jpg"),
      fetchClimate()
    ]);

    this.heightTexture = result[0];
    this.lakeMaskTexture = result[1];
    this.starsTexture = result[2];
    this.climate = result[3];

    setTextureParameters(this.heightTexture);
    setTextureParameters(this.lakeMaskTexture);
    setTextureParameters(this.starsTexture);

    // Create stars

    this.starsTexture.colorSpace = SRGBColorSpace;
    this.starsTexture.needsUpdate = true;

    const starsMaterial = new MeshBasicMaterial({
      map: this.starsTexture,
      side: 2,
      depthTest: false,
      depthWrite: false
    });

    const stars = new Mesh(generateSphere(1, 100, 50), starsMaterial);
    stars.scale.setScalar(100);
    stars.renderOrder = -1;
    this.scene.add(stars);

    // Create materials

    this.earthMaterial.uniforms = {
      heightTexture: { value: this.heightTexture },
      lakeMaskTexture: { value: this.lakeMaskTexture },
      tempTexture: { value: this.climate.climateTextures.temp },
      precTexture: { value: this.climate.climateTextures.prec },
      sealevel: { value: getSeaLevel(this.climate, this.year) },
      climateYear: { value: getClimateYear(this.climate, this.year) },
      visualisation: { value: 0 },
      projectionBlend: { value: this.projectionBlend }
    };
    this.earthMaterial.needsUpdate = true;

    this.riverMaterial.uniforms = {
      heightTexture: { value: this.heightTexture },
      sealevel: { value: getSeaLevel(this.climate, this.year) },
      projectionBlend: { value: this.projectionBlend }
    };

    this.arrowMaterial.uniforms.heightTexture = { value: this.heightTexture };
    this.iceMaterial.uniforms.heightTexture = { value: this.heightTexture };

    this.initRivers();

    // Create ice meshes

    this.iceMeshes = this.climate.iceGeometries.map(geometries =>
      geometries.map(geometry => new Mesh(geometry, this.iceMaterial))
    );

    this.updateIce();

    this.render();
  }

  initRivers() {
    // Create rivers
    for (const river of this.climate.rivers) {
      const curve = new CatmullRomCurve3(
        river.map(([latitude, longitude]) => coordinateToVec3(latitude, longitude).multiplyScalar(ABOVE_TERRAIN))
      );

      const { geometry } = curveToGeometry(curve, 0.0005, false, 1000);

      const riverMesh = new Mesh(geometry, this.riverMaterial);
      this.scene.add(riverMesh);
    }
  }

  updateIce() {
    const iceYear = Math.floor(getIceYear(this.climate, this.year));

    for (const existing of this.existingIceMeshes) {
      this.scene.remove(existing);
    }

    this.existingIceMeshes = [];

    for (const mesh of this.iceMeshes[iceYear]) {
      this.scene.add(mesh);
      this.existingIceMeshes.push(mesh);
    }
  }

  saveView() {
    // Store camera position in local storage for development
    localStorage.setItem("camera", JSON.stringify({
      position: this.camera.position,
      blend: this.projectionBlend
    }));

    // const dx = this.camera.position.x - this.earth.position.x;
    // const dz = this.camera.position.z - this.earth.position.z;

    // const angleBetweenCameraAndEarth = Math.atan2(dz, dx);
    // const angleBetweenSunAndEarth = angleBetweenCameraAndEarth - 1;

    // this.sun.position.set(
    //   Math.cos(angleBetweenSunAndEarth) * 3,
    //   0,
    //   Math.sin(angleBetweenSunAndEarth) * 3,
    // );
    // this.sun.target.position.set(0, 0, 0);
  }

  addLabel(text: string, position: Vector3, info?: Document): EarthLabel {
    const oc = "rgba(0, 0, 0, 0.5)";
    const os = 1.5;
    const ob = 1.5;

    const element = document.createElement("div");
    element.innerHTML = text.replace(/\n/g, "<br>");
    element.style.position = "absolute";
    element.style.textAlign = "center";
    element.style.color = "white";
    element.style.lineHeight = "1.2";
    element.style.textShadow = `-${os}px -${os}px ${ob}px ${oc},${os}px -${os}px ${ob}px ${oc}, -${os}px ${os}px ${ob}px ${oc}, ${os}px ${os}px ${ob}px ${oc},-${os}px 0px ${ob}px ${oc},${os}px 0px ${ob}px ${oc},0px -${os}px ${ob}px ${oc},0px  ${os}px ${ob}px ${oc}`;
    element.style.transform = "translate(-50%, -50%)";
    this.overlay.appendChild(element);

    if (info) {
      element.style.cursor = "pointer";

      element.addEventListener("mousedown", (e) => {
        showInfo(text, info);
        e.stopPropagation();
        e.preventDefault();
      }, false);
    } else {
      element.style.pointerEvents = "none";
      element.style.userSelect = "none";
      element.style.touchAction = "none";
    }

    const label = { element, position, height: text.split("\n").length * 20 };
    this.labels.push(label);

    return label;
  }

  removeLabel(label: EarthLabel) {
    this.overlay.removeChild(label.element);
    this.labels.splice(this.labels.indexOf(label), 1);
  }

  updateLabels() {
    const cameraNormal = this.camera.position.clone().normalize();

    this.camera.updateMatrixWorld();

    const calculatedLabels: { x: number, y: number, label: EarthLabel, show: boolean }[] = [];

    // Update labels
    for (const label of this.labels) {
      // Check if label is behind the earth
      const labelNormal = label.position.clone().normalize();
      const dot = cameraNormal.dot(labelNormal);
      if (dot < 0) {
        calculatedLabels.push({ x: 0, y: 0, label, show: false });
        continue;
      }

      const position = label.position.clone().project(this.camera);
      let x = (position.x + 1) / 2 * this.bounds.width;
      let y = (1 - position.y) / 2 * this.bounds.height;

      calculatedLabels.push({ x, y, label, show: true });
    }

    for (let i = 0; i < calculatedLabels.length; i++) {
      if (!calculatedLabels[i].show) continue;

      for (let j = i + 1; j < calculatedLabels.length; j++) {
        if (!calculatedLabels[j].show) continue;

        const label1 = calculatedLabels[i];
        const label2 = calculatedLabels[j];

        const dx = label2.x - label1.x;
        if (Math.abs(dx) > 100) continue;

        const dy = label2.y - label1.y;

        const minDistance = (label1.label.height + label2.label.height) / 2;

        if (dy >= 0 && dy < minDistance) {
          const shift = (minDistance - dy) / 2;
          label1.y -= shift;
          label2.y += shift;
        } else if (dy <= 0 && dy > -minDistance) {
          const shift = (minDistance + dy) / 2;
          label1.y += shift;
          label2.y -= shift;
        }
      }
    }

    for (const { x, y, label, show } of calculatedLabels) {
      if (!show) {
        label.element.style.display = "none";
        continue;
      } else {
        label.element.style.display = "block";
      }

      label.element.style.left = `${x}px`;
      label.element.style.top = `${y}px`;
    }
  }

  render() {
    this.updateLabels();

    this.renderer.render(this.scene, this.camera);
  }

  getLatLon(position: Vector2): Vector2 | undefined {
    // Set the raycaster based on camera and screen position
    this.raycaster.setFromCamera(position, this.camera);

    // Check for intersections with the globe
    const intersection = this.raycaster.ray.intersectSphere(this.earthSphere, new Vector3());
    if (intersection) {
      const coordinate = vec3ToCoordinate(intersection);
      return new Vector2(coordinate[0], coordinate[1]);
    }
  }

  animate() {
    if (!this.targetCoordinate) return;

    const current = this.getLatLon(new Vector2(0, 0))!;
    const target = this.targetCoordinate;

    const delta = target.clone().sub(current).multiplyScalar(0.1);

    this.cameraCoordinate = current.clone().add(delta);

    // Update camera position
    const position = coordinateToVec3(this.cameraCoordinate.x, this.cameraCoordinate.y);
    const cameraDistance = this.camera.position.length();
    this.camera.position.copy(position).multiplyScalar(cameraDistance);
    this.camera.lookAt(new Vector3());

    this.render();

    if (delta.length() < 0.01) {
      this.targetCoordinate = undefined;
      return;
    }

    requestAnimationFrame(() => this.animate());
  }

  getNormalisedMouse(event: MouseEvent) {
    const rect = this.overlay.getBoundingClientRect();

    const mouse = new Vector2();

    // Normalize mouse position to [-1, 1]
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    return mouse;
  }

  initControls() {
    this.controls.addEventListener("change", () => {
      const coordinate = this.getLatLon(new Vector2(0, 0))!;
      this.cameraCoordinate = coordinate;
      this.targetCoordinate = undefined;

      const cameraDistance = this.camera.position.length();
      if (cameraDistance < MIN_CAMERA_DISTANCE) {
        this.camera.position.setLength(MIN_CAMERA_DISTANCE);
      } else if (cameraDistance > MAX_CAMERA_DISTANCE) {
        this.camera.position.setLength(MAX_CAMERA_DISTANCE);
      }

      this.controls.rotateSpeed = (this.camera.position.length() - 1) / 2;
      this.controls.zoomSpeed = (this.camera.position.length() - 1) / 2;

      this.saveView();
      this.render();
    });

    this.overlay.addEventListener("mousedown", (event) => {
      this.mouseDown = this.getNormalisedMouse(event);
    });

    this.overlay.addEventListener("mouseup", (event) => {
      const mouse = this.getNormalisedMouse(event);

      if (this.mouseDown && mouse.distanceTo(this.mouseDown) > 0.01) {
        this.mouseDown = undefined;
        return;
      }

      const coordinate = this.getLatLon(mouse);
      if (coordinate) this.onClick([coordinate.x, coordinate.y], event.button);
    });
  }

  clean() {
    this.wrapper.removeChild(this.renderer.domElement);

    this.renderer.dispose();
  }

  setYear(year: number) {
    this.year = year;

    const sealevel = getSeaLevel(this.climate, year);

    this.earthMaterial.uniforms.climateYear.value = getClimateYear(this.climate, year + 1);
    this.earthMaterial.uniforms.sealevel.value = sealevel;

    this.riverMaterial.uniforms.sealevel.value = sealevel;

    for (const area of this.areas) {
      (area.area.material as ShaderMaterial).uniforms.sealevel.value = sealevel;
    }

    this.updateIce();

    this.render();
  }

  setVisualisation(visualisation: number) {
    this.earthMaterial.uniforms.visualisation.value = visualisation;

    this.render();
  }

  setTarget(coordinate: [number, number]) {
    this.targetCoordinate = new Vector2(coordinate[0], coordinate[1]);
    this.animate();
  }

  setProjectionBlend(projectionBlend: number) {
    this.projectionBlend = projectionBlend;

    this.earthMaterial.uniforms.projectionBlend.value = projectionBlend;
    this.riverMaterial.uniforms.projectionBlend.value = projectionBlend;
    this.arrowMaterial.uniforms.projectionBlend.value = projectionBlend;
    this.iceMaterial.uniforms.projectionBlend.value = projectionBlend;

    for (const area of this.areas) {
      (area.area.material as ShaderMaterial).uniforms.projectionBlend.value = projectionBlend;
    }

    this.saveView();
    this.render();
  }

  // Latitude and longitude are in degrees
  addMarker(coordinate: [number, number], text: string, info?: Document): EarthMarker {
    const marker = new Mesh(
      new SphereGeometry(0.005, 32, 32),
      new MeshBasicMaterial({ color: 0x000000 })
    );

    marker.position.copy(coordinateToVec3(coordinate[0], coordinate[1]));

    this.scene.add(marker);

    const label = this.addLabel(text, marker.position, info);

    this.render();

    return {
      marker,
      label,
      remove: () => {
        this.scene.remove(marker);
        this.removeLabel(label);

        this.render();
      }
    };
  }

  addArrow(coordinates: [number, number][], text?: string, info?: Document): EarthArrow {
    const curve = new CatmullRomCurve3(
      coordinates.map(([latitude, longitude]) => coordinateToVec3(latitude, longitude).multiplyScalar(ABOVE_TERRAIN))
    );

    const { geometry, curvePoints } = curveToGeometry(curve, 0.01, true);

    const arrowMesh = new Mesh(geometry, this.arrowMaterial);
    arrowMesh.renderOrder = 999;

    this.scene.add(arrowMesh);

    let label: EarthLabel | undefined;

    if (text) {
      const middle = curvePoints[Math.floor(curvePoints.length / 2)];
      label = this.addLabel(text, middle, info);
    }

    this.render();

    const arrow = {
      coordinates,
      arrow: arrowMesh,
      label,
      remove: () => {
        this.scene.remove(arrowMesh);
        if (label) this.removeLabel(label);

        this.render();

        const index = this.arrows.indexOf(arrow);
        if (index !== -1) this.arrows.splice(index, 1);
      }
    };

    this.arrows.push(arrow);

    return arrow;
  }

  addArea(
    coordinates: [number, number][],
    text?: string,
    info?: Document,
    control?: {
      index: number;
    }
  ): EarthArea {
    const { geometry, averagePoint } = areaToGeometry(coordinates);

    const color = getAreaColor(text || "Area");
    const material = new ShaderMaterial({
      vertexShader: earthVertexShader,
      fragmentShader: areaFragmentShader,
      uniforms: {
        color: { value: color },
        transparency: { value: 0.5 },
        heightTexture: { value: this.heightTexture },
        lakeMaskTexture: { value: this.lakeMaskTexture },
        sealevel: { value: getSeaLevel(this.climate, this.year) },
        projectionBlend: { value: this.projectionBlend }
      },
      transparent: true,
      depthWrite: false,
      depthTest: false
    });

    const areaMesh = new Mesh(geometry, material);
    areaMesh.renderOrder = 999;

    this.scene.add(areaMesh);

    let label: EarthLabel | undefined;
    if (text) {
      label = this.addLabel(text, averagePoint, info);
    }

    // Show control points
    let points: Mesh[] | undefined;
    if (control) {
      points = coordinates.map(([latitude, longitude], i) => {
        const point = new Mesh(
          new SphereGeometry(0.001, 32, 32),
          new MeshBasicMaterial({
            color: i === control.index ? 0xffffff : 0x000000,
            depthTest: false
          })
        );

        point.position.copy(coordinateToVec3(latitude, longitude).multiplyScalar(ABOVE_TERRAIN));
        this.scene.add(point);

        return point;
      });
    }

    this.render();

    const area = {
      coordinates,
      area: areaMesh,
      label,
      points,
      remove: () => {
        this.scene.remove(areaMesh);
        if (label) this.removeLabel(label);
        if (points) points.forEach(point => this.scene.remove(point));

        this.render();

        const index = this.areas.indexOf(area);
        if (index !== -1) this.areas.splice(index, 1);
      }
    };

    this.areas.push(area);

    return area;
  }
}