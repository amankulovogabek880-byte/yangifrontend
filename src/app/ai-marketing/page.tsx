'use client';
import { useEffect, useState } from 'react';
import CrmLayout from '@/components/layout/CrmLayout';
import { aiMarketingApi } from '@/services/api';
import toast from 'react-hot-toast';

/**
 * ═══════════════════════════════════════════════════════════════
 * AI REKLAMA (TurMaker-uslubidagi generator) — 1 & 2-bosqich
 * ═══════════════════════════════════════════════════════════════
 * Manager tur ma'lumotlarini kiritadi → tizim avtomatik rasm topadi
 * (agar berilmagan bo'lsa) → AI (Claude) 3 ta tayyor post matnini
 * yozadi (Instagram/Telegram/Facebook) → alohida, 1080×1080 banner
 * ham yaratish mumkin → Telegram kanaliga to'g'ridan-to'g'ri
 * yuborish mumkin. Instagram hozircha faqat qo'lda joylash uchun
 * tayyorlanadi (Meta ruxsati hali yo'q — batafsil pastda).
 */

const inp: any = {
  padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--bg)', color: 'var(--fg)', fontSize: 13, width: '100%',
  boxSizing: 'border-box',
};
const btnPrimary: any = {
  padding: '10px 18px', borderRadius: 8, border: 'none', background: '#3d7eff',
  color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700,
};
const btnGhost: any = {
  padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)',
  background: 'var(--bg-3)', color: 'var(--fg)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600,
};
const card: any = {
  background: 'var(--bg-2)', border: '1px solid var(--border)',
  borderRadius: 12, padding: 16,
};
const lbl: any = {
  fontSize: 11.5, fontWeight: 600, color: 'var(--fg-2)', display: 'block', marginBottom: 5,
};
const checkboxRow: any = {
  display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--fg)',
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
};

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text)
    .then(() => toast.success(`${label} nusxalandi`))
    .catch(() => toast.error('Nusxalab bo\'lmadi'));
}

