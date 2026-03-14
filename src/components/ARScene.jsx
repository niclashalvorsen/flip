import { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

/*
  Interaction model:
  - Tap floor (reticle visible, nothing selected) → place new object
  - Tap existing object → select it (highlighted), it follows the reticle
  - Tap floor while object selected → drop it there
  - Tap same object again → deselect
*/

export default function ARScene({ glbUrl, onExit }) {
  const canvasRef = useRef(null)
  const [status, setStatus] = useState('idle')
  const [placedCount, setPlacedCount] = useState(0)
  const [hasSelected, setHasSelected] = useState(false)
  const sessionRef = useRef(null)

  useEffect(() => {
    return () => { sessionRef.current?.end().catch(() => {}) }
  }, [])

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
    const camera = new THREE.PerspectiveCamera()

    scene.add(new THREE.AmbientLight(0xffffff, 1.2))
    const dir = new THREE.DirectionalLight(0xffffff, 1)
    dir.position.set(1, 2, 1)
    scene.add(dir)

    // Reticle ring on floor
    const reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.08, 0.10, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    )
    reticle.matrixAutoUpdate = false
    reticle.visible = false
    scene.add(reticle)

    // Load GLB template
    let modelTemplate = null
    new GLTFLoader().load(glbUrl, gltf => { modelTemplate = gltf.scene })

    // Mutable state (kept outside React to avoid stale closure issues)
    const placedObjects = []
    let selected = null

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

    // Pinch-to-zoom — scales the scene (visually identical to camera zoom)
    let lastPinchDist = null
    canvas.addEventListener('touchmove', e => {
      if (e.touches.length !== 2) return
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (lastPinchDist !== null) {
        const factor = dist / lastPinchDist
        const next = THREE.MathUtils.clamp(scene.scale.x * factor, 0.25, 4)
        scene.scale.setScalar(next)
      }
      lastPinchDist = dist
    }, { passive: true })
    canvas.addEventListener('touchend', e => {
      if (e.touches.length < 2) lastPinchDist = null
    }, { passive: true })

    session.addEventListener('select', () => {
      // Raycast from camera centre to check if an existing object was tapped
      const xrCamera = renderer.xr.getCamera()
      raycaster.setFromCamera(new THREE.Vector2(0, 0), xrCamera)
      const hits = raycaster.intersectObjects(placedObjects, true)

      if (hits.length > 0) {
        // Find root placed object for this hit
        const root = findRoot(hits[0].object, placedObjects)
        if (root) {
          if (selected === root) {
            // Tap same object → deselect
            setHighlight(root, false)
            selected = null
            setHasSelected(false)
          } else {
            if (selected) setHighlight(selected, false)
            selected = root
            setHighlight(root, true)
            setHasSelected(true)
          }
          return
        }
      }

      // Tapped floor / empty space
      if (!reticle.visible) return

      if (selected) {
        // Drop selected object at current reticle position
        applyReticleTransform(selected, reticle)
        setHighlight(selected, false)
        selected = null
        setHasSelected(false)
      } else {
        // Place a new object
        if (!modelTemplate) return
        const model = modelTemplate.clone()
        applyReticleTransform(model, reticle)
        scene.add(model)
        placedObjects.push(model)
        setPlacedCount(c => c + 1)
      }
    })

    session.addEventListener('end', () => {
      setStatus('idle')
      setPlacedCount(0)
      setHasSelected(false)
      onExit()
    })

    renderer.setAnimationLoop((_, frame) => {
      if (!frame) return
      const hitResults = frame.getHitTestResults(hitTestSource)
      if (hitResults.length > 0) {
        const pose = hitResults[0].getPose(refSpace)
        reticle.visible = true
        reticle.matrix.fromArray(pose.transform.matrix)
        // Selected object follows the reticle smoothly
        if (selected) applyReticleTransform(selected, reticle)
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
    ? 'Pek mot gulvet for å flytte — trykk for å slippe'
    : placedCount === 0
      ? 'Pek mot gulvet og trykk for å plassere'
      : 'Trykk på objekt for å flytte, eller gulvet for nytt'

  return (
    <div className="ar-scene">
      <canvas ref={canvasRef} className="ar-canvas" />
      <div id="ar-overlay" className="ar-overlay">
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
            <button className="ar-exit-btn" onClick={exitAR}>Ferdig</button>
          </>
        )}
      </div>
    </div>
  )
}

function applyReticleTransform(object, reticle) {
  object.position.setFromMatrixPosition(reticle.matrix)
  object.quaternion.setFromRotationMatrix(reticle.matrix)
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
