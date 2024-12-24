uniform float projectionBlend;

varying vec2 vUv;
varying vec3 vNormal;

const vec2 robinsonTable[21] = vec2[](
  vec2(1.0000, 0.0000),
  vec2(0.9986, 0.0620),
  vec2(0.9954, 0.1240),
  vec2(0.9900, 0.1860),
  vec2(0.9822, 0.2480),
  vec2(0.9730, 0.3100),
  vec2(0.9600, 0.3720),
  vec2(0.9427, 0.4340),
  vec2(0.9216, 0.4958),
  vec2(0.8962, 0.5571),
  vec2(0.8679, 0.6176),
  vec2(0.8350, 0.6769),
  vec2(0.7986, 0.7346),
  vec2(0.7597, 0.7903),
  vec2(0.7186, 0.8435),
  vec2(0.6732, 0.8936),
  vec2(0.6213, 0.9394),
  vec2(0.5722, 0.9761),
  vec2(0.5322, 1.0000),
  vec2(0.5060, 1.0200),
  vec2(0.4958, 1.0600)
);

vec2 robinsonProjection(float lat, float lon) {
  // Normalize latitude and longitude
  float absLat = abs(lat);
  float lonRad = radians(lon); // Convert longitude to radians

  // Find the latitude index in the table
  int latIndex = int(absLat / 5.0); // Index for 5° increments
  float latFraction = mod(absLat, 5.0) / 5.0; // Fraction between table entries

  // Safeguard against out-of-bounds access for the table
  latIndex = clamp(latIndex, 0, 19);

  // Interpolate between the table entries
  vec2 entry1 = robinsonTable[latIndex];
  vec2 entry2 = robinsonTable[latIndex + 1]; // Safe because latIndex < 20

  float xScale = mix(entry1.x, entry2.x, latFraction);
  float yScale = mix(entry1.y, entry2.y, latFraction);

  // Compute projected X and Y coordinates
  float x = xScale * lonRad;
  float y = yScale * sign(lat);

  return vec2(x, y);
}

void main() {
  // Convert UV coordinates to latitude and longitude
  float lon = uv.x * 360.0 - 180.0; // Map [0, 1] UV.x to [-180, 180] longitude
  float lat = uv.y * 180.0 - 90.0;  // Map [0, 1] UV.y to [-90, 90] latitude

  // Apply Robinson projection
  vec2 projected = robinsonProjection(lat, lon);
  vec3 projectedPosition = vec3(projected.x * 0.6, projected.y, 0.0);

  // Mix between the original and projected positions
  vec3 pos = mix(vec3(position), projectedPosition, projectionBlend);

  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);

  vUv = uv; // Pass UV to fragment shader
  vNormal = normal; // Pass normal to fragment shader
}