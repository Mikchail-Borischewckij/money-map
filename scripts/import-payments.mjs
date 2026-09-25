// One-off import of accounts and recurring payments from a JSON file into the family budget.
//
//   node --env-file=.env.production.local scripts/import-payments.mjs import/payments.json           # preview only
//   node --env-file=.env.production.local scripts/import-payments.mjs import/payments.json --apply   # write
//
// Safe to repeat: accounts and payments that already exist (same name, any case) are left untouched.
// Payments start from the open month and are added to it straight away, exactly as if they were added in Settings.
// Closed months are never touched.
import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import postgres from 'postgres'

const [file, flag] = process.argv.slice(2)
if (!file) throw new Error('Usage: node scripts/import-payments.mjs <file.json> [--apply]')
const apply = flag === '--apply'
const connection = process.env.DATABASE_URL
if (!connection) throw new Error('DATABASE_URL is required')
const data = JSON.parse(await readFile(file, 'utf8'))

const cents = (zl) => {
  const value = Math.round(Number(zl) * 100)
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`Bad amount: ${zl}`)
  return value
}
const monthText = (year, month) => `${year}-${String(month).padStart(2, '0')}`
const dayInMonth = (year, month, day) => `${monthText(year, month)}-${String(Math.min(day, new Date(Date.UTC(year, month, 0)).getUTCDate())).padStart(2, '0')}`
const countWeekdays = (year, month, weekdays) => {
  let count = 0
  for (let day = 1; day <= new Date(Date.UTC(year, month, 0)).getUTCDate(); day += 1) if (weekdays.includes(new Date(Date.UTC(year, month - 1, day)).getUTCDay() || 7)) count += 1
  return count
}
const calendarMonth = () => {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Warsaw', year: 'numeric', month: '2-digit' }).formatToParts(new Date())
  return { year: Number(parts.find((part) => part.type === 'year').value), month: Number(parts.find((part) => part.type === 'month').value) }
}

for (const payment of data.payments) {
  if (!payment.name?.trim()) throw new Error('Payment without a name')
  if (payment.weekdays && (!payment.weekdays.length || payment.weekdays.some((day) => !Number.isInteger(day) || day < 1 || day > 7))) throw new Error(`Bad weekdays: ${payment.name}`)
  if (payment.day != null && (!Number.isInteger(payment.day) || payment.day < 1 || payment.day > 31)) throw new Error(`Bad day: ${payment.name}`)
  cents(payment.amount)
}

const sql = postgres(connection, { ssl: process.env.DATABASE_SSL === 'disable' ? false : 'require', prepare: false, max: 1 })
const lower = (value) => value.trim().toLowerCase()

