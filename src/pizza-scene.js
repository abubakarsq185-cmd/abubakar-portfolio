/**
 * pizza-scene.js — the cinematic hero centrepiece.
 *
 * A fully procedural Chicken Tikka BBQ pizza built from Three.js primitives
 * (no external GLB needed), lit with a generated PBR environment for warm
 * reflections, topped with pepperoni / tikka / herbs, and finished with
 * rising steam particles. It auto-rotates, responds to drag/touch with
 * inertia, and parallaxes gently with the pointer.
 *
 * Designed to hold 60fps: capped pixel ratio, render paused when the hero is
 * off-screen, and a lighter path when prefers-reduced-motion is set.
 */

import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'

export function initPizzaScene(canvas) {
  if (!canvas) return { dispose() {} }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const parent = canvas.parentElement
  const sizeOf = () => ({
    w: parent.clientWidth || window.innerWidth,
    h: parent.clientHeight || window.innerHeight,
  })

  let { w, h } = sizeOf()

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(w, h, false)
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.96

  const scene = new THREE.Scene()

  // Generated environment → soft PBR reflections without shipping an HDRI file.
  const pmrem = new THREE.PMREMGenerator(renderer)
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture

  const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 100)
  camera.position.set(0, 2.9, 6.4)
  camera.lookAt(0, 0, 0)

  /* ---------- lighting (cinematic, warm) ---------- */
  scene.add(new THREE.AmbientLight(0xfff1dd, 0.35))

  const key = new THREE.DirectionalLight(0xffe6bf, 2.4)
  key.position.set(3.4, 6.2, 4.2)
  scene.add(key)

  const rim = new THREE.SpotLight(0xffb765, 26, 20, Math.PI / 6, 0.55, 1.4)
  rim.position.set(-4.5, 4, -3)
  scene.add(rim)

  const fill = new THREE.PointLight(0xff8a3d, 7, 16)
  fill.position.set(-3, 1.2, 3.2)
  scene.add(fill)

  /* ---------- the pizza ---------- */
  const pizza = new THREE.Group()
  scene.add(pizza)

  // Crust rim (torus) — warm baked colour, matte with a touch of sheen.
  const crustMat = new THREE.MeshPhysicalMaterial({
    color: 0xc9853f,
    roughness: 0.72,
    metalness: 0,
    clearcoat: 0.25,
    clearcoatRoughness: 0.6,
    sheen: 0.4,
    sheenColor: new THREE.Color(0xffcf8a),
  })
  const crust = new THREE.Mesh(new THREE.TorusGeometry(2.05, 0.34, 24, 90), crustMat)
  crust.rotation.x = Math.PI / 2
  crust.position.y = 0.04
  pizza.add(crust)

  // Dough base.
  const baseMat = new THREE.MeshStandardMaterial({ color: 0xe0a55c, roughness: 0.85 })
  const base = new THREE.Mesh(new THREE.CylinderGeometry(2.18, 2.12, 0.28, 90), baseMat)
  base.position.y = -0.06
  pizza.add(base)

  // Cheese / sauce top — glossy melted look via clearcoat.
  const cheeseMat = new THREE.MeshPhysicalMaterial({
    color: 0xd99a38,
    roughness: 0.5,
    clearcoat: 0.55,
    clearcoatRoughness: 0.35,
    sheen: 0.5,
    sheenColor: new THREE.Color(0xffd98a),
  })
  const cheese = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.0, 0.16, 90), cheeseMat)
  cheese.position.y = 0.14
  pizza.add(cheese)

  // A hint of BBQ sauce swirl using a slightly darker ring.
  const sauceMat = new THREE.MeshStandardMaterial({
    color: 0x8f3d1b,
    roughness: 0.5,
    transparent: true,
    opacity: 0.55,
  })
  const sauce = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.18, 16, 64), sauceMat)
  sauce.rotation.x = Math.PI / 2
  sauce.position.y = 0.22
  pizza.add(sauce)

  // Toppings — pepperoni, tikka chunks, herbs — scattered without overlap.
  const pepMat = new THREE.MeshStandardMaterial({ color: 0xb0301c, roughness: 0.45 })
  const tikkaMat = new THREE.MeshStandardMaterial({ color: 0x7a3a12, roughness: 0.6 })
  const herbMat = new THREE.MeshStandardMaterial({ color: 0x3f7d2e, roughness: 0.8 })
  const oliveMat = new THREE.MeshStandardMaterial({ color: 0x22201c, roughness: 0.4, metalness: 0.1 })

  const pepGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.08, 20)
  const tikkaGeo = new THREE.BoxGeometry(0.26, 0.14, 0.26)
  const herbGeo = new THREE.TetrahedronGeometry(0.07)
  const oliveGeo = new THREE.TorusGeometry(0.09, 0.045, 8, 16)

  // Deterministic-ish placement across the disc.
  const rand = mulberry32(20260723)
  const placed = []
  const canPlace = (x, z, min) => placed.every((p) => Math.hypot(p.x - x, p.z - z) > min)

  const addTopping = (geo, mat, count, minDist, yTop, jitterRot) => {
    for (let i = 0; i < count; i++) {
      let x = 0
      let z = 0
      let ok = false
      for (let t = 0; t < 30 && !ok; t++) {
        const r = Math.sqrt(rand()) * 1.7
        const a = rand() * Math.PI * 2
        x = Math.cos(a) * r
        z = Math.sin(a) * r
        ok = canPlace(x, z, minDist)
      }
      placed.push({ x, z })
      const m = new THREE.Mesh(geo, mat)
      m.position.set(x, yTop, z)
      if (jitterRot) m.rotation.set(rand() * 0.4, rand() * Math.PI, rand() * 0.4)
      else m.rotation.y = rand() * Math.PI
      pizza.add(m)
    }
  }

  addTopping(pepGeo, pepMat, 9, 0.62, 0.24, false)
  addTopping(tikkaGeo, tikkaMat, 11, 0.5, 0.25, true)
  addTopping(oliveGeo, oliveMat, 8, 0.45, 0.25, true)
  addTopping(herbGeo, herbMat, 22, 0.18, 0.27, true)

  // Serving board underneath.
  const boardMat = new THREE.MeshPhysicalMaterial({
    color: 0x2a1a10,
    roughness: 0.55,
    clearcoat: 0.4,
  })
  const board = new THREE.Mesh(new THREE.CylinderGeometry(2.85, 2.85, 0.16, 64), boardMat)
  board.position.y = -0.34
  pizza.add(board)

  /* ---------- steam particles ---------- */
  const steam = createSteam()
  if (!reduceMotion) scene.add(steam.points)

  /* ---------- postprocessing (subtle bloom) ---------- */
  let composer = null
  const enableBloom = !reduceMotion && w > 480
  if (enableBloom) {
    composer = new EffectComposer(renderer)
    composer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    composer.setSize(w, h)
    composer.addPass(new RenderPass(scene, camera))
    const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.26, 0.8, 0.92)
    composer.addPass(bloom)
  }

  /* ---------- interaction ---------- */
  const pointer = { x: 0, y: 0 }
  let dragging = false
  let lastX = 0
  let spinVel = 0 // user-added angular velocity, decays over time
  let userYaw = 0

  const onMove = (e) => {
    const cx = e.touches ? e.touches[0].clientX : e.clientX
    const cy = e.touches ? e.touches[0].clientY : e.clientY
    pointer.x = (cx / window.innerWidth - 0.5) * 2
    pointer.y = (cy / window.innerHeight - 0.5) * 2
    if (dragging) {
      const dx = cx - lastX
      lastX = cx
      spinVel = dx * 0.005
      userYaw += spinVel
    }
  }
  const onDown = (e) => {
    dragging = true
    lastX = e.touches ? e.touches[0].clientX : e.clientX
    canvas.style.cursor = 'grabbing'
  }
  const onUp = () => {
    dragging = false
    canvas.style.cursor = 'grab'
  }

  window.addEventListener('pointermove', onMove, { passive: true })
  canvas.addEventListener('pointerdown', onDown)
  window.addEventListener('pointerup', onUp)
  canvas.addEventListener('touchstart', onDown, { passive: true })
  canvas.addEventListener('touchmove', onMove, { passive: true })
  window.addEventListener('touchend', onUp)
  canvas.style.cursor = 'grab'

  /* ---------- resize ---------- */
  const onResize = () => {
    const s = sizeOf()
    w = s.w
    h = s.h
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    if (composer) composer.setSize(w, h)
  }
  window.addEventListener('resize', onResize)

  /* ---------- visibility: pause when off-screen ---------- */
  let visible = true
  const io = new IntersectionObserver(
    (entries) => entries.forEach((en) => (visible = en.isIntersecting)),
    { threshold: 0.01 },
  )
  io.observe(canvas)

  /* ---------- render loop ---------- */
  const clock = new THREE.Clock()
  let raf = 0
  let tiltX = 0
  let tiltY = 0

  const loop = () => {
    raf = requestAnimationFrame(loop)
    if (!visible) return
    const dt = Math.min(clock.getDelta(), 0.05)
    const t = clock.elapsedTime

    // Auto-rotate + decaying user spin.
    const auto = reduceMotion ? 0 : 0.28
    spinVel *= 0.94
    userYaw += spinVel
    pizza.rotation.y += auto * dt + spinVel

    // Pointer parallax + gentle bob.
    tiltX += (pointer.y * 0.12 - tiltX) * 0.05
    tiltY += (pointer.x * 0.18 - tiltY) * 0.05
    pizza.rotation.x = -0.14 + tiltX
    pizza.rotation.z = tiltY * 0.4
    pizza.position.y = reduceMotion ? 0 : Math.sin(t * 0.9) * 0.06

    if (!reduceMotion) steam.update(dt)

    if (composer) composer.render()
    else renderer.render(scene, camera)
  }
  loop()

  /* ---------- cleanup ---------- */
  function dispose() {
    cancelAnimationFrame(raf)
    io.disconnect()
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
    window.removeEventListener('touchend', onUp)
    window.removeEventListener('resize', onResize)
    canvas.removeEventListener('pointerdown', onDown)
    canvas.removeEventListener('touchstart', onDown)
    canvas.removeEventListener('touchmove', onMove)
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose()
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material]
        mats.forEach((m) => m.dispose())
      }
    })
    pmrem.dispose()
    if (composer) composer.dispose()
    renderer.dispose()
  }

  return { dispose }
}

