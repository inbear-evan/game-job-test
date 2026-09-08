import type { AxisKey } from '../types'

const labels: Record<AxisKey, string> = {
  logic: 'Logic', system: 'System', visual: 'Visual', experience: 'Experience', analysis: 'Analysis', communication: 'Communication'
}

const axes: AxisKey[] = ['logic', 'system', 'visual', 'experience', 'analysis', 'communication']

interface Props { scores: Record<AxisKey, number> }

export function Radar({ scores }: Props) {
  const cx = 150, cy = 150, r = 105
  const pt = (i: number, value: number) => {
    const angle = -Math.PI / 2 + i * Math.PI / 3
    const rr = r * (value / 100)
    return `${cx + Math.cos(angle) * rr},${cy + Math.sin(angle) * rr}`
  }
  const outer = axes.map((_, i) => pt(i, 100)).join(' ')
  const inner = axes.map((a, i) => pt(i, scores[a])).join(' ')

  return (
    <svg viewBox="0 0 300 300" className="radar" aria-label="성향 육각형 그래프">
      {[20,40,60,80,100].map(v => <polygon key={v} points={axes.map((_,i)=>pt(i,v)).join(' ')} className="radar-grid" />)}
      <polygon points={inner} className="radar-fill" />
      {axes.map((axis, i) => {
        const angle = -Math.PI / 2 + i * Math.PI / 3
        const x = cx + Math.cos(angle) * 130
        const y = cy + Math.sin(angle) * 130
        return <text key={axis} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className="radar-label">{labels[axis]}</text>
      })}
      <polygon points={outer} className="radar-outline" />
    </svg>
  )
}
