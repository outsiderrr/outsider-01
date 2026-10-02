import * as THREE from 'three';

/**
 * 线稿风格填充：亮面 / 暗面两色（交界柔和），暗面叠 45° 屏幕空间排线，最暗处再叠交叉线。
 * 光源固定在视图左上方（像插图），所以任何视角下明暗都一致。
 */
const FILL_VERT = /* glsl */ `
  varying vec3 vNormalV;
  #ifdef USE_ZONE
    attribute float aZone;
    varying float vZone;
  #endif
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    vNormalV = normalize(normalMatrix * normal);
    #ifdef USE_ZONE
      vZone = aZone;
    #endif
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    #include <logdepthbuf_vertex>
  }
`;

const FILL_FRAG = /* glsl */ `
  uniform vec3 uBase;
  uniform vec3 uShade;
  uniform vec3 uInk;
  uniform vec3 uTint;
  uniform float uTintA;
  uniform float uTintB;
  uniform float uHatch;
  uniform float uPixelRatio;
  varying vec3 vNormalV;
  #ifdef USE_ZONE
    varying float vZone;
  #endif
  #include <logdepthbuf_pars_fragment>
  float hatchLine(float coord, float spacing) {
    float f = fract(coord / spacing);
    float w = 0.9 / spacing;
    return 1.0 - smoothstep(w, w + 1.2 / spacing, min(f, 1.0 - f));
  }
  void main() {
    #include <logdepthbuf_fragment>
    vec3 n = normalize(vNormalV);
    vec3 L = normalize(vec3(-0.45, 0.62, 0.64));
    float l = dot(n, L) * 0.5 + 0.5;
    float lit = smoothstep(0.43, 0.53, l);
    #ifdef USE_ZONE
      float tintAmt = mix(uTintA, uTintB, vZone);
    #else
      float tintAmt = uTintA;
    #endif
    vec3 base = mix(uBase, uTint, tintAmt * 0.5);
    vec3 shade = mix(uShade, mix(uShade, uTint, 0.8), tintAmt * 0.5);
    vec3 col = mix(shade, base, lit);
    if (uHatch > 0.0) {
      float s = 4.5 * uPixelRatio;
      float d1 = hatchLine(gl_FragCoord.x + gl_FragCoord.y, s);
      float d2 = hatchLine(gl_FragCoord.x - gl_FragCoord.y, s);
      float a1 = smoothstep(0.52, 0.30, l) * 0.42;
      float a2 = smoothstep(0.30, 0.12, l) * 0.34;
      col = mix(col, uInk, uHatch * (d1 * a1 + d2 * a2));
    }
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export interface FillOptions {
  zone?: boolean;
}

export function createFillMaterial(opts: FillOptions = {}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: FILL_VERT,
    fragmentShader: FILL_FRAG,
    defines: opts.zone ? { USE_ZONE: '' } : {},
    uniforms: {
      uBase: { value: new THREE.Color('#fbfcfd') },
      uShade: { value: new THREE.Color('#c9d4e3') },
      uInk: { value: new THREE.Color('#1d3f94') },
      uTint: { value: new THREE.Color('#ee4f17') },
      uTintA: { value: 0 },
      uTintB: { value: 0 },
      uHatch: { value: 1 },
      uPixelRatio: { value: 1 },
    },
  });
}

/** 所有描边共用的线宽（世界单位，米）：每帧按"目标像素宽 × 每像素世界长度"更新 */
export const OUTLINE_WIDTH = { value: 0.006 };
export const OUTLINE_COLOR = { value: new THREE.Color('#1d3f94') };

const OUTLINE_VERT = /* glsl */ `
  uniform float uWidth;
  #include <common>
  #include <logdepthbuf_pars_vertex>
  void main() {
    vec3 n = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    mv.xyz += n * uWidth;
    gl_Position = projectionMatrix * mv;
    #include <logdepthbuf_vertex>
  }
`;

const OUTLINE_FRAG = /* glsl */ `
  uniform vec3 uColor;
  #include <logdepthbuf_pars_fragment>
  void main() {
    #include <logdepthbuf_fragment>
    gl_FragColor = vec4(uColor, 1.0);
    #include <colorspace_fragment>
  }
`;

let outlineMaterial: THREE.ShaderMaterial | null = null;

export function getOutlineMaterial(): THREE.ShaderMaterial {
  if (!outlineMaterial) {
    outlineMaterial = new THREE.ShaderMaterial({
      vertexShader: OUTLINE_VERT,
      fragmentShader: OUTLINE_FRAG,
      side: THREE.BackSide,
      uniforms: { uWidth: OUTLINE_WIDTH, uColor: OUTLINE_COLOR },
    });
  }
  return outlineMaterial;
}

/** 给网格配一个共享几何体的描边网格（作为子节点，跟随父网格变换） */
export function addOutline(mesh: THREE.Mesh): THREE.Mesh {
  const o = new THREE.Mesh(mesh.geometry, getOutlineMaterial());
  o.castShadow = false;
  o.renderOrder = -1;
  mesh.add(o);
  return o;
}

/** 关节标记：固定像素大小的墨色小圆环 */
export function createMarkerMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uSize: { value: 8 },
      uInk: { value: new THREE.Color('#1d3f94') },
      uFill: { value: new THREE.Color('#fbfcfd') },
    },
    vertexShader: /* glsl */ `
      uniform float uSize;
      void main() {
        gl_PointSize = uSize;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        // 往相机方向挪约 8 cm：浮在肢体表面上，但仍会被躯干挡住
        gl_Position.z -= 0.004 * gl_Position.w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uInk;
      uniform vec3 uFill;
      void main() {
        vec2 p = gl_PointCoord * 2.0 - 1.0;
        float r = length(p);
        if (r > 1.0) discard;
        float ring = smoothstep(0.52, 0.62, r);
        gl_FragColor = vec4(mix(uFill, uInk, ring), 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
}
