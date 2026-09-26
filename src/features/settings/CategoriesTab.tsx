"use client"

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button, Dialog, Empty, Field, Pagination, RowMenu, TableToolbar, TextInput } from '@/components/ui'
import { pageRows } from '@/lib/table'
import { send } from './api'
import type { Category, Run } from './types'

export default function CategoriesTab({ categories, csrfToken, run }: { categories: Category[]; csrfToken: string; run: Run }) {
  const [name, setName] = useState('')
  const [editing, setEditing] = useState<Category | null>(null)
  const [draft, setDraft] = useState('')
  const [showArchived, setShowArchived] = useState(false)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<'name' | 'usage'>('name')
  const [page, setPage] = useState(1)
  const active = categories.filter((category) => !category.is_archived)
  const archived = categories.filter((category) => category.is_archived)
  const filtered = active
    .filter((category) => category.name.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')))
    .sort((a, b) => sort === 'usage' ? Number(Boolean(b.in_use)) - Number(Boolean(a.in_use)) || a.name.localeCompare(b.name, 'ru') : a.name.localeCompare(b.name, 'ru'))
  const paged = pageRows(filtered, page, 10)
  const add = () => { if (!name.trim()) return; void run(() => send('/api/categories', 'POST', csrfToken, { name: name.trim() }), 'Категория добавлена.',
    (lists) => ({ ...lists, categories: [...lists.categories, { id: `new-${crypto.randomUUID()}`, name: name.trim(), is_archived: false, version: 0 }] })); setName('') }
  const update = (category: Category, patch: Partial<Category>) => run(() => send(`/api/categories/${category.id}`, 'PUT', csrfToken, { name: patch.name ?? category.name, isArchived: patch.is_archived ?? category.is_archived, version: category.version }), 'Сохранено.',
    (lists) => ({ ...lists, categories: lists.categories.map((item) => item.id === category.id ? { ...item, ...patch } : item) }))
  // Only a category no regular payment uses can be deleted; a used one can be archived.
  const remove = (category: Category) => run(() => send(`/api/categories/${category.id}`, 'DELETE', csrfToken, { version: category.version }), 'Категория удалена.',
    (lists) => ({ ...lists, categories: lists.categories.filter((item) => item.id !== category.id) }))
  return <section className="card">
    <header className="card-head"><div><h2>Категории</h2><p className="muted">Группы для аналитики платежей.</p></div></header>
    <form className="inline-add category-add" onSubmit={(event) => { event.preventDefault(); add() }}>
      <TextInput label="Новая категория" placeholder="Новая категория" value={name} onChange={setName} />
      <Button type="submit" variant="primary" icon={<Plus size={16} />} disabled={!name.trim()}>Добавить</Button>
    </form>
    <TableToolbar query={query} onQueryChange={(value) => { setQuery(value); setPage(1) }} sort={sort} onSortChange={(value) => { setSort(value); setPage(1) }} sortOptions={[
      { value: 'name', label: 'По названию' }, { value: 'usage', label: 'По использованию' },
    ]} />
    {active.length > 0 && filtered.length === 0 && <Empty>Ничего не найдено.</Empty>}
    {paged.rows.length > 0 && <div className="table-scroll"><table className="data-table compact-table">
      <thead><tr><th>Категория</th><th>В платежах</th><th className="actions"><span className="sr-only">Действия</span></th></tr></thead>
      <tbody>{paged.rows.map((category) => <tr key={category.id}>
        <td className="cell-name">{category.name}</td>
        <td>{category.in_use ? 'Да' : <span className="muted">Нет</span>}</td>
        <td className="actions"><RowMenu label={`Действия: ${category.name}`} items={[
          { label: 'Переименовать', onSelect: () => { setEditing(category); setDraft(category.name) } },
          category.in_use
            ? { label: 'В архив', danger: true, onSelect: () => void update(category, { is_archived: true }) }
            : { label: 'Удалить', danger: true, onSelect: () => void remove(category) },
        ]} /></td>
      </tr>)}</tbody>
    </table></div>}
    <Pagination page={paged.page} pages={paged.pages} total={filtered.length} onChange={setPage} />
    {archived.length > 0 && <button type="button" className="link archived-toggle" onClick={() => setShowArchived(!showArchived)}>{showArchived ? 'Скрыть архив' : `Архив · ${archived.length}`}</button>}
    {showArchived && <table className="data-table"><tbody>{archived.map((category) => <tr className="is-muted" key={category.id}>
      <td className="cell-name">{category.name}</td>
      <td className="actions"><div className="cell-actions">
        {!category.in_use && <Button size="sm" variant="ghost" onClick={() => void remove(category)}>Удалить</Button>}
        <Button size="sm" onClick={() => void update(category, { is_archived: false })}>Вернуть</Button>
      </div></td>
    </tr>)}</tbody></table>}
    {editing && <Dialog title="Переименовать" onClose={() => setEditing(null)} actions={<><Button onClick={() => setEditing(null)}>Отмена</Button><Button variant="primary" disabled={!draft.trim()} onClick={() => { void update(editing, { name: draft.trim() }); setEditing(null) }}>Сохранить</Button></>}>
      <Field label="Название" wide><TextInput label="Название" value={draft} onChange={setDraft} autoFocus /></Field>
    </Dialog>}
  </section>
}
