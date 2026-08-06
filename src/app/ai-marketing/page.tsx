'use client';
import { useEffect, useRef, useState } from 'react';
import CrmLayout from '@/components/layout/CrmLayout';
import { aiMarketingApi, usersApi } from '@/services/api';
import { useAuth } from '@/lib/store';
import toast from 'react-hot-toast';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useI18n } from '@/lib/i18n';

/**
 * ═══════════════════════════════════════════════════════════════
 * AI REKLAMA GENERATORI — TurMaker uslubida
 * ═══════════════════════════════════════════════════════════════
 * Manager tur ma'lumotlarini kiritadi → chapda forma, o'ngda esa
 * HAQIQIY vaqtda (backendga so'rov yubormasdan) banner qanday
 * ko'rinishini oldindan ko'rsatadi. "Postlarni yaratish" bosilganda
 * Claude 3 ta tayyor matn yozadi, "Banner yaratish" bosilganda esa
 * chap tomondagi jonli preview'ning aynan o'zi — narxi, sanasi va
 * matni bilan — 1080×1080 PNG holida serverda tayyorlanadi.
 *
 * Tayyor bannerni: ⬇️ yuklab olish (haqiqiy fayl sifatida),
 * ✈️ Telegram kanaliga to'g'ridan-to'g'ri yuborish, yoki
 * 📤 telefon ulashish oynasi orqali (Instagram/Telegram/boshqa)
 * yuborish mumkin — Instagram'ga DASTURIY avtomatik joylash Meta
 * cheklovi tufayli hali mumkin emas (pastda tushuntirilgan), shu
 * sabab eng ishonchli yechim — ulashish oynasi.
 */

const checkboxRow: any = {
  display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--fg)',
  padding: '8px 12px', borderRadius: 999, border: '1px solid var(--border)',
  background: 'var(--bg-3)', cursor: 'pointer', userSelect: 'none', transition: 'all .14s',
};

const emptyForm = {
  destination: '',
  hotelName: '',
  hotelStars: 5,
  mealPlan: 'All Inclusive',
  nights: 7,
  adults: 2,
  children: 0,
  price: '',
  currency: 'USD',
  departureDate: '',
  returnDate: '',
  includesVisa: false,
  includesFlights: true,
  includesMeals: true,
  includesTransfer: true,
  includesInsurance: false,
  imageUrl: '',
  agencyName: '',
  agencyContact: '',
  adLanguage: 'uz' as 'uz' | 'ru', // reklama MATNI tili — ilova tilidan mustaqil
  extraTexts: [] as string[], // bannerga qo'shimcha urg'u matnlari (masalan "Bepul transfer!")

  hotels: [] as Array<{ name: string; stars?: number; price: string }>, // ko'p mehmonxona/narx solishtirish
  showHotelList: false,

  textColor: '#FFFFFF',
  fontFamily: 'sans-serif',
  overlayDarkness: 0.82,
  borderColor: '',
  borderWidth: 0,

  // Banner o'lchami ("square" = Instagram post/Facebook, "story" = Instagram/Telegram Story)
  bannerFormat: 'square' as 'square' | 'story',
  // Tayyor dizayn uslubi ("classic" | "minimal" | "bold")
  bannerTheme: 'classic' as 'classic' | 'minimal' | 'bold',
  // v14.3: "✨ TUR TAKLIFI" nishonini alohida yoqib/o'chirish (temadan mustaqil)
  showBadge: true,

  // Erkin joylashtirish — har bir ELEMENTNING (bittalab, bir-biridan
  // mustaqil) standart joyidan foiz (%) siljishi. 0/0 = standart joy
  // (hech narsa sudralmagan).
  layout: {
    badge: { dx: 0, dy: 0 },
    chips: { dx: 0, dy: 0 },
    stars: { dx: 0, dy: 0 },
    title: { dx: 0, dy: 0 },
    hotel: { dx: 0, dy: 0 },
    info: { dx: 0, dy: 0 },
    price: { dx: 0, dy: 0 },
    date: { dx: 0, dy: 0 },
    footer: { dx: 0, dy: 0 },
    logo: { dx: 0, dy: 0 },
  } as Record<'badge' | 'chips' | 'stars' | 'title' | 'hotel' | 'info' | 'price' | 'date' | 'footer' | 'logo', { dx: number; dy: number }>,
};

/**
 * Eski (4 ta guruh: header/price/footer/logo) formatda saqlangan tarix
 * yozuvlari bilan orqaga moslik uchun — `header` ostida saqlangan siljish
 * endi shu guruhga kirgan barcha yangi, mayda elementlarga (badge, chips,
 * stars, title, hotel, info) qo'llanadi, `price`/`footer`/`logo` esa
 * o'zgarishsiz ko'chadi. Yangi formatdagi yozuvlar uchun bu funksiya
 * hech narsani o'zgartirmaydi (faqat noma'lum `header` kaliti bo'lsa ishga tushadi).
 */
function normalizeLegacyLayout(layout: any): Record<LayoutKey, LayoutOffset> {
  const base: Record<LayoutKey, LayoutOffset> = {
    badge: { dx: 0, dy: 0 }, chips: { dx: 0, dy: 0 }, stars: { dx: 0, dy: 0 },
    title: { dx: 0, dy: 0 }, hotel: { dx: 0, dy: 0 }, info: { dx: 0, dy: 0 },
    price: { dx: 0, dy: 0 }, date: { dx: 0, dy: 0 },
    footer: { dx: 0, dy: 0 }, logo: { dx: 0, dy: 0 },
  };
  if (!layout) return base;
  const merged = { ...base, ...layout };
  if (layout.header && !layout.badge && !layout.title) {
    (['badge', 'chips', 'stars', 'title', 'hotel', 'info'] as const).forEach((k) => {
      merged[k] = layout.header;
    });
  }
  if (layout.price && !layout.date) {
    merged.date = layout.price;
  }
  return merged;
}

function copyToClipboard(text: string, label: string, t: (key: string) => string) {
  navigator.clipboard.writeText(text)
    .then(() => toast.success(`${label} ${t('aimkt.copied')}`))
    .catch(() => toast.error(t('aimkt.copyFailed')));
}

/** Bannerni haqiqiy fayl sifatida yuklab beradi (shunchaki yangi tabda ochish emas). */
async function forceDownload(url: string, filename: string): Promise<boolean> {
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error('fetch failed');
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objUrl), 4000);
    return true;
  } catch {
    // CORS yoki tarmoq xatosi — hech bo'lmasa yangi tabda ochamiz,
    // shundan foydalanuvchi "Rasm sifatida saqlash" qila oladi
    window.open(url, '_blank');
    return false;
  }
}

/**
 * Telefon/brauzerning tabiiy "ulashish" oynasini ochadi — Instagram,
 * Telegram, WhatsApp va boshqa o'rnatilgan ilovalar shu yerda chiqadi.
 * Bu — Instagram'ga DASTURIY avtomatik joylashning (Meta ruxsati yo'qligi
 * sababli) eng yaqin, ishlaydigan muqobili: rasm+matn haqiqatan ham
 * tanlangan ilovaga (masalan Instagram Stories) o'tadi.
 */
async function shareBanner(url: string, caption: string): Promise<'shared' | 'shared-link' | 'unsupported'> {
  const nav: any = typeof navigator !== 'undefined' ? navigator : null;
  if (!nav) return 'unsupported';
  try {
    const res = await fetch(url, { mode: 'cors' });
    const blob = await res.blob();
    const file = new File([blob], 'tur-banner.png', { type: blob.type || 'image/png' });
    if (nav.canShare && nav.canShare({ files: [file] })) {
      await nav.share({ files: [file], text: caption, title: 'Tur reklamasi' });
      return 'shared';
    }
  } catch {
    /* rasm bilan ulashib bo'lmadi — pastda matn+havola bilan urinamiz */
  }
  if (nav.share) {
    try {
      await nav.share({ text: caption, url, title: 'Tur reklamasi' });
      return 'shared-link';
    } catch {
      /* foydalanuvchi bekor qildi yoki qo'llab-quvvatlanmaydi */
    }
  }
  return 'unsupported';
}

function fmtPrice(price: any, currency: string) {
  const n = Number(price);
  if (!n) return '';
  return `${Math.round(n).toLocaleString('ru-RU')} ${currency || 'USD'}`;
}

/**
 * TurMaker "matn HTML, Markdown va oddiy formatda" imkoniyatiga o'xshab —
 * AI yozgan bitta matnni uch xil chiqish formatida ko'rsatish/nusxalash
 * imkonini beradi (backendga qayta so'rov yubormasdan, faqat ko'rinishni
 * o'zgartiradi — mazmun bir xil qoladi).
 */
