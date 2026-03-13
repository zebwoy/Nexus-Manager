import Sidebar from './Sidebar'

export default function Layout({ children }) {
  return (
    <div className="flex min-h-screen bg-surface-950">
      <Sidebar />
      <main className="flex-1 overflow-y-auto p-6">
        {children}
      </main>
    </div>
  )
}
