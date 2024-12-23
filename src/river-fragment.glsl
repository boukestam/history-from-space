uniform sampler2D heightTexture;
uniform float sealevel;

varying vec2 vUv;

const vec3 seaColor = vec3(89.0 / 255.0, 176.0 / 255.0, 185.0 / 255.0);
const vec3 riverColor = vec3(97.0 / 255.0, 183.0 / 255.0, 157.0 / 255.0);

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

  if (height < sealevel) {
    float darkness = 1.0 - (height / -8714.0 * 0.25);
    gl_FragColor = vec4(seaColor * darkness, 1.0);
  } else {
    float darkness = 1.0 - (height / 5724.0 * 0.25);
    gl_FragColor = vec4(riverColor * darkness, 1.0);
  }
}