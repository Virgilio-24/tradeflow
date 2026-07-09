import { Sidebar } from './Sidebar'

interface LayoutProps {
  title: string
  actions?: React.ReactNode
  children: React.ReactNode
}

export function Layout({ title, actions, children }: LayoutProps) {
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        <header className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between">
          <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          {actions && <div className="flex items-center gap-3">{actions}</div>}
        </header>
        <div className="flex-1 p-8">{children}</div>
      </main>
    </div>
  )
}
