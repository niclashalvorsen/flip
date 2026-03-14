import { useState, lazy, Suspense } from 'react'
import ARViewer from './components/ARViewer'
const ARScene = lazy(() => import('./components/ARScene'))
import LeggTil from './components/LeggTil'
import Katalog from './components/Katalog'

export default function App() {
  const [currentProduct, setCurrentProduct] = useState(null)
  const [sheet, setSheet] = useState(null)   // 'legg-til' | 'katalog' | null
  const [arActive, setArActive] = useState(false)

  function selectProduct(product) {
    if (product) setCurrentProduct(product)
    setSheet(null)
  }

  if (arActive && currentProduct) {
    return (
      <Suspense fallback={null}>
        <ARScene glbUrl={currentProduct.glb_url} onExit={() => setArActive(false)} />
      </Suspense>
    )
  }

  return (
    <div className="app">
      <header className="header">
        <span className="logo">ARrom</span>
      </header>

      <div className="viewer-wrap">
        <ARViewer
          glbUrl={currentProduct?.glb_url}
          usdzUrl={currentProduct?.usdz_url}
          alt={currentProduct?.name}
          fullscreen
          onStartAR={() => setArActive(true)}
        />
      </div>

      <div className="bottom-bar">
        <button className="bottom-btn" onClick={() => setSheet('legg-til')}>
          + Legg til
        </button>
        <button className="bottom-btn bottom-btn--secondary" onClick={() => setSheet('katalog')}>
          Katalog
        </button>
      </div>

      {sheet === 'legg-til' && (
        <LeggTil onClose={() => setSheet(null)} onModelReady={selectProduct} />
      )}
      {sheet === 'katalog' && (
        <Katalog onClose={() => setSheet(null)} onSelect={selectProduct} />
      )}
    </div>
  )
}
