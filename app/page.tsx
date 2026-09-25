import App from '../src/App'
import { getSession } from '@/server/auth'
import { createPlan, readPlanByMonth } from '@/server/plans'

export const dynamic = 'force-dynamic'

function currentWarsawMonth() {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit' }).formatToParts(new Date())
  return { year: Number(parts.find((part) => part.type === 'year')?.value), month: Number(parts.find((part) => part.type === 'month')?.value) }
}

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await getSession()
  if (!session) {
    const { error } = await searchParams
    const configured = Boolean(process.env.DATABASE_URL && process.env.APP_ORIGIN && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.ALLOWED_GOOGLE_SUB_1 && process.env.ALLOWED_GOOGLE_SUB_2)
    return <main className="login-screen"><div className="login-card"><div className="brand"><span className="brand-mark">✦</span><span>MoneyMap</span></div><h1>Семейный план денег</h1><p>Вход доступен только двум разрешённым Google-аккаунтам.</p>{error && <p role="alert">{error === 'denied' ? 'Доступ не предоставлен. Выберите другой аккаунт.' : 'Не удалось войти. Попробуйте ещё раз.'}</p>}{configured ? <a className="primary-button" href="/api/auth/login">Войти через Google</a> : <p className="setup-message">Сервер ещё не настроен. Укажите переменные окружения из .env.example и примените миграцию.</p>}</div></main>
  }
  const { year, month } = currentWarsawMonth()
  const record = await readPlanByMonth(session, year, month) ?? await createPlan(session, year, month)
  if (!record) throw new Error('Could not load monthly plan')
  return <App initial={record} csrfToken={session.csrfToken} displayName={session.displayName} />
}
