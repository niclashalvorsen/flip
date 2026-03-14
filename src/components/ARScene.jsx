import { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

/*
  Interaction model:
  - Tap object       → select / deselect (XR select event)
  - "Legg til" btn   → place new object at reticle
  - "Fjern" btn      → remove selected object
  - Two-finger pinch → zoom (projection matrix, objects stay real-world scale)
  - Two-finger twist → rotate selected object around Y axis

  Touch events for gestures are captured on a DOM overlay layer,
  which works reliably in WebXR unlike listening on the canvas.
*/

export default function ARScene({ glbUrl, onExit }) {
  const canvasRef = useRef(null)
  const [status, setStatus] = useState('idle')
  const [placedCount, setPlacedCount] = useState(0)
  const [hasSelected, setHasSelected] = useState(false)

  // Shared refs — let React UI call into the live AR loop
  const sessionRef = useRef(null)
  const zoomRef = useRef(1)
  const selectedRef = useRef(null)       // currently selected Three.js object
  const reticleRef = useRef(null)        // Three.js reticle mesh
  const placedRef = useRef([])           // placed objects array
  const sceneRef = useRef(null)
  const modelTemplateRef = useRef(null)
  const addFnRef = useRef(null)          // callable from button
  const removeFnRef = useRef(null)

  // Two-finger gesture state (refs so no stale closures in touch handlers)
  const pinchDistRef = useRef(null)
  const pinchAngleRef = useRef(null)

  useEffect(() => {
    return () => { sessionRef.current?.end().catch(() => {}) }
  }, [])

  // ── Button handlers (called from React UI, delegate into AR loop via refs) ──

  function handleAdd() {
    addFnRef.current?.()
  }

  function handleRemove() {
    removeFnRef.current?.()
  }

  // ── Two-finger touch handlers (attached to DOM overlay, not canvas) ──

  function onTouchMove(e) {
    if (e.touches.length < 2) return
    const dx = e.touches[1].clientX - e.touches[0].clientX
    const dy = e.touches[1].clientY - e.touches[0].clientY
    const dist = Math.sqrt(dx * dx + dy * dy)
    const angle = Math.atan2(dy, dx)

    if (pinchDistRef.current !== null) {
      // Pinch → camera zoom via projection matrix
      zoomRef.current = THREE.MathUtils.clamp(
        zoomRef.current * (dist / pinchDistRef.current), 0.5, 3
      )
      // Twist → rotate selected object around Y
      if (selectedRef.current && pinchAngleRef.current !== null) {
        selectedRef.current.rotation.y += angle - pinchAngleRef.current
      }
    }
    pinchDistRef.current = dist
    pinchAngleRef.current = angle
  }

  function onTouchEnd(e) {
    if (e.touches.length < 2) {
      pinchDistRef.current = null
      pinchAngleRef.current = null
    }
  }

  // ── Start WebXR session ──

  async function startAR() {
    if (!navigator.xr) { setStatus('unsupported'); return }
    const supported = await navigator.xr.isSessionSupported('immersive-ar').catch(() => false)
    if (!supported) { setStatus('unsupported'); return }
    setStatus('starting')

    const canvas = canvasRef.current
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.xr.enabled = true

    const scene = new THREE.Scene()
    sceneRef.current = scene
    const camera = new THREE.PerspectiveCamera()

    scene.add(new THREE.AmbientLight(0xffffff, 1.2))
    const dir = new THREE.DirectionalLight(0xffffff, 1)
    dir.position.set(1, 2, 1)
    scene.add(dir)

    // Reticle
    const reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.08, 0.10, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    )
    reticle.matrixAutoUpdate = false
    reticle.visible = false
    scene.add(reticle)
    reticleRef.current = reticle

    // Zoom proxy — fires onBeforeRender after XR updates matrices, before draw
    const zoomProxy = new THREE.Mesh(new THREE.BufferGeometry())
    zoomProxy.frustumCulled = false
    zoomProxy.renderOrder = -1000
    zoomProxy.onBeforeRender = (_, __, cam) => {
      if (!cam.isArrayCamera) return
      const z = zoomRef.current
      cam.cameras.forEach(c => {
        c.projectionMatrix.elements[0] *= z
        c.projectionMatrix.elements[5] *= z
        c.projectionMatrixInverse.copy(c.projectionMatrix).invert()
      })
    }
    scene.add(zoomProxy)

    // Load GLB
    new GLTFLoader().load(glbUrl, gltf => { modelTemplateRef.current = gltf.scene })

    const placedObjects = []
    placedRef.current = placedObjects
    let selected = null

    // Wire up button callbacks
    addFnRef.current = () => {
      if (!reticle.visible || !modelTemplateRef.current) return
      const model = modelTemplateRef.current.clone()
      snapToFloor(model, reticle, false)
      scene.add(model)
      placedObjects.push(model)
      setPlacedCount(c => c + 1)
    }

    removeFnRef.current = () => {
      if (!selected) return
      scene.remove(selected)
      const idx = placedObjects.indexOf(selected)
      if (idx !== -1) placedObjects.splice(idx, 1)
      setHighlight(selected, false)
      selected = null
      selectedRef.current = null
      setHasSelected(false)
      setPlacedCount(c => c - 1)
    }

    // XR session
    const session = await navigator.xr.requestSession('immersive-ar', {
      requiredFeatures: ['hit-test'],
      optionalFeatures: ['anchors', 'dom-overlay'],
      domOverlay: { root: document.getElementById('ar-overlay') },
    })
    sessionRef.current = session
    renderer.xr.setReferenceSpaceType('local')
    await renderer.xr.setSession(session)
    setStatus('active')

    const refSpace = await session.requestReferenceSpace('local')
    const viewerSpace = await session.requestReferenceSpace('viewer')
    const hitTestSource = await session.requestHitTestSource({ space: viewerSpace })
    const raycaster = new THREE.Raycaster()

    // XR select = tap → select / deselect object only
    session.addEventListener('select', () => {
      const xrCamera = renderer.xr.getCamera()
      raycaster.setFromCamera(new THREE.Vector2(0, 0), xrCamera)
      const hits = raycaster.intersectObjects(placedObjects, true)

      if (hits.length > 0) {
        const root = findRoot(hits[0].object, placedObjects)
        if (root) {
          if (selected === root) {
            setHighlight(root, false)
            selected = null
            selectedRef.current = null
            setHasSelected(false)
          } else {
            if (selected) setHighlight(selected, false)
            selected = root
            selectedRef.current = root
            setHighlight(root, true)
            setHasSelected(true)
          }
        }
      }
    })

    session.addEventListener('end', () => {
      setStatus('idle')
      setPlacedCount(0)
      setHasSelected(false)
      selectedRef.current = null
      onExit()
    })

    renderer.setAnimationLoop((_, frame) => {
      if (!frame) return
      const hitResults = frame.getHitTestResults(hitTestSource)
      if (hitResults.length > 0) {
        const pose = hitResults[0].getPose(refSpace)
        reticle.visible = true
        reticle.matrix.fromArray(pose.transform.matrix)
        if (selected) snapToFloor(selected, reticle, true)
      } else {
        reticle.visible = false
      }
      renderer.render(scene, camera)
    })
  }

  async function exitAR() {
    if (sessionRef.current) {
      await sessionRef.current.end().catch(() => {})
      sessionRef.current = null
    }
    onExit()
  }

  const hint = hasSelected
    ? 'To fingre: klyp for zoom · vri for rotasjon'
    : placedCount === 0
      ? 'Pek mot gulvet, trykk "Legg til" for å plassere'
      : 'Trykk på objekt for å velge'

  return (
    <div className="ar-scene">
      <canvas ref={canvasRef} className="ar-canvas" />

      <div
        id="ar-overlay"
        className="ar-overlay"
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {status === 'idle' && (
          <div className="ar-start">
            <button className="ar-start-btn" onClick={startAR}>📷 Start AR</button>
          </div>
        )}
        {status === 'starting' && (
          <div className="ar-start">
            <div className="spinner" />
            <p>Starter kamera…</p>
          </div>
        )}
        {status === 'unsupported' && (
          <div className="ar-start">
            <p className="ar-unsupported">AR er ikke støttet i denne nettleseren.<br />Bruk Chrome på Android.</p>
            <button className="ar-exit-btn" onClick={onExit}>Lukk</button>
          </div>
        )}
        {status === 'active' && (
          <>
            <p className="ar-hint">{hint}</p>
            <div className="ar-buttons">
              {hasSelected && (
                <button className="ar-btn ar-btn--danger" onClick={handleRemove}>
                  🗑 Fjern
                </button>
              )}
              <button className="ar-btn" onClick={handleAdd}>
                + Legg til her
              </button>
              <button className="ar-btn ar-btn--ghost" onClick={exitAR}>
                Ferdig
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function snapToFloor(object, reticle, preserveY) {
  const savedY = preserveY ? object.rotation.y : 0
  object.position.setFromMatrixPosition(reticle.matrix)
  object.rotation.setFromRotationMatrix(new THREE.Matrix4().extractRotation(reticle.matrix))
  object.rotation.y = savedY
}

function findRoot(mesh, placedObjects) {
  let node = mesh
  while (node) {
    if (placedObjects.includes(node)) return node
    node = node.parent
  }
  return null
}

function setHighlight(object, on) {
  object.traverse(child => {
    if (child.isMesh) {
      const mats = Array.isArray(child.material) ? child.material : [child.material]
      mats.forEach(m => { if (m.emissive) m.emissive.setHex(on ? 0x333333 : 0x000000) })
    }
  })
}
