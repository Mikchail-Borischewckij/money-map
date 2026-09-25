import { weekdayNames } from '@/lib/schedule'

export default function WeekdayPicker({ value, onChange }: { value: number[]; onChange: (value: number[]) => void }) {
  return <div className="weekday-picker" role="group" aria-label="Дни недели">
    {weekdayNames.map((name, index) => {
      const day = index + 1
      const active = value.includes(day)
      return <button key={day} type="button" aria-pressed={active} className={active ? 'is-active' : ''} onClick={() => onChange(active ? value.filter((item) => item !== day) : [...value, day].sort())}>{name}</button>
    })}
  </div>
}
