import { Activity, BarChart3, Dumbbell, History, Salad, Sparkles, UserRound } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { Brand } from '../components/Brand'

const navItems = [
  { to: '/today', label: 'Home', icon: Sparkles },
  { to: '/train', label: 'Train', icon: Dumbbell },
  { to: '/nutrition', label: 'Nutrition', icon: Salad },
  { to: '/progress', label: 'Progress', icon: BarChart3 },
  { to: '/profile', label: 'Profile', icon: UserRound },
]

export function AppLayout() {
  return (
    <div className="app-shell">
      <aside className="desktop-sidebar">
        <Brand />
        <nav aria-label="Main navigation">
          {navItems.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to}><Icon /> <span>{label}</span></NavLink>)}
        </nav>
        <NavLink className="history-link" to="/history"><History /> <span>Workout history</span></NavLink>
        <div className="sidebar-status"><Activity size={16} /><span>Local-first core<br /><small>Sync ready when configured</small></span></div>
      </aside>
      <div className="app-content"><Outlet /></div>
      <nav className="bottom-nav" aria-label="Main navigation">
        {navItems.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to}><Icon /><span>{label}</span></NavLink>)}
      </nav>
    </div>
  )
}
