/**
 * Clean-room WebGL2 GLSL ES 3.00 shaders for the Liquid Glass Morphing Menu PoC.
 *
 * Implements:
 * - Fullscreen triangle vertex shader (no VBO required)
 * - Separable 9-tap Gaussian blur shader for the downsampled FBO pyramid
 * - Single-pass SDF Liquid Glass fragment shader with:
 *   - Rounded-box SDF + superellipse octant rim refinement
 *   - Polynomial smooth-min (smin) union between platter & droplet
 *   - Outside-only drop shadow (never bleeds through translucent glass)
 *   - Circular bevel refraction + optional edge chromatic dispersion
 *   - Multi-level pyramid + 16-tap Vogel-disc residual frost blur
 *   - Color optics (saturation, brightness, contrast) + 5-point behind-luma contrast thickening
 *   - Control rim, directional menu rim, and smooth styleMix blending
 *   - Dark outer hairline with side/corner/flat alpha falloff
 *   - Optional SDF & normal debug visualization modes
 *
 * SPDX-License-Identifier: MPL-2.0
 */

export const FULLSCREEN_VERTEX_SHADER = /* glsl */ `#version 300 es
precision highp float;

out vec2 vUv;

void main() {
  vec2 pos = vec2(
    (gl_VertexID == 1) ? 3.0 : -1.0,
    (gl_VertexID == 2) ? 3.0 : -1.0
  );
  vUv = pos * 0.5 + 0.5;
  gl_Position = vec4(pos, 0.0, 1.0);
}
`

export const SEPARABLE_BLUR_FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uSourceTex;
uniform vec2 uDirection; // (1 / srcWidth, 0) or (0, 1 / srcHeight)

void main() {
  // 9-tap separable Gaussian kernel (sigma ~= 2.0 texels)
  const float w0 = 0.20236;
  const float w1 = 0.17904;
  const float w2 = 0.12401;
  const float w3 = 0.06723;
  const float w4 = 0.02853;

  vec2 d = uDirection;
  vec4 sum = texture(uSourceTex, vUv) * w0;
  sum += (texture(uSourceTex, clamp(vUv + d * 1.0, 0.0005, 0.9995)) +
          texture(uSourceTex, clamp(vUv - d * 1.0, 0.0005, 0.9995))) * w1;
  sum += (texture(uSourceTex, clamp(vUv + d * 2.0, 0.0005, 0.9995)) +
          texture(uSourceTex, clamp(vUv - d * 2.0, 0.0005, 0.9995))) * w2;
  sum += (texture(uSourceTex, clamp(vUv + d * 3.0, 0.0005, 0.9995)) +
          texture(uSourceTex, clamp(vUv - d * 3.0, 0.0005, 0.9995))) * w3;
  sum += (texture(uSourceTex, clamp(vUv + d * 4.0, 0.0005, 0.9995)) +
          texture(uSourceTex, clamp(vUv - d * 4.0, 0.0005, 0.9995))) * w4;

  fragColor = sum;
}
`

export const LIQUID_GLASS_FRAGMENT_SHADER = /* glsl */ `#version 300 es
precision highp float;

in vec2 vUv;
out vec4 fragColor;

uniform sampler2D uTexSharp;
uniform sampler2D uTexBlur1;
uniform sampler2D uTexBlur2;
uniform sampler2D uTexBlur3;

uniform vec2 uViewport;         // Logical CSS pixels
uniform float uDpr;             // Device pixel ratio
uniform vec4 uPlatter;          // (cx, cy, halfW, halfH) in CSS px
uniform float uPlatterRadius;   // Corner radius in CSS px
uniform vec4 uDroplet;          // (cx, cy, halfW, halfH) in CSS px
uniform float uDropletRadius;   // Corner radius in CSS px
uniform float uBlendK;          // smin blend radius in CSS px
uniform float uIsMerged;        // 1.0 when merged (use platter only), 0.0 otherwise
uniform float uRimOpacity;      // geometry.rimOpacity [0..1]
uniform float uStyleMix;        // geometry.styleMix [0..1] (0=control, 1=menu)
uniform float uOpacity;         // frame.opacity [0..1]
uniform float uThemeDark;       // 0.0=light, 1.0=dark

