import Sidebar from './Sidebar'
import TopRightPanel from './TopRightPanel'

export default function Layout({ children }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar />
      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', position: 'relative' }}>
        {/* Fixed top-right control cluster */}
        <TopRightPanel />

        <div className="layout-content-wrapper" style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 1.5rem' }}>
          {children}
        </div>

        {/* Responsive padding so mobile navbar doesn't block content */}
        <style>{`
          @media (max-width: 768px) {
            .layout-content-wrapper {
              padding: 1.25rem 1rem 84px !important;
            }
          }
        `}</style>
      </main>
    </div>
  )
}