export default function AiMarketingPage() {
  const [form, setForm] = useState<any>(emptyForm);
  const [template, setTemplate] = useState<any>({ agencyName: '', agencyContact: '', primaryColor: '#FF6A2B' });
  const [templateOpen, setTemplateOpen] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [bannering, setBannering] = useState(false);
  const [result, setResult] = useState<any>(null); // { images, posts }
  const [bannerUrl, setBannerUrl] = useState<string>('');

  const [tgChatId, setTgChatId] = useState('');
  const [sendingTg, setSendingTg] = useState(false);
  const [tgTarget, setTgTarget] = useState<'instagram' | 'telegram' | 'facebook'>('telegram');

  // ── Shablonni yuklash ──
  useEffect(() => {
    aiMarketingApi.getTemplate()
      .then(r => {
        const t = r.data || {};
        setTemplate(t);
        setTgChatId(t.telegramChatId || '');
      })
      .catch(() => {});
  }, []);

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
  });

  const validate = () => {
    if (!form.destination.trim()) { toast.error("Yo'nalishni kiriting"); return false; }
    if (!form.price || Number(form.price) <= 0) { toast.error("Narxni to'g'ri kiriting"); return false; }
    return true;
  };

  // ── 1-bosqich: post + rasm generatsiya ──
  const doGenerate = async () => {
    if (!validate()) return;
    setGenerating(true);
    setResult(null);
    try {
      const res = await aiMarketingApi.generate(buildPayload());
      setResult(res.data);
      toast.success('Postlar tayyor!');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Xatolik yuz berdi');
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
      toast.success('Banner tayyor!');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Banner yaratib bo\'lmadi');
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
      toast.success('Shablon saqlandi');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Shablonni saqlab bo\'lmadi');
    } finally {
      setSavingTemplate(false);
    }
  };

  // ── Telegram kanaliga yuborish ──
  const doSendTelegram = async () => {
    if (!bannerUrl) { toast.error('Avval banner yarating'); return; }
    if (!tgChatId.trim()) { toast.error('Kanal ID/username kiriting (masalan @kanalim)'); return; }
    if (!result?.posts?.telegram) { toast.error('Avval post matnini yarating'); return; }

    setSendingTg(true);
    try {
      await aiMarketingApi.sendTelegram({
        chatId: tgChatId.trim(),
        photoUrl: bannerUrl,
        caption: result.posts.telegram,
      });
      toast.success('Telegram kanaliga yuborildi!');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Yuborib bo\'lmadi');
    } finally {
      setSendingTg(false);
    }
  };

  return (
    <CrmLayout>
      <div style={{ padding: 20, maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>✨ AI Reklama generatori</h1>
            <div style={{ fontSize: 12.5, color: 'var(--fg-2)', marginTop: 4 }}>
              Tur ma'lumotlarini kiriting — tizim avtomatik rasm topadi, post matnini yozadi va banner yaratadi.
            </div>
          </div>
          <button style={btnGhost} onClick={() => setTemplateOpen(o => !o)}>
            {templateOpen ? 'Shablonni yopish' : '⚙️ Shablon sozlamalari'}
          </button>
        </div>

        {/* ── Shablon sozlamalari ── */}
        {templateOpen && (
          <div style={{ ...card, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
              Agentlik shabloni
              <span style={{ fontSize: 11.5, fontWeight: 400, color: 'var(--fg-2)', marginLeft: 8 }}>
                — bir marta kiriting, har safar avtomatik ishlatiladi
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div>
                <label style={lbl}>Agentlik nomi</label>
                <input style={inp} value={template.agencyName || ''}
                  onChange={e => setTemplate((t: any) => ({ ...t, agencyName: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Kontakt (telefon/telegram)</label>
                <input style={inp} value={template.agencyContact || ''}
                  onChange={e => setTemplate((t: any) => ({ ...t, agencyContact: e.target.value }))} />
              </div>
              <div>
                <label style={lbl}>Brend rangi (banner narx chipi)</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="color" value={template.primaryColor || '#FF6A2B'}
                    onChange={e => setTemplate((t: any) => ({ ...t, primaryColor: e.target.value }))}
                    style={{ width: 40, height: 36, borderRadius: 6, border: '1px solid var(--border)', padding: 0 }} />
                  <input style={inp} value={template.primaryColor || '#FF6A2B'}
                    onChange={e => setTemplate((t: any) => ({ ...t, primaryColor: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={lbl}>Standart Telegram kanal (masalan @kanalim)</label>
                <input style={inp} value={tgChatId} placeholder="@kanalim_yoki_id"
                  onChange={e => setTgChatId(e.target.value)} />
              </div>
            </div>
            <div style={{ marginTop: 12, textAlign: 'right' }}>
              <button style={{ ...btnPrimary, opacity: savingTemplate ? 0.6 : 1 }}
                disabled={savingTemplate} onClick={doSaveTemplate}>
                {savingTemplate ? 'Saqlanmoqda...' : 'Shablonni saqlash'}
              </button>
            </div>
          </div>
        )}

        {/* ── Asosiy forma ── */}
        <div style={{ ...card, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={lbl}>Yo'nalish *</label>
              <input style={inp} placeholder="Antalya, Turkiya" value={form.destination}
                onChange={e => set('destination', e.target.value)} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={lbl}>Mehmonxona nomi</label>
              <input style={inp} placeholder="Rixos Premium" value={form.hotelName}
                onChange={e => set('hotelName', e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Yulduz</label>
              <select style={inp} value={form.hotelStars} onChange={e => set('hotelStars', e.target.value)}>
                {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} ★</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Ovqatlanish</label>
              <input style={inp} value={form.mealPlan} onChange={e => set('mealPlan', e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Necha kecha</label>
              <input style={inp} type="number" min={1} value={form.nights}
                onChange={e => set('nights', e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Kattalar</label>
              <input style={inp} type="number" min={1} value={form.adults}
                onChange={e => set('adults', e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Bolalar</label>
              <input style={inp} type="number" min={0} value={form.children}
                onChange={e => set('children', e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Narx *</label>
              <input style={inp} type="number" min={0} placeholder="699" value={form.price}
                onChange={e => set('price', e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Valyuta</label>
              <select style={inp} value={form.currency} onChange={e => set('currency', e.target.value)}>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="UZS">UZS</option>
              </select>
            </div>
            <div>
              <label style={lbl}>Jo'nash sanasi</label>
              <input style={inp} type="date" value={form.departureDate}
                onChange={e => set('departureDate', e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Qaytish sanasi</label>
              <input style={inp} type="date" value={form.returnDate}
                onChange={e => set('returnDate', e.target.value)} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={lbl}>Rasm URL (ixtiyoriy — bo'sh qoldirsangiz avtomatik topiladi)</label>
              <input style={inp} placeholder="https://..." value={form.imageUrl}
                onChange={e => set('imageUrl', e.target.value)} />
            </div>
          </div>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 14, marginBottom: 4 }}>
            <label style={checkboxRow}>
              <input type="checkbox" checked={form.includesFlights}
                onChange={e => set('includesFlights', e.target.checked)} /> Aviabilet
            </label>
            <label style={checkboxRow}>
              <input type="checkbox" checked={form.includesMeals}
                onChange={e => set('includesMeals', e.target.checked)} /> Ovqatlanish
            </label>
            <label style={checkboxRow}>
              <input type="checkbox" checked={form.includesTransfer}
                onChange={e => set('includesTransfer', e.target.checked)} /> Transfer
            </label>
            <label style={checkboxRow}>
              <input type="checkbox" checked={form.includesVisa}
                onChange={e => set('includesVisa', e.target.checked)} /> Viza
            </label>
            <label style={checkboxRow}>
              <input type="checkbox" checked={form.includesInsurance}
                onChange={e => set('includesInsurance', e.target.checked)} /> Sug'urta
            </label>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
            <button style={{ ...btnGhost, opacity: bannering ? 0.6 : 1 }} disabled={bannering} onClick={doBanner}>
              {bannering ? 'Banner yaratilmoqda...' : '🖼️ Banner yaratish'}
            </button>
            <button style={{ ...btnPrimary, opacity: generating ? 0.6 : 1 }} disabled={generating} onClick={doGenerate}>
              {generating ? 'Yaratilmoqda...' : '✨ Postlarni yaratish'}
            </button>
          </div>
        </div>

        {/* ── Banner natijasi ── */}
        {bannerUrl && (
          <div style={{ ...card, marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Tayyor banner</div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <img src={bannerUrl} alt="Banner" style={{ width: 260, height: 260, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <a href={bannerUrl} target="_blank" rel="noreferrer" style={{ ...btnGhost, textDecoration: 'none', textAlign: 'center' }}>
                  ⬇️ Yuklab olish
                </a>
                <button style={btnGhost} onClick={() => copyToClipboard(bannerUrl, 'Banner havolasi')}>
                  🔗 Havolani nusxalash
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Post natijalari ── */}
        {result?.posts && (
          <div style={{ ...card, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              {(['telegram', 'instagram', 'facebook'] as const).map(k => (
                <button key={k}
                  onClick={() => setTgTarget(k)}
                  style={{
                    ...btnGhost,
                    background: tgTarget === k ? '#3d7eff' : 'var(--bg-3)',
                    color: tgTarget === k ? 'white' : 'var(--fg)',
                    borderColor: tgTarget === k ? '#3d7eff' : 'var(--border)',
                  }}>
                  {k === 'telegram' ? '✈️ Telegram' : k === 'instagram' ? '📸 Instagram' : '👍 Facebook'}
                </button>
              ))}
            </div>

            <textarea
              readOnly
              value={result.posts[tgTarget] || ''}
              style={{ ...inp, minHeight: 160, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
            />

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12, flexWrap: 'wrap' }}>
              <button style={btnGhost} onClick={() => copyToClipboard(result.posts[tgTarget] || '', 'Matn')}>
                📋 Nusxalash
              </button>

              {tgTarget === 'telegram' && (
                <>
                  <input style={{ ...inp, width: 200 }} placeholder="@kanalim yoki chat ID"
                    value={tgChatId} onChange={e => setTgChatId(e.target.value)} />
                  <button style={{ ...btnPrimary, opacity: sendingTg ? 0.6 : 1 }}
                    disabled={sendingTg} onClick={doSendTelegram}>
                    {sendingTg ? 'Yuborilmoqda...' : '📤 Kanalga yuborish'}
                  </button>
                </>
              )}
            </div>

            {tgTarget === 'instagram' && (
              <div style={{
                marginTop: 10, padding: '10px 12px', borderRadius: 8, fontSize: 11.5, lineHeight: 1.6,
                background: 'var(--bg-3)', color: 'var(--fg-2)',
              }}>
                ℹ️ Instagram'ga avtomatik joylash hozircha yo'q (Meta'dan qo'shimcha ruxsat kerak).
                Yuqoridagi matnni nusxalab, bannerni yuklab olib, Instagram'ga qo'lda joylang.
              </div>
            )}

            {/* Avtomatik topilgan rasmlar (agar banner emas, faqat postlar yaratilgan bo'lsa) */}
            {Array.isArray(result.images) && result.images.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--fg-2)' }}>
                  Topilgan rasmlar:
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {result.images.map((img: string, i: number) => (
                    <img key={i} src={img} alt="" style={{ width: 90, height: 90, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </CrmLayout>
  );
}