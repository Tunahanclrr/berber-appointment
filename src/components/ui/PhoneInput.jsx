import { formatTurkishMobileFromLocal, formatTurkishMobileLocal } from '../../lib/phone'

export default function PhoneInput({ label = 'Telefon', value, onChange, error, className = '', ...props }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && <label className="block text-sm font-medium text-cream-muted">{label}</label>}
      <div className={`flex min-h-11 overflow-hidden rounded-lg border bg-navy-light focus-within:border-gold focus-within:ring-1 focus-within:ring-gold/30 ${
        error ? 'border-red-500' : 'border-gold/20'
      }`}>
        <div className="flex shrink-0 items-center gap-2 border-r border-gold/20 bg-gold/10 px-3 text-sm font-semibold text-gold">
          <span>TR</span>
          <span className="font-mono">+90</span>
        </div>
        <input
          className="min-w-0 flex-1 bg-transparent px-3 py-3 text-base text-cream placeholder:text-cream-muted/50 outline-none sm:text-sm"
          value={formatTurkishMobileLocal(value)}
          onChange={event => onChange?.(formatTurkishMobileFromLocal(event.target.value))}
          placeholder="5xx xxx xx xx"
          inputMode="tel"
          autoComplete="tel-national"
          maxLength={13}
          {...props}
        />
      </div>
      <p className={`text-xs ${error ? 'text-red-400' : 'text-cream-muted'}`}>
        {error || 'Turkiye cep telefonu numarasi giriniz.'}
      </p>
    </div>
  )
}
