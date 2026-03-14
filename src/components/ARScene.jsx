import { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

/*
  Gestures:
  - Single tap floor  → place new object (or drop selected object)
  - Single tap object → select it (follows reticle) / tap again to deselect
  - Two-finger pinch  → camera zoom (projection matrix, objects stay real-world scale)
  - Two-finger twist  → rotate selected object around Y axis
*/

export default function ARScene({ glbUrl, onExit }) {
  const canvasRef = useRef(null)
  const [status, setStatus] = useState('idle')
  const [placedCount, setPlacedCount] = useState(0)
  const [hasSelected, setHasSelected] = useState(false)
  const sessionRef = useRef(null)
  const zoomRef = useRef(1) // camera zoom factor, separate from scene scale

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

    // Reticle
    const reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.08, 0.10, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    )
    reticle.matrixAutoUpdate = false
    reticle.visible = false
    scene.add(reticle)

    /*
      Zoom proxy — rendered first (renderOrder -1000), modifies the XR camera's
      projection matrix AFTER Three.js updates it from the XR frame, but BEFORE
      any scene objects are drawn. This zooms the view without scaling objects.
      The XR system resets the matrix each frame so there's no accumulation.
    */
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
    let modelTemplate = null
    new GLTFLoader().load(glbUrl, gltf => { modelTemplate = gltf.scene })

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

    // Two-finger gesture tracking
    let lastPinchDist = null
    let lastPinchAngle = null

    function readTwoFingers(e) {
      if (e.touches.length < 2) return null
      const dx = e.touches[1].clientX - e.touches[0].clientX
      const dy = e.touches[1].clientY - e.touches[0].clientY
      return { dist: Math.sqrt(dx * dx + dy * dy), angle: Math.atan2(dy, dx) }
    }

    canvas.addEventListener('touchmove', e => {
      const pair = readTwoFingers(e)
      if (!pair) return
      if (lastPinchDist !== null) {
        // Pinch → zoom camera (projection matrix)
        zoomRef.current = THREE.MathUtils.clamp(
          zoomRef.current * (pair.dist / lastPinchDist), 0.5, 3
        )
        // Twist → rotate selected object around Y axis
        if (selected && lastPinchAngle !== null) {
          selected.rotation.y += pair.angle - lastPinchAngle
        }
      }
      lastPinchDist = pair.dist
      lastPinchAngle = pair.angle
    }, { passive: true })

    canvas.addEventListener('touchend', e => {
      if (e.touches.length < 2) { lastPinchDist = null; lastPinchAngle = null }
    }, { passive: true })

    // Tap: select existing object, drop selected, or place new
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

      if (!reticle.visible) return

      if (selected) {
        // Drop at current reticle position, keep Y rotation
        snapToFloor(selected, reticle, true)
        setHighlight(selected, false)
        selected = null
        setHasSelected(false)
      } else {
        if (!modelTemplate) return
        const model = modelTemplate.clone()
        snapToFloor(model, reticle, false)
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
    ? 'Trykk gulv for å flytte · To fingre for å rotere/zoome'
    : placedCount === 0
      ? 'Pek mot gulvet og trykk for å plassere'
      : 'Trykk objekt for å velge · To fingre for å zoome'

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

// Position object on floor from reticle matrix.
// preserveY: keep any manual Y rotation the user has applied.
function snapToFloor(object, reticle, preserveY) {
  const savedY = preserveY ? object.rotation.y : 0
  const rotMatrix = new THREE.Matrix4().extractRotation(reticle.matrix)
  object.position.setFromMatrixPosition(reticle.matrix)
  object.rotation.setFromRotationMatrix(rotMatrix)
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