/* ---------- steam particle system ---------- */
function createSteam() {
  const COUNT = 46
  const geo = new THREE.BufferGeometry()
  const pos = new Float32Array(COUNT * 3)
  const speed = new Float32Array(COUNT)
  const life = new Float32Array(COUNT)

  const reset = (i, initial) => {
    pos[i * 3] = (Math.random() - 0.5) * 2.4
    pos[i * 3 + 1] = 0.3 + (initial ? Math.random() * 2.5 : 0)
    pos[i * 3 + 2] = (Math.random() - 0.5) * 2.4
    speed[i] = 0.4 + Math.random() * 0.5
    life[i] = initial ? Math.random() : 0
  }
  for (let i = 0; i < COUNT; i++) reset(i, true)

  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))

  const mat = new THREE.PointsMaterial({
    size: 0.55,
    map: steamTexture(),
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    color: 0xfff3e0,
  })

  const points = new THREE.Points(geo, mat)

  const update = (dt) => {
    const arr = geo.attributes.position.array
    for (let i = 0; i < COUNT; i++) {
      life[i] += dt * 0.35
      arr[i * 3 + 1] += speed[i] * dt
      arr[i * 3] += Math.sin(life[i] * 2 + i) * dt * 0.15
      if (arr[i * 3 + 1] > 3.2) reset(i, false)
    }
    geo.attributes.position.needsUpdate = true
  }

  return { points, update }
}

function steamTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,0.9)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/* Small seeded PRNG so topping layout is stable between reloads. */
function mulberry32(seed) {
  let a = seed
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
