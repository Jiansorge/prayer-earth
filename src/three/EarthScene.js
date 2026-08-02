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

    // A clean, graphic world map: solid neutral-dark landmasses on a deep blue
    // ocean. Land is told apart by being greener than the blue water, so every
    // continent shows regardless of how dark its texture is.
    // A clean, graphic world map: solid neutral-dark landmasses on deep water.
    // Land comes from a binary mask classified once in JS, so every continent
    // shows cleanly with no underwater or speckled boundaries.
    float landMask = texture2D(uMaskTex, uv).r;

    vec3 oceanC = vec3(0.004, 0.013, 0.038);        // very dark water
    vec3 landC = vec3(0.05, 0.056, 0.054);          // darker neutral land, lighter than water
    vec3 base = mix(oceanC, landC, landMask);

    float ndl = dot(n, normalize(uSunDir));
    float sun = smoothstep(-0.15, 0.35, ndl);
    vec3 lit = base * (0.5 + 0.5 * sun);

    // genuine city lights on the night side, awakening as the world prays
    float night = 1.0 - smoothstep(-0.25, 0.08, ndl);
    vec3 cities = texture2D(uNightTex, uv).rgb * night * 1.1;

    // the Earth's own breathing glow â€” kept subtle so the world stays deep
    // and the prayer lights remain the brightest things on it
    vec3 radiance = vec3(0.18, 0.35, 0.24) * uGlow * uGlow * 0.18;

    // polar aurora
    float polar = smoothstep(0.86, 0.99, abs(sp.y));
    float aur = polar * (0.5 + 0.5 * sin(uTime * 0.4 + sp.y * 6.0));
    vec3 aurora = vec3(0.1, 0.9, 0.6) * aur * night * 0.3;

    vec3 col = lit + cities + radiance + aurora;

    // a thin, faint edge where land meets water — sleek and modern
    float landR = texture2D(uMaskTex, uv + vec2(0.0011, 0.0)).r;
    float landT = texture2D(uMaskTex, uv + vec2(0.0, 0.0016)).r;
    float coast = smoothstep(0.32, 0.5, landMask) * (1.0 - smoothstep(0.4, 0.58, min(landR, landT)));
    col += coast * vec3(0.92, 0.95, 0.94) * 0.26;

    // warm dawn band where day meets night
    float term = smoothstep(0.1, -0.12, ndl) * (1.0 - smoothstep(-0.5, -0.2, ndl));
    vec3 dawn = vec3(1.0, 0.55, 0.3) * term * 0.08;
    col += dawn;

    // soft vignette at the limb
    float limb = smoothstep(0.0, 0.6, dot(n, vec3(0.0, 0.0, 1.0)));
    col *= 0.5 + 0.5 * limb;

    // dither a hair to break up banding in the dark ocean gradient
    float dh = fract(sin(dot(uv * vec2(1024.0, 512.0), vec2(12.9898, 78.233))) * 43758.5453);
    col += (dh - 0.5) * 0.006;

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

    // texture is sRGB-decoded (linear) — the mask thresholds below are chosen
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

    float fillA = land * (0.04 + 0.05 * uGlow) * (0.6 + 0.4 * fres);
    float coastA = coast * (0.05 + 0.3 * uGlow);
    float rimA = fres * 0.07;

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
    float alpha = f * (0.16 + 0.3 * uGlow);
    gl_FragColor = vec4(col, alpha);
  }
`

// A wide, soft outer halo so the globe feels magical and alive.
const ETHEREAL_FRAG = /* glsl */ `
  uniform float uGlow;
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vPos;
  void main() {
    vec3 viewDir = normalize(-vPos);
    float rim = 1.0 - max(dot(viewDir, normalize(vNormal)), 0.0);
    float f = pow(rim, 3.2);
    float breathe = 0.82 + 0.18 * sin(uTime * 0.45);
    vec3 col = mix(vec3(0.32, 0.55, 0.72), vec3(0.95, 0.7, 0.4), uGlow);
    vec3 violet = vec3(0.6, 0.5, 0.9);
    col = mix(col, violet, 0.25 * (0.5 + 0.5 * sin(uTime * 0.3 + 1.5)));
    float alpha = f * (0.10 + 0.15 * uGlow) * breathe;
    gl_FragColor = vec4(col, alpha);
  }
