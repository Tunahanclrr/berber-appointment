const styles = {
  pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  confirmed: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  done: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  completed: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  no_show: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  cancelled: 'bg-red-500/15 text-red-400 border-red-500/30',
}

const labels = {
  pending: 'Bekliyor',
  confirmed: 'Onaylandi',
  done: 'Geldi',
  completed: 'Geldi',
  no_show: 'Gelmedi',
  cancelled: 'Iptal',
}

export default function Badge({ status }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[status] || styles.pending}`}>
      {labels[status] || status}
    </span>
  )
}
