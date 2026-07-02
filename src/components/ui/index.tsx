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

// ═════════════════════════════════════════════════════════════
// v10.2 — YANGI KOMPONENTLAR (StatCard, EmptyState, ikonkalar)
// Real iconlar: lucide-react + react-icons (emoji YO'Q)
// ═════════════════════════════════════════════════════════════
import { AreaChart, Area, ResponsiveContainer } from 'recharts';
import { TrendingUp, TrendingDown, Minus, Phone as PhoneIc, Globe, Users as UsersIc, ClipboardList } from 'lucide-react';
import { FaInstagram, FaTelegramPlane, FaWhatsapp, FaFacebookF, FaGoogle, FaWalking } from 'react-icons/fa';

// ── SOURCE / CHANNEL ICONLARI (real brend iconlar) ──────────
export const SOURCE_ICON_COLORS: Record<string, string> = {
  TELEGRAM: '#0088cc', INSTAGRAM: '#E1306C', WHATSAPP: '#25D366',
  FACEBOOK: '#1877F2', GOOGLE_ADS: '#4285F4', WEBSITE: '#8b5cf6',
  REFERRAL: '#10b981', WALKIN: '#f59e0b', CALL: '#06b6d4', OTHER: '#6b7194', WEB: '#8b5cf6',
};

export function SourceIcon({ source, size = 12 }: { source?: string; size?: number }) {
  const color = SOURCE_ICON_COLORS[source || ''] || 'var(--fg-3)';
  const p = { size, color, style: { flexShrink: 0 } as React.CSSProperties };
  switch (source) {
    case 'TELEGRAM':   return <FaTelegramPlane {...p} />;
    case 'INSTAGRAM':  return <FaInstagram {...p} />;
    case 'WHATSAPP':   return <FaWhatsapp {...p} />;
    case 'FACEBOOK':   return <FaFacebookF {...p} />;
    case 'GOOGLE_ADS': return <FaGoogle {...p} />;
    case 'WALKIN':     return <FaWalking {...p} />;
    case 'CALL':       return <PhoneIc size={size} color={color} />;
    case 'WEBSITE': case 'WEB': return <Globe size={size} color={color} />;
    case 'REFERRAL':   return <UsersIc size={size} color={color} />;
    default:           return <ClipboardList size={size} color={color} />;
  }
}

// ── STAT CARD (sparkline + foizli o'zgarish) ─────────────────
interface StatCardProps {
  label: string;
  value: React.ReactNode;
  color?: string;
  sub?: string;
  icon?: React.ReactNode;          // lucide icon element
  series?: number[];               // sparkline uchun raqamlar (ixtiyoriy)
  delta?: number | null;           // % o'zgarish; berilmasa series'dan hisoblanadi
  emphasis?: boolean;              // eng muhim metrika kattaroq ko'rinadi
  onClick?: () => void;
}
export function StatCard({ label, value, color = 'var(--fg)', sub, icon, series, delta, emphasis, onClick }: StatCardProps) {
  // Delta: berilmagan bo'lsa oxirgi ikki nuqtadan hisoblaymiz
  let d = delta;
  if (d === undefined && series && series.length >= 2) {
    const prev = series[series.length - 2];
    const cur = series[series.length - 1];
    d = prev !== 0 ? Math.round(((cur - prev) / Math.abs(prev)) * 100) : (cur > 0 ? 100 : 0);
  }
  const deltaColor = d == null ? 'var(--fg-3)' : d > 0 ? '#10b981' : d < 0 ? '#ef4444' : 'var(--fg-3)';
  const chartData = (series || []).map((v, i) => ({ i, v }));
  const gid = 'sg-' + label.replace(/[^a-zA-Z0-9]/g, '');

  return (
    <div onClick={onClick} style={{
      padding: emphasis ? '18px 20px' : '14px 16px',
      background: 'var(--bg-2)', borderRadius: 12,
      border: emphasis ? `1px solid ${color}55` : '1px solid var(--border)',
      position: 'relative', overflow: 'hidden',
      cursor: onClick ? 'pointer' : 'default',
      ...(emphasis ? { boxShadow: `0 0 0 1px ${color}22, 0 8px 24px ${color}14` } : {}),
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 0.4, fontWeight: 600 }}>{label}</span>
        {icon && <span style={{ color, opacity: 0.7, display: 'inline-flex' }}>{icon}</span>}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: emphasis ? 28 : 21, fontWeight: 800, color, letterSpacing: -0.5, lineHeight: 1.1 }}>{value}</span>
        {d != null && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, color: deltaColor, background: `${deltaColor === 'var(--fg-3)' ? 'transparent' : deltaColor + '18'}`, padding: '1px 6px', borderRadius: 8 }}>
            {d > 0 ? <TrendingUp size={11} /> : d < 0 ? <TrendingDown size={11} /> : <Minus size={11} />}
            {d > 0 ? '+' : ''}{d}%
          </span>
        )}
      </div>
      {sub && <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>{sub}</div>}
      {chartData.length >= 2 && (
        <div style={{ position: 'absolute', right: 0, bottom: 0, left: 0, height: emphasis ? 42 : 32, opacity: 0.5, pointerEvents: 'none' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#${gid})`} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ── EMPTY STATE (real icon + CTA tugma) ──────────────────────
interface EmptyStateProps {
  icon?: React.ReactNode;          // lucide icon element (React node)
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}
export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 24px', textAlign: 'center' }}>
      {icon && (
        <div style={{
          width: 64, height: 64, borderRadius: 20, marginBottom: 16,
          background: 'var(--primary-soft, rgba(61,126,255,.1))', color: 'var(--primary, #3d7eff)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>{icon}</div>
      )}
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)', marginBottom: 6 }}>{title}</div>
      {description && <div style={{ fontSize: 13, color: 'var(--fg-3)', maxWidth: 320, lineHeight: 1.5 }}>{description}</div>}
      {actionLabel && onAction && (
        <button onClick={onAction} className="btn btn-primary btn-md" style={{ marginTop: 16 }}>{actionLabel}</button>
      )}
    </div>
  );
}

// ── CHECKBOX (bulk actions uchun) ────────────────────────────
export function Checkbox({ checked, onChange, indeterminate }: { checked: boolean; onChange: (v: boolean) => void; indeterminate?: boolean }) {
  return (
    <span
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
      style={{
        width: 17, height: 17, borderRadius: 5, cursor: 'pointer', flexShrink: 0,
        border: `1.5px solid ${checked || indeterminate ? 'var(--primary)' : 'var(--border-strong, var(--border))'}`,
        background: checked || indeterminate ? 'var(--primary)' : 'transparent',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all .12s',
      }}
    >
      {checked && <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
      {!checked && indeterminate && <span style={{ width: 8, height: 2, background: 'white', borderRadius: 1 }} />}
    </span>
  );
}