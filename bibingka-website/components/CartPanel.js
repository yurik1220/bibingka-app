export default function CartPanel({ lines, totalPrice, totalPieces, ctaLabel, onCta, ctaDisabled }) {
  return (
    <>
      {/* Desktop sidebar */}
      <div className="sidebar">
        <h2>Your order</h2>
        {lines.length === 0 ? (
          <div className="empty">No items yet — add something from the menu.</div>
        ) : (
          lines.map((line) => (
            <div key={line.key} className="line">
              <span>{line.label}</span>
              <span>₱{line.subtotal}</span>
            </div>
          ))
        )}
        <div className="total">
          <span>Total</span>
          <span>₱{totalPrice}</span>
        </div>
        <button type="button" onClick={onCta} disabled={ctaDisabled}>
          {ctaLabel}
        </button>
      </div>

      {/* Mobile bottom bar */}
      <div className="bar">
        <div className="totals">
          <div className="pieces">{totalPieces} piece{totalPieces === 1 ? '' : 's'}</div>
          <div className="amount">₱{totalPrice}</div>
        </div>
        <button type="button" onClick={onCta} disabled={ctaDisabled}>
          {ctaLabel}
        </button>
      </div>

      <style jsx>{`
        .sidebar {
          display: none;
        }
        .bar {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          background: var(--pine);
          color: #fff;
          padding: 14px 20px calc(14px + env(safe-area-inset-bottom, 0px));
          display: flex;
          align-items: center;
          justify-content: space-between;
          z-index: 20;
        }
        .pieces {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.65);
        }
        .amount {
          font-family: var(--font-fraunces), serif;
          font-size: 19px;
        }
        .bar button,
        .sidebar button {
          background: var(--terracotta);
          color: #fff;
          border: none;
          padding: 12px 22px;
          border-radius: 12px;
          font-weight: 700;
          font-size: 14.5px;
        }
        .bar button:disabled,
        .sidebar button:disabled {
          opacity: 0.5;
        }

        @media (min-width: 860px) {
          .bar {
            display: none;
          }
          .sidebar {
            display: block;
            position: sticky;
            top: 84px;
            background: var(--surface);
            border: 1px solid var(--line);
            border-radius: 18px;
            padding: 20px;
          }
          .sidebar h2 {
            font-size: 16px;
            margin-bottom: 12px;
          }
          .line {
            display: flex;
            justify-content: space-between;
            font-size: 13.5px;
            padding: 7px 0;
            border-bottom: 1px solid var(--line);
          }
          .empty {
            color: var(--ink-soft);
            font-size: 13.5px;
            padding: 6px 0 14px;
          }
          .total {
            display: flex;
            justify-content: space-between;
            margin-top: 14px;
            padding-top: 14px;
            border-top: 1.5px solid var(--line);
            font-family: var(--font-fraunces), serif;
            font-size: 18px;
          }
          .sidebar button {
            width: 100%;
            margin-top: 14px;
          }
        }
      `}</style>
    </>
  );
}
