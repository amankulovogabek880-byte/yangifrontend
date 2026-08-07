'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import CrmLayout from '@/components/layout/CrmLayout';
import { pipelinesApi } from '@/services/api';
import { useAuth } from '@/lib/store';
import { fmtDate, errMsg } from '@/lib/helpers';
import { SourceIcon, EmptyState } from '@/components/ui';
import {
  Phone, MessageCircle, User, Plane, Clock, AlertTriangle,
  ChevronRight, CircleDollarSign, CalendarClock, Inbox,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useI18n } from '@/lib/i18n';
import { useIsMobile } from '@/hooks/useIsMobile';

// Pul formati: $12.5K ko'rinishida (kanban ustuni tor bo'lgani uchun)
function fmtSum(n: number): string {
  if (!n) return '$0';
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return '$' + (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return '$' + Math.round(n).toLocaleString();
}

const STAGE_COLORS: Record<string, string> = {
  NEW_LEAD:'#6366f1', CONTACTED:'#3b82f6', NO_CONTACT:'#f97316',
  OFFER_SENT:'#8b5cf6', FOLLOW_UP:'#06b6d4', INVITED_TO_OFFICE:'#f59e0b',
  CAME_TO_OFFICE:'#10b981', DID_NOT_COME:'#ef4444',
  ADVANCE_PAID:'#22c55e', PAID:'#16a34a', LOST:'#dc2626',
  PRE_TRAVEL:'#6366f1', TRAVELING:'#10b981', POST_TRAVEL:'#8b5cf6',
};

export default function PipelinePage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin = ['TENANT_ADMIN', 'MANAGER'].includes(user?.role || '');
  const isMobile = useIsMobile();

  const [pipelines, setPipelines] = useState<any[]>([]);
  const [activePl, setActivePl] = useState<any>(null);
  const [columns, setColumns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lostModal, setLostModal] = useState<string | null>(null);
  const [callModal, setCallModal] = useState<any>(null);
  const [stagesModal, setStagesModal] = useState(false);
  const [addPlModal, setAddPlModal] = useState(false);
  // v38: amoCRM-uslubida kartani sudrab (drag & drop) bosqichlar orasida
  // ko'chirish uchun — qaysi karta sudralayotgani va qaysi ustun ustida
  // turganini kuzatib boramiz.
  const [draggedClientId, setDraggedClientId] = useState<string | null>(null);
  const [dragOverStageKey, setDragOverStageKey] = useState<string | null>(null);

  useEffect(() => { loadPipelines(); }, []);

  async function loadPipelines() {
    setLoading(true);
    try {
      const r = await pipelinesApi.list();
      const pls: any[] = r.data || [];
      setPipelines(pls);
      const def = pls.find(p => p.pipelineType === 'NEW_SALE') || pls[0];
      if (def) { setActivePl(def); await loadBoard(def.id); }
      else setLoading(false);
    } catch (e) { toast.error(errMsg(e)); setLoading(false); }
  }

  async function loadBoard(plId: string) {
    setLoading(true);
    try {
      const r = await pipelinesApi.board(plId);
      setColumns(r.data?.columns || []);
    } catch { setColumns([]); }
    finally { setLoading(false); }
  }

  async function switchPipeline(pl: any) {
    setActivePl(pl);
    await loadBoard(pl.id);
  }

  async function moveClient(clientId: string, toStage: string) {
    if (toStage === 'LOST') { setLostModal(clientId); return; }

    // v15: ilgari har ko'chirishda BUTUN taxta qayta yuklanardi (loadBoard) va
    // "sakrardi". Endi kartani LOKAL ravishda yangi ustunga ko'chiramiz — refresh yo'q.
    const prevColumns = columns;
    let moved: any = null;
    const without = columns.map((col: any) => {
      const found = (col.clients || []).find((c: any) => c.id === clientId);
      if (found) moved = found;
      return { ...col, clients: (col.clients || []).filter((c: any) => c.id !== clientId) };
    });

    if (moved) {
      const next = without.map((col: any) =>
        col.stage?.stageKey === toStage
          ? { ...col, clients: [{ ...moved, pipelineStage: toStage }, ...(col.clients || [])] }
          : col,
      );
      setColumns(next);
    }

    try {
      await pipelinesApi.move(clientId, { stage: toStage });
      toast.success(t('pl.stageChanged'));
    } catch (e: any) {
      setColumns(prevColumns); // xato bo'lsa qaytaramiz
      toast.error(errMsg(e));
    }
  }

  return (
    <CrmLayout>
      <div style={{ display: 'flex', flexDirection: 'column', height: isMobile ? 'calc(100vh - 114px)' : 'calc(100vh - 56px)', overflow: 'hidden' }}>
        {/* Topbar */}
        <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', flexShrink: 0 }}>
          {pipelines.map(pl => (
            <div key={pl.id} style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              <button onClick={() => switchPipeline(pl)} style={{
                padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none',
                background: activePl?.id === pl.id ? (pl.color || '#3d7eff') : 'var(--bg-3)',
                color: activePl?.id === pl.id ? 'white' : 'var(--fg-2)',
                borderRadius: isAdmin && !pl.isDefault ? '8px 0 0 8px' : '8px',
              }}>
                {pl.pipelineType === 'NEW_SALE' ? '🆕' : '✈️'} {pl.name}
              </button>
              {isAdmin && !pl.isDefault && (
                <button onClick={async (e) => {
                  e.stopPropagation();
                  if (!confirm(`"${pl.name}" ${t('pl.deleteConfirm')}`)) return;
                  try {
                    await pipelinesApi.delete(pl.id);
                    toast.success(t('pl.deleted'));
                    loadPipelines();
                  } catch (ex: any) { toast.error(errMsg(ex)); }
                }} style={{
                  padding: '6px 8px', fontSize: 11, cursor: 'pointer', border: 'none',
                  background: activePl?.id === pl.id ? '#ffffff30' : '#ef444420',
                  color: activePl?.id === pl.id ? 'white' : '#ef4444',
                  borderRadius: '0 8px 8px 0', borderLeft: '1px solid rgba(255,255,255,0.2)',
                }} title={t('pl.deleteTitle')}>✕</button>
              )}
            </div>
          ))}
          {isAdmin && <button onClick={() => setAddPlModal(true)} style={{ padding: '6px 12px', fontSize: 12, borderRadius: 8, border: '1px dashed var(--border)', background: 'none', cursor: 'pointer', color: 'var(--fg-3)' }}>+ Pipeline</button>}
          <div style={{ flex: 1 }} />
          {isAdmin && activePl && <button onClick={() => setStagesModal(true)} style={{ padding: '6px 14px', fontSize: 12, borderRadius: 8, border: '1px solid var(--border)', background: 'none', cursor: 'pointer', color: 'var(--fg-2)' }}>{t('pl.stages')}</button>}

        </div>

        {/* Board */}
        {loading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-3)' }}>{t('pl.loading')}</div> : (
          <div style={{ flex: 1, overflowX: 'auto', display: 'flex', gap: 10, padding: '12px', alignItems: 'flex-start', scrollSnapType: isMobile ? 'x mandatory' : undefined }}>
            {columns.map((col: any) => (
              <KanbanCol key={col.stage?.id} col={col} isMobile={isMobile}
                onCardClick={id => router.push(`/clients/${id}`)}
                onMove={moveClient}
                onCall={c => setCallModal(c)}
                allStages={columns.map(c => c.stage)}
                draggedClientId={draggedClientId}
                setDraggedClientId={setDraggedClientId}
                dragOverStageKey={dragOverStageKey}
                setDragOverStageKey={setDragOverStageKey}
              />
            ))}
            {columns.length === 0 && (
              <div style={{ padding: 60, textAlign: 'center', color: 'var(--fg-3)', fontSize: 14, width: '100%' }}>
                {t('pl.empty')}
                {isAdmin && <div style={{ marginTop: 10 }}><button onClick={() => setAddPlModal(true)} style={{ padding: '8px 18px', borderRadius: 8, background: '#3d7eff', color: 'white', border: 'none', cursor: 'pointer' }}>{t('pl.create')}</button></div>}
              </div>
            )}
          </div>
        )}
      </div>

      {lostModal && <LostModal onClose={() => setLostModal(null)} onConfirm={(reason: string, detail: string) => {
        pipelinesApi.move(lostModal!, { stage: 'LOST', lostReason: reason, lostReasonDetail: detail })
          .then(() => { toast.success(t('pl.markedLost')); setLostModal(null); if (activePl) loadBoard(activePl.id); })
          .catch(e => toast.error(errMsg(e)));
      }} />}
      {callModal && <CallModal client={callModal} onClose={() => setCallModal(null)} onSaved={() => { setCallModal(null); if (activePl) loadBoard(activePl.id); }} />}
      {stagesModal && activePl && <StagesModal pipeline={activePl} onClose={() => { setStagesModal(false); loadPipelines(); }} />}
      {addPlModal && <AddPipelineModal onClose={() => setAddPlModal(false)} onSaved={() => { setAddPlModal(false); loadPipelines(); }} />}
    </CrmLayout>
  );
}