type TextFormat = 'plain' | 'markdown' | 'html';
function formatPostText(text: string, format: TextFormat): string {
  const t = text || '';
  if (format === 'plain') return t;
  if (format === 'markdown') {
    // Emoji-bullet qatorlarni Markdown ro'yxatiga, birinchi qatorni sarlavhaga aylantiramiz
    const lines = t.split('\n');
    return lines
      .map((line, i) => (i === 0 && line.trim() ? `**${line.trim()}**` : line))
      .join('\n');
  }
  // html
  const esc = (s: string) => s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const paragraphs = t.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`);
  return paragraphs.join('\n');
}

// ── Jonli banner preview — backenddagi buildBannerSvg bilan bir xil tarkib ──
// HAR BIR element (eyebrow, urg'u chiplari, yulduzlar, sarlavha, mehmonxona
// nomi, info qatori, narx, sana, footer, logo) BIR-BIRIDAN MUSTAQIL sudraladi.
type LayoutKey = 'badge' | 'chips' | 'stars' | 'title' | 'hotel' | 'info' | 'price' | 'date' | 'footer' | 'logo';
type LayoutOffset = { dx: number; dy: number };

function LivePreview({
  form, template, generatedUrl, editMode, onLayoutChange, t,
}: {
  form: any; template: any; generatedUrl?: string;
  editMode?: boolean;
  onLayoutChange?: (key: LayoutKey, dx: number, dy: number) => void;
  t: (key: string) => string;
}) {
  const accent = /^#[0-9a-fA-F]{3,8}$/.test(template?.primaryColor) ? template.primaryColor : '#FF6A2B';
  const isRu = form.adLanguage === 'ru';
  const L = isRu
    ? { nights: 'ночей', adults: 'взрослых', child: 'ребёнок', offer: 'ТУР ПРЕДЛОЖЕНИЕ' }
    : { nights: 'kecha', adults: 'kattalar', child: 'bola', offer: 'TUR TAKLIFI' };
  const stars = form.hotelStars ? '★'.repeat(Math.max(0, Math.min(5, Number(form.hotelStars)))) : '';
  const infoParts = [
    form.nights ? `${form.nights} ${L.nights}` : null,
    form.mealPlan || null,
    (form.adults || form.children)
      ? `${form.adults || 1} ${L.adults}${form.children ? ` + ${form.children} ${L.child}` : ''}`
      : null,
  ].filter(Boolean);
  const dateLine = form.departureDate
    ? `${form.departureDate}${form.returnDate ? ` — ${form.returnDate}` : ''}`
    : '';
  const footer = [form.agencyName || template?.agencyName, form.agencyContact || template?.agencyContact]
    .filter(Boolean).join('   •   ');
  const priceText = fmtPrice(form.price, form.currency);
  const bg = form.imageUrl || generatedUrl;
  const fontFamily = form.fontFamily || 'sans-serif';
  const textColor = /^#[0-9a-fA-F]{3,8}$/.test(form.textColor || '') ? form.textColor : '#FFFFFF';
  const darkness = Math.max(0.3, Math.min(0.95, Number(form.overlayDarkness) || 0.82));
  const validHotels = (form.hotels || []).filter((h: any) => h.name?.trim() && Number(h.price) > 0);
  const useHotelList = form.showHotelList && validHotels.length > 1;
  const logoUrl = template?.logoUrl as string | undefined;

  // ── Erkin joylashtirish: konteyner o'lchamini kuzatib turamiz (px),
  // shunda foiz (%) siljishlarni to'g'ri pikselga aylantira olamiz ──
  const containerRef = useRef<HTMLDivElement>(null);
  const [boxPx, setBoxPx] = useState(0);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (w) setBoxPx(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout: Record<LayoutKey, LayoutOffset> = form.layout || {};
  const offOf = (key: LayoutKey): LayoutOffset => layout[key] || { dx: 0, dy: 0 };
  const pxOf = (pct: number) => (Number(pct) || 0) / 100 * boxPx;
  const translateOf = (key: LayoutKey) => {
    const o = offOf(key);
    return `translate(${pxOf(o.dx).toFixed(1)}px, ${pxOf(o.dy).toFixed(1)}px)`;
  };

  // Sudrash holati — pointermove/up butun konteynerda tinglanadi
  const dragRef = useRef<{ key: LayoutKey; startX: number; startY: number; origDx: number; origDy: number } | null>(null);

  const beginDrag = (key: LayoutKey) => (e: React.PointerEvent) => {
    if (!editMode || !onLayoutChange) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    const o = offOf(key);
    dragRef.current = { key, startX: e.clientX, startY: e.clientY, origDx: o.dx || 0, origDy: o.dy || 0 };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || !boxPx) return;
    const dxPct = ((e.clientX - d.startX) / boxPx) * 100;
    const dyPct = ((e.clientY - d.startY) / boxPx) * 100;
    onLayoutChange?.(d.key, d.origDx + dxPct, d.origDy + dyPct);
  };
  const endDrag = () => { dragRef.current = null; };

  const handleStyle = (active: boolean): React.CSSProperties => editMode ? {
    cursor: 'move', touchAction: 'none',
    outline: active ? `1.5px dashed ${accent}` : '1px dashed rgba(255,255,255,0.35)',
    outlineOffset: 4, borderRadius: 8,
  } : {};

  return (
    <div
      ref={containerRef}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerLeave={endDrag}
      style={{
        position: 'relative', width: '100%', aspectRatio: form.bannerFormat === 'story' ? '9 / 16' : '1 / 1', borderRadius: 16,
        overflow: 'hidden', border: form.borderWidth > 0 ? `${Math.min(form.borderWidth, 12)}px solid ${form.borderColor || accent}` : '1px solid var(--border)',
        background: bg ? '#111' : 'var(--gradient)', boxShadow: 'var(--shadow)', fontFamily,
      }}>
      {bg ? (
        <img src={bg} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 8, color: 'rgba(255,255,255,0.85)',
        }}>
          <div style={{ fontSize: 44 }}>🏝️</div>
          <div style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.85 }}>{t('aimkt.noImageSelected')}</div>
        </div>
      )}

      {/* Pastki qorong'ilashuv — matn o'qilishi uchun (qorong'ilik darajasi sozlanadi) */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,${(darkness * 0.18).toFixed(2)}) 55%, rgba(0,0,0,${darkness.toFixed(2)}) 100%)`,
      }} />

      <div style={{ position: 'absolute', left: '6%', right: '6%', bottom: '5%', color: '#fff' }}>
        {/* ── Har biri MUSTAQIL sudraladigan alohida elementlar (guruhlanmagan) ──
            "minimal" temasida nishon/chiplar ko'rsatilmaydi (backend bilan bir xil) */}
        {form.bannerTheme !== 'minimal' && form.showBadge !== false && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 9 }}>
          <div
            onPointerDown={beginDrag('badge')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 'clamp(8.5px,1.7vw,10.5px)',
              fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase',
              color: form.bannerTheme === 'bold' ? '#fff' : accent,
              background: form.bannerTheme === 'bold' ? accent : 'rgba(255,255,255,0.12)',
              border: `1px solid ${accent}55`, backdropFilter: 'blur(6px)',
              padding: '3px 9px', borderRadius: 999,
              transform: translateOf('badge'), ...handleStyle(!!dragRef.current && dragRef.current.key === 'badge'),
            }}
          >
            ✨ {L.offer}
          </div>
          {(form.extraTexts || []).filter(Boolean).length > 0 && (
            <div
              onPointerDown={beginDrag('chips')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
                transform: translateOf('chips'), ...handleStyle(!!dragRef.current && dragRef.current.key === 'chips'),
              }}
            >
              {(form.extraTexts || []).filter(Boolean).slice(0, 4).map((txt: string, i: number) => (
                <div key={i} style={{
                  fontSize: 'clamp(8.5px,1.7vw,10.5px)', fontWeight: 700, color: '#fff',
                  background: accent, padding: '3px 10px', borderRadius: 999,
                }}>{txt}</div>
              ))}
            </div>
          )}
        </div>
        )}

        {stars && (
          <div
            onPointerDown={beginDrag('stars')}
            style={{
              color: '#FFD54A', fontWeight: 700, fontSize: 'clamp(11px,2.4vw,14px)', letterSpacing: 2, marginBottom: 5,
              display: 'inline-block', transform: translateOf('stars'), ...handleStyle(!!dragRef.current && dragRef.current.key === 'stars'),
            }}
          >{stars}</div>
        )}

        <div
          onPointerDown={beginDrag('title')}
          style={{
            fontWeight: 800, fontSize: 'clamp(19px,4.6vw,29px)', lineHeight: 1.14, letterSpacing: '-0.01em',
            textShadow: '0 2px 12px rgba(0,0,0,0.45)', color: textColor,
            transform: translateOf('title'), ...handleStyle(!!dragRef.current && dragRef.current.key === 'title'),
          }}
        >
          {form.destination || t('aimkt.enterDestinationPlaceholder')}
        </div>

        {form.hotelName && !useHotelList && (
          <div
            onPointerDown={beginDrag('hotel')}
            style={{
              fontWeight: 600, fontSize: 'clamp(12px,2.6vw,15.5px)', marginTop: 4, color: textColor, opacity: 0.94,
              display: 'inline-block', transform: translateOf('hotel'), ...handleStyle(!!dragRef.current && dragRef.current.key === 'hotel'),
            }}
          >{form.hotelName}</div>
        )}

        {infoParts.length > 0 && (
          <div
            onPointerDown={beginDrag('info')}
            style={{
              fontSize: 'clamp(10px,2.1vw,12.5px)', marginTop: 6, color: textColor, opacity: 0.85, fontWeight: 500,
              display: 'inline-block', transform: translateOf('info'), ...handleStyle(!!dragRef.current && dragRef.current.key === 'info'),
            }}
          >{infoParts.join('   ·   ')}</div>
        )}

        {/* ── Narx / sana / mehmonxonalar ro'yxati — HAR BIRI alohida sudraladi ── */}
        {useHotelList ? (
          <div
            onPointerDown={beginDrag('price')}
            style={{
              marginTop: 13, display: 'flex', flexDirection: 'column', gap: 6,
              transform: translateOf('price'), ...handleStyle(!!dragRef.current && dragRef.current.key === 'price'),
            }}
          >
            {validHotels.slice(0, 3).map((h: any, i: number) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                background: 'rgba(255,255,255,0.10)', borderRadius: 10, padding: '8px 12px',
              }}>
                <span style={{ fontSize: 'clamp(11px,2.3vw,14px)', fontWeight: 700, color: textColor }}>
                  {h.name}{h.stars ? <span style={{ color: '#FFD54A' }}> {'★'.repeat(Math.min(5, Number(h.stars)))}</span> : null}
                </span>
                <span style={{
                  background: accent, color: '#fff', fontWeight: 800, padding: '5px 12px', borderRadius: 999,
                  fontSize: 'clamp(10px,2.1vw,13px)', whiteSpace: 'nowrap',
                }}>{fmtPrice(h.price, form.currency)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ marginTop: 13, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            {priceText ? (
              <span
                onPointerDown={beginDrag('price')}
                style={{
                  background: accent, color: '#fff', fontWeight: 800, padding: '9px 16px', borderRadius: 12,
                  fontSize: 'clamp(13px,2.9vw,19px)', letterSpacing: '-0.01em', whiteSpace: 'nowrap',
                  boxShadow: `0 8px 20px -6px ${accent}99`, flexShrink: 0,
                  transform: translateOf('price'), ...handleStyle(!!dragRef.current && dragRef.current.key === 'price'),
                }}
              >{priceText}</span>
            ) : <span />}
            {dateLine && (
              <span
                onPointerDown={beginDrag('date')}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
                  fontSize: 'clamp(9.5px,2vw,11.5px)', fontWeight: 600, color: '#fff',
                  background: 'rgba(255,255,255,0.14)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                  border: '1px solid rgba(255,255,255,0.18)', padding: '7px 11px', borderRadius: 999,
                  transform: translateOf('date'), ...handleStyle(!!dragRef.current && dragRef.current.key === 'date'),
                }}
              >📅 {dateLine}</span>
            )}
          </div>
        )}

        {/* ── Footer (agentlik/kontakt) — alohida sudraladi ── */}
        {footer && (
          <div
            onPointerDown={beginDrag('footer')}
            style={{ transform: translateOf('footer'), ...handleStyle(!!dragRef.current && dragRef.current.key === 'footer') }}
          >
            <div style={{ height: 1, background: 'rgba(255,255,255,0.16)', margin: '11px 0 8px' }} />
            <div style={{ fontSize: 'clamp(8.5px,1.8vw,11px)', color: '#c8ccd6', fontWeight: 500 }}>{footer}</div>
          </div>
        )}
      </div>

      {/* ── Brend logotipi — standart: yuqori-o'ng burchak, alohida sudraladi ── */}
      {logoUrl && (
        <div
          onPointerDown={beginDrag('logo')}
          style={{
            position: 'absolute', top: '5.6%', right: '5.6%', width: '11%', aspectRatio: '1/1',
            transform: translateOf('logo'), borderRadius: 10, overflow: 'hidden',
            background: 'rgba(255,255,255,0.14)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            ...handleStyle(!!dragRef.current && dragRef.current.key === 'logo'),
          }}
        >
          <img src={logoUrl} alt="Logo" style={{ width: '82%', height: '82%', objectFit: 'contain' }} />
        </div>
      )}

      {generatedUrl && (
        <span className="badge badge-success" style={{ position: 'absolute', top: 10, right: 10 }}>✓ {t('aimkt.bannerReadyBadge')}</span>
      )}
      {form.bannerTheme === 'bold' && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '0.8%', background: accent }} />
      )}
      {!generatedUrl && !editMode && (
        <span className="badge badge-gray" style={{ position: 'absolute', top: 10, right: 10 }}>{t('aimkt.livePreview')}</span>
      )}
      {editMode && (
        <span className="badge badge-gray" style={{ position: 'absolute', top: 10, left: 10 }}>
          🖱 {t('aimkt.dragBlocksHint')}
        </span>
      )}
    </div>
  );
}

