'use client';
import { useEffect, useState, useCallback } from 'react';
import { jarvisBotApi } from '@/services/api';
import { useAuth } from '@/lib/store';
import toast from 'react-hot-toast';
import { errMsg } from '@/lib/helpers';

/**
 * JARVIS BOT — Sozlamalar bo'limi.
 *
 * G'OYA: mijozlar bilan gaplashadigan Telegram botlardan (Sozlamalar →
 * Telegram) FARQLI — bu ICHKI, faqat CRM xodimlari uchun bot:
 *   1) Har bir qo'ng'iroq AI tahlili tugagach — ADMINGA yuboriladi.
 *   2) Har kuni ertalab har bir AGENTGA shaxsiy AI brifing, ADMINGA
 *      jamoaviy brifing yuboriladi.
 *   3) Faqat ADMIN botga savol yozib Jarvis'dan javob olishi mumkin.
 *
 * Bitta tenantda FAQAT bitta Jarvis bot bo'ladi (backend shuni
 * kafolatlaydi — `JarvisBot.tenantId` unique).
 */

const inp: any = {
  padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--bg)', color: 'var(--fg)', fontSize: 13, width: '100%',
};
const btnPrimary: any = {
  padding: '9px 16px', borderRadius: 8, border: 'none', background: '#3d7eff',
  color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700,
};
const btnGhost: any = {
  padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--bg-3)', color: 'var(--fg)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
};
const btnDanger: any = {
  padding: '7px 12px', borderRadius: 8, border: '1px solid #ef444455',
  background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 12, fontWeight: 600,
};
const card: any = {
  border: '1px solid var(--border)', borderRadius: 12, padding: 16, marginBottom: 16,
  background: 'var(--bg-2)',
};
const label: any = { fontSize: 12, fontWeight: 700, color: 'var(--fg-2)', marginBottom: 6, display: 'block' };
const hint: any = { fontSize: 12, color: 'var(--fg-3)', lineHeight: 1.6 };

type LinkRow = { userId: string; name: string; role: string; isActive: boolean; linkedAt: string };
type Status = {
  connected: boolean;
  botUsername: string | null;
  notifyAdminOnAnalysis: boolean;
  dailyDigestEnabled: boolean;
  dailyDigestHour: number;
  links: LinkRow[];
  myLinked: boolean;
};

