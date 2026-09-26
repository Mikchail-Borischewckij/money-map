"use client"

import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Filter, GripVertical, Search } from 'lucide-react'
import { cx } from '@/lib/format'
import Button from './Button'
import Checkbox from './Checkbox'
import Select from './Select'

export type ColumnFilter<T> =
  | { type: 'list'; value: (row: T) => string; label?: (value: string) => string }
  | { type: 'text'; value: (row: T) => string }

// `mobile`: where the cell goes on a phone card. `title` and `amount` share the top line, `full` takes its own line,
// `meta` items sit together under it with `end` (checkbox, menu) on the right.
export type Column<T> = {
  key: string
  header: string
  cell: (row: T) => React.ReactNode
  sort?: (row: T) => string | number
  filter?: ColumnFilter<T>
  align?: 'right' | 'center'
  className?: string
  hideHeader?: boolean
  mobile?: 'title' | 'amount' | 'meta' | 'full' | 'end' | 'hidden'
  mobileLabel?: boolean
  footer?: (rows: T[]) => React.ReactNode
}

type Sort = { key: string; dir: 'asc' | 'desc' }
type Filters = Record<string, string[] | string>

const pageSizes = [10, 25, 50]
const lower = (value: string) => value.toLocaleLowerCase('ru')
const compare = (a: string | number, b: string | number) => typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b), 'ru', { numeric: true })

const phoneQuery = '(max-width: 640px)'
const subscribe = (notify: () => void) => { const query = window.matchMedia(phoneQuery); query.addEventListener('change', notify); return () => query.removeEventListener('change', notify) }
const usePhone = () => useSyncExternalStore(subscribe, () => window.matchMedia(phoneQuery).matches, () => false)

function useOutside(open: boolean, close: () => void) {
  const root = useRef<HTMLDivElement>(null)
  const latest = useRef(close)
  useEffect(() => { latest.current = close }, [close])
  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) latest.current() }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') latest.current() }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])
  return root
}

function FilterMenu<T>({ column, rows, value, onChange }: { column: Column<T> & { filter: ColumnFilter<T> }; rows: T[]; value: string[] | string | undefined; onChange: (value: string[] | string | undefined) => void }) {
  const [open, setOpen] = useState(false)
  const root = useOutside(open, () => setOpen(false))
  const id = useId()
  const filter = column.filter
  const active = Array.isArray(value) ? value.length > 0 : Boolean(value)
  const options = filter.type === 'list' ? [...new Set(rows.map(filter.value))].sort((a, b) => compare(filter.label?.(a) ?? a, filter.label?.(b) ?? b)) : []
  const picked = Array.isArray(value) ? value : []
  return <div className="dt-filter" ref={root}>
    <button type="button" className={cx('dt-filter-button', active && 'is-active')} aria-label={`Фильтр: ${column.header}`} aria-expanded={open} aria-controls={id} onClick={() => setOpen(!open)}>
      <Filter size={13} />
    </button>
    {open && <div className="dt-filter-menu" id={id} role="dialog" aria-label={`Фильтр: ${column.header}`}>
      {filter.type === 'text'
        ? <input className="text-input" autoFocus placeholder={column.header} aria-label={column.header} value={typeof value === 'string' ? value : ''} onChange={(event) => onChange(event.target.value || undefined)} />
        : <div className="dt-filter-options">
          {options.map((option) => <Checkbox key={option} checked={picked.includes(option)}
            onChange={(checked) => { const next = checked ? [...picked, option] : picked.filter((item) => item !== option); onChange(next.length ? next : undefined) }}>
            {(filter.label?.(option) ?? option) || '—'}
          </Checkbox>)}
        </div>}
      {active && <button type="button" className="link" onClick={() => { onChange(undefined); setOpen(false) }}>Сбросить</button>}
    </div>}
  </div>
}

