export default function CategoryBrowse({ categories, onSelect, compact }) {
  return (
    <div className="category-browse">
      {!compact && (
        <div className="hero">
          <h1>Se produkter i rommet ditt</h1>
          <p>Bruk AR til å visualisere møbler og interiør hjemme hos deg</p>
        </div>
      )}
      <div className="category-grid">
        {categories.map(cat => (
          <button key={cat.id} className="category-card" onClick={() => onSelect(cat)}>
            <span className="category-emoji">{cat.emoji}</span>
            <span className="category-label">{cat.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
