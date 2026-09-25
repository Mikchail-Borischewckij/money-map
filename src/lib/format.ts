export const money = (amount: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'PLN', maximumFractionDigits: 2 }).format(amount)

export function monthName(value: string, withYear = true) {
  const [year, month] = value.split('-').map(Number)
  const text = new Intl.DateTimeFormat('ru-RU', withYear ? { month: 'long', year: 'numeric' } : { month: 'long' }).format(new Date(year, month - 1, 1)).replace(' г.', '')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export const cx = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(' ')

export const dayOptions = [{ value: '', label: 'Любой день' }, ...Array.from({ length: 31 }, (_, index) => ({ value: String(index + 1), label: `${index + 1}-е число` }))]