uniform float uBevel;
uniform float uRefraction;
uniform float uBlur;
uniform float uDispersion;
uniform float uSaturation;
uniform float uBrightness;
uniform float uContrast;
uniform vec4 uTintRgba;

uniform vec4 uRimParams;        // (style.rimOpacity, style.rimWidth, style.rimTail, style.rimFocus)
uniform float uRimAdded;        // style.rimAdded
uniform vec4 uHairline;         // (width, sideAlpha, cornerAlpha, flatAlpha)
uniform vec3 uShadow;           // (blur, offsetY, alpha)
uniform int uDebugMode;         // 0=glass, 1=sdf, 2=normals

const vec3 LUMA_WEIGHTS = vec3(0.2126, 0.7152, 0.0722);
const float GOLDEN_ANGLE = 2.3999632;

struct SdfSample {
  float dist;
  vec2 normal;
  float halfMinor;
};

vec2 cssToUv(vec2 pCss) {
  return vec2(pCss.x / uViewport.x, 1.0 - pCss.y / uViewport.y);
}

float safePow(float x, float y) {
  return (x <= 1e-6) ? 0.0 : pow(x, y);
}

SdfSample sdRoundedBoxRefined(vec2 p, vec2 center, vec2 halfSize, float r) {
  vec2 safeHalf = max(halfSize, vec2(0.001));
  float rad = clamp(r, 0.0, min(safeHalf.x, safeHalf.y));
  vec2 rel = p - center;
  vec2 s = vec2(rel.x >= 0.0 ? 1.0 : -1.0, rel.y >= 0.0 ? 1.0 : -1.0);
  vec2 q = abs(rel) - safeHalf + rad;
  vec2 qPos = max(q, 0.0);

  float outside = length(qPos);
  float inside = min(max(q.x, q.y), 0.0);
  float baseDist = outside + inside - rad;

  vec2 baseNormal;
  if (q.x > 0.0 && q.y > 0.0) {
    baseNormal = (outside > 1e-5) ? (qPos / outside) * s : normalize(s);
  } else if (q.x > q.y) {
    baseNormal = vec2(s.x, 0.0);
  } else {
    baseNormal = vec2(0.0, s.y);
  }

  // Superellipse octant refinement within 5 CSS px of the boundary for C2 corner curvature continuity.
  float rimProximity = smoothstep(5.0, 0.0, abs(baseDist));
  float dist = baseDist;
  vec2 normal = baseNormal;

  if (rimProximity > 0.001 && rad > 1.0 && q.x > 0.0 && q.y > 0.0) {
    const float pExp = 2.55;
    vec2 qn = qPos / rad;
    float lp = safePow(safePow(qn.x, pExp) + safePow(qn.y, pExp), 1.0 / pExp);
    float superDist = (lp - 1.0) * rad;
    dist = mix(baseDist, superDist, rimProximity * 0.65);

    vec2 grad = vec2(
      safePow(qn.x, pExp - 1.0),
      safePow(qn.y, pExp - 1.0)
    );
    float gl = length(grad);
    if (gl > 1e-5) {
      vec2 superNormal = (grad / gl) * s;
      vec2 mixedN = mix(baseNormal, superNormal, rimProximity);
      float mnl = length(mixedN);
      normal = (mnl > 1e-5) ? (mixedN / mnl) : baseNormal;
    }
  }

  return SdfSample(dist, normal, min(safeHalf.x, safeHalf.y));
}

SdfSample evaluateGlassSdf(vec2 p) {
  SdfSample a = sdRoundedBoxRefined(p, uPlatter.xy, uPlatter.zw, uPlatterRadius);
  if (uIsMerged > 0.5 || uDroplet.z <= 0.01 || uDroplet.w <= 0.01) {
    return a;
  }

  SdfSample b = sdRoundedBoxRefined(p, uDroplet.xy, uDroplet.zw, uDropletRadius);
  if (uBlendK <= 0.001) {
    if (a.dist <= b.dist) {
      return a;
    }
    return b;
  }

  float h = clamp(0.5 + 0.5 * (b.dist - a.dist) / uBlendK, 0.0, 1.0);
  float d = mix(b.dist, a.dist, h) - uBlendK * h * (1.0 - h);
  vec2 n = mix(b.normal, a.normal, h);
  float nl = length(n);
  n = (nl > 1e-5) ? (n / nl) : a.normal;
  float hm = mix(b.halfMinor, a.halfMinor, h);
  return SdfSample(d, n, hm);
}

