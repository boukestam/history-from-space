uniform sampler2D heightTexture;

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

  float darkness = height < 0.0 ? 1.0 : (1.0 - (height / 5724.0 * 0.25));

  vec3 outColor = vec3(1.0, 1.0, 1.0) * darkness;

  gl_FragColor = vec4(outColor, 1.0);
}