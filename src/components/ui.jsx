import { useEffect } from 'react';

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="row between">
          <h2 className="d h3">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <Icon d="M6 6l12 12M18 6L6 18" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Icon({ d, size = 20, stroke = 2 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d.split('|').map((p) => <path key={p} d={p} />)}
    </svg>
  );
}

export const ICONS = {
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  check: 'M5 12l5 5 9-10',
  pdf: 'M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8z|M14 3v5h5|M9 13h6|M9 17h6',
  video: 'M4 6h12a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z|M17 10l4-2v8l-4-2',
  link: 'M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1|M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1',
  image: 'M4 5h16v14H4z|M4 16l5-5 4 4 3-3 4 4',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z|M20 20l-4-4',
  trash: 'M4 7h16|M10 11v6|M14 11v6|M6 7l1 13h10l1-13|M9 7V4h6v3',
};

export function Check({ on, onClick, label }) {
  return (
    <button type="button" className={`check${on ? ' on' : ''}`} onClick={onClick} aria-pressed={on} aria-label={label}>
      {on && <Icon d={ICONS.check} size={16} stroke={3} />}
    </button>
  );
}

export function Loading() {
  return <p className="empty">Cargando…</p>;
}
