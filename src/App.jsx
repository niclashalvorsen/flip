import { useState } from 'react'
import CategoryBrowse from './components/CategoryBrowse'
import ProductList from './components/ProductList'
import ProductDetail from './components/ProductDetail'
import { categories, products } from './data/mockProducts'

export default function App() {
  const [view, setView] = useState('home')
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [selectedProduct, setSelectedProduct] = useState(null)

  function selectCategory(category) {
    setSelectedCategory(category)
    setView('list')
  }

  function selectProduct(product) {
    setSelectedProduct(product)
    setView('detail')
  }

  function goBack() {
    if (view === 'detail') setView('list')
    else { setView('home'); setSelectedCategory(null) }
  }

  return (
    <div className="app">
      <header className="header">
        <button className="logo" onClick={() => { setView('home'); setSelectedCategory(null); setSelectedProduct(null) }}>
          ARrom
        </button>
        {view !== 'home' && (
          <button className="back-btn" onClick={goBack}>← Tilbake</button>
        )}
      </header>
      <main className="main">
        {view === 'home' && (
          <CategoryBrowse categories={categories} onSelect={selectCategory} />
        )}
        {view === 'list' && (
          <ProductList
            category={selectedCategory}
            products={products.filter(p => p.category === selectedCategory.id)}
            onSelect={selectProduct}
          />
        )}
        {view === 'detail' && (
          <ProductDetail product={selectedProduct} />
        )}
      </main>
    </div>
  )
}