vec3 samplePyramidLevel(vec2 uv, float blurPx) {
  vec2 safeUv = clamp(uv, vec2(0.001), vec2(0.999));
  if (blurPx <= 0.05) {
    return texture(uTexSharp, safeUv).rgb;
  }
  if (blurPx < 3.0) {
    float t = blurPx / 3.0;
    return mix(texture(uTexSharp, safeUv).rgb, texture(uTexBlur1, safeUv).rgb, t);
  }
  if (blurPx < 7.0) {
    float t = (blurPx - 3.0) / 4.0;
    return mix(texture(uTexBlur1, safeUv).rgb, texture(uTexBlur2, safeUv).rgb, t);
  }
  float t = clamp((blurPx - 7.0) / 7.0, 0.0, 1.0);
  return mix(texture(uTexBlur2, safeUv).rgb, texture(uTexBlur3, safeUv).rgb, t);
}

vec3 sampleFrostedBackdrop(vec2 baseUv, vec2 normal, float inset, float blurPx) {
  float dispPx = (uDispersion > 0.001 && inset < 10.0)
    ? uDispersion * (1.0 - smoothstep(0.0, 10.0, inset))
    : 0.0;
  vec2 dispUv = vec2(normal.y / uViewport.x, -normal.x / uViewport.y) * dispPx;

  if (blurPx <= 0.08 && dispPx <= 0.01) {
    return samplePyramidLevel(baseUv, blurPx);
  }

  // 16-tap Vogel disc residual blur for continuous dynamic frost & dispersion.
  float residualRadius = clamp(blurPx * 0.22, 0.0, 3.5);
  vec3 acc = vec3(0.0);

  for (int i = 0; i < 16; i++) {
    float fi = float(i);
    float r = sqrt((fi + 0.5) / 16.0) * residualRadius;
    float theta = fi * GOLDEN_ANGLE;
    vec2 offsetCss = vec2(cos(theta), sin(theta)) * r;
    vec2 tapUv = baseUv + vec2(offsetCss.x / uViewport.x, -offsetCss.y / uViewport.y);

    if (dispPx > 0.01) {
      float rCh = samplePyramidLevel(tapUv + dispUv, blurPx).r;
      float gCh = samplePyramidLevel(tapUv, blurPx).g;
      float bCh = samplePyramidLevel(tapUv - dispUv, blurPx).b;
      acc += vec3(rCh, gCh, bCh);
    } else {
      acc += samplePyramidLevel(tapUv, blurPx);
    }
  }

  return acc * (1.0 / 16.0);
}

float computeBehindLuma() {
  vec2 c = uPlatter.xy;
  vec2 span = min(uPlatter.zw * 0.45, uViewport * 0.25);

  float l0 = dot(texture(uTexBlur2, clamp(cssToUv(c), 0.001, 0.999)).rgb, LUMA_WEIGHTS);
  float l1 = dot(texture(uTexBlur2, clamp(cssToUv(c + vec2(-span.x, -span.y)), 0.001, 0.999)).rgb, LUMA_WEIGHTS);
  float l2 = dot(texture(uTexBlur2, clamp(cssToUv(c + vec2( span.x, -span.y)), 0.001, 0.999)).rgb, LUMA_WEIGHTS);
  float l3 = dot(texture(uTexBlur2, clamp(cssToUv(c + vec2(-span.x,  span.y)), 0.001, 0.999)).rgb, LUMA_WEIGHTS);
  float l4 = dot(texture(uTexBlur2, clamp(cssToUv(c + vec2( span.x,  span.y)), 0.001, 0.999)).rgb, LUMA_WEIGHTS);
  return (l0 + l1 + l2 + l3 + l4) * 0.2;
}