function HeaderControl<T>({ column, rows, sort, onSort, filters, onFilter }: { column: Column<T>; rows: T[]; sort: Sort | null; onSort?: (key: string) => void; filters: Filters; onFilter?: (key: string, value: string[] | string | undefined) => void }) {
  if (column.hideHeader) return <span className="sr-only">{column.header}</span>
  const sorted = sort?.key === column.key ? sort.dir : null
  const Icon = sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ChevronsUpDown
  return <span className="dt-head">
    {column.sort && onSort
      ? <button type="button" className={cx('dt-sort', sorted && 'is-active')} onClick={() => onSort(column.key)}>{column.header}<Icon size={13} aria-hidden="true" /></button>
      : <span>{column.header}</span>}
    {column.filter && onFilter && <FilterMenu column={column as Column<T> & { filter: ColumnFilter<T> }} rows={rows} value={filters[column.key]} onChange={(value) => onFilter(column.key, value)} />}
  </span>
}

export function Pagination({ page, pages, total, size, onPage, onSize }: { page: number; pages: number; total: number; size: number; onPage: (page: number) => void; onSize: (size: number) => void }) {
  return <nav className="pagination" aria-label="Страницы таблицы">
    <span className="pagination-size">На странице
      <Select compact label="Строк на странице" value={String(size)} options={pageSizes.map((value) => ({ value: String(value), label: String(value) }))} onChange={(value) => onSize(Number(value))} />
    </span>
    <div>
      <span>{total} записей</span>
      <Button size="sm" aria-label="Предыдущая страница" icon={<ChevronLeft size={16} />} disabled={page === 1} onClick={() => onPage(page - 1)} />
      <span>{page} / {pages}</span>
      <Button size="sm" aria-label="Следующая страница" icon={<ChevronRight size={16} />} disabled={page === pages} onClick={() => onPage(page + 1)} />
    </div>
  </nav>
}

// Reordering by dragging a handle (mouse or touch) or with the arrow keys on it. Only rows `canMove` allows take part.
function useReorder<T>(rows: T[], rowKey: (row: T) => string, reorder?: Reorder<T>) {
  const [drag, setDrag] = useState<{ key: string; order: string[] } | null>(null)
  const refs = useRef(new Map<string, HTMLElement>())
  const movable = reorder ? rows.filter(reorder.canMove).map(rowKey) : []
  const ordered = drag ? [...drag.order.map((key) => rows.find((row) => rowKey(row) === key)!), ...rows.filter((row) => !drag.order.includes(rowKey(row)))] : rows
  const handle = (row: T) => {
    if (!reorder) return null
    const key = rowKey(row)
    if (!reorder.canMove(row)) return <span className="dt-grip is-disabled" aria-hidden="true" />
    const move = (delta: number) => {
      const index = movable.indexOf(key)
      const target = index + delta
      if (target < 0 || target >= movable.length) return
      const order = [...movable]
      order.splice(index, 1)
      order.splice(target, 0, key)
      reorder.onMove(order)
    }
    return <button type="button" className="dt-grip" aria-label={`Переместить: ${reorder.label(row)}. Стрелки вверх и вниз`}
      onKeyDown={(event) => { if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); move(event.key === 'ArrowUp' ? -1 : 1) } }}
      onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); setDrag({ key, order: movable }) }}
      onPointerMove={(event) => {
        if (!drag) return
        const others = drag.order.filter((item) => item !== key)
        const index = others.filter((item) => { const rect = refs.current.get(item)?.getBoundingClientRect(); return rect && rect.top + rect.height / 2 < event.clientY }).length
        const order = [...others.slice(0, index), key, ...others.slice(index)]
        if (order.join() !== drag.order.join()) setDrag({ key, order })
      }}
      onPointerUp={() => { if (drag && drag.order.join() !== movable.join()) reorder.onMove(drag.order); setDrag(null) }}
      onPointerCancel={() => setDrag(null)}>
      <GripVertical size={16} />
    </button>
  }
  const ref = (key: string) => (element: HTMLElement | null) => { if (element) refs.current.set(key, element); else refs.current.delete(key) }
  return { ordered, handle, ref, dragging: drag?.key }
}

