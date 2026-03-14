import { useRef, useEffect } from 'react'

export default function ARViewer({ glbUrl, usdzUrl, alt, fullscreen }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.setAttribute('ar', '')
    el.setAttribute('ar-modes', 'webxr scene-viewer quick-look')
    el.setAttribute('ar-scale', 'fixed')
    el.setAttribute('camera-controls', '')
    el.setAttribute('auto-rotate', '')
    el.setAttribute('shadow-intensity', '1')
    el.setAttribute('environment-image', 'neutral')
  }, [])

  return (
    <div className={fullscreen ? 'ar-viewer ar-viewer--fullscreen' : 'ar-viewer'}>
      <model-viewer ref={ref} src={glbUrl} ios-src={usdzUrl ?? undefined} alt={alt}>
        <button slot="ar-button" className="ar-button">
          📱 Plasser i rommet
        </button>
      </model-viewer>
    </div>
  )
}
