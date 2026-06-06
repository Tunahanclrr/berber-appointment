export default function Loading({ text = 'Yükleniyor...' }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      {text && <p className="text-sm text-cream-muted">{text}</p>}
    </div>
  )
}
