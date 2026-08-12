import * as THREE from 'three'
import dayUrl from '../assets/textures/earth_atmos_medium.jpg'
import dayUrlSmall from '../assets/textures/earth_atmos_small.jpg'
import { SPIRITUALITIES } from '../data/prayers.js'

// Each tradition's prayer-light colour, so the lights of the world glow by
// faith (fall back to warm gold when a cell's faith is unknown).
const TRAD_LIGHT = Object.fromEntries(
  SPIRITUALITIES.map((s) => [s.id, new THREE.Color(s.lightColor || '#dfb05c')])
)
const GOLD_LIGHT = new THREE.Color('#dfb05c')

// Living Earth.
// Full view: real continents and coastlines with the NASA Blue Marble
// texture, genuine city lights on the night side, and the glow that grows as
// collective prayer accumulates.
// Backdrop (behind the prayer view): a quiet, translucent silhouette of the
// landmasses with soft lights at the places people are praying right now.

const VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPos;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

// equirectangular mapping from a point on the unit sphere to texture uv.
// THREE uploads textures with UNPACK_FLIP_Y (north pole of a sphere's uv is
// at v=1), so north must map to v=1: v = 0.5 + asin(p.y)/PI.
const FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uGlow;
  uniform vec3 uSunDir;
  uniform sampler2D uDayTex;
  uniform float uTier;
  uniform sampler2D uMaskTex;
  uniform float uSurge;
  varying vec3 vNormal;
  varying vec3 vPos;

  vec2 equirect(vec3 p) {
    return vec2(
      0.5 - atan(p.z, p.x) / 6.2831853,
      0.5 + asin(clamp(p.y, -1.0, 1.0)) / 3.14159265
    );
  }

  void main() {
    vec3 n = normalize(vNormal);
    vec3 sp = normalize(vPos);

    vec2 uv = equirect(sp);

    // The living Earth: deep, quiet ocean and land, lit by the sun terminator.
    // A gentle luminous shift accumulates as the world prays together. Land and
    // ocean sit darker so the glowing blue atmosphere, coastlines and aurora
    // shine through as the luminous heart of the scene.
    float landMask = texture2D(uMaskTex, uv).r;

    // uGlow rises with every prayer ever made (toward a million), uTier with
    // the lifetime seconds of shared prayer. Land and ocean sit very dark so
    // the prayer lights, coastline and atmosphere carry all the glow.
    vec3 oceanC = vec3(0.002, 0.006, 0.016)
      + vec3(0.002, 0.005, 0.01) * uTier
      + vec3(0.003, 0.007, 0.013) * uGlow;
    // land: deep, dark moss-forest teal (≈50% darker — the luminous coastline
    // and you/they lights carry the glow, not the continents)
    vec3 landC = vec3(0.022, 0.085, 0.095)
      + vec3(0.006, 0.014, 0.015) * uTier
      + vec3(0.009, 0.019, 0.02) * uGlow;
    vec3 base = mix(oceanC, landC, landMask);

    float ndl = dot(n, normalize(uSunDir));
    // a clean, physically-plausible terminator: a tight great-circle shadow
    // between the lit day side and the dark night side, with a soft dawn band
    float sun = smoothstep(-0.1, 0.16, ndl);
// higher-contrast light: deep terminator shadow on night, bright day side,
    // so the Earth reads clearly against the dark space around it
    vec3 lit = base * (0.08 + 0.62 * sun);

    float night = 1.0 - smoothstep(-0.25, 0.08, ndl);

    // the Earth's own breathing glow, a luminous blue radiance that swells when
    // many people are praying at once. It rides the land, not the ocean — the
    // sea stays dark and quiet so no one ever reads a glow floating at sea.
    vec3 radiance = (vec3(0.12, 0.55, 0.75) * uGlow * uGlow * 0.2
      + vec3(0.3, 0.7, 0.9) * uGlow * uSurge * 0.3) * (0.12 + 0.88 * landMask);

    // polar aurora
    float polar = smoothstep(0.86, 0.99, abs(sp.y));
    float aur = polar * (0.5 + 0.5 * sin(uTime * 0.4 + sp.y * 6.0));
    vec3 aurora = vec3(0.1, 0.9, 0.6) * aur * night * 0.3;

    vec3 col = lit + radiance + aurora;

    // polar ice caps — clean ice crowning both poles (|sp.y| near 1). Cost is
    // two smoothsteps on a latitude value (cheap). Kept steep and near-opaque
    // so Antarctica's interior lakes never read through the ice sheet.
    float ice = smoothstep(0.74, 0.9, abs(sp.y));
    vec3 iceCol = vec3(0.6, 0.68, 0.76) * (0.5 + 0.3 * sun);
    col = mix(col, iceCol, min(ice * 1.05, 1.0));

    // a luminous shoreline: a bright thin core softened by a gentle glow on both
    // sides, so it reads as light tracing the continents, never a drawn line
    float a = texture2D(uMaskTex, vec2(fract(uv.x + 0.0005), uv.y)).r;
    float b = texture2D(uMaskTex, vec2(uv.x, fract(uv.y + 0.0008))).r;
    float c = texture2D(uMaskTex, vec2(fract(uv.x + 0.0011), uv.y)).r;
    float d = texture2D(uMaskTex, vec2(uv.x, fract(uv.y + 0.0016))).r;
    float core = smoothstep(0.3, 0.5, landMask) * (1.0 - smoothstep(0.42, 0.5, min(a, b)));
    float landGlow = smoothstep(0.25, 0.45, landMask) * (1.0 - smoothstep(0.5, 0.6, min(c, d)));
    float waterGlow = (1.0 - landMask) * smoothstep(0.4, 0.55, max(c, d));
    vec3 coastCol = vec3(0.55, 0.85, 1.0) * (0.85 + 0.35 * uGlow + 0.2 * uSurge + 0.12 * uTier);
    col += coastCol * (core * 0.45 + landGlow * 0.26 + waterGlow * 0.15);

    // warm dawn band where day meets night
    float term = smoothstep(0.1, -0.12, ndl) * (1.0 - smoothstep(-0.5, -0.2, ndl));
    vec3 dawn = vec3(1.0, 0.55, 0.3) * term * 0.08;
    col += dawn;

    // a gentle surface twinkle: soft shimmer waves drift over land and ocean
    // so the living Earth always feels faintly alive
    float tw = 0.5 + 0.5 * sin(uv.x * 80.0 + uTime * 1.2);
    tw *= 0.5 + 0.5 * sin(uv.y * 55.0 - uTime * 0.8);
    col += landMask * vec3(0.05, 0.1, 0.1) * tw * 0.14;
    col += (1.0 - landMask) * vec3(0.05, 0.09, 0.16) * tw * 0.06;

    // soft limb fade so the globe's edge always reads as a clean curve
    float limb = smoothstep(-0.08, 0.6, dot(n, vec3(0.0, 0.0, 1.0)));
    col *= 0.68 + 0.32 * limb;

    gl_FragColor = vec4(col, 1.0);
  }
`

// Translucent land-silhouette backdrop: dark landmasses with a glowing
// coastline, lit only by the lights of people praying right now.
const SIL_FRAG = /* glsl */ `
  uniform float uTime;
  uniform float uGlow;
  uniform sampler2D uDayTex;
  varying vec3 vNormal;
  varying vec3 vPos;

  vec2 equirect(vec3 p) {
    return vec2(
      0.5 - atan(p.z, p.x) / 6.2831853,
      0.5 + asin(clamp(p.y, -1.0, 1.0)) / 3.14159265
    );
  }

  void main() {
    vec3 sp = normalize(vPos);
    vec2 uv = equirect(sp);

    vec3 day = texture2D(uDayTex, uv).rgb;
    float lum = dot(day, vec3(0.299, 0.587, 0.114));
    float land = smoothstep(0.09, 0.17, lum) * step(-0.01, day.g - day.b);

    vec3 n = normalize(vNormal);
    vec3 viewDir = normalize(cameraPosition - vPos);
    float fres = pow(1.0 - clamp(dot(n, viewDir), 0.0, 1.0), 2.5);

    // a barely-there silhouette — effectively 100% dark. The prayer-view globe
    // should read only as a faint thinning where land sits, so the prayer
    // lights and text carry all the attention. No moon-like rim glow.
    float fillA = land * (0.003 + 0.002 * uGlow) * (0.5 + 0.5 * fres);
    float rimA = 0.0;
    float shore = 0.0;

    vec3 col = vec3(0.03, 0.07, 0.055) * fillA;

    float alpha = fillA;
    if (alpha < 0.002) discard;
    gl_FragColor = vec4(col, min(alpha, 1.0));
  }
`

const HALO_FRAG = /* glsl */ `
  uniform float uGlow;
  varying vec3 vNormal;
  varying vec3 vPos;
  void main() {
    vec3 viewDir = normalize(-vPos);
    float rim = 1.0 - max(dot(viewDir, normalize(vNormal)), 0.0);
    float f = pow(rim, 2.0);
    vec3 inner = mix(vec3(0.16, 0.32, 0.24), vec3(1.0, 0.88, 0.58), uGlow);
    gl_FragColor = vec4(inner, f * (0.04 + 0.09 * uGlow));
  }
`

const ATMO_VERT = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vPos;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vPos = mv.xyz;
    gl_Position = projectionMatrix * mv;
  }
`

const ATMO_FRAG = /* glsl */ `
  uniform float uGlow;
  uniform float uTime;
  uniform float uSurge;
  uniform float uDim;
  varying vec3 vNormal;
  varying vec3 vPos;
  void main() {
    vec3 viewDir = normalize(-vPos);
    float rim = 1.0 - max(dot(viewDir, normalize(vNormal)), 0.0);
    float f = pow(rim, 1.7);
    // ethereal atmosphere: luminous light-blue with a drifting violet shimmer,
    // brightening as prayer grows
    vec3 cool = vec3(0.5, 0.8, 1.0);
    vec3 warm = vec3(0.85, 0.95, 1.0);
    vec3 inner = mix(cool, warm, uGlow);
    vec3 shimmer = vec3(0.68, 0.58, 0.98) * (0.55 + 0.45 * sin(uTime * 0.7));
    vec3 col = inner * (0.75 + 0.3 * f) + shimmer * 0.34 * f;
    float alpha = f * (0.14 + 0.2 * uGlow + 0.14 * uSurge);
    gl_FragColor = vec4(col * uDim, alpha * uDim);
  }
`

