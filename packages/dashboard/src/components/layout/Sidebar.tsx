import React from 'react';

export interface NavItem {
  id: string;
  label: string;
  icon: string;
}

const DEFAULT_NAV: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'trends', label: 'Trends', icon: '📈' },
  { id: 'funnels', label: 'Funnels', icon: '🔽' },
  { id: 'retention', label: 'Retention', icon: '🔄' },
  { id: 'events', label: 'Events', icon: '⚡' },
  { id: 'users', label: 'Users', icon: '👥' },
];

export interface SidebarProps {
  activeView: string;
  onNavigate: (view: string) => void;
  items?: NavItem[];
}

export function Sidebar({ activeView, onNavigate, items = DEFAULT_NAV }: SidebarProps) {
  return (
    <nav style={{ width: 220, borderRight: '1px solid var(--tp-border, #e2e8f0)', background: 'var(--tp-surface, #fff)', padding: '16px 0', flexShrink: 0 }}>
      <div style={{ padding: '0 16px 16px', fontSize: 16, fontWeight: 700, color: 'var(--tp-text, #0f172a)' }}>
        Trackpaw
      </div>
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onNavigate(item.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 16px',
            border: 'none', cursor: 'pointer', fontSize: 14, textAlign: 'left',
            background: activeView === item.id ? 'var(--tp-accent-light, #eef2ff)' : 'transparent',
            color: activeView === item.id ? 'var(--tp-accent, #6366f1)' : 'var(--tp-text, #0f172a)',
            fontWeight: activeView === item.id ? 600 : 400,
          }}
        >
          <span>{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}
