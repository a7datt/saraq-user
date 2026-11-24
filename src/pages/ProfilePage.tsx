import React from "react";
import VerifiedBadge from "../components/VerifiedBadge";
import {
  User,
  UserCircle,
  ArrowRight,
  LogOut,
  Settings,
  History,
  MessageSquare,
  Share2,
  ChevronRight,
  Award,
  Star,
  Zap,
  ShieldCheck,
  Crown,
  Headphones,
  Trophy,
  ExternalLink,
  Laptop,
} from "lucide-react";
import { UserData } from "../types";
import OptimizedImage from "../components/OptimizedImage";

interface Theme {
  primary: string;
  primaryHover: string;
  text: string;
  textDark: string;
  bgLight: string;
  border: string;
  shadow: string;
  gradient: string;
  icon: string;
  button: string;
  buttonHover: string;
}

export interface ProfilePageProps {
  user: UserData | null;
  theme: Theme;
  setView: (val: any) => void;
  handleGenerateLinkingCode: () => void;
  handleLogout: () => void;
  telegramBotAvailable?: boolean;
}

const ProfileItem = ({ icon, label, onClick, className = "", badge }: any) => (
  <button onClick={onClick} className={`w-full flex items-center justify-between py-3.5 px-1 active:bg-gray-50 transition-colors ${className}`}>
    <div className="flex items-center gap-3.5">
      <span className="text-gray-400">{icon}</span>
      <span className="font-medium text-gray-700">{label}</span>
      {badge !== undefined && (
        <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
          {badge}
        </span>
      )}
    </div>
    <ChevronRight size={18} className="text-gray-300" />
  </button>
);

