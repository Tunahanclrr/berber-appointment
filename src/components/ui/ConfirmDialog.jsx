import Button from './Button'
import Card from './Card'

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = 'Onayla',
  cancelText = 'Vazgec',
  loading = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-sm">
        <h2 className="font-display text-lg font-bold text-cream">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-cream-muted">{message}</p>
        <div className="mt-5 flex flex-col gap-2 min-[420px]:flex-row">
          <Button variant="secondary" className="flex-1" onClick={onCancel} disabled={loading}>
            {cancelText}
          </Button>
          <Button variant="danger" className="flex-1" onClick={onConfirm} disabled={loading}>
            {loading ? 'Cikiliyor...' : confirmText}
          </Button>
        </div>
      </Card>
    </div>
  )
}
