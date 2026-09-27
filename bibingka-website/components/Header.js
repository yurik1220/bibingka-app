export default function Header({ totalPieces }) {
  return (
    <header>
      <div className="brand">
        <div className="mark">B</div>
        <div className="text">
          <div className="name">Bingka</div>
          <div className="tag">Ordering Website</div>
        </div>
      </div>
      <div className="count">{totalPieces} pc{totalPieces === 1 ? '' : 's'}</div>

      <style jsx>{`
        header {
          position: sticky;
          top: 0;
          z-index: 20;
          background: var(--pine);
          padding: calc(14px + env(safe-area-inset-top, 0px)) 20px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .mark {
          width: 34px;
          height: 34px;
          border-radius: 50%;
          background: var(--gold);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-fraunces), serif;
          font-weight: 600;
          color: var(--pine);
          font-size: 15px;
        }
        .text {
          color: #fff;
          line-height: 1.15;
        }
        .name {
          font-family: var(--font-fraunces), serif;
          font-size: 17px;
        }
        .tag {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.6);
        }
        .count {
          background: var(--pine-light);
          color: #fff;
          padding: 8px 14px;
          border-radius: 999px;
          font-size: 13px;
          font-weight: 600;
        }
      `}</style>
    </header>
  );
}
