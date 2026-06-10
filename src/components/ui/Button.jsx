const variants = {
  primary: 'bg-gold hover:bg-gold-light text-white font-semibold shadow-sm shadow-blue-600/20',
  secondary: 'bg-white hover:bg-blue-50 text-cream border border-gold/25',
  danger: 'bg-red-600/80 hover:bg-red-500 text-white',
  ghost: 'bg-transparent hover:bg-blue-50 text-cream-muted hover:text-cream',
}

const sizes = {
  sm: 'px-3 py-2 text-sm',
  md: 'px-4 py-3 text-sm',
  lg: 'px-6 py-3 text-base',
}

export default function Button({ children, variant = 'primary', size = 'md', className = '', disabled, type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-lg text-center leading-tight transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
