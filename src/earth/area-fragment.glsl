uniform sampler2D heightTexture;
uniform sampler2D lakeMaskTexture;
uniform float sealevel;

uniform vec3 color;
uniform float transparency;

varying vec2 vUv;
varying vec3 vNormal;

void main() {
  vec4 heightColor = texture2D(heightTexture, vUv);
  float heightIntensity = heightColor.r * 255.0;

  float height = 0.0;

  if (heightIntensity < 25.0) {
    height = -150.0 + (25.0 - heightIntensity) / 25.0 * -8714.0;
  } else if (heightIntensity <= 230.0) {
    height = heightIntensity - 175.0;
  } else {
    height = (heightIntensity - 230.0) / 25.0 * 5724.0;
  }

  vec4 lakeMaskColor = texture2D(lakeMaskTexture, vUv);
  bool noLake = lakeMaskColor.r > 0.5;
  bool yesLake = lakeMaskColor.g > 0.5;

  if ((height < sealevel && !noLake) || (height < 0.0 && yesLake)) {
    gl_FragColor = vec4(0.0, 0.0, 0.0, 0.0);
  } else {
    gl_FragColor = vec4(color, transparency);
  }
}