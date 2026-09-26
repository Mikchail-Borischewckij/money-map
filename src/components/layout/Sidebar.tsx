import { LogOut, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { Button } from '@/components/ui'
import { cx } from '@/lib/format'
import { navItems, type View } from './nav'

export default function Sidebar({ view, onNavigate, displayName, onLogout, collapsed, onToggleCollapsed }: {
  view: View; onNavigate: (view: View) => void; displayName: string; onLogout: () => void
  collapsed: boolean; onToggleCollapsed: () => void
}) {
  return <aside className="sidebar">
    <div className="sidebar-head">
      <div className="brand"><span className="brand-mark">M</span><span className="brand-name">MoneyMap</span></div>
      <button type="button" className="sidebar-toggle" aria-label={collapsed ? 'Развернуть навигацию' : 'Свернуть навигацию'} onClick={onToggleCollapsed}>
        {collapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
      </button>
    </div>
    <nav className="nav" aria-label="Разделы">
      {navItems.map((item) => <button key={item.value} type="button" className={cx('nav-item', view === item.value && 'is-active')} aria-label={item.label} title={collapsed ? item.label : undefined} aria-current={view === item.value ? 'page' : undefined} onClick={() => onNavigate(item.value)}>{item.icon}<span>{item.label}</span></button>)}
    </nav>
    <div className="sidebar-foot">
      <span className="user">{displayName}</span>
      <Button variant="ghost" size="sm" icon={<LogOut size={16} />} aria-label="Выйти" title={collapsed ? 'Выйти' : undefined} onClick={onLogout}><span className="logout-label">Выйти</span></Button>
    </div>
  </aside>
}
