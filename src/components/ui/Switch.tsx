export default function Switch({ checked, onChange, children }: { checked: boolean; onChange: (checked: boolean) => void; children: React.ReactNode }) {
  return <label className="switch-field">
    <span>{children}</span>
    <input type="checkbox" role="switch" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    <span className="switch-track" aria-hidden="true"><span /></span>
  </label>
}
