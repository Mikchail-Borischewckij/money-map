"use client"

import { ChevronLeft, ChevronRight, Search } from 'lucide-react'
import Button from './Button'
import Select from './Select'
import type { Option } from './option'

export function TableToolbar<S extends string>({ query, onQueryChange, sort, sortOptions, onSortChange, children }: {
  query: string; onQueryChange: (value: string) => void; sort: S; sortOptions: Option<S>[]; onSortChange: (value: S) => void; children?: React.ReactNode
}) {
  return <div className="table-toolbar">
    <label className="table-search"><Search size={16} aria-hidden="true" /><span className="sr-only">Поиск</span>
      <input value={query} placeholder="Поиск" onChange={(event) => onQueryChange(event.target.value)} />
    </label>
    <Select compact label="Сортировка" value={sort} options={sortOptions} onChange={onSortChange} />
    {children && <div className="table-toolbar-actions">{children}</div>}
  </div>
}

export function Pagination({ page, pages, total, onChange }: { page: number; pages: number; total: number; onChange: (page: number) => void }) {
  if (pages <= 1) return null
  return <nav className="pagination" aria-label="Страницы таблицы">
    <span>{total} записей</span>
    <div>
      <Button size="sm" variant="ghost" aria-label="Предыдущая страница" icon={<ChevronLeft size={16} />} disabled={page === 1} onClick={() => onChange(page - 1)} />
      <span>{page} / {pages}</span>
      <Button size="sm" variant="ghost" aria-label="Следующая страница" icon={<ChevronRight size={16} />} disabled={page === pages} onClick={() => onChange(page + 1)} />
    </div>
  </nav>
}
