export default function ProductCard({ group, cart, onChangeQty }) {
  return (
    <div className="card">
      <h3>{group.flavor}</h3>
      <div className="variants">
        {group.variants.map((v) => {
          const qty = cart[v.productId] || 0;
          return (
            <div key={v.productId} className="row">
              <div className="info">
                {v.label} <span className="price">₱{v.price}</span>
              </div>
              <div className="stepper">
                <button
                  type="button"
                  onClick={() => onChangeQty(v.productId, -1)}
                  aria-label={`Remove one ${group.flavor} ${v.label}`}
                >
                  −
                </button>
                <span className="qty">{qty}</span>
                <button
                  type="button"
                  onClick={() => onChangeQty(v.productId, 1)}
                  aria-label={`Add one ${group.flavor} ${v.label}`}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <style jsx>{`
        .card {
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 18px;
          padding: 18px;
          margin-bottom: 14px;
        }
        h3 {
          font-size: 17px;
        }
        .variants {
          margin-top: 14px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .row {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .info {
          font-size: 14px;
        }
        .price {
          color: var(--ink-soft);
          font-size: 13px;
          margin-left: 6px;
        }
        .stepper {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .stepper button {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          border: 1.5px solid var(--pine);
          background: transparent;
          color: var(--pine);
          font-size: 17px;
          line-height: 1;
        }
        .stepper button:active {
          background: var(--pine);
          color: #fff;
        }
        .qty {
          min-width: 18px;
          text-align: center;
          font-weight: 600;
          font-size: 15px;
        }
      `}</style>
    </div>
  );
}
