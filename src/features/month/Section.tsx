import { Check, ChevronDown } from 'lucide-react'
import { cx } from '@/lib/format'

// A step of the month. Which step is open is decided by MonthView, not here: one step at a time, so the screen
// asks for one thing. A folded step keeps its total and its progress on the header line.
export default function Section({ step, title, meta, total, action, children, open, onToggle, done = false }: {
  step: number; title: string; meta?: React.ReactNode; total?: React.ReactNode; action?: React.ReactNode
  children: React.ReactNode; open: boolean; onToggle: () => void; done?: boolean
}) {
  const note = [!open && total, meta].filter(Boolean)
  return <section className={cx('card section', !open && 'is-folded')} id={`step-${step}`} aria-labelledby={`section-${step}`}>
    <header className="section-head">
      <button type="button" className="section-toggle" aria-expanded={open} aria-controls={`body-${step}`} onClick={onToggle}>
        <span className={cx('step', done && 'is-done')}>{done ? <Check size={15} strokeWidth={3} /> : step}</span>
        <div className="section-title">
          <h2 id={`section-${step}`}>{title}</h2>
          {note.length > 0 && <div className="section-meta">{note.map((item, index) => <span key={index}>{item}</span>)}</div>}
        </div>
        <ChevronDown size={18} className="section-chevron" />
      </button>
      {open && action}
    </header>
    {open && <div id={`body-${step}`}>{children}</div>}
  </section>
}
