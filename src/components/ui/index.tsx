'use client';
import React from 'react';

// ── BUTTON ──────────────────────────────────────────────────────────────────
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success' | 'gradient';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
}
export function Btn({ variant = 'primary', size = 'md', loading, icon, children, className = '', ...rest }: BtnProps) {
  return (
    <button
      className={`btn btn-${variant} btn-${size} ${className}`}
      disabled={rest.disabled || loading}
      {...rest}
    >
      {loading ? <span className="spinner spinner-sm" style={{ borderTopColor: ['primary','gradient','danger','success'].includes(variant) ? '#fff' : 'var(--primary)' }} /> : icon}
      {children}
    </button>
  );
}

// ── INPUT ────────────────────────────────────────────────────────────────────
export function Input({ className = '', ...rest }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`form-input ${className}`} {...rest} />;
}
export function Textarea({ className = '', ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`form-input ${className}`} style={{ minHeight: 80, resize: 'vertical', ...rest.style }} {...rest} />;
}
export function Select({ className = '', ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={`form-input ${className}`} style={{ cursor: 'pointer', ...rest.style }} {...rest} />;
}
export function Label({ children, className = '', ...rest }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={`form-label ${className}`} {...rest}>{children}</label>;
}

// ── CARD ─────────────────────────────────────────────────────────────────────
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  interactive?: boolean;
  padding?: number | string;
}
export function Card({ hover, interactive, padding = 18, className = '', style, ...rest }: CardProps) {
  return (
    <div
      className={`card ${hover ? 'card-hover' : ''} ${interactive ? 'card-interactive' : ''} ${className}`}
      style={{ padding, ...style }}
      {...rest}
    />
  );
}

// ── STAT ─────────────────────────────────────────────────────────────────────
interface StatProps {
  label: string;
  value: React.ReactNode;
  color?: string;
  sub?: string;
  icon?: string;
}
export function Stat({ label, value, color, sub, icon }: StatProps) {
  return (
    <div className="stat-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="stat-label">{label}</div>
        {icon && <span style={{ fontSize: 16, opacity: 0.5 }}>{icon}</span>}
      </div>
      <div className="stat-value" style={{ color: color || 'var(--fg)' }}>{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

// ── BADGE ────────────────────────────────────────────────────────────────────
interface BadgeProps {
  children: React.ReactNode;
  color?: string;
  bg?: string;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'gray';
  style?: React.CSSProperties;
}
export function Badge({ children, color, bg, variant, style }: BadgeProps) {
  return (
    <span
      className={`badge ${variant ? 'badge-' + variant : ''}`}
      style={{ ...(color ? { color } : {}), ...(bg ? { background: bg } : {}), ...style }}
    >
      {children}
    </span>
  );
}

// ── AVATAR ───────────────────────────────────────────────────────────────────
const COLORS = ['#5b6ef5','#9b6ef5','#06b6d4','#22c55e','#f59e0b','#f43f5e','#3b82f6','#a855f7','#ec4899','#14b8a6'];
interface AvatarProps { name: string; size?: number; src?: string; style?: React.CSSProperties; }
export function Avatar({ name, size = 32, src, style }: AvatarProps) {
  const idx = name ? name.charCodeAt(0) % COLORS.length : 0;
  const initials = (name || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  if (src) return <img src={src} alt={name} className="avatar" style={{ width: size, height: size, ...style }} />;
  return (
    <div className="avatar" style={{ width: size, height: size, fontSize: size * 0.36, background: COLORS[idx], ...style }}>
      {initials}
    </div>
  );
}

// ── SKELETON ─────────────────────────────────────────────────────────────────
interface SkeletonProps { height?: number | string; width?: number | string; count?: number; style?: React.CSSProperties; }
export function Skeleton({ height = 20, width = '100%', count = 1, style }: SkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="skeleton" style={{ height, width, marginBottom: count > 1 ? 8 : 0, ...style }} />
      ))}
    </>
  );
}

// ── EMPTY ────────────────────────────────────────────────────────────────────
interface EmptyProps { title: string; subtitle?: string; description?: string; hint?: string; icon?: string; action?: React.ReactNode; }
export function Empty({ title, subtitle, description, hint, icon = '📭', action }: EmptyProps) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <div className="empty-title">{title}</div>
      {(subtitle || description || hint) && <div className="empty-sub">{subtitle || description || hint}</div>}
      {action && <div style={{ marginTop: 12 }}>{action}</div>}
    </div>
  );
}

// ── MODAL ────────────────────────────────────────────────────────────────────
interface ModalProps { open: boolean; onClose: () => void; title?: string; maxWidth?: number; children: React.ReactNode; footer?: React.ReactNode; }
export function Modal({ open, onClose, title, maxWidth = 520, children, footer }: ModalProps) {
  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal-box" style={{ maxWidth, padding: 24, width: '100%', boxSizing: 'border-box' as const }}>
        {/* Mobile drag handle */}
        <div className="mobile-only" style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, marginTop: -8 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border-strong)' }} />
        </div>
        {title && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{title}</h2>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--fg-3)', fontSize: 22, lineHeight: 1,
              padding: '0 4px', borderRadius: 6, minHeight: 'auto',
            }}>×</button>
          </div>
        )}
        <div style={{ overflowY: 'auto', maxHeight: 'calc(80vh - 120px)' }}>
          {children}
        </div>
        {footer && <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>{footer}</div>}
      </div>
    </div>
  );
}
