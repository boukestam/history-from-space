uniform sampler2D heightTexture;
uniform float sealevel;

varying vec2 vUv;

void main() {
  vec4 color = texture2D(heightTexture, uv);
  float intensity = color.r * 255.0;

  float height = 0.0;

  if (intensity > 230.0) {
    height = (intensity - 230.0) / 25.0 * 5724.0;
  }

  vec3 newPosition = position + normal * height * 0.000002;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);

  vUv = uv; // Pass UV to fragment shader
}