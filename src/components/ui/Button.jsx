const variants = {
  primary: 'bg-gold hover:bg-gold-light text-navy font-semibold',
  secondary: 'bg-transparent hover:bg-white/5 text-cream border border-gold/30',
  danger: 'bg-red-600/80 hover:bg-red-500 text-white',
  ghost: 'bg-transparent hover:bg-white/5 text-cream-muted hover:text-cream',
}

const sizes = {
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-3 text-sm',
  lg: 'px-6 py-3 text-base',
}

export default function Button({ children, variant = 'primary', size = 'md', className = '', disabled, ...props }) {
  return (
    <button
      className={`inline-flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-lg text-center leading-tight transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
