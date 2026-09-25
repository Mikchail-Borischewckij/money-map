"use client"

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button, Dialog, Field, RowMenu, TextInput } from '@/components/ui'
import { send } from './api'
import type { Category, Run } from './types'

export default function CategoriesTab({ categories, csrfToken, run }: { categories: Category[]; csrfToken: string; run: Run }) {
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<Category | null>(null)
  const [draft, setDraft] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const active = categories.filter((category) => !category.is_archived)
  const archived = categories.filter((category) => category.is_archived)
  const add = () => { if (!name.trim()) return; void run(() => send('/api/categories', 'POST', csrfToken, { name: name.trim() }), 'Категория добавлена.',
    (lists) => ({ ...lists, categories: [...lists.categories, { id: `new-${crypto.randomUUID()}`, name: name.trim(), is_archived: false, version: 0 }] })); setName('') }
  const update = (category: Category, patch: Partial<Category>) => run(() => send(`/api/categories/${category.id}`, 'PUT', csrfToken, { name: patch.name ?? category.name, isArchived: patch.is_archived ?? category.is_archived, version: category.version }), 'Сохранено.',
    (lists) => ({ ...lists, categories: lists.categories.map((item) => item.id === category.id ? { ...item, ...patch } : item) }))
  return <section className="card">
    <header className="card-head"><div><h2>Категории</h2><p className="muted">Для группировки платежей.</p></div></header>
    <form className="inline-add" onSubmit={(event) => { event.preventDefault(); add() }}>
      <TextInput label="Новая категория" placeholder="Новая категория" value={name} onChange={setName} />
      <Button type="submit" variant="primary" icon={<Plus size={16} />} disabled={!name.trim()}>Добавить</Button>
    </form>
    <div className="rows">
      {active.map((category) => <div className="row" key={category.id}>
        <div className="row-main"><strong>{category.name}</strong></div>
        <div className="row-side"><RowMenu label={`Действия: ${category.name}`} items={[
          { label: 'Переименовать', onSelect: () => { setEditing(category); setDraft(category.name) } },
          { label: 'В архив', danger: true, onSelect: () => void update(category, { is_archived: true }) },
        ]} /></div>
      </div>)}
    </div>
    {archived.length > 0 && <button type="button" className="link archived-toggle" onClick={() => setShowArchived(!showArchived)}>{showArchived ? 'Скрыть архив' : `Архив · ${archived.length}`}</button>}
    {showArchived && <div className="rows">{archived.map((category) => <div className="row is-muted" key={category.id}>
      <div className="row-main"><strong>{category.name}</strong></div>
      <div className="row-side"><Button size="sm" onClick={() => void update(category, { is_archived: false })}>Вернуть</Button></div>
    </div>)}</div>}
    {editing && <Dialog title="Переименовать" onClose={() => setEditing(null)} actions={<><Button onClick={() => setEditing(null)}>Отмена</Button><Button variant="primary" disabled={!draft.trim()} onClick={() => { void update(editing, { name: draft.trim() }); setEditing(null) }}>Сохранить</Button></>}>
      <Field label="Название" wide><TextInput label="Название" value={draft} onChange={setDraft} autoFocus /></Field>
    </Dialog>}
  </section>
}
