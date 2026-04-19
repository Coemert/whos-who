import React, { useState } from 'react';
import { useStore } from '../store';

const THEMES = [
  { id: 'light',  label: 'Light',  dot: '#6c63ff' },
  { id: 'dark',   label: 'Dark',   dot: '#8b83ff' },
  { id: 'neon',   label: 'Neon',   dot: '#00f0ff' },
  { id: 'pastel', label: 'Pastel', dot: '#d98ae8' },
];

export default function ThemePicker() {
  const { theme, setTheme } = useStore();
  const [open, setOpen] = useState(false);

  return (
    <div style={{
      position: 'fixed', top: '1rem', right: '1rem',
      zIndex: 1000, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '.5rem',
    }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: 40, height: 40, borderRadius: '50%',
          border: '2px solid var(--border)',
          background: 'var(--surface)',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'var(--shadow-sm)',
          fontSize: '1.1rem',
          transition: 'transform .15s',
        }}
        title="Change theme"
        aria-label="Change theme"
      >
        🎨
      </button>

      {open && (
        <div
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '1rem',
            boxShadow: 'var(--shadow)',
            padding: '.5rem',
            display: 'flex', flexDirection: 'column', gap: '.25rem',
            animation: 'slideDown .2s ease',
            minWidth: 120,
          }}
        >
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTheme(t.id); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '.6rem',
                padding: '.4rem .75rem', borderRadius: '.6rem',
                border: 'none', cursor: 'pointer',
                background: theme === t.id ? 'var(--primary-dim)' : 'transparent',
                color: theme === t.id ? 'var(--primary)' : 'var(--text)',
                fontFamily: 'Nunito, sans-serif',
                fontWeight: theme === t.id ? 800 : 600,
                fontSize: '.9rem',
                transition: 'background .15s',
                width: '100%',
                textAlign: 'left',
              }}
            >
              <span
                style={{
                  width: 12, height: 12, borderRadius: '50%',
                  background: t.dot, flexShrink: 0,
                  boxShadow: theme === t.id ? `0 0 6px ${t.dot}` : 'none',
                }}
              />
              {t.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
