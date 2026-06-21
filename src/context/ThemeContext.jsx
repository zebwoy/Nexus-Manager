import { createContext, useContext, useState, useEffect } from 'react'

export const ACCENTS = {
  blue:   { label: 'Blue',         value: '#2563eb', hover: '#1d4ed8', dim: 'rgba(37,99,235,0.1)',  border: 'rgba(37,99,235,0.25)'  },
  green:  { label: 'Pista Green',  value: '#4ade80', hover: '#22c55e', dim: 'rgba(74,222,128,0.1)', border: 'rgba(74,222,128,0.25)' },
  maroon: { label: 'Maroon',       value: '#9f1239', hover: '#881337', dim: 'rgba(159,18,57,0.08)', border: 'rgba(159,18,57,0.2)'   },
  brown:  { label: 'Coffee Brown', value: '#92400e', hover: '#78350f', dim: 'rgba(146,64,14,0.08)', border: 'rgba(146,64,14,0.2)'   },
  grey:   { label: 'Majestic Grey',value: '#475569', hover: '#334155', dim: 'rgba(71,85,105,0.08)', border: 'rgba(71,85,105,0.2)'   },
}

const LIGHT_VARS = (accent) => ({
  '--bg':            '#eef2f6',
  '--bg-elevated':   '#f1f5f9',
  '--bg-card':       '#f8fafc',
  '--bg-input':      '#e2e8f0',
  '--bg-hover':      '#e2e8f0',
  '--border':        '#cbd5e1',
  '--border-focus':  accent.value,
  '--text':          '#0f172a',
  '--text-muted':    '#475569',
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
  '--shadow-outset': '5px 5px 10px #cbd5e1, -5px -5px 10px #ffffff',
  '--shadow-inset':  'inset 2px 2px 6px #cbd5e1, inset -2px -2px 6px #ffffff',
  '--bevel-top':     'rgba(255,255,255,0.85)',
  '--bevel-bottom':  'rgba(0,0,0,0.08)',
  '--shadow':        '3px 3px 8px rgba(0,0,0,0.06)',
  '--shadow-md':     '6px 6px 16px rgba(0,0,0,0.1)',
})

const DARK_VARS = {
  '--bg':            '#0e1118',
  '--bg-elevated':   '#161b26',
  '--bg-card':       '#1a202c',
  '--bg-input':      '#0b0d12',
  '--bg-hover':      '#242c3d',
  '--border':        '#2d3748',
  '--border-focus':  '#38bdf8',
  '--text':          '#e2e8f0',
  '--text-muted':    '#a0aec0',
  '--text-faint':    '#4a5568',
  '--text-inverse':  '#090d16',
  '--accent':        '#38bdf8',
  '--accent-hover':  '#0ea5e9',
  '--accent-dim':    'rgba(56,189,248,0.08)',
  '--accent-border': 'rgba(56,189,248,0.25)',
  '--accent-text':   '#38bdf8',
  '--btn-primary-text': '#090d16',
  '--danger':        '#f87171',
  '--danger-dim':    'rgba(248,113,113,0.08)',
  '--danger-border': 'rgba(248,113,113,0.25)',
  '--success':       '#4ade80',
  '--success-dim':   'rgba(74,222,128,0.08)',
  '--success-border':'rgba(74,222,128,0.25)',
  '--warning':       '#fbbf24',
  '--warning-dim':   'rgba(251,191,36,0.08)',
  '--warning-border':'rgba(251,191,36,0.25)',
  '--shadow-outset': '5px 5px 12px #07090d, -4px -4px 12px #1f2736',
  '--shadow-inset':  'inset 3px 3px 8px #06070a, inset -2px -2px 8px #262f40',
  '--bevel-top':     'rgba(255,255,255,0.05)',
  '--bevel-bottom':  'rgba(0,0,0,0.4)',
  '--shadow':        '4px 4px 12px rgba(0,0,0,0.4)',
  '--shadow-md':     '8px 8px 24px rgba(0,0,0,0.5)',
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
