import { z } from 'zod'

export const moneySchema = z.number().int().min(0).max(9_000_000_000_000)
export const uuid = z.string().uuid()
const name = z.string().trim().min(1).max(160)
const accountKind = z.enum(['current', 'savings', 'cash', 'business'])
const weekdays = z.array(z.number().int().min(1).max(7)).min(1).max(7).refine((days) => new Set(days).size === days.length, { message: 'Duplicate weekday' })

export const accountInput = z.object({
  name,
  kind: accountKind,
  canFundTransfers: z.boolean(),
  priority: z.number().int().min(0).max(10000),
  version: z.number().int().positive().optional(),
  // Business accounts only: where the rest goes and how much stays.
  sweepToAccountId: uuid.nullable().default(null),
  keepAmount: moneySchema.default(0),
})

const income = z.object({
  id: uuid, name, amount: moneySchema, accountId: uuid,
  expectedOn: z.union([z.iso.date(), z.literal('')]), enabled: z.boolean(),
  status: z.enum(['expected', 'included', 'excluded']),
  recurringIncomeId: uuid.nullable().optional(), amountPending: z.boolean().optional(),
})
const payment = z.object({
  id: uuid, name, amount: moneySchema, accountId: uuid,
  due: z.string().max(80), enabled: z.boolean(), category: z.string().max(100), recurringPaymentId: uuid.nullable().optional(),
  schedule: z.enum(['monthly', 'weekly']).nullable().optional(), weekdays: weekdays.nullable().optional(),
  unitPrice: moneySchema.nullable().optional(), quantity: z.number().int().min(0).max(1000).nullable().optional(),
  exclusionReason: z.string().max(200).optional(), amountPending: z.boolean().optional(),
}).refine((value) => (value.unitPrice == null) === (value.quantity == null), { message: 'Unit price and quantity go together' })
  .refine((value) => value.unitPrice == null || value.amount === value.unitPrice * value.quantity!, { message: 'Amount must equal unit price × quantity' })
const allocation = z.object({
  id: uuid, name, amount: moneySchema, accountId: uuid,
  kind: z.enum(['living', 'savings', 'other']),
})
export const planInput = z.object({
  expectedVersion: z.number().int().positive(),
  plan: z.object({
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/), startDay: z.number().int().min(1).max(28).optional(), balancesOn: z.iso.date().nullable().optional(),
    accounts: z.array(z.object({ id: uuid, name, kind: accountKind, openingBalance: moneySchema, balanceConfirmed: z.boolean().optional(), balanceDate: z.iso.date().nullable().optional(), canFundTransfers: z.boolean(), priority: z.number().int().min(0).max(10000), sweepToAccountId: uuid.nullable().optional(), keepAmount: moneySchema.optional() })),
    incomes: z.array(income), payments: z.array(payment), allocations: z.array(allocation),
  }),
}).superRefine((value, context) => {
  const ids = new Set(value.plan.accounts.map((account) => account.id))
  if (ids.size !== value.plan.accounts.length) context.addIssue({ code: 'custom', message: 'Duplicate account' })
  for (const collection of [value.plan.incomes, value.plan.payments, value.plan.allocations]) {
    if (new Set(collection.map((item) => item.id)).size !== collection.length) context.addIssue({ code: 'custom', message: 'Duplicate item' })
    if (collection.some((item) => !ids.has(item.accountId))) context.addIssue({ code: 'custom', message: 'Unknown account in plan' })
  }
})

export const templateInput = z.object({
  name, defaultAmount: moneySchema, accountId: uuid,
  day: z.number().int().min(1).max(31).nullable(),
  categoryId: uuid.nullable().optional(), version: z.number().int().positive().optional(),
  schedule: z.enum(['monthly', 'weekly']).default('monthly'), weekdays: weekdays.nullable().default(null),
  ended: z.boolean().default(false), amountVaries: z.boolean().default(false),
}).refine((value) => value.schedule === 'weekly' ? value.weekdays !== null && value.day === null : value.weekdays === null, { message: 'Weekly schedule needs weekdays and no day' })

export const settingsInput = z.object({ periodStartDay: z.number().int().min(1).max(28) })
