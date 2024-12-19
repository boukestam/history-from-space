uniform sampler2DArray tempTexture;
uniform sampler2DArray precTexture;
uniform sampler2DArray iceTexture;
uniform sampler2D heightTexture;
uniform sampler2D featuresTexture;
uniform float sealevel;
uniform float climateYear;
uniform float iceYear;
uniform int visualisation;

varying vec2 vUv;

const int tempLength = 4656;
const int precLength = 2352;
const int totalLength = 11664;

const vec3 COLOR_SCALE[] = vec3[](
  vec3(39.0 / 255.0, 32.0 / 255.0, 100.0 / 255.0),    // < -30
  vec3(43.0 / 255.0, 55.0 / 255.0, 137.0 / 255.0),    // -28
  vec3(63.0 / 255.0, 85.0 / 255.0, 158.0 / 255.0),    // -24
  vec3(89.0 / 255.0, 116.0 / 255.0, 183.0 / 255.0),   // -20
  vec3(117.0 / 255.0, 143.0 / 255.0, 200.0 / 255.0),  // -16
  vec3(147.0 / 255.0, 171.0 / 255.0, 217.0 / 255.0),  // -12
  vec3(167.0 / 255.0, 195.0 / 255.0, 217.0 / 255.0),  // -8
  vec3(172.0 / 255.0, 209.0 / 255.0, 191.0 / 255.0),  // -4
  vec3(216.0 / 255.0, 221.0 / 255.0, 131.0 / 255.0),  // 0
  vec3(236.0 / 255.0, 215.0 / 255.0, 106.0 / 255.0),  // 4
  vec3(230.0 / 255.0, 179.0 / 255.0, 62.0 / 255.0),   // 8
  vec3(220.0 / 255.0, 147.0 / 255.0, 34.0 / 255.0),   // 12
  vec3(212.0 / 255.0, 115.0 / 255.0, 34.0 / 255.0),   // 16
  vec3(205.0 / 255.0, 87.0 / 255.0, 39.0 / 255.0),    // 20
  vec3(195.0 / 255.0, 67.0 / 255.0, 32.0 / 255.0),    // 24
  vec3(178.0 / 255.0, 43.0 / 255.0, 23.0 / 255.0),    // 28
  vec3(155.0 / 255.0, 16.0 / 255.0, 21.0 / 255.0),    // 32
  vec3(118.0 / 255.0, 15.0 / 255.0, 32.0 / 255.0),    // 36
  vec3(69.0 / 255.0, 5.0 / 255.0, 22.0 / 255.0)       // > 40
);

const vec3 waterColor = vec3(89.0 / 255.0, 176.0 / 255.0, 185.0 / 255.0);
const vec3 grassColor = vec3(150.0 / 255.0, 199.0 / 255.0, 107.0 / 255.0);
const vec3 forestColor = vec3(72.0 / 255.0, 177.0 / 255.0, 100.0 / 255.0);
const vec3 desertColor = vec3(224.0 / 255.0, 214.0 / 255.0, 143.0 / 255.0);
const vec3 lowMountainColor = vec3(205.0 / 255.0, 185.0 / 255.0, 154.0 / 255.0);
const vec3 mediumMountainColor = vec3(165.0 / 255.0, 145.0 / 255.0, 115.0 / 255.0);
const vec3 highMountainColor = vec3(125.0 / 255.0, 105.0 / 255.0, 90.0 / 255.0);
const vec3 mountainTopColor = vec3(210.0 / 255.0, 190.0 / 255.0, 190.0 / 255.0);
const vec3 snowColor = vec3(255.0 / 255.0, 255.0 / 255.0, 255.0 / 255.0);

vec4 sampleData(sampler2DArray tex, vec2 uv, float year) {
  vec4 sample1 = texture(tex, vec3(uv, floor(year)));
  vec4 sample2 = texture(tex, vec3(uv, ceil(year)));
  return mix(sample1, sample2, fract(year));
}

vec3 getTempColor(float temp) {
  int tempScaleIndex = int(floor(temp / 4.0)) + 9;
  tempScaleIndex = clamp(tempScaleIndex, 0, COLOR_SCALE.length() - 1);
  vec3 tempColor = COLOR_SCALE[tempScaleIndex];
  return tempColor;
}

vec3 getPrecColor(float prec) {
  int precScaleIndex = int(floor(prec / 2000.0 * float(COLOR_SCALE.length())));
  precScaleIndex = clamp(precScaleIndex, 0, COLOR_SCALE.length() - 1);
  vec3 precColor = COLOR_SCALE[precScaleIndex];
  return precColor;
}

vec3 slideColor(vec3 from, vec3 to, float value, float low, float high) {
  if (value < low) return from;
  if (value > high) return to;

  float ratio = (value - low) / (high - low);

  return mix(from, to, ratio);
}

void main() {
  vec4 heightColor = texture2D(heightTexture, vUv);
  float heightIntensity = heightColor.r * 255.0;

  // gl_FragColor = heightColor;
  // return;

  float height = 0.0;

  if (heightIntensity < 25.0) {
    height = -150.0 + (25.0 - heightIntensity) / 25.0 * -8714.0;
  } else if (heightIntensity <= 230.0) {
    height = heightIntensity - 175.0;
  } else {
    height = (heightIntensity - 230.0) / 25.0 * 5724.0;
  }

  vec4 featuresColor = texture2D(featuresTexture, vUv);
  float featuresIntensity = featuresColor.r;

  // Invert y axis
  vec2 uv = vec2(vUv.x + 0.5, 1.0 - vUv.y);

  vec4 tempSample = sampleData(tempTexture, uv, climateYear);
  float maxTemp = tempSample.r * 255.0 - 100.0;
  float minTemp = tempSample.g * 255.0 - 100.0;
  float precipitation = sampleData(precTexture, uv, climateYear).r * 255.0 * 10.0;
  float ice = sampleData(iceTexture, vUv, iceYear).r;

  vec3 outColor;

  if (height < sealevel) {
    float darkness = 1.0 - (height / -8714.0 * 0.25);
    outColor = waterColor * darkness;
  } else {
    float darkness = 1.0 - (height / 5724.0 * 0.25);

    vec3 color = slideColor(
      slideColor(snowColor, slideColor(desertColor, grassColor, precipitation, 250.0, 500.0), maxTemp, 5.0, 10.0),
      slideColor(
        slideColor(desertColor, grassColor, precipitation, 400.0, 1000.0),
        slideColor(grassColor, forestColor, precipitation, 1000.0, 2000.0),
        precipitation, 200.0, 1000.0
      ),
      maxTemp, 0.0, 10.0
    );

    outColor = color * darkness;
  }

  outColor = slideColor(outColor, waterColor, featuresIntensity, 0.0, 1.0);
  outColor = slideColor(outColor, snowColor, ice, 0.0, 0.1);

  if (visualisation == 1) {
    outColor = slideColor(outColor, getTempColor(maxTemp), 0.75, 0.0, 1.0);
  } else if (visualisation == 2) {
    outColor = slideColor(outColor, getTempColor(minTemp), 0.75, 0.0, 1.0);
  } else if (visualisation == 3) {
    outColor = slideColor(outColor, getPrecColor(precipitation), 0.75, 0.0, 1.0);
  }

  gl_FragColor = vec4(outColor, 1.0);
}