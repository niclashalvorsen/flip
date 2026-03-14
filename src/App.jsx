import { useState } from 'react'
import ARViewer from './components/ARViewer'
import LeggTil from './components/LeggTil'
import Katalog from './components/Katalog'
import { products } from './data/mockProducts'

const DEFAULT_PRODUCT = products[0]

export default function App() {
  const [currentProduct, setCurrentProduct] = useState(DEFAULT_PRODUCT)
  const [sheet, setSheet] = useState(null) // 'legg-til' | 'katalog' | null

  function selectProduct(product) {
    if (product) setCurrentProduct(product)
    setSheet(null)
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
