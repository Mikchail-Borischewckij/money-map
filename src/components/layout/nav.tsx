import { CalendarCheck, ChartColumn, History, Settings } from 'lucide-react'

export type View = 'month' | 'summary' | 'history' | 'settings'

export const navItems: { value: View; label: string; icon: React.ReactNode }[] = [
  { value: 'month', label: 'Период', icon: <CalendarCheck size={20} /> },
  { value: 'summary', label: 'Сводка', icon: <ChartColumn size={20} /> },
  { value: 'history', label: 'История', icon: <History size={20} /> },
  { value: 'settings', label: 'Настройки', icon: <Settings size={20} /> },
]
