'use client';
import { createContext, useContext, useEffect, useState } from 'react';

type Lang = 'uz' | 'ru';

const TRANSLATIONS: Record<string, Record<Lang, string>> = {
  // Common
  'common.save': { uz: 'Saqlash', ru: 'Сохранить' },
  'common.cancel': { uz: 'Bekor', ru: 'Отмена' },
  'common.delete': { uz: "O'chirish", ru: 'Удалить' },
  'common.edit': { uz: 'Tahrirlash', ru: 'Изменить' },
  'common.create': { uz: 'Yaratish', ru: 'Создать' },
  'common.search': { uz: 'Qidirish', ru: 'Поиск' },
  'common.loading': { uz: 'Yuklanmoqda...', ru: 'Загрузка...' },
  'common.empty': { uz: "Ma'lumot yo'q", ru: 'Нет данных' },
  'common.add': { uz: "+ Qo'shish", ru: '+ Добавить' },
  'common.send': { uz: 'Yuborish', ru: 'Отправить' },
  'common.close': { uz: 'Yopish', ru: 'Закрыть' },
  'common.actions': { uz: 'Amallar', ru: 'Действия' },
  'common.status': { uz: 'Holat', ru: 'Статус' },
  'common.date': { uz: 'Sana', ru: 'Дата' },
  'common.name': { uz: 'Ism', ru: 'Имя' },
  'common.phone': { uz: 'Telefon', ru: 'Телефон' },
  'common.email': { uz: 'Email', ru: 'Email' },
  'common.total': { uz: 'Jami', ru: 'Всего' },
  'common.today': { uz: 'Bugun', ru: 'Сегодня' },
  'common.thisMonth': { uz: 'Bu oy', ru: 'Этот месяц' },
  'common.welcome': { uz: 'Xush kelibsiz', ru: 'Добро пожаловать' },
  'common.confirm': { uz: 'Tasdiqlash', ru: 'Подтвердить' },
  'common.yes': { uz: 'Ha', ru: 'Да' },
  'common.no': { uz: "Yo'q", ru: 'Нет' },

  // Navigation
  'nav.dashboard': { uz: 'Bosh sahifa', ru: 'Главная' },
  'nav.pipeline': { uz: 'Sotuvlar', ru: 'Воронка' },
  'nav.inbox': { uz: 'Chat', ru: 'Входящие' },
  'nav.clients': { uz: 'Mijozlar', ru: 'Клиенты' },
  'nav.bookings': { uz: 'Bronlar', ru: 'Брони' },
  'nav.invoices': { uz: 'Hisob-fakturalar', ru: 'Счета' },
  'nav.payments': { uz: "To'lovlar", ru: 'Платежи' },
  'nav.followups': { uz: 'Eslatmalar', ru: 'Напоминания' },
  'nav.tasks': { uz: 'Vazifalar', ru: 'Задачи' },
  'nav.team': { uz: 'Jamoa', ru: 'Команда' },
  'nav.reports': { uz: 'Hisobotlar', ru: 'Отчёты' },
  'nav.kpi': { uz: 'KPI', ru: 'KPI' },
  'nav.security': { uz: 'Xavfsizlik', ru: 'Безопасность' },
  'nav.settings': { uz: 'Sozlamalar', ru: 'Настройки' },
  'nav.owner': { uz: 'Owner', ru: 'Владелец' },
  'nav.calls': { uz: "Qo'ng'iroq", ru: 'Звонки' },

  // Dashboard
  'dashboard.title': { uz: 'Bosh sahifa', ru: 'Главная' },
  'dashboard.revenue': { uz: 'Daromad', ru: 'Выручка' },
  'dashboard.bookings': { uz: 'Bookinglar', ru: 'Брони' },
  'dashboard.clients': { uz: 'Yangi mijozlar', ru: 'Новые клиенты' },
  'dashboard.conversion': { uz: 'Konversiya', ru: 'Конверсия' },
  'dashboard.calls': { uz: "Qo'ng'iroqlar", ru: 'Звонки' },
  'dashboard.avgBooking': { uz: "O'rtacha booking", ru: 'Средний чек' },
  'dashboard.todaysTasks': { uz: "Bugungi vazifalar", ru: 'Задачи на сегодня' },
  'dashboard.upcomingTrips': { uz: 'Yaqin sayohatlar', ru: 'Ближайшие поездки' },
  'dashboard.bySource': { uz: 'Manbaalar', ru: 'Источники' },
  'dashboard.recentActivity': { uz: 'Oxirgi faollik', ru: 'Активность' },

  // Login
  'login.title': { uz: 'Tizimga kirish', ru: 'Вход в систему' },
  'login.subtitle': { uz: 'Sayohat biznesingiz uchun CRM', ru: 'CRM для вашего туристического бизнеса' },
  'login.submit': { uz: 'Kirish', ru: 'Войти' },
  'login.email': { uz: 'Email', ru: 'Email' },
  'login.password': { uz: 'Parol', ru: 'Пароль' },
  'login.forgot': { uz: 'Parolni unutdingizmi?', ru: 'Забыли пароль?' },

  // Dialer
  'dialer.calling': { uz: "Qo'ng'iroq qilinmoqda...", ru: 'Набираем...' },
  'dialer.ringing': { uz: 'Jiringlamoqda...', ru: 'Идёт вызов...' },
  'dialer.inCall': { uz: 'Suhbat davom etmoqda', ru: 'Идёт разговор' },
  'dialer.hangup': { uz: 'Tugatish', ru: 'Завершить' },
  'dialer.noAnswer': { uz: 'Javob bermadi', ru: 'Нет ответа' },
  'dialer.note': { uz: 'Izoh qoldiring', ru: 'Оставить заметку' },

  // Inbox
  'inbox.placeholder': { uz: 'Xabar yozing...', ru: 'Введите сообщение...' },
  'inbox.attachImage': { uz: 'Rasm yuklash', ru: 'Загрузить фото' },
  'inbox.template': { uz: 'Shablon', ru: 'Шаблон' },
  'inbox.sendInvoice': { uz: 'Invoice yuborish', ru: 'Отправить счёт' },
  'inbox.assigned': { uz: 'Tayinlangan', ru: 'Назначен' },
  'inbox.unassigned': { uz: 'Tayinlanmagan', ru: 'Не назначен' },
};

interface I18nContextType {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  lang: 'uz',
  setLang: () => {},
  t: (k) => k,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('uz');

  useEffect(() => {
    const saved = (localStorage.getItem('lang') as Lang) || 'uz';
    setLangState(saved);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem('lang', l);
  };

  const t = (key: string): string => {
    const entry = TRANSLATIONS[key];
    if (!entry) return key;
    return entry[lang] || entry.uz || key;
  };

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);