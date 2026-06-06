export default function Input({ label, error, className = '', ...props }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="block text-sm font-medium text-cream-muted">{label}</label>}
      <input
        className={`min-h-11 w-full min-w-0 rounded-lg border border-gold/20 bg-navy-light px-3 py-3 text-base text-cream placeholder:text-cream-muted/50 outline-none focus:border-gold focus:ring-1 focus:ring-gold/30 sm:text-sm ${error ? 'border-red-500' : ''} ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
