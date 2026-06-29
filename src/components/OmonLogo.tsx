'use client';

interface OmonLogoProps {
  size?: number;
  showText?: boolean;
  subtitle?: string;
}

// Logo rasmdan: 8 ta kapsul shaklidan tashkil topgan gul/yulduz simvoli
// Ranglar: #0d1b2e (orqa), #7ab8d4 dan #b8d8ea ga gradient
export function OmonLogoSvg({ size = 36 }: { size?: number }) {
  const uid = `omon_${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`${uid}_a`} x1="30%" y1="0%" x2="70%" y2="100%">
          <stop offset="0%" stopColor="#c8e6f5"/>
          <stop offset="50%" stopColor="#7ab8d4"/>
          <stop offset="100%" stopColor="#4a8fad"/>
        </linearGradient>
        <linearGradient id={`${uid}_b`} x1="0%" y1="30%" x2="100%" y2="70%">
          <stop offset="0%" stopColor="#b0d8ed"/>
          <stop offset="100%" stopColor="#5fa3c0"/>
        </linearGradient>
        <filter id={`${uid}_glow`}>
          <feGaussianBlur stdDeviation="1.5" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* 8 ta kapsul — har biri 45° da burilgan */}
      {/* Top */}
      <rect x="44" y="6" width="12" height="26" rx="6" fill={`url(#${uid}_a)`} opacity="0.95" filter={`url(#${uid}_glow)`}/>
      {/* Top-right */}
      <rect x="44" y="6" width="12" height="26" rx="6" fill={`url(#${uid}_b)`} opacity="0.85" transform="rotate(45 50 50)"/>
      {/* Right */}
      <rect x="44" y="6" width="12" height="26" rx="6" fill={`url(#${uid}_a)`} opacity="0.80" transform="rotate(90 50 50)"/>
      {/* Bottom-right */}
      <rect x="44" y="6" width="12" height="26" rx="6" fill={`url(#${uid}_b)`} opacity="0.75" transform="rotate(135 50 50)"/>
      {/* Bottom */}
      <rect x="44" y="6" width="12" height="26" rx="6" fill={`url(#${uid}_a)`} opacity="0.85" transform="rotate(180 50 50)"/>
      {/* Bottom-left */}
      <rect x="44" y="6" width="12" height="26" rx="6" fill={`url(#${uid}_b)`} opacity="0.80" transform="rotate(225 50 50)"/>
      {/* Left */}
      <rect x="44" y="6" width="12" height="26" rx="6" fill={`url(#${uid}_a)`} opacity="0.75" transform="rotate(270 50 50)"/>
      {/* Top-left */}
      <rect x="44" y="6" width="12" height="26" rx="6" fill={`url(#${uid}_b)`} opacity="0.90" transform="rotate(315 50 50)"/>

      {/* Markaziy aylana */}
      <circle cx="50" cy="50" r="6" fill={`url(#${uid}_a)`} opacity="0.9"/>
      <circle cx="50" cy="50" r="3.5" fill="#0d1b2e" opacity="0.6"/>
    </svg>
  );
}

export default function OmonLogo({ size = 36, showText = true, subtitle }: OmonLogoProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, userSelect: 'none' }}>
      <OmonLogoSvg size={size}/>
      {showText && (
        <div>
          <div style={{
            fontSize: Math.round(size * 0.44),
            fontWeight: 800,
            letterSpacing: -0.4,
            lineHeight: 1.1,
            fontFamily: "'Inter', sans-serif",
          }}>
            <span style={{ color: 'var(--fg)' }}>OMON</span>
            <span style={{
              background: 'linear-gradient(135deg, #7ab8d4, #4a8fad)',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}> CRM</span>
          </div>
          {subtitle && (
            <div style={{
              fontSize: Math.round(size * 0.27),
              color: 'var(--fg-3)',
              fontWeight: 500,
              marginTop: 1,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
            }}>{subtitle}</div>
          )}
        </div>
      )}
    </div>
  );
}
