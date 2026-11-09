import React, { useState } from "react";
import { ArrowRight, Bell, Moon, Shield, ChevronRight, ArrowLeftRight } from "lucide-react";
import { showToast } from "../components/ToastContainer";
import { CurrencyDropdown } from "../components/CurrencyDropdown";
import { UserData } from "../types";
import type { CurrencyOption } from "../App";

export interface SettingsPageProps {
  setView: (val: any) => void;
  currency: "USD" | number;
  setCurrency: (val: "USD" | number) => void;
  availableCurrencies: CurrencyOption[];
  setSypRate: (val: number) => void;
  setCurrentCurrencySymbol: (val: string) => void;
  setUserPickedCurrency: (val: boolean) => void;
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  user: UserData | null;
  setThemeModal: (val: { isOpen: boolean; color: string }) => void;
  subscribeToPush: (userId: number) => Promise<boolean>;
  unsubscribeFromPush: () => Promise<boolean>;
}

const SettingsPage = ({
  setView,
  currency,
  setCurrency,
  availableCurrencies,
  setSypRate,
  setCurrentCurrencySymbol,
  setUserPickedCurrency,
  isDarkMode,
  setIsDarkMode,
  user,
  setThemeModal,
  subscribeToPush,
  unsubscribeFromPush,
}: SettingsPageProps) => {
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    return localStorage.getItem("notifications_enabled") !== "false";
  });
  const [notifLoading, setNotifLoading] = useState(false);

  // [FIX] كان هذا المفتاح وهمياً بالكامل — يكتب فقط لـ localStorage بلا أي أثر فعلي، فتعطيله
  // لا يوقف وصول أي إشعار حقيقياً. أصبح يشترك/يلغي اشتراك إشعارات الدفع (Push) فعلياً بالخادم.
  const toggleNotifications = async () => {
    if (notifLoading) return;
    const next = !notificationsEnabled;
    setNotifLoading(true);
    try {
      if (next) {
        if (!user) { showToast("يجب تسجيل الدخول أولاً", 'error'); return; }
        const ok = await subscribeToPush(user.id);
        if (!ok) {
          showToast("تعذّر تفعيل الإشعارات — تأكد من السماح بها من إعدادات المتصفح", 'error');
          return;
        }
      } else {
        await unsubscribeFromPush();
      }
      setNotificationsEnabled(next);
      localStorage.setItem("notifications_enabled", String(next));
      showToast(next ? "تم تفعيل الإشعارات بنجاح!" : "تم إلغاء تفعيل الإشعارات", next ? 'success' : 'info');
    } finally {
      setNotifLoading(false);
    }
  };

  return (
  <div className="px-4 space-y-6 pb-20">
    <div className="flex items-center gap-3 pt-2 mb-2">
      <button onClick={() => setView({ type: "main" })} className="p-2 bg-gray-100 rounded-lg text-gray-600 active:scale-90 transition-all">
        <ArrowRight size={20} />
      </button>
      <h2 className="font-bold text-gray-800 text-lg">الإعدادات</h2>
    </div>

    {/* التفضيلات العامة */}
    <div className="space-y-2">
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-1">التفضيلات العامة</p>
      <div className="bg-white rounded-lg border border-gray-100 shadow-sm divide-y divide-gray-50 overflow-hidden">
        {/* تفعيل الإشعارات */}
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gray-50 text-gray-400 rounded-lg flex items-center justify-center"><Bell size={18} /></div>
            <span className="font-medium text-gray-700 text-sm">الإشعارات</span>
          </div>
          <button
            onClick={toggleNotifications}
            disabled={notifLoading}
            className={`w-10 h-5 rounded-full relative transition-colors disabled:opacity-50 ${notificationsEnabled ? 'bg-brand' : 'bg-gray-200'}`}
          >
            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${notificationsEnabled ? 'right-1' : 'left-1'}`}></div>
          </button>
        </div>
        {/* تبديل العملة */}
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gray-50 text-gray-400 rounded-lg flex items-center justify-center"><ArrowLeftRight size={16} /></div>
            <span className="font-medium text-gray-700 text-sm">عملة العرض</span>
          </div>
          <CurrencyDropdown
            value={String(currency)}
            options={[
              { value: "USD", label: "$" },
              ...availableCurrencies.map((c) => ({ value: String(c.id), label: c.symbol })),
            ]}
            onChange={(val) => {
              setUserPickedCurrency(true);
              localStorage.setItem("userPickedCurrency", "1");
              if (val === "USD") {
                setCurrency("USD");
                localStorage.removeItem("currencyId");
              } else {
                const picked = availableCurrencies.find((c) => String(c.id) === val);
                setCurrency(Number(val));
                localStorage.setItem("currencyId", val);
                if (picked) {
                  setSypRate(picked.exchange_rate);
                  setCurrentCurrencySymbol(picked.symbol);
                  localStorage.setItem("sypRate", String(picked.exchange_rate));
                  localStorage.setItem("currencySymbol", picked.symbol);
                }
              }
            }}
          />
        </div>
        {/* الوضع الليلي - يحدده المستخدم */}
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gray-50 text-gray-400 rounded-lg flex items-center justify-center"><Moon size={18} /></div>
            <span className="font-medium text-gray-700 text-sm">الوضع الليلي</span>
          </div>
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={`w-10 h-5 rounded-full relative transition-colors ${isDarkMode ? 'bg-brand' : 'bg-gray-200'}`}
          >
            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${isDarkMode ? 'right-1' : 'left-1'}`}></div>
          </button>
        </div>
      </div>
    </div>

    {/* الدعم والخصوصية */}
    <div className="space-y-2">
      <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider px-1">الدعم والخصوصية</p>
      <div className="bg-white rounded-lg border border-gray-100 shadow-sm divide-y divide-gray-50 overflow-hidden">
        {/* سياسة الخصوصية */}
        <button onClick={() => setView({ type: "privacy_policy" })} className="w-full p-4 flex items-center justify-between hover:bg-gray-50 active:bg-gray-100 transition-colors">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gray-50 text-gray-400 rounded-lg flex items-center justify-center"><Shield size={18} /></div>
            <span className="font-medium text-gray-700 text-sm">سياسة الخصوصية</span>
          </div>
          <ChevronRight size={18} className="text-gray-300" />
        </button>
      </div>
    </div>
  </div>
  );
};

export default SettingsPage;