export default function JarvisBotSettings() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'TENANT_ADMIN';

  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [linkInfo, setLinkInfo] = useState<{ deepLink: string | null; code: string } | null>(null);
  const [gettingCode, setGettingCode] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    jarvisBotApi.status()
      .then((r) => setStatus(r.data))
      .catch(() => setStatus(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function connect() {
    if (!token.trim()) { toast.error("Bot tokenini kiriting"); return; }
    setConnecting(true);
    try {
      await jarvisBotApi.connect(token.trim());
      toast.success('Jarvis bot ulandi!');
      setToken('');
      load();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setConnecting(false);
    }
  }

  async function disconnect() {
    if (!confirm("Jarvis botni uzmoqchimisiz? Barcha bildirishnomalar to'xtaydi.")) return;
    try {
      await jarvisBotApi.disconnect();
      toast.success('Bot uzildi');
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  async function toggleSetting(key: 'notifyAdminOnAnalysis' | 'dailyDigestEnabled', value: boolean) {
    try {
      await jarvisBotApi.updateSettings({ [key]: value } as any);
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  async function changeDigestHour(hour: number) {
    try {
      await jarvisBotApi.updateSettings({ dailyDigestHour: hour });
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  async function getMyLinkCode() {
    setGettingCode(true);
    try {
      const r = await jarvisBotApi.linkCode();
      setLinkInfo({ deepLink: r.data.deepLink, code: r.data.code });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setGettingCode(false);
    }
  }

  async function unlinkUser(userId: string, name: string) {
    if (!confirm(`${name}ni Jarvis botdan uzasizmi?`)) return;
    try {
      await jarvisBotApi.unlink(userId);
      toast.success('Uzildi');
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  }

  if (loading) return <div style={card}><div style={hint}>Yuklanmoqda...</div></div>;

  return (
    <div>
      <div style={{ marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>🤖 Jarvis Bot</h3>
        <div style={hint}>
          Mijozlar botidan farqli — bu ICHKI Telegram bot: qo'ng'iroq tahlili adminga,
          kunlik AI brifing har bir agentga avtomatik yuboriladi, va admin botga to'g'ridan-to'g'ri
          savol yozib Jarvis'dan javob olishi mumkin. Har bir kompaniyada FAQAT bitta bot bo'ladi.
        </div>
      </div>

      {/* ── ADMIN: bot ulash/uzish ── */}
      {isAdmin && (
        <div style={card}>
          {!status?.connected ? (
            <>
              <label style={label}>Bot tokeni (@BotFather'dan olingan)</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  style={inp} placeholder="123456789:AAExampleTokenHere"
                  value={token} onChange={(e) => setToken(e.target.value)}
                />
                <button style={btnPrimary} disabled={connecting} onClick={connect}>
                  {connecting ? 'Ulanmoqda...' : 'Ulash'}
                </button>
              </div>
              <div style={{ ...hint, marginTop: 8 }}>
                1. Telegramda <b>@BotFather</b>ga yozing → <code>/newbot</code> → nom bering.<br />
                2. Olingan tokenni shu yerga joylang.<br />
                Bu bot FAQAT shu kompaniyaning xodimlari bilan ishlaydi — boshqa firmaga hech qachon aralashmaydi.
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700 }}>✅ Ulangan: @{status.botUsername}</div>
                  <div style={hint}>Bot ishlamoqda</div>
                </div>
                <button style={btnDanger} onClick={disconnect}>Uzish</button>
              </div>

              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <input
                    type="checkbox" checked={status.notifyAdminOnAnalysis}
                    onChange={(e) => toggleSetting('notifyAdminOnAnalysis', e.target.checked)}
                  />
                  Har bir qo'ng'iroq tahlilidan keyin adminga yuborish
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <input
                    type="checkbox" checked={status.dailyDigestEnabled}
                    onChange={(e) => toggleSetting('dailyDigestEnabled', e.target.checked)}
                  />
                  Kunlik AI brifingni botga yuborish
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                  <span>Yuborilish vaqti (Toshkent):</span>
                  <select
                    style={{ ...inp, width: 90 }} value={status.dailyDigestHour}
                    onChange={(e) => changeDigestHour(Number(e.target.value))}
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>
                    ))}
                  </select>
                </div>
              </div>

              {!!status.links.length && (
                <div style={{ marginTop: 16 }}>
                  <label style={label}>Ulangan xodimlar</label>
                  {status.links.map((l) => (
                    <div key={l.userId} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 13,
                    }}>
                      <span>{l.name} <span style={hint}>({l.role})</span></span>
                      <button style={btnGhost} onClick={() => unlinkUser(l.userId, l.name)}>Uzish</button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── HAMMA: o'zini botga ulash ── */}
      <div style={card}>
        <label style={label}>Mening ulanishim</label>
        {!status?.connected ? (
          <div style={hint}>Avval administrator Jarvis botni ulashi kerak.</div>
        ) : status.myLinked ? (
          <div style={hint}>✅ Siz allaqachon ulangansiz — bildirishnomalar Telegramingizga keladi.</div>
        ) : (
          <>
            <div style={{ ...hint, marginBottom: 10 }}>
              {isAdmin
                ? "Ulansangiz — qo'ng'iroq tahlillari, kunlik jamoaviy brifing shu yerga keladi, va botga savol yozib Jarvis'dan javob olasiz."
                : "Ulansangiz — har kuni ertalab shaxsiy AI brifingingiz Telegramingizga keladi."}
            </div>
            {!linkInfo ? (
              <button style={btnPrimary} disabled={gettingCode} onClick={getMyLinkCode}>
                {gettingCode ? 'Kod olinmoqda...' : 'Ulanish kodini olish'}
              </button>
            ) : (
              <div>
                {linkInfo.deepLink ? (
                  <a href={linkInfo.deepLink} target="_blank" rel="noreferrer" style={{ ...btnPrimary, display: 'inline-block', textDecoration: 'none' }}>
                    Telegramda ochish →
                  </a>
                ) : (
                  <div style={hint}>
                    Botga o'ting va yozing: <code>/start {linkInfo.code}</code>
                  </div>
                )}
                <div style={{ ...hint, marginTop: 8 }}>Kod 10 daqiqa amal qiladi.</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}