"use client"

import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cx } from '@/lib/format'

// A step of the month. A finished step (`done`) folds into its header line until opened; the owner's choice wins once made.
export default function Section({ step, title, meta, action, children, id, done = false }: { step: number; title: string; meta?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; id?: string; done?: boolean }) {
  const [opened, setOpened] = useState<boolean | null>(null)
  const folded = !(opened ?? !done)
  const heading = <><span className={cx('step', done && 'is-done')}>{done ? <Check size={15} strokeWidth={3} /> : step}</span>
    <div className="section-title"><h2 id={`section-${step}`}>{title}</h2>{meta && <div className="section-meta">{meta}</div>}</div></>
  return <section className={cx('card section', folded && 'is-folded')} id={id} aria-labelledby={`section-${step}`}>
    <header className="section-head">
      {done || opened !== null
        ? <button type="button" className="section-toggle" aria-expanded={!folded} onClick={() => setOpened(folded)}>{heading}<ChevronDown size={18} className="section-chevron" /></button>
        : heading}
      {!folded && action}
    </header>
    {!folded && children}
  </section>
}
