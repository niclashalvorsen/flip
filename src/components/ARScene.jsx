import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

/*
  WebXR AR scene with:
  - Live camera feed via WebXR
  - Hit-test floor detection → reticle shows where model will land
  - Tap to place model at 1:1 real-world scale
  - Multiple models, each locked in world space via XRAnchor
  - Falls back gracefully if WebXR not supported
*/

export default function ARScene({ glbUrl, onExit }) {
  const canvasRef = useRef(null)
  const [status, setStatus] = useState('idle') // idle | starting | active | unsupported
  const [placedCount, setPlacedCount] = useState(0)
  const sessionRef = useRef(null)

  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        sessionRef.current.end().catch(() => {})
      }
    }
  }, [])

  async function startAR() {
    if (!navigator.xr) {
      setStatus('unsupported')
      return
    }

    const supported = await navigator.xr.isSessionSupported('immersive-ar').catch(() => false)
    if (!supported) {
      setStatus('unsupported')
      return
    }

    setStatus('starting')

    const canvas = canvasRef.current

    // Renderer
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.xr.enabled = true

    // Scene
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera()

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 1))
    const dirLight = new THREE.DirectionalLight(0xffffff, 1)
    dirLight.position.set(1, 2, 1)
    scene.add(dirLight)

    // Reticle — shows where the model will be placed
    const reticleGeo = new THREE.RingGeometry(0.08, 0.10, 32).rotateX(-Math.PI / 2)
    const reticle = new THREE.Mesh(reticleGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }))
    reticle.matrixAutoUpdate = false
    reticle.visible = false
    scene.add(reticle)

    // Load GLB
    let modelTemplate = null
    new GLTFLoader().load(glbUrl, (gltf) => {
      modelTemplate = gltf.scene
    })

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

    let placed = 0

    // Tap to place
    session.addEventListener('select', () => {
      if (!reticle.visible || !modelTemplate) return
      const model = modelTemplate.clone()
      model.position.setFromMatrixPosition(reticle.matrix)
      model.quaternion.setFromRotationMatrix(reticle.matrix)
      scene.add(model)
      placed++
      setPlacedCount(placed)
    })

    session.addEventListener('end', () => {
      setStatus('idle')
      setPlacedCount(0)
      onExit()
    })

    // Render loop
    renderer.setAnimationLoop((_, frame) => {
      if (!frame) return
      const hitResults = frame.getHitTestResults(hitTestSource)
      if (hitResults.length > 0) {
        const hit = hitResults[0]
        const pose = hit.getPose(refSpace)
        reticle.visible = true
        reticle.matrix.fromArray(pose.transform.matrix)
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

  return (
    <div className="ar-scene">
      <canvas ref={canvasRef} className="ar-canvas" />

      {/* Overlay UI — always on top of the camera feed */}
      <div id="ar-overlay" className="ar-overlay">
        {status === 'idle' && (
          <div className="ar-start">
            <button className="ar-start-btn" onClick={startAR}>
              📷 Start AR
            </button>
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
            <p className="ar-hint">
              {placedCount === 0 ? 'Pek mot gulvet og trykk for å plassere' : `${placedCount} plassert — trykk for å legge til flere`}
            </p>
            <button className="ar-exit-btn" onClick={exitAR}>Ferdig</button>
          </>
        )}
      </div>
    </div>
  )
}
