"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronDown,
  CircleDollarSign, CreditCard, Landmark, LayoutDashboard, Menu, PiggyBank,
  Plus, ReceiptText, Settings, ShieldCheck, Sparkles, WalletCards, X,
} from 'lucide-react'
import { calculatePlan, type Account, type Income, type Payment, type Plan } from './domain'
import { toApiPlan, toUiPlan, toUiSummary, type ServerRecord } from './api-client'
import TemplatesPage from './TemplatesPage'
import PaymentsPage from './PaymentsPage'
import { AmountInput } from './fields'
import './App.css'

type View = 'overview' | 'income' | 'payments' | 'accounts' | 'history' | 'templates'
const money = (amount: number) => new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'PLN', maximumFractionDigits: 2 }).format(amount)
const monthLabel = (value: string) => { const [year, month] = value.split('-').map(Number); return new Intl.DateTimeFormat('ru-RU', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1)) }

function App({ initial, csrfToken, displayName }: { initial: ServerRecord; csrfToken: string; displayName: string }) {
  const [plan, setPlan] = useState<Plan>(() => toUiPlan(initial.plan))
  const [savedPlan, setSavedPlan] = useState<Plan>(() => toUiPlan(initial.plan))
  const [recordId, setRecordId] = useState(initial.id)
  const [status, setStatus] = useState(initial.status)
  const [serverSummary, setServerSummary] = useState(() => toUiSummary(initial.summary))
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'error' | 'conflict'>('saved')
  const [lastSaved, setLastSaved] = useState({ at: initial.updatedAt, by: initial.updatedBy })
  const [conflict, setConflict] = useState<ServerRecord | null>(null)
  const [errorText, setErrorText] = useState('')
  const [history, setHistory] = useState<{ id: string; year: number; month: number; status: string; updated_at: string; totalAvailable: number; totalPayments: number; totalSavings: number; freeAfterPlan: number }[]>([])
  const [view, setView] = useState<View>('overview')
  const [mobileNav, setMobileNav] = useState(false)
  const [addIncome, setAddIncome] = useState(false)
  const savedSnapshot = useRef(JSON.stringify(toUiPlan(initial.plan)))
  const versionRef = useRef(initial.version)
  const savingRef = useRef(false)
  const planRef = useRef(plan)
  useEffect(() => { planRef.current = plan }, [plan])
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
      if (!response.ok) throw new Error(result.error ?? 'Не удалось сохранить')
      const saved = result as ServerRecord
      versionRef.current = saved.version
      savedSnapshot.current = snapshot
      setSavedPlan(candidate)
      setServerSummary(toUiSummary(saved.summary))
      setLastSaved({ at: saved.updatedAt, by: saved.updatedBy })
      setSaveState(JSON.stringify(planRef.current) === snapshot ? 'saved' : 'saving')
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Не удалось сохранить')
      setSaveState('error')
      return
    } finally {
      savingRef.current = false
    }
    if (JSON.stringify(planRef.current) !== savedSnapshot.current) void persist(planRef.current)
  }, [recordId, csrfToken, status])

  useEffect(() => {
    if (!dirty || status !== 'Draft' || conflict || saveState === 'error') return
    const timer = setTimeout(() => { void persist(planRef.current) }, 650)
    return () => clearTimeout(timer)
  }, [plan, dirty, status, conflict, saveState, persist])

  function applyRecord(record: ServerRecord) {
    const next = toUiPlan(record.plan)
    savedSnapshot.current = JSON.stringify(next)
    versionRef.current = record.version
    setRecordId(record.id)
    setStatus(record.status)
    setServerSummary(toUiSummary(record.summary))
    setLastSaved({ at: record.updatedAt, by: record.updatedBy })
    setConflict(null)
    setSaveState('saved')
    setPlan(next)
    setSavedPlan(next)
  }

  async function selectMonth(month: string) {
    if (savingRef.current || dirty) { setErrorText('Дождитесь сохранения текущего месяца.'); return }
    const [year, number] = month.split('-').map(Number)
    setErrorText('')
    let response = await fetch(`/api/plans/by-month/${year}/${number}`, { cache: 'no-store' })
    if (response.status === 404) response = await fetch('/api/plans', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify({ year, month: number }) })
    if (!response.ok) { setErrorText('Не удалось открыть месяц.'); return }
    applyRecord(await response.json() as ServerRecord)
  }

  async function addAccount(name: string, kind: Account['kind']) {
    const response = await fetch('/api/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify({ name, kind, canFundTransfers: plan.accounts.length === 0, priority: plan.accounts.length + 1 }) })
    if (!response.ok) { setErrorText('Не удалось добавить счёт.'); return }
    const row = await response.json()
    setPlan((current) => ({ ...current, accounts: [...current.accounts, { id: row.id, name: row.name, kind: row.type, openingBalance: 0, balanceConfirmed: false, balanceDate: null, canFundTransfers: row.can_fund_transfers, priority: row.transfer_priority, version: row.version }] }))
  }

  async function updateAccount(id: string, patch: Partial<Account>) {
    const account = plan.accounts.find((item) => item.id === id)
    if (!account) return
    const next = { ...account, ...patch }
    const response = await fetch(`/api/accounts/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify({ name: next.name, kind: next.kind, canFundTransfers: next.canFundTransfers, priority: next.priority, version: next.version }) })
    if (!response.ok) { setErrorText(response.status === 409 ? 'Счёт изменён другим пользователем. Обновите страницу.' : 'Не удалось сохранить счёт.'); return }
    const row = await response.json()
    setPlan((current) => ({ ...current, accounts: current.accounts.map((item) => item.id === id ? { ...next, version: row.version } : item) }))
  }

  async function archiveAccount(id: string) {
    const account = plan.accounts.find((item) => item.id === id)
    if (!account || !account.version || !window.confirm(`Архивировать счёт «${account.name}»? Старые планы сохранятся.`)) return
    const response = await fetch(`/api/accounts/${id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify({ expectedVersion: account.version }) })
    if (!response.ok) { setErrorText(response.status === 409 ? 'Счёт уже изменился. Обновите страницу.' : 'Не удалось архивировать счёт.'); return }
    const row = await response.json()
    setPlan((current) => ({ ...current, accounts: current.accounts.map((item) => item.id === id ? { ...item, isArchived: true, version: row.version } : item) }))
  }

  async function changeStatus(action: 'finalize' | 'reopen') {
    if (dirty || savingRef.current) { setErrorText('Сначала дождитесь сохранения.'); return }
    const response = await fetch(`/api/plans/${recordId}/${action}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify({ expectedVersion: versionRef.current }) })
    if (!response.ok) { setErrorText(response.status === 422 ? 'Подтвердите начальные остатки всех счетов.' : 'План изменился. Обновите страницу.'); return }
    applyRecord(await response.json() as ServerRecord)
  }

  async function resetPayment(paymentId: string) {
    if (dirty || savingRef.current) { setErrorText('Сначала дождитесь сохранения.'); return }
    const response = await fetch(`/api/plans/${recordId}/payments/${paymentId}/reset`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify({ expectedVersion: versionRef.current }) })
    if (!response.ok) { setErrorText('Не удалось вернуть базовые значения. Обновите страницу.'); return }
    applyRecord(await response.json() as ServerRecord)
  }

  async function resetIncome(incomeId: string) {
    if (dirty || savingRef.current) { setErrorText('Сначала дождитесь сохранения.'); return }
    const response = await fetch(`/api/plans/${recordId}/incomes/${incomeId}/reset`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken }, body: JSON.stringify({ expectedVersion: versionRef.current }) })
    if (!response.ok) { setErrorText('Не удалось вернуть базовые значения. Обновите страницу.'); return }
    applyRecord(await response.json() as ServerRecord)
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST', headers: { 'X-CSRF-Token': csrfToken } })
    window.location.assign('/')
  }

  function go(next: View) {
    setView(next); setMobileNav(false)
    if (next === 'history') void fetch('/api/plans', { cache: 'no-store' }).then((response) => response.json()).then(setHistory).catch(() => setErrorText('Не удалось загрузить историю.'))
  }
  const accountName = (id: string) => plan.accounts.find((account) => account.id === id)?.name ?? 'Неизвестный счёт'
  const updateIncome = (id: string, patch: Partial<Income>) => setPlan((current) => ({ ...current, incomes: current.incomes.map((item) => item.id === id ? { ...item, ...patch } : item) }))
  const updatePayment = (id: string, patch: Partial<Payment>) => setPlan((current) => ({ ...current, payments: current.payments.map((item) => item.id === id ? { ...item, ...patch } : item) }))
  const removePayment = (id: string) => setPlan((current) => ({ ...current, payments: current.payments.filter((item) => item.id !== id) }))
  const addPayment = (payment: Payment) => setPlan((current) => ({ ...current, payments: [...current.payments, payment] }))

  return <div className="app-shell">
    <aside className={mobileNav ? 'sidebar sidebar-open' : 'sidebar'}>
      <div className="brand"><span className="brand-mark"><Sparkles size={18} /></span><span>MoneyMap</span></div>
      <button className="mobile-close" onClick={() => setMobileNav(false)} aria-label="Закрыть меню"><X /></button>
      <nav className="nav-list" aria-label="Основная навигация">
        <button className={view === 'overview' ? 'nav-item active' : 'nav-item'} onClick={() => go('overview')}><LayoutDashboard />Обзор</button>
        <button className={view === 'income' ? 'nav-item active' : 'nav-item'} onClick={() => go('income')}><ArrowDownLeft />Доходы</button>
        <button className={view === 'payments' ? 'nav-item active' : 'nav-item'} onClick={() => go('payments')}><ReceiptText />Платежи</button>
        <button className={view === 'accounts' ? 'nav-item active' : 'nav-item'} onClick={() => go('accounts')}><WalletCards />Счета</button>
        <button className={view === 'history' ? 'nav-item active' : 'nav-item'} onClick={() => go('history')}><CalendarDays />История месяцев</button>
        <button className={view === 'templates' ? 'nav-item active' : 'nav-item'} onClick={() => go('templates')}><Settings />Справочник</button>
      </nav>
      <div className="sidebar-bottom">
        <button className="nav-item muted" onClick={() => void logout()}><Settings />Выйти</button>
        <a className="nav-item" href="/api/export"><ArrowDownLeft />Скачать JSON</a>
        <div className="profile"><div className="profile-avatar">{displayName.slice(0, 1)}</div><div><strong>{displayName}</strong><span>Семейный бюджет</span></div><ChevronDown size={16} /></div>
      </div>
    </aside>
    <div className="page">
      <header className="topbar">
        <button className="menu-button" onClick={() => setMobileNav(true)} aria-label="Открыть меню"><Menu /></button>
        <div className="month-picker"><CalendarDays size={17} /><input aria-label="Месяц плана" type="month" value={plan.month} onChange={(e) => void selectMonth(e.target.value)} /></div>
        <div className="save-state"><Check size={15} />{saveState === 'saving' ? 'Сохранение…' : saveState === 'saved' ? 'Сохранено' : saveState === 'conflict' ? 'Конфликт изменений' : 'Ошибка сохранения'}</div>
      </header>
      <main>
        {errorText && <div className="warning" role="alert"><ShieldCheck /><span>{errorText} {saveState === 'error' && <button onClick={() => { setSaveState('saving'); void persist(planRef.current) }}>Повторить</button>}</span></div>}
        {conflict && <div className="warning" role="alert"><ShieldCheck /><div><strong>План изменён другим пользователем</strong><span>Ваши изменения остались на экране. Версия на сервере: {money(conflict.summary.freeAfterPlan / 100)} свободно, обновлена {new Date(conflict.updatedAt).toLocaleString('ru-RU')}.</span><button onClick={() => { versionRef.current = conflict.version; setConflict(null); void persist(planRef.current) }}>Сохранить мои изменения поверх новой версии</button><button onClick={() => applyRecord(conflict)}>Загрузить версию с сервера</button></div></div>}
        <div className="plan-meta"><span>{status === 'Finalized' ? 'Зафиксирован' : 'Черновик'} · {lastSaved.by}, {new Date(lastSaved.at).toLocaleString('ru-RU')}</span><button className="secondary-button" onClick={() => void changeStatus(status === 'Draft' ? 'finalize' : 'reopen')}>{status === 'Draft' ? 'Зафиксировать' : 'Вернуть к редактированию'}</button></div>
        <fieldset className="plan-fieldset" disabled={status === 'Finalized'}>
        {view === 'overview' && <Overview plan={plan} setPlan={setPlan} summary={summary} accountName={accountName} onNextMonth={() => { const [year, month] = plan.month.split('-').map(Number); const next = new Date(year, month, 1); void selectMonth(`${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`) }} />}
        {view === 'income' && <LedgerPage title="Источники дохода" subtitle="Все ожидаемые поступления месяца — независимо от того, кто и на какой счёт их получает." action="Добавить доход" onAdd={() => setAddIncome(true)}>
          {addIncome && <IncomeForm accounts={plan.accounts} month={plan.month} onCancel={() => setAddIncome(false)} onSave={(income) => { setPlan({ ...plan, incomes: [...plan.incomes, income] }); setAddIncome(false) }} />}
          <div className="ledger-list">{plan.incomes.map((income) => <IncomeRow key={income.id} income={income} accounts={plan.accounts} onChange={(patch) => updateIncome(income.id, patch)} onReset={() => void resetIncome(income.id)} />)}</div>
        </LedgerPage>}
        {view === 'payments' && <PaymentsPage plan={plan} onOpenDirectory={() => go('templates')} onAdd={addPayment} onChange={updatePayment} onRemove={removePayment} onReset={(id) => void resetPayment(id)} />}
        {view === 'accounts' && <AccountsPage plan={plan} setPlan={setPlan} onAdd={addAccount} onUpdate={updateAccount} onArchive={archiveAccount} />}
        </fieldset>
        {view === 'history' && <section className="panel ledger-panel"><h1>История месяцев</h1>{history.map((item) => <button className="history-row" key={item.id} onClick={() => void selectMonth(`${item.year}-${String(item.month).padStart(2, '0')}`)}><strong>{monthLabel(`${item.year}-${String(item.month).padStart(2, '0')}`)}</strong><span>{item.status === 'Finalized' ? 'Зафиксирован' : 'Черновик'} · доступно {money(item.totalAvailable / 100)} · платежи {money(item.totalPayments / 100)} · накопления {money(item.totalSavings / 100)} · свободно {money(item.freeAfterPlan / 100)}</span><small>{new Date(item.updated_at).toLocaleString('ru-RU')}</small></button>)}</section>}
        {view === 'templates' && <TemplatesPage accounts={plan.accounts} month={plan.month} csrfToken={csrfToken} />}
      </main>
    </div>
  </div>
}

function Overview({ plan, setPlan, summary, accountName, onNextMonth }: { plan: Plan; setPlan: (plan: Plan) => void; summary: ReturnType<typeof calculatePlan>; accountName: (id: string) => string; onNextMonth: () => void }) {
  const changeAllocation = (kind: 'living' | 'savings', amount: number) => {
    const existing = plan.allocations.find((allocation) => allocation.kind === kind)
    if (!existing && !plan.accounts[0]) return
    setPlan({ ...plan, allocations: existing ? plan.allocations.map((allocation) => allocation.kind === kind ? { ...allocation, amount } : allocation) : [...plan.allocations, { id: crypto.randomUUID(), name: kind === 'living' ? 'Повседневная жизнь' : 'Накопления', kind, amount, accountId: plan.accounts[0].id }] })
  }
  const changeAllocationAccount = (kind: 'living' | 'savings', accountId: string) => {
    const existing = plan.allocations.find((allocation) => allocation.kind === kind)
    setPlan({ ...plan, allocations: existing ? plan.allocations.map((allocation) => allocation.kind === kind ? { ...allocation, accountId } : allocation) : [...plan.allocations, { id: crypto.randomUUID(), name: kind === 'living' ? 'Повседневная жизнь' : 'Накопления', kind, amount: 0, accountId }] })
  }
  return <>
    <section className="page-heading"><div><span className="eyebrow">ПЛАН НА {monthLabel(plan.month).toUpperCase()}</span><h1>Деньги разложены<br />по своим местам.</h1></div><button className="secondary-button" onClick={onNextMonth}><Plus />Следующий месяц</button></section>
    <section className="summary-grid">
      <article className={summary.freeAfterPlan >= 0 ? 'hero-card' : 'hero-card deficit'}><div className="card-kicker">{summary.isPreliminary ? 'Предварительно свободно' : 'Свободно после плана'}</div><strong>{money(summary.freeAfterPlan)}</strong><p>{summary.isPreliminary ? 'Подтвердите начальные остатки на всех счетах' : summary.freeAfterPlan >= 0 ? 'Можно направить на другие расходы' : 'Нужно сократить план или добавить доход'}</p><ArrowUpRight /></article>
      <article className="metric-card"><div className="metric-icon lavender"><ReceiptText /></div><div><span>Платежи месяца</span><strong>{money(summary.totalPayments)}</strong><small>{plan.payments.filter((item) => item.enabled && item.recurringPaymentId).length} регулярных · {plan.payments.filter((item) => item.enabled && !item.recurringPaymentId).length} разовых</small></div></article>
      <article className="metric-card"><div className="metric-icon sand"><PiggyBank /></div><div><span>Накопления</span><strong>{money(summary.totalSavings)}</strong><small>Запланировано</small></div></article>
    </section>
    {plan.accounts.length === 0 && <div className="warning"><ShieldCheck /><span>Начните со счёта во вкладке «Счета».</span></div>}
    {summary.uncovered > 0 && <div className="warning"><ShieldCheck /><div><strong>Не все счета обеспечены</strong><span>Не хватает {money(summary.uncovered)} на разрешённых счетах-источниках.</span></div></div>}
    <section className="dashboard-grid">
      <article className="panel transfers-panel"><div className="panel-heading"><div><span className="eyebrow">ГОТОВЫЙ ПЛАН</span><h2>Куда перевести</h2></div><span className="pill">{summary.transfers.length} перевода</span></div><div className="transfer-list">
        {summary.transfers.map((transfer) => <div className="transfer-row" key={transfer.id}><div className="account-glyph"><ArrowRight /></div><div className="transfer-route"><strong>{accountName(transfer.toAccountId)}</strong><span>из {accountName(transfer.fromAccountId)}</span></div><strong className="transfer-amount">{money(transfer.amount)}</strong></div>)}
        {summary.transfers.length === 0 && <div className="empty-state">Переводы не требуются</div>}
      </div><div className="panel-total"><span>Всего перевести</span><strong>{money(summary.transfers.reduce((total, transfer) => total + transfer.amount, 0))}</strong></div></article>
      <article className="panel plan-inputs"><div className="panel-heading"><div><span className="eyebrow">ГИБКИЙ БЮДЖЕТ</span><h2>Распределение</h2></div><CircleDollarSign /></div>
        <MoneyField label="На повседневную жизнь" value={summary.totalLiving} onChange={(value) => changeAllocation('living', value)} note={accountName(plan.allocations.find((item) => item.kind === 'living')?.accountId ?? '')} />
        <label className="allocation-account">Счёт для повседневной жизни <select value={plan.allocations.find((item) => item.kind === 'living')?.accountId ?? ''} onChange={(event) => changeAllocationAccount('living', event.target.value)}><option value="" disabled>Выберите счёт</option>{plan.accounts.filter((account) => !account.isArchived).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
        <MoneyField label="Отложить в этом месяце" value={summary.totalSavings} onChange={(value) => changeAllocation('savings', value)} note={accountName(plan.allocations.find((item) => item.kind === 'savings')?.accountId ?? '')} />
        <label className="allocation-account">Счёт для накоплений <select value={plan.allocations.find((item) => item.kind === 'savings')?.accountId ?? ''} onChange={(event) => changeAllocationAccount('savings', event.target.value)}><option value="" disabled>Выберите счёт</option>{plan.accounts.filter((account) => !account.isArchived).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
        <div className="available-row"><span>Всего доступно в плане</span><strong>{money(summary.totalAvailable)}</strong></div>
      </article>
    </section>
    <section className="panel accounts-snapshot"><div className="panel-heading"><div><span className="eyebrow">СОСТОЯНИЕ ДО ПЕРЕВОДОВ</span><h2>Счета</h2></div></div><div className="account-cards">{summary.accounts.map((account) => <div className="account-card" key={account.id}><div className="account-icon">{account.kind === 'savings' ? <PiggyBank /> : <CreditCard />}</div><div><strong>{account.name}</strong><span>Нужно {money(account.needed)}</span></div><div className="account-balance"><strong>{money(account.available)}</strong><span>доступно</span></div></div>)}</div></section>
  </>
}

function MoneyField({ label, value, onChange, note }: { label: string; value: number; onChange: (value: number) => void; note: string }) { return <label className="money-field"><span><strong>{label}</strong><small>{note}</small></span><div><AmountInput label={label} value={value} onChange={onChange} /><span>zł</span></div></label> }
function LedgerPage({ title, subtitle, action, onAdd, children }: { title: string; subtitle: string; action: string; onAdd: () => void; children: React.ReactNode }) { return <><section className="page-heading compact"><div><span className="eyebrow">ТЕКУЩИЙ МЕСЯЦ</span><h1>{title}</h1><p>{subtitle}</p></div><button className="primary-button" onClick={onAdd}><Plus />{action}</button></section><section className="panel ledger-panel">{children}</section></> }
function IncomeRow({ income, accounts, onChange, onReset }: { income: Income; accounts: Plan['accounts']; onChange: (patch: Partial<Income>) => void; onReset: () => void }) {
  const status = income.enabled ? income.status : 'excluded'
  return <div className={status === 'excluded' ? 'ledger-row no-switch disabled' : 'ledger-row no-switch'}>
    <div className="ledger-main">
      <input aria-label="Название дохода" value={income.name} onChange={(event) => onChange({ name: event.target.value })} />
      <div className="row-details">
        <select aria-label="Статус дохода" value={status} onChange={(event) => onChange({ status: event.target.value as Income['status'], enabled: true })}><option value="expected">Ожидается</option><option value="included">Уже в остатке</option><option value="excluded">Не будет в этом месяце</option></select>
        <input aria-label="Ожидаемая дата" type="date" value={income.expectedOn} onChange={(event) => onChange({ expectedOn: event.target.value })} />
      </div>
      {income.recurringIncomeId && <button className="reset-link" type="button" onClick={onReset}>Вернуть базовые значения</button>}
    </div>
    <select aria-label="Счёт дохода" value={income.accountId} onChange={(event) => onChange({ accountId: event.target.value })}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select>
    <div className="amount-input"><AmountInput label="Сумма дохода" value={income.amount} onChange={(amount) => onChange({ amount })} /><span>zł</span></div>
  </div>
}

function IncomeForm({ accounts, month, onCancel, onSave }: { accounts: Plan['accounts']; month: string; onCancel: () => void; onSave: (income: Income) => void }) {
  const [name, setName] = useState(''); const [amount, setAmount] = useState(0); const [accountId, setAccountId] = useState(accounts.find((account) => !account.isArchived)?.id ?? ''); const [expectedOn, setExpectedOn] = useState(`${month}-01`)
  return <form className="inline-form" onSubmit={(e) => { e.preventDefault(); if (!name.trim() || !accountId) return; onSave({ id: crypto.randomUUID(), name: name.trim(), amount, accountId, expectedOn, enabled: true, status: 'expected' }) }}><input required placeholder="Название дохода" value={name} onChange={(e) => setName(e.target.value)} /><AmountInput label="Сумма дохода" value={amount} onChange={setAmount} /><input aria-label="Ожидаемая дата" type="date" value={expectedOn} onChange={(e) => setExpectedOn(e.target.value)} /><select value={accountId} onChange={(e) => setAccountId(e.target.value)}>{accounts.filter((account) => !account.isArchived).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select><button className="primary-button" type="submit">Добавить</button><button className="icon-button" type="button" onClick={onCancel}><X /></button></form>
}
function AccountsPage({ plan, setPlan, onAdd, onUpdate, onArchive }: { plan: Plan; setPlan: (plan: Plan) => void; onAdd: (name: string, kind: Account['kind']) => Promise<void>; onUpdate: (id: string, patch: Partial<Account>) => Promise<void>; onArchive: (id: string) => Promise<void> }) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState<Account['kind']>('current')
  const change = (id: string, patch: Partial<Account>) => setPlan({ ...plan, accounts: plan.accounts.map((item) => item.id === id ? { ...item, ...patch } : item) })
  return <>
    <section className="page-heading compact"><div><span className="eyebrow">НАСТРОЙКА ПЛАНА</span><h1>Счета</h1><p>Укажите остаток и выберите счета, с которых можно финансировать переводы.</p></div></section>
    <form className="panel inline-form account-add" onSubmit={(event) => { event.preventDefault(); if (name.trim()) { void onAdd(name.trim(), kind); setName('') } }}>
      <input required aria-label="Название нового счёта" placeholder="Название нового счёта" value={name} onChange={(event) => setName(event.target.value)} />
      <select aria-label="Тип счёта" value={kind} onChange={(event) => setKind(event.target.value as Account['kind'])}><option value="current">Текущий</option><option value="savings">Накопительный</option><option value="cash">Наличные</option></select>
      <button className="primary-button" type="submit"><Plus />Добавить счёт</button>
    </form>
    <section className="accounts-settings">{plan.accounts.map((account) => <article className="panel account-setting" key={account.id}>
      <div className="account-setting-head"><div className="account-icon"><Landmark /></div><div>
        <input aria-label="Название счёта" defaultValue={account.name} onBlur={(event) => { if (event.target.value.trim() && event.target.value !== account.name) void onUpdate(account.id, { name: event.target.value.trim() }) }} />
        <select aria-label="Тип счёта" value={account.kind} onChange={(event) => void onUpdate(account.id, { kind: event.target.value as Account['kind'] })}><option value="current">Текущий</option><option value="savings">Накопительный</option><option value="cash">Наличные</option></select>
      </div>{account.isArchived && <span className="pill">Архив</span>}</div>
      <MoneyField label="Начальный остаток" value={account.openingBalance} note="для этого месяца" onChange={(openingBalance) => change(account.id, { openingBalance, balanceConfirmed: true, balanceDate: account.balanceDate ?? new Date().toISOString().slice(0, 10) })} />
      <label className="source-check"><input type="checkbox" checked={account.balanceConfirmed ?? false} onChange={(event) => change(account.id, { balanceConfirmed: event.target.checked })} />Остаток подтверждён, даже если он равен нулю</label>
      <label className="source-check">Дата остатка <input aria-label="Дата остатка" type="date" value={account.balanceDate ?? ''} onChange={(event) => change(account.id, { balanceDate: event.target.value || null })} /></label>
      <label className="source-check"><input type="checkbox" checked={account.canFundTransfers} onChange={(event) => void onUpdate(account.id, { canFundTransfers: event.target.checked })} />Можно использовать для переводов</label>
      <label className="source-check">Приоритет переводов <input className="priority-input" aria-label="Приоритет переводов" type="number" min="0" max="10000" defaultValue={account.priority} onBlur={(event) => { const priority = Number(event.target.value); if (Number.isInteger(priority) && priority >= 0 && priority !== account.priority) void onUpdate(account.id, { priority }) }} /></label>
      {!account.isArchived && <button className="text-button" type="button" onClick={() => void onArchive(account.id)}>Архивировать счёт</button>}
    </article>)}</section>
  </>
}
export default App
