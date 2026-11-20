/**
 * Shader patches injected into Three's built-in materials via onBeforeCompile.
 * They keep PBR lighting + shadows while letting us animate growth on the GPU.
 */

export const windGLSL = /* glsl */ `
uniform float uTime;
uniform float uWind;
vec3 windSway(vec3 p) {
  float h = max(p.y - 0.8, 0.0);
  float k = h * h * 0.0032 * uWind;
  vec3 o = vec3(0.0);
  o.x = sin(uTime * 0.9 + p.y * 0.35 + p.z * 0.2) * k + sin(uTime * 2.3 + p.x * 0.9) * k * 0.22;
  o.z = cos(uTime * 0.72 + p.y * 0.3 + p.x * 0.25) * k * 0.8;
  return o;
}
`;

function applyPatch(material, uniforms, { header, begin, project }) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${windGLSL}\n${header}`)
      .replace('#include <begin_vertex>', begin)
      .replace('#include <project_vertex>', project);
  };
  material.customProgramCacheKey = () => header + begin;
  return material;
}

/**
 * Wood (trunk, branches, roots). Each vertex knows the centre-line point of its
 * ring (aCenter) and the moment it is "born" (aGrowT). Vertices that haven't
 * grown yet collapse onto the centre line => an organic, tapering growth tip.
 */
export function patchWood(material, uniforms, { sway = true, tint = false } = {}) {
  const patched = applyPatch(material, uniforms, {
    header: /* glsl */ `
      attribute vec3 aCenter;
      attribute float aGrowT;
      uniform float uGrow;
      uniform float uTaper;
      ${tint ? 'varying float vYoung;' : ''}
    `,
    begin: /* glsl */ `
      float gs = smoothstep(aGrowT, aGrowT + uTaper, uGrow);
      float thick = mix(0.32, 1.0, smoothstep(aGrowT, aGrowT + 0.42, uGrow));
      vec3 transformed = aCenter + (position - aCenter) * gs * thick;
      ${tint ? 'vYoung = 1.0 - smoothstep(aGrowT + 0.02, aGrowT + 0.2, uGrow);' : ''}
    `,
    project: /* glsl */ `
      vec4 mvPosition = vec4(transformed, 1.0);
      ${sway ? 'mvPosition.xyz += windSway(aCenter);' : ''}
      mvPosition = modelViewMatrix * mvPosition;
      gl_Position = projectionMatrix * mvPosition;
    `,
  });
  if (tint) {
    // young shoots are fresh green; they turn to bark as they thicken
    const vertexPatch = patched.onBeforeCompile;
    patched.onBeforeCompile = (shader) => {
      vertexPatch(shader);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vYoung;')
        .replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.32, 0.62, 0.2), vYoung * 0.9);');
    };
    patched.customProgramCacheKey = () => 'wood-tint';
  }
  return patched;
}

/**
 * Instanced foliage (leaves, blossoms, fruit, grass). Each instance pops in
 * when its progress uniform passes aBirth, and only once the wood it hangs
 * on (aWood) exists.
 */
export function patchFoliage(material, uniforms, { flutter = 0.12, hang = false, withWood = false } = {}) {
  return applyPatch(material, uniforms, {
    header: /* glsl */ `
      attribute float aBirth;
      attribute float aWood;
      attribute float aPhase;
      uniform float uProg;
      uniform float uGrow;
    `,
    begin: /* glsl */ `
      ${withWood
        ? 'float ls = smoothstep(aWood + aBirth, aWood + aBirth + 0.07, uGrow) * uProg; // leaves unfurl right behind their shoot'
        : 'float ls = smoothstep(aBirth, aBirth + 0.075, uProg) * smoothstep(aWood, aWood + 0.03, uGrow);'}
      float pop = ls + sin(ls * 3.14159) * 0.28;
      vec3 transformed = position * pop;
      float fl = sin(uTime * 2.4 + aPhase * 6.2831) * ${flutter.toFixed(3)} * uWind;
      transformed.z += transformed.y * fl;
      transformed.x += transformed.y * fl * 0.4;
      ${hang ? 'transformed.x += sin(uTime * 1.3 + aPhase * 6.2831) * 0.02 * transformed.y;' : ''}
    `,
    project: /* glsl */ `
      vec4 mvPosition = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
        vec3 iOrigin = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        mvPosition.xyz += windSway(iOrigin);
      #endif
      mvPosition = modelViewMatrix * mvPosition;
      gl_Position = projectionMatrix * mvPosition;
    `,
  });
}

/** Grass blades: sway by blade height (uv.y), no growth logic. */
export function patchGrass(material, uniforms) {
  return applyPatch(material, uniforms, {
    header: '// grass',
    begin: /* glsl */ `
      vec3 transformed = vec3(position);
      #ifdef USE_INSTANCING
        vec3 gOrigin = instanceMatrix[3].xyz;
      #else
        vec3 gOrigin = vec3(0.0);
      #endif
      float bend = pow(uv.y, 2.0);
      transformed.x += sin(uTime * 1.7 + gOrigin.x * 1.3 + gOrigin.z * 0.7) * 0.07 * bend * (0.6 + uWind);
      transformed.z += cos(uTime * 1.3 + gOrigin.z * 1.1) * 0.05 * bend * (0.6 + uWind);
    `,
    project: /* glsl */ `
      vec4 mvPosition = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        mvPosition = instanceMatrix * mvPosition;
      #endif
      mvPosition = modelViewMatrix * mvPosition;
      gl_Position = projectionMatrix * mvPosition;
    `,
  });
}
