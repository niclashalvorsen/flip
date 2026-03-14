import { useState } from 'react'
import CategoryBrowse from './CategoryBrowse'
import ProductList from './ProductList'
import { categories, products } from '../data/mockProducts'

export default function Katalog({ onClose, onSelect }) {
  const [selectedCategory, setSelectedCategory] = useState(null)

  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet sheet--tall" onClick={e => e.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-header">
          <h3 className="sheet-title">Katalog</h3>
          {selectedCategory && (
            <button className="back-btn" onClick={() => setSelectedCategory(null)}>← Tilbake</button>
          )}
        </div>
        <div className="sheet-scroll">
          {!selectedCategory ? (
            <CategoryBrowse categories={categories} onSelect={setSelectedCategory} compact />
          ) : (
            <ProductList
              category={selectedCategory}
              products={products.filter(p => p.category === selectedCategory.id)}
              onSelect={onSelect}
            />
          )}
        </div>
      </div>
    </div>
  )
}
