"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toApiPlan, toUiPlan, toUiSummary, type ServerRecord } from '@/lib/api-client'
import { calculatePlan, type Plan } from '@/lib/domain'
import { countFromToday } from '@/features/month/utils'

export type SaveState = 'saved' | 'saving' | 'error' | 'conflict'

const post = (url: string, csrfToken: string, body: unknown = {}) => fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify(body) })

// The current month: the open one (edited with optimistic autosave and a version check) or the last closed one.
export function useMonthPlan({ initial, initialNext, csrfToken }: { initial: ServerRecord; initialNext: string | null; csrfToken: string }) {
  // An open month whose balances are not checked yet moves to today; the change is saved like any edit.
  const [plan, setPlan] = useState<Plan>(() => initial.status === 'Draft' ? countFromToday(toUiPlan(initial.plan)) : toUiPlan(initial.plan))
  const [savedPlan, setSavedPlan] = useState<Plan>(() => toUiPlan(initial.plan))
  const [recordId, setRecordId] = useState(initial.id)
  const [status, setStatus] = useState(initial.status)
  const [nextMonth, setNextMonth] = useState(initialNext)
  const [serverSummary, setServerSummary] = useState(() => toUiSummary(initial.summary))
  const [saveState, setSaveState] = useState<SaveState>('saved')
  const [conflict, setConflict] = useState<ServerRecord | null>(null)
  const [errorText, setErrorText] = useState('')
  const versionRef = useRef(initial.version)
  const savingRef = useRef(false)
  const planRef = useRef(plan)
  const savedSnapshot = useRef(JSON.stringify(plan))
  useEffect(() => { planRef.current = plan }, [plan])
  const open = status === 'Draft'
  const dirty = JSON.stringify(plan) !== JSON.stringify(savedPlan)
  const summary = useMemo(() => dirty ? calculatePlan(plan) : serverSummary, [plan, dirty, serverSummary])

  const persist = useCallback(async function persist(candidate: Plan) {
    if (savingRef.current || status !== 'Draft') return
    savingRef.current = true
    setSaveState('saving')
    const snapshot = JSON.stringify(candidate)
    try {
      const response = await fetch(`/api/plans/${recordId}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ expectedVersion: versionRef.current, plan: toApiPlan(candidate) }),
      })
      const result = await response.json()
      if (response.status === 409) { setConflict(result.current); setSaveState('conflict'); return }
      if (!response.ok) throw new Error('Не удалось сохранить.')
      const saved = result as ServerRecord
      versionRef.current = saved.version
      savedSnapshot.current = snapshot
      setSavedPlan(candidate)
      setServerSummary(toUiSummary(saved.summary))
      setSaveState(JSON.stringify(planRef.current) === snapshot ? 'saved' : 'saving')
      setErrorText('')
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Не удалось сохранить.')
      setSaveState('error')
      return
    } finally {
      savingRef.current = false
    }
    if (JSON.stringify(planRef.current) !== savedSnapshot.current) void persist(planRef.current)
  }, [recordId, csrfToken, status])

  useEffect(() => {
    if (!dirty || status !== 'Draft' || conflict || saveState === 'error') return
    const timer = setTimeout(() => { void persist(planRef.current) }, 600)
    return () => clearTimeout(timer)
  }, [plan, dirty, status, conflict, saveState, persist])

  function applyRecord(record: ServerRecord, next?: string | null) {
    const value = toUiPlan(record.plan)
    savedSnapshot.current = JSON.stringify(value)
    versionRef.current = record.version
    setRecordId(record.id)
    setStatus(record.status)
    setServerSummary(toUiSummary(record.summary))
    setConflict(null)
    setSaveState('saved')
    setPlan(value)
    setSavedPlan(value)
    if (next !== undefined) setNextMonth(next)
  }

  const busy = () => { if (dirty || savingRef.current) { setErrorText('Подождите, изменения сохраняются.'); return true } return false }

  async function reloadCurrent() {
    const response = await fetch('/api/plans/current', { cache: 'no-store' })
    if (!response.ok) { setErrorText('Не удалось загрузить месяц.'); return }
    const { record, next } = await response.json() as { record: ServerRecord; next: string | null }
    applyRecord(record, next)
  }

  return {
    plan, summary, open, dirty, nextMonth, saveState, conflict, errorText,
    update: (change: (plan: Plan) => Plan) => { if (open) setPlan((current) => change(current)) },
    clearError: () => setErrorText(''),
    retrySave: () => { setSaveState('saving'); void persist(planRef.current) },
    keepMine: () => { if (!conflict) return; versionRef.current = conflict.version; setConflict(null); void persist(planRef.current) },
    loadServer: () => { if (conflict) applyRecord(conflict) },
    // Settings changes are written into the open month on the server; reload it so they show at once. Unsaved edits are never dropped.
    refreshAfterSettings: () => { if (!dirty && !savingRef.current) void reloadCurrent() },

    async closeMonth() {
      if (busy()) return
      const response = await post(`/api/plans/${recordId}/finalize`, csrfToken, { expectedVersion: versionRef.current })
      if (!response.ok) { setErrorText(response.status === 422 ? 'Проверьте остатки на всех счетах.' : 'Месяц изменился. Обновите страницу.'); return }
      await reloadCurrent()
    },
    async reopenMonth() {
      if (busy()) return
      const response = await post(`/api/plans/${recordId}/reopen`, csrfToken, { expectedVersion: versionRef.current })
      if (!response.ok) { setErrorText('Открыть снова можно только последний месяц, пока следующий не начат.'); return }
      applyRecord(await response.json() as ServerRecord, null)
    },
    async startNext() {
      const response = await post('/api/plans', csrfToken)
      if (!response.ok) { setErrorText('Не удалось начать месяц.'); return }
      applyRecord(await response.json() as ServerRecord, null)
      setErrorText('')
    },
    async reset(kind: 'payments' | 'incomes', id: string) {
      if (busy()) return
      const response = await post(`/api/plans/${recordId}/${kind}/${id}/reset`, csrfToken, { expectedVersion: versionRef.current })
      if (!response.ok) { setErrorText('Не удалось вернуть значения из настроек.'); return }
      applyRecord(await response.json() as ServerRecord)
    },
  }
}

export type MonthPlanState = ReturnType<typeof useMonthPlan>
