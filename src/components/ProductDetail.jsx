import ARViewer from './ARViewer'

export default function ProductDetail({ product }) {
  const dims = [
    product.height_cm && `H: ${product.height_cm} cm`,
    product.width_cm && `B: ${product.width_cm} cm`,
    product.depth_cm && `D: ${product.depth_cm} cm`,
  ].filter(Boolean).join(' · ')

  return (
    <div className="product-detail">
      <ARViewer glbUrl={product.glb_url} usdzUrl={product.usdz_url} alt={product.name} />
      <div className="detail-info">
        <h2>{product.name}</h2>
        <div className="detail-retailer">{product.retailer}</div>
        <div className="detail-price">{product.price_nok.toLocaleString('nb-NO')} kr</div>
        {dims && <div className="detail-dims">{dims}</div>}
        <a href={product.affiliate_url} className="buy-btn" target="_blank" rel="noopener noreferrer">
          Kjøp hos {product.retailer} →
        </a>
      </div>
    </div>
  )
}