// A wide, soft outer halo so the globe feels magical and alive.
const ETHEREAL_FRAG = /* glsl */ `  uniform float uGlow;
  uniform float uTime;
  uniform float uSurge;
  uniform float uDim;
  varying vec3 vNormal;
  varying vec3 vPos;
  void main() {
    vec3 viewDir = normalize(-vPos);
    float rim = 1.0 - max(dot(viewDir, normalize(vNormal)), 0.0);
    float f = pow(rim, 2.2);
    // a slow-drifting gradient: azure -> violet -> soft mint, endlessly
    // shifting, so the aura never reads as one flat colour
    float drift = uTime * 0.1;
    vec3 azure = vec3(0.45, 0.75, 1.0);
    vec3 violet = vec3(0.66, 0.5, 1.0);
    vec3 mint = vec3(0.4, 0.9, 0.82);
    vec3 col = mix(azure, violet, 0.5 + 0.5 * sin(drift));
    col = mix(col, mint, 0.28 * (0.5 + 0.5 * sin(drift * 1.7 + 2.0)));
    col = mix(col, vec3(0.95, 0.85, 1.0), 0.16 * (0.5 + 0.5 * sin(drift * 0.6 + 4.0)));
    // strong breathing twinkle + a fine sparkle grain
    float breathe = 0.72 + 0.28 * sin(uTime * 0.8);
    float grain = 0.72 + 0.28 * sin(rim * 70.0 - uTime * 2.4);
    // aura waves: rings pulse outward from the globe when many pray at once
    float waves = pow(0.5 + 0.5 * sin(rim * 40.0 - uTime * 3.2 + uGlow * 5.0), 3.0) * uSurge;
    float alpha = (f * (0.1 + 0.16 * uGlow) * grain + waves * 0.1) * breathe;
    gl_FragColor = vec4((col + vec3(0.3, 0.5, 0.75) * waves * 0.22) * uDim, alpha * uDim);
  }
`

// The golden aura sparks: each carries its own phase so the ring twinkles in
// and out gently and swirls around the globe. Motion is done on the GPU (the
// shell rotates + breathes in the vertex shader), so it stays cheap at 60fps.
const SPARK_VERT = /* glsl */ `
  attribute float aPhase;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uSwell;
  uniform float uDpr;
  varying vec3 vColor;
  varying float vA;
  void main() {
    vColor = aColor;
    // staggered twinkle in and out
    float tw = 0.5 + 0.5 * sin(uTime * 1.4 + aPhase * 6.2831853);
    vA = 0.4 + 0.6 * tw;
    vec3 p = position;
    // the whole aura slowly circulates the globe like an orbit of light
    float ang = uTime * 0.05;
    float ca = cos(ang), sa = sin(ang);
    p.xz = mat2(ca, -sa, sa, ca) * p.xz;
    // prayer surges swell the shell gently outward
    float sw = 1.0 + uSwell * (0.22 + 0.16 * sin(uTime * 1.7 + aPhase * 3.0));
    p *= sw;
    gl_PointSize = (4.0 + 2.6 * vA) * uDpr;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
  }
`

const SPARK_FRAG = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vColor;
  varying float vA;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    // soft round orb
    float orb = 1.0 - smoothstep(0.06, 0.5, d);
    if (orb <= 0.002) discard;
    gl_FragColor = vec4(vColor, orb * vA * uOpacity);
  }
