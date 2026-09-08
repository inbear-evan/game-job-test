interface Props {
  current: number
  total: number
}

export function Progress({ current, total }: Props) {
  const ratio = Math.max(0, Math.min(1, current / total))
  return (
    <div className="progress-card">
      <div className="progress-label">STEP {String(current).padStart(2, '0')} / {total}</div>
      <div className="progress-track"><span style={{ width: `${ratio * 100}%` }} /></div>
    </div>
  )
}