function KanbanCol({ col, onCardClick, onMove, onCall, allStages, isMobile, draggedClientId, setDraggedClientId, dragOverStageKey, setDragOverStageKey }: any) {
  const { t } = useI18n();
  const stage = col.stage || {};
  const clients: any[] = col.clients || [];
  const color = stage.color || STAGE_COLORS[stage.stageKey] || '#6366f1';
  const isNoContact = stage.stageKey === 'NO_CONTACT';
  // amoCRM-uslubida: bosqich jami summasi (kartalardagi deal qiymatlari yig'indisi)
  const totalValue = clients.reduce((sum, c) => sum + (Number(c.totalRevenue) || 0), 0);
  // v38: shu ustun ustidan karta sudralib o'tayotganda ajratib ko'rsatish
  const isDragOver = dragOverStageKey === stage.stageKey && draggedClientId;

  function handleDragOver(e: React.DragEvent) {
    if (!draggedClientId) return;
    e.preventDefault(); // drop'ga ruxsat berish uchun shart
    e.dataTransfer.dropEffect = 'move';
    if (dragOverStageKey !== stage.stageKey) setDragOverStageKey(stage.stageKey);
  }

  function handleDragLeave(e: React.DragEvent) {
    // faqat ustunning o'zidan chiqqanda tozalaymiz (ichki elementlar orasida emas)
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    if (dragOverStageKey === stage.stageKey) setDragOverStageKey(null);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const clientId = e.dataTransfer.getData('text/plain') || draggedClientId;
    setDragOverStageKey(null);
    setDraggedClientId(null);
    if (!clientId) return;
    const already = clients.some((c: any) => c.id === clientId);
    if (already) return; // o'sha ustunga qaytarilsa hech narsa qilmaymiz
    onMove(clientId, stage.stageKey);
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={isMobile
        ? { minWidth: '86vw', maxWidth: '86vw', flex: '0 0 86vw', scrollSnapAlign: 'start', display: 'flex', flexDirection: 'column', background: isDragOver ? `${color}12` : 'var(--bg-2)', borderRadius: 10, border: isDragOver ? `1px dashed ${color}` : '1px solid var(--border)', maxHeight: 'calc(100vh - 180px)', transition: 'background .12s ease, border-color .12s ease' }
        : { minWidth: 220, maxWidth: 250, flex: '0 0 235px', display: 'flex', flexDirection: 'column', background: isDragOver ? `${color}12` : 'var(--bg-2)', borderRadius: 10, border: isDragOver ? `1px dashed ${color}` : '1px solid var(--border)', maxHeight: 'calc(100vh - 130px)', transition: 'background .12s ease, border-color .12s ease' }}>
      <div style={{ padding: '8px 12px', borderBottom: `3px solid ${color}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 700, flex: 1, color: 'var(--fg)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stage.name}</span>
          <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 10, background: `${color}25`, color }}>{clients.length}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3, fontSize: 11.5, fontWeight: 800, color: totalValue > 0 ? color : 'var(--fg-3)' }}>
          <CircleDollarSign size={12} />
          {fmtSum(totalValue)}
        </div>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px' }}>
        {clients.length === 0 && (
          <div style={{ padding: '20px 8px', textAlign: 'center' }}>
            <Inbox size={22} style={{ color: 'var(--fg-3)', opacity: 0.5 }} />
            <div style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 6 }}>Bu bosqichda lead yo'q</div>
          </div>
        )}
        {clients.map((c: any) => (
          <ClientCard key={c.id} client={c} isNoContact={isNoContact} color={color}
            onClick={() => onCardClick(c.id)}
            onMove={(s: string) => onMove(c.id, s)}
            onCall={() => onCall(c)}
            allStages={allStages}
            isDragging={draggedClientId === c.id}
            onDragStart={(e: React.DragEvent) => {
              e.dataTransfer.setData('text/plain', c.id);
              e.dataTransfer.effectAllowed = 'move';
              setDraggedClientId(c.id);
            }}
            onDragEnd={() => { setDraggedClientId(null); setDragOverStageKey(null); }}
          />
        ))}
      </div>
    </div>
  );
}

function ClientCard({ client: c, isNoContact, color, onClick, onMove, onCall, allStages, isDragging, onDragStart, onDragEnd }: any) {
  const { t } = useI18n();
  const [menu, setMenu] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setMenu(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const countdown = () => {
    if (!c.nextCallAt) return null;
    const diff = new Date(c.nextCallAt).getTime() - Date.now();
    const row = (color: string, txt: string, warn?: boolean) => (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 10, color, fontWeight: warn ? 700 : 500 }}>
        {warn ? <AlertTriangle size={10} /> : <Clock size={10} />} {txt}
      </span>
    );
    if (diff < 0) return row('#dc2626', "Vaqt o'tdi!", true);
    const h = Math.floor(diff / 3600000);
    if (h < 1) return row('#f97316', Math.floor(diff / 60000) + 'daq');
    if (h < 24) return row('#f97316', h + 'soat');
    return row('var(--fg-3)', fmtDate(c.nextCallAt));
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{
        background: 'var(--bg)', borderRadius: 8, marginBottom: 6, padding: '8px 10px',
        border: '1px solid var(--border)', cursor: 'grab',
        opacity: isDragging ? 0.35 : 1,
        transform: isDragging ? 'scale(0.97)' : 'scale(1)',
        transition: 'opacity .12s ease, transform .12s ease',
      }}
    >
      <div style={{ display: 'flex', gap: 6, marginBottom: 5 }}>
        <div style={{ flex: 1, cursor: 'pointer', minWidth: 0 }} onClick={onClick}>
          <div style={{ fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.fullName}</div>
          <div style={{ fontSize: 11, color: 'var(--fg-3)' }}>{c.phone}</div>
        </div>
        {c.leadScore > 60 && <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 8, background: '#10b98120', color: '#10b981', fontWeight: 700, height: 'fit-content' }}>{c.leadScore}%</span>}
      </div>
      {/* DEAL SUMMASI — amoCRM'dagi kabi kartaning eng ko'zga tashlanadigan qismi */}
      {Number(c.totalRevenue) > 0 && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 800, color: '#10b981', background: '#10b98114', padding: '2px 8px', borderRadius: 6, marginBottom: 5 }}>
          <CircleDollarSign size={12} />
          ${Number(c.totalRevenue).toLocaleString()}
        </div>
      )}
      {c.source && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--fg-3)', marginBottom: 4 }}>
          <SourceIcon source={c.source} size={11} /> {c.source}
        </div>
      )}
      {isNoContact && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, padding: '3px 6px', background: '#f9731615', color: '#f97316', borderRadius: 5, marginBottom: 4, fontWeight: 600 }}>
          <Phone size={10} /> {c.noContactAttempts || 0}/6 {countdown()}
        </div>
      )}
      {c.travelDepartDate && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#3d7eff', marginBottom: 4 }}>
          <Plane size={11} /> {fmtDate(c.travelDepartDate)}
        </div>
      )}
      {c.assignedAgent && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--fg-3)', marginBottom: 6 }}>
          <User size={11} /> {c.assignedAgent.name}
        </div>
      )}

      <div style={{ display: 'flex', gap: 4 }}>
        {isNoContact && (
          <button onClick={e => { e.stopPropagation(); onCall(); }} style={{ flex: 1, padding: '3px 0', fontSize: 10, fontWeight: 700, background: '#f97316', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><Phone size={10} /> Qo'ng'iroq</button>
        )}
        <button onClick={e => { e.stopPropagation(); onClick(); }} style={{ padding: '3px 7px', fontSize: 10, background: '#0088cc15', color: '#0088cc', border: 'none', borderRadius: 5, cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}><MessageCircle size={12} /></button>
        <div ref={ref} style={{ position: 'relative', marginLeft: 'auto' }}>
          <button onClick={e => { e.stopPropagation(); setMenu(!menu); }} style={{ padding: '3px 7px', fontSize: 11, background: 'var(--bg-3)', color: 'var(--fg-2)', border: '1px solid var(--border)', borderRadius: 5, cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }}><ChevronRight size={12} /></button>
          {menu && (
            <div style={{ position: 'absolute', right: 0, top: '100%', zIndex: 100, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,.15)', minWidth: 180, padding: 4 }}>
              <div style={{ fontSize: 10, color: 'var(--fg-3)', padding: '4px 8px', fontWeight: 700, textTransform: 'uppercase' }}>Ko'chirish</div>
              {allStages.filter(Boolean).map((s: any) => (
                <button key={s.id} onClick={() => { onMove(s.stageKey); setMenu(false); }} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 5, color: 'var(--fg)' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: s.color || '#6366f1', display: 'inline-block', marginRight: 7 }} />
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LostModal({ onClose, onConfirm }: any) {
  const { t } = useI18n();
  const [reason, setReason] = useState('PRICE');
  const [detail, setDetail] = useState('');
  const S: any = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
  const W: any = { background: 'var(--bg)', borderRadius: 14, padding: 24, width: 440, maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto' as const, boxSizing: 'border-box' as const, boxShadow: '0 20px 60px rgba(0,0,0,.3)' };
  const inp: any = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--fg)', fontSize: 13, boxSizing: 'border-box' };
  return (
    <div style={S}>
      <div style={W}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>{t('pl.lossReason')}</h2>
        <select value={reason} onChange={e => setReason(e.target.value)} style={{ ...inp, marginBottom: 12 }}>
          {['PRICE','COMPETITOR','NOT_INTERESTED','NO_RESPONSE','BUDGET_ISSUE','TRAVEL_CANCELLED','OTHER'].map((v) => (
            <option key={v} value={v}>{t('loss.'+v)}</option>
          ))}
        </select>
        <textarea value={detail} onChange={e => setDetail(e.target.value)} placeholder={t('pl.reasonPh')} style={{ ...inp, minHeight: 80, resize: 'vertical', marginBottom: 16 }} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-3)', color: 'var(--fg)', cursor: 'pointer' }}>{t('common.cancel')}</button>
          <button onClick={() => { if (!detail.trim()) { toast.error(t('pl.reasonRequired')); return; } onConfirm(reason, detail); }} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#ef4444', color: 'white', cursor: 'pointer', fontWeight: 700 }}>{t('pl.confirm')}</button>
        </div>
      </div>
    </div>
  );
}

function CallModal({ client, onClose, onSaved }: any) {
  const { t } = useI18n();
  const [outcome, setOutcome] = useState('NO_ANSWER');
  const [note, setNote] = useState('');
  const [nextCallAt, setNextCallAt] = useState(() => new Date(Date.now() + 24 * 3600000).toISOString().slice(0, 16));
  const [saving, setSaving] = useState(false);
  const attempts = client?.noContactAttempts || 0;
  const S: any = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
  const W: any = { background: 'var(--bg)', borderRadius: 14, padding: 24, width: 440, maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto' as const, boxSizing: 'border-box' as const, boxShadow: '0 20px 60px rgba(0,0,0,.3)' };
  const inp: any = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--fg)', fontSize: 13, boxSizing: 'border-box', marginBottom: 10 };

  async function save() {
    setSaving(true);
    try {
      await pipelinesApi.callAttempt(client.id, { outcome, note, nextCallAt });
      toast.success(t('common.saved'));
      onSaved();
    } catch (e: any) { toast.error(errMsg(e)); setSaving(false); }
  }

  return (
    <div style={S}>
      <div style={W}>
        <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>{client.fullName}</h2>
        <p style={{ margin: '0 0 14px', fontSize: 12, color: 'var(--fg-3)' }}>{client.phone}</p>
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {[1,2,3,4,5,6].map(n => (
            <div key={n} style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, background: n <= attempts ? '#ef4444' : n === attempts + 1 ? '#f97316' : 'var(--bg-3)', color: n <= attempts + 1 ? 'white' : 'var(--fg-3)' }}>{n}</div>
          ))}
        </div>
        <select value={outcome} onChange={e => setOutcome(e.target.value)} style={inp}>
          <option value="NO_ANSWER">{t('pl.noAnswer')}</option>
          <option value="BUSY">{t('pl.busy')}</option>
          <option value="ANSWERED">{t('pl.answered')}</option>
          <option value="CALLBACK_SET">{t('pl.callbackSet')}</option>
        </select>
        <input type="datetime-local" value={nextCallAt} onChange={e => setNextCallAt(e.target.value)} style={inp} />
        <textarea value={note} onChange={e => setNote(e.target.value)} placeholder={t('pl.notePh')} style={{ ...inp, minHeight: 60, resize: 'vertical' }} />
        {attempts >= 5 && <div style={{ padding: '8px 12px', background: '#ef444420', borderRadius: 8, fontSize: 12, color: '#ef4444', marginBottom: 12 }}>{t('pl.attempt6')}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-3)', color: 'var(--fg)', cursor: 'pointer' }}>{t('common.cancel')}</button>
          <button onClick={save} disabled={saving} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#3d7eff', color: 'white', cursor: 'pointer', fontWeight: 700 }}>{saving ? '...' : 'Saqlash'}</button>
        </div>
      </div>
    </div>
  );
}

function StagesModal({ pipeline, onClose }: any) {
  const { t } = useI18n();
  const [stages, setStages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#3d7eff');
  // v37: qo'lda sudrab (drag & drop) tartiblash — masalan "Proposal sent"ni
  // birinchi o'ringa olib borish uchun. dragItem/dragOverItem — hozir
  // sudralayotgan va uning ustidan o'tilgan qatorlar indeksi.
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const S: any = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
  const W: any = { background: 'var(--bg)', borderRadius: 14, padding: 24, width: 500, maxWidth: '92vw', maxHeight: '80vh', boxSizing: 'border-box' as const, display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,.3)' };

  useEffect(() => {
    pipelinesApi.stagesList(pipeline.id).then(r => setStages(r.data || [])).finally(() => setLoading(false));
  }, [pipeline.id]);

  async function add() {
    if (!newName.trim()) return;
    try {
      await pipelinesApi.stageCreate({ name: newName, color: newColor, pipelineId: pipeline.id });
      const r = await pipelinesApi.stagesList(pipeline.id);
      setStages(r.data || []); setNewName('');
      toast.success(t('common.added'));
    } catch (e: any) { toast.error(errMsg(e)); }
  }

  async function del(id: string) {
    if (!confirm(t('pl.deleteQ'))) return;
    try { await pipelinesApi.stageDelete(id); setStages(s => s.filter(x => x.id !== id)); }
    catch (e: any) { toast.error(errMsg(e)); }
  }

  function handleDragStart(index: number) { dragItem.current = index; }
  function handleDragEnter(index: number) { dragOverItem.current = index; setDragOverIdx(index); }
  async function handleDragEnd() {
    const from = dragItem.current;
    const to = dragOverItem.current;
    dragItem.current = null; dragOverItem.current = null; setDragOverIdx(null);
    if (from === null || to === null || from === to) return;

    const reordered = [...stages];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    setStages(reordered); // optimistik — darhol yangi tartibda ko'rsatamiz

    try {
      const r = await pipelinesApi.stageReorder(reordered.map((s) => s.id));
      // v36 FIX'ga muvofiq: server "Sotildi"/"Yo'qotildi" kabi belgilangan
      // bosqichlarni har doim oxiriga qaytaradi — shuning uchun natijani
      // serverdan qaytgani bilan sinxronlaymiz.
      if (Array.isArray(r?.data)) setStages(r.data);
    } catch (e: any) {
      toast.error(errMsg(e));
      pipelinesApi.stagesList(pipeline.id).then((r) => setStages(r.data || []));
    }
  }

  return (
    <div style={S}>
      <div style={W}>
        <h2 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700 }}>⚙️ {pipeline.name} — Bosqichlar</h2>
        <div style={{ fontSize: 11, color: 'var(--fg-4)', marginBottom: 12 }}>Tartibni o'zgartirish uchun ⠿ belgisidan ushlab sudrang</div>
        {loading ? <div>{t('pl.loading')}</div> : (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {stages.map((s, i) => (
              <div
                key={s.id}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragEnter={() => handleDragEnter(i)}
                onDragOver={(e) => e.preventDefault()}
                onDragEnd={handleDragEnd}
                style={{
                  display: 'flex', flexDirection: 'column', gap: 4, padding: '7px 10px',
                  background: dragOverIdx === i ? 'var(--bg-4, #2a2f3a)' : 'var(--bg-3)',
                  borderRadius: 8, borderLeft: `4px solid ${s.color}`,
                  outline: dragOverIdx === i ? '2px dashed var(--primary, #3d7eff)' : 'none',
                  transition: 'background .1s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--fg-4)', cursor: 'grab', letterSpacing: -1 }} title="Sudrab tartiblash">⠿</span>
                  <span style={{ fontSize: 11, color: 'var(--fg-3)', width: 18 }}>{i + 1}</span>
                  <input value={s.name} onChange={e => setStages(prev => prev.map(x => x.id === s.id ? { ...x, name: e.target.value } : x))}
                    onBlur={() => pipelinesApi.stageUpdate(s.id, { name: s.name }).catch(() => {})}
                    style={{ flex: 1, background: 'none', border: 'none', fontSize: 13, color: 'var(--fg)', fontWeight: 600 }} />
                  <input type="color" value={s.color} onChange={e => { const c = e.target.value; setStages(prev => prev.map(x => x.id === s.id ? { ...x, color: c } : x)); pipelinesApi.stageUpdate(s.id, { color: e.target.value }).catch(() => {}); }}
                    style={{ width: 28, height: 28, border: 'none', borderRadius: 5, cursor: 'pointer', background: 'none' }} />
                  {!s.isClosing && !s.isLost && <button onClick={() => del(s.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16 }}>✕</button>}
                </div>
                {/* v35: "Yopiluvchi bosqich" — shu bosqichga tushgan lead avtomatik
                    ravishda KEYINGI voronkaning birinchi bosqichiga o'tkaziladi
                    (masalan "Sold" → Postsale voronkaning birinchi ustuni). */}
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--fg-3)', paddingLeft: 26, cursor: 'pointer' }}>
                  <input type="checkbox" checked={!!s.isClosing} onChange={e => {
                    const v = e.target.checked;
                    setStages(prev => prev.map(x => x.id === s.id ? { ...x, isClosing: v } : x));
                    pipelinesApi.stageUpdate(s.id, { isClosing: v }).catch(() => {});
                  }} />
                  Yopiluvchi bosqich (keyingi voronkaga avtomatik o'tkazadi)
                </label>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} style={{ width: 36, height: 36, border: 'none', borderRadius: 7, cursor: 'pointer' }} />
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder={t('pl.newStagePh')}
            onKeyDown={e => e.key === 'Enter' && add()}
            style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--fg)', fontSize: 13 }} />
          <button onClick={add} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#3d7eff', color: 'white', cursor: 'pointer', fontWeight: 700 }}>{t('common.add')}</button>
        </div>
        <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-3)', color: 'var(--fg)', cursor: 'pointer' }}>Yopish</button>
      </div>
    </div>
  );
}

function AddPipelineModal({ onClose, onSaved }: any) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [type, setType] = useState('NEW_SALE');
  const [saving, setSaving] = useState(false);
  const S: any = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 };
  const W: any = { background: 'var(--bg)', borderRadius: 14, padding: 24, width: 400, maxWidth: '92vw', maxHeight: '90vh', overflowY: 'auto' as const, boxSizing: 'border-box' as const, boxShadow: '0 20px 60px rgba(0,0,0,.3)' };
  const inp: any = { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', color: 'var(--fg)', fontSize: 13, boxSizing: 'border-box', marginBottom: 12 };

  async function save() {
    if (!name.trim()) { toast.error(t('pl.nameRequired')); return; }
    setSaving(true);
    try { await pipelinesApi.create({ name, pipelineType: type }); onSaved(); }
    catch (e: any) { toast.error(errMsg(e)); setSaving(false); }
  }

  return (
    <div style={S}>
      <div style={W}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700 }}>+ Yangi Pipeline</h2>
        <select value={type} onChange={e => setType(e.target.value)} style={inp}>
          <option value="NEW_SALE">Yangi Sotuvlar</option>
          <option value="POST_SALE">Sayohat Jarayoni</option>
        </select>
        <input value={name} onChange={e => setName(e.target.value)} placeholder={t('pl.namePh')} style={inp} />
        <p style={{ fontSize: 11, color: 'var(--fg-3)', margin: '0 0 16px' }}>Default bosqichlar avtomatik qo'shiladi ({type === 'NEW_SALE' ? 11 : 3} ta).</p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-3)', color: 'var(--fg)', cursor: 'pointer' }}>{t('common.cancel')}</button>
          <button onClick={save} disabled={saving} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#3d7eff', color: 'white', cursor: 'pointer', fontWeight: 700 }}>{saving ? '...' : t('common.create')}</button>
        </div>
      </div>
    </div>
  );
}