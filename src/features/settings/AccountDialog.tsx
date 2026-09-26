"use client"

import { useState } from 'react'
import { BankPicker, Button, Dialog, Field, MoneyInput, Select, Switch, TextInput } from '@/components/ui'
import { inferBank, type BankId } from '@/lib/banks'
import { kindOptions, type AccountKind, type AccountRow } from './types'

export type AccountValue = { name: string; bank: BankId; kind: AccountKind; canFundTransfers: boolean; sweepToAccountId: string | null; keepAmount: number }

// A business account pays its own bills and sends the rest to one personal account in a single transfer.
export default function AccountDialog({ account, accounts, onClose, onSave }: { account: AccountRow | null; accounts: AccountRow[]; onClose: () => void; onSave: (value: AccountValue) => void }) {
  const [name, setName] = useState(account?.name ?? '')
  const [bank, setBank] = useState<BankId | ''>(account ? account.bank ?? inferBank(account.name) : '')
  const [kind, setKind] = useState<AccountKind>(account?.kind ?? 'current')
  const [canFundTransfers, setCanFundTransfers] = useState(account?.can_fund_transfers ?? true)
  const targets = accounts.filter((item) => !item.is_archived && item.kind !== 'business' && item.id !== account?.id)
  const [sweepTo, setSweepTo] = useState(account?.sweep_to_account_id ?? targets[0]?.id ?? '')
  const [keep, setKeep] = useState(Number(account?.keep_amount ?? 0) / 100)
  const business = kind === 'business'
  const valid = Boolean(name.trim() && bank) && (!business || Boolean(sweepTo))
  const save = () => {
    if (!name.trim() || !bank || (business && !sweepTo)) return
    onSave({ name: name.trim(), bank, kind, canFundTransfers: business ? false : canFundTransfers, sweepToAccountId: business ? sweepTo : null, keepAmount: business ? keep : 0 })
  }
  return <Dialog title={account ? 'Счёт' : 'Новый счёт'} onClose={onClose} actions={<><Button onClick={onClose}>Отмена</Button><Button variant="primary" disabled={!valid} onClick={save}>Сохранить</Button></>}>
    <form className="form-grid" onSubmit={(event) => { event.preventDefault(); save() }}>
      <Field label="Банк" wide><BankPicker value={bank} onChange={setBank} /></Field>
      <Field label="Название счёта"><TextInput label="Название счёта" value={name} onChange={setName} placeholder="Например, Основной" autoFocus /></Field>
      <Field label="Тип"><Select label="Тип" value={kind} options={kindOptions} onChange={setKind} /></Field>
      {business ? <>
        <Field label="Остаток переводить на"><Select label="Остаток переводить на" value={sweepTo} placeholder="Выберите счёт" options={targets.map((item) => ({ value: item.id, label: item.name }))} onChange={setSweepTo} /></Field>
        <Field label="Оставлять на счёте"><MoneyInput label="Оставлять на счёте" value={keep} onChange={setKeep} /></Field>
        <p className="note field-wide">Добавьте налоги и бухгалтерию в платежи этого счёта. Остаток сверх них и резерва переводится на выбранный счёт.</p>
        {targets.length === 0 && <p className="form-error">Сначала добавьте личный счёт.</p>}
      </> : <div className="field field-wide"><Switch checked={canFundTransfers} onChange={setCanFundTransfers}>Можно брать деньги для переводов</Switch></div>}
      <button type="submit" hidden />
    </form>
  </Dialog>
}
