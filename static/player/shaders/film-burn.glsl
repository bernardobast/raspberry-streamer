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

  float burn  = u_progress * 1.6 - v_uv.x * 0.6;
  float noise = rand(v_uv + vec2(u_progress * 3.7)) * 0.25;
  float mask  = clamp(burn + noise, 0.0, 1.0);

  vec4 fire = mix(
    vec4(1.0, 0.35, 0.0, 1.0),
    vec4(1.0, 1.0,  0.9, 1.0),
    smoothstep(0.4, 0.8, mask)
  );

  if (mask < 0.5) {
    gl_FragColor = mix(from, fire, mask * 2.0);
  } else {
    gl_FragColor = mix(fire, to, (mask - 0.5) * 2.0);
  }
}
