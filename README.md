# TourCRM v8 Frontend

Backend v8 ga to'liq mos keluvchi premium frontend. Bitrix darajasidagi UX bilan.

## ✨ v8 YANGILIKLAR

### 🎯 Client Profile 360°
Hammasi bir sahifada — klient haqida hech qaerga o'tmasdan barchasini ko'rasiz:
- 👤 Mijoz ma'lumotlari (passport, manzil, tug'ilgan sana)
- 🕐 Activity Timeline (50 ta oxirgi harakat)
- ✈️ Bookinglar (to'lovlari bilan)
- 💰 To'lovlar tarixi
- 🧾 Invoice'lar (foyda admin'ga ko'rinadi)
- ☑ Vazifalar va eslatmalar
- 📝 Izohlar (asosiy + 🔒 ichki)
- 📁 Hujjatlar

### 📞 Multi-Provider DialerWidget
- `tel:` link rejimi — telefoningiz ochiladi (bepul)
- OnlinePBX rejimi — recording bilan
- STUB rejimi — demo uchun
- Real-time WebSocket status

### 🧭 Soda Sidebar (8 ta menu)
1. ◉ Dashboard
2. ✉ Inbox
3. ⊞ Pipeline
4. ◍ Clients
5. ✈ Bookings
6. $ Payments
7. ◬ Reports
8. ⚙ Settings

**Olib tashlandi**: Tasks, FollowUps, Team, KPI, Security (hammasi Client Profile ichida yoki Settings'da)

### 📊 Real-time Dashboard
- Sotuv bo'lganda **avtomatik yangilanadi** (WebSocket)
- Agent uchun **shaxsiy stats**: leadlar, bookinglar, profit
- Admin uchun **jamoa stats**: jami revenue, conversions

### ☑ Booking Checklist
- 8 ta default item (Passport, Visa, Hotel voucher...)
- Progress bar
- Qo'shish/o'chirish
- Kim qachon bajargani ko'rinadi

### ⚙ Settings (5 ta tab)
- ⚙ Umumiy (tema, til)
- 📞 Telefon (mening raqamim + provayder)
- 👤 Profil
- 🔐 Xavfsizlik
- 🏢 Kompaniya

### 🎨 Dizayn
- Premium dark/light tema (CSS variables)
- Inter font
- Soft gradientlar
- Mobile responsive

## 🚀 Ishga tushirish

```bash
unzip tourcrm-v8-frontend.zip
cd tourcrm-v8-frontend
cp .env.example .env
npm install
npm run dev
```

→ http://localhost:3001 (port 3000 backend uchun)

## ⚙ Test loginlar

| Rol | Email | Parol |
|-----|-------|-------|
| Admin | admin@demo.uz | Admin@123456! |
| Agent | aziz@demo.uz | Agent@123456! |

## 📋 Asosiy sahifalar

| Sahifa | URL | Tavsif |
|--------|-----|--------|
| Dashboard | `/dashboard` | KPI + chart + upcoming |
| Inbox | `/inbox` | Telegram/WhatsApp chatlar |
| Pipeline | `/pipeline` | Kanban board |
| Clients | `/clients` | Klientlar ro'yxati |
| Client 360 | `/clients/[id]` | **Hamma narsa bir sahifada** |
| Bookings | `/bookings` | Bookinglar ro'yxati |
| Booking Detail | `/bookings/[id]` | Tabs: overview, checklist, hotel, ... |
| Payments | `/payments` | To'lovlar |
| Reports | `/reports` | Hisobotlar |
| Settings | `/settings` | Sozlamalar (5 tab) |

## 📞 Telefon sozlash

### Agent o'z raqamini saqlash
1. **Settings** → **Telefon** tab
2. **"Mening shaxsiy raqamim"** ga yozish (+998901234567)
3. Saqlash

### Admin tomonidan kompaniya provayderini sozlash
1. **Settings** → **Telefon** tab
2. **Provayder** tanlash (STUB/TEL_LINK/ONLINEPBX/TWILIO)
3. ONLINEPBX bo'lsa: domain, API key, API ID, caller ID kiritish
4. Saqlash