`

// Procedural cloud shaders — a handful of noise instructions on a slightly
// larger sphere look like a real weather shell, at near-zero cost.
const CLOUD_VERT = /* glsl */ `
  varying vec3 vPos;
  void main() {
    vPos = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const CLOUD_FRAG = /* glsl */ `
  uniform float uTime;
  varying vec3 vPos;

  // cheap 3D hash — no texture wrap, no UV seam
  float hash31(vec3 p) {
    return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
  }

  float noise(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash31(i), hash31(i + vec3(1,0,0)), f.x),
          mix(hash31(i + vec3(0,1,0)), hash31(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash31(i + vec3(0,0,1)), hash31(i + vec3(1,0,1)), f.x),
          mix(hash31(i + vec3(0,1,1)), hash31(i + vec3(1,1,1)), f.x), f.y), f.z);
  }

  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    vec3 shift = vec3(100.0);
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p = p * 2.0 + shift;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 sp = normalize(vPos);

    // sample noise directly in 3D sphere-space — no UV seam anywhere. A higher
    // frequency gives fine, non-pixelated detail over the whole globe.
    float n = fbm(sp * 11.0 + vec3(uTime * 0.12, 0.0, uTime * 0.08));

    // thinner near the poles, thicker at mid-latitudes
    float band = 1.0 - smoothstep(0.45, 0.88, abs(sp.y)) * 0.55;

    float cloud = smoothstep(0.52, 0.68, n) * band;
    cloud *= smoothstep(0.38, 0.48, n);

    gl_FragColor = vec4(1.0, 1.0, 1.0, cloud * 0.24);
  }
`

// 2-degree lat/lon grid of possible light positions. The shared server rounds
// every praying user's location onto the same grid, so a light appears exactly
// where people are praying.
function buildLightKeys() {
  const step = 1
  const keys = []
  for (let la = -60; la <= 72; la += step) {
    for (let lo = -180; lo < 180; lo += step) {
      keys.push(`${la},${lo}`)
    }
  }
  return keys
}

const LAT_MIN = -60
const LAT_MAX = 72

// Real inhabited places used by the light snap logic: a small island with a
// town on it (Hawaii, the Maldives, an atoll) must keep its prayer light, so
// its component is trusted even when it is only 1-2 grid cells.
const SNAP_CITIES = [
  [40.7, -74.0], [51.5, -0.1], [35.7, 139.7], [28.6, 77.2], [-23.5, -46.6],
  [31.2, 121.5], [19.1, 72.9], [1.4, 103.8], [30.0, 31.2], [-34.6, -58.4],
  [52.5, 13.4], [39.9, 116.4], [-33.9, 151.2], [37.8, -122.4], [-1.3, 36.8],
  [3.1, 101.7], [34.0, -118.2], [41.9, -87.6], [43.7, -79.4], [25.2, 55.3],
  [6.5, 3.4], [40.4, -3.7], [13.1, 80.3], [10.8, 106.6], [55.8, 37.6],
  [-6.2, 106.8], [21.3, -157.9], [48.9, 2.3], [25.0, 55.2], [-26.2, 28.0],
  [18.5, -69.9], [59.9, 10.8], [36.8, 10.2], [41.0, 28.9], [33.9, -84.4],
  [38.9, -77.0], [4.7, -74.1], [13.1, -59.5], [12.9, 45.0], [-17.8, 31.0],
  [19.4, -99.1], [30.6, 104.1], [25.8, -80.2]
]

// Rounds a coordinate onto the shared 1-degree light grid (matches the server).
export function lightGridKey(lat, lon) {
  const la = Math.max(LAT_MIN, Math.min(LAT_MAX, Math.round(lat)))
  let lo = Math.round(lon)
  if (lo >= 180) lo = -180
  return `${la},${lo}`
}

// Evolving effect ladder: cumulative prayers unlock the world's surge and new
// effects at logarithmic milestones (10 → 100 → 1k → 20k → … → 100M). Each
// rung scales the existing glow higher, and rarer rungs add new effects.
const SURGE_LEVELS = [
  10, 100, 1000, 20000, 30000, 40000, 50000, 100000,
  333000, 500000, 1000000, 2000000, 5000000, 10000000, 20000000, 50000000, 100000000
]
const clamp01 = (v) => Math.max(0, Math.min(1, v))
// Returns { level, t (0..1 inside the rung), progress (0..1 across the whole
// ladder) } so effects can scale smoothly and new ones can fade in per rung.
function ladderState(prayers) {
  const p = Math.max(0, prayers || 0)
  if (p < SURGE_LEVELS[0]) {
    return { level: 0, t: p / SURGE_LEVELS[0], progress: (p / SURGE_LEVELS[0]) / SURGE_LEVELS.length }
  }
  let level = 0
  for (let i = 0; i < SURGE_LEVELS.length; i++) if (p >= SURGE_LEVELS[i]) level = i
  const lo = level === 0 ? 0 : SURGE_LEVELS[level - 1]
  const hi = SURGE_LEVELS[level]
  const t = (p - lo) / (hi - lo)
  return { level, t, progress: (level + t) / SURGE_LEVELS.length }
}

export class EarthScene {
  constructor(container, options = {}) {
    this.container = container
    this.backdrop = !!options.backdrop
    this.onReady = options.onReady || null
    this.glow = 0.2
    this.surge = 0
    this.tier = 0
    this.corona = 0
    this.wisps = 0
    this.surgeT = 0
    this.tierT = 0
    this.coronaT = 0
    this.wispsT = 0
    this._dayLoaded = false
    this._ready = false
    this._youWorldPos = new THREE.Vector3()
    this._youCamPos = new THREE.Vector3()
    this._lightWorldPos = new THREE.Vector3()
    this._lightCamPos = new THREE.Vector3()
    this.autoRotate = true
    this.disposed = false
    this.hidden = false
    this.lastFrame = 0
    this.frameMs = this.backdrop ? 42 : 0 // backdrop renders ~24fps, Earth view full speed
    this.peopleTarget = 0

    // Hardware-limited devices get fewer segments, no antialias, and
    // lower resolution so the scene stays smooth on budget phones.
    // prefers-reduced-motion is a separate flag: it only stops animation
    // (auto-rotation, twinkle, aurora) without degrading visual quality.
    this.reducedMotion = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
    this.lowPower = typeof navigator !== 'undefined' && navigator.hardwareConcurrency <= 4
    this.seg = this.lowPower ? 96 : 128 // sphere segments (was 192)

    const w = container.clientWidth || 1
    const h = container.clientHeight || 1

    this.scene = new THREE.Scene()

    this.camera = new THREE.PerspectiveCamera(this.backdrop ? 40 : 42, w / h, 0.1, 200)
    this.camera.position.set(0, this.backdrop ? 0 : 0.55, this.backdrop ? 4.7 : 4.6)
    this.camera.lookAt(0, 0, 0)

    this.renderer = new THREE.WebGLRenderer({ antialias: !this.lowPower, alpha: true })
    // base render resolution: modest cap on the earth view, low on the backdrop
    this.basePR = this.backdrop ? 1.25 : Math.min(window.devicePixelRatio, 2)
    if (this.lowPower) this.basePR = 1
    this.renderer.setPixelRatio(this.basePR)
    this.renderer.setSize(w, h)
    this.renderer.setClearColor(this.backdrop ? 0x040714 : 0x000000, this.backdrop ? 1 : 0)
    container.appendChild(this.renderer.domElement)

    // sun light for the earth shader â€” toward the camera so the day side faces us
    this.sunDir = new THREE.Vector3(0.35, 0.28, 0.89).normalize()
    // the prayer backdrop turns slowly and steadily so the silhouette feels
    // quietly alive behind the words
    this.rotVel = this.backdrop ? 0.004 : 0.0016

    // start facing Europe/Africa so recognizable geography greets the viewer
    this.earthGroupRotation = 1.25

    const loader = new THREE.TextureLoader()
    // The land mask is read by the full Earth shader and by the grid used to
    // keep every light on land. The prayer backdrop builds the small mask grid
    // too (it never uploads a texture) so its lights snap onto land the same
    // way — building only the tiny grid is fast and never froze slow devices.
    this.maskTex = this.buildLandMaskCanvas()
    // Try a dedicated land/ocean mask first; if it's not shipped, fall back to
    // classifying the day photo when it loads.
    this._maskPromise = this.loadLandMask()
    // The prayer backdrop only reads luminance from the map (land/coast
    // classification), so it gets a half-res texture — 70 KB instead of 501 KB
    // on every prayer view. The full-resolution map stays on the Earth view.
    const dayTex = loader.load(
      this.backdrop ? dayUrlSmall : dayUrl,
      async (tex) => {
        const usedMask = await this._maskPromise
        if (!usedMask) this.processLandMask(tex.image)
        tex.image = this.makeSeamless(tex.image)
        tex.needsUpdate = true
        this._dayLoaded = true
        // Lights can arrive before the texture/mask. Reapply the last map now
        // that strict land validation is available, otherwise an ocean cell
        // can remain at its original position until the next sync update.
        if (this._lastLights) this.setLights(this._lastLights, this._lastLightSpirits)
      },
      undefined,
      () => {
        this._dayLoaded = true
      }
    )
    dayTex.colorSpace = THREE.SRGBColorSpace
    dayTex.wrapS = THREE.RepeatWrapping
    this.dayTex = dayTex

    // Never let the loading overlay hang: even if a texture is slow or fails on
    // a low-end phone, show the Earth (slightly untextured) after a short wait.
    this._readyTimer = setTimeout(() => {
      if (!this._ready) {
        this._ready = true
        if (this.onReady) this.onReady()
      }
    }, 6000)

    this.earthGroup = new THREE.Group()
    this.earthGroup.rotation.y = this.earthGroupRotation

    if (this.backdrop) {
      this.buildSilhouette(dayTex)
      this.buildAtmosphere()
    } else {
      this.buildFullEarth(dayTex)
    }
    this.buildCloudShell()

    // --- people lights (on the surface, at real locations) ---
    this.lights = this.buildLights()
    this.earthGroup.add(this.lights.group)
    // a pulsing ring where the person here is praying from
    this.youMarker = this.buildYouMarker()
    this.earthGroup.add(this.youMarker)
    this.scene.add(this.earthGroup)
    // evolving halo + motes that unfold as the world climbs the ladder
    this.buildCorona()
    this.buildWisps()
    if (import.meta.env?.DEV) window.__earthScene = this

    if (!this.backdrop) {
      // --- orbiting little planets ---
      this.planets = this.buildPlanets()
      this.scene.add(this.planets.group)

      // --- drifting motes ---
      this.motes = this.buildMotes()
      this.scene.add(this.motes)

      // the moon, with its real phase, hangs in the sky
      this.moon = this.buildMoon()
      this.scene.add(this.moon)

      // sparks that shimmer out as collective prayer surges
      this.sparkPts = this.buildSparks()
      this.scene.add(this.sparkPts)

      this.raycastDrag()
    }

    // --- stars ---
    // The prayer-view backdrop keeps the field pure black behind the dark
    // spinning Earth — no starfield showing through from behind the globe.
    this.stars = this.backdrop ? null : this.buildStars(9000)
    if (this.stars) this.scene.add(this.stars)
    if (!this.backdrop) {
      this.nebulae = this.buildNebulae()
      this.scene.add(this.nebulae)
      this.scene.add(this.buildAuraRing())
      this.scene.add(this.buildShootingStar())
    }

    this.bindResize()
    this.bindVisibility()
    // the container may not have its final layout dimensions yet — a
    // ResizeObserver guarantees the canvas resizes as soon as the div settles
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => { if (this._resize) this._resize() })
      ro.observe(this.container)
      this._containerObserver = ro
    } else {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (this._resize) this._resize()
      }))
    }
    this.animate()
  }

  buildSilhouette(dayTex) {
    const geo = new THREE.SphereGeometry(1.42, 48, 32)
    this.earthMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: SIL_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uGlow: { value: this.glow },
        uDayTex: { value: dayTex }
      },
      transparent: true,
      depthWrite: false
    })
    this.earth = new THREE.Mesh(geo, this.earthMat)
    this.earthGroup.add(this.earth)
  }

  // A luminous atmosphere hugging the globe (backdrop view). Spun slower than
  // the planet so the glow feels like a real skinned, phase-driven sphere.
  buildAtmosphere() {
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(1.52, 48, 32),
      new THREE.ShaderMaterial({
        vertexShader: ATMO_VERT,
        fragmentShader: ATMO_FRAG,
        uniforms: { uGlow: { value: this.glow }, uTime: { value: 0 }, uSurge: { value: 0 }, uDim: { value: 0.12 } },
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false
      })
    )
    this.atmo = atmo
    this.earthGroup.add(atmo)

    const ether = new THREE.Mesh(
      new THREE.SphereGeometry(1.95, 40, 28),
      new THREE.ShaderMaterial({
        vertexShader: ATMO_VERT,
        fragmentShader: ETHEREAL_FRAG,
        uniforms: { uGlow: { value: this.glow }, uTime: { value: 0 }, uSurge: { value: 0 }, uDim: { value: 0.12 } },
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false
      })
    )
    this.ether = ether
    this.earthGroup.add(ether)
  }

  buildFullEarth(dayTex) {
    const geo = new THREE.SphereGeometry(1.42, this.seg, this.seg)
    this.earthMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uGlow: { value: this.glow },
        uSunDir: { value: this.sunDir },
        uDayTex: { value: dayTex },
        uMaskTex: { value: this.maskTex },
        uSurge: { value: 0 },
        uTier: { value: 0 }
      }
    })
    this.earth = new THREE.Mesh(geo, this.earthMat)
    this.earthGroup.add(this.earth)

    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(1.52, 64, 64),
      new THREE.ShaderMaterial({
        vertexShader: ATMO_VERT,
        fragmentShader: ATMO_FRAG,
        uniforms: { uGlow: { value: this.glow }, uTime: { value: 0 }, uSurge: { value: 0 }, uDim: { value: 1 } },
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false
      })
    )
    this.atmo = atmo
    this.earthGroup.add(atmo)

    // A wide, soft outer halo for the magical, etheric feel.
    const ether = new THREE.Mesh(
      new THREE.SphereGeometry(2.15, 48, 32),
      new THREE.ShaderMaterial({
        vertexShader: ATMO_VERT,
        fragmentShader: ETHEREAL_FRAG,
        uniforms: { uGlow: { value: this.glow }, uTime: { value: 0 }, uSurge: { value: 0 }, uDim: { value: 1 } },
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false
      })
    )
    this.ether = ether
    this.earthGroup.add(ether)
  }

  // A semitransparent cloud shell built from procedural noise — organic wisps
  // and bands that drift over time, at near-zero performance cost (one extra
  // draw call, a handful of noise instructions per pixel).
  buildCloudShell() {
    const geo = new THREE.SphereGeometry(1.47, 96, 64)
    const mat = new THREE.ShaderMaterial({
      vertexShader: CLOUD_VERT,
      fragmentShader: CLOUD_FRAG,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false
    })
    this.cloudShell = new THREE.Mesh(geo, mat)
    this.cloudShell.renderOrder = 1
    this.earthGroup.add(this.cloudShell)
  }

  // A soft, phase-accurate moon glowing in the sky. The lit sliver follows the
  // real lunar cycle (roughly, we skip the exact limb position).
  buildMoon() {
    const S = 160
    const c = document.createElement('canvas')
    c.width = S
    c.height = S
    const ctx = c.getContext('2d')
    const days = (Date.now() / 86400000 - 10957.76) % 29.53058867
    const phase = ((days + 29.53058867) % 29.53058867) / 29.53058867
    const R = S * 0.3
    // soft moon-halo
    const halo = ctx.createRadialGradient(S / 2, S / 2, R * 0.4, S / 2, S / 2, R * 1.6)
    halo.addColorStop(0, 'rgba(225, 220, 200, 0.28)')
    halo.addColorStop(1, 'rgba(225, 220, 200, 0)')
    ctx.fillStyle = halo
    ctx.fillRect(0, 0, S, S)
    // the moon disc (dark unlit side first)
    ctx.beginPath()
    ctx.arc(S / 2, S / 2, R, 0, Math.PI * 2)
    ctx.fillStyle = '#3f4350'
    ctx.fill()
    // lit crescent: overlap a bright circle offset by the terminator
    const off = (2 * phase - 1) * R * 2.6
    const g = ctx.createRadialGradient(S / 2 + off, S / 2 - R * 0.2, R * 0.2, S / 2, S / 2, R)
    g.addColorStop(0, '#fdf8e6')
    g.addColorStop(0.7, '#ece3c6')
    g.addColorStop(1, '#d9d0b0')
    ctx.save()
    ctx.beginPath()
    ctx.arc(S / 2, S / 2, R, 0, Math.PI * 2)
    ctx.clip()
    ctx.fillStyle = g
    ctx.beginPath()
    ctx.arc(S / 2 + off, S / 2, R, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    // a few gentle craters so the moon reads as a world, not a flat disc
    ctx.save()
    ctx.beginPath()
    ctx.arc(S / 2, S / 2, R, 0, Math.PI * 2)
    ctx.clip()
    const craters = [
      [S * 0.42, S * 0.44, 7], [S * 0.55, S * 0.58, 5], [S * 0.48, S * 0.38, 4],
      [S * 0.6, S * 0.42, 3.5], [S * 0.38, S * 0.55, 3]
    ]
    for (const [cx, cy, cr] of craters) {
      const cg = ctx.createRadialGradient(cx, cy, cr * 0.2, cx, cy, cr)
      cg.addColorStop(0, 'rgba(90, 92, 110, 0.35)')
      cg.addColorStop(1, 'rgba(90, 92, 110, 0)')
      ctx.fillStyle = cg
      ctx.beginPath()
      ctx.arc(cx, cy, cr, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.restore()
    const tex = new THREE.CanvasTexture(c)
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
    const spr = new THREE.Sprite(mat)
    spr.scale.set(0.72, 0.72, 1)
    spr.position.set(-3.6, 2.5, -1.6)
    return spr
  }

// Little sparks that shimmer out from the globe as collective prayer surges.
// Each one carries its own phase so the aura twinkles in and out gently,
// always alive around the Earth.
  buildSparks() {
    const N = this.lowPower ? 90 : 340
    const pos = new Float32Array(N * 3)
    const col = new Float32Array(N * 3)
    this.sparkDir = new Float32Array(N * 3)
    this.sparkPhase = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      const th = Math.random() * Math.PI * 2
      const ph = Math.acos(2 * Math.random() - 1)
      const x = Math.sin(ph) * Math.cos(th)
      const y = Math.cos(ph)
      const z = Math.sin(ph) * Math.sin(th)
      this.sparkDir[i * 3] = x
      this.sparkDir[i * 3 + 1] = y
      this.sparkDir[i * 3 + 2] = z
      this.sparkPhase[i] = Math.random() * Math.PI * 2
      // a mix of warm gold and luminous azure, so the aura feels celestial
      const warm = Math.random() < 0.55
      col[i * 3] = warm ? 1 : 0.55
      col[i * 3 + 1] = warm ? 0.92 : 0.82
      col[i * 3 + 2] = warm ? 0.62 : 1
      // float clearly above the surface so the aura reads as a halo ring around
      // the globe, never as dots speckling its face
      const r = 1.75 + Math.random() * 0.22
      pos[i * 3] = x * r
      pos[i * 3 + 1] = y * r
      pos[i * 3 + 2] = z * r
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    g.setAttribute('aPhase', new THREE.BufferAttribute(this.sparkPhase, 1))
    const m = new THREE.ShaderMaterial({
      vertexShader: SPARK_VERT,
      fragmentShader: SPARK_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0 },
        uSwell: { value: 0 },
        uDpr: { value: this.renderer ? this.renderer.getPixelRatio() : 1 }
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true
    })
    const pts = new THREE.Points(g, m)
    this.sparkPos = pos
    this.sparkMat = m
    return pts
  }

  // A soft golden halo that blooms around the whole Earth at high ladder rungs.
  buildCorona() {
    const S = 256
    const c = document.createElement('canvas')
    c.width = c.height = S
    const g = c.getContext('2d')
    const gr = g.createRadialGradient(S / 2, S / 2, 18, S / 2, S / 2, S / 2)
    gr.addColorStop(0, 'rgba(255, 244, 210, 0)')
    gr.addColorStop(0.34, 'rgba(255, 226, 168, 0.26)')
    gr.addColorStop(0.68, 'rgba(196, 182, 255, 0.14)')
    gr.addColorStop(1, 'rgba(120, 168, 255, 0)')
    g.fillStyle = gr
    g.fillRect(0, 0, S, S)
    const tex = new THREE.CanvasTexture(c)
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false
    })
    const spr = new THREE.Sprite(mat)
    spr.scale.set(3.2, 3.2, 1)
    spr.visible = false
    this.coronaSpr = spr
    this.scene.add(spr)
  }

  // Gentle golden motes that drift around the Earth at the highest rungs, a
  // soft "healing" shimmer over the whole scene.
  buildWisps() {
    const N = this.lowPower ? 60 : 150
    const pos = new Float32Array(N * 3)
    this.wispDir = new Float32Array(N * 3)
    this.wispPhase = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      const th = Math.random() * Math.PI * 2
      const ph = Math.acos(2 * Math.random() - 1)
      const x = Math.sin(ph) * Math.cos(th)
      const y = Math.cos(ph)
      const z = Math.sin(ph) * Math.sin(th)
      this.wispDir[i * 3] = x
      this.wispDir[i * 3 + 1] = y
      this.wispDir[i * 3 + 2] = z
      this.wispPhase[i] = Math.random() * Math.PI * 2
      const r = 1.7 + Math.random() * 1.2
      pos[i * 3] = x * r
      pos[i * 3 + 1] = y * r
      pos[i * 3 + 2] = z * r
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    const col = new Float32Array(N * 3)
    for (let i = 0; i < N; i++) {
      col[i * 3] = 1
      col[i * 3 + 1] = 0.94
      col[i * 3 + 2] = 0.8
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    geo.setAttribute('aPhase', new THREE.BufferAttribute(this.wispPhase, 1))
    const mat = new THREE.ShaderMaterial({
      vertexShader: SPARK_VERT,
      fragmentShader: SPARK_FRAG,
      uniforms: {
        uTime: { value: 0 },
        uOpacity: { value: 0 },
        uSwell: { value: 0 },
        uDpr: { value: this.renderer ? this.renderer.getPixelRatio() : 1 }
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: true
    })
    const pts = new THREE.Points(geo, mat)
    this.wispPts = pts
    this.wispPos = pos
    this.wispMat = mat
    this.scene.add(pts)
  }

  // A pulsing golden ring marking where the person here is praying from.
  buildYouMarker() {
    const S = 128
    const c = document.createElement('canvas')
    c.width = c.height = S
    const g = c.getContext('2d')
    g.clearRect(0, 0, S, S)
    g.strokeStyle = 'rgba(255, 244, 200, 1)'
    g.lineWidth = 7
    g.beginPath()
    g.arc(S / 2, S / 2, S / 2 - 8, 0, Math.PI * 2)
    g.stroke()
    g.fillStyle = 'rgba(255, 244, 200, 0.95)'
    g.beginPath()
    g.arc(S / 2, S / 2, 9, 0, Math.PI * 2)
    g.fill()
    const tex = new THREE.CanvasTexture(c)
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      // depth-tested so the ring is hidden when your location is on the far
      // side of the Earth (the world's prayer lights still show through, but
      // your own marker should not)
      depthTest: true,
      blending: THREE.AdditiveBlending,
      opacity: 0
    })
    const spr = new THREE.Sprite(mat)
    spr.scale.set(0.42, 0.42, 0.42)
    spr.visible = false
    this.youMarker = spr
    return spr
  }

  // Where the person here is praying from (or null to hide). The marker rides
  // the globe's surface and pulses in the animate loop.
  setYouLoc(loc) {
    this.youLoc = loc
    if (!this.youMarker) return
    // A coarse geolocation can be wildly wrong (VPN/ISP in the ocean) — never
    // float "you are here" out at sea; snap to the nearest land instead.
    if (!loc) {
      this.youMarker.visible = false
      return
    }
    let latG = loc.lat
    let lonG = loc.lon
    if (this.isDeepOcean(latG, lonG)) {
      const snap = this.snapToLand(latG, lonG)
      if (!snap) {
        this.youMarker.visible = false
        return
      }
      latG = snap.lat
      lonG = snap.lon
    }
    const lat = latG * (Math.PI / 180)
    const lon = lonG * (Math.PI / 180)
    const r = 1.44
    this.youMarker.position.set(
      r * Math.cos(lat) * Math.cos(lon),
      r * Math.sin(lat),
      r * Math.cos(lat) * Math.sin(lon)
    )
    this.youMarker.visible = true
  }

  // A soft radial glow texture shared by all prayer lights.
  buildLightGlowTexture() {
    const S = 64
    const c = document.createElement('canvas')
    c.width = S
    c.height = S
    const ctx = c.getContext('2d')
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
    g.addColorStop(0, 'rgba(255, 255, 255, 1)')
    g.addColorStop(0.06, 'rgba(255, 255, 255, 1)')
    g.addColorStop(0.22, 'rgba(255, 255, 255, 0.85)')
    g.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)')
    g.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, S, S)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }

  // Blend the left and right edges of an equirectangular image so it wraps
  // around the sphere with no seam at the anti-meridian (Pacific).
  makeSeamless(img, blendPx = 3) {
    try {
      const w = img.naturalWidth || img.width
      const h = img.naturalHeight || img.height
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      const ctx = c.getContext('2d')
      ctx.drawImage(img, 0, 0)
      const d = ctx.getImageData(0, 0, w, h).data
      const out = new Uint8ClampedArray(d)
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < blendPx; x++) {
          const li = (y * w + x) * 4
          const ri = (y * w + w - 1 - x) * 4
          for (let k = 0; k < 4; k++) {
            const v = (d[li + k] + d[ri + k]) >> 1
            out[li + k] = v
            out[ri + k] = v
          }
        }
      }
      ctx.putImageData(new ImageData(out, w, h), 0, 0)
      return c
    } catch {
      return img
    }
  }

  // A clean binary land/ocean mask, classified once in JS from the real map
  // (where dark forests and ice read as land even though they look bluish).
  buildLandMaskCanvas(scale = null) {
    // Low-power devices get a half-res mask — a fraction of the pixel work for
    // the same coastline, since the mask is upsampled by the GPU anyway. The
    // prayer backdrop only needs the grid to snap ocean lights onto land, so
    // it builds half that scale again (fast, and never uploaded as a texture).
    const S = scale ?? (this.backdrop ? 0.25 : this.lowPower ? 0.5 : 1)
    const W = Math.round(2048 * S)
    const H = Math.round(1024 * S)
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    this._maskCtx = c.getContext('2d')
    this._maskData = this._maskCtx.createImageData(W, H)
    // Strict snap mask: classifies the same texture with a tighter rule so
    // turbid/clouded open ocean never reads as land. It drives where a prayer
    // light is allowed to sit, while the generous mask above keeps continents
    // rendering as land even where the texture looks bluish.
    this._snap = this._maskCtx.createImageData(W, H)
    if (this.backdrop) return null
    this.maskTex = new THREE.CanvasTexture(c)
    this.maskTex.colorSpace = THREE.NoColorSpace
    // Wraps horizontally so there's no seam at the anti-meridian (Pacific).
    this.maskTex.wrapS = THREE.RepeatWrapping
    return this.maskTex
  }

  // A dedicated land/ocean mask texture (white=land, black=ocean) shipped at
  // /land-mask.png. When present it replaces the fragile RGB classification of
  // the day photo — clouds, sediment-laden shallow seas, and snow no longer
  // confuse the coastline. Falls back to processLandMask() when absent.
  loadLandMask() {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        try {
          this.fillMaskFromImage(img)
          resolve(true)
        } catch (e) {
          console.warn('land-mask decode failed — falling back to RGB', e)
          resolve(false)
        }
      }
      img.onerror = () => resolve(false)
      img.src = '/land-mask.png'
    })
  }

  // Scales a land/ocean mask image to the working resolution, fills both the
  // render mask and the strict snap mask, then rebuilds the light-snap grid.
  fillMaskFromImage(img) {
    const W = this._maskData.width
    const H = this._maskData.height
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const ctx = c.getContext('2d')
    ctx.drawImage(img, 0, 0, W, H)
    const id = ctx.getImageData(0, 0, W, H)
    this._maskData.data.set(id.data)
    this._snap.data.set(id.data)
    this.buildSnapComponents()
    this._maskCtx.putImageData(this._maskData, 0, 0)
    if (this.maskTex) this.maskTex.needsUpdate = true
  }

  // Ancillary: after the strict snap mask is built, flood-fill connected
  // components on its 1-degree grid so lights only ever sit on a real landmass.
  // A 1-degree cell is "trusted" (lightable) when its centre pixel reads as
  // land AND its component is a genuine feature — a continent/island of >= 5
  // cells, or a cell within 1 degree of a known inhabited town (so real towns
  // on small far islands still work). Isolated 1-2 cell ocean specks (cloud
  // shadow, turbid banks) stay untrusted, so a prayer light snaps to a real
  // coast instead of floating at sea.
  buildSnapComponents() {
    if (!this._snap) return
    const W = this._snap.width
    const H = this._snap.height
    if (!W || !H) return
    const ROWS = 180
    const COLS = 360
    const LAT_TOP = 90
    const at = (la, lo) => {
      const my = Math.floor(((LAT_TOP - la) / 180) * H)
      const mx = Math.floor(((((lo + 180) % 360) + 360) % 360) / 360 * W) % W
      return this._snap.data[(my * W + mx) * 4] > 96
    }
    // Build the 1-degree land grid from the strict snap mask. The snap mask
    // already applied the arctic-ice cut and edge softening, so a cell here
    // is land exactly when its centre pixel reads as solid land.
    const grid = new Uint8Array(ROWS * COLS)
    for (let r = 0; r < ROWS; r++) {
      const la = LAT_TOP - r
      for (let c = 0; c < COLS; c++) {
        if (at(la, c - 180)) grid[r * COLS + c] = 1
      }
    }
    // A known inhabited place is always lightable even when its centre pixel
    // sits on grey urban texture (asphalt, concrete — low saturation that the
    // strict classifier rejects). Force only the city cell itself; the city
    // trust pass below already marks its component as lightable regardless of
    // size, so forcing neighbours would only spill lightable cells into the ocean.
    for (const [la0, lo0] of SNAP_CITIES) {
      const cr = Math.min(ROWS - 1, Math.max(0, LAT_TOP - Math.round(la0)))
      const cc = ((Math.round(lo0) + 180) % COLS + COLS) % COLS
      grid[cr * COLS + cc] = 1
    }
    const comp = new Int32Array(ROWS * COLS).fill(-1)
    const sizes = []
    let cid = 0
    for (let i = 0; i < ROWS * COLS; i++) {
      if (!grid[i] || comp[i] !== -1) continue
      comp[i] = cid
      const stack = [i]
      let size = 0
      while (stack.length) {
        const ci = stack.pop()
        const r = (ci / COLS) | 0
        const c = ci % COLS
        size++
        const nb = []
        if (r > 0) nb.push(ci - COLS)
        if (r < ROWS - 1) nb.push(ci + COLS)
        nb.push(c > 0 ? ci - 1 : ci + COLS - 1)
        nb.push(c < COLS - 1 ? ci + 1 : ci - COLS + 1)
        for (const ni of nb) {
          if (grid[ni] && comp[ni] === -1) { comp[ni] = cid; stack.push(ni) }
        }
      }
      sizes.push(size)
      cid++
    }
    // A component is trusted once it is big enough to be a real landmass...
    const trusted = new Uint8Array(cid)
    for (let i = 0; i < cid; i++) if (sizes[i] >= 5) trusted[i] = 1
    // ...and towns on small islands are trusted by their component alone, so
    // islanders who live on a tiny atoll still get a light of their own.
    for (const [la0, lo0] of SNAP_CITIES) {
      const r = Math.min(ROWS - 1, Math.max(0, LAT_TOP - Math.round(la0)))
      const c = ((Math.round(lo0) + 180) % COLS + COLS) % COLS
      for (let dr = -1; dr <= 1; dr++) {
        const rr = r + dr
        if (rr < 0 || rr >= ROWS) continue
        for (let dc = -1; dc <= 1; dc++) {
          const cc = ((c + dc) % COLS + COLS) % COLS
          const id = comp[rr * COLS + cc]
          if (id !== -1) trusted[id] = 1
        }
      }
    }
    this._snapComp = comp
    this._snapCompSize = sizes
    this._snapCompTrusted = trusted
    this._snapCompRows = ROWS
    this._snapCompCols = COLS
  }

  processLandMask(img) {
    try {
      const c2 = document.createElement('canvas')
      c2.width = img.naturalWidth || img.width
      c2.height = img.naturalHeight || img.height
      const ctx2 = c2.getContext('2d')
      ctx2.drawImage(img, 0, 0)
      const d = ctx2.getImageData(0, 0, c2.width, c2.height).data
      this._daySrc = d
      this._daySrcW = c2.width
      this._daySrcH = c2.height
      const W = this._maskData.width
      const H = this._maskData.height
      const out = this._maskData.data
// Treat the frozen Arctic Ocean (the polar ice cap, ~north of 82N) as
// ocean, not land — its bright ice would otherwise read as a huge arctic
// landmass. Real northern land (Siberia, Canada, Greenland) sits south
// of this band and stays.
const arcticRow = Math.floor((H * 10) / 180)
      for (let y = 0; y < H; y++) {
        const sy = Math.floor((y / H) * c2.height)
        for (let x = 0; x < W; x++) {
          const sx = Math.floor((x / W) * c2.width)
          const i = (sy * c2.width + sx) * 4
          const r = d[i] / 255
          const g = d[i + 1] / 255
          const b = d[i + 2] / 255
          const lum = 0.299 * r + 0.587 * g + 0.114 * b
          const gb = g - b
          // bright land (desert/ice) must not be blue; darker land (forest) must
          // be dim and not turquoise, keeps shallow straits from bridging land.
          // Water is strongly blue-dominant (gb deeply negative, b high); open
          // ocean reads as deep blue, so the bright/dark land rules reject it.
          const brightLand = lum > 0.2 && gb > -0.01
          const darkLand = lum <= 0.2 && lum > 0.08 && gb > -0.08 && b < 0.28
          const land = y < arcticRow ? 0 : brightLand || darkLand ? 255 : 0
          const o = (y * W + x) * 4
          out[o] = out[o + 1] = out[o + 2] = land
          out[o + 3] = 255
        }
      }
      // fill enclosed water "lakes" inside continents so they read as solid
      // shapes (large real seas are left alone). Flood the open ocean from the
      // borders, then fill any enclosed water region smaller than the cap.
      {
        const isLand = (i) => out[i * 4] > 128
        const visited = new Uint8Array(W * H)
        const stack = []
        const seed = (i) => { if (!visited[i] && !isLand(i)) { visited[i] = 1; stack.push(i) } }
        for (let x = 0; x < W; x++) { seed(x); seed((H - 1) * W + x) }
        for (let y = 0; y < H; y++) { seed(y * W); seed(y * W + W - 1) }
        while (stack.length) {
          const i = stack.pop()
          const x = i % W, y = (i / W) | 0
          const n = [
            x > 0 ? i - 1 : i + W - 1,
            x < W - 1 ? i + 1 : i - W + 1,
            y > 0 ? i - W : -1,
            y < H - 1 ? i + W : -1
          ]
          for (const ni of n) {
            if (ni >= 0 && !visited[ni] && !isLand(ni)) { visited[ni] = 1; stack.push(ni) }
          }
        }
        const MAX_LAKE = Math.round((W * H) / 800)
        const seen = new Uint8Array(W * H)
        for (let i = 0; i < W * H; i++) {
          if (seen[i] || isLand(i) || visited[i]) continue
          const region = []
          const q = [i]
          seen[i] = 1
          while (q.length) {
            const c = q.pop()
            region.push(c)
            const x = c % W, y = (c / W) | 0
            const n = [
              x > 0 ? c - 1 : -1,
              x < W - 1 ? c + 1 : -1,
              y > 0 ? c - W : -1,
              y < H - 1 ? c + W : -1
            ]
            for (const ni of n) {
              if (ni >= 0 && !seen[ni] && !isLand(ni) && !visited[ni]) { seen[ni] = 1; q.push(ni) }
            }
          }
          if (region.length < MAX_LAKE) {
            for (const c of region) {
              const o = c * 4
              out[o] = out[o + 1] = out[o + 2] = 255
            }
          }
        }
      }
      // soften the mask edges so coastlines render smooth instead of blocky
      const soft = new Uint8ClampedArray(out.length)
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          let s = 0
          for (let dy = -1; dy <= 1; dy++) {
            const ny = Math.max(0, Math.min(H - 1, y + dy))
            for (let dx = -1; dx <= 1; dx++) {
              const nx = (x + dx + W) % W
              s += out[(ny * W + nx) * 4]
            }
          }
          const v = s / 9
          const o = (y * W + x) * 4
          soft[o] = soft[o + 1] = soft[o + 2] = v
          soft[o + 3] = 255
        }
      }
      out.set(soft)
      // light erosion: a pixel stays land only when it is solidly inside land,
      // which pulls thin spits + false blobs out of the open ocean so a prayer
      // light can never sit at sea
      {
        const er = new Uint8ClampedArray(out.length)
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            let s = 0
            for (let dy = -1; dy <= 1; dy++) {
              const ny = Math.max(0, Math.min(H - 1, y + dy))
              for (let dx = -1; dx <= 1; dx++) {
                const nx = (x + dx + W) % W
                if (out[(ny * W + nx) * 4] > 128) s++
              }
            }
            const o = (y * W + x) * 4
            const isLand = s >= 5
            er[o] = er[o + 1] = er[o + 2] = isLand ? 255 : 0
            er[o + 3] = 255
          }
        }
        out.set(er)
      }
      // make the wrap seam exact: the first and last columns must match so no
      // vertical line appears where the map wraps around the Pacific
      for (let y = 0; y < H; y++) {
        const last = y * W + W - 1
        out[last * 4] = out[last * 4 + 1] = out[last * 4 + 2] = out[(y * W) * 4]
      }
      // Strict snap mask (separate from the rendered land mask): the generous
      // rule above lets turbid/clouded deep-ocean cells read as land, which is
      // fine for drawing continents but would float a prayer light at sea. This
      // tighter classifier rejects those blue-teal cells, so `isDeepOcean` uses
      // it to decide where lights may sit.
      {
        const snap = this._snap.data
        const raw = new Uint8ClampedArray(W * H * 4)
        for (let y = 0; y < H; y++) {
          const sy = Math.floor((y / H) * c2.height)
          for (let x = 0; x < W; x++) {
            const sx = Math.floor((x / W) * c2.width)
            const i = (sy * c2.width + sx) * 4
            const r = d[i] / 255
            const g = d[i + 1] / 255
            const b = d[i + 2] / 255
            const lum = 0.299 * r + 0.587 * g + 0.114 * b
            const gb = g - b
            // Land has real colour (green vegetation, brown soil, sand) — so
            // require chromatic saturation. Storm clouds over the open ocean
            // are neutral grey (r≈g≈b), so they fail this and never read as
            // land; a prayer light can never float inside a weather system.
            const sat = Math.max(r, g, b) - Math.min(r, g, b)
            // bright land above; dark land requires a greener, less blue cast
            // than the full moon so open-ocean bands (deeply blue) fail
            const bright = lum > 0.2 && gb > -0.01 && sat > 0.06
            const dark = lum <= 0.2 && lum > 0.08 && gb > -0.05 && b < 0.23 && sat > 0.06
            const land = y < arcticRow ? 0 : bright || dark ? 255 : 0
            const o = (y * W + x) * 4
            raw[o] = raw[o + 1] = raw[o + 2] = land
            raw[o + 3] = 255
          }
        }
        // soften edges the same way as the render mask, but skip erosion so a
        // genuine small island (Singapore, an atoll) still counts as land when
        // its centre pixel is solidly on land
        const soft = new Uint8ClampedArray(raw.length)
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            let s = 0
            for (let dy = -1; dy <= 1; dy++) {
              const ny = Math.max(0, Math.min(H - 1, y + dy))
              for (let dx = -1; dx <= 1; dx++) {
                const nx = (x + dx + W) % W
                s += raw[(ny * W + nx) * 4]
              }
            }
            const v = s / 9
            const o = (y * W + x) * 4
            soft[o] = soft[o + 1] = soft[o + 2] = v
            soft[o + 3] = 255
          }
        }
        for (let y = 0; y < H; y++) {
          const last = y * W + W - 1
          snap[last * 4] = snap[last * 4 + 1] = snap[last * 4 + 2] = soft[(y * W) * 4]
        }
        snap.set(soft)
      }
      // Connected components over the strict snap grid (1-degree cells). A
      // light is only ever trusted when its cell belongs to a real landmass:
      // a continent, a genuine island, or a known city's cell. Anything that
      // reads as land but is an isolated speck in the open ocean is dropped,
      // so a prayer light can never float at sea.
      this.buildSnapComponents()
      this._maskCtx.putImageData(this._maskData, 0, 0)
      if (this.maskTex) this.maskTex.needsUpdate = true
    } catch (e) {
      // If the strict classifier fails, clear _snap so isDeepOcean falls back
      // to the conservative rule — never let a code error float lights at sea.
      this._snap = null
      this._snapComp = null
      this._snapCompTrusted = null
      console.warn('processLandMask failed — strict snap disabled', e)
    }
  }

  buildLights() {
    const glow = this.buildLightGlowTexture()
    this.lightGlowTex = glow
    this.lightKeys = buildLightKeys()
    // Float clearly above the surface so a light's glow is never clipped by the
    // sphere as it rounds the limb — it fades out smoothly instead of losing a
    // piece. Depth-test is on, so far-side lights are still hidden by the globe.
    const r = 1.5
    const pool = []
    const MAX = 256
    for (let i = 0; i < MAX; i++) {
      const mat = new THREE.SpriteMaterial({
        map: glow,
        transparent: true,
        depthWrite: false,
        // Depth-tested so lights on the far side of the planet are hidden by
        // the globe itself — never a see-through glow of the "other side".
        depthTest: true,
        blending: THREE.AdditiveBlending,
        opacity: 0
      })
      const spr = new THREE.Sprite(mat)
      spr.visible = false
      // Render above the translucent cloud shell (renderOrder 1) so a light's
      // glow sits on top of the clouds instead of being washed out beneath them.
      spr.renderOrder = 2
      spr.userData.lat = 0
      spr.userData.lon = 0
      pool.push(spr)
    }
    const group = new THREE.Group()
    group.add(...pool)
    return { group, pool, r, MAX }
  }

  // True when a grid cell sits over open water. A prayer light only appears
  // when its cell's exact centre is on land — anything floating at sea, even
  // just offshore, is dropped. A "land" cell is trusted only when it is solidly
  // part of a real landmass: an isolated speck the mask picked up in the open
  // ocean still counts as water, so a light can never float there (coarse VPN
  // geolocation that lands mid-ocean snaps to the nearest real coast).
  isDeepOcean(latDeg, lonDeg) {
    // The strict snap mask decides where lights may sit. It classifies the
    // texture with a tighter rule than the rendered land mask, so clouded or
    // turbid deep-ocean cells (which the render mask keeps as land) still read
    // as water here and a prayer light can never float mid-ocean.
    const m = this._snap || this._maskData
    if (!m) return false
    // lights sit on the integer 1-degree grid, so evaluate the rounded cell
    const la = Math.max(-89, Math.min(89, Math.round(latDeg)))
    const lon = Math.round(lonDeg)
    // Never use the generous render mask as a light-placement authority. Until
    // the strict component map exists, defer placement to the later reapply
    // after the texture loads; this prevents cloud/ocean pixels from flashing
    // as land during startup or after a classifier failure.
    if (!this._snapCompTrusted) return true
    if (this._snapCompTrusted) {
      // Trust map: built once over connected components, so only genuine
      // landmasses (or known inhabited islands) are lightable. An isolated
      // speck in the open ocean is water, and the prayer light snaps to a
      // real coast instead of floating at sea.
      const ROWS = this._snapCompRows
      const COLS = this._snapCompCols
      const r = Math.min(ROWS - 1, Math.max(0, 90 - la))
      const c = ((lon + 180) % COLS + COLS) % COLS
      const id = this._snapComp[r * COLS + c]
      if (!(id >= 0 && this._snapCompTrusted[id])) return true
      // The classifier may still flag a turbid shallow bank or sediment plume as
      // land. Double-check the raw source texture pixel: if it is unmistakably
      // ocean (blue-dominant, dark, or a grey storm cloud), treat it as deep.
      const d = this._daySrc, dw = this._daySrcW, dh = this._daySrcH
      if (d && dw && dh) {
        const u = ((lon + 180) % 360) / 360
        const v = (90 - la) / 180
        const sx = Math.min(dw - 1, Math.max(0, Math.floor(u * dw)))
        const sy = Math.min(dh - 1, Math.max(0, Math.floor(v * dh)))
        const o = (sy * dw + sx) * 4
        const rr = d[o] / 255, gg = d[o + 1] / 255, bb = d[o + 2] / 255
        const slum = 0.299 * rr + 0.587 * gg + 0.114 * bb
        const ssat = Math.max(rr, gg, bb) - Math.min(rr, gg, bb)
        // storm cloud: bright, near-grey, almost no colour
        if (slum > 0.3 && ssat < 0.06) return true
        // deep ocean: dark-blue dominant
        if (slum < 0.18 && bb > rr && bb > gg && bb - rr > 0.04) return true
        // turbid/sediment water: slightly brighter but still blue-tinted and
        // not actually land-coloured
        if (slum < 0.32 && bb > rr && bb > gg && ssat < 0.22 && bb - Math.min(rr, gg) > 0.06) return true
        // Any cell whose pixel is blue-dominant (ocean signature) and far from
        // any known inhabited place is treated as deep ocean — final guardrail.
        let nearCity = false
        if (bb > gg) {
          for (const [cla, clo] of SNAP_CITIES) {
            if (Math.abs(cla - la) <= 4 && Math.abs(clo - lon) <= 4) { nearCity = true; break }
          }
          if (!nearCity) return true
        }
        // grey-pixel far from any city → storm cloud over open ocean
        if (ssat < 0.06 && slum > 0.2) {
          if (!nearCity) {
            for (const [cla, clo] of SNAP_CITIES) {
              if (Math.abs(cla - la) <= 4 && Math.abs(clo - lon) <= 4) { nearCity = true; break }
            }
          }
          if (!nearCity) return true
        }
        // Geographic guardrail: open Atlantic basin (lon -70..-10, covering the
        // entire Atlantic west-to-east, excluding the coastal Americas and Europe)
        // — any cell here more than 4° from a known city is open ocean.
        if (lon >= -70 && lon <= -10) {
          if (!nearCity) {
            for (const [cla, clo] of SNAP_CITIES) {
              if (Math.abs(cla - la) <= 4 && Math.abs(clo - lon) <= 4) { nearCity = true; break }
            }
          }
          if (!nearCity) return true
        }
      }
      return false
    }
    const my = Math.floor(((90 - la) / 180) * m.height)
    const mx = Math.floor(((((lon + 180) % 360) + 360) % 360) / 360 * m.width) % m.width
    if (my < 0 || my >= m.height) return true
    const at = (y, x) => m.data[(((y + m.height) % m.height) * m.width + ((x % m.width) + m.width) % m.width) * 4]
    // the centre pixel must read as solid land (mask is blurred at edges, so
    // 96 is safely inside solid land)
    if (at(my, mx) <= 96) return true
    // the cell says land — trust it only when surrounded by real land bytes. A
    // lone speck in the ocean (cloud shadow, shallow shelf) must still snap to
    // the coast; genuine small islands next to land keep at least two solid
    // neighbours.
    const sup =
      (at(my - 1, mx) > 96 ? 1 : 0) +
      (at(my + 1, mx) > 96 ? 1 : 0) +
      (at(my, mx - 1) > 96 ? 1 : 0) +
      (at(my, mx + 1) > 96 ? 1 : 0)
    return sup < 2
  }

  // Finds the nearest land cell, so a prayer that landed over water still shows
  // its light on nearby land instead of floating at sea. Deep mid-ocean cells
  // snap to a gentle global anchor (a real city) so the light always lands.
  snapToLand(lat, lon) {
    for (let d = 0; d <= 6; d++) {
      for (let dl = -d; dl <= d; dl++) {
        for (let dn = -d; dn <= d; dn++) {
          const la = lat + dl
          const lo = ((lon + dn + 180) % 360) - 180
          if (!this.isDeepOcean(la, lo)) return { lat: la, lon: lo }
        }
      }
    }
    // far from any coast: land on the nearest real city so the prayer still
    // shows a light on land
    const ANCHORS = [
      [40.7, -74.0], [51.5, -0.1], [35.7, 139.7], [28.6, 77.2], [-23.5, -46.6],
      [31.2, 121.5], [19.1, 72.9], [1.4, 103.8], [30.0, 31.2], [-34.6, -58.4],
      [52.5, 13.4], [39.9, 116.4], [-33.9, 151.2], [37.8, -122.4]
    ]
    let best = null
    let bestD = Infinity
    for (const [la, lo] of ANCHORS) {
      const dLa = Math.abs(la - lat)
      const dLo = Math.min(Math.abs(lo - lon), 360 - Math.abs(lo - lon))
      const dd = dLa + dLo
      if (dd < bestD) {
        bestD = dd
        best = { lat: la, lon: lo }
      }
    }
    return best
  }

  // Reuse the sprite pool: position/scale/colour one per active grid cell.
  // The colour comes from the cell's dominant tradition, so the world's lights
  // glow by faith; unknown cells glow warm gold. `active` marks the cell so the
  // per-frame facing cull in animate() shows/hides each light cleanly.
  setLights(map, spirits) {
    if (!this.lights) return
    this._lastLights = map || {}
    this._lastLightSpirits = spirits || {}
    const { pool, r, MAX } = this.lights
    let used = 0
    for (let i = 0; i < this.lightKeys.length; i++) {
      const k = this.lightKeys[i]
      const n = map ? map[k] : 0
      if (!n) continue
      const spr = pool[used]
      if (!spr) break
      const c = k.indexOf(',')
      const latDeg = parseFloat(k.slice(0, c))
      const lonDeg = parseFloat(k.slice(c + 1))
      // A light must never float at sea: if the cell sits over water, snap it
      // to the nearest land cell so the prayer still shows its light on land.
      let latG = latDeg
      let lonG = lonDeg
      if (this.isDeepOcean(latDeg, lonDeg)) {
        const snap = this.snapToLand(latDeg, lonDeg)
        if (!snap) continue
        latG = snap.lat
        lonG = snap.lon
      }
      const lat = latG * (Math.PI / 180)
      const lon = lonG * (Math.PI / 180)
      spr.position.set(
        r * Math.cos(lat) * Math.cos(lon),
        r * Math.sin(lat),
        r * Math.cos(lat) * Math.sin(lon)
      )
      // Precompute the normalised local-space direction once so the per-frame
      // animate loop can compare against a rotated camera instead of computing
      // the full world matrix for every light every frame.
      spr.userData.localDir = spr.position.clone().normalize()
      spr.userData.baseOpacity = Math.min(0.9, 0.6 + n * 0.05)
      const s = 0.2 + Math.min(n, 8) * 0.03
      spr.scale.set(s, s, s)
      const color = TRAD_LIGHT[spirits?.[k]] || GOLD_LIGHT
      spr.material.color.set(color)
      spr.userData.active = true
      used++
    }
    for (let i = used; i < MAX; i++) pool[i].userData.active = false
  }

  // A soft lit-sphere texture so a small body reads as a real globe (bright on
  // the sun side, falling to a darker limb) instead of a flat round pixel.
  makeOrbTexture(color, spots) {
    const S = 128
    const c = document.createElement('canvas')
    c.width = c.height = S
    const g = c.getContext('2d')
    const hex = '#' + new THREE.Color(color).getHexString()
    const grad = g.createRadialGradient(S * 0.34, S * 0.3, S * 0.08, S / 2, S / 2, S * 0.52)
    grad.addColorStop(0, this._lighten(hex, 0.55))
    grad.addColorStop(0.55, hex)
    grad.addColorStop(1, this._darken(hex, 0.6))
    g.fillStyle = grad
    g.beginPath()
    g.arc(S / 2, S / 2, S / 2, 0, Math.PI * 2)
    g.fill()
    if (spots) {
      for (let i = 0; i < spots; i++) {
        const a = Math.random() * Math.PI * 2
        const r = Math.random() * S * 0.22
        const x = S / 2 + Math.cos(a) * r
        const y = S / 2 + Math.sin(a) * r
        g.beginPath()
        g.arc(x, y, 2 + Math.random() * 4, 0, Math.PI * 2)
        g.fillStyle = this._darken(hex, 0.45)
        g.fill()
      }
    }
    return new THREE.CanvasTexture(c)
  }

  _lighten(hex, amt) {
    const c = new THREE.Color(hex)
    return '#' + c.offsetHSL(0, 0, amt * 0.5).getHexString()
  }

  _darken(hex, amt) {
    const c = new THREE.Color(hex)
    return '#' + c.offsetHSL(0, 0, -amt * 0.5).getHexString()
  }

  buildPlanets() {
    const group = new THREE.Group()
    const defs = [
      { r: 0.09, color: 0xe8c47a, dist: 2.35, speed: 0.18, tilt: 0.5, size: 0.14, spots: 3 },
      { r: 0.05, color: 0x9fb7ff, dist: 2.9, speed: -0.12, tilt: -0.7, size: 0.08, spots: 0 },
      { r: 0.07, color: 0xb9a6f5, dist: 3.4, speed: 0.09, tilt: 0.2, size: 0.11, spots: 1 }
    ]
    const planets = defs.map((d, i) => {
      const tex = this.makeOrbTexture(d.color, d.spots)
      const mat = new THREE.MeshBasicMaterial({
        map: tex,
        transparent: true
      })
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(d.r, 24, 24), mat)
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(d.dist - d.size / 2, d.dist + d.size / 2, 48),
        new THREE.MeshBasicMaterial({
          color: d.color,
          transparent: true,
          opacity: 0.05,
          side: THREE.DoubleSide,
          depthWrite: false
        })
      )
      ring.rotation.x = Math.PI / 2
      ring.rotation.z = d.tilt
      const holder = new THREE.Group()
      holder.userData = { angle: i * 2.1, speed: d.speed, dist: d.dist, tilt: d.tilt }
      holder.add(mesh)
      mesh.position.x = d.dist
      holder.add(ring)
      group.add(holder)
      return holder
    })
    group.rotation.x = 0.35
    return { group, planets }
  }

  buildStars(N = 1800) {
    const pos = new Float32Array(N * 3)
    const col = new Float32Array(N * 3)
    const size = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      const v = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      )
        .normalize()
        .multiplyScalar(28 + Math.random() * 75)
      pos.set([v.x, v.y, v.z], i * 3)
      const warm = Math.random()
      // a handful of bright beacons, mostly quiet white-blue stardust. Stars
      // sit bright against space so they always read on every screen, but they
      // stay small and crisp so they never blur into the prayer lights.
      const bright = Math.random()
      size[i] = bright > 0.88 ? 0.62 : bright > 0.45 ? 0.42 : 0.28
      col.set(
        [warm > 0.72 ? 0.96 : 0.9, warm > 0.72 ? 0.99 : 0.95, 1],
        i * 3
      )
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    const m = new THREE.PointsMaterial({
      size: 0.24,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthTest: true,
      depthWrite: false
    })
    // per-star size needs a tiny shader; keep it minimal
    const shader = new THREE.ShaderMaterial({
      vertexShader: `attribute float aSize;
        varying vec3 vColor;
        uniform float uDpr;
        void main() {
          vColor = color;
          gl_PointSize = aSize * 14.0 * uDpr;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `varying vec3 vColor;
        uniform float uOpacity;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          // a tight bright core with a thin halo: stars read as small points,
          // never as soft blobs that crowd out the prayer text behind them
          float a = 1.0 - smoothstep(0.06, 0.34, d);
          if (a <= 0.004) discard;
          vec3 glow = vColor * (1.0 + 0.5 * a);
          gl_FragColor = vec4(glow, a * 1.1 * uOpacity);
        }`,
      uniforms: { uDpr: { value: this.renderer ? this.renderer.getPixelRatio() : 1 }, uOpacity: { value: 1 } },
      transparent: true,
      vertexColors: true,
      depthTest: true,
      depthWrite: false
    })
    const pts = new THREE.Points(g, shader)
    this.starMat = shader
    return pts
  }

  // Soft, luminous nebula clouds drifting behind the Earth — indigo space with
  // whispers of blue and violet, so the starfield feels deep and alive.
  buildNebulae() {
    const S = 256
    const c = document.createElement('canvas')
    c.width = c.height = S
    const g = c.getContext('2d')
    const gr = g.createRadialGradient(S / 2, S / 2, 10, S / 2, S / 2, S / 2)
    gr.addColorStop(0, 'rgba(110, 150, 255, 0.6)')
    gr.addColorStop(0.35, 'rgba(130, 95, 255, 0.28)')
    gr.addColorStop(1, 'rgba(80, 60, 200, 0)')
    g.fillStyle = gr
    g.fillRect(0, 0, S, S)
    const tex = new THREE.CanvasTexture(c)
    const group = new THREE.Group()
    const defs = [
      { pos: [26, 8, -34], scale: 60, tint: [0.45, 0.62, 1] },
      { pos: [-30, -6, -28], scale: 46, tint: [0.6, 0.5, 1] },
      { pos: [8, 22, -40], scale: 38, tint: [0.35, 0.7, 1] },
      { pos: [-18, 14, -40], scale: 30, tint: [0.65, 0.45, 0.95] }
    ]
    this.nebulaSprites = defs.map((d, i) => {
      const mat = new THREE.SpriteMaterial({
        map: tex,
        color: new THREE.Color(d.tint[0], d.tint[1], d.tint[2]),
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false
      })
      const spr = new THREE.Sprite(mat)
      spr.position.set(d.pos[0], d.pos[1], d.pos[2])
      spr.scale.set(d.scale, d.scale, 1)
      group.add(spr)
      return { spr, phase: i * 1.7 }
    })
    return group
  }

  // Two slow-turning luminous bands around the Earth — an outer celestial
  // energy ring and a finer inner one counter-rotating, shimmering with moving
  // light and breathing with the world's prayer.
  buildAuraRing() {
    const RING_FRAG = /* glsl */ `
      uniform float uTime;
      uniform float uGlow;
      uniform float uSurge;
      varying vec2 vUv;
      void main() {
        float band = 1.0 - abs(vUv.y - 0.5) * 2.6;
        band = max(0.0, band);
        float shimmer = 0.6 + 0.4 * sin(vUv.x * 26.0 + uTime * 1.3);
        float streak = 0.5 + 0.5 * sin(vUv.x * 9.0 - uTime * 0.85);
        vec3 a = vec3(0.5, 0.8, 1.0);
        vec3 b = vec3(0.72, 0.56, 1.0);
        vec3 col = mix(a, b, streak);
        float alpha = band * shimmer * (0.16 + 0.12 * uGlow + 0.12 * uSurge);
        gl_FragColor = vec4(col, alpha);
      }
    `
    const make = (inner, outer, seg, tilt, z, mult) => {
      const geo = new THREE.RingGeometry(inner, outer, seg)
      const mat = new THREE.ShaderMaterial({
        vertexShader: `varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: RING_FRAG,
        uniforms: { uTime: { value: 0 }, uGlow: { value: this.glow }, uSurge: { value: 0 } },
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.rotation.x = tilt
      mesh.rotation.z = z
      return { mesh, mat, mult }
    }
    const outer = make(1.66, 1.9, 120, 1.05, 0.35, 1)
    const inner = make(1.58, 1.68, 96, 1.12, 0.8, -1.6)
    const group = new THREE.Group()
    group.add(outer.mesh)
    group.add(inner.mesh)
    this.auraRing = { group, outer, inner }
    return group
  }

  // A rare bright shooting star that streaks across the space around the Earth.
  buildShootingStar() {
    const S = 64
    const c = document.createElement('canvas')
    c.width = S
    c.height = 8
    const g = c.getContext('2d')
    const grad = g.createLinearGradient(0, 0, S, 0)
    grad.addColorStop(0, 'rgba(255,255,255,0)')
    grad.addColorStop(0.8, 'rgba(225, 240, 255, 0.85)')
    grad.addColorStop(1, 'rgba(255,255,255,1)')
    g.fillStyle = grad
    g.fillRect(0, 0, S, 8)
    const tex = new THREE.CanvasTexture(c)
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    })
    const spr = new THREE.Sprite(mat)
    spr.scale.set(1.6, 0.22, 1)
    spr.visible = false
    spr.userData.next = performance.now() + 5000
    this.shootingStar = spr
    return spr
  }

  buildMotes() {
    const N = 90
    const pos = new Float32Array(N * 3)
    const phase = new Float32Array(N)
    const speed = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      const r = 2.2 + Math.random() * 2.6
      const th = Math.random() * Math.PI * 2
      const ph = (Math.random() - 0.5) * Math.PI
      pos[i * 3] = r * Math.cos(ph) * Math.cos(th)
      pos[i * 3 + 1] = r * Math.sin(ph)
      pos[i * 3 + 2] = r * Math.cos(ph) * Math.sin(th)
      phase[i] = Math.random() * Math.PI * 2
      speed[i] = 0.2 + Math.random() * 0.7
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    this.motePos = pos
    this.motePhase = phase
    this.moteSpeed = speed
    const m = new THREE.PointsMaterial({
      size: 0.05,
      transparent: true,
      opacity: 0.6,
      color: 0xffe9b0,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
    return new THREE.Points(g, m)
  }

  raycastDrag() {
    const el = this.renderer.domElement
    let dragging = false
    let px = 0
    let py = 0
    const setRes = (pr) => {
      try {
        this.renderer.setPixelRatio(pr)
        this.renderer.setSize(el.clientWidth || 1, el.clientHeight || 1)
      } catch {}
    }
    const down = (e) => {
      dragging = true
      px = e.clientX
      py = e.clientY
      this.autoRotate = false
      // While the user is spinning the globe, drop the render resolution so
      // fast motion stays smooth; it sharpens back on release.
      if (!this.lowPower && this.basePR > 1.25) setRes(1.25)
    }
    const move = (e) => {
      if (!dragging) return
      const dx = e.clientX - px
      const dy = e.clientY - py
      px = e.clientX
      py = e.clientY
      this.earthGroup.rotation.y += dx * 0.005
      this.earthGroup.rotation.x += dy * 0.003
      this.earthGroup.rotation.x = Math.max(-0.9, Math.min(0.9, this.earthGroup.rotation.x))
      // remember spin speed so release glides smoothly
      this.rotVel = dx * 0.005
    }
    const up = () => {
      dragging = false
      setRes(this.basePR)
this.autoRotate = !this.reducedMotion
      this.autoRotate = this.reducedMotion ? false : true
    }
    el.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    this._dragCleanup = () => {
      el.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }

  bindResize() {
    this._resize = () => {
      const w = this.container.clientWidth || 1
      const h = this.container.clientHeight || 1
      this.camera.aspect = w / h
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(w, h)
    }
    window.addEventListener('resize', this._resize)
  }

  bindVisibility() {
    this._vis = () => {
      this.hidden = document.hidden
      if (!this.hidden) this.lastFrame = 0
    }
    document.addEventListener('visibilitychange', this._vis)
  }

  setGlow(v) {
    // The glow metric is the honest % of a million prayers (small at first),
    // but the map itself should still feel alive: lift + soften the curve so
    // the Earth is never near-black and only ever brightens as prayers grow.
    this.glow = 0.2 + 0.8 * Math.pow(Math.max(0, Math.min(1, v)), 0.5)
  }

  // How alive the world is: cumulative prayers climb a logarithmic ladder that
  // scales the surge (sparks + aura waves) and the permanent tier (brightness),
  // with new effects (halo, drifting motes) unfolding on higher rungs. A small
  // live "people praying now" flicker keeps the moment-to-moment pulse.
  setMood(people, totalSeconds, prayers) {
    const { progress } = ladderState(prayers)
    const live = Math.min(1, (people || 0) / 30) * 0.12
    this.surgeT = Math.min(1, 0.12 + 0.88 * Math.pow(progress, 0.7) + live)
    this.tierT = Math.min(1, 0.25 + 0.75 * Math.pow(progress, 0.5))
    this.coronaT = clamp01((progress - 0.47) / 0.22) // unfolds around 100k
    this.wispsT = clamp01((progress - 0.72) / 0.2) // drifts in around 5M
  }

  animate = () => {
    if (this.disposed) return
    requestAnimationFrame(this.animate)
    if (this.hidden) return
    const now = performance.now()
    if (this.frameMs && now - this.lastFrame < this.frameMs) return
    this.lastFrame = now
    const t = now / 1000

    // Smoothly ease the mood toward its targets so ladder rungs never pop.
    this.surge += (this.surgeT - this.surge) * 0.06
    this.tier += (this.tierT - this.tier) * 0.06
    this.corona += (this.coronaT - this.corona) * 0.05
    this.wisps += (this.wispsT - this.wisps) * 0.05

    // Surface the Earth only once its textures have loaded and a frame has
    // rendered, so the page never flashes a half-formed globe.
    if (!this._ready && this._dayLoaded) {
      this._ready = true
      if (this.onReady) this.onReady()
    }

    // auto-rotation glides: ease back toward the calm base speed after a drag
    if (this.autoRotate) {
      this.rotVel += ((this.backdrop ? 0.0008 : 0.0016) - this.rotVel) * 0.02
    } else {
      this.rotVel *= 0.96
    }
    this.earthGroup.rotation.y += this.rotVel

    if (!this.backdrop && !this.reducedMotion) {
      // gentle drifting camera, like watching from a slow orbit
      this.camera.position.x = Math.sin(t * 0.08) * 0.22
      this.camera.position.y = 0.55 + Math.cos(t * 0.11) * 0.14
      this.camera.lookAt(0, 0, 0)
    }

    this.earthMat.uniforms.uTime.value = t
    this.earthMat.uniforms.uGlow.value = this.glow
    if (this.earthMat.uniforms.uSurge) this.earthMat.uniforms.uSurge.value = this.surge || 0
    if (this.earthMat.uniforms.uTier) this.earthMat.uniforms.uTier.value = this.tier || 0
    if (this.atmo) {
      this.atmo.material.uniforms.uGlow.value = this.glow
      this.atmo.material.uniforms.uTime.value = t
      if (this.atmo.material.uniforms.uSurge) this.atmo.material.uniforms.uSurge.value = this.surge || 0
    }
    if (this.ether) {
      this.ether.material.uniforms.uGlow.value = this.glow
      this.ether.material.uniforms.uTime.value = t
      if (this.ether.material.uniforms.uSurge) this.ether.material.uniforms.uSurge.value = this.surge || 0
    }
    if (this.cloudShell) {
      this.cloudShell.material.uniforms.uTime.value = t
    }

    // a gentle golden aura: sparks twinkle and circulate the globe on the GPU,
    // blooming outward when collective prayer surges
    if (this.sparkPts) {
      const s = this.surge || 0
      const u = this.sparkMat.uniforms
      u.uTime.value = t
      u.uSwell.value = s
      u.uOpacity.value =
        0.32 + 0.3 * Math.sin(t * 1.4) + 0.16 * Math.sin(t * 2.7 + 1.2) + Math.min(0.9, s * 1.4)
    }

    // the celestial energy rings drift around the Earth, shimmering
    if (this.auraRing) {
      this.auraRing.group.rotation.y += 0.0012
      for (const k of ['outer', 'inner']) {
        const u = this.auraRing[k].mat.uniforms
        u.uTime.value = t
        u.uGlow.value = this.glow
        u.uSurge.value = this.surge || 0
      }
      // the inner ring counter-rotates and spins a touch faster
      this.auraRing.inner.mesh.rotation.y -= 0.002
    }

    // the halo blooms around the whole world at high ladder rungs
    if (this.coronaSpr) {
      this.coronaSpr.visible = this.corona > 0.012
      if (this.coronaSpr.visible) {
        this.coronaSpr.material.opacity = this.corona * (0.45 + 0.3 * Math.sin(t * 0.9))
        this.coronaSpr.scale.setScalar(3.2 + this.corona * 2.6 + 0.12 * Math.sin(t * 0.6))
        this.coronaSpr.material.rotation += 0.0005
      }
    }

    // gentle healing motes drift at the highest rungs (motion on the GPU)
    if (this.wispPts) {
      const u = this.wispMat.uniforms
      u.uTime.value = t
      u.uSwell.value = this.wisps
      u.uOpacity.value = this.wisps * 0.5
    }

    // your own prayer light pulses on the surface so you can always find you.
    // It stays fully bright across the whole near side and only dims as it
    // rounds the limb toward the far side (where the depth test hides it).
    if (this.youMarker && this.youMarker.visible) {
      this.youMarker.updateWorldMatrix(true, false)
      const wp = this._youWorldPos
        .setFromMatrixPosition(this.youMarker.matrixWorld)
        .normalize()
      const facing = wp.dot(this._youCamPos.copy(this.camera.position).normalize())
      const fade = Math.max(0, Math.min(1, (facing + 0.1) / 0.35))
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.4)
      this.youMarker.scale.set(0.3 + 0.18 * pulse, 0.3 + 0.18 * pulse, 0.3)
      this.youMarker.material.opacity = fade * (0.55 + 0.45 * pulse)
    }

    // Prayer lights: fully bright across the whole near side; fade as they
    // round the limb; hidden once they pass onto the far side of the planet.
    // (Depth test is off for these sprites, so facing is what hides them —
    // this is what keeps a glow from being clipped into a "missing piece".)
    if (this.lights) {
      // Rotate the camera direction into the earthGroup's local space once
      // per frame, then dot against each light's precomputed localDir —
      // avoids 256 updateWorldMatrix calls (~1-2ms CPU per frame).
      const camDirLocal = this._lightCamPos
        .copy(this.camera.position)
        .applyQuaternion(this.earthGroup.quaternion.clone().invert())
        .normalize()
      for (const spr of this.lights.pool) {
        if (!spr.userData.active) continue
        const ld = spr.userData.localDir
        if (!ld) continue
        const facing = ld.dot(camDirLocal)
        if (facing < -0.05) {
          spr.visible = false
          continue
        }
        spr.visible = true
        // soft, early fade so the glow dims out smoothly as it rounds the limb
        // (never a hard clip against the planet's edge), plus a gentle per-light
        // pulse so the lights feel alive as they ride the turning globe
        const limbFade = Math.max(0, Math.min(1, (facing + 0.2) / 0.5))
        const phase = (spr.userData.pulse = (spr.userData.pulse || (Math.random() * Math.PI * 2)))
        const breathe = 0.85 + 0.15 * Math.sin(t * 2.1 + phase)
        spr.material.opacity = spr.userData.baseOpacity * limbFade * breathe
      }
    }
    if (this.halo) this.halo.material.uniforms.uGlow.value = this.glow
    if (this.stars) this.starMat.uniforms.uOpacity.value = 0.82 + 0.18 * Math.sin(t * 0.7)

    // nebula clouds drift slowly and breathe, keeping the space behind the
    // Earth deep and alive
    if (this.nebulae) {
      this.nebulae.rotation.y += 0.0004
      const nsp = this.nebulaSprites
      for (let i = 0; i < nsp.length; i++) {
        nsp[i].spr.material.opacity = 0.32 + 0.16 * Math.sin(t * 0.18 + nsp[i].phase)
      }
    }

    // a rare shooting star streaks across the void, fades, and vanishes
    if (this.shootingStar) {
      const ss = this.shootingStar
      const nowMs = performance.now()
      if (!ss.visible && nowMs > ss.userData.next) {
        ss.userData.next = nowMs + 6000 + Math.random() * 12000
        ss.userData.ang = Math.random() * Math.PI * 2
        ss.userData.speed = 0.55 + Math.random() * 0.6
        ss.userData.life = 0
        ss.visible = true
      }
      if (ss.visible) {
        ss.userData.life += 0.016
        const l = ss.userData.life
        const fade = Math.min(1, l * 3) * Math.max(0, 1 - (l - 1.1) / 0.5)
        const th = ss.userData.ang + l * ss.userData.speed
        const ph = -0.45 + l * 0.5
        const r = 62
        ss.position.set(r * Math.cos(ph) * Math.cos(th), r * Math.sin(ph), r * Math.cos(ph) * Math.sin(th))
        ss.material.opacity = 0.9 * Math.max(0, fade)
        if (l > 1.6) {
          ss.visible = false
          ss.material.opacity = 0
        }
      }
    }

    if (this.backdrop) {
      this.renderer.render(this.scene, this.camera)
      return
    }

    // orbiting planets
    this.planets.planets.forEach((holder) => {
      const u = holder.userData
      u.angle += u.speed * 0.016
      holder.rotation.z = u.tilt + Math.sin(u.angle) * 0.4
      const child = holder.children[0]
      child.position.set(Math.cos(u.angle) * u.dist, 0, Math.sin(u.angle) * u.dist)
    })

    // motes drift upward & twinkle
    const mp = this.motePos
    for (let i = 0; i < this.moteSpeed.length; i++) {
      this.motePhase[i] += 0.004 * this.moteSpeed[i]
      mp[i * 3 + 1] += 0.0016 * this.moteSpeed[i]
      if (mp[i * 3 + 1] > 6) mp[i * 3 + 1] = -4
    }
    this.motes.geometry.attributes.position.needsUpdate = true
    this.motes.material.opacity = 0.35 + 0.25 * Math.sin(t * 1.4)

    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    this.disposed = true
    if (this._dragCleanup) this._dragCleanup()
    if (this._resize) window.removeEventListener('resize', this._resize)
    if (this._vis) document.removeEventListener('visibilitychange', this._vis)
    if (this._containerObserver) this._containerObserver.disconnect()

    // Recursively free every GPU resource in a subtree, skipping shared
    // textures that are explicitly disposed below (dayTex is shared across
    // uniforms and handled separately).
    const free = (obj) => {
      if (!obj) return
      if (obj.geometry) obj.geometry.dispose()
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          for (const m of obj.material) {
            if (m.map && m.map !== this.dayTex) m.map.dispose()
            m.dispose()
          }
        } else {
          if (obj.material.map && obj.material.map !== this.dayTex) obj.material.map.dispose()
          obj.material.dispose()
        }
      }
      if (obj.children) for (const c of obj.children) free(c)
    }
    free(this.earthGroup)
    free(this.scene)

    // Standalone objects not reached by scene traversal
    if (this.maskTex) this.maskTex.dispose()
    if (this.lightGlowTex) this.lightGlowTex.dispose()
    if (this.earthMat) this.earthMat.dispose()
    if (this.dayTex) this.dayTex.dispose()
    if (this.nightTex) this.nightTex.dispose()
    if (this._readyTimer) clearTimeout(this._readyTimer)

    this.renderer.dispose()
    try { this.renderer.forceContextLoss() } catch {}
    this.renderer.domElement.width = 0
    this.renderer.domElement.height = 0
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement)
    }
    this.renderer = null
    this.scene = null
  }
}
