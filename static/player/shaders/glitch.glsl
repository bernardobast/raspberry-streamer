precision mediump float;
uniform sampler2D u_from;
uniform sampler2D u_to;
uniform float u_progress;
varying vec2 v_uv;

float rand(vec2 co) {
  return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  float block_y = floor(v_uv.y * 24.0) / 24.0;
  float t_block = floor(u_progress * 12.0) / 12.0;
  float offset  = (rand(vec2(block_y, t_block)) - 0.5) * 0.08 * u_progress;

  vec2  uv_g  = vec2(fract(v_uv.x + offset), v_uv.y);
  float split = 0.008 * u_progress;

  vec4 from = vec4(
    texture2D(u_from, vec2(uv_g.x + split, uv_g.y)).r,
    texture2D(u_from, uv_g).g,
    texture2D(u_from, vec2(uv_g.x - split, uv_g.y)).b,
    1.0
  );
  gl_FragColor = mix(from, texture2D(u_to, uv_g), u_progress);
}
