import { LogOut } from 'lucide-react'
import { Button } from '@/components/ui'
import { cx } from '@/lib/format'
import { navItems, type View } from './nav'

export default function Sidebar({ view, onNavigate, displayName, onLogout }: { view: View; onNavigate: (view: View) => void; displayName: string; onLogout: () => void }) {
  return <aside className="sidebar">
    <div className="brand"><span className="brand-mark">M</span>MoneyMap</div>
    <nav className="nav" aria-label="Разделы">
      {navItems.map((item) => <button key={item.value} type="button" className={cx('nav-item', view === item.value && 'is-active')} aria-current={view === item.value ? 'page' : undefined} onClick={() => onNavigate(item.value)}>{item.icon}<span>{item.label}</span></button>)}
    </nav>
    <div className="sidebar-foot">
      <span className="user">{displayName}</span>
      <Button variant="ghost" size="sm" icon={<LogOut size={16} />} onClick={onLogout}>Выйти</Button>
    </div>
  </aside>
}
