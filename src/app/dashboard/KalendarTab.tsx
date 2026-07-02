'use client';
/**
 * v10.2 — KALENDAR TO'LIQ QAYTA QURILDI
 *
 * Oldin: faqat 1 kunlik/oraliq kartalar (grid yo'q edi).
 * Endi:
 *  - To'liq oylik grid (dushanbadan boshlanadi)
 *  - Tour-eventlar bitta joyda: parvoz (ketish/qaytish), viza muddati,
 *    invoice to'lov muddati, vazifalar, follow-uplar
 *  - Rang-kodlash: qizil = muddati o'tgan, sariq halqa = bugun
 *  - Kunni bossangiz — o'ng panelda o'sha kun eventlari + eski kunlik
 *    hisobot (leadlar, bookinglar, to'lovlar)
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { reportsV6 } from '@/services/api';
import { EmptyState } from '@/components/ui';
import {
  ChevronLeft, ChevronRight, Plane, PlaneLanding, FileWarning,
  CreditCard, CheckSquare, BellRing, CalendarDays, Loader2,
} from 'lucide-react';

const MONTHS_UZ = ['Yanvar','Fevral','Mart','Aprel','May','Iyun','Iyul','Avgust','Sentabr','Oktabr','Noyabr','Dekabr'];
const WEEKDAYS_UZ = ['Du','Se','Cho','Pa','Ju','Sha','Ya'];

// Event turlari — har biriga barqaror rang + real icon
const EVENT_META: Record<string, { label: string; color: string; Icon: any }> = {
  departure: { label: 'Parvoz (ketish)',  color: '#3d7eff', Icon: Plane },
  return:    { label: 'Qaytish',          color: '#10b981', Icon: PlaneLanding },
  visa:      { label: 'Viza muddati',     color: '#f97316', Icon: FileWarning },
  payment:   { label: "To'lov muddati",   color: '#ef4444', Icon: CreditCard },
  task:      { label: 'Vazifa',           color: '#8b5cf6', Icon: CheckSquare },
  followup:  { label: 'Follow-up',        color: '#06b6d4', Icon: BellRing },
};

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function KalendarTab({ calendarApi }: { calendarApi: any }) {
  const router = useRouter();
  const now = new Date();
  const todayIso = iso(now);

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [monthData, setMonthData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [selectedDay, setSelectedDay] = useState<string>(todayIso);
  const [dayData, setDayData] = useState<any>(null);
  const [dayLoading, setDayLoading] = useState(false);

  // ── Oylik eventlarni yuklash ──
  const loadMonth = useCallback(async () => {
    setLoading(true);
    try {
      const r = await reportsV6.calendarMonth(year, month);
      setMonthData(r.data);
    } catch { setMonthData(null); }
    finally { setLoading(false); }
  }, [year, month]);

  useEffect(() => { loadMonth(); }, [loadMonth]);

  // ── Tanlangan kun detali (eski kunlik hisobot endpointi) ──
  useEffect(() => {
    if (!selectedDay) return;
    setDayLoading(true);
    calendarApi({ date: selectedDay })
      .then((r: any) => setDayData(r.data))
      .catch(() => setDayData(null))
      .finally(() => setDayLoading(false));
  }, [selectedDay, calendarApi]);

  function shiftMonth(delta: number) {
    let m = month + delta, y = year;
    if (m < 1) { m = 12; y--; }
    if (m > 12) { m = 1; y++; }
    setMonth(m); setYear(y);
  }

  // ── Grid hujayralari (dushanbadan boshlanadi) ──
  const cells = useMemo(() => {
    const first = new Date(year, month - 1, 1);
    const daysInMonth = new Date(year, month, 0).getDate();
    const startOffset = (first.getDay() + 6) % 7; // Mon=0
    const list: Array<{ date: string; day: number } | null> = [];
    for (let i = 0; i < startOffset; i++) list.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      list.push({ date: iso(new Date(year, month - 1, d)), day: d });
    }
    while (list.length % 7 !== 0) list.push(null);
    return list;
  }, [year, month]);

  const byDate: Record<string, any[]> = monthData?.byDate || {};
  const selectedEvents: any[] = byDate[selectedDay] || [];

  const box: React.CSSProperties = { background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 14 };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: 16, padding: '20px 24px', alignItems: 'start' }}>

      {/* ═══ CHAP: OYLIK GRID ═══ */}
      <div style={{ ...box, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
          <CalendarDays size={17} style={{ color: 'var(--primary)' }} />
          <span style={{ fontSize: 16, fontWeight: 800 }}>{MONTHS_UZ[month - 1]} {year}</span>
          {loading && <Loader2 size={14} style={{ color: 'var(--fg-3)', animation: 'spin 1s linear infinite' }} />}
          <div style={{ flex: 1 }} />
          <button onClick={() => { setYear(now.getFullYear()); setMonth(now.getMonth() + 1); setSelectedDay(todayIso); }}
            style={{ padding: '5px 12px', fontSize: 12, fontWeight: 600, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-3)', color: 'var(--fg-2)', cursor: 'pointer' }}>
            Bugun
          </button>
          <button onClick={() => shiftMonth(-1)} style={{ padding: 6, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-3)', color: 'var(--fg-2)', cursor: 'pointer', display: 'inline-flex' }}>
            <ChevronLeft size={15} />
          </button>
          <button onClick={() => shiftMonth(1)} style={{ padding: 6, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-3)', color: 'var(--fg-2)', cursor: 'pointer', display: 'inline-flex' }}>
            <ChevronRight size={15} />
          </button>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', padding: '10px 18px', borderBottom: '1px solid var(--border)', fontSize: 10.5 }}>
          {Object.entries(EVENT_META).map(([k, m]) => (
            <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--fg-3)', fontWeight: 600 }}>
              <span style={{ width: 8, height: 8, borderRadius: 3, background: m.color }} />
              {m.label}{monthData?.counts?.[k] ? ` (${monthData.counts[k]})` : ''}
            </span>
          ))}
        </div>

        {/* Weekday header */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid var(--border-2)' }}>
          {WEEKDAYS_UZ.map((w, i) => (
            <div key={w} style={{ padding: '7px 0', textAlign: 'center', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', color: i >= 5 ? '#ef4444aa' : 'var(--fg-3)' }}>{w}</div>
          ))}
        </div>

        {/* Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {cells.map((cell, i) => {
            if (!cell) return <div key={'e' + i} style={{ minHeight: 86, borderRight: (i % 7 < 6) ? '1px solid var(--border-2)' : 'none', borderBottom: '1px solid var(--border-2)', background: 'var(--bg)', opacity: 0.4 }} />;
            const evts = byDate[cell.date] || [];
            const isToday = cell.date === todayIso;
            const isPast = cell.date < todayIso;
            const isSelected = cell.date === selectedDay;
            const hasOverdue = isPast && evts.some((e) => ['payment', 'visa', 'task', 'followup'].includes(e.type));

            return (
              <div key={cell.date} onClick={() => setSelectedDay(cell.date)} style={{
                minHeight: 86, padding: '5px 6px', cursor: 'pointer',
                borderRight: (i % 7 < 6) ? '1px solid var(--border-2)' : 'none',
                borderBottom: '1px solid var(--border-2)',
                background: isSelected ? 'var(--primary-soft, rgba(61,126,255,.08))' : 'transparent',
                boxShadow: isSelected ? 'inset 0 0 0 1.5px var(--primary)' : 'none',
                transition: 'background .1s',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{
                    fontSize: 12, fontWeight: isToday ? 800 : 600,
                    width: 22, height: 22, borderRadius: '50%',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    background: isToday ? '#f59e0b' : 'transparent',
                    color: isToday ? '#fff' : isPast ? 'var(--fg-3)' : 'var(--fg)',
                  }}>{cell.day}</span>
                  {hasOverdue && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444' }} title="Muddati o'tgan" />}
                </div>
                {evts.slice(0, 3).map((e, j) => {
                  const meta = EVENT_META[e.type] || EVENT_META.task;
                  const overdue = isPast && ['payment', 'visa', 'task', 'followup'].includes(e.type);
                  return (
                    <div key={j} style={{
                      display: 'flex', alignItems: 'center', gap: 3,
                      fontSize: 9.5, fontWeight: 600, marginBottom: 2,
                      padding: '1.5px 4px', borderRadius: 4,
                      background: (overdue ? '#ef4444' : meta.color) + '1c',
                      color: overdue ? '#ef4444' : meta.color,
                      overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                    }}>
                      <meta.Icon size={9} style={{ flexShrink: 0 }} />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.title}</span>
                    </div>
                  );
                })}
                {evts.length > 3 && <div style={{ fontSize: 9, color: 'var(--fg-3)', fontWeight: 700 }}>+{evts.length - 3} yana</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* ═══ O'NG: TANLANGAN KUN ═══ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 12 }}>
        <div style={{ ...box, padding: '14px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 10 }}>
            {new Date(selectedDay + 'T12:00:00').toLocaleDateString('uz-UZ', { day: 'numeric', month: 'long', weekday: 'long' })}
            {selectedDay === todayIso && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color: '#f59e0b', background: '#f59e0b1c', padding: '2px 7px', borderRadius: 8 }}>BUGUN</span>}
          </div>

          {/* Eventlar */}
          {selectedEvents.length === 0 ? (
            <EmptyState
              icon={<CalendarDays size={22} />}
              title="Bu kunda event yo'q"
              description="Parvoz, viza yoki to'lov muddati bo'lsa shu yerda ko'rinadi."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {selectedEvents.map((e, i) => {
                const meta = EVENT_META[e.type] || EVENT_META.task;
                const overdue = selectedDay < todayIso && ['payment', 'visa', 'task', 'followup'].includes(e.type);
                return (
                  <div key={i} onClick={() => e.link && router.push(e.link)} style={{
                    display: 'flex', gap: 9, alignItems: 'flex-start',
                    padding: '9px 11px', borderRadius: 9, cursor: e.link ? 'pointer' : 'default',
                    background: 'var(--bg-3)', borderLeft: `3px solid ${overdue ? '#ef4444' : meta.color}`,
                  }}>
                    <span style={{ color: overdue ? '#ef4444' : meta.color, marginTop: 1 }}><meta.Icon size={14} /></span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg)' }}>{e.title}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 1 }}>
                        {overdue ? "Muddati o'tgan • " : ''}{meta.label}{e.sub ? ` • ${e.sub}` : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Kunlik hisobot (eski endpoint) */}
        <div style={{ ...box, padding: '14px 16px' }}>
          <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 10, color: 'var(--fg-2)', textTransform: 'uppercase', letterSpacing: 0.4 }}>Kun natijasi</div>
          {dayLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 18 }}>
              <Loader2 size={18} style={{ color: 'var(--fg-3)', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'Daromad', value: '$' + Number(dayData?.stats?.revenue || 0).toLocaleString(), color: '#10b981' },
                { label: 'Sof foyda', value: '$' + Number(dayData?.stats?.profit || 0).toLocaleString(), color: '#8b5cf6' },
                { label: 'Yangi leadlar', value: dayData?.stats?.newLeads ?? 0, color: '#06b6d4' },
                { label: 'Bookinglar', value: dayData?.stats?.bookingsCount ?? 0, color: '#f59e0b' },
              ].map((k) => (
                <div key={k.label} style={{ padding: '9px 11px', background: 'var(--bg-3)', borderRadius: 9 }}>
                  <div style={{ fontSize: 10, color: 'var(--fg-3)', marginBottom: 3, textTransform: 'uppercase' }}>{k.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: k.color }}>{k.value}</div>
                </div>
              ))}
            </div>
          )}
          {!dayLoading && (dayData?.leads?.length > 0 || dayData?.bookings?.length > 0) && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 220, overflowY: 'auto' }}>
              {(dayData?.leads || []).slice(0, 6).map((l: any) => (
                <div key={l.id} onClick={() => router.push('/clients/' + l.id)} style={{ padding: '6px 9px', background: 'var(--bg-3)', borderRadius: 7, borderLeft: '3px solid #06b6d4', cursor: 'pointer' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700 }}>{l.fullName}</div>
                  <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>Yangi lead • {l.source || ''}</div>
                </div>
              ))}
              {(dayData?.bookings || []).slice(0, 6).map((b: any) => (
                <div key={b.id} onClick={() => router.push('/bookings/' + b.id)} style={{ padding: '6px 9px', background: 'var(--bg-3)', borderRadius: 7, borderLeft: '3px solid #f59e0b', cursor: 'pointer' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700 }}>{b.client?.fullName || b.bookingRef}</div>
                  <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>Booking • {b.tourName || b.destination || ''}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}