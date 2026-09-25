import App from '@/components/App'
import { allowedEmails, getSession } from '@/server/auth'
import { currentMonth } from '@/server/plans'

export const dynamic = 'force-dynamic'

export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await getSession()
  if (!session) {
    const { error } = await searchParams
    const configured = Boolean(process.env.DATABASE_URL && process.env.APP_ORIGIN && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && allowedEmails().length > 0)
    return <main className="login">
      <div className="login-card">
        <div className="brand"><span className="brand-mark">M</span>MoneyMap</div>
        <h1>Семейный план денег</h1>
        <p className="muted">Вход только для участников семьи.</p>
        {error && <p className="toast toast-error" role="alert">{error === 'denied' ? 'Этому аккаунту доступ не открыт. Войдите другим.' : 'Не получилось войти. Попробуйте ещё раз.'}</p>}
        {configured ? <a className="btn btn-primary btn-block" href="/api/auth/login">Войти через Google</a> : <p className="toast">Сервер не настроен: заполните переменные из .env.example.</p>}
      </div>
    </main>
  }
  const { record, next } = await currentMonth(session)
  if (!record) throw new Error('Could not load monthly plan')
  return <App initial={record} nextMonth={next} csrfToken={session.csrfToken} displayName={session.displayName} />
}
