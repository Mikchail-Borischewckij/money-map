import type { Plan } from './domain'

export const demoPlan: Plan = {
  month: '2026-10',
  accounts: [
    { id: 'main', name: 'Основной счёт', kind: 'current', openingBalance: 0, canFundTransfers: true, priority: 1 },
    { id: 'bills', name: 'Счёт для платежей', kind: 'current', openingBalance: 200, canFundTransfers: false, priority: 2 },
    { id: 'card', name: 'Дополнительная карта', kind: 'current', openingBalance: 100, canFundTransfers: false, priority: 3 },
    { id: 'daily', name: 'На каждый день', kind: 'current', openingBalance: 0, canFundTransfers: false, priority: 4 },
    { id: 'savings', name: 'Накопления', kind: 'savings', openingBalance: 0, canFundTransfers: false, priority: 5 },
  ],
  incomes: [
    { id: 'salary', name: 'Основной доход', amount: 12000, accountId: 'main', expectedOn: '2026-10-01', enabled: true, status: 'expected' },
    { id: 'side', name: 'Дополнительный доход', amount: 1000, accountId: 'bills', expectedOn: '2026-10-05', enabled: true, status: 'expected' },
  ],
  payments: [
    { id: 'main-costs', name: 'Платежи с основного счёта', amount: 3000, accountId: 'main', due: 'до 20-го', enabled: true, category: 'Прочее' },
    { id: 'rent', name: 'Аренда', amount: 3500, accountId: 'bills', due: 'до 10-го', enabled: true, category: 'Жильё' },
    { id: 'utilities', name: 'Коммунальные', amount: 500, accountId: 'bills', due: 'до 25-го', enabled: true, category: 'Жильё' },
    { id: 'services', name: 'Услуги', amount: 600, accountId: 'card', due: 'до 15-го', enabled: true, category: 'Услуги' },
    { id: 'transport', name: 'Транспорт', amount: 200, accountId: 'card', due: 'в течение месяца', enabled: true, category: 'Транспорт' },
  ],
  allocations: [
    { id: 'living', name: 'Повседневная жизнь', amount: 2000, accountId: 'daily', kind: 'living' },
    { id: 'saving', name: 'Отложить', amount: 1500, accountId: 'savings', kind: 'savings' },
  ],
}
