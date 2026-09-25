export default function Section({ step, title, meta, action, children, id }: { step: number; title: string; meta?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; id?: string }) {
  return <section className="card section" id={id} aria-labelledby={`section-${step}`}>
    <header className="section-head">
      <span className="step">{step}</span>
      <div className="section-title"><h2 id={`section-${step}`}>{title}</h2>{meta && <div className="section-meta">{meta}</div>}</div>
      {action}
    </header>
    {children}
  </section>
}
