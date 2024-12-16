import * as THREE from 'three';

export function imageToImageData(image: HTMLImageElement) {
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;

  const context = canvas.getContext('2d')!;
  context.drawImage(image, 0, 0);

  return context.getImageData(0, 0, image.width, image.height);
}

export function createImageData(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d')!;
  return context.createImageData(width, height);
}

export function imageDataToTexture(imageData: ImageData) {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;

  const context = canvas.getContext('2d')!;
  context.putImageData(imageData, 0, 0);

  const texture = new THREE.Texture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  return texture;
}

export function createDataTexture(data: Float32Array) {
  const size = Math.ceil(Math.sqrt(data.length));
  const texture = new THREE.DataTexture(data, size, size, THREE.RedFormat, THREE.FloatType);
  texture.needsUpdate = true;
  return texture;
}