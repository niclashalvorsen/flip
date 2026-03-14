export default function ProductList({ category, products, onSelect }) {
  return (
    <div className="product-list">
      <h2>{category.label}</h2>
      {products.length === 0 ? (
        <p className="empty">Ingen produkter ennå. Kommer snart!</p>
      ) : (
        <div className="product-grid">
          {products.map(product => (
            <button key={product.id} className="product-card" onClick={() => onSelect(product)}>
              <div className="product-thumb">{category.emoji}</div>
              <div className="product-info">
                <div className="product-name">{product.name}</div>
                <div className="product-retailer">{product.retailer}</div>
                <div className="product-price">{product.price_nok.toLocaleString('nb-NO')} kr</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
