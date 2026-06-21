import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme, ACCENTS } from '../context/ThemeContext'
import {
  LayoutDashboard, Monitor, Coffee, Package,
  Zap, TrendingDown, Users, BarChart2, Settings,
  Sun, Moon, LogOut, Menu, X
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
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = () => { logout(); navigate('/login') }

  const activeMobileNav = NAV.slice(0, 4)
  const moreMobileNav = NAV.slice(4)

  return (
    <>
      {/* ─── DESKTOP SIDEBAR ────────────────────────────────────────── */}
      <aside className="sidebar-desktop" style={{
        width: '230px', flexShrink: 0, height: '100vh', position: 'sticky', top: 0,
        display: 'flex', flexDirection: 'column',
        background: 'linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg-card) 100%)',
        borderRight: '1.5px solid var(--border)',
        borderTop: '1px solid var(--bevel-top)',
        boxShadow: '4px 0 16px rgba(0,0,0,0.15)',
        zIndex: 30
      }}>
        {/* Logo Panel */}
        <div style={{
          padding: '1.5rem 1.25rem 1.15rem',
          borderBottom: '1.5px solid var(--bevel-bottom)',
          background: 'rgba(0,0,0,0.05)',
          boxShadow: 'inset 0 -1px 0 var(--bevel-top)'
        }}>
          <p style={{
            fontSize: '1.25rem', fontWeight: 800, color: 'var(--text)',
            letterSpacing: '-0.02em', textShadow: '1px 1px 0 var(--bevel-top)'
          }}>
            Nexus Manager
          </p>
          <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontWeight: 650, marginTop: '0.15rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Gaming Cafe Console
          </p>
        </div>

        {/* Navigation Links */}
        <nav style={{
          flex: 1, padding: '1rem 0.75rem', display: 'flex', flexDirection: 'column',
          gap: '0.25rem', overflowY: 'auto', borderTop: '1.5px solid var(--bevel-top)'
        }}>
          {NAV.map(({ to, Icon, label }) => (
            <NavLink key={to} to={to} end={to === '/'}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
              <Icon size={16} strokeWidth={2.2} style={{ flexShrink: 0 }} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Theme Settings Panel */}
        <div style={{
          padding: '0.95rem 1rem',
          borderTop: '1.5px solid var(--bevel-top)',
          borderBottom: '1.5px solid var(--bevel-bottom)',
          background: 'rgba(0,0,0,0.02)'
        }}>
          {/* Light / Dark Mode switch */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: (!isDark ? '0.75rem' : '0') }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {isDark
                ? <Moon size={15} style={{ color: 'var(--text-muted)' }} />
                : <Sun size={15} style={{ color: 'var(--text-muted)' }} />}
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                {isDark ? 'Dark Mode' : 'Light Mode'}
              </span>
            </div>
            <button onClick={toggleDark} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
              aria-label="Toggle dark/light system theme">
              <div className={`toggle-track ${isDark ? 'on' : ''}`}>
                <div className="toggle-thumb" />
              </div>
            </button>
          </div>

          {/* Accent Color picker */}
          {!isDark && (
            <div>
              <p style={{ fontSize: '0.675rem', color: 'var(--text-faint)', fontWeight: 700, marginBottom: '0.45rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Console Tint</p>
              <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                {Object.entries(ACCENTS).map(([id, a]) => (
                  <button key={id} onClick={() => setAccentId(id)} title={a.label}
                    className={`accent-swatch ${accentId === id ? 'selected' : ''}`}
                    style={{ background: a.value }} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* System Operator & Log Out */}
        <div style={{
          padding: '1rem',
          borderTop: '1.5px solid var(--bevel-top)',
          background: 'rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <div style={{
              width: '2.25rem', height: '2.25rem', borderRadius: '50%', flexShrink: 0,
              background: 'var(--accent-dim)', border: '1.5px solid var(--accent-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.9rem', fontWeight: 750, color: 'var(--accent-text)',
              boxShadow: '1px 1px 3px rgba(0,0,0,0.1), inset 1px 1px 0px rgba(255,255,255,0.15)'
            }}>
              {user?.full_name?.[0]?.toUpperCase() || '?'}
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.full_name}
              </p>
              <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                @{user?.username}
              </p>
            </div>
          </div>
          <button onClick={handleLogout} className="btn-secondary btn-sm"
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
            <LogOut size={13} /> Operator Sign Out
          </button>
        </div>
      </aside>

      {/* ─── MOBILE NAVIGATION BOTTOM BAR ───────────────────────────── */}
      <div className="mobile-nav" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, height: '64px',
        background: 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-elevated) 100%)',
        borderTop: '1.5px solid var(--border)',
        boxShadow: '0 -4px 16px rgba(0,0,0,0.15)',
        display: 'none', justifyContent: 'space-around', alignItems: 'center',
        padding: '0 0.5rem', zIndex: 40
      }}>
        {activeMobileNav.map(({ to, Icon, label }) => (
          <NavLink key={to} to={to} end={to === '/'}
            className={({ isActive }) => `flex flex-col items-center justify-center gap-1 flex-1 h-full text-center no-underline`}
            style={({ isActive }) => ({
              color: isActive ? 'var(--accent)' : 'var(--text-muted)',
              fontSize: '0.675rem', fontWeight: isActive ? 700 : 500
            })}>
            {({ isActive }) => (
              <>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
        
        {/* 'More' Button to trigger sliding control sheet */}
        <button onClick={() => setMenuOpen(true)} className="flex flex-col items-center justify-center gap-1 flex-1 h-full text-center bg-none border-none cursor-pointer"
          style={{ color: menuOpen ? 'var(--accent)' : 'var(--text-muted)', fontSize: '0.675rem', fontWeight: menuOpen ? 700 : 500 }}>
          <Menu size={20} strokeWidth={menuOpen ? 2.5 : 2} />
          <span>More</span>
        </button>
      </div>

      {/* ─── MOBILE MORE SLIDE-UP SHEET OVERLAY ──────────────────────── */}
      {menuOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 50, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end'
        }}>
          {/* Dim background tap overlay */}
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)'
          }} onClick={() => setMenuOpen(false)} />
          
          {/* Slide up sheet */}
          <div className="card" style={{
            position: 'relative', width: '100%', borderBottomLeftRadius: 0, borderBottomRightRadius: 0,
            borderTopLeftRadius: '24px', borderTopRightRadius: '24px',
            padding: '1.75rem 1.5rem 2.25rem', maxHeight: '85vh', overflowY: 'auto',
            background: 'linear-gradient(180deg, var(--bg-card) 0%, var(--bg-elevated) 100%)',
            boxShadow: '0 -8px 32px rgba(0,0,0,0.3)',
            animation: 'slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            {/* Grab Handle */}
            <div style={{ width: '40px', height: '5px', background: 'var(--border)', borderRadius: '99px', margin: '-0.75rem auto 1.25rem' }} />
            
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div>
                <p style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text)' }}>Navigation & Controls</p>
                <p style={{ fontSize: '0.725rem', color: 'var(--text-muted)' }}>Console operator dashboard</p>
              </div>
              <button onClick={() => setMenuOpen(false)} className="btn-secondary btn-icon" style={{ borderRadius: '50%' }}>
                <X size={16} />
              </button>
            </div>

            {/* Menu List */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem', marginBottom: '1.5rem' }}>
              {moreMobileNav.map(({ to, Icon, label }) => (
                <NavLink key={to} to={to} onClick={() => setMenuOpen(false)}
                  className={({ isActive }) => `flex items-center gap-2.5 p-3 rounded-xl border border-transparent no-underline`}
                  style={({ isActive }) => ({
                    background: isActive ? 'var(--accent-dim)' : 'var(--bg-input)',
                    border: isActive ? '1px solid var(--accent-border)' : '1px solid var(--border)',
                    color: isActive ? 'var(--accent-text)' : 'var(--text)',
                    fontSize: '0.875rem', fontWeight: 600,
                    boxShadow: isActive ? 'none' : 'inset 1px 1px 3px rgba(0,0,0,0.05)'
                  })}>
                  <Icon size={16} strokeWidth={2.2} />
                  <span>{label}</span>
                </NavLink>
              ))}
            </div>

            {/* Config & Toggles */}
            <div style={{ background: 'var(--bg-input)', padding: '1rem', borderRadius: '14px', border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
              {/* Dark/Light mode switch */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: (!isDark ? '0.75rem' : '0') }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {isDark ? <Moon size={16} style={{ color: 'var(--text-muted)' }} /> : <Sun size={16} style={{ color: 'var(--text-muted)' }} />}
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Theme Mode</span>
                </div>
                <button onClick={toggleDark} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}>
                  <div className={`toggle-track ${isDark ? 'on' : ''}`}>
                    <div className="toggle-thumb" />
                  </div>
                </button>
              </div>

              {/* Accent Picker */}
              {!isDark && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem', marginTop: '0.25rem' }}>
                  <p style={{ fontSize: '0.675rem', color: 'var(--text-faint)', fontWeight: 700, marginBottom: '0.45rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Console Tint</p>
                  <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                    {Object.entries(ACCENTS).map(([id, a]) => (
                      <button key={id} onClick={() => setAccentId(id)} title={a.label}
                        className={`accent-swatch ${accentId === id ? 'selected' : ''}`}
                        style={{ background: a.value }} />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Operator Box & Sign Out */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                <div style={{
                  width: '2rem', height: '2rem', borderRadius: '50%',
                  background: 'var(--accent-dim)', border: '1.5px solid var(--accent-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.8125rem', fontWeight: 700, color: 'var(--accent-text)'
                }}>
                  {user?.full_name?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)' }}>{user?.full_name}</p>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>@{user?.username}</p>
                </div>
              </div>
              <button onClick={() => { setMenuOpen(false); handleLogout() }} className="btn-danger btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <LogOut size={13} /> Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Slideup keyframe injection */}
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </>
  )
}
