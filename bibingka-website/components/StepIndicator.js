const STEPS = ['Menu', 'Pickup', 'Details', 'Payment', 'Review'];

export default function StepIndicator({ currentIndex }) {
  return (
    <div className="wrap">
      {STEPS.map((label, i) => (
        <div key={label} className="step">
          <div className={`dot ${i < currentIndex ? 'done' : ''} ${i === currentIndex ? 'active' : ''}`}>
            {i < currentIndex ? '✓' : i + 1}
          </div>
          <div className={`label ${i === currentIndex ? 'active' : ''}`}>{label}</div>
          {i < STEPS.length - 1 && <div className={`line ${i < currentIndex ? 'done' : ''}`} />}
        </div>
      ))}

      <style jsx>{`
        .wrap {
          display: flex;
          align-items: center;
          padding: 4px 2px 4px;
          overflow-x: auto;
        }
        .step {
          display: flex;
          align-items: center;
          flex: 0 0 auto;
        }
        .dot {
          width: 26px;
          height: 26px;
          border-radius: 50%;
          border: 1.5px solid var(--line);
          background: var(--surface);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          color: var(--ink-soft);
          flex-shrink: 0;
        }
        .dot.active {
          border-color: var(--pine);
          background: var(--pine);
          color: #fff;
        }
        .dot.done {
          border-color: var(--pine);
          background: var(--pine);
          color: var(--gold);
        }
        .label {
          font-size: 12.5px;
          color: var(--ink-soft);
          margin: 0 10px 0 6px;
          white-space: nowrap;
        }
        .label.active {
          color: var(--ink);
          font-weight: 600;
        }
        .line {
          width: 20px;
          height: 1.5px;
          background: var(--line);
          margin-right: 10px;
        }
        .line.done {
          background: var(--pine);
        }
      `}</style>
    </div>
  );
}
