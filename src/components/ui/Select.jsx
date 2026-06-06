export default function Select({ label, error, children, className = '', ...props }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-sm font-medium text-cream-muted">{label}</label>}
      <select
        className={`min-h-11 w-full min-w-0 rounded-lg border border-gold/20 bg-navy-light px-3 py-3 text-base text-cream outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 sm:text-sm ${error ? 'border-red-500' : ''} ${className}`}
        {...props}
      >
        {children}
      </select>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
