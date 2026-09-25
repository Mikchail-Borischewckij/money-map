"use client"

import { useState } from 'react'
import { Button, Dialog, Field, Select, Switch, TextInput } from '@/components/ui'
import { kindOptions, type AccountKind, type AccountRow } from './types'

export type AccountValue = { name: string; kind: AccountKind; canFundTransfers: boolean }

export default function AccountDialog({ account, onClose, onSave }: { account: AccountRow | null; onClose: () => void; onSave: (value: AccountValue) => void }) {
  const [name, setName] = useState(account?.name ?? '')
  const [kind, setKind] = useState<AccountKind>(account?.kind ?? 'current')
  const [canFundTransfers, setCanFundTransfers] = useState(account?.can_fund_transfers ?? true)
  const save = () => { if (name.trim()) onSave({ name: name.trim(), kind, canFundTransfers }) }
  return <Dialog title={account ? 'Счёт' : 'Новый счёт'} onClose={onClose} actions={<><Button onClick={onClose}>Отмена</Button><Button variant="primary" disabled={!name.trim()} onClick={save}>Сохранить</Button></>}>
    <form className="form-grid" onSubmit={(event) => { event.preventDefault(); save() }}>
      <Field label="Название" wide><TextInput label="Название" value={name} onChange={setName} placeholder="Например, Банк · личный" autoFocus /></Field>
      <Field label="Тип"><Select label="Тип" value={kind} options={kindOptions} onChange={setKind} /></Field>
      <div className="field field-wide"><Switch checked={canFundTransfers} onChange={setCanFundTransfers}>Можно брать деньги для переводов</Switch></div>
      <button type="submit" hidden />
    </form>
  </Dialog>
}