void main() {
  if (uOpacity <= 0.001) {
    fragColor = vec4(0.0);
    return;
  }

  // Convert GL UV (bottom-left origin) to CSS pixels (top-left origin).
  vec2 pCss = vec2(vUv.x * uViewport.x, (1.0 - vUv.y) * uViewport.y);
  SdfSample sdf = evaluateGlassSdf(pCss);
  float d = sdf.dist;
  vec2 normal = sdf.normal;
  float halfMinor = sdf.halfMinor;

  // Debug modes for lab inspection
  if (uDebugMode == 1) {
    float iso = abs(fract(d / 10.0) - 0.5) * 2.0;
    float edgeLine = smoothstep(1.2, 0.0, abs(d));
    vec3 insideCol = mix(vec3(0.08, 0.55, 0.92), vec3(0.18, 0.95, 0.85), smoothstep(-24.0, 0.0, d));
    vec3 outsideCol = mix(vec3(0.95, 0.32, 0.45), vec3(0.08, 0.10, 0.16), smoothstep(0.0, 48.0, d));
    vec3 col = (d <= 0.0 ? insideCol : outsideCol) * (0.65 + 0.35 * smoothstep(0.05, 0.25, iso));
    col = mix(col, vec3(1.0, 1.0, 0.4), edgeLine);
    float a = (d <= 0.0 ? 0.85 : 0.45 * exp(-d / 40.0)) * uOpacity;
    fragColor = vec4(col * a, a);
    return;
  }

  if (uDebugMode == 2) {
    float aa = 1.0 / max(uDpr, 1.0);
    float mask = smoothstep(0.5 * aa, -0.5 * aa, d);
    float bevel = min(uBevel, halfMinor * 0.5);
    float inset = max(-d, 0.0);
    float rise = 1.0 - clamp(inset / max(bevel, 1e-4), 0.0, 1.0);
    float depthFrac = 1.0 - sqrt(max(0.0, 1.0 - rise * rise));
    vec3 col = vec3(normal * 0.5 + 0.5, depthFrac);
    float a = mask * 0.9 * uOpacity;
    fragColor = vec4(col * a, a);
    return;
  }

  float aa = 1.0 / max(uDpr, 1.0);
  float glassMask = smoothstep(0.5 * aa, -0.5 * aa, d);
  float outsideMask = 1.0 - glassMask;

  // 1. Outside-only drop shadow (evaluated at p - (0, shadowOffsetY), masked outside glass SDF)
  float shadowA = 0.0;
  if (outsideMask > 0.001 && uShadow.z > 0.001) {
    SdfSample shadowSdf = evaluateGlassSdf(pCss - vec2(0.0, uShadow.y));
    float sigma = max(uShadow.x * 0.5, 1.0);
    float shadowFalloff = 1.0 / (1.0 + exp(clamp(1.65 * shadowSdf.dist / sigma, -12.0, 12.0)));
    shadowA = outsideMask * shadowFalloff * uShadow.z * uOpacity;
  }

  // 2. Dark outer hairline along the fused SDF boundary
  float hairlineHalfW = max(uHairline.x * 0.5, 0.33 / max(uDpr, 1.0));
  float hairlineBand = smoothstep(hairlineHalfW + 0.5 * aa, hairlineHalfW * 0.25, abs(d));
  float hairA = 0.0;
  if (hairlineBand > 0.001) {
    float ax = abs(normal.x);
    float ay = abs(normal.y);
    float cornerW = safePow(clamp(2.0 * ax * ay, 0.0, 1.0), 1.5);
    float sideVsFlat = mix(uHairline.y, uHairline.w, ay * ay);
    float hairlineProfileAlpha = mix(sideVsFlat, uHairline.z, cornerW);
    hairA = hairlineBand * hairlineProfileAlpha * uOpacity;
  }

  if (glassMask <= 0.001) {
    float outA = clamp(shadowA + hairA, 0.0, 1.0);
    fragColor = vec4(0.0, 0.0, 0.0, outA);
    return;
  }

  // 3. Circular bevel refraction
  float inset = max(-d, 0.0);
  float bevel = min(uBevel, halfMinor * 0.5);
  float rise = 1.0 - clamp(inset / max(bevel, 1e-4), 0.0, 1.0);
  float depth = min(uRefraction, halfMinor) * (1.0 - sqrt(max(0.0, 1.0 - rise * rise)));
  vec2 sampleUv = vUv + vec2(-normal.x * depth / uViewport.x, normal.y * depth / uViewport.y);

  // 4. Frosted backdrop sampling + optional chromatic dispersion
  vec3 bg = sampleFrostedBackdrop(sampleUv, normal, inset, uBlur);

  // 5. Color optics: saturation and brightness on refracted backdrop (unclamped until final output)
  float luma = dot(bg, LUMA_WEIGHTS);
  bg = mix(vec3(luma), bg, uSaturation) * uBrightness;

  // 6. Behind-luma adaptive contrast thickening (uses uContrast polarity & magnitude)
  float behindLuma = computeBehindLuma();
  float tintLuma = dot(uTintRgba.rgb, LUMA_WEIGHTS);
  float contrastSign = abs(uContrast) > 1e-4 ? sign(uContrast) : (uThemeDark > 0.5 ? -1.0 : 1.0);
  float clash = clamp((contrastSign * (tintLuma - behindLuma) - 0.3) / 0.5, 0.0, 1.0);
  float clashScale = abs(uContrast) > 1e-4 ? abs(uContrast) : 0.45;
  float effectiveTintAlpha = clamp(uTintRgba.a + clash * (1.0 - uTintRgba.a) * clashScale, 0.0, 0.96);

  vec3 glassColor = mix(bg, uTintRgba.rgb, effectiveTintAlpha);

  // 7. Rim highlights: blend control rim vs directional menu rim via uStyleMix & uRimOpacity
  float ny = abs(normal.y);
  float wControl = 1.0 - clamp(uStyleMix, 0.0, 1.0);
  float wMenu = clamp(uStyleMix, 0.0, 1.0) * clamp(uRimOpacity, 0.0, 1.0);

  if (wControl > 0.001 && uRimParams.x > 0.001) {
    float topBias = clamp(-normal.y, 0.0, 1.0);
    float botBias = clamp(normal.y, 0.0, 1.0);
    float dirWeight = safePow(max(topBias, botBias * 0.72), max(uRimParams.w, 0.25));
    float core = smoothstep(max(uRimParams.y, 0.4) + 0.6, 0.0, inset);
    float tail = exp(-inset / 1.8) * uRimParams.z;
    float ctrlHighlight = (core + tail) * dirWeight * uRimParams.x * wControl;

    vec3 addCol = glassColor + vec3(ctrlHighlight);
    vec3 scrCol = 1.0 - (1.0 - glassColor) * (1.0 - vec3(ctrlHighlight));
    glassColor = mix(scrCol, addCol, clamp(uRimAdded, 0.0, 1.0));
  }

  if (wMenu > 0.001 && uRimParams.x > 0.001 && inset < 5.0) {
    // 9 concentric inward bands across 0..5 CSS px x angular corner falloff
    float bandT = clamp(inset / 5.0, 0.0, 1.0);
    float steppedT = min(floor(bandT * 9.0) / 9.0, 1.0);
    float bandCurve = mix(safePow(1.0 - bandT, 2.1), safePow(1.0 - steppedT, 2.1), 0.35);
    float rimCoreBoost = 0.65 + 0.35 * smoothstep(1.2, 0.0, inset);
    // Angular falloff: 1.0 top/bottom -> ~0.46 corner -> ~0.015 sides
    float angWeight = mix(0.015, 1.0, safePow(ny, 2.1)) * (normal.y < 0.0 ? 1.0 : 0.85);
    float menuHighlight = bandCurve * rimCoreBoost * angWeight * uRimParams.x * wMenu;
    glassColor += vec3(menuHighlight);
  }

  glassColor = clamp(glassColor, 0.0, 1.0);

  // 8. Final premultiplied composite: outside shadow + glass body + dark hairline
  float glassA = glassMask * uOpacity;
  vec3 glassPremul = glassColor * glassA;

  // Hairline blends cleanly as dark alpha over the edge
  vec3 outRgb = glassPremul * (1.0 - hairA);
  float outA = clamp(shadowA + glassA * (1.0 - hairA) + hairA, 0.0, 1.0);
  fragColor = vec4(outRgb, outA);
}
`
