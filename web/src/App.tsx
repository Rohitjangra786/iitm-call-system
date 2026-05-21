import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Contacts from './pages/Contacts'
import Campaigns from './pages/Campaigns'
import Calls from './pages/Calls'
import CallDetail from './pages/CallDetail'
import Results from './pages/Results'
import Chat from './pages/Chat'
import Outreach from './pages/Outreach'
import Talk from './pages/Talk'

const tabs = [
  { to: '/', label: 'Home', icon: '🏠' },
  { to: '/contacts', label: 'Contacts', icon: '👥' },
  { to: '/outreach', label: 'Outreach', icon: '📤' },
  { to: '/chat', label: 'Agent', icon: '🎙️' },
  { to: '/calls', label: 'Calls', icon: '📞' },
  { to: '/results', label: 'Results', icon: '📊' },
]

export default function App() {
  const location = useLocation()
  const fullscreen = location.pathname.startsWith('/talk')

  if (fullscreen) {
    return (
      <Routes>
        <Route path="/talk" element={<Talk />} />
      </Routes>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="safe-pt sticky top-0 z-10 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-lg">📞</div>
            <div>
              <div className="text-sm font-semibold">IITM Call System</div>
              <div className="text-[11px] text-slate-400">by Rohit Jangra · automated outbound calling</div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-24 pt-4">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/calls" element={<Calls />} />
          <Route path="/calls/:sid" element={<CallDetail />} />
          <Route path="/results" element={<Results />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/outreach" element={<Outreach />} />
        </Routes>
        <footer className="mt-8 border-t border-slate-800 pt-4 text-center text-[11px] text-slate-500">
          © {new Date().getFullYear()} Rohit Jangra · IITM Call System · All rights reserved
        </footer>
      </main>

      <nav className="safe-pb fixed inset-x-0 bottom-0 z-10 border-t border-slate-800 bg-slate-950/95 backdrop-blur">
        <div className="mx-auto grid max-w-3xl grid-cols-6">
          {tabs.map(t => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.to === '/'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 py-2 text-[11px] ${
                  isActive ? 'text-brand-500' : 'text-slate-400'
                }`
              }
            >
              <span className="text-lg leading-none">{t.icon}</span>
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