export default function AiMarketingPage() {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  const { t } = useI18n();
  const [form, setForm] = useState<any>(emptyForm);
  const [template, setTemplate] = useState<any>({ agencyName: '', agencyContact: '', primaryColor: '#FF6A2B' });
  const [templateOpen, setTemplateOpen] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // ── Erkin joylashtirish (drag & drop) — banner bloklarini jonli
  // preview'da sudrab, o'zi xohlagan joyga qo'yish uchun ──
  const [editMode, setEditMode] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [bannering, setBannering] = useState(false);
  // { images, posts } — posts HAR DOIM mavjud bo'ladi (bo'sh satrlar bilan
  // ham), chunki AI o'chiq bo'lganda ham foydalanuvchi caption'ni qo'lda
  // yozib, Telegram/Instagram/Facebook'ga yubora olishi kerak.
  const emptyPosts = { instagram: '', telegram: '', facebook: '' };
  const [result, setResult] = useState<any>({ posts: emptyPosts });
  const [bannerUrl, setBannerUrl] = useState<string>('');

  const [tgChatId, setTgChatId] = useState('');
  const [sendingTg, setSendingTg] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState<'instagram' | 'telegram' | 'facebook'>('telegram');
  const [textFormat, setTextFormat] = useState<TextFormat>('plain');

  const [searchingImages, setSearchingImages] = useState(false);
  const [imageResults, setImageResults] = useState<string[]>([]);

  // ── Mehmonxona rasm kutubxonasi — agentlik biror mehmonxonaning O'ZINING
  // haqiqiy suratini bir marta yuklasa, keyingi safar shu nom yozilganda
  // avtomatik ko'rsatiladi (stok-fotodan ko'ra ancha ishonchli) ──
  const [hotelPhotos, setHotelPhotos] = useState<string[]>([]);
  const [uploadingHotelPhoto, setUploadingHotelPhoto] = useState(false);
  useEffect(() => {
    const hotelName = form.hotelName?.trim();
    if (!hotelName) { setHotelPhotos([]); return; }
    const t = setTimeout(() => {
      aiMarketingApi.getHotelPhotos(hotelName)
        .then((res: any) => setHotelPhotos(res.data || []))
        .catch(() => setHotelPhotos([]));
    }, 500); // yozib bo'lguncha kutamiz (har harfda so'rov yubormaslik uchun)
    return () => clearTimeout(t);
  }, [form.hotelName]);

  const doUploadHotelPhoto = async (file: File) => {
    const hotelName = form.hotelName?.trim();
    if (!hotelName) { toast.error(t('aimkt.enterHotelFirst')); return; }
    setUploadingHotelPhoto(true);
    try {
      const res = await aiMarketingApi.uploadHotelPhoto(hotelName, file);
      setHotelPhotos(res.data || []);
      toast.success(t('aimkt.hotelPhotoSaved'));
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('aimkt.uploadFailed'));
    } finally {
      setUploadingHotelPhoto(false);
    }
  };

  const doDeleteHotelPhoto = async (url: string) => {
    const hotelName = form.hotelName?.trim();
    if (!hotelName) return;
    try {
      const res = await aiMarketingApi.deleteHotelPhoto(hotelName, url);
      setHotelPhotos(res.data || []);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('aimkt.deleteFailed'));
    }
  };

  // ── Mashhur yo'nalishlar (davlat → joylar) — TurMaker uslubidagi
  // tanlagich, aniq joy nomi tanlansa rasm qidiruvi ancha aniqroq bo'ladi ──
  const [destinations, setDestinations] = useState<Array<{ country: string; countryUz: string; places: string[] }>>([]);
  const [destPickerOpen, setDestPickerOpen] = useState(false);
  useEffect(() => {
    aiMarketingApi.destinations().then((res: any) => setDestinations(res.data || [])).catch(() => {});
  }, []);

  const [sendingFb, setSendingFb] = useState(false);
  const [sendingAll, setSendingAll] = useState(false);
  const [savingHistory, setSavingHistory] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [staffList, setStaffList] = useState<any[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [useTelegramTemplate, setUseTelegramTemplate] = useState(false);
  const [telegramTemplatePreview, setTelegramTemplatePreview] = useState('');
  const [loadingTgPreview, setLoadingTgPreview] = useState(false);

  // ── Shablonni yuklash ──
  useEffect(() => {
    aiMarketingApi.getTemplate()
      .then(r => {
        const t = r.data || {};
        setTemplate(t);
        setTgChatId(t.telegramChatId || '');
      })
      .catch(() => {});
    // Xodimlar ro'yxati — bannerga kimning kontakti chiqishini tanlash uchun
    usersApi.list()
      .then(r => setStaffList((r.data || []).filter((u: any) => u.phone || u.name)))
      .catch(() => {});
  }, []);

  const pickStaff = (id: string) => {
    setSelectedStaffId(id);
    const staff = staffList.find((s: any) => s.id === id);
    if (staff) {
      setForm((f: any) => ({ ...f, agencyName: staff.name || f.agencyName, agencyContact: staff.phone || f.agencyContact }));
    }
  };

  const previewTelegramTemplate = async () => {
    if (!form.destination.trim()) { toast.error(t('aimkt.enterDestinationFirst')); return; }
    setLoadingTgPreview(true);
    try {
      const res = await aiMarketingApi.renderTelegramTemplate(buildPayload());
      setTelegramTemplatePreview(res?.data?.text || '');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('aimkt.templatePreviewFailed'));
    } finally {
      setLoadingTgPreview(false);
    }
  };

  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const buildPayload = () => ({
    destination: form.destination.trim(),
    hotelName: form.hotelName.trim() || undefined,
    hotelStars: Number(form.hotelStars) || undefined,
    mealPlan: form.mealPlan || undefined,
    nights: Number(form.nights) || undefined,
    adults: Number(form.adults) || undefined,
    children: Number(form.children) || undefined,
    price: Number(form.price),
    currency: form.currency,
    departureDate: form.departureDate || undefined,
    returnDate: form.returnDate || undefined,
    includesVisa: form.includesVisa,
    includesFlights: form.includesFlights,
    includesMeals: form.includesMeals,
    includesTransfer: form.includesTransfer,
    includesInsurance: form.includesInsurance,
    imageUrl: form.imageUrl.trim() || undefined,
    agencyName: form.agencyName.trim() || undefined,
    agencyContact: form.agencyContact.trim() || undefined,
    adLanguage: form.adLanguage || 'uz',
    extraTexts: (form.extraTexts || []).map((t: string) => t.trim()).filter(Boolean),
    hotels: (form.hotels || [])
      .filter((h: any) => h.name?.trim() && Number(h.price) > 0)
      .map((h: any) => ({ name: h.name.trim(), stars: h.stars ? Number(h.stars) : undefined, price: Number(h.price) })),
    showHotelList: !!form.showHotelList,
    textColor: form.textColor || undefined,
    fontFamily: form.fontFamily || undefined,
    overlayDarkness: Number(form.overlayDarkness) || undefined,
    borderColor: form.borderWidth > 0 ? (form.borderColor || undefined) : undefined,
    borderWidth: Number(form.borderWidth) || undefined,
    bannerFormat: form.bannerFormat || 'square',
    bannerTheme: form.bannerTheme || 'classic',
    showBadge: form.showBadge !== false,
    layout: form.layout || undefined,
  });

  const validate = () => {
    if (!form.destination.trim()) { toast.error(t('aimkt.enterDestination')); return false; }
    if (!form.price || Number(form.price) <= 0) { toast.error(t('aimkt.enterValidPrice')); return false; }
    return true;
  };

  // ── Rasm avtomatik qidirish (Pexels/Unsplash) — mavjud /ai-marketing/images
  // endpointi. `queryOverride` berilsa (masalan "Mashhur yo'nalishlar"dan joy
  // tanlanganda), shu matn bo'yicha qidiradi — forma hali yangilanmagan
  // bo'lsa ham (setState asinxron) ESKI destination bilan qidirib
  // qolmasligi uchun. Berilmasa, joriy formadagi destination ishlatiladi. ──
  const doSearchImages = async (queryOverride?: string) => {
    const query = (queryOverride ?? form.destination).trim();
    if (!query) { toast.error(t('aimkt.enterDestinationFirst')); return; }
    setSearchingImages(true);
    setImageResults([]);
    try {
      const res = await aiMarketingApi.images(query, 20, form.hotelName?.trim() || undefined);
      const imgs: string[] = res.data || [];
      setImageResults(imgs);
      if (!imgs.length) toast(t('aimkt.noImagesFound'), { icon: 'ℹ️' });
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('aimkt.imageSearchFailed'));
    } finally {
      setSearchingImages(false);
    }
  };

  // ── 1-bosqich: post + rasm generatsiya (Claude'ni chaqiradi — AI o'chiq
  // bo'lsa ishlamaydi, lekin shu funksiya DOIM mavjud, faqat shu yerda
  // to'xtatiladi — sahifaning qolgan qismiga ta'sir qilmaydi) ──
  const doGenerate = async () => {
    if (user && !user.tenantAiEnabled) {
      toast.error(t('aimkt.aiDisabled'));
      return;
    }
    if (!validate()) return;
    setGenerating(true);
    setResult({ posts: emptyPosts });
    try {
      const res = await aiMarketingApi.generate(buildPayload());
      setResult(res.data);
      toast.success(t('aimkt.postsReady'));
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('aimkt.errorOccurred'));
    } finally {
      setGenerating(false);
    }
  };

  // ── 2-bosqich: banner generatsiya ──
  const doBanner = async () => {
    if (!validate()) return;
    setBannering(true);
    setBannerUrl('');
    try {
      const res = await aiMarketingApi.banner(buildPayload());
      setBannerUrl(res.data?.bannerUrl || '');
      toast.success(t('aimkt.bannerReady'));
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('aimkt.bannerFailed'));
    } finally {
      setBannering(false);
    }
  };

  // ── Shablonni saqlash ──
  const doSaveTemplate = async () => {
    setSavingTemplate(true);
    try {
      const res = await aiMarketingApi.saveTemplate({ ...template, telegramChatId: tgChatId || undefined });
      setTemplate(res.data);
      toast.success(t('aimkt.templateSaved'));
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('aimkt.templateSaveFailed'));
    } finally {
      setSavingTemplate(false);
    }
  };

  // ── Brend logotipi: yuklash / o'chirish ──
  const doUploadLogo = async (file: File) => {
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
      toast.error(t('aimkt.logoFormatError')); return;
    }
    setUploadingLogo(true);
    try {
      const res = await aiMarketingApi.uploadLogo(file);
      setTemplate(res.data);
      toast.success(t('aimkt.logoUploaded'));
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('aimkt.logoUploadFailed'));
    } finally {
      setUploadingLogo(false);
    }
  };
  const doRemoveLogo = async () => {
    setUploadingLogo(true);
    try {
      const res = await aiMarketingApi.removeLogo();
      setTemplate(res.data);
      toast.success(t('aimkt.logoRemoved'));
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('aimkt.deleteFailed'));
    } finally {
      setUploadingLogo(false);
    }
  };

  // ── Erkin joylashtirish: HAR BIR elementni bir-biridan mustaqil sudrab ko'chirish ──
  const updateLayout = (key: LayoutKey, dx: number, dy: number) => {
    setForm((f: any) => ({ ...f, layout: { ...(f.layout || {}), [key]: { dx, dy } } }));
  };
  const resetLayout = () => {
    setForm((f: any) => ({
      ...f,
      layout: {
        badge: { dx: 0, dy: 0 }, chips: { dx: 0, dy: 0 }, stars: { dx: 0, dy: 0 },
        title: { dx: 0, dy: 0 }, hotel: { dx: 0, dy: 0 }, info: { dx: 0, dy: 0 },
        price: { dx: 0, dy: 0 }, date: { dx: 0, dy: 0 },
        footer: { dx: 0, dy: 0 }, logo: { dx: 0, dy: 0 },
      },
    }));
    toast.success(t('aimkt.layoutReset'));
  };

  // ── Telegram kanaliga to'g'ridan-to'g'ri yuborish (bot orqali) ──
  const doSendTelegram = async () => {
    if (!bannerUrl) { toast.error(t('aimkt.createBannerFirst')); return; }
    if (!tgChatId.trim()) { toast.error(t('aimkt.enterChannelId')); return; }

    let caption = '';
    if (useTelegramTemplate) {
      caption = telegramTemplatePreview;
      if (!caption) {
        try {
          const res = await aiMarketingApi.renderTelegramTemplate(buildPayload());
          caption = res.data?.text || '';
          setTelegramTemplatePreview(caption);
        } catch { /* pastda umumiy xato ko'rsatiladi */ }
      }
    } else {
      caption = result?.posts?.telegram || '';
    }
    if (!caption) { toast.error(t('aimkt.createPostFirst')); return; }

    setSendingTg(true);
    try {
      await aiMarketingApi.sendTelegram({
        chatId: tgChatId.trim(),
        photoUrl: bannerUrl,
        caption,
      });
      toast.success(t('aimkt.sentToTelegram'));
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('aimkt.sendFailed'));
    } finally {
      setSendingTg(false);
    }
  };

  // ── Yuklab olish (haqiqiy fayl) ──
  const doDownload = async () => {
    if (!bannerUrl) { toast.error(t('aimkt.createBannerFirst')); return; }
    setDownloading(true);
    const ok = await forceDownload(bannerUrl, `tur-banner-${Date.now()}.png`);
    toast[ok ? 'success' : 'error'](ok ? t('aimkt.bannerDownloaded') : t('aimkt.autoDownloadFailed'));
    setDownloading(false);
  };

  // ── Telefon ulashish oynasi orqali yuborish (Instagram/Telegram/boshqa) ──
  const doShare = async () => {
    if (!bannerUrl) { toast.error(t('aimkt.createBannerFirst')); return; }
    const caption = result?.posts?.[activeTab] || '';
    setSharing(true);
    const status = await shareBanner(bannerUrl, caption);
    if (status === 'shared') toast.success(t('aimkt.sharedViaSheet'));
    else if (status === 'shared-link') toast.success(t('aimkt.linkShared'));
    else {
      toast(
        activeTab === 'instagram' ? t('aimkt.noDirectShareInstagram') : t('aimkt.shareUnsupported'),
        { icon: 'ℹ️' },
      );
      await forceDownload(bannerUrl, `tur-banner-${Date.now()}.png`);
    }
    setSharing(false);
  };

  // ── Facebook sahifasiga (Page) avtomatik joylash ──
  const doSendFacebook = async () => {
    if (!bannerUrl) { toast.error(t('aimkt.createBannerFirst')); return; }
    if (!result?.posts?.facebook) { toast.error(t('aimkt.createPostFirst')); return; }

    setSendingFb(true);
    try {
      await aiMarketingApi.sendFacebook({ photoUrl: bannerUrl, caption: result.posts.facebook });
      toast.success(t('aimkt.sentToFacebook'));
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('aimkt.sendFailed'));
    } finally {
      setSendingFb(false);
    }
  };

  // ── TurMaker uslubida: "bir tugma orqali barcha tarmoqlarga yuborish" —
  // Telegram (kanal ID kiritilgan bo'lsa) va Facebook (sahifa ulangan bo'lsa)
  // avtomatik yuboriladi, Instagram uchun esa (Meta cheklovi tufayli avtomatik
  // joylash mumkin emasligi sababli) telefon ulashish oynasi ochiladi.
  const doSendAll = async () => {
    if (!bannerUrl) { toast.error(t('aimkt.createBannerFirst')); return; }
    const posts = result?.posts || emptyPosts;
    if (!posts.telegram && !posts.facebook && !posts.instagram) {
      toast.error(t('aimkt.createPostsFirst'));
      return;
    }

    setSendingAll(true);
    const done: string[] = [];
    const failed: string[] = [];

    if (tgChatId.trim()) {
      try {
        let caption = '';
        if (useTelegramTemplate) {
          caption = telegramTemplatePreview;
          if (!caption) {
            const res = await aiMarketingApi.renderTelegramTemplate(buildPayload());
            caption = res.data?.text || '';
          }
        } else {
          caption = result.posts.telegram || '';
        }
        if (caption) {
          await aiMarketingApi.sendTelegram({ chatId: tgChatId.trim(), photoUrl: bannerUrl, caption });
          done.push('Telegram');
        }
      } catch {
        failed.push('Telegram');
      }
    }

    if (result.posts.facebook) {
      try {
        await aiMarketingApi.sendFacebook({ photoUrl: bannerUrl, caption: result.posts.facebook });
        done.push('Facebook');
      } catch {
        failed.push('Facebook');
      }
    }

    if (result.posts.instagram) {
      const status = await shareBanner(bannerUrl, result.posts.instagram);
      if (status === 'shared' || status === 'shared-link') done.push(`Instagram (${t('aimkt.viaShare')})`);
    }

    setSendingAll(false);
    if (done.length) toast.success(`${t('aimkt.sentPrefix')}: ${done.join(', ')}`);
    if (failed.length) toast.error(`${t('aimkt.notSentPrefix')}: ${failed.join(', ')} — ${t('aimkt.checkTabForReason')}`);
    if (!done.length && !failed.length) {
      toast(t('aimkt.nowhereSent'), { icon: 'ℹ️' });
    }
  };

  // ── Tarix: saqlash / ro'yxatni yuklash / bittasini ochish / o'chirish ──
  const doSaveHistory = async () => {
    const hasAnyCaption = Object.values(result?.posts || emptyPosts).some((v: any) => !!v);
    if (!bannerUrl && !hasAnyCaption) { toast.error(t('aimkt.createBannerOrPostFirst')); return; }
    setSavingHistory(true);
    try {
      await aiMarketingApi.saveHistory({
        input: buildPayload(),
        bannerUrl: bannerUrl || undefined,
        posts: result?.posts || undefined,
      });
      toast.success(t('aimkt.savedToHistory'));
      if (historyOpen) refreshHistory();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || t('aimkt.saveFailed'));
    } finally {
      setSavingHistory(false);
    }
  };

  const refreshHistory = async () => {
    setLoadingHistory(true);
    try {
      const res = await aiMarketingApi.listHistory();
      setHistoryItems(res.data || []);
    } catch {
      toast.error(t('aimkt.historyLoadFailed'));
    } finally {
      setLoadingHistory(false);
    }
  };

  const toggleHistory = () => {
    const next = !historyOpen;
    setHistoryOpen(next);
    if (next) refreshHistory();
  };

  const doLoadHistoryItem = (item: any) => {
    setForm((f: any) => ({
      ...f,
      ...item.input,
      // Eski (Story/tema qo'shilishidan oldingi) tarix yozuvlarida bu
      // maydonlar bo'lmasligi mumkin — shunday holatda standart qiymatga
      // qaytaramiz (aks holda ekrandagi eski tanlov bilan aralashib qolardi)
      bannerFormat: item.input?.bannerFormat || 'square',
      bannerTheme: item.input?.bannerTheme || 'classic',
      showBadge: item.input?.showBadge !== false,
      layout: normalizeLegacyLayout(item.input?.layout),
    }));
    setBannerUrl(item.bannerUrl || '');
    setResult({ posts: { ...emptyPosts, ...(item.posts || {}) } });
    setHistoryOpen(false);
    toast.success(item.bannerUrl ? t('aimkt.loadedExistingBanner') : t('aimkt.loadedEditable'));
  };

  const doDeleteHistoryItem = async (id: string) => {
    try {
      await aiMarketingApi.deleteHistoryItem(id);
      setHistoryItems((items) => items.filter((h) => h.id !== id));
    } catch {
      toast.error(t('aimkt.deleteFailed'));
    }
  };

  const addExtraText = () => {
    if ((form.extraTexts || []).length >= 4) { toast.error(t('aimkt.maxExtraTexts')); return; }
    setForm((f: any) => ({ ...f, extraTexts: [...(f.extraTexts || []), ''] }));
  };
  const updateExtraText = (i: number, v: string) => {
    setForm((f: any) => {
      const arr = [...(f.extraTexts || [])];
      arr[i] = v;
      return { ...f, extraTexts: arr };
    });
  };
  const removeExtraText = (i: number) => {
    setForm((f: any) => ({ ...f, extraTexts: (f.extraTexts || []).filter((_: string, idx: number) => idx !== i) }));
  };

  // ── Ko'p mehmonxona/narx solishtirish ──
  const addHotelRow = () => {
    if ((form.hotels || []).length >= 3) { toast.error(t('aimkt.maxHotels')); return; }
    setForm((f: any) => ({ ...f, hotels: [...(f.hotels || []), { name: '', stars: 5, price: '' }] }));
  };
  const updateHotelRow = (i: number, patch: any) => {
    setForm((f: any) => {
      const arr = [...(f.hotels || [])];
      arr[i] = { ...arr[i], ...patch };
      return { ...f, hotels: arr };
    });
  };
  const removeHotelRow = (i: number) => {
    setForm((f: any) => ({ ...f, hotels: (f.hotels || []).filter((_: any, idx: number) => idx !== i) }));
  };

  const platformMeta: Record<string, { label: string; icon: string }> = {
    telegram: { label: 'Telegram', icon: '✈️' },
    instagram: { label: 'Instagram', icon: '📸' },
    facebook: { label: 'Facebook', icon: '👍' },
  };

  // 🩹 TUZATISH (v38): ilgari shu yerda BUTUN SAHIFA (forma, mehmonxona
  // tanlash, banner yaratish, hammasi) `tenant.aiEnabled` o'chiq bo'lsa
  // butunlay bloklanardi. Bu NOTO'G'RI edi — chunki sahifadagi Claude
  // (AI) chaqiruvi FAQAT bitta joyda: "✨ Postlarni yaratish" tugmasi
  // (`doGenerate`, reklama matnini yozadi). Banner yaratish (`doBanner`)
  // esa Claude'ni UMUMAN chaqirmaydi — u dasturiy ravishda (Pexels rasm +
  // sharp/SVG) ishlaydi, token sarflamaydi. Shuning uchun endi butun
  // sahifa emas, FAQAT "Postlarni yaratish" tugmasi cheklanadi (pastda,
  // tugma joylashgan yerda) — qolgan hamma narsa (tur/mehmonxona
  // ma'lumotlari, banner yaratish, shablon, Telegram/Facebook'ga
  // yuborish) AI yoqiq-yo'qligidan qat'i nazar ishlayveradi.

  return (
    <CrmLayout>
      <div style={{ padding: isMobile ? '14px 12px' : 20, maxWidth: 1320, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 21, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                display: 'inline-flex', width: 34, height: 34, borderRadius: 10, background: 'var(--gradient)',
                alignItems: 'center', justifyContent: 'center', fontSize: 17,
              }}>✨</span>
              {t('aimkt.pageTitle')}
            </h1>
            <div style={{ fontSize: 12.5, color: 'var(--fg-2)', marginTop: 6 }}>
              {t('aimkt.pageSubtitle')}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-md btn-ghost" onClick={toggleHistory}>
              {historyOpen ? t('aimkt.closeHistory') : `🗂️ ${t('aimkt.history')}`}
            </button>
            <button className="btn btn-md btn-ghost" onClick={() => setTemplateOpen(o => !o)}>
              {templateOpen ? t('aimkt.closeTemplate') : `⚙️ ${t('aimkt.templateSettings')}`}
            </button>
          </div>
        </div>

        {/* ── Tarix (avval saqlangan reklamalar) ── */}
        {historyOpen && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
              {t('aimkt.savedAds')}
              <span style={{ fontSize: 11.5, fontWeight: 400, color: 'var(--fg-2)', marginLeft: 8 }}>
                — {t('aimkt.clickToReload')}
              </span>
            </div>
            {loadingHistory ? (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12.5 }}>{t('common.loading')}</div>
            ) : historyItems.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12.5 }}>
                {t('aimkt.noHistoryYet')}
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                {historyItems.map((item) => (
                  <div key={item.id} style={{
                    border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden',
                    background: 'var(--bg-3)', cursor: 'pointer',
                  }} onClick={() => doLoadHistoryItem(item)}>
                    {item.bannerUrl ? (
                      <img src={item.bannerUrl} alt="" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', display: 'block' }} />
                    ) : (
                      <div style={{ width: '100%', aspectRatio: '1/1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>📝</div>
                    )}
                    <div style={{ padding: '8px 10px' }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700 }}>{item.input?.destination || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>{fmtPrice(item.input?.price, item.input?.currency)}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); doDeleteHistoryItem(item.id); }}
                          className="btn btn-sm btn-ghost" style={{ padding: '2px 6px' }}
                        >🗑️</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Shablon sozlamalari ── */}
        {templateOpen && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
              {t('aimkt.agencyTemplate')}
              <span style={{ fontSize: 11.5, fontWeight: 400, color: 'var(--fg-2)', marginLeft: 8 }}>
                — {t('aimkt.agencyTemplateHint')}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{t('aimkt.agencyName')}</label>
                <input className="form-input" value={template.agencyName || ''}
                  onChange={e => setTemplate((t: any) => ({ ...t, agencyName: e.target.value }))} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{t('aimkt.agencyContact')}</label>
                <input className="form-input" value={template.agencyContact || ''}
                  onChange={e => setTemplate((t: any) => ({ ...t, agencyContact: e.target.value }))} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{t('aimkt.brandColor')}</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="color" value={template.primaryColor || '#FF6A2B'}
                    onChange={e => setTemplate((t: any) => ({ ...t, primaryColor: e.target.value }))}
                    style={{ width: 40, height: 36, borderRadius: 8, border: '1px solid var(--border)', padding: 0, background: 'none' }} />
                  <input className="form-input" value={template.primaryColor || '#FF6A2B'}
                    onChange={e => setTemplate((t: any) => ({ ...t, primaryColor: e.target.value }))} />
                </div>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{t('aimkt.defaultTelegramChannel')}</label>
                <input className="form-input" value={tgChatId} placeholder="@kanalim_yoki_id"
                  onChange={e => setTgChatId(e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">
                  {t('aimkt.brandLogo')}
                  <span style={{ fontWeight: 400, color: 'var(--fg-3)', marginLeft: 6 }}>
                    ({t('aimkt.brandLogoHint')})
                  </span>
                </label>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  {template.logoUrl && (
                    <img src={template.logoUrl} alt="Logo" style={{
                      width: 44, height: 44, borderRadius: 10, objectFit: 'contain',
                      background: 'var(--bg-3)', border: '1px solid var(--border)', flexShrink: 0,
                    }} />
                  )}
                  <input type="file" accept="image/png,image/jpeg,image/webp" id="ai-mkt-logo-input"
                    style={{ display: 'none' }}
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) doUploadLogo(f); e.target.value = ''; }} />
                  <button type="button" className="btn btn-sm btn-secondary" disabled={uploadingLogo}
                    onClick={() => document.getElementById('ai-mkt-logo-input')?.click()}>
                    {uploadingLogo ? '...' : template.logoUrl ? t('aimkt.replace') : `⬆️ ${t('aimkt.upload')}`}
                  </button>
                  {template.logoUrl && (
                    <button type="button" className="btn btn-sm btn-ghost" disabled={uploadingLogo} onClick={doRemoveLogo}>
                      ✕ {t('common.delete')}
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label className="form-label">
                {t('aimkt.brandVoice')}
                <span style={{ fontWeight: 400, color: 'var(--fg-3)', marginLeft: 6 }}>
                  ({t('aimkt.brandVoiceHint')})
                </span>
              </label>
              <textarea className="form-input" style={{ minHeight: 70, fontSize: 12.5 }}
                placeholder={t('aimkt.brandVoicePlaceholder')}
                value={template.brandVoice || ''}
                onChange={e => setTemplate((t: any) => ({ ...t, brandVoice: e.target.value }))} />
              <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 4 }}>
                {t('aimkt.brandVoiceNote')}
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label className="form-label">
                {t('aimkt.telegramTemplate')}
                <span style={{ fontWeight: 400, color: 'var(--fg-3)', marginLeft: 6 }}>
                  ({t('aimkt.telegramTemplateHint')})
                </span>
              </label>
              <textarea className="form-input" style={{ minHeight: 110, fontFamily: 'monospace', fontSize: 12.5 }}
                placeholder={"🌴 {destination}\n{hotel}\n\n📅 {dates} ({nights} kecha)\n👥 {people}\n🍽 {meal}\n\n💰 Narx: {price}\n\n📞 {agency} — {contact}"}
                value={template.telegramMessageTemplate || ''}
                onChange={e => setTemplate((t: any) => ({ ...t, telegramMessageTemplate: e.target.value }))} />
              <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 4 }}>
                {t('aimkt.availablePlaceholders')}: {'{destination} {hotel} {stars} {nights} {meal} {people} {price} {dates} {agency} {contact}'}
              </div>
            </div>
            <div style={{ marginTop: 12, textAlign: 'right' }}>
              <button className="btn btn-md btn-primary" disabled={savingTemplate} onClick={doSaveTemplate}>
                {savingTemplate ? t('aimkt.saving') : t('aimkt.saveTemplate')}
              </button>
            </div>
          </div>
        )}

        {/* ── Asosiy: forma (chap) + jonli preview (o'ng) ── */}
        <div className="grid-auto" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(300px, 1fr)', gap: 18, alignItems: 'start' }}>

          {/* ── CHAP: forma ── */}
          <div className="card">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <div className="form-group" style={{ gridColumn: 'span 2', margin: 0 }}>
                <label className="form-label" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>{t('aimkt.destination')} *</span>
                  {destinations.length > 0 && (
                    <button type="button" onClick={() => setDestPickerOpen(v => !v)}
                      style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}>
                      🌍 {t('aimkt.popularDestinations')} {destPickerOpen ? '▲' : '▼'}
                    </button>
                  )}
                </label>
                <input className="form-input" placeholder="Antalya, Turkiya" value={form.destination}
                  onChange={e => set('destination', e.target.value)} />
                {destPickerOpen && (
                  <div style={{
                    marginTop: 8, padding: 12, borderRadius: 12, border: '1px solid var(--border)',
                    background: 'var(--bg-3)', maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10,
                  }}>
                    {destinations.map((group) => (
                      <div key={group.country}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {group.countryUz}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {group.places.map((place) => (
                            <button key={place} type="button"
                              onClick={() => {
                                const dest = `${place}, ${group.countryUz}`;
                                set('destination', dest);
                                setDestPickerOpen(false);
                                toast.success(`${place} ${t('aimkt.placeSelectedSearching')}`);
                                // Joy tanlanishi bilan ZUDLIK BILAN o'sha joyga xos
                                // rasmlarni qidiramiz (foydalanuvchi endi qo'shimcha
                                // "🔍 Rasm topish" tugmasini bosishi shart emas).
                                // `place` (masalan "Antalya") ni beramiz, chunki
                                // backenddagi tanish-joy aniqlagichi ("matchKnownPlace")
                                // aynan shu inglizcha nom bo'yicha ishlaydi va eng
                                // aniq/mos rasmlarni shu orqali topadi.
                                doSearchImages(place);
                              }}
                              style={{
                                fontSize: 12, padding: '5px 11px', borderRadius: 999, border: '1px solid var(--border)',
                                background: form.destination.startsWith(place) ? 'var(--primary)' : 'var(--bg-2)',
                                color: form.destination.startsWith(place) ? '#fff' : 'var(--fg)',
                                cursor: 'pointer', fontWeight: 600,
                              }}
                            >{place}</button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2', margin: 0 }}>
                <label className="form-label">{t('aimkt.hotelName')}</label>
                <input className="form-input" placeholder="Rixos Premium" value={form.hotelName}
                  onChange={e => set('hotelName', e.target.value)} />
                {/* ── Mehmonxona rasm kutubxonasi — agentlikning O'ZI yuklagan
                    haqiqiy suratlari, mavjud bo'lsa avtomatik ko'rsatiladi ── */}
                {form.hotelName.trim() && (
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    {hotelPhotos.map((url, i) => (
                      <div key={i} style={{ position: 'relative', width: 52, height: 52, borderRadius: 8, overflow: 'hidden', border: form.imageUrl === url ? '2px solid var(--primary)' : '1px solid var(--border)' }}>
                        <img src={url} alt="" onClick={() => { set('imageUrl', url); toast.success(t('aimkt.imageSelected')); }}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} />
                        <button type="button" onClick={() => doDeleteHotelPhoto(url)}
                          title={t('aimkt.removeFromLibrary')}
                          style={{ position: 'absolute', top: 1, right: 1, width: 16, height: 16, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', fontSize: 9, cursor: 'pointer', lineHeight: '16px', padding: 0 }}>✕</button>
                      </div>
                    ))}
                    <label style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52,
                      borderRadius: 8, border: '1px dashed var(--border)', cursor: 'pointer', fontSize: 18,
                      color: 'var(--fg-muted)', flexShrink: 0,
                    }} title={t('aimkt.uploadOwnPhoto')}>
                      {uploadingHotelPhoto ? '…' : '+'}
                      <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploadingHotelPhoto}
                        onChange={(e) => { const f = e.target.files?.[0]; if (f) doUploadHotelPhoto(f); e.target.value = ''; }} />
                    </label>
                    {hotelPhotos.length > 0 && (
                      <span style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>🏨 {t('aimkt.savedPhotosHint')}</span>
                    )}
                  </div>
                )}
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{t('aimkt.stars')}</label>
                <select className="form-input" value={form.hotelStars} onChange={e => set('hotelStars', e.target.value)}>
                  {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} ★</option>)}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{t('aimkt.mealPlan')}</label>
                <input className="form-input" value={form.mealPlan} onChange={e => set('mealPlan', e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{t('aimkt.nights')}</label>
                <input className="form-input" type="number" min={1} value={form.nights}
                  onChange={e => set('nights', e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{t('aimkt.adults')}</label>
                <input className="form-input" type="number" min={1} value={form.adults}
                  onChange={e => set('adults', e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{t('aimkt.children')}</label>
                <input className="form-input" type="number" min={0} value={form.children}
                  onChange={e => set('children', e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{t('aimkt.price')} *</label>
                <input className="form-input" type="number" min={0} placeholder="699" value={form.price}
                  onChange={e => set('price', e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{t('aimkt.currency')}</label>
                <select className="form-input" value={form.currency} onChange={e => set('currency', e.target.value)}>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="UZS">UZS</option>
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{t('aimkt.departureDate')}</label>
                <input className="form-input" type="date" value={form.departureDate}
                  onChange={e => set('departureDate', e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{t('aimkt.returnDate')}</label>
                <input className="form-input" type="date" value={form.returnDate}
                  onChange={e => set('returnDate', e.target.value)} />
              </div>
            </div>

            {/* ── Rasm: qo'lda URL yoki avtomatik qidirish ── */}
            <div style={{ marginTop: 14 }}>
              <label className="form-label">{t('aimkt.backgroundImage')}</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="form-input" placeholder={t('aimkt.imageUrlPlaceholder')}
                  value={form.imageUrl} onChange={e => set('imageUrl', e.target.value)} />
                <button className="btn btn-md btn-secondary" style={{ flexShrink: 0 }}
                  disabled={searchingImages}
                  onClick={() => doSearchImages()}>
                  {searchingImages ? t('aimkt.searching') : `🔍 ${t('aimkt.findImage')}`}
                </button>
              </div>
              {imageResults.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                    {imageResults.length} {t('aimkt.variantsChooseOne')}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 8 }}>
                    {imageResults.map((img, i) => {
                      const selected = form.imageUrl === img;
                      return (
                        <button key={i} type="button"
                          onClick={() => { set('imageUrl', img); toast.success(t('aimkt.imageSelected')); }}
                          style={{
                            position: 'relative', padding: 0, aspectRatio: '1 / 1', borderRadius: 10, cursor: 'pointer',
                            overflow: 'hidden', background: 'none',
                            border: selected ? '2px solid var(--primary)' : '1px solid var(--border)',
                            boxShadow: selected ? '0 0 0 3px var(--primary-soft)' : 'none',
                            transition: 'all .14s',
                          }}>
                          <img src={img} alt="" style={{
                            width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                            opacity: selected ? 1 : 0.82, transition: 'opacity .14s',
                          }} />
                          {selected && (
                            <span style={{
                              position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: '50%',
                              background: 'var(--primary)', color: '#fff', fontSize: 11, fontWeight: 800,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
                            }}>✓</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16, marginBottom: 4 }}>
              {[
                { k: 'includesFlights', label: `✈️ ${t('aimkt.flights')}` },
                { k: 'includesMeals', label: `🍽️ ${t('aimkt.mealPlan')}` },
                { k: 'includesTransfer', label: `🚕 ${t('aimkt.transfer')}` },
                { k: 'includesVisa', label: `🛂 ${t('aimkt.visa')}` },
                { k: 'includesInsurance', label: `🛡️ ${t('aimkt.insurance')}` },
              ].map(({ k, label }) => (
                <label key={k} style={{
                  ...checkboxRow,
                  borderColor: (form as any)[k] ? 'var(--primary)' : 'var(--border)',
                  background: (form as any)[k] ? 'var(--primary-soft)' : 'var(--bg-3)',
                  color: (form as any)[k] ? 'var(--primary)' : 'var(--fg)',
                }}>
                  <input type="checkbox" checked={(form as any)[k]} onChange={e => set(k, e.target.checked)}
                    style={{ accentColor: 'var(--primary)' }} />
                  {label}
                </label>
              ))}
            </div>

            <div style={{ marginTop: 16 }}>
              <label className="form-label">{t('aimkt.adTextLanguage')}</label>
              <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 6 }}>
                ({t('aimkt.adTextLanguageHint')})
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => set('adLanguage', 'uz')}
                  className={`btn btn-sm ${form.adLanguage === 'uz' ? 'btn-primary' : 'btn-secondary'}`}>
                  O'zbek
                </button>
                <button type="button" onClick={() => set('adLanguage', 'ru')}
                  className={`btn btn-sm ${form.adLanguage === 'ru' ? 'btn-primary' : 'btn-secondary'}`}>
                  Русский
                </button>
              </div>
            </div>

            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label className="form-label" style={{ margin: 0 }}>{t('aimkt.extraTexts')}</label>
                <button type="button" className="btn btn-sm btn-ghost" onClick={addExtraText}>+ {t('common.add')}</button>
              </div>
              {(form.extraTexts || []).length === 0 ? (
                <div style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>
                  {t('aimkt.extraTextsHint')}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(form.extraTexts || []).map((txt: string, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: 8 }}>
                      <input className="form-input" value={txt} placeholder={t('aimkt.freeTransferExample')}
                        maxLength={24}
                        onChange={(e) => updateExtraText(i, e.target.value)} />
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => removeExtraText(i)}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {staffList.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <label className="form-label">{t('aimkt.whoseContactOnBanner')}</label>
                <select className="form-input" value={selectedStaffId} onChange={(e) => pickStaff(e.target.value)}>
                  <option value="">— {t('aimkt.agencyTemplateDefault')} —</option>
                  {staffList.map((s: any) => (
                    <option key={s.id} value={s.id}>{s.name}{s.phone ? ` — ${s.phone}` : ''}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label className="form-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" checked={!!form.showHotelList}
                    onChange={(e) => set('showHotelList', e.target.checked)}
                    style={{ accentColor: 'var(--primary)' }} />
                  {t('aimkt.compareHotels')}
                </label>
                <button type="button" className="btn btn-sm btn-ghost" onClick={addHotelRow}>+ {t('aimkt.hotel')}</button>
              </div>
              {(form.hotels || []).length === 0 ? (
                <div style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>
                  {t('aimkt.compareHotelsHint')}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(form.hotels || []).map((h: any, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: 8 }}>
                      <input className="form-input" style={{ flex: 2 }} value={h.name} placeholder={t('aimkt.hotelName')}
                        onChange={(e) => updateHotelRow(i, { name: e.target.value })} />
                      <select className="form-input" style={{ flex: 1 }} value={h.stars || 5}
                        onChange={(e) => updateHotelRow(i, { stars: e.target.value })}>
                        {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} ★</option>)}
                      </select>
                      <input className="form-input" style={{ flex: 1 }} type="number" value={h.price} placeholder={t('aimkt.price')}
                        onChange={(e) => updateHotelRow(i, { price: e.target.value })} />
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => removeHotelRow(i)}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, marginTop: 16 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{t('aimkt.bannerSize')}</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {([
                    { v: 'square', label: `⬛ ${t('aimkt.square')} (1080×1080)`, hint: 'Instagram post / Facebook' },
                    { v: 'story', label: `📱 ${t('aimkt.story')} (1080×1920)`, hint: 'Instagram / Telegram Story' },
                  ] as const).map((opt) => (
                    <button key={opt.v} type="button" title={opt.hint}
                      onClick={() => set('bannerFormat', opt.v)}
                      className={`btn btn-sm ${form.bannerFormat === opt.v ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ flex: 1, whiteSpace: 'nowrap' }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">{t('aimkt.designStyle')}</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {([
                    { v: 'classic', label: `✨ ${t('aimkt.classic')}` },
                    { v: 'minimal', label: `◻ ${t('aimkt.minimal')}` },
                    { v: 'bold', label: `🔶 ${t('aimkt.bold')}` },
                  ] as const).map((opt) => (
                    <button key={opt.v} type="button"
                      onClick={() => set('bannerTheme', opt.v)}
                      className={`btn btn-sm ${form.bannerTheme === opt.v ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ flex: 1 }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
                {/* v14.3: "TUR TAKLIFI" nishonini kerak bo'lmasa o'chirib qo'yish */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 8, fontSize: 12, color: 'var(--fg-2)', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={form.showBadge !== false}
                    onChange={(e) => set('showBadge', e.target.checked)}
                  />
                  ✨ {t('aimkt.showBadgeOnBanner')}
                </label>
              </div>
            </div>

            <details style={{ marginTop: 16 }}>
              <summary style={{ cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--fg-2)' }}>
                🎨 {t('aimkt.customizeDesign')}
              </summary>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 12 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{t('aimkt.font')}</label>
                  <select className="form-input" value={form.fontFamily} onChange={(e) => set('fontFamily', e.target.value)}>
                    <option value="sans-serif">Sans-serif ({t('aimkt.default')})</option>
                    <option value="serif">Serif</option>
                    <option value="monospace">Monospace</option>
                    <option value="Georgia, serif">Georgia</option>
                    <option value="'Trebuchet MS', sans-serif">Trebuchet</option>
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{t('aimkt.textColor')}</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="color" value={form.textColor} onChange={(e) => set('textColor', e.target.value)}
                      style={{ width: 40, height: 36, borderRadius: 8, border: '1px solid var(--border)', padding: 0, background: 'none' }} />
                    <input className="form-input" value={form.textColor} onChange={(e) => set('textColor', e.target.value)} />
                  </div>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{t('aimkt.overlayDarkness')} ({Math.round(form.overlayDarkness * 100)}%)</label>
                  <input type="range" min={0.3} max={0.95} step={0.01} value={form.overlayDarkness}
                    onChange={(e) => set('overlayDarkness', Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--primary)' }} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">{t('aimkt.borderWidth')} ({form.borderWidth}px)</label>
                  <input type="range" min={0} max={20} step={1} value={form.borderWidth}
                    onChange={(e) => set('borderWidth', Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--primary)' }} />
                </div>
                {form.borderWidth > 0 && (
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">{t('aimkt.borderColor')}</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input type="color" value={form.borderColor || template.primaryColor || '#FF6A2B'}
                        onChange={(e) => set('borderColor', e.target.value)}
                        style={{ width: 40, height: 36, borderRadius: 8, border: '1px solid var(--border)', padding: 0, background: 'none' }} />
                      <input className="form-input" value={form.borderColor} placeholder={t('aimkt.brandColorDefault')}
                        onChange={(e) => set('borderColor', e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
            </details>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'center', marginTop: 16, flexWrap: 'wrap' }}>
              <button className="btn btn-lg btn-secondary" disabled={bannering} onClick={doBanner}>
                {bannering ? t('aimkt.creatingBanner') : `🖼️ ${t('aimkt.createBanner')}`}
              </button>
              <button
                className="btn btn-lg btn-gradient"
                disabled={generating || (user && !user.tenantAiEnabled)}
                onClick={doGenerate}
                title={user && !user.tenantAiEnabled ? t('aimkt.aiDisabledTitle') : undefined}
                style={user && !user.tenantAiEnabled ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
              >
                {generating ? t('aimkt.creatingPosts') : (user && !user.tenantAiEnabled) ? `🤖🚫 ${t('aimkt.aiOff')}` : `✨ ${t('aimkt.createPosts')}`}
              </button>
            </div>
          </div>

          {/* ── O'NG: jonli preview + yuborish ── */}
          <div style={isMobile ? { display: 'flex', flexDirection: 'column', gap: 14 } : { position: 'sticky', top: 70, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className={`btn btn-sm ${editMode ? 'btn-primary' : 'btn-secondary'}`}
                style={{ flex: 1 }}
                onClick={() => setEditMode((v) => !v)}
              >
                {editMode ? `✓ ${t('aimkt.placementDone')}` : `🖱 ${t('aimkt.freePlacement')}`}
              </button>
              {editMode && (
                <button type="button" className="btn btn-sm btn-ghost" onClick={resetLayout}>
                  ↺ {t('common.reset')}
                </button>
              )}
            </div>
            {editMode && (
              <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: -8 }}>
                {t('aimkt.freePlacementHint')}
              </div>
            )}
            <LivePreview
              form={form} template={template} generatedUrl={bannerUrl}
              editMode={editMode} onLayoutChange={updateLayout} t={t}
            />

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-md btn-primary" style={{ flex: 1 }} disabled={!bannerUrl || downloading} onClick={doDownload}>
                {downloading ? t('aimkt.downloading') : `⬇️ ${t('aimkt.download')}`}
              </button>
              <button className="btn btn-md btn-secondary" style={{ flex: 1 }} disabled={!bannerUrl || sharing} onClick={doShare}>
                {sharing ? t('aimkt.sharingInProgress') : `📤 ${t('aimkt.share')}`}
              </button>
              <button className="btn btn-md btn-ghost" disabled={!bannerUrl}
                onClick={() => copyToClipboard(bannerUrl, t('aimkt.bannerLink'), t)}>
                🔗
              </button>
              <button className="btn btn-md btn-ghost"
                disabled={(!bannerUrl && !Object.values(result?.posts || emptyPosts).some((v: any) => !!v)) || savingHistory}
                onClick={doSaveHistory} title={t('aimkt.saveToHistory')}>
                {savingHistory ? '...' : '💾'}
              </button>
            </div>

            <button
              className="btn btn-md btn-primary"
              style={{ width: '100%', background: 'linear-gradient(135deg,#FF6A2B,#FF3D71)' }}
              disabled={!bannerUrl || sendingAll}
              onClick={doSendAll}
              title={t('aimkt.sendAllTitle')}
            >
              {sendingAll ? t('aimkt.sending') : `🚀 ${t('aimkt.sendToAll')}`}
            </button>

            {!bannerUrl && (
              <div style={{ fontSize: 11.5, color: 'var(--fg-3)', textAlign: 'center', lineHeight: 1.5 }}>
                {t('aimkt.fillFieldsHint')}
              </div>
            )}

            {/* ── Post matnlari ── */}
            {bannerUrl && (
              <div className="card" style={{ padding: 14 }}>
                <div className="tabs-bar" style={{ padding: 0, marginBottom: 10, background: 'none' }}>
                  {(['telegram', 'instagram', 'facebook'] as const).map(k => (
                    <button key={k} className={`tab-btn ${activeTab === k ? 'active' : ''}`} onClick={() => setActiveTab(k)}>
                      {platformMeta[k].icon} {platformMeta[k].label}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  {(['plain', 'markdown', 'html'] as const).map((fmt) => (
                    <button key={fmt} type="button" onClick={() => setTextFormat(fmt)}
                      style={{
                        fontSize: 11, padding: '4px 10px', borderRadius: 999, border: '1px solid var(--border)',
                        background: textFormat === fmt ? 'var(--primary)' : 'var(--bg-3)',
                        color: textFormat === fmt ? '#fff' : 'var(--fg-2)', cursor: 'pointer', fontWeight: 600,
                      }}
                    >{fmt === 'plain' ? t('aimkt.plainText') : fmt === 'markdown' ? 'Markdown' : 'HTML'}</button>
                  ))}
                </div>

                {/* AI matn yozmagan/yozolmagan bo'lsa ham (masalan AI o'chiq) —
                    caption maydoni HAMISHA qo'lda to'ldirish uchun ochiq turadi. */}
                <textarea
                  readOnly={textFormat !== 'plain'}
                  value={formatPostText(result.posts[activeTab] || '', textFormat)}
                  onChange={(e) => {
                    if (textFormat !== 'plain') return; // markdown/html — faqat ko'rish uchun aylantirilgan matn, tahrir qilinmaydi
                    const val = e.target.value;
                    setResult((r: any) => ({ ...(r || { posts: emptyPosts }), posts: { ...((r || {}).posts || emptyPosts), [activeTab]: val } }));
                  }}
                  placeholder={t('aimkt.writeCaptionManually')}
                  className="form-input"
                  style={{ minHeight: 150, resize: 'vertical', fontFamily: textFormat === 'html' ? 'monospace' : 'inherit', lineHeight: 1.6 }}
                />
                {textFormat !== 'plain' && (
                  <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 4 }}>
                    {t('aimkt.switchToPlainToEdit')}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
                  {user && !user.tenantAiEnabled && (
                    <span style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>
                      🤖🚫 {t('aimkt.aiOffWriteManually')}
                    </span>
                  )}
                  <button className="btn btn-sm btn-ghost" style={{ marginLeft: 'auto' }} onClick={() => copyToClipboard(formatPostText(result.posts[activeTab] || '', textFormat), t('aimkt.text'), t)}>
                    📋 {t('common.copy')}
                  </button>
                </div>

                {activeTab === 'telegram' && (
                  <>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, marginTop: 12, cursor: 'pointer' }}>
                      <input type="checkbox" checked={useTelegramTemplate}
                        onChange={(e) => {
                          setUseTelegramTemplate(e.target.checked);
                          if (e.target.checked) previewTelegramTemplate();
                        }}
                        style={{ accentColor: 'var(--primary)' }} />
                      {t('aimkt.useStrictTemplate')}
                    </label>
                    {useTelegramTemplate && (
                      <textarea readOnly value={loadingTgPreview ? t('common.loading') : telegramTemplatePreview}
                        className="form-input" style={{ minHeight: 120, marginTop: 6, fontFamily: 'monospace', fontSize: 12 }} />
                    )}
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <input className="form-input" placeholder={t('aimkt.channelIdPlaceholder')}
                        value={tgChatId} onChange={e => setTgChatId(e.target.value)} />
                      <button className="btn btn-md btn-primary" style={{ flexShrink: 0 }}
                        disabled={sendingTg} onClick={doSendTelegram}>
                        {sendingTg ? '...' : `📤 ${t('aimkt.sendToChannel')}`}
                      </button>
                    </div>
                  </>
                )}

                {activeTab === 'instagram' && (
                  <div style={{
                    marginTop: 10, padding: '10px 12px', borderRadius: 8, fontSize: 11.5, lineHeight: 1.6,
                    background: 'var(--bg-3)', color: 'var(--fg-2)',
                  }}>
                    ℹ️ {t('aimkt.instagramManualOnlyPart1')}
                    <code style={{ margin: '0 4px' }}>instagram_content_publish</code>
                    {t('aimkt.instagramManualOnlyPart2')} <b>📤 {t('aimkt.share')}</b> {t('aimkt.instagramManualOnlyPart3')}
                  </div>
                )}

                {activeTab === 'facebook' && (
                  <>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button className="btn btn-md btn-primary" style={{ flex: 1 }}
                        disabled={sendingFb} onClick={doSendFacebook}>
                        {sendingFb ? '...' : `📘 ${t('aimkt.sendToPage')}`}
                      </button>
                    </div>
                    <div style={{
                      marginTop: 8, padding: '10px 12px', borderRadius: 8, fontSize: 11.5, lineHeight: 1.6,
                      background: 'var(--bg-3)', color: 'var(--fg-2)',
                    }}>
                      ℹ️ {t('aimkt.facebookAutoNote')}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </CrmLayout>
  );
}