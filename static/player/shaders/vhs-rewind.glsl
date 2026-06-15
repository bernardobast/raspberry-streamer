precision mediump float;
uniform sampler2D u_from;
uniform sampler2D u_to;
uniform float u_progress;
varying vec2 v_uv;

float rand(vec2 co) {
  return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  float sweep = 1.0 - u_progress;
  float wipe  = step(sweep, v_uv.y);
  float edge  = abs(v_uv.y - sweep);
  float band  = step(edge, 0.04);
  float noise = rand(v_uv + vec2(0.0, u_progress * 200.0));
  float bleed = 0.003;
  vec4 from = vec4(
    texture2D(u_from, vec2(v_uv.x + bleed, v_uv.y)).r,
    texture2D(u_from, v_uv).g,
    texture2D(u_from, vec2(v_uv.x - bleed, v_uv.y)).b,
    1.0
  );
  vec4 to   = texture2D(u_to, v_uv);
  vec4 base = mix(from, to, wipe);
  vec4 band_color = vec4(noise * 0.8 + 0.2, noise * 0.8 + 0.2, noise + 0.1, 1.0);
  gl_FragColor = mix(base, band_color, band * 0.75);
}
