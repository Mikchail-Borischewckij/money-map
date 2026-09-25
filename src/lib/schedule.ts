export type PaymentSchedule = 'monthly' | 'weekly'

// ISO weekdays: 1 = Monday … 7 = Sunday.
export const weekdayNames = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'] as const

export function countWeekdays(month: string, weekdays: number[]) {
  const [year, number] = month.split('-').map(Number)
  const days = new Date(Date.UTC(year, number, 0)).getUTCDate()
  let count = 0
  for (let day = 1; day <= days; day++) {
    const iso = new Date(Date.UTC(year, number - 1, day)).getUTCDay() || 7
    if (weekdays.includes(iso)) count++
  }
  return count
}

export const weekdayLabel = (weekdays: number[]) => [...weekdays].sort().map((day) => weekdayNames[day - 1]).join(', ')
