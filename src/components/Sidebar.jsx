import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const NAV = [
  { to: '/',           icon: '⬡', label: 'Dashboard'  },
  { to: '/sessions',   icon: '🖥', label: 'Sessions'   },
  { to: '/pancafe',    icon: '☕', label: 'PanCafe'    },
  { to: '/inventory',  icon: '📦', label: 'Inventory'  },
  { to: '/recharges',  icon: '⚡', label: 'Recharges'  },
  { to: '/expenses',   icon: '💸', label: 'Expenses'   },
  { to: '/customers',  icon: '👤', label: 'Customers'  },
  { to: '/reports',    icon: '📊', label: 'Reports'    },
  { to: '/settings',   icon: '⚙', label: 'Settings'   },
]

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <aside className="w-56 shrink-0 h-screen sticky top-0 flex flex-col bg-surface-900 border-r border-surface-700">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-surface-700">
        <h1 className="font-display font-bold text-xl text-white tracking-widest uppercase">
          <span className="text-brand-400">Nexus</span> Manager
        </h1>
        <p className="text-slate-500 text-xs font-mono mt-0.5">Gaming Cafe System</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1 overflow-y-auto">
        {NAV.map(({ to, icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `sidebar-link ${isActive ? 'active' : ''}`
            }
          >
            <span className="text-base w-5 text-center">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User info + logout */}
      <div className="px-3 py-4 border-t border-surface-700">
        <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-surface-800 mb-2">
          <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-xs font-bold text-white shrink-0">
            {user?.full_name?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-display font-semibold text-white truncate">{user?.full_name}</p>
            <p className="text-xs font-mono text-slate-500 truncate">@{user?.username}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="btn-secondary w-full text-sm py-1.5">
          Sign Out
        </button>
      </div>
    </aside>
  )
}
