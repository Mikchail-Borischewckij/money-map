import { CalendarCheck, History, Settings } from 'lucide-react'

export type View = 'month' | 'history' | 'settings'

export const navItems: { value: View; label: string; icon: React.ReactNode }[] = [
  { value: 'month', label: 'Месяц', icon: <CalendarCheck size={20} /> },
  { value: 'history', label: 'История', icon: <History size={20} /> },
  { value: 'settings', label: 'Настройки', icon: <Settings size={20} /> },
]
