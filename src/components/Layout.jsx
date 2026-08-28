import Sidebar from './Sidebar'
import NotificationBell from './NotificationBell'
import ScrollTopButton from './ScrollTopButton'

export default function Layout({ children }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar />
      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', position: 'relative', display: 'flex', flexDirection: 'column' }}>
        {/* Top bar with subtle notification bell aligned with page container */}
        <div style={{
          width: '100%',
          maxWidth: '1100px',
          margin: '0 auto',
          padding: '0.85rem 1.5rem 0',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          boxSizing: 'border-box'
        }}>
          <NotificationBell />
        </div>

        <div className="layout-content-wrapper" style={{ maxWidth: '1100px', width: '100%', margin: '0 auto', padding: '0.75rem 1.5rem 2.5rem', boxSizing: 'border-box' }}>
          {children}
        </div>

        {/* Floating Bottom-Right Quick Action */}
        <ScrollTopButton />

        {/* Responsive padding so mobile navbar doesn't block content */}
        <style>{`
          @media (max-width: 768px) {
            .layout-content-wrapper {
              padding: 0.75rem 1rem 84px !important;
            }
          }
        `}</style>
      </main>
    </div>
  )
}
