export function MacroProgress({ label, value, target, unit = 'g', color }: { label: string; value: number; target: number; unit?: string; color: string }) {
  const percentage = target > 0 ? Math.min(100, Math.round(value / target * 100)) : 0
  return <div className="macro-progress" style={{ '--macro-color': color } as React.CSSProperties}>
    <div><span>{label}</span><strong>{Math.round(value)} <small>/ {target} {unit}</small></strong></div>
    <div className="macro-track" aria-label={`${label}: ${Math.round(value)} of ${target} ${unit}`} role="progressbar" aria-valuemin={0} aria-valuemax={target} aria-valuenow={Math.round(value)}><span style={{ width: `${percentage}%` }} /></div>
  </div>
}
