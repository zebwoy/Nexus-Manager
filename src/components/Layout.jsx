import Sidebar from './Sidebar'

export default function Layout({ children }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>
      <Sidebar />
      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem 1.5rem' }}>
          {children}
        </div>
      </main>
    </div>
  )
}
