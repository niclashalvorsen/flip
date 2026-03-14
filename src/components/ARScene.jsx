import { useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

export default function ARScene({ glbUrl, onExit }) {
  const canvasRef = useRef(null)
  const [status, setStatus] = useState('idle')
  const [placedCount, setPlacedCount] = useState(0)
  const [hasSelected, setHasSelected] = useState(false)
  const [rotationDeg, setRotationDeg] = useState(0)

  const sessionRef = useRef(null)
  const selectedRef = useRef(null)
  const addFnRef = useRef(null)
  const removeFnRef = useRef(null)

  function handleAdd() { addFnRef.current?.() }
  function handleRemove() { removeFnRef.current?.() }

  function handleRotation(e) {
    const deg = Number(e.target.value)
    setRotationDeg(deg)
    if (selectedRef.current) {
      selectedRef.current.rotation.y = THREE.MathUtils.degToRad(deg)
    }
  }

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

    const reticle = new THREE.Mesh(
      new THREE.RingGeometry(0.08, 0.10, 32).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    )
    reticle.matrixAutoUpdate = false
    reticle.visible = false
    scene.add(reticle)

    let modelTemplate = null
    new GLTFLoader().load(glbUrl, gltf => { modelTemplate = gltf.scene })

    const placedObjects = []
    let selected = null

    addFnRef.current = () => {
      if (!reticle.visible || !modelTemplate) return
      const model = modelTemplate.clone()
      snapToFloor(model, reticle, false)
      scene.add(model)
      placedObjects.push(model)
      setPlacedCount(c => c + 1)
    }

    removeFnRef.current = () => {
      if (!selected) return
      scene.remove(selected)
      placedObjects.splice(placedObjects.indexOf(selected), 1)
      setHighlight(selected, false)
      selected = null
      selectedRef.current = null
      setHasSelected(false)
      setPlacedCount(c => c - 1)
    }

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
            // Sync slider to object's current rotation
            const deg = Math.round(THREE.MathUtils.radToDeg(root.rotation.y) % 360)
            setRotationDeg((deg + 360) % 360)
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

  const hint = placedCount === 0
    ? 'Pek mot gulvet og trykk "Legg til her"'
    : 'Trykk på et objekt for å velge det'

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

            {hasSelected && (
              <div className="ar-rotation">
                <span className="ar-rotation-label">Roter</span>
                <input
                  type="range"
                  className="ar-slider"
                  min="0"
                  max="359"
                  value={rotationDeg}
                  onChange={handleRotation}
                />
              </div>
            )}

            <div className="ar-buttons">
              {hasSelected && (
                <button className="ar-btn ar-btn--danger" onClick={handleRemove}>🗑 Fjern</button>
              )}
              <button className="ar-btn" onClick={handleAdd}>+ Legg til her</button>
              <button className="ar-btn ar-btn--ghost" onClick={exitAR}>Ferdig</button>
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
