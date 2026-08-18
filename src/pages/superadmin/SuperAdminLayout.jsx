import { useState } from 'react'
import { NavLink, useNavigate, Outlet, Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../context/ThemeContext'
import { Shield, Building2, LayoutDashboard, History, ArrowLeft, Sun, Moon, LogOut, Terminal, CheckCircle, ExternalLink } from 'lucide-react'
import { SignedIn, UserButton } from '@clerk/clerk-react'

export default function SuperAdminLayout({ children }) {
  const { user, logout } = useAuth()
  const { isDark, toggleDark } = useTheme()
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>
      {/* Super Admin Top Navigation Bar */}
      <header style={{
        background: 'linear-gradient(180deg, var(--bg-elevated) 0%, var(--bg-card) 100%)',
        borderBottom: '1.5px solid var(--border)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
        position: 'sticky', top: 0, zIndex: 40
      }}>
        <div style={{
          maxWidth: '1380px', margin: '0 auto', padding: '0.85rem 1.5rem',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem'
        }}>
          {/* Brand & Super Admin Badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Link to="/super-admin" style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', textDecoration: 'none' }}>
              <div style={{
                width: '34px', height: '34px', borderRadius: '10px',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(245, 158, 11, 0.4)', color: '#000'
              }}>
                <Shield size={20} strokeWidth={2.5} />
              </div>
              <div>
                <p style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', margin: 0, lineHeight: 1.2 }}>
                  Nexus Platform
                </p>
                <span style={{ fontSize: '0.65rem', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  ★ Super Admin Console
                </span>
              </div>
            </Link>

            {/* Nav Tabs */}
            <nav style={{ display: 'flex', gap: '0.35rem', marginLeft: '1.25rem' }}>
              {[
                { to: '/super-admin',         label: 'Fleet Overview',  icon: LayoutDashboard, end: true },
                { to: '/super-admin/tenants', label: 'Organizations',   icon: Building2 },
                { to: '/super-admin/audit',   label: 'Global Audits',   icon: History },
              ].map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
                  style={({ isActive }) => ({
                    padding: '0.45rem 0.85rem', borderRadius: '8px',
                    fontSize: '0.8rem', fontWeight: 700, textDecoration: 'none',
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    background: isActive ? 'var(--accent)' : 'transparent',
                    color: isActive ? 'var(--btn-primary-text, #fff)' : 'var(--text-muted)',
                    transition: 'all 0.15s'
                  })}
                >
                  <Icon size={14} />
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* Right actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <SignedIn>
              <UserButton afterSignOutUrl="/" />
            </SignedIn>

            <button onClick={toggleDark} className="btn-secondary btn-sm" style={{ padding: '0.35rem 0.65rem' }}>
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
            </button>

            <div style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.35rem 0.75rem', borderRadius: '8px',
              background: 'var(--bg-input)', border: '1px solid var(--border)'
            }}>
              <span className="led-indicator led-green" style={{ width: '6px', height: '6px' }} />
              <span style={{ fontSize: '0.75rem', fontWeight: 750, color: 'var(--text)' }}>
                {user?.username || 'Super Admin'}
              </span>
            </div>

            <button
              onClick={() => { logout(); navigate('/login') }}
              className="btn-secondary btn-sm"
              style={{ padding: '0.35rem 0.65rem', color: 'var(--danger)' }}
              title="Sign Out"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1, maxWidth: '1380px', width: '100%', margin: '0 auto', padding: '2rem 1.5rem' }}>
        {children || <Outlet />}
      </main>
    </div>
  )
}