try {
  await sql.begin(async (tx) => {
    const [household] = await tx`SELECT id FROM households FOR UPDATE`
    const [actor] = await tx`SELECT id FROM users WHERE household_id = ${household.id} AND is_active = true ORDER BY created_at LIMIT 1`
    if (!actor) throw new Error('No user yet: sign in to the app once before importing')

    // Same rule as the app: settings apply from the open month, or from the month that will be started next.
    const [open] = await tx`SELECT id, year, month, version FROM monthly_plans WHERE household_id = ${household.id} AND status = 'Draft' FOR UPDATE`
    const [last] = await tx`SELECT year, month FROM monthly_plans WHERE household_id = ${household.id} ORDER BY year DESC, month DESC LIMIT 1`
    let start = open ?? calendarMonth()
    if (!open && last) {
      const next = last.month === 12 ? { year: last.year + 1, month: 1 } : { year: last.year, month: last.month + 1 }
      const today = calendarMonth()
      start = today.year > next.year || (today.year === next.year && today.month > next.month) ? today : next
    }
    const activeFrom = `${monthText(start.year, start.month)}-01`
    console.log(`Settings take effect from ${monthText(start.year, start.month)}${open ? ' (open month, payments are added to it)' : ' (no open month)'}`)

    const accounts = new Map((await tx`SELECT id, name, is_archived, transfer_priority FROM accounts WHERE household_id = ${household.id}`).map((row) => [lower(row.name), row]))
    let priority = Math.max(0, ...[...accounts.values()].map((row) => row.transfer_priority))
    for (const account of data.accounts ?? []) {
      const existing = accounts.get(lower(account.name))
      if (existing) { console.log(`= account ${account.name} (exists)`); continue }
      priority += 10
      const [row] = await tx`INSERT INTO accounts (household_id, name, type, can_fund_transfers, transfer_priority, display_order)
        VALUES (${household.id}, ${account.name.trim()}, ${account.kind ?? 'current'}, ${account.canFundTransfers ?? true}, ${priority},
        (SELECT COALESCE(MAX(display_order), 0) + 1 FROM accounts WHERE household_id = ${household.id})) RETURNING id, name, is_archived, transfer_priority`
      await tx`INSERT INTO audit_events (household_id, actor_id, entity_type, entity_id, action, new_version) VALUES (${household.id}, ${actor.id}, 'Account', ${row.id}, 'create', 1)`
      accounts.set(lower(row.name), row)
      console.log(`+ account ${account.name}`)
    }

    const categories = new Map((await tx`SELECT id, name FROM categories WHERE household_id = ${household.id} AND is_archived = false`).map((row) => [lower(row.name), row]))
    const existingPayments = new Set((await tx`SELECT name FROM recurring_payments WHERE household_id = ${household.id}`).map((row) => lower(row.name)))
    let added = 0
    let monthTotal = 0
    for (const payment of data.payments) {
      const name = payment.name.trim()
      if (existingPayments.has(lower(name))) { console.log(`= payment ${name} (exists)`); continue }
      const account = accounts.get(lower(payment.account))
      if (!account || account.is_archived) throw new Error(`Unknown or archived account "${payment.account}" for ${name}`)
      const category = payment.category ? categories.get(lower(payment.category)) : null
      if (payment.category && !category) throw new Error(`Unknown category "${payment.category}" for ${name}`)
      const amount = cents(payment.amount)
      const weekly = Boolean(payment.weekdays)
      const schedule = weekly ? 'weekly' : 'monthly'
      const weekdays = weekly ? `{${payment.weekdays.join(',')}}` : null
      const day = weekly ? null : payment.day ?? null
      const [template] = await tx`INSERT INTO recurring_payments (household_id, name, default_amount, account_id, due_day, category_id, active_from, active_to, schedule, weekdays)
        VALUES (${household.id}, ${name}, ${amount}, ${account.id}, ${day}, ${category?.id ?? null}, ${activeFrom}, null, ${schedule}, ${weekdays}::integer[]) RETURNING id`
      await tx`INSERT INTO payment_template_versions (recurring_payment_id, effective_from, name, category_id, default_amount, account_id, due_day, schedule, weekdays)
        VALUES (${template.id}, ${activeFrom}, ${name}, ${category?.id ?? null}, ${amount}, ${account.id}, ${day}, ${schedule}, ${weekdays}::integer[])`
      await tx`INSERT INTO audit_events (household_id, actor_id, entity_type, entity_id, action, new_version) VALUES (${household.id}, ${actor.id}, 'RecurringPayment', ${template.id}, 'create', 1)`
      let inMonth = ''
      if (open) {
        const quantity = weekly ? countWeekdays(open.year, open.month, payment.weekdays) : null
        const total = weekly ? amount * quantity : amount
        await tx`INSERT INTO monthly_payments (id, monthly_plan_id, recurring_payment_id, name_snapshot, category_snapshot, amount, account_id, due_date, is_enabled, version, schedule_snapshot, weekdays_snapshot, unit_price, quantity, exclusion_reason)
          VALUES (${randomUUID()}, ${open.id}, ${template.id}, ${name}, ${category?.name ?? ''}, ${total}, ${account.id}, ${day ? dayInMonth(open.year, open.month, day) : null}, true, ${open.version + 1},
          ${schedule}, ${weekdays}::integer[], ${weekly ? amount : null}, ${quantity}, '')`
        monthTotal += total
        inMonth = weekly ? ` → in month ${quantity} × ${amount / 100} = ${total / 100}` : ''
      }
      existingPayments.add(lower(name))
      added += 1
      console.log(`+ payment ${name}: ${amount / 100} zł${weekly ? ' per session' : ''}, ${payment.account}${category ? `, ${category.name}` : ''}${inMonth}`)
    }
    if (open && added > 0) {
      await tx`UPDATE monthly_plans SET version = version + 1, updated_by = ${actor.id}, updated_at = now() WHERE id = ${open.id}`
      await tx`INSERT INTO audit_events (household_id, actor_id, entity_type, entity_id, action, old_version, new_version) VALUES (${household.id}, ${actor.id}, 'MonthlyPlan', ${open.id}, 'settings', ${open.version}, ${open.version + 1})`
      console.log(`Open month: +${added} payments, ${monthTotal / 100} zł in total`)
    }
    if (!apply) throw Object.assign(new Error('preview'), { preview: true })
  })
  console.log('Imported.')
} catch (error) {
  if (!error.preview) throw error
  console.log('\nPreview only, nothing was written. Add --apply to import.')
} finally {
  await sql.end()
}
