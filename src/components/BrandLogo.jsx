import logo from '../assets/berber-logo-png.png'

const sizes = {
  sm: {
    image: 'h-8 w-8',
    text: 'text-lg',
  },
  md: {
    image: 'h-16 w-16',
    text: 'text-xl sm:text-2xl',
  },
  lg: {
    image: 'h-24 w-24',
    text: 'text-2xl sm:text-3xl',
  },
}

export default function BrandLogo({ size = 'md', showText = true, className = '' }) {
  const selected = sizes[size] || sizes.md

  return (
    <div className={`flex min-w-0 items-center gap-3 ${className}`}>
      <img
        src={logo}
        alt="Randevu Zamani"
        className={`${selected.image} shrink-0 rounded-xl object-contain`}
      />
      {showText && (
        <span className={`truncate font-display font-extrabold tracking-tight text-cream ${selected.text}`}>
          Randevu Zamanı
        </span>
      )}
    </div>
  )
}
