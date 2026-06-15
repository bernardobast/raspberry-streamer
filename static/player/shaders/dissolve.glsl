precision mediump float;
uniform sampler2D u_from;
uniform sampler2D u_to;
uniform float u_progress;
varying vec2 v_uv;

float rand(vec2 co) {
  return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec4 from = texture2D(u_from, v_uv);
  vec4 to   = texture2D(u_to,   v_uv);
  float grain = (rand(v_uv + u_progress) - 0.5) * 0.08;
  gl_FragColor = mix(from, to, clamp(u_progress + grain, 0.0, 1.0));
}
