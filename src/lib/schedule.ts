import { countWeekdaysInPeriod } from './period'

export type PaymentSchedule = 'monthly' | 'weekly'

// ISO weekdays: 1 = Monday … 7 = Sunday.
export const weekdayNames = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'] as const

export const countWeekdays = (month: string, weekdays: number[]) => countWeekdaysInPeriod({ month, startDay: 1 }, weekdays)

export const weekdayLabel = (weekdays: number[]) => [...weekdays].sort().map((day) => weekdayNames[day - 1]).join(', ')
