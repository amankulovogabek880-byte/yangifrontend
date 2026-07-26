'use client';
import { useEffect, useState } from 'react';
import CrmLayout from '@/components/layout/CrmLayout';
import { aiMarketingApi, usersApi } from '@/services/api';
import toast from 'react-hot-toast';

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
};

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text)
    .then(() => toast.success(`${label} nusxalandi`))
    .catch(() => toast.error("Nusxalab bo'lmadi"));
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

// ── Jonli banner preview — backenddagi buildBannerSvg bilan bir xil tarkib ──
function LivePreview({ form, template, generatedUrl }: { form: any; template: any; generatedUrl?: string }) {
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

  return (
    <div style={{
      position: 'relative', width: '100%', aspectRatio: '1 / 1', borderRadius: 16,
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
          <div style={{ fontSize: 11.5, fontWeight: 600, opacity: 0.85 }}>Rasm tanlanmagan — pastda qidiring</div>
        </div>
      )}

      {/* Pastki qorong'ilashuv — matn o'qilishi uchun (qorong'ilik darajasi sozlanadi) */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,${(darkness * 0.18).toFixed(2)}) 55%, rgba(0,0,0,${darkness.toFixed(2)}) 100%)`,
      }} />

      <div style={{ position: 'absolute', left: '6%', right: '6%', bottom: '5%', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 9 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 'clamp(8.5px,1.7vw,10.5px)',
            fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', color: accent,
            background: 'rgba(255,255,255,0.12)', border: `1px solid ${accent}55`, backdropFilter: 'blur(6px)',
            padding: '3px 9px', borderRadius: 999,
          }}>
            ✨ {L.offer}
          </div>
          {(form.extraTexts || []).filter(Boolean).slice(0, 4).map((txt: string, i: number) => (
            <div key={i} style={{
              fontSize: 'clamp(8.5px,1.7vw,10.5px)', fontWeight: 700, color: '#fff',
              background: accent, padding: '3px 10px', borderRadius: 999,
            }}>{txt}</div>
          ))}
        </div>

        {stars && (
          <div style={{ color: '#FFD54A', fontWeight: 700, fontSize: 'clamp(11px,2.4vw,14px)', letterSpacing: 2, marginBottom: 5 }}>{stars}</div>
        )}
        <div style={{ fontWeight: 800, fontSize: 'clamp(19px,4.6vw,29px)', lineHeight: 1.14, letterSpacing: '-0.01em', textShadow: '0 2px 12px rgba(0,0,0,0.45)', color: textColor }}>
          {form.destination || "Yo'nalishni kiriting"}
        </div>
        {form.hotelName && !useHotelList && (
          <div style={{ fontWeight: 600, fontSize: 'clamp(12px,2.6vw,15.5px)', marginTop: 4, color: textColor, opacity: 0.94 }}>{form.hotelName}</div>
        )}
        {infoParts.length > 0 && (
          <div style={{ fontSize: 'clamp(10px,2.1vw,12.5px)', marginTop: 6, color: textColor, opacity: 0.85, fontWeight: 500 }}>{infoParts.join('   ·   ')}</div>
        )}

        {useHotelList ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 13 }}>
            {priceText ? (
              <span style={{
                background: accent, color: '#fff', fontWeight: 800, padding: '9px 16px', borderRadius: 12,
                fontSize: 'clamp(13px,2.9vw,19px)', letterSpacing: '-0.01em', whiteSpace: 'nowrap',
                boxShadow: `0 8px 20px -6px ${accent}99`, flexShrink: 0,
              }}>{priceText}</span>
            ) : <span />}
            {dateLine && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
                fontSize: 'clamp(9.5px,2vw,11.5px)', fontWeight: 600, color: '#fff',
                background: 'rgba(255,255,255,0.14)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.18)', padding: '7px 11px', borderRadius: 999,
              }}>📅 {dateLine}</span>
            )}
          </div>
        )}

        {footer && (
          <>
            <div style={{ height: 1, background: 'rgba(255,255,255,0.16)', margin: '11px 0 8px' }} />
            <div style={{ fontSize: 'clamp(8.5px,1.8vw,11px)', color: '#c8ccd6', fontWeight: 500 }}>{footer}</div>
          </>
        )}
      </div>

      {generatedUrl && (
        <span className="badge badge-success" style={{ position: 'absolute', top: 10, right: 10 }}>✓ Tayyor banner</span>
      )}
      {!generatedUrl && (
        <span className="badge badge-gray" style={{ position: 'absolute', top: 10, right: 10 }}>Jonli preview</span>
      )}
    </div>
  );
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
  const [sharing, setSharing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [activeTab, setActiveTab] = useState<'instagram' | 'telegram' | 'facebook'>('telegram');

  const [searchingImages, setSearchingImages] = useState(false);
  const [imageResults, setImageResults] = useState<string[]>([]);

  const [sendingFb, setSendingFb] = useState(false);
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
    if (!form.destination.trim()) { toast.error("Avval yo'nalishni kiriting"); return; }
    setLoadingTgPreview(true);
    try {
      const res = await aiMarketingApi.renderTelegramTemplate(buildPayload());
      setTelegramTemplatePreview(res?.data?.text || '');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Andozani ko'rsatib bo'lmadi");
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
  });

  const validate = () => {
    if (!form.destination.trim()) { toast.error("Yo'nalishni kiriting"); return false; }
    if (!form.price || Number(form.price) <= 0) { toast.error("Narxni to'g'ri kiriting"); return false; }
    return true;
  };

  // ── Rasm avtomatik qidirish (Pexels) — mavjud /ai-marketing/images endpointi ──
  const doSearchImages = async () => {
    if (!form.destination.trim()) { toast.error("Avval yo'nalishni kiriting"); return; }
    setSearchingImages(true);
    setImageResults([]);
    try {
      const res = await aiMarketingApi.images(`${form.destination} hotel resort travel`, 20);
      const imgs: string[] = res.data || [];
      setImageResults(imgs);
      if (!imgs.length) toast("Rasm topilmadi — URL'ni qo'lda kiriting", { icon: 'ℹ️' });
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Rasm qidirib bo'lmadi");
    } finally {
      setSearchingImages(false);
    }
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
      toast.error(e?.response?.data?.message || "Banner yaratib bo'lmadi");
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
      toast.error(e?.response?.data?.message || "Shablonni saqlab bo'lmadi");
    } finally {
      setSavingTemplate(false);
    }
  };

  // ── Telegram kanaliga to'g'ridan-to'g'ri yuborish (bot orqali) ──
  const doSendTelegram = async () => {
    if (!bannerUrl) { toast.error('Avval banner yarating'); return; }
    if (!tgChatId.trim()) { toast.error("Kanal ID/username kiriting (masalan @kanalim)"); return; }

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
    if (!caption) { toast.error('Avval post matnini yarating'); return; }

    setSendingTg(true);
    try {
      await aiMarketingApi.sendTelegram({
        chatId: tgChatId.trim(),
        photoUrl: bannerUrl,
        caption,
      });
      toast.success('Telegram kanaliga yuborildi!');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Yuborib bo'lmadi");
    } finally {
      setSendingTg(false);
    }
  };

  // ── Yuklab olish (haqiqiy fayl) ──
  const doDownload = async () => {
    if (!bannerUrl) { toast.error('Avval banner yarating'); return; }
    setDownloading(true);
    const ok = await forceDownload(bannerUrl, `tur-banner-${Date.now()}.png`);
    toast[ok ? 'success' : 'error'](ok ? 'Banner yuklab olindi' : "Avtomatik yuklab bo'lmadi — rasm yangi oynada ochildi, o'ngdan saqlang");
    setDownloading(false);
  };

  // ── Telefon ulashish oynasi orqali yuborish (Instagram/Telegram/boshqa) ──
  const doShare = async () => {
    if (!bannerUrl) { toast.error('Avval banner yarating'); return; }
    const caption = result?.posts?.[activeTab] || '';
    setSharing(true);
    const status = await shareBanner(bannerUrl, caption);
    if (status === 'shared') toast.success('Ulashish oynasi orqali yuborildi!');
    else if (status === 'shared-link') toast.success('Havola ulashildi');
    else {
      toast(
        activeTab === 'instagram'
          ? "Bu qurilmada to'g'ridan-to'g'ri ulashish yo'q. Bannerni yuklab oling va Instagram'ga qo'lda joylang."
          : "Ulashish qo'llab-quvvatlanmadi — banner yuklab olindi, qo'lda yuboring.",
        { icon: 'ℹ️' },
      );
      await forceDownload(bannerUrl, `tur-banner-${Date.now()}.png`);
    }
    setSharing(false);
  };

  // ── Facebook sahifasiga (Page) avtomatik joylash ──
  const doSendFacebook = async () => {
    if (!bannerUrl) { toast.error('Avval banner yarating'); return; }
    if (!result?.posts?.facebook) { toast.error('Avval post matnini yarating'); return; }

    setSendingFb(true);
    try {
      await aiMarketingApi.sendFacebook({ photoUrl: bannerUrl, caption: result.posts.facebook });
      toast.success('Facebook sahifasiga yuborildi!');
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Yuborib bo'lmadi");
    } finally {
      setSendingFb(false);
    }
  };

  // ── Tarix: saqlash / ro'yxatni yuklash / bittasini ochish / o'chirish ──
  const doSaveHistory = async () => {
    if (!bannerUrl && !result?.posts) { toast.error("Avval banner yoki post yarating"); return; }
    setSavingHistory(true);
    try {
      await aiMarketingApi.saveHistory({
        input: buildPayload(),
        bannerUrl: bannerUrl || undefined,
        posts: result?.posts || undefined,
      });
      toast.success('Tarixga saqlandi');
      if (historyOpen) refreshHistory();
    } catch (e: any) {
      toast.error(e?.response?.data?.message || "Saqlab bo'lmadi");
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
      toast.error("Tarixni yuklab bo'lmadi");
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
    setForm((f: any) => ({ ...f, ...item.input }));
    setBannerUrl(item.bannerUrl || '');
    setResult(item.posts ? { posts: item.posts } : null);
    setHistoryOpen(false);
    toast.success("Yuklandi — pastda tahrirlab qayta yuborishingiz mumkin");
  };

  const doDeleteHistoryItem = async (id: string) => {
    try {
      await aiMarketingApi.deleteHistoryItem(id);
      setHistoryItems((items) => items.filter((h) => h.id !== id));
    } catch {
      toast.error("O'chirib bo'lmadi");
    }
  };

  const addExtraText = () => {
    if ((form.extraTexts || []).length >= 4) { toast.error("Ko'pi bilan 4 ta qo'shimcha matn"); return; }
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
    if ((form.hotels || []).length >= 3) { toast.error("Ko'pi bilan 3 ta mehmonxona"); return; }
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

  return (
    <CrmLayout>
      <div style={{ padding: 20, maxWidth: 1320, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 21, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                display: 'inline-flex', width: 34, height: 34, borderRadius: 10, background: 'var(--gradient)',
                alignItems: 'center', justifyContent: 'center', fontSize: 17,
              }}>✨</span>
              AI Reklama generatori
            </h1>
            <div style={{ fontSize: 12.5, color: 'var(--fg-2)', marginTop: 6 }}>
              Tur ma'lumotlarini kiriting — o'ngda banner qanday chiqishini darhol ko'rasiz. Rasm bermasangiz ham
              tizim o'zi topadi, matnni Claude yozadi, banner esa aniq narx bilan avtomatik chiziladi.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-md btn-ghost" onClick={toggleHistory}>
              {historyOpen ? 'Tarixni yopish' : '🗂️ Tarix'}
            </button>
            <button className="btn btn-md btn-ghost" onClick={() => setTemplateOpen(o => !o)}>
              {templateOpen ? 'Shablonni yopish' : '⚙️ Shablon sozlamalari'}
            </button>
          </div>
        </div>

        {/* ── Tarix (avval saqlangan reklamalar) ── */}
        {historyOpen && (
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
              Saqlangan reklamalar
              <span style={{ fontSize: 11.5, fontWeight: 400, color: 'var(--fg-2)', marginLeft: 8 }}>
                — bosing va formaga qayta yuklanadi
              </span>
            </div>
            {loadingHistory ? (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12.5 }}>Yuklanmoqda...</div>
            ) : historyItems.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--fg-3)', fontSize: 12.5 }}>
                Hali hech narsa saqlanmagan — banner/post tayyor bo'lgach "💾 Tarixga saqlash" tugmasini bosing.
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
              Agentlik shabloni
              <span style={{ fontSize: 11.5, fontWeight: 400, color: 'var(--fg-2)', marginLeft: 8 }}>
                — bir marta kiriting, har safar avtomatik ishlatiladi
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Agentlik nomi</label>
                <input className="form-input" value={template.agencyName || ''}
                  onChange={e => setTemplate((t: any) => ({ ...t, agencyName: e.target.value }))} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Kontakt (telefon/telegram)</label>
                <input className="form-input" value={template.agencyContact || ''}
                  onChange={e => setTemplate((t: any) => ({ ...t, agencyContact: e.target.value }))} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Brend rangi (banner narx chipi)</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="color" value={template.primaryColor || '#FF6A2B'}
                    onChange={e => setTemplate((t: any) => ({ ...t, primaryColor: e.target.value }))}
                    style={{ width: 40, height: 36, borderRadius: 8, border: '1px solid var(--border)', padding: 0, background: 'none' }} />
                  <input className="form-input" value={template.primaryColor || '#FF6A2B'}
                    onChange={e => setTemplate((t: any) => ({ ...t, primaryColor: e.target.value }))} />
                </div>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Standart Telegram kanal</label>
                <input className="form-input" value={tgChatId} placeholder="@kanalim_yoki_id"
                  onChange={e => setTgChatId(e.target.value)} />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <label className="form-label">
                Telegram xabar andozasi
                <span style={{ fontWeight: 400, color: 'var(--fg-3)', marginLeft: 6 }}>
                  (ixtiyoriy — Claude yozgan erkin matn o'rniga qat'iy formatda yuborish uchun)
                </span>
              </label>
              <textarea className="form-input" style={{ minHeight: 110, fontFamily: 'monospace', fontSize: 12.5 }}
                placeholder={"🌴 {destination}\n{hotel}\n\n📅 {dates} ({nights} kecha)\n👥 {people}\n🍽 {meal}\n\n💰 Narx: {price}\n\n📞 {agency} — {contact}"}
                value={template.telegramMessageTemplate || ''}
                onChange={e => setTemplate((t: any) => ({ ...t, telegramMessageTemplate: e.target.value }))} />
              <div style={{ fontSize: 10.5, color: 'var(--fg-3)', marginTop: 4 }}>
                Mavjud placeholder'lar: {'{destination} {hotel} {stars} {nights} {meal} {people} {price} {dates} {agency} {contact}'}
              </div>
            </div>
            <div style={{ marginTop: 12, textAlign: 'right' }}>
              <button className="btn btn-md btn-primary" disabled={savingTemplate} onClick={doSaveTemplate}>
                {savingTemplate ? 'Saqlanmoqda...' : 'Shablonni saqlash'}
              </button>
            </div>
          </div>
        )}

        {/* ── Asosiy: forma (chap) + jonli preview (o'ng) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(300px, 1fr)', gap: 18, alignItems: 'start' }}>

          {/* ── CHAP: forma ── */}
          <div className="card">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <div className="form-group" style={{ gridColumn: 'span 2', margin: 0 }}>
                <label className="form-label">Yo'nalish *</label>
                <input className="form-input" placeholder="Antalya, Turkiya" value={form.destination}
                  onChange={e => set('destination', e.target.value)} />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2', margin: 0 }}>
                <label className="form-label">Mehmonxona nomi</label>
                <input className="form-input" placeholder="Rixos Premium" value={form.hotelName}
                  onChange={e => set('hotelName', e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Yulduz</label>
                <select className="form-input" value={form.hotelStars} onChange={e => set('hotelStars', e.target.value)}>
                  {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} ★</option>)}
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Ovqatlanish</label>
                <input className="form-input" value={form.mealPlan} onChange={e => set('mealPlan', e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Necha kecha</label>
                <input className="form-input" type="number" min={1} value={form.nights}
                  onChange={e => set('nights', e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Kattalar</label>
                <input className="form-input" type="number" min={1} value={form.adults}
                  onChange={e => set('adults', e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Bolalar</label>
                <input className="form-input" type="number" min={0} value={form.children}
                  onChange={e => set('children', e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Narx *</label>
                <input className="form-input" type="number" min={0} placeholder="699" value={form.price}
                  onChange={e => set('price', e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Valyuta</label>
                <select className="form-input" value={form.currency} onChange={e => set('currency', e.target.value)}>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="UZS">UZS</option>
                </select>
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Jo'nash sanasi</label>
                <input className="form-input" type="date" value={form.departureDate}
                  onChange={e => set('departureDate', e.target.value)} />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Qaytish sanasi</label>
                <input className="form-input" type="date" value={form.returnDate}
                  onChange={e => set('returnDate', e.target.value)} />
              </div>
            </div>

            {/* ── Rasm: qo'lda URL yoki avtomatik qidirish ── */}
            <div style={{ marginTop: 14 }}>
              <label className="form-label">Fon surati</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input className="form-input" placeholder="https://... (bo'sh qoldirsangiz avtomatik topiladi)"
                  value={form.imageUrl} onChange={e => set('imageUrl', e.target.value)} />
                <button className="btn btn-md btn-secondary" style={{ flexShrink: 0 }}
                  disabled={searchingImages} onClick={doSearchImages}>
                  {searchingImages ? 'Qidirilmoqda...' : '🔍 Rasm topish'}
                </button>
              </div>
              {imageResults.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--fg-3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                    {imageResults.length} ta variant — birini tanlang
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 8 }}>
                    {imageResults.map((img, i) => {
                      const selected = form.imageUrl === img;
                      return (
                        <button key={i} type="button"
                          onClick={() => { set('imageUrl', img); toast.success('Rasm tanlandi'); }}
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
                { k: 'includesFlights', label: '✈️ Aviabilet' },
                { k: 'includesMeals', label: '🍽️ Ovqatlanish' },
                { k: 'includesTransfer', label: '🚕 Transfer' },
                { k: 'includesVisa', label: '🛂 Viza' },
                { k: 'includesInsurance', label: "🛡️ Sug'urta" },
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
              <label className="form-label">Reklama matni tili</label>
              <div style={{ fontSize: 11, color: 'var(--fg-3)', marginBottom: 6 }}>
                (bu — ilova tili emas, mijozga chiqadigan banner/post matni qaysi tilda yozilishi)
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
                <label className="form-label" style={{ margin: 0 }}>Qo'shimcha urg'u matnlari</label>
                <button type="button" className="btn btn-sm btn-ghost" onClick={addExtraText}>+ Qo'shish</button>
              </div>
              {(form.extraTexts || []).length === 0 ? (
                <div style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>
                  Masalan: "Bepul transfer!", "Cheklangan joylar" — bannerda kichik chip sifatida chiqadi
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(form.extraTexts || []).map((txt: string, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: 8 }}>
                      <input className="form-input" value={txt} placeholder="Bepul transfer!"
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
                <label className="form-label">Bannerda kimning kontakti chiqsin?</label>
                <select className="form-input" value={selectedStaffId} onChange={(e) => pickStaff(e.target.value)}>
                  <option value="">— Agentlik shabloni (standart) —</option>
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
                  Ko'p mehmonxona/narx solishtirish
                </label>
                <button type="button" className="btn btn-sm btn-ghost" onClick={addHotelRow}>+ Mehmonxona</button>
              </div>
              {(form.hotels || []).length === 0 ? (
                <div style={{ fontSize: 11.5, color: 'var(--fg-3)' }}>
                  2-3 ta mehmonxonani narxi bilan bitta bannerda solishtirib ko'rsating (yuqoridagi asosiy Narx maydoni e'tiborga olinmaydi)
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(form.hotels || []).map((h: any, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: 8 }}>
                      <input className="form-input" style={{ flex: 2 }} value={h.name} placeholder="Mehmonxona nomi"
                        onChange={(e) => updateHotelRow(i, { name: e.target.value })} />
                      <select className="form-input" style={{ flex: 1 }} value={h.stars || 5}
                        onChange={(e) => updateHotelRow(i, { stars: e.target.value })}>
                        {[5, 4, 3, 2, 1].map(n => <option key={n} value={n}>{n} ★</option>)}
                      </select>
                      <input className="form-input" style={{ flex: 1 }} type="number" value={h.price} placeholder="Narx"
                        onChange={(e) => updateHotelRow(i, { price: e.target.value })} />
                      <button type="button" className="btn btn-sm btn-ghost" onClick={() => removeHotelRow(i)}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <details style={{ marginTop: 16 }}>
              <summary style={{ cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--fg-2)' }}>
                🎨 Dizaynni moslashtirish (shrift, rang, ramka)
              </summary>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 12 }}>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Shrift</label>
                  <select className="form-input" value={form.fontFamily} onChange={(e) => set('fontFamily', e.target.value)}>
                    <option value="sans-serif">Sans-serif (standart)</option>
                    <option value="serif">Serif</option>
                    <option value="monospace">Monospace</option>
                    <option value="Georgia, serif">Georgia</option>
                    <option value="'Trebuchet MS', sans-serif">Trebuchet</option>
                  </select>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Matn rangi</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="color" value={form.textColor} onChange={(e) => set('textColor', e.target.value)}
                      style={{ width: 40, height: 36, borderRadius: 8, border: '1px solid var(--border)', padding: 0, background: 'none' }} />
                    <input className="form-input" value={form.textColor} onChange={(e) => set('textColor', e.target.value)} />
                  </div>
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Fon qorong'iligi ({Math.round(form.overlayDarkness * 100)}%)</label>
                  <input type="range" min={0.3} max={0.95} step={0.01} value={form.overlayDarkness}
                    onChange={(e) => set('overlayDarkness', Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--primary)' }} />
                </div>
                <div className="form-group" style={{ margin: 0 }}>
                  <label className="form-label">Ramka qalinligi ({form.borderWidth}px)</label>
                  <input type="range" min={0} max={20} step={1} value={form.borderWidth}
                    onChange={(e) => set('borderWidth', Number(e.target.value))}
                    style={{ width: '100%', accentColor: 'var(--primary)' }} />
                </div>
                {form.borderWidth > 0 && (
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Ramka rangi</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input type="color" value={form.borderColor || template.primaryColor || '#FF6A2B'}
                        onChange={(e) => set('borderColor', e.target.value)}
                        style={{ width: 40, height: 36, borderRadius: 8, border: '1px solid var(--border)', padding: 0, background: 'none' }} />
                      <input className="form-input" value={form.borderColor} placeholder="brend rangi (standart)"
                        onChange={(e) => set('borderColor', e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
            </details>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-lg btn-secondary" disabled={bannering} onClick={doBanner}>
                {bannering ? 'Banner yaratilmoqda...' : '🖼️ Banner yaratish'}
              </button>
              <button className="btn btn-lg btn-gradient" disabled={generating} onClick={doGenerate}>
                {generating ? 'Yaratilmoqda...' : '✨ Postlarni yaratish'}
              </button>
            </div>
          </div>

          {/* ── O'NG: jonli preview + yuborish ── */}
          <div style={{ position: 'sticky', top: 70, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <LivePreview form={form} template={template} generatedUrl={bannerUrl} />

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn btn-md btn-primary" style={{ flex: 1 }} disabled={!bannerUrl || downloading} onClick={doDownload}>
                {downloading ? 'Yuklanmoqda...' : '⬇️ Yuklab olish'}
              </button>
              <button className="btn btn-md btn-secondary" style={{ flex: 1 }} disabled={!bannerUrl || sharing} onClick={doShare}>
                {sharing ? 'Ulashilmoqda...' : '📤 Ulashish'}
              </button>
              <button className="btn btn-md btn-ghost" disabled={!bannerUrl}
                onClick={() => copyToClipboard(bannerUrl, 'Banner havolasi')}>
                🔗
              </button>
              <button className="btn btn-md btn-ghost" disabled={(!bannerUrl && !result?.posts) || savingHistory}
                onClick={doSaveHistory} title="Tarixga saqlash">
                {savingHistory ? '...' : '💾'}
              </button>
            </div>

            {!bannerUrl && (
              <div style={{ fontSize: 11.5, color: 'var(--fg-3)', textAlign: 'center', lineHeight: 1.5 }}>
                Chapdagi maydonlarni to'ldiring — preview shu zahoti yangilanadi. Tayyor bo'lgach "Banner yaratish"ni bosing.
              </div>
            )}

            {/* ── Post matnlari ── */}
            {result?.posts && (
              <div className="card" style={{ padding: 14 }}>
                <div className="tabs-bar" style={{ padding: 0, marginBottom: 10, background: 'none' }}>
                  {(['telegram', 'instagram', 'facebook'] as const).map(k => (
                    <button key={k} className={`tab-btn ${activeTab === k ? 'active' : ''}`} onClick={() => setActiveTab(k)}>
                      {platformMeta[k].icon} {platformMeta[k].label}
                    </button>
                  ))}
                </div>

                <textarea
                  readOnly
                  value={result.posts[activeTab] || ''}
                  className="form-input"
                  style={{ minHeight: 150, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
                />

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10, flexWrap: 'wrap' }}>
                  <button className="btn btn-sm btn-ghost" onClick={() => copyToClipboard(result.posts[activeTab] || '', 'Matn')}>
                    📋 Nusxalash
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
                      Claude matni o'rniga qat'iy shablon (andoza) ishlatish
                    </label>
                    {useTelegramTemplate && (
                      <textarea readOnly value={loadingTgPreview ? 'Yuklanmoqda...' : telegramTemplatePreview}
                        className="form-input" style={{ minHeight: 120, marginTop: 6, fontFamily: 'monospace', fontSize: 12 }} />
                    )}
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <input className="form-input" placeholder="@kanalim yoki chat ID"
                        value={tgChatId} onChange={e => setTgChatId(e.target.value)} />
                      <button className="btn btn-md btn-primary" style={{ flexShrink: 0 }}
                        disabled={sendingTg} onClick={doSendTelegram}>
                        {sendingTg ? '...' : '📤 Kanalga yuborish'}
                      </button>
                    </div>
                  </>
                )}

                {activeTab === 'instagram' && (
                  <div style={{
                    marginTop: 10, padding: '10px 12px', borderRadius: 8, fontSize: 11.5, lineHeight: 1.6,
                    background: 'var(--bg-3)', color: 'var(--fg-2)',
                  }}>
                    ℹ️ Instagram hozircha faqat qo'lda joylashga ruxsat beradi (Meta'dan
                    <code style={{ margin: '0 4px' }}>instagram_content_publish</code>
                    ruxsati kerak, hali tasdiqlanmagan). Yuqoridagi <b>📤 Ulashish</b> tugmasi telefoningizda
                    Instagram'ni to'g'ridan-to'g'ri ochib beradi — rasm va matnni tanlab, bir necha soniyada joylaysiz.
                  </div>
                )}

                {activeTab === 'facebook' && (
                  <>
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                      <button className="btn btn-md btn-primary" style={{ flex: 1 }}
                        disabled={sendingFb} onClick={doSendFacebook}>
                        {sendingFb ? '...' : '📘 Sahifaga yuborish'}
                      </button>
                    </div>
                    <div style={{
                      marginTop: 8, padding: '10px 12px', borderRadius: 8, fontSize: 11.5, lineHeight: 1.6,
                      background: 'var(--bg-3)', color: 'var(--fg-2)',
                    }}>
                      ℹ️ Bu tugma Sozlamalar → Facebook Ads'da ulangan sahifangizga to'g'ridan-to'g'ri joylaydi.
                      Agar xato chiqsa (masalan ruxsat yetarli emas), sahifani Sozlamalar → Facebook Ads'da
                      qaytadan ulang — yangi ulanish kerakli ruxsatni so'raydi.
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