import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme, ACCENTS } from '../context/ThemeContext'
import {
  LayoutDashboard, Monitor, Coffee, Package,
  Zap, TrendingDown, Users, BarChart2, Settings,
  Sun, Moon, LogOut
} from 'lucide-react'

const NAV = [
  { to: '/',          Icon: LayoutDashboard, label: 'Dashboard'  },
  { to: '/sessions',  Icon: Monitor,         label: 'Sessions'   },
  { to: '/pancafe',   Icon: Coffee,          label: 'PanCafe'    },
  { to: '/inventory', Icon: Package,         label: 'Inventory'  },
  { to: '/recharges', Icon: Zap,             label: 'Recharges'  },
  { to: '/expenses',  Icon: TrendingDown,    label: 'Expenses'   },
  { to: '/customers', Icon: Users,           label: 'Customers'  },
  { to: '/reports',   Icon: BarChart2,       label: 'Reports'    },
  { to: '/settings',  Icon: Settings,        label: 'Settings'   },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const { isDark, toggleDark, accentId, setAccentId } = useTheme()
  const navigate = useNavigate()

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <aside className="sidebar-desktop" style={{
      width: '220px', flexShrink: 0, height: '100vh', position: 'sticky', top: 0,
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg-elevated)', borderRight: '1px solid var(--border)',
    }}>
      {/* Logo */}
      <div style={{ padding: '1.25rem 1rem 1rem', borderBottom: '1px solid var(--border)' }}>
        <p style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
          Nexus Manager
        </p>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-faint)', marginTop: '0.125rem' }}>
          Gaming Cafe System
        </p>
      </div>

      {/* Nav links */}
      <nav style={{ flex: 1, padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.125rem', overflowY: 'auto' }}>
        {NAV.map(({ to, Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <Icon size={17} strokeWidth={1.75} style={{ flexShrink: 0 }} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Theme controls */}
      <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border)' }}>

        {/* Light / Dark toggle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: isDark ? '0' : '0.875rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {isDark
              ? <Moon size={15} style={{ color: 'var(--text-muted)' }} />
              : <Sun size={15} style={{ color: 'var(--text-muted)' }} />}
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              {isDark ? 'Dark' : 'Light'}
            </span>
          </div>
          <button onClick={toggleDark} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
            aria-label="Toggle dark mode">
            <div className={`toggle-track ${isDark ? 'on' : ''}`}>
              <div className="toggle-thumb" />
            </div>
          </button>
        </div>

        {/* Accent swatches — light mode only */}
        {!isDark && (
          <div>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-faint)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Accent</p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {Object.entries(ACCENTS).map(([id, a]) => (
                <button key={id} onClick={() => setAccentId(id)} title={a.label}
                  className={`accent-swatch ${accentId === id ? 'selected' : ''}`}
                  style={{ background: a.value, borderColor: accentId === id ? 'var(--text)' : 'transparent' }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* User + logout */}
      <div style={{ padding: '0.75rem 1rem 1rem', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.625rem' }}>
          <div style={{
            width: '2rem', height: '2rem', borderRadius: '50%', flexShrink: 0,
            background: 'var(--accent-dim)', border: '1px solid var(--accent-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.8125rem', fontWeight: 600, color: 'var(--accent-text)',
          }}>
            {user?.full_name?.[0]?.toUpperCase() || '?'}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.full_name}
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              @{user?.username}
            </p>
          </div>
        </div>
        <button onClick={handleLogout} className="btn-secondary btn-sm"
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <LogOut size={13} /> Sign out
        </button>
      </div>
    </aside>
  )
}
