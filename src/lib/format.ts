export const money = (amount: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'PLN', maximumFractionDigits: 2 }).format(amount)

export function monthName(value: string, withYear = true) {
  const [year, month] = value.split('-').map(Number)
  const text = new Intl.DateTimeFormat('ru-RU', withYear ? { month: 'long', year: 'numeric' } : { month: 'long' }).format(new Date(year, month - 1, 1)).replace(' г.', '')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ')

export const dayOptions = [{ value: '', label: 'Любой день' }, ...Array.from({ length: 31 }, (_, index) => ({ value: String(index + 1), label: `${index + 1}‑е число` }))]

const dayMonth = (date: string) => new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`))

// "Сентябрь 2026" for a calendar month, "15 сентября – 14 октября 2026" for a period starting on another day.
export function periodTitle(month: string, startDay = 1) {
  if (startDay === 1) return monthName(month)
  const start = `${month}-${String(startDay).padStart(2, '0')}`
  const [year, number] = month.split('-').map(Number)
  const next = number === 12 ? `${year + 1}-01` : `${year}-${String(number + 1).padStart(2, '0')}`
  const end = new Date(Date.parse(`${next}-${String(startDay).padStart(2, '0')}T00:00:00Z`) - 86400000).toISOString().slice(0, 10)
  return `${dayMonth(start)} – ${dayMonth(end)} ${end.slice(0, 4)}`
}

// An amount without the currency, for tables that name it once: "2 500" or "2 500,5".
export const amount = (value: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value)
