precision mediump float;
uniform sampler2D u_from;
uniform sampler2D u_to;
uniform float u_progress;
varying vec2 v_uv;

float rand(vec2 co) {
  return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  float intensity = 1.0 - abs(u_progress * 2.0 - 1.0);
  float noise = rand(v_uv * 100.0 + vec2(u_progress * 37.0, u_progress * 23.0));
  vec4 from = texture2D(u_from, v_uv);
  vec4 to   = texture2D(u_to, v_uv);
  vec4 base = mix(from, to, u_progress);
  vec4 snow = vec4(noise, noise, noise, 1.0);
  gl_FragColor = mix(base, snow, intensity * 0.85);
}
