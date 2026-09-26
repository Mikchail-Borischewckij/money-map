"use client"

import { useState } from 'react'
import { AddButton, Button, DataTable, Dialog, Empty, Field, RowMenu, Segmented, TextInput, type Column } from '@/components/ui'
import ArchiveTabs, { type ArchiveTab } from './ArchiveTabs'
import { send } from './api'
import type { Category, CategoryKind, Run } from './types'

const usage = (category: Category) => category.in_use ? 'Да' : 'Нет'

export default function CategoriesTab({ categories, csrfToken, run }: { categories: Category[]; csrfToken: string; run: Run }) {
  // `null` for a new category.
  const [editing, setEditing] = useState<Category | null | undefined>(undefined)
  const [draft, setDraft] = useState('')
  const [tab, setTab] = useState<ArchiveTab>('active')
  const [kind, setKind] = useState<CategoryKind>('payment')
  const ofKind = categories.filter((category) => category.kind === kind)
  const active = ofKind.filter((category) => !category.is_archived)
  const archived = ofKind.filter((category) => category.is_archived)
  const add = (name: string) => run(() => send('/api/categories', 'POST', csrfToken, { name, kind }), 'Добавлено.',
    (lists) => ({ ...lists, categories: [...lists.categories, { id: `new-${crypto.randomUUID()}`, name, kind, is_archived: false, version: 0 }] }))
  const update = (category: Category, patch: Partial<Category>, done = 'Сохранено.') => run(() => send(`/api/categories/${category.id}`, 'PUT', csrfToken, { name: patch.name ?? category.name, isArchived: patch.is_archived ?? category.is_archived, version: category.version }), done,
    (lists) => ({ ...lists, categories: lists.categories.map((item) => item.id === category.id ? { ...item, ...patch } : item) }))
  // Only a category no regular payment or income uses can be deleted; a used one can be archived.
  const remove = (category: Category) => run(() => send(`/api/categories/${category.id}`, 'DELETE', csrfToken, { version: category.version }), 'Удалено.',
    (lists) => ({ ...lists, categories: lists.categories.filter((item) => item.id !== category.id) }))
  const open = (category: Category | null) => { setEditing(category); setDraft(category?.name ?? '') }
  const save = () => {
    const name = draft.trim()
    if (!name || editing === undefined) return
    void (editing ? update(editing, { name }) : add(name))
    setEditing(undefined)
  }

  const name: Column<Category> = { key: 'name', header: 'Категория', sort: (category) => category.name, mobile: 'title', cell: (category) => <span className="cell-name">{category.name}</span> }
  const used: Column<Category> = { key: 'usage', header: kind === 'payment' ? 'В платежах' : 'В доходах', sort: usage, filter: { type: 'list', value: usage }, mobileLabel: true, cell: (category) => category.in_use ? 'Да' : <span className="muted">Нет</span> }
  const activeColumns: Column<Category>[] = [name, used,
    { key: 'actions', header: 'Действия', hideHeader: true, mobile: 'end', className: 'actions', cell: (category) => <RowMenu label={`Действия: ${category.name}`} items={[
      { label: 'Переименовать', onSelect: () => open(category) },
      category.in_use
        ? { label: 'В архив', danger: true, onSelect: () => void update(category, { is_archived: true }, 'В архиве.') }
        : { label: 'Удалить', danger: true, onSelect: () => void remove(category) },
    ]} /> },
  ]
  const archivedColumns: Column<Category>[] = [name, used,
    { key: 'actions', header: 'Действия', hideHeader: true, mobile: 'end', className: 'actions', cell: (category) => <div className="cell-actions">
      {!category.in_use && <Button size="sm" variant="ghost" onClick={() => void remove(category)}>Удалить</Button>}
      <Button size="sm" onClick={() => void update(category, { is_archived: false }, 'Вернули из архива.')}>Вернуть из архива</Button>
    </div> },
  ]

  return <section className="card">
    <header className="card-head"><div><h2>Категории</h2><p className="muted">Группы для сводки.</p></div>
      <div className="card-head-tools">
        <Segmented tabs size="sm" label="Категории для" value={kind} onChange={(value) => { setKind(value); setTab('active') }} options={[{ value: 'payment', label: 'Расходы' }, { value: 'income', label: 'Доходы' }]} />
        <ArchiveTabs value={tab} onChange={setTab} archived={archived.length} />
      </div></header>
    <DataTable key={`${kind}-${tab}`} label="Категории" rows={tab === 'active' ? active : archived} rowKey={(category) => category.id}
      columns={tab === 'active' ? activeColumns : archivedColumns} rowClassName={tab === 'archived' ? () => 'is-muted' : undefined}
      defaultSort={{ key: 'name', dir: 'asc' }} search={(category) => category.name}
      actions={tab === 'active' && <AddButton onClick={() => open(null)} />}
      empty={<Empty>{tab === 'active' ? 'Категорий пока нет.' : 'В архиве пока пусто.'}</Empty>} />
    {editing !== undefined && <Dialog title={editing ? 'Переименовать' : 'Новая категория'} onClose={() => setEditing(undefined)}
      actions={<><Button onClick={() => setEditing(undefined)}>Отмена</Button><Button variant="primary" disabled={!draft.trim()} onClick={save}>{editing ? 'Сохранить' : 'Добавить'}</Button></>}>
      <form onSubmit={(event) => { event.preventDefault(); save() }}>
        <Field label="Название" wide><TextInput label="Название" value={draft} onChange={setDraft} autoFocus /></Field>
      </form>
    </Dialog>}
  </section>
}
