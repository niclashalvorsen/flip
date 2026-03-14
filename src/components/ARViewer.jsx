export default function ARViewer({ glbUrl, usdzUrl, alt, fullscreen }) {
  return (
    <div className={fullscreen ? 'ar-viewer ar-viewer--fullscreen' : 'ar-viewer'}>
      <model-viewer
        src={glbUrl}
        ios-src={usdzUrl ?? undefined}
        alt={alt}
        ar=""
        ar-modes="webxr scene-viewer quick-look"
        ar-scale="fixed"
        camera-controls=""
        auto-rotate=""
        shadow-intensity="1"
        environment-image="neutral"
      >
        <button slot="ar-button" className="ar-button">
          📱 Plasser i rommet
        </button>
      </model-viewer>
    </div>
  )
}
