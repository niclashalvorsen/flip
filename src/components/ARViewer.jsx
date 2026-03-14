import { useRef, useEffect } from 'react'

export default function ARViewer({ glbUrl, usdzUrl, alt, fullscreen, onStartAR }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.setAttribute('camera-controls', '')
    el.setAttribute('auto-rotate', '')
    el.setAttribute('shadow-intensity', '1')
    el.setAttribute('environment-image', 'neutral')
  }, [])

  return (
    <div className={fullscreen ? 'ar-viewer ar-viewer--fullscreen' : 'ar-viewer'}>
      {glbUrl ? (
        <>
          <model-viewer ref={ref} src={glbUrl} ios-src={usdzUrl ?? undefined} alt={alt} />
          {onStartAR && (
            <button className="ar-button" onClick={onStartAR}>
              📷 Plasser i rommet
            </button>
          )}
        </>
      ) : (
        <div className="ar-empty">
          <p>Velg et produkt fra katalogen</p>
          <p className="ar-empty-hint">eller legg til fra nettbutikk</p>
        </div>
      )}
    </div>
  )
}
