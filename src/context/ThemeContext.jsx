import { createContext, useContext, useState, useEffect } from 'react'

export const ACCENTS = {
  blue:   { label: 'Blue',         value: '#2563eb', hover: '#1d4ed8', dim: 'rgba(37,99,235,0.1)',  border: 'rgba(37,99,235,0.25)'  },
  green:  { label: 'Pista Green',  value: '#4ade80', hover: '#22c55e', dim: 'rgba(74,222,128,0.1)', border: 'rgba(74,222,128,0.25)' },
  maroon: { label: 'Maroon',       value: '#9f1239', hover: '#881337', dim: 'rgba(159,18,57,0.08)', border: 'rgba(159,18,57,0.2)'   },
  brown:  { label: 'Coffee Brown', value: '#92400e', hover: '#78350f', dim: 'rgba(146,64,14,0.08)', border: 'rgba(146,64,14,0.2)'   },
  grey:   { label: 'Majestic Grey',value: '#475569', hover: '#334155', dim: 'rgba(71,85,105,0.08)', border: 'rgba(71,85,105,0.2)'   },
}

const LIGHT_VARS = (accent) => ({
  '--bg':            '#f8fafc',
  '--bg-elevated':   '#ffffff',
  '--bg-card':       '#ffffff',
  '--bg-input':      '#f8fafc',
  '--bg-hover':      '#f1f5f9',
  '--border':        '#e2e8f0',
  '--border-focus':  accent.value,
  '--text':          '#0f172a',
  '--text-muted':    '#64748b',
  '--text-faint':    '#94a3b8',
  '--text-inverse':  '#ffffff',
  '--accent':        accent.value,
  '--accent-hover':  accent.hover,
  '--accent-dim':    accent.dim,
  '--accent-border': accent.border,
  '--accent-text':   accent.value,
  '--btn-primary-text': '#ffffff',
  '--danger':        '#dc2626',
  '--danger-dim':    'rgba(220,38,38,0.08)',
  '--danger-border': 'rgba(220,38,38,0.2)',
  '--success':       '#16a34a',
  '--success-dim':   'rgba(22,163,74,0.08)',
  '--success-border':'rgba(22,163,74,0.2)',
  '--warning':       '#d97706',
  '--warning-dim':   'rgba(217,119,6,0.08)',
  '--warning-border':'rgba(217,119,6,0.2)',
  '--shadow':        '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)',
  '--shadow-md':     '0 4px 16px rgba(0,0,0,0.08)',
})

const DARK_VARS = {
  '--bg':            '#000000',
  '--bg-elevated':   '#0a0a0a',
  '--bg-card':       '#111111',
  '--bg-input':      '#1a1a1a',
  '--bg-hover':      '#1f1f1f',
  '--border':        '#2a2a2a',
  '--border-focus':  '#ffffff',
  '--text':          '#f0f0f0',
  '--text-muted':    '#888888',
  '--text-faint':    '#444444',
  '--text-inverse':  '#000000',
  '--accent':        '#ffffff',
  '--accent-hover':  '#e0e0e0',
  '--accent-dim':    'rgba(255,255,255,0.06)',
  '--accent-border': 'rgba(255,255,255,0.15)',
  '--accent-text':   '#ffffff',
  '--btn-primary-text': '#000000',
  '--danger':        '#f87171',
  '--danger-dim':    'rgba(248,113,113,0.1)',
  '--danger-border': 'rgba(248,113,113,0.25)',
  '--success':       '#4ade80',
  '--success-dim':   'rgba(74,222,128,0.1)',
  '--success-border':'rgba(74,222,128,0.25)',
  '--warning':       '#fbbf24',
  '--warning-dim':   'rgba(251,191,36,0.1)',
  '--warning-border':'rgba(251,191,36,0.25)',
  '--shadow':        '0 1px 3px rgba(0,0,0,0.4)',
  '--shadow-md':     '0 4px 16px rgba(0,0,0,0.5)',
}

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(() => localStorage.getItem('nexus_dark') === 'true')
  const [accentId, setAccentId] = useState(() => localStorage.getItem('nexus_accent') || 'blue')

  const accent = ACCENTS[accentId] || ACCENTS.blue

  useEffect(() => {
    const vars = isDark ? DARK_VARS : LIGHT_VARS(accent)
    const root = document.documentElement
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v))
    root.setAttribute('data-dark', isDark ? 'true' : 'false')
    localStorage.setItem('nexus_dark', isDark)
    localStorage.setItem('nexus_accent', accentId)
  }, [isDark, accentId, accent])

  const toggleDark = () => setIsDark(d => !d)

  return (
    <ThemeContext.Provider value={{ isDark, toggleDark, accentId, setAccentId, accent, accents: ACCENTS }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
