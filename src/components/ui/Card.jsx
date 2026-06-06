export default function Card({ children, className = '', title, action, glass = true }) {
  return (
    <div className={`min-w-0 rounded-xl p-4 sm:p-5 ${glass ? 'glass' : 'bg-navy-light border border-gold/10'} ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && <h2 className="min-w-0 font-display text-base font-semibold text-cream sm:text-lg">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </div>
  )
}