export default function ProfilePage({ user, theme, setView, handleGenerateLinkingCode, handleLogout, telegramBotAvailable = true }: ProfilePageProps) {
  // [PHASE-3] زر "توثيق الهوية" يظهر فقط إذا فعّله الأدمن (أو كان المستخدم موثّقاً/لديه طلب)
  const [identity, setIdentity] = React.useState<{ enabled: boolean; status: string } | null>(null);
  React.useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    let token = "";
    try { token = localStorage.getItem("authToken") || ""; } catch {}
    fetch("/api/identity/status", { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null).then(d => { if (!cancelled && d) setIdentity({ enabled: !!d.enabled, status: d.status }); }).catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id, user?.identity_verified]);
  return (
    <div className="px-4 space-y-4 pb-20">

      {/* صورة الحساب */}
      <div className="flex flex-col items-center pt-6 pb-2">
        <div className={`w-24 h-24 ${theme.bgLight} rounded-full flex items-center justify-center ${theme.icon} border-4 border-white shadow-lg ${theme.shadow} overflow-hidden ${user?.is_vip ? 'vip-glow' : ''} ${user?.stats?.frame ? `frame-${user.stats.frame}` : ''}`}>
          {user?.avatar_url ? (
            <OptimizedImage src={user.avatar_url} width={192} height={192} alt="Avatar" className="w-full h-full object-cover" />
          ) : <User size={48} />}
        </div>
      </div>

      {/* الاسم + الشارة بجانب بعض */}
      {user?.name && (
        <div className="flex items-center justify-center gap-2 -mt-1 flex-wrap">
          <p className="text-base font-semibold text-gray-800">{user.name}{user?.identity_verified && <VerifiedBadge />}</p>
          {user?.stats?.profile_badge && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold badge-${user.stats.profile_badge} inline-flex items-center gap-1`}>
              {user.stats.profile_badge === 'bronze' && <Award size={10} />}
              {user.stats.profile_badge === 'active' && <Star size={10} />}
              {user.stats.profile_badge === 'energy' && <Zap size={10} />}
              {user.stats.profile_badge === 'silver' && <ShieldCheck size={10} />}
              {user.stats.profile_badge === 'gold' && <Crown size={10} />}
              {user.stats.profile_badge === 'diamond' && <Star size={10} />}
              {user.stats.profile_badge === 'legendary' && <Crown size={10} />}
            </span>
          )}
          {user?.is_vip && <span className="vip-badge"><Crown size={10} />VIP</span>}
        </div>
      )}

      {/* رقم الدخول + اللقب بجانب بعض */}
      {user?.id && (
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <span className="text-sm font-bold text-brand">#{user.id}</span>
          {user?.stats?.user_title && (
            <span className="text-xs font-bold text-purple-600 flex items-center gap-1">
              <Award size={11} /> {user.stats.user_title}
            </span>
          )}
        </div>
      )}

      {/* أزرار سريعة: ربط تليجرام / الإحالة / دفعاتي / الترتيب */}
      {user && (
        <div className="grid grid-cols-4 gap-1 pt-1">
          {user.telegram_chat_id ? (
            <div className="text-gray-400 flex flex-col items-center gap-1.5 py-2">
              <MessageSquare size={20} />
              <span className="text-[10px] font-bold leading-tight text-center">تليجرام مرتبط</span>
            </div>
          ) : telegramBotAvailable ? (
            <button onClick={handleGenerateLinkingCode} className="text-brand flex flex-col items-center gap-1.5 py-2 transition-opacity active:opacity-60">
              <MessageSquare size={20} />
              <span className="text-[10px] font-bold leading-tight text-center">اربط الآن</span>
            </button>
          ) : (
            <div className="text-gray-300 flex flex-col items-center gap-1.5 py-2 cursor-not-allowed" title="لم يتم اضافة بوت بعد">
              <MessageSquare size={20} />
              <span className="text-[10px] font-bold leading-tight text-center">لم يتم اضافة بوت بعد</span>
            </div>
          )}
          <button onClick={() => setView({ type: "referral" })} className="text-brand flex flex-col items-center gap-1.5 py-2 transition-opacity active:opacity-60">
            <Share2 size={20} />
            <span className="text-[10px] font-bold">الإحالة</span>
          </button>
          <button onClick={() => setView({ type: "payments" })} className="text-brand flex flex-col items-center gap-1.5 py-2 transition-opacity active:opacity-60">
            <History size={20} />
            <span className="text-[10px] font-bold">دفعاتي</span>
          </button>
          <button onClick={() => setView({ type: "leaderboard" })} className="text-brand flex flex-col items-center gap-1.5 py-2 transition-opacity active:opacity-60">
            <Trophy size={20} />
            <span className="text-[10px] font-bold">الترتيب</span>
          </button>
        </div>
      )}

      {user && identity && (identity.enabled || identity.status === "approved") && (
        <button onClick={() => setView({ type: "identity" })} className="w-full flex items-center gap-3 bg-white border border-sky-100 rounded-2xl p-3.5 active:scale-[0.99] transition-transform">
          <ShieldCheck size={22} className="text-sky-500 shrink-0" />
          <span className="flex-1 text-right text-sm font-bold text-gray-800">توثيق الهوية</span>
          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${identity.status === "approved" ? "bg-green-50 text-green-700" : identity.status === "pending" ? "bg-amber-50 text-amber-700" : identity.status === "rejected" ? "bg-red-50 text-red-600" : "bg-gray-100 text-gray-500"}`}>
            {identity.status === "approved" ? "موثّق" : identity.status === "pending" ? "قيد المراجعة" : identity.status === "rejected" ? "مرفوض" : "غير موثّق"}
          </span>
          <ChevronRight size={18} className="text-gray-300" />
        </button>
      )}

      {/* فاصل خفيف */}
      <div className="border-t border-gray-100" />

      {/* قائمة الإجراءات */}
      <div className="divide-y divide-gray-100">
        <ProfileItem icon={<UserCircle size={20} />} label="معلومات الحساب" onClick={() => setView({ type: "profile_details" })} />
        <ProfileItem icon={<User size={20} />} label="تعديل الملف الشخصي" onClick={() => setView({ type: "edit_profile" })} />
        <ProfileItem icon={<Settings size={20} />} label="الإعدادات" onClick={() => setView({ type: "settings" })} />
        <ProfileItem icon={<Headphones size={20} />} label="الدعم الفني" onClick={() => setView({ type: "chat" })} className="text-brand relative" badge={user?.unread_support_count > 0 ? user.unread_support_count : undefined} />
        <ProfileItem icon={<Laptop size={20} />} label="الجلسات الحالية والنشاط" onClick={() => setView({ type: "sessions_activity" })} />
        {user ? (
          <ProfileItem icon={<LogOut size={20} />} label="تسجيل الخروج" onClick={handleLogout} className="text-red-500" />
        ) : (
          <ProfileItem icon={<ArrowRight size={20} />} label="تسجيل الدخول" onClick={() => setView({ type: "login" })} />
        )}
      </div>

      {/* saraqib store Platform */}
      <div className="flex flex-col items-center py-4 gap-2">
        <a
          href="https://syrabit.sy"
          target="_blank"
          rel="noopener noreferrer"
          className="transition-opacity active:opacity-70"
          onContextMenu={e => e.preventDefault()}
        >
          <img
            src="https://i.ibb.co/7NWcBRz4/20260624-015840.png"
            alt="برمجة منصة syrabit"
            className="h-24 object-contain"
            loading="lazy"
              decoding="async"
            referrerPolicy="no-referrer"
            draggable={false}
            onDragStart={e => e.preventDefault()}
            onContextMenu={e => e.preventDefault()}
          />
        </a>
        <a
          href="https://syrabit.sy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-blue-500 font-medium transition-opacity active:opacity-70 select-none flex items-center gap-1"
          onContextMenu={e => e.preventDefault()}
        >
          برمجة منصة syrabit
          <ExternalLink size={11} />
        </a>
      </div>
    </div>
  );
}
