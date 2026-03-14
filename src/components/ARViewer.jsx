export default function ARViewer({ glbUrl, usdzUrl, alt }) {
  return (
    <div className="ar-viewer">
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
        style={{ width: '100%', height: '360px', background: '#1a1a1a', borderRadius: '12px' }}
      >
        <button slot="ar-button" className="ar-button">
          📱 Plasser i rommet
        </button>
      </model-viewer>
    </div>
  )
}
