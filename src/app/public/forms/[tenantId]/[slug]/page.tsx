'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function PublicFormPage() {
  const params = useParams();
  const tenantId = params?.tenantId as string;
  const slug = params?.slug as string;

  const [form, setForm] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Form fields state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!tenantId || !slug) return;
    fetch(`${API_URL}/api/v1/public/forms/${tenantId}/${slug}`)
      .then(r => r.json())
      .then(data => {
        if (data?.id) {
          setForm(data);
        } else {
          setError('Forma topilmadi');
        }
      })
      .catch(() => setError('Forma yuklanmadi'))
      .finally(() => setLoading(false));
  }, [tenantId, slug]);

  const handleSubmit = async () => {
    if (!fullName.trim()) { setSubmitError('Ism majburiy'); return; }
    if (!phone.trim() && !email.trim()) { setSubmitError("Telefon yoki email kerak"); return; }

    setSubmitting(true);
    setSubmitError('');
    try {
      const res = await fetch(`${API_URL}/api/v1/public/forms/${tenantId}/${slug}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: fullName.trim(), phone: phone.trim() || undefined, email: email.trim() || undefined, message: message.trim() || undefined }),
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        setSubmitted(true);
      } else {
        setSubmitError(data?.message || "Yuborishda xato yuz berdi");
      }
    } catch {
      setSubmitError("Tarmoq xatosi. Qayta urinib ko'ring.");
    } finally {
      setSubmitting(false);
    }
  };

  const primaryColor = form?.theme?.primaryColor || '#3d7eff';

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8faff' }}>
      <div style={{ width: 36, height: 36, border: `3px solid ${primaryColor}`, borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8faff' }}>
      <div style={{ textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
        <div style={{ color: '#ef4444', fontWeight: 600 }}>{error}</div>
      </div>
    </div>
  );

  if (submitted) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8faff', padding: 20 }}>
      <div style={{ textAlign: 'center', padding: '40px 32px', background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', maxWidth: 420, width: '100%' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
        <h2 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 700, color: '#111' }}>
          {form?.successMsg || 'Rahmat!'}
        </h2>
        <p style={{ margin: 0, color: '#64748b', fontSize: 14 }}>
          Murojaat qabul qilindi. Tez orada siz bilan bog'lanamiz.
        </p>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8faff', padding: 20, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <div style={{ width: '100%', maxWidth: 480, background: '#fff', borderRadius: 16, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', padding: '32px 28px' }}>
        {/* Header */}
        <h2 style={{ margin: '0 0 6px', fontSize: 22, fontWeight: 700, color: '#111' }}>
          {form?.name || 'Lead Form'}
        </h2>
        {form?.description && (
          <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: 14 }}>{form.description}</p>
        )}
        {!form?.description && <div style={{ marginBottom: 20 }} />}

        {/* Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="text"
            placeholder="Ism Familiya *"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            style={inputStyle}
          />
          <input
            type="tel"
            placeholder="Telefon raqam (+998...)"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            style={inputStyle}
          />
          <input
            type="email"
            placeholder="Email (ixtiyoriy)"
            value={email}
            onChange={e => setEmail(e.target.value)}
            style={inputStyle}
          />
          <textarea
            placeholder="Xabar (ixtiyoriy)"
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={3}
            style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
          />
        </div>

        {/* Error */}
        {submitError && (
          <div style={{ marginTop: 12, padding: '10px 14px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#ef4444', fontSize: 13 }}>
            ❌ {submitError}
          </div>
        )}

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            marginTop: 16, width: '100%', padding: '14px 0',
            background: submitting ? '#94a3b8' : primaryColor,
            color: '#fff', border: 'none', borderRadius: 10,
            fontSize: 15, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
          }}
        >
          {submitting ? '⏳ Yuborilmoqda...' : 'Yuborish'}
        </button>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '12px 14px',
  border: '1.5px solid #e2e8f0',
  borderRadius: 10,
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
  color: '#111',
  background: '#f8faff',
  transition: 'border-color 0.15s',
};
