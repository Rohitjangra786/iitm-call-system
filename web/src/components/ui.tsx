import { ReactNode } from 'react'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-800 bg-slate-900 p-4 ${className}`}>
      {children}
    </div>
  )
}

export function Button({
  children, onClick, disabled, variant = 'primary', type = 'button', className = '',
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  type?: 'button' | 'submit'
  className?: string
}) {
  const v = {
    primary: 'bg-brand-600 hover:bg-brand-700 text-white',
    secondary: 'bg-slate-800 hover:bg-slate-700 text-slate-100',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    ghost: 'bg-transparent hover:bg-slate-800 text-slate-300',
  }[variant]
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${v} ${className}`}
    >
      {children}
    </button>
  )
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-brand-500 ${props.className ?? ''}`}
    />
  )
}

export function Label({ children }: { children: ReactNode }) {
  return <label className="mb-1 block text-xs font-medium text-slate-400">{children}</label>
}

export function Badge({ children, tone = 'slate' }: {
  children: ReactNode
  tone?: 'slate' | 'green' | 'red' | 'amber' | 'blue'
}) {
  const map = {
    slate: 'bg-slate-700 text-slate-200',
    green: 'bg-emerald-700/40 text-emerald-300 ring-1 ring-emerald-600/40',
    red: 'bg-red-700/40 text-red-300 ring-1 ring-red-600/40',
    amber: 'bg-amber-700/40 text-amber-200 ring-1 ring-amber-600/40',
    blue: 'bg-brand-700/40 text-brand-50 ring-1 ring-brand-500/40',
  }
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${map[tone]}`}>{children}</span>
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-400">
      <div className="text-sm font-medium">{title}</div>
      {hint && <div className="mt-1 text-xs">{hint}</div>}
    </div>
  )
}

export function H1({ children }: { children: ReactNode }) {
  return <h1 className="mb-3 text-lg font-semibold tracking-tight">{children}</h1>
}
