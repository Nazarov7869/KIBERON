// =====================================================================
//  MODAL — qayta ishlatiladigan oyna
// =====================================================================
export default function Modal({ title, onClose, children, footer, wide }) {
  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className={'modal card' + (wide ? ' modal-wide' : '')} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Yopish">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}