type Reorder<T> = { canMove: (row: T) => boolean; onMove: (keys: string[]) => void; label: (row: T) => string }

// The one table of the app: sorting by header, column filters, search, pagination; cards on a phone.
// With `reorder` the row order is the data itself, so sorting, filters and pages are off.
export default function DataTable<T>({ rows, columns, rowKey, rowClassName, search, defaultSort, actions, empty, footerLabel = 'Итого', reorder, label }: {
  rows: T[]; columns: Column<T>[]; rowKey: (row: T) => string; rowClassName?: (row: T) => string | undefined
  search?: (row: T) => string; defaultSort?: Sort; actions?: React.ReactNode; empty?: React.ReactNode; footerLabel?: string
  reorder?: Reorder<T>; label: string
}) {
  const phone = usePhone()
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort | null>(defaultSort ?? null)
  const [filters, setFilters] = useState<Filters>({})
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(pageSizes[0])
  const fixed = Boolean(reorder)

  const text = lower(query.trim())
  const shown = fixed ? rows : rows.filter((row) => (!text || !search || lower(search(row)).includes(text)) && columns.every((column) => {
    const value = filters[column.key]
    if (!column.filter || value === undefined) return true
    const cell = column.filter.value(row)
    return Array.isArray(value) ? value.includes(cell) : lower(cell).includes(lower(value.trim()))
  }))
  const sortColumn = !fixed && sort ? columns.find((column) => column.key === sort.key && column.sort) : undefined
  if (sortColumn?.sort) {
    const pick = sortColumn.sort
    const direction = sort!.dir === 'asc' ? 1 : -1
    shown.sort((a, b) => compare(pick(a), pick(b)) * direction)
  }
  const pages = fixed ? 1 : Math.max(1, Math.ceil(shown.length / size))
  const current = Math.min(page, pages)
  const visible = fixed ? shown : shown.slice((current - 1) * size, current * size)
  const { ordered, handle, ref, dragging } = useReorder(visible, rowKey, reorder)

  const onSort = fixed ? undefined : (key: string) => {
    setSort((previous) => previous?.key !== key ? { key, dir: 'asc' } : previous.dir === 'asc' ? { key, dir: 'desc' } : defaultSort && defaultSort.key !== key ? defaultSort : null)
    setPage(1)
  }
  const onFilter = fixed ? undefined : (key: string, value: string[] | string | undefined) => {
    setFilters((previous) => { const next = { ...previous }; if (value === undefined) delete next[key]; else next[key] = value; return next })
    setPage(1)
  }
  const filtered = Object.keys(filters).length > 0 || Boolean(text)
  const hasFooter = columns.some((column) => column.footer)
  const align = (column: Column<T>) => cx(column.align === 'right' && 'num', column.align === 'center' && 'center', column.className)
  const nothing = <p className="dt-nothing muted">Ничего не найдено.{filtered && <> <button type="button" className="link" onClick={() => { setFilters({}); setQuery('') }}>Сбросить фильтры</button></>}</p>

  const toolbar = (search && !fixed) || actions ? <div className="table-toolbar">
    {search && !fixed && <label className="table-search"><Search size={16} aria-hidden="true" /><span className="sr-only">Поиск</span>
      <input value={query} placeholder="Поиск" onChange={(event) => { setQuery(event.target.value); setPage(1) }} />
    </label>}
    {actions && <div className="table-toolbar-actions">{actions}</div>}
  </div> : null

  if (rows.length === 0) return <>{toolbar}{empty}</>

  const pager = !fixed && shown.length > pageSizes[0] && <Pagination page={current} pages={pages} total={shown.length} size={size} onPage={setPage} onSize={(value) => { setSize(value); setPage(1) }} />

  if (phone) {
    const controls = columns.filter((column) => !column.hideHeader && ((column.sort && onSort) || (column.filter && onFilter)))
    const place = (role: NonNullable<Column<T>['mobile']>) => columns.filter((column, index) => (column.mobile ?? (index === 0 ? 'title' : 'meta')) === role)
    const [titles, amounts, fulls, metas, ends] = (['title', 'amount', 'full', 'meta', 'end'] as const).map(place)
    return <>
      {toolbar}
      {controls.length > 0 && <div className="dt-mobile-head" aria-label="Сортировка и фильтры">
        {controls.map((column) => <HeaderControl key={column.key} column={column} rows={rows} sort={sort} onSort={column.sort ? onSort : undefined} filters={filters} onFilter={onFilter} />)}
      </div>}
      {shown.length === 0 ? nothing : <div className="dt-cards" role="list" aria-label={label}>
        {ordered.map((row) => {
          const key = rowKey(row)
          const metaCells = metas.map((column) => ({ column, content: column.cell(row) })).filter(({ content }) => content !== null && content !== false && content !== '')
          return <div role="listitem" key={key} ref={ref(key)} className={cx('dt-card', rowClassName?.(row), dragging === key && 'is-dragging')}>
            {handle(row)}
            <div className="dt-card-body">
              <div className="dt-card-top">
                <div className="dt-card-title">{titles.map((column) => <div key={column.key}>{column.cell(row)}</div>)}</div>
                {amounts.length > 0 && <div className="dt-card-amount">{amounts.map((column) => <div key={column.key}>{column.cell(row)}</div>)}</div>}
              </div>
              {fulls.map((column) => <div key={column.key} className="dt-card-full">{column.cell(row)}</div>)}
              {(metaCells.length > 0 || ends.length > 0) && <div className="dt-card-bottom">
                <div className="dt-card-meta">{metaCells.map(({ column, content }) => <span key={column.key}>{column.mobileLabel && <small>{column.header}</small>}{content}</span>)}</div>
                {ends.length > 0 && <div className="dt-card-end">{ends.map((column) => <div key={column.key}>{column.cell(row)}</div>)}</div>}
              </div>}
            </div>
          </div>
        })}
        {hasFooter && <div className="dt-card dt-card-total">
          <div className="dt-card-body">
            <div className="dt-card-top"><strong>{footerLabel}</strong><div className="dt-card-amount">{amounts.map((column) => <strong key={column.key}>{column.footer?.(shown)}</strong>)}</div></div>
            {metas.some((column) => column.footer) && <div className="dt-card-meta">{metas.filter((column) => column.footer).map((column) => <span key={column.key}><small>{column.header}</small>{column.footer!(shown)}</span>)}</div>}
          </div>
        </div>}
      </div>}
      {pager}
    </>
  }

  return <>
    {toolbar}
    {shown.length === 0 ? nothing : <div className="table-scroll"><table className="data-table" aria-label={label}>
      <thead><tr>
        {reorder && <th className="col-grip"><span className="sr-only">Порядок</span></th>}
        {columns.map((column) => <th key={column.key} className={align(column)} aria-sort={sort?.key === column.key && !fixed ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
          <HeaderControl column={column} rows={rows} sort={fixed ? null : sort} onSort={onSort} filters={filters} onFilter={onFilter} />
        </th>)}
      </tr></thead>
      <tbody>{ordered.map((row) => {
        const key = rowKey(row)
        return <tr key={key} ref={ref(key)} className={cx(rowClassName?.(row), dragging === key && 'is-dragging')}>
          {reorder && <td className="col-grip">{handle(row)}</td>}
          {columns.map((column) => <td key={column.key} className={align(column)}>{column.cell(row)}</td>)}
        </tr>
      })}</tbody>
      {hasFooter && <tfoot><tr>
        {reorder && <th />}
        {columns.map((column, index) => <th key={column.key} className={align(column)}>{column.footer ? column.footer(shown) : index === 0 ? footerLabel : null}</th>)}
      </tr></tfoot>}
    </table></div>}
    {pager}
  </>
}
