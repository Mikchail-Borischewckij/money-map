import { cx } from '@/lib/format'
import { navItems, type View } from './nav'

// Bottom navigation on phones; the sidebar is hidden there.
export default function TabBar({ view, onNavigate }: { view: View; onNavigate: (view: View) => void }) {
  return <nav className="tabbar" aria-label="Разделы">
    {navItems.map((item) => <button key={item.value} type="button" className={cx(view === item.value && 'is-active')} aria-current={view === item.value ? 'page' : undefined} onClick={() => onNavigate(item.value)}>{item.icon}<span>{item.label}</span></button>)}
  </nav>
}
