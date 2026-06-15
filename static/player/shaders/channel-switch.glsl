precision mediump float;
uniform sampler2D u_from;
uniform sampler2D u_to;
uniform float u_progress;
varying vec2 v_uv;

float rand(vec2 co) {
  return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  float blackout = smoothstep(0.3, 0.5, u_progress) * (1.0 - smoothstep(0.5, 0.7, u_progress));
  float tear_noise = rand(vec2(floor(v_uv.y * 30.0), floor(u_progress * 15.0)));
  float tear = (tear_noise - 0.5) * 0.1 * (1.0 - abs(u_progress * 2.0 - 1.0));
  vec2 uv_from = vec2(fract(v_uv.x + tear), v_uv.y);
  vec2 uv_to   = vec2(fract(v_uv.x - tear), v_uv.y);
  vec4 base = u_progress < 0.5
    ? texture2D(u_from, uv_from)
    : texture2D(u_to, uv_to);
  gl_FragColor = mix(base, vec4(0.0, 0.0, 0.0, 1.0), blackout);
}
