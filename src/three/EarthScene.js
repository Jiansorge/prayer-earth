import * as THREE from 'three'
import dayUrl from '../assets/textures/earth_atmos.jpg'
import nightUrl from '../assets/textures/earth_lights_2048.png'
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
  uniform sampler2D uNightTex;
  uniform sampler2D uMaskTex;
  uniform float uSurge;
  uniform float uTier;
  varying vec3 vNormal;
  varying vec3 vPos;

  vec2 equirect(vec3 p) {
    return vec2(
      0.5 - atan(p.z, p.x) / 6.2831853,
      0.5 + asin(clamp(p.y, -1.0, 1.0)) / 3.14159265
    );
  }

  // The textures are uploaded as sRGB, so sampling yields linear (dark)
  // values; lift them back to display space for the few places the map is
  // sampled.
  vec3 srgb(vec3 c) { return pow(max(c, vec3(0.0)), vec3(1.0 / 2.2)); }

  void main() {
    vec3 n = normalize(vNormal);
    vec3 sp = normalize(vPos);

    vec2 uv = equirect(sp);

    // The living Earth: deep luminous ocean and quiet land that read clearly
    // from the first frame, lit by the sun terminator. The world's prayer
    // gradually brightens the surface forever.
    float landMask = texture2D(uMaskTex, uv).r;

    vec3 oceanC = vec3(0.05, 0.16, 0.30) + vec3(0.03, 0.07, 0.10) * uTier;
    vec3 landC = vec3(0.22, 0.26, 0.20) + vec3(0.08, 0.09, 0.07) * uTier;
    vec3 base = mix(oceanC, landC, landMask);

    float ndl = dot(n, normalize(uSunDir));
    float sun = smoothstep(-0.15, 0.35, ndl);
    vec3 lit = base * (0.5 + 0.5 * sun);

    float night = 1.0 - smoothstep(-0.25, 0.08, ndl);

    // the Earth's own breathing glow, a gentle radiance that swells when many
    // people are praying at once
    vec3 radiance = vec3(0.18, 0.35, 0.24) * uGlow * uGlow * 0.18
      + vec3(0.34, 0.55, 0.42) * uGlow * uSurge * 0.28;

    // polar aurora
    float polar = smoothstep(0.86, 0.99, abs(sp.y));
    float aur = polar * (0.5 + 0.5 * sin(uTime * 0.4 + sp.y * 6.0));
    vec3 aurora = vec3(0.1, 0.9, 0.6) * aur * night * 0.3;

    vec3 col = lit + radiance + aurora;

    // a luminous shoreline: a bright thin core softened by a gentle glow on both
    // sides, so it reads as light tracing the continents, never a drawn line
    float a = texture2D(uMaskTex, vec2(fract(uv.x + 0.0005), uv.y)).r;
    float b = texture2D(uMaskTex, vec2(uv.x, fract(uv.y + 0.0008))).r;
    float c = texture2D(uMaskTex, vec2(fract(uv.x + 0.0011), uv.y)).r;
    float d = texture2D(uMaskTex, vec2(uv.x, fract(uv.y + 0.0016))).r;
    float core = smoothstep(0.3, 0.5, landMask) * (1.0 - smoothstep(0.42, 0.5, min(a, b)));
    float landGlow = smoothstep(0.25, 0.45, landMask) * (1.0 - smoothstep(0.5, 0.6, min(c, d)));
    float waterGlow = (1.0 - landMask) * smoothstep(0.4, 0.55, max(c, d));
    vec3 coastCol = vec3(0.72, 0.88, 1.0) * (0.75 + 0.3 * uGlow + 0.15 * uSurge + 0.1 * uTier);
    col += coastCol * (core * 0.4 + landGlow * 0.22 + waterGlow * 0.12);

    // warm dawn band where day meets night
    float term = smoothstep(0.1, -0.12, ndl) * (1.0 - smoothstep(-0.5, -0.2, ndl));
    vec3 dawn = vec3(1.0, 0.55, 0.3) * term * 0.08;
    col += dawn;

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

    // texture is sRGB-decoded (linear), the mask thresholds below are chosen
    // for linear space: deep ocean ~0.02-0.06, land starts ~0.17.
    vec3 day = texture2D(uDayTex, uv).rgb;
    float lum = dot(day, vec3(0.299, 0.587, 0.114));
    // land is greener than the blue-dominant ocean
    float land = smoothstep(0.09, 0.17, lum) * step(-0.01, day.g - day.b);

    // coastline: land that borders ocean (thin + faint for a sleek look)
    vec3 dR = texture2D(uDayTex, uv + vec2(0.002, 0.0)).rgb;
    vec3 dT = texture2D(uDayTex, uv + vec2(0.0, 0.003)).rgb;
    float landR = smoothstep(0.09, 0.17, dot(dR, vec3(0.299, 0.587, 0.114))) * step(-0.01, dR.g - dR.b);
    float landT = smoothstep(0.09, 0.17, dot(dT, vec3(0.299, 0.587, 0.114))) * step(-0.01, dT.g - dT.b);
    float coast = land * (1.0 - min(landR, landT));

    // limb fresnel so the sphere reads as round
    vec3 n = normalize(vNormal);
    vec3 viewDir = normalize(cameraPosition - vPos);
    float fres = pow(1.0 - clamp(dot(n, viewDir), 0.0, 1.0), 1.8);

    vec3 base = vec3(0.045, 0.11, 0.085);
    vec3 coastCol = mix(vec3(0.55, 0.85, 0.68), vec3(1.0, 0.86, 0.52), uGlow);

    float fillA = land * (0.05 + 0.06 * uGlow) * (0.6 + 0.4 * fres);
    float coastA = coast * (0.14 + 0.3 * uGlow);
    float rimA = fres * 0.06;

    vec3 col = base * fillA;
    col += coastCol * coastA;
    col += vec3(0.38, 0.6, 0.48) * rimA;

    float alpha = fillA + coastA + rimA;
    if (alpha < 0.004) discard;
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
  varying vec3 vNormal;
  varying vec3 vPos;
  void main() {
    vec3 viewDir = normalize(-vPos);
    float rim = 1.0 - max(dot(viewDir, normalize(vNormal)), 0.0);
    float f = pow(rim, 1.7);
    // ethereal atmosphere: cool teal-mist shifting to warm gold as prayer grows,
    // with a soft violet shimmer breathing slowly
    vec3 cool = vec3(0.42, 0.62, 0.85);
    vec3 warm = vec3(1.0, 0.74, 0.42);
    vec3 inner = mix(cool, warm, uGlow);
    vec3 shimmer = vec3(0.62, 0.46, 0.92) * (0.6 + 0.4 * sin(uTime * 0.55));
    vec3 col = inner * (0.7 + 0.3 * f) + shimmer * 0.28 * f;
    float alpha = f * (0.1 + 0.18 * uGlow + 0.12 * uSurge);
    gl_FragColor = vec4(col, alpha);
  }
`

// A wide, soft outer halo so the globe feels magical and alive.
const ETHEREAL_FRAG = /* glsl */ `  uniform float uGlow;
  uniform float uTime;
  uniform float uSurge;
  varying vec3 vNormal;
  varying vec3 vPos;
  void main() {
    vec3 viewDir = normalize(-vPos);
    float rim = 1.0 - max(dot(viewDir, normalize(vNormal)), 0.0);
    float f = pow(rim, 2.2);
    float breathe = 0.82 + 0.18 * sin(uTime * 0.45);
    vec3 col = mix(vec3(0.32, 0.55, 0.72), vec3(0.95, 0.7, 0.4), uGlow);
    vec3 violet = vec3(0.6, 0.5, 0.9);
    col = mix(col, violet, 0.25 * (0.5 + 0.5 * sin(uTime * 0.3 + 1.5)));
    // aura waves: rings pulse outward from the globe when many pray at once
    float waves = pow(0.5 + 0.5 * sin(rim * 40.0 - uTime * 3.2 + uGlow * 5.0), 3.0) * uSurge;
    float alpha = (f * (0.08 + 0.12 * uGlow) + waves * 0.08) * breathe;
    gl_FragColor = vec4(col + vec3(0.2, 0.35, 0.6) * waves * 0.2, alpha);
  }
`

// The golden aura sparks: each carries its own phase so the whole ring
// twinkles in and out gently, always alive around the Earth.
const SPARK_VERT = /* glsl */ `
  attribute float aPhase;
  attribute vec3 aColor;
  uniform float uTime;
  varying vec3 vColor;
  varying float vA;
  void main() {
    vColor = aColor;
    float tw = 0.5 + 0.5 * sin(uTime * 1.4 + aPhase * 6.2831853);
    vA = 0.4 + 0.6 * tw;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = 3.0;
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
    float a = smoothstep(0.5, 0.15, d);
    if (a <= 0.001) discard;
    gl_FragColor = vec4(vColor, a * vA * uOpacity);
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
    this._nightLoaded = false
    this._ready = false
    this._youWorldPos = new THREE.Vector3()
    this._youCamPos = new THREE.Vector3()
    this.autoRotate = true
    this.disposed = false
    this.hidden = false
    this.lastFrame = 0
    this.frameMs = this.backdrop ? 42 : 0 // backdrop renders ~24fps, Earth view full speed
    this.peopleTarget = 0

    const w = container.clientWidth || 1
    const h = container.clientHeight || 1

    this.scene = new THREE.Scene()

    this.camera = new THREE.PerspectiveCamera(this.backdrop ? 40 : 42, w / h, 0.1, 200)
    this.camera.position.set(0, this.backdrop ? 0 : 0.55, this.backdrop ? 4.7 : 4.6)
    this.camera.lookAt(0, 0, 0)

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.backdrop ? 1.25 : 2))
    this.renderer.setSize(w, h)
    this.renderer.setClearColor(0x000000, 0)
    container.appendChild(this.renderer.domElement)

    // sun light for the earth shader â€” toward the camera so the day side faces us
    this.sunDir = new THREE.Vector3(0.35, 0.28, 0.89).normalize()
    // the prayer backdrop turns a little faster than the main map so the
    // silhouette feels quietly alive behind the words
    this.rotVel = this.backdrop ? 0.002 : 0.0016

    // start facing Europe/Africa so recognizable geography greets the viewer
    this.earthGroupRotation = 1.25

    const loader = new THREE.TextureLoader()
    this.maskTex = this.buildLandMaskCanvas()
    const dayTex = loader.load(
      dayUrl,
      (tex) => {
        this.processLandMask(tex.image)
        tex.image = this.makeSeamless(tex.image)
        tex.needsUpdate = true
        this._dayLoaded = true
      },
      undefined,
      () => {
        this._dayLoaded = true
      }
    )
    dayTex.colorSpace = THREE.SRGBColorSpace
    dayTex.wrapS = THREE.RepeatWrapping
    this.dayTex = dayTex
    const nightTex = loader.load(
      nightUrl,
      (tex) => {
        tex.image = this.makeSeamless(tex.image)
        tex.needsUpdate = true
        this._nightLoaded = true
      },
      undefined,
      () => {
        this._nightLoaded = true
      }
    )
    nightTex.colorSpace = THREE.SRGBColorSpace
    nightTex.wrapS = THREE.RepeatWrapping
    this.nightTex = nightTex

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
      this.buildHalo()
    } else {
      this.buildFullEarth(dayTex, nightTex)
    }

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
    this.stars = this.buildStars(this.backdrop ? 220 : 1000)
    this.scene.add(this.stars)

    this.bindResize()
    this.bindVisibility()
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

  buildHalo() {
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(1.55, 32, 24),
      new THREE.ShaderMaterial({
        vertexShader: ATMO_VERT,
        fragmentShader: HALO_FRAG,
        uniforms: { uGlow: { value: this.glow } },
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false
      })
    )
    this.halo = halo
    this.earthGroup.add(halo)
  }

  buildFullEarth(dayTex, nightTex) {
    const geo = new THREE.SphereGeometry(1.42, 192, 192)
    this.earthMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uGlow: { value: this.glow },
        uSunDir: { value: this.sunDir },
        uDayTex: { value: dayTex },
        uNightTex: { value: nightTex },
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
        uniforms: { uGlow: { value: this.glow }, uTime: { value: 0 }, uSurge: { value: 0 } },
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
        uniforms: { uGlow: { value: this.glow }, uTime: { value: 0 }, uSurge: { value: 0 } },
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false
      })
    )
    this.ether = ether
    this.earthGroup.add(ether)
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
    const N = 200
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
      const warm = Math.random()
      col[i * 3] = warm > 0.5 ? 1 : 0.9
      col[i * 3 + 1] = warm > 0.5 ? 0.92 : 0.86
      col[i * 3 + 2] = 0.62
      pos[i * 3] = x * 1.47
      pos[i * 3 + 1] = y * 1.47
      pos[i * 3 + 2] = z * 1.47
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
        uOpacity: { value: 0 }
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false
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
    const N = 150
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
    const mat = new THREE.PointsMaterial({
      size: 0.04,
      color: new THREE.Color(1, 0.94, 0.8),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false
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
    if (!loc) {
      this.youMarker.visible = false
      return
    }
    const lat = loc.lat * (Math.PI / 180)
    const lon = loc.lon * (Math.PI / 180)
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
    g.addColorStop(0.25, 'rgba(255, 255, 255, 0.9)')
    g.addColorStop(0.6, 'rgba(255, 255, 255, 0.32)')
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
  buildLandMaskCanvas() {
    const W = 2048
    const H = 1024
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    this._maskCtx = c.getContext('2d')
    this._maskData = this._maskCtx.createImageData(W, H)
    this.maskTex = new THREE.CanvasTexture(c)
    this.maskTex.colorSpace = THREE.NoColorSpace
    // Wraps horizontally so there's no seam at the anti-meridian (Pacific).
    this.maskTex.wrapS = THREE.RepeatWrapping
    return this.maskTex
  }

  processLandMask(img) {
    try {
      const c2 = document.createElement('canvas')
      c2.width = img.naturalWidth || img.width
      c2.height = img.naturalHeight || img.height
      const ctx2 = c2.getContext('2d')
      ctx2.drawImage(img, 0, 0)
      const d = ctx2.getImageData(0, 0, c2.width, c2.height).data
      const W = this._maskData.width
      const H = this._maskData.height
      const out = this._maskData.data
      const arcticRow = Math.floor((H * 4) / 180) // only the central polar ocean, real arctic land stays
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
          // be dim and not turquoise, keeps shallow straits from bridging land
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
      // make the wrap seam exact: the first and last columns must match so no
      // vertical line appears where the map wraps around the Pacific
      for (let y = 0; y < H; y++) {
        const last = y * W + W - 1
        out[last * 4] = out[last * 4 + 1] = out[last * 4 + 2] = out[(y * W) * 4]
      }
      this._maskCtx.putImageData(this._maskData, 0, 0)
      this.maskTex.needsUpdate = true
    } catch {}
  }

  buildLights() {
    const glow = this.buildLightGlowTexture()
    this.lightKeys = buildLightKeys()
    const r = 1.435
    const pool = []
    const MAX = 256
    for (let i = 0; i < MAX; i++) {
      const mat = new THREE.SpriteMaterial({
        map: glow,
        transparent: true,
        depthWrite: false,
        // depth-tested so lights on the far side of the Earth are hidden behind
        // it instead of showing through
        depthTest: true,
        blending: THREE.AdditiveBlending,
        opacity: 0
      })
      const spr = new THREE.Sprite(mat)
      spr.visible = false
      spr.userData.lat = 0
      spr.userData.lon = 0
      pool.push(spr)
    }
    const group = new THREE.Group()
    group.add(...pool)
    return { group, pool, r, MAX }
  }

  // Reuse the sprite pool: position/scale/colour one per active grid cell.
  // The colour comes from the cell's dominant tradition, so the world's lights
  // glow by faith; unknown cells glow warm gold.
  setLights(map, spirits) {
    if (!this.lights) return
    const { pool, r, MAX } = this.lights
    let used = 0
    for (let i = 0; i < this.lightKeys.length; i++) {
      const k = this.lightKeys[i]
      const n = map ? map[k] : 0
      if (!n) continue
      const spr = pool[used]
      if (!spr) break
      const c = k.indexOf(',')
      const lat = parseFloat(k.slice(0, c)) * (Math.PI / 180)
      const lon = parseFloat(k.slice(c + 1)) * (Math.PI / 180)
      spr.position.set(
        r * Math.cos(lat) * Math.cos(lon),
        r * Math.sin(lat),
        r * Math.cos(lat) * Math.sin(lon)
      )
      spr.material.opacity = Math.min(1, 0.5 + n * 0.14)
      const s = 0.2 + Math.min(n, 8) * 0.03
      spr.scale.set(s, s, s)
      const color = TRAD_LIGHT[spirits?.[k]] || GOLD_LIGHT
      spr.material.color.set(color)
      spr.visible = true
      used++
    }
    for (let i = used; i < MAX; i++) pool[i].visible = false
  }

  buildPlanets() {
    const group = new THREE.Group()
    const defs = [
      { r: 0.09, color: 0xe8c47a, dist: 2.35, speed: 0.18, tilt: 0.5, size: 0.14 },
      { r: 0.05, color: 0x9fb7ff, dist: 2.9, speed: -0.12, tilt: -0.7, size: 0.08 },
      { r: 0.07, color: 0xb9a6f5, dist: 3.4, speed: 0.09, tilt: 0.2, size: 0.11 }
    ]
    const planets = defs.map((d, i) => {
      const mat = new THREE.MeshBasicMaterial({
        color: d.color,
        transparent: true,
        opacity: 0.95
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
    for (let i = 0; i < N; i++) {
      const v = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      )
        .normalize()
        .multiplyScalar(30 + Math.random() * 70)
      pos.set([v.x, v.y, v.z], i * 3)
      const warm = Math.random()
      col.set(
        [warm > 0.7 ? 1 : 0.8, warm > 0.7 ? 0.92 : 0.85, 1],
        i * 3
      )
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    const m = new THREE.PointsMaterial({
      size: 0.24,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthTest: true,
      depthWrite: false
    })
    return new THREE.Points(g, m)
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
    const down = (e) => {
      dragging = true
      px = e.clientX
      py = e.clientY
      this.autoRotate = false
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
    this.autoRotate = true
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      this.autoRotate = false // don't spin the globe for users who prefer stillness
    }
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
    if (!this._ready && this._dayLoaded && this._nightLoaded) {
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

    if (!this.backdrop) {
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

    // a gentle golden aura: sparks always twinkle and drift around the globe,
    // blooming outward when collective prayer surges
    if (this.sparkPts) {
      const s = this.surge || 0
      const u = this.sparkMat.uniforms
      u.uTime.value = t
      u.uOpacity.value =
        0.42 + 0.2 * Math.sin(t * 1.1) + 0.12 * Math.sin(t * 2.3 + 1.2) + Math.min(0.9, s * 1.4)
      const N = this.sparkPhase.length
      for (let i = 0; i < N; i++) {
        const ph = this.sparkPhase[i]
        const rad = 1.47 + 0.1 * Math.sin(t * 0.8 + ph * 2.0) + 0.4 * Math.sin(t * 1.7 + ph) * s
        this.sparkPos[i * 3] = this.sparkDir[i * 3] * rad
        this.sparkPos[i * 3 + 1] = this.sparkDir[i * 3 + 1] * rad
        this.sparkPos[i * 3 + 2] = this.sparkDir[i * 3 + 2] * rad
      }
      this.sparkPos.needsUpdate = true
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

    // gentle healing motes drift at the highest rungs
    if (this.wispPts) {
      this.wispMat.opacity = this.wisps * 0.5
      if (this.wisps > 0.02) {
        const N = this.wispPhase.length
        for (let i = 0; i < N; i++) {
          const wob = Math.sin(t * 0.5 + this.wispPhase[i]) * 0.16
          const r = 1.75 + this.wisps * 1.1 + Math.sin(t * 0.35 + this.wispPhase[i] * 1.3) * 0.18
          const d = this.wispDir
          this.wispPos[i * 3] = d[i * 3] * r
          this.wispPos[i * 3 + 1] = d[i * 3 + 1] * r + wob
          this.wispPos[i * 3 + 2] = d[i * 3 + 2] * r
        }
        this.wispPos.needsUpdate = true
      }
    }

    // your own prayer light pulses on the surface so you can always find you.
    // It fades out as it goes around the far side of the Earth.
    if (this.youMarker && this.youMarker.visible) {
      this.youMarker.updateWorldMatrix(true, false)
      const wp = this._youWorldPos
        .setFromMatrixPosition(this.youMarker.matrixWorld)
        .normalize()
      const facing = wp.dot(this._youCamPos.copy(this.camera.position).normalize())
      const fade = Math.max(0, Math.min(1, (facing - 0.15) / 0.35))
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.4)
      this.youMarker.scale.set(0.3 + 0.18 * pulse, 0.3 + 0.18 * pulse, 0.3)
      this.youMarker.material.opacity = fade * (0.5 + 0.5 * pulse)
    }
    if (this.halo) this.halo.material.uniforms.uGlow.value = this.glow
    if (this.stars) this.stars.material.opacity = 0.72 + 0.2 * Math.sin(t * 0.7)

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
    this.renderer.dispose()
    // Browsers cap the number of live WebGL contexts (~8-16); without forcing
    // the context to be lost, repeated mounts (pray → home → pray, earth view)
    // leak contexts until WebGL stops working and the earth "crashes".
    try {
      this.renderer.forceContextLoss()
    } catch {}
    this.renderer.domElement.width = 0
    this.renderer.domElement.height = 0
    if (this.dayTex) this.dayTex.dispose()
    if (this.nightTex) this.nightTex.dispose()
    if (this._readyTimer) clearTimeout(this._readyTimer)
    if (this.coronaSpr) {
      if (this.coronaSpr.material?.map) this.coronaSpr.material.map.dispose()
      this.coronaSpr.material.dispose()
    }
    if (this.wispPts) {
      this.wispPts.geometry.dispose()
      this.wispMat.dispose()
    }
    if (this.lights) {
      const mat = this.lights.pool[0]?.material
      if (mat?.map) mat.map.dispose()
      for (const spr of this.lights.pool) spr.material.dispose()
    }
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement)
    }
  }
}
