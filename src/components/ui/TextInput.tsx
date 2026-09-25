export default function TextInput({ label, value, onChange, placeholder, autoFocus, required }: { label?: string; value: string; onChange: (value: string) => void; placeholder?: string; autoFocus?: boolean; required?: boolean }) {
  return <input className="text-input" aria-label={label} value={value} placeholder={placeholder} autoFocus={autoFocus} required={required} onChange={(event) => onChange(event.target.value)} />
}
