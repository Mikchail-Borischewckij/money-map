import { z } from 'zod'

export const moneySchema = z.number().int().min(0).max(9_000_000_000_000)
export const uuid = z.string().uuid()
const name = z.string().trim().min(1).max(160)

export const accountInput = z.object({
  name,
  kind: z.enum(['current', 'savings', 'cash']),
  canFundTransfers: z.boolean(),
  priority: z.number().int().min(0).max(10000),
  version: z.number().int().positive().optional(),
})

const income = z.object({
  id: uuid, name, amount: moneySchema, accountId: uuid,
  expectedOn: z.union([z.iso.date(), z.literal('')]), enabled: z.boolean(),
  status: z.enum(['expected', 'included', 'excluded']),
  recurringIncomeId: uuid.nullable().optional(),
})
const payment = z.object({
  id: uuid, name, amount: moneySchema, accountId: uuid,
  due: z.string().max(80), enabled: z.boolean(), category: z.string().max(100), recurringPaymentId: uuid.nullable().optional(),
})
const allocation = z.object({
  id: uuid, name, amount: moneySchema, accountId: uuid,
  kind: z.enum(['living', 'savings', 'other']),
})
export const planInput = z.object({
  expectedVersion: z.number().int().positive(),
  plan: z.object({
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    accounts: z.array(z.object({ id: uuid, name, kind: z.enum(['current', 'savings', 'cash']), openingBalance: moneySchema, balanceConfirmed: z.boolean().optional(), balanceDate: z.iso.date().nullable().optional(), canFundTransfers: z.boolean(), priority: z.number().int().min(0).max(10000) })),
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
  activeFrom: z.iso.date(), activeTo: z.iso.date().nullable(),
  categoryId: uuid.nullable().optional(), version: z.number().int().positive().optional(),
}).refine((value) => !value.activeTo || value.activeTo >= value.activeFrom, { message: 'End date must follow start date' })
