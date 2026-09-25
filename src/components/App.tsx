"use client"

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui'
import HistoryPage from '@/features/history/HistoryPage'
import MonthPage from '@/features/month/MonthPage'
import SettingsPage from '@/features/settings/SettingsPage'
import { useMonthPlan } from '@/hooks/useMonthPlan'
import type { ServerRecord } from '@/lib/api-client'
import Sidebar from './layout/Sidebar'
import TabBar from './layout/TabBar'
import type { View } from './layout/nav'

export default function App({ initial, nextMonth, csrfToken, displayName }: { initial: ServerRecord; nextMonth: string | null; csrfToken: string; displayName: string }) {
  const month = useMonthPlan({ initial, initialNext: nextMonth, csrfToken })
  const [view, setView] = useState<View>('month')
  const [categories, setCategories] = useState<string[]>([])

  const loadCategories = useCallback(() => fetch('/api/categories', { cache: 'no-store' }).then((response) => response.ok ? response.json() : [])
    .then((rows: { name: string; is_archived: boolean }[]) => setCategories(rows.filter((row) => !row.is_archived).map((row) => row.name))).catch(() => undefined), [])
  useEffect(() => { void loadCategories() }, [loadCategories])

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', headers: { 'X-CSRF-Token': csrfToken } })
    window.location.assign('/')
  }

  return <div className="shell">
    <Sidebar view={view} onNavigate={setView} displayName={displayName} onLogout={() => void logout()} />
    <main className="main">
      {month.errorText && <div className="alert" role="alert"><span>{month.errorText}</span>
        {month.saveState === 'error' && <Button size="sm" onClick={month.retrySave}>Повторить</Button>}
        <Button size="sm" variant="ghost" onClick={month.clearError}>Скрыть</Button></div>}
      {month.conflict && <div className="alert" role="alert">
        <span><strong>Месяц изменил другой пользователь.</strong> Ваши изменения остались на экране.</span>
        <Button size="sm" onClick={month.keepMine}>Оставить мои</Button>
        <Button size="sm" onClick={month.loadServer}>Загрузить с сервера</Button>
      </div>}
      {view === 'month' && <MonthPage month={month} categories={categories} onOpenSettings={() => setView('settings')} />}
      {view === 'history' && <HistoryPage />}
      {view === 'settings' && <SettingsPage csrfToken={csrfToken} openMonth={month.open ? month.plan.month : null} onChanged={() => { void loadCategories(); month.refreshAfterSettings() }} />}
    </main>
    <TabBar view={view} onNavigate={setView} />
  </div>
}
