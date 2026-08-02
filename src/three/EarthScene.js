import * as THREE from 'three'
import dayUrl from '../assets/textures/earth_atmos.jpg'
import nightUrl from '../assets/textures/earth_lights_2048.png'

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
  varying vec3 vNormal;
  varying vec3 vPos;

  vec2 equirect(vec3 p) {
    return vec2(
      0.5 + atan(p.z, p.x) / 6.2831853,
      0.5 + asin(clamp(p.y, -1.0, 1.0)) / 3.14159265
    );
  }

  void main() {
    vec3 n = normalize(vNormal);
    vec3 sp = normalize(vPos);

    vec2 uv = equirect(sp);

    // real geography: continents, oceans, ice
    vec3 day = texture2D(uDayTex, uv).rgb;
    float polar = smoothstep(0.86, 0.99, abs(sp.y));
    vec3 base = mix(day * 1.1, vec3(0.85, 0.89, 0.97), polar);

    float ndl = dot(n, normalize(uSunDir));
    float sun = smoothstep(-0.08, 0.4, ndl);
    vec3 lit = base * (0.3 + 0.7 * sun) * (0.9 + 0.4 * uGlow);

    // genuine city lights on the night side, awakening as the world prays
    float night = 1.0 - smoothstep(-0.25, 0.08, ndl);
    vec3 cities = texture2D(uNightTex, uv).rgb * night * (0.3 + 0.7 * uGlow) * 1.5;

    // the Earth's own growing radiance — collected prayer
    vec3 radiance = vec3(0.16, 0.4, 0.3) * uGlow * uGlow * 1.5;

    // polar aurora
    float aur = polar * (0.5 + 0.5 * sin(uTime * 0.4 + sp.y * 6.0));
    vec3 aurora = vec3(0.1, 0.9, 0.6) * aur * night * 0.35;

    vec3 col = lit + cities + radiance + aurora;

    // warm dawn band where day meets night
    float term = smoothstep(0.1, -0.12, ndl) * (1.0 - smoothstep(-0.5, -0.2, ndl));
    vec3 dawn = vec3(1.0, 0.55, 0.3) * term * 0.12 * (0.5 + 0.5 * uGlow);
    col += dawn;

    // soft vignette at the limb
    float limb = smoothstep(0.0, 0.6, dot(n, vec3(0.0, 0.0, 1.0)));
    col *= 0.5 + 0.5 * limb;

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
      0.5 + atan(p.z, p.x) / 6.2831853,
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

    // coastline: land that borders ocean
    vec3 dR = texture2D(uDayTex, uv + vec2(0.004, 0.0)).rgb;
    vec3 dT = texture2D(uDayTex, uv + vec2(0.0, 0.006)).rgb;
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
    float coastA = coast * (0.10 + 0.5 * uGlow);
    float rimA = fres * 0.09;

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
  varying vec3 vNormal;
  varying vec3 vPos;
  void main() {
    vec3 viewDir = normalize(-vPos);
    float rim = 1.0 - max(dot(viewDir, normalize(vNormal)), 0.0);
    float f = pow(rim, 2.6);
    vec3 inner = mix(vec3(0.28, 0.5, 0.4), vec3(1.0, 0.84, 0.5), uGlow);
    float alpha = f * (0.55 + 0.6 * uGlow);
    gl_FragColor = vec4(inner, alpha);
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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.backdrop ? 1.25 : 1.6))
    this.renderer.setSize(w, h)
    this.renderer.setClearColor(0x000000, 0)
    container.appendChild(this.renderer.domElement)

    // sun light for the earth shader — toward the camera so the day side faces us
    this.sunDir = new THREE.Vector3(0.35, 0.28, 0.89).normalize()
    this.rotVel = this.backdrop ? 0.0008 : 0.0016

    // start facing Europe/Africa so recognizable geography greets the viewer
    this.earthGroupRotation = 1.25

    const loader = new THREE.TextureLoader()
    const dayTex = loader.load(dayUrl)
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
    this.scene.add(this.buildStars(this.backdrop ? 220 : 1000))

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
    const geo = new THREE.SphereGeometry(1.42, 72, 72)
    this.earthMat = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTime: { value: 0 },
        uGlow: { value: this.glow },
        uSunDir: { value: this.sunDir },
        uDayTex: { value: dayTex },
        uNightTex: { value: nightTex }
      }
    })
    this.earth = new THREE.Mesh(geo, this.earthMat)
    this.earthGroup.add(this.earth)

    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(1.52, 48, 48),
      new THREE.ShaderMaterial({
        vertexShader: ATMO_VERT,
        fragmentShader: ATMO_FRAG,
        uniforms: { uGlow: { value: this.glow } },
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false
      })
    )
    this.atmo = atmo
    this.earthGroup.add(atmo)
  }

  // A soft radial glow texture shared by all prayer lights.
  buildLightGlowTexture() {
    const S = 64
    const c = document.createElement('canvas')
    c.width = S
    c.height = S
    const ctx = c.getContext('2d')
    const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
    g.addColorStop(0, 'rgba(255, 244, 214, 1)')
    g.addColorStop(0.25, 'rgba(255, 224, 160, 0.85)')
    g.addColorStop(0.6, 'rgba(255, 190, 110, 0.28)')
    g.addColorStop(1, 'rgba(255, 170, 90, 0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, S, S)
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    return tex
  }

  // Lights are billboarded sprites (not point sprites): they keep a consistent
  // soft glow on every device and composite reliably. A pool is reused so only
  // cells with people praying actually draw.
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

  // Reuse the sprite pool: position/scale/light one per active grid cell.
  setLights(map) {
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
      spr.material.opacity = Math.min(0.95, 0.35 + n * 0.15)
      const s = 0.13 + Math.min(n, 8) * 0.02
      spr.scale.set(s, s, s)
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
    if (this.atmo) this.atmo.material.uniforms.uGlow.value = this.glow
    if (this.halo) this.halo.material.uniforms.uGlow.value = this.glow

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