`

// 2-degree lat/lon grid of possible light positions. The shared server rounds
// every praying user's location onto the same grid, so a light appears exactly
// where people are praying.
function buildLightKeys() {
  const step = 2
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

// Rounds a coordinate onto the shared 2-degree light grid (matches the server).
export function lightGridKey(lat, lon) {
  const la = Math.max(LAT_MIN, Math.min(LAT_MAX, Math.round(lat / 2) * 2))
  let lo = Math.round(lon / 2) * 2
  if (lo >= 180) lo = -180
  return `${la},${lo}`
}

export class EarthScene {
  constructor(container, options = {}) {
    this.container = container
    this.backdrop = !!options.backdrop
    this.glow = 0.2
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
    this.rotVel = this.backdrop ? 0.0008 : 0.0016

    // start facing Europe/Africa so recognizable geography greets the viewer
    this.earthGroupRotation = 1.25

    const loader = new THREE.TextureLoader()
    this.maskTex = this.buildLandMaskCanvas()
    const dayTex = loader.load(dayUrl, (tex) => this.processLandMask(tex.image))
    dayTex.colorSpace = THREE.SRGBColorSpace
    dayTex.wrapS = THREE.RepeatWrapping
    this.dayTex = dayTex
    const nightTex = loader.load(nightUrl)
    nightTex.colorSpace = THREE.SRGBColorSpace
    nightTex.wrapS = THREE.RepeatWrapping
    this.nightTex = nightTex

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
    this.scene.add(this.earthGroup)
    if (import.meta.env?.DEV) window.__earthScene = this

    if (!this.backdrop) {
      // --- orbiting little planets ---
      this.planets = this.buildPlanets()
      this.scene.add(this.planets.group)

      // --- drifting motes ---
      this.motes = this.buildMotes()
      this.scene.add(this.motes)

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
        uMaskTex: { value: this.maskTex }
      }
    })
    this.earth = new THREE.Mesh(geo, this.earthMat)
    this.earthGroup.add(this.earth)

    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(1.52, 64, 64),
      new THREE.ShaderMaterial({
        vertexShader: ATMO_VERT,
        fragmentShader: ATMO_FRAG,
        uniforms: { uGlow: { value: this.glow }, uTime: { value: 0 } },
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
      new THREE.SphereGeometry(1.9, 48, 32),
      new THREE.ShaderMaterial({
        vertexShader: ATMO_VERT,
        fragmentShader: ETHEREAL_FRAG,
        uniforms: { uGlow: { value: this.glow }, uTime: { value: 0 } },
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false
      })
    )
    this.ether = ether
    this.earthGroup.add(ether)
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
          const land = y < arcticRow ? 0 : lum > 0.2 || (gb > -0.08 && lum > 0.08) ? 255 : 0
          const o = (y * W + x) * 4
          out[o] = out[o + 1] = out[o + 2] = land
          out[o + 3] = 255
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
        depthTest: false,
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
    this.glow = Math.max(0, Math.min(1, v))
  }

  animate = () => {
    if (this.disposed) return
    requestAnimationFrame(this.animate)
    if (this.hidden) return
    const now = performance.now()
    if (this.frameMs && now - this.lastFrame < this.frameMs) return
    this.lastFrame = now
    const t = now / 1000

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
    if (this.atmo) {
      this.atmo.material.uniforms.uGlow.value = this.glow
      this.atmo.material.uniforms.uTime.value = t
    }
    if (this.ether) {
      this.ether.material.uniforms.uGlow.value = this.glow
      this.ether.material.uniforms.uTime.value = t
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
    if (this.dayTex) this.dayTex.dispose()
    if (this.nightTex) this.nightTex.dispose()
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
