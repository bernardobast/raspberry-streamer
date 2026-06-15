precision mediump float;
uniform sampler2D u_from;
uniform sampler2D u_to;
uniform float u_progress;
varying vec2 v_uv;

float rand(vec2 co) {
  return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  float scan  = sin(v_uv.y * 400.0) * 0.015 * u_progress;
  float bleed = 0.004 * u_progress;

  vec4 from = vec4(
    texture2D(u_from, vec2(v_uv.x + scan + bleed, v_uv.y)).r,
    texture2D(u_from, vec2(v_uv.x + scan,         v_uv.y)).g,
    texture2D(u_from, vec2(v_uv.x + scan - bleed, v_uv.y)).b,
    1.0
  );
  vec4 to = texture2D(u_to, vec2(v_uv.x - scan, v_uv.y));

  float noise = step(0.97, rand(vec2(
    floor(v_uv.y * 80.0),
    floor(u_progress * 30.0)
  )));
  gl_FragColor = mix(from, to, u_progress) + vec4(noise * 0.15);
}
