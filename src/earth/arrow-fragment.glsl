uniform vec3 color;
uniform float transparency;

void main() {
  gl_FragColor = vec4(color, transparency);
}