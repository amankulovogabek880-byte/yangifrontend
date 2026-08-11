'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import CrmLayout from '@/components/layout/CrmLayout';
import { meetingsApi, clientsApi, usersApi } from '@/services/api';
import { useAuth } from '@/lib/store';
import { useI18n } from '@/lib/i18n';
import toast from 'react-hot-toast';
import { useIsMobile } from '@/hooks/useIsMobile';
import { Modal, Btn, Input, Select, Label, Textarea } from '@/components/ui';
import { ChevronLeft, ChevronRight, Trash2, Check, X as XIcon } from 'lucide-react';

const TYPE_COLORS: Record<string, string> = { MEETING: '#3d7eff', CALL: '#f59e0b', VISIT: '#22c55e', OTHER: '#94a3b8' };
const TYPES = ['MEETING', 'CALL', 'VISIT', 'OTHER'];

function dkey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function toLocalInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localeOf(lang: string) {
  return lang === 'ru' ? 'ru-RU' : lang === 'en' ? 'en-US' : 'uz-UZ';
}

const emptyForm = {
  id: '', title: '', type: 'MEETING', startAt: '', endAt: '',
  agentId: '', clientId: '', location: '', note: '', reminderMinutesBefore: 30,
};

export default function CalendarPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const isMobile = useIsMobile();
  const isManager = user?.role === 'TENANT_ADMIN' || user?.role === 'MANAGER';

  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d; });
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>(emptyForm);
  const [saving, setSaving] = useState(false);

  const gridDays = useMemo(() => {
    const firstOfMonth = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const offset = (firstOfMonth.getDay() + 6) % 7; // Monday = 0
    const gridStart = new Date(firstOfMonth);
    gridStart.setDate(1 - offset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      return d;
    });
  }, [cursor]);

  const load = () => {
    setLoading(true);
    const from = gridDays[0];
    const to = gridDays[gridDays.length - 1];
    meetingsApi.calendar({ from: from.toISOString(), to: to.toISOString() })
      .then(r => setMeetings(r.data?.items || []))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [cursor]);
  useEffect(() => {
    clientsApi.list({ limit: 200 }).then(r => setClients(r.data?.data || []));
    if (isManager) usersApi.list().then(r => setAgents(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, [isManager]);

  const byDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    meetings.forEach((m: any) => {
      const k = dkey(new Date(m.startAt));
      if (!map[k]) map[k] = [];
      map[k].push(m);
    });
    return map;
  }, [meetings]);

  const today = new Date();
  const monthLabel = cursor.toLocaleDateString(localeOf(lang), { month: 'long', year: 'numeric' });
  const weekdayKeys = ['cal.weekday.mon', 'cal.weekday.tue', 'cal.weekday.wed', 'cal.weekday.thu', 'cal.weekday.fri', 'cal.weekday.sat', 'cal.weekday.sun'];

  function openDay(d: Date) {
    setSelectedDay(d);
    setShowForm(false);
    setForm(emptyForm);
  }
  function openNewForm(d?: Date) {
    const base = d || selectedDay || new Date();
    const start = new Date(base);
    start.setHours(9, 0, 0, 0);
    setForm({ ...emptyForm, startAt: toLocalInput(start), agentId: user?.id || '' });
    setSelectedDay(base);
    setShowForm(true);
  }
  function openEdit(m: any) {
    setForm({
      id: m.id, title: m.title, type: m.type,
      startAt: toLocalInput(new Date(m.startAt)),
      endAt: m.endAt ? toLocalInput(new Date(m.endAt)) : '',
      agentId: m.agentId || '', clientId: m.clientId || '',
      location: m.location || '', note: m.note || '',
      reminderMinutesBefore: m.reminderMinutesBefore ?? 30,
    });
    setShowForm(true);
  }

  async function submit() {
    if (!form.title.trim() || !form.startAt) { toast.error(t('cal.required')); return; }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        type: form.type,
        startAt: new Date(form.startAt).toISOString(),
        endAt: form.endAt ? new Date(form.endAt).toISOString() : undefined,
        agentId: form.agentId || undefined,
        clientId: form.clientId || undefined,
        location: form.location || undefined,
        note: form.note || undefined,
        reminderMinutesBefore: Number(form.reminderMinutesBefore) || 0,
      };
      if (form.id) await meetingsApi.update(form.id, payload);
      else await meetingsApi.create(payload);
      toast.success(t('common.save'));
      setShowForm(false);
      load();
    } catch { toast.error(t('common.error') || 'Xatolik'); }
    finally { setSaving(false); }
  }

  async function setStatus(id: string, status: string) {
    try { await meetingsApi.setStatus(id, status); load(); } catch {}
  }
  async function removeMeeting(id: string) {
    try { await meetingsApi.delete(id); load(); } catch {}
  }

  const dayList = selectedDay ? (byDate[dkey(selectedDay)] || []).sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()) : [];

  // v40: kalendarda "kim bilan kim, qachon" hammasi BITTA joydan ko'rinishi
  // uchun — har bir kunni alohida bosib ochish shart bo'lmasin — joriy oy
  // uchun BARCHA uchrashuvlarni vaqt bo'yicha tartiblangan yagona ro'yxatga
  // yig'amiz (agent + mijoz + sana + soat bitta qatorda ko'rinadi).
  const monthAgenda = useMemo(() => {
    return meetings
      .filter((m: any) => new Date(m.startAt).getMonth() === cursor.getMonth() && new Date(m.startAt).getFullYear() === cursor.getFullYear())
      .slice()
      .sort((a: any, b: any) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  }, [meetings, cursor]);

  return (
    <CrmLayout>
      <div style={{ padding: isMobile ? '14px 12px' : 24, maxWidth: 1400 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <h1 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 700, margin: 0 }}>📅 {t('cal.title')}</h1>
          <Btn onClick={() => openNewForm(new Date())} size={isMobile ? 'sm' : 'md'}>{t('cal.newMeeting')}</Btn>
        </div>

        <div style={{ display: isMobile ? 'block' : 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 20, alignItems: 'start' }}>
        <div style={{ minWidth: 0 }}>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button onClick={() => setCursor(c => { const d = new Date(c); d.setMonth(d.getMonth() - 1); return d; })}
              style={{ border: '1px solid var(--border)', background: 'var(--bg-2)', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--fg)' }}>
              <ChevronLeft size={16} />
            </button>
            <div style={{ fontWeight: 700, fontSize: isMobile ? 14 : 16, textTransform: 'capitalize', minWidth: 140, textAlign: 'center' }}>{monthLabel}</div>
            <button onClick={() => setCursor(c => { const d = new Date(c); d.setMonth(d.getMonth() + 1); return d; })}
              style={{ border: '1px solid var(--border)', background: 'var(--bg-2)', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--fg)' }}>
              <ChevronRight size={16} />
            </button>
          </div>
          <button onClick={() => { const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); setCursor(d); }}
            style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--fg)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            {t('cal.today')}
          </button>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 14, marginBottom: 10, flexWrap: 'wrap' }}>
          {TYPES.map(tp => (
            <div key={tp} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--fg-3)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: TYPE_COLORS[tp], display: 'inline-block' }} />
              {t(`cal.type.${tp}`)}
            </div>
          ))}
        </div>

        {/* Weekday header */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 4 }}>
          {weekdayKeys.map(k => (
            <div key={k} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--fg-3)', padding: '4px 0' }}>{t(k)}</div>
          ))}
        </div>

        {/* Month grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {gridDays.map((d, i) => {
            const key = dkey(d);
            const items = byDate[key] || [];
            const isCurMonth = d.getMonth() === cursor.getMonth();
            const isToday = key === dkey(today);
            const visible = items.slice(0, isMobile ? 1 : 3);
            const extra = items.length - visible.length;
            return (
              <div key={i} onClick={() => openDay(d)}
                style={{
                  minHeight: isMobile ? 58 : 92, borderRadius: 8, padding: 6, cursor: 'pointer',
                  background: isToday ? 'rgba(61,126,255,0.08)' : 'var(--bg-2)',
                  border: isToday ? '1px solid #3d7eff' : '1px solid var(--border)',
                  opacity: isCurMonth ? 1 : 0.4,
                  display: 'flex', flexDirection: 'column', gap: 3, overflow: 'hidden',
                }}>
                <div style={{ fontSize: 11, fontWeight: isToday ? 800 : 600, color: isToday ? '#3d7eff' : 'var(--fg)' }}>{d.getDate()}</div>
                {visible.map((m: any) => {
                  // v40: bir qarashda "kim bilan kim" bilinishi uchun — agent
                  // va mijoz ismini ham tooltip (hover) va matnga qo'shamiz.
                  const who = [isManager && m.agent?.name, m.client?.fullName].filter(Boolean).join(' → ');
                  const fullLabel = [m.title, who].filter(Boolean).join(' • ');
                  return (
                    <div key={m.id} title={fullLabel} style={{
                      fontSize: 10, padding: '2px 5px', borderRadius: 5, color: '#fff',
                      background: TYPE_COLORS[m.type] || '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      textDecoration: m.status === 'CANCELLED' ? 'line-through' : 'none',
                      opacity: m.status === 'DONE' ? 0.6 : 1,
                    }}>
                      {new Date(m.startAt).toLocaleTimeString(localeOf(lang), { hour: '2-digit', minute: '2-digit' })} {who ? who : m.title}
                    </div>
                  );
                })}
                {extra > 0 && <div style={{ fontSize: 10, color: 'var(--fg-3)' }}>+{extra} {t('cal.more')}</div>}
              </div>
            );
          })}
        </div>
        </div>

        {/* v40: OYLIK RO'YXAT — kim bilan kim, qachon uchrashadi, hammasi
            BITTA joydan (har bir kunni alohida ochmasdan) ko'rinadi. */}
        <div style={{
          border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-2)',
          padding: 12, marginTop: isMobile ? 18 : 0,
          maxHeight: isMobile ? 360 : 'calc(100vh - 160px)', overflowY: 'auto', position: isMobile ? 'static' : 'sticky', top: 76,
        }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, textTransform: 'capitalize' }}>
            📋 {monthLabel} — {t('cal.title')}
          </div>
          {monthAgenda.length === 0 && (
            <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--fg-3)', fontSize: 12 }}>{t('cal.empty')}</div>
          )}
          {monthAgenda.map((m: any) => (
            <div key={m.id} onClick={() => { setSelectedDay(new Date(m.startAt)); setShowForm(false); }}
              style={{
                padding: '8px 9px', borderRadius: 8, borderLeft: `3px solid ${TYPE_COLORS[m.type] || '#94a3b8'}`,
                background: 'var(--bg)', marginBottom: 6, cursor: 'pointer',
              }}>
              <div style={{ fontSize: 11, color: 'var(--fg-3)', fontWeight: 600 }}>
                {new Date(m.startAt).toLocaleDateString(localeOf(lang), { day: 'numeric', month: 'short' })}
                {' · '}
                {new Date(m.startAt).toLocaleTimeString(localeOf(lang), { hour: '2-digit', minute: '2-digit' })}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, marginTop: 2, textDecoration: m.status === 'CANCELLED' ? 'line-through' : 'none', opacity: m.status === 'DONE' ? 0.6 : 1 }}>
                {m.title}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                {isManager && m.agent && <span style={{ fontSize: 10.5, color: 'var(--fg-3)' }}>👤 {m.agent.name}</span>}
                {m.client && <span style={{ fontSize: 10.5, color: '#3d7eff' }}>🧳 {m.client.fullName}</span>}
              </div>
            </div>
          ))}
        </div>
        </div>
      </div>

      {/* Day modal */}
      <Modal open={!!selectedDay} onClose={() => setSelectedDay(null)}
        title={selectedDay ? selectedDay.toLocaleDateString(localeOf(lang), { day: 'numeric', month: 'long', year: 'numeric' }) : ''}
        maxWidth={520}>
        {!showForm ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <Btn size="sm" onClick={() => openNewForm(selectedDay!)}>{t('cal.newMeeting')}</Btn>
            </div>
            {dayList.length === 0 && (
              <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--fg-3)', fontSize: 13 }}>{t('cal.empty')}</div>
            )}
            {dayList.map((m: any) => (
              <div key={m.id} style={{
                padding: 12, borderRadius: 10, border: '1px solid var(--border)', borderLeft: `3px solid ${TYPE_COLORS[m.type] || '#94a3b8'}`,
                marginBottom: 8, background: 'var(--bg-2)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => openEdit(m)}>
                    <div style={{ fontWeight: 700, fontSize: 13, textDecoration: m.status === 'CANCELLED' ? 'line-through' : 'none' }}>{m.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 3 }}>
                      {new Date(m.startAt).toLocaleTimeString(localeOf(lang), { hour: '2-digit', minute: '2-digit' })}
                      {m.endAt ? ` – ${new Date(m.endAt).toLocaleTimeString(localeOf(lang), { hour: '2-digit', minute: '2-digit' })}` : ''}
                      {' · '}{t(`cal.type.${m.type}`)}
                      {' · '}{t(`cal.status.${m.status}`)}
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 5, flexWrap: 'wrap' }}>
                      {m.agent && <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>👤 {m.agent.name}</span>}
                      {m.client && (
                        <span onClick={(e) => { e.stopPropagation(); router.push(`/clients/${m.client.id}`); }} style={{ fontSize: 11, color: '#3d7eff', cursor: 'pointer' }}>
                          🧳 {m.client.fullName}
                        </span>
                      )}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {m.status === 'SCHEDULED' && (
                      <button onClick={() => setStatus(m.id, 'DONE')} title={t('cal.markDone')}
                        style={{ border: '1px solid var(--border)', background: 'var(--bg)', borderRadius: 6, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#22c55e' }}>
                        <Check size={14} />
                      </button>
                    )}
                    {m.status === 'SCHEDULED' && (
                      <button onClick={() => setStatus(m.id, 'CANCELLED')} title={t('cal.cancel')}
                        style={{ border: '1px solid var(--border)', background: 'var(--bg)', borderRadius: 6, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#ef4444' }}>
                        <XIcon size={14} />
                      </button>
                    )}
                    <button onClick={() => removeMeeting(m.id)} title={t('common.delete')}
                      style={{ border: '1px solid var(--border)', background: 'var(--bg)', borderRadius: 6, width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--fg-3)' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <Label>{t('cal.titlePh')}</Label>
              <Input value={form.title} onChange={(e: any) => setForm({ ...form, title: e.target.value })} placeholder={t('cal.titlePh')} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <Label>{t('cal.type')}</Label>
                <Select value={form.type} onChange={(e: any) => setForm({ ...form, type: e.target.value })}>
                  {TYPES.map(tp => <option key={tp} value={tp}>{t(`cal.type.${tp}`)}</option>)}
                </Select>
              </div>
              <div>
                <Label>{t('cal.reminder')}</Label>
                <Input type="number" min={0} value={form.reminderMinutesBefore} onChange={(e: any) => setForm({ ...form, reminderMinutesBefore: e.target.value })} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <Label>{t('cal.startAt')}</Label>
                <Input type="datetime-local" value={form.startAt} onChange={(e: any) => setForm({ ...form, startAt: e.target.value })} />
              </div>
              <div>
                <Label>{t('cal.endAt')}</Label>
                <Input type="datetime-local" value={form.endAt} onChange={(e: any) => setForm({ ...form, endAt: e.target.value })} />
              </div>
            </div>
            {isManager && (
              <div>
                <Label>{t('cal.agent')}</Label>
                <Select value={form.agentId} onChange={(e: any) => setForm({ ...form, agentId: e.target.value })}>
                  <option value="">{user?.name}</option>
                  {agents.filter((a: any) => a.id !== user?.id).map((a: any) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
              </div>
            )}
            <div>
              <Label>{t('cal.client')}</Label>
              <Select value={form.clientId} onChange={(e: any) => setForm({ ...form, clientId: e.target.value })}>
                <option value="">{t('cal.clientNone')}</option>
                {clients.map((c: any) => <option key={c.id} value={c.id}>{c.fullName}{c.phone ? ` • ${c.phone}` : ''}</option>)}
              </Select>
            </div>
            <div>
              <Label>{t('cal.location')}</Label>
              <Input value={form.location} onChange={(e: any) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div>
              <Label>{t('cal.note')}</Label>
              <Textarea value={form.note} onChange={(e: any) => setForm({ ...form, note: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
              <Btn variant="secondary" onClick={() => setShowForm(false)}>{t('common.cancel')}</Btn>
              <Btn onClick={submit} loading={saving}>{t('common.save')}</Btn>
            </div>
          </div>
        )}
      </Modal>
    </CrmLayout>
  );
}