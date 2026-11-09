import React from "react";
import { ArrowRight, User, Crown, Pencil, Gem, Wallet, Hash, ShoppingBag, TrendingUp, CalendarDays, BadgeCheck } from "lucide-react";
import { UserData, Order } from "../types";
import OptimizedImage from "../components/OptimizedImage";

interface Theme {
  bgLight: string;
  icon: string;
  text: string;
  textDark: string;
  border: string;
}

export interface ProfileDetailsPageProps {
  user: UserData | null;
  theme: Theme;
  orders: Order[];
  setView: (val: any) => void;
  setActiveTab: (tab: string) => void;
}

export default function ProfileDetailsPage({ user, theme, orders, setView, setActiveTab }: ProfileDetailsPageProps) {
  return (
    <div className="px-4 space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-3">
          <button onClick={() => setView({ type: "main" })} className="p-2 bg-gray-100 rounded-lg text-gray-600 active:scale-90 transition-all">
            <ArrowRight size={20} />
          </button>
          <h2 className="font-bold text-gray-800 text-lg">معلومات الحساب</h2>
        </div>
        <button
          onClick={() => setView({ type: "edit_profile" })}
          className="flex items-center gap-1.5 bg-gray-100 text-gray-600 font-bold text-xs px-3 py-2 rounded-lg active:bg-gray-200 transition-colors"
        >
          <Pencil size={13} />
          تعديل
        </button>
      </div>

      {/* صورة واسم */}
      <div className={`bg-white p-5 rounded-lg border border-gray-100 shadow-sm flex flex-col items-center text-center space-y-2 ${user?.is_vip ? 'vip-card-glow border-amber-200' : ''}`}>
        <div className={`w-20 h-20 ${theme.bgLight} rounded-full flex items-center justify-center ${theme.icon} border-4 border-white shadow-lg overflow-hidden ${user?.is_vip ? 'vip-glow' : ''}`}>
          {user?.avatar_url ? (
            <OptimizedImage src={user.avatar_url} width={160} height={160} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            <User size={40} />
          )}
        </div>
        <div>
          <div className="flex items-center justify-center gap-2">
            <h3 className={`text-xl font-bold text-gray-800 ${user?.is_vip ? 'vip-text-glow' : ''}`}>{user?.name || "—"}</h3>
            {user?.is_vip && <span className="vip-badge"><Crown size={10} />VIP</span>}
          </div>
          <p className="text-gray-400 text-sm">{user?.email || "—"}</p>
          {user?.phone && <p className="text-gray-400 text-xs mt-0.5">{user.phone}</p>}
        </div>
      </div>

      {/* الرصيد - بطاقة رئيسية */}
      <div className="bg-gradient-to-br from-brand to-[#0a2a80] rounded-lg p-5 shadow-lg shadow-brand-soft relative overflow-hidden">
        <div className="absolute -left-6 -top-6 w-28 h-28 bg-white/10 rounded-full" />
        <div className="absolute -left-2 top-10 w-14 h-14 bg-white/10 rounded-full" />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-[11px] text-white/70 font-bold uppercase tracking-wider mb-1">الرصيد الحالي</p>
            <p className="text-2xl font-bold text-white">{user?.balance?.toFixed(3) ?? "0.00"} <span className="text-sm font-medium text-white/70">$</span></p>
          </div>
          <div className="w-12 h-12 bg-white/15 rounded-full flex items-center justify-center text-white">
            <Wallet size={22} />
          </div>
        </div>
      </div>

      {/* تفاصيل الحساب */}
      <div className="bg-white rounded-lg border border-gray-100 shadow-sm divide-y divide-gray-50 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gray-50 text-gray-400 rounded-lg flex items-center justify-center"><Hash size={16} /></div>
            <span className="text-sm font-medium text-gray-500">رقم الدخول</span>
          </div>
          <span className="text-sm font-bold text-gray-800">#{user?.id || "—"}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${user?.is_vip ? 'bg-amber-50 text-amber-500' : 'bg-gray-50 text-gray-400'}`}>
              {user?.is_vip ? <Gem size={16} /> : <BadgeCheck size={16} />}
            </div>
            <span className="text-sm font-medium text-gray-500">الحالة</span>
          </div>
          <span className={`text-sm font-bold flex items-center gap-1 ${user?.is_vip ? 'text-amber-600' : 'text-gray-800'}`}>
            {user?.is_vip && <Crown size={13} />}
            {user?.is_vip ? 'VIP' : 'عادي'}
          </span>
        </div>
        <div className="flex items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gray-50 text-gray-400 rounded-lg flex items-center justify-center"><ShoppingBag size={16} /></div>
            <span className="text-sm font-medium text-gray-500">إجمالي الطلبات</span>
          </div>
          <span className="text-sm font-bold text-gray-800">{orders.length}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gray-50 text-gray-400 rounded-lg flex items-center justify-center"><TrendingUp size={16} /></div>
            <span className="text-sm font-medium text-gray-500">إجمالي الشحن</span>
          </div>
          <span className="text-sm font-bold text-gray-800">{user?.stats?.total_recharge_sum?.toFixed(3) ?? "0.00"} $</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3.5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gray-50 text-gray-400 rounded-lg flex items-center justify-center"><CalendarDays size={16} /></div>
            <span className="text-sm font-medium text-gray-500">تاريخ الانضمام</span>
          </div>
          <span className="text-sm font-bold text-gray-800">
            {user?.created_at ? new Date(user.created_at).toLocaleDateString("ar-EG", { year: 'numeric', month: 'long', day: 'numeric' }) : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}
