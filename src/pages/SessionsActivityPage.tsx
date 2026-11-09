import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  Smartphone,
  Wifi,
  Clock,
  ShieldCheck,
  Laptop,
  MapPin,
  LogIn,
  UserPlus,
  KeyRound,
  User,
  Image,
  Wallet,
  ShoppingBag,
  Ticket,
  Trophy,
  AlertTriangle,
  LogOut,
} from "lucide-react";
import { UserData } from "../types";
import { showToast } from "../components/ToastContainer";

interface Theme {
  bgLight: string;
  icon: string;
}

export interface SessionsActivityPageProps {
  user: UserData | null;
  theme: Theme;
  setView: (val: any) => void;
}

interface SessionInfo {
  id?: number;
  device: string;
  ip: string;
  last_active: string;
  location?: string | null;
}

interface ActivityLogEntry {
  id: number;
  type: string;
  description: string;
  ip: string | null;
  device: string | null;
  location: string | null;
  is_unusual: boolean;
  created_at: string;
}

const typeIcon: Record<string, React.ReactNode> = {
  login: <LogIn size={16} />,
  google_login: <LogIn size={16} />,
  register: <UserPlus size={16} />,
  password_change: <KeyRound size={16} />,
  phone_change: <Smartphone size={16} />,
  name_change: <User size={16} />,
  avatar_change: <Image size={16} />,
  recharge: <Wallet size={16} />,
  order: <ShoppingBag size={16} />,
  voucher_redeem: <Ticket size={16} />,
  top3_rank: <Trophy size={16} />,
};

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString("ar-EG", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
};

const SessionCard = ({
  session,
  isCurrent,
  onLogout,
  loggingOut,
}: {
  session: SessionInfo;
  isCurrent?: boolean;
  onLogout?: () => void;
  loggingOut?: boolean;
}) => (
  <div className={`rounded-2xl border p-4 space-y-3 ${isCurrent ? "border-brand/30 bg-brand/5" : "border-gray-100 bg-white"}`}>
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className={`p-2 rounded-full ${isCurrent ? "bg-brand/10 text-brand" : "bg-gray-100 text-gray-400"}`}>
          <Laptop size={18} />
        </span>
        <span className="font-semibold text-gray-800 text-sm">
          {isCurrent ? "الجلسة الحالية" : "جهاز آخر"}
        </span>
      </div>
      {isCurrent ? (
        <span className="flex items-center gap-1 text-[11px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">
          <ShieldCheck size={12} /> نشطة الآن
        </span>
      ) : (
        onLogout && (
          <button
            onClick={onLogout}
            disabled={loggingOut}
            className="flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-50 px-2.5 py-1.5 rounded-full active:opacity-70 transition-opacity disabled:opacity-50"
          >
            <LogOut size={12} /> {loggingOut ? "جارِ..." : "تسجيل الخروج"}
          </button>
        )
      )}
    </div>
    <div className="space-y-2 text-sm text-gray-600">
      <div className="flex items-center gap-2">
        <Smartphone size={15} className="text-gray-400" />
        <span className="text-gray-500">نوع الجهاز:</span>
        <span className="font-medium text-gray-700">{session.device}</span>
      </div>
      <div className="flex items-center gap-2">
        <Wifi size={15} className="text-gray-400" />
        <span className="text-gray-500">IP:</span>
        <span className="font-medium text-gray-700" dir="ltr">{session.ip}</span>
      </div>
      <div className="flex items-center gap-2">
        <MapPin size={15} className="text-gray-400" />
        <span className="text-gray-500">الموقع الجغرافي:</span>
        <span className="font-medium text-gray-700">{session.location || "غير متوفر"}</span>
      </div>
      <div className="flex items-center gap-2">
        <Clock size={15} className="text-gray-400" />
        <span className="text-gray-500">آخر نشاط:</span>
        <span className="font-medium text-gray-700">{formatDate(session.last_active)}</span>
      </div>
    </div>
  </div>
);

const LogRow = ({ entry }: { entry: ActivityLogEntry }) => (
  <div className={`rounded-2xl border p-4 space-y-2 ${entry.is_unusual ? "border-red-200 bg-red-50/50" : "border-gray-100 bg-white"}`}>
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className={`p-2 rounded-full ${entry.is_unusual ? "bg-red-100 text-red-500" : "bg-gray-100 text-gray-500"}`}>
          {typeIcon[entry.type] || <Clock size={16} />}
        </span>
        <span className="font-semibold text-gray-800 text-sm">{entry.description}</span>
      </div>
      {entry.is_unusual && (
        <span className="flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-100 px-2 py-1 rounded-full">
          <AlertTriangle size={12} /> غير معتاد
        </span>
      )}
    </div>
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 pr-1">
      <span className="flex items-center gap-1">
        <Clock size={12} /> {formatDate(entry.created_at)}
      </span>
      {entry.ip && (
        <span className="flex items-center gap-1" dir="ltr">
          <Wifi size={12} /> {entry.ip}
        </span>
      )}
      {entry.device && (
        <span className="flex items-center gap-1">
          <Smartphone size={12} /> {entry.device}
        </span>
      )}
      {entry.location && (
        <span className="flex items-center gap-1">
          <MapPin size={12} /> {entry.location}
        </span>
      )}
    </div>
  </div>
);

export default function SessionsActivityPage({ user, theme, setView }: SessionsActivityPageProps) {
  const [tab, setTab] = useState<"sessions" | "activity">("sessions");

  // ===== حالة الجلسات النشطة =====
  const [current, setCurrent] = useState<SessionInfo | null>(null);
  const [others, setOthers] = useState<SessionInfo[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(true);
  const [sessionsError, setSessionsError] = useState("");
  const [loggingOutId, setLoggingOutId] = useState<number | string | null>(null);
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  // ===== حالة سجل النشاط =====
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activityError, setActivityError] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!user?.id) return;
    const loadSessions = async () => {
      setSessionsLoading(true);
      setSessionsError("");
      try {
        const res = await fetch(`/api/user/${user.id}/sessions`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("authToken") || ""}` },
        });
        const data = await res.json();
        if (res.ok) {
          setCurrent(data.current || null);
          setOthers(Array.isArray(data.others) ? data.others : []);
        } else {
          setSessionsError(data.error || "تعذر تحميل الجلسات");
        }
      } catch {
        setSessionsError("خطأ في الاتصال بالخادم");
      } finally {
        setSessionsLoading(false);
      }
    };
    loadSessions();
  }, [user?.id]);

  const handleLogoutSession = async (session: SessionInfo) => {
    if (!user?.id || session.id == null) return;
    setLoggingOutId(session.id);
    try {
      const res = await fetch(`/api/user/${user.id}/sessions/${session.id}/revoke`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("authToken") || ""}` },
      });
      const data = await res.json();
      if (res.ok) {
        setOthers(prev => prev.filter(s => s.id !== session.id));
        showToast("تم تسجيل الخروج من الجهاز بنجاح", "success");
      } else {
        showToast(data.error || "تعذر تسجيل الخروج من الجهاز", "error");
      }
    } catch {
      showToast("خطأ في الاتصال بالخادم", "error");
    } finally {
      setLoggingOutId(null);
    }
  };

  const handleLogoutAllOthers = async () => {
    if (!user?.id) return;
    setLoggingOutAll(true);
    try {
      const res = await fetch(`/api/user/${user.id}/sessions/revoke-all`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("authToken") || ""}` },
      });
      const data = await res.json();
      if (res.ok) {
        setOthers([]);
        showToast("تم تسجيل الخروج من جميع الأجهزة الأخرى", "success");
      } else {
        showToast(data.error || "تعذر تسجيل الخروج من الأجهزة", "error");
      }
    } catch {
      showToast("خطأ في الاتصال بالخادم", "error");
    } finally {
      setLoggingOutAll(false);
    }
  };

  const loadActivityPage = async (targetPage: number, append: boolean) => {
    if (!user?.id) return;
    if (append) setLoadingMore(true); else setActivityLoading(true);
    setActivityError("");
    try {
      const res = await fetch(`/api/user/${user.id}/activity-log?page=${targetPage}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("authToken") || ""}` },
      });
      const data = await res.json();
      if (res.ok) {
        setTotal(data.total || 0);
        setLogs(prev => (append ? [...prev, ...(data.logs || [])] : (data.logs || [])));
        setPage(targetPage);
      } else {
        setActivityError(data.error || "تعذر تحميل سجل النشاط");
      }
    } catch {
      setActivityError("خطأ في الاتصال بالخادم");
    } finally {
      setActivityLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    loadActivityPage(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const hasMore = logs.length < total;

  return (
    <div className="px-4 space-y-6 pb-20">
      <div className="flex items-center gap-3 pt-2 mb-2">
        <button
          onClick={() => setView({ type: "main" })}
          className="p-2 bg-gray-100 rounded-lg text-gray-600 active:scale-90 transition-all"
        >
          <ArrowRight size={20} />
        </button>
        <h1 className="text-lg font-bold text-gray-800">الجلسات الحالية والنشاط</h1>
      </div>

      {/* أزرار التبديل */}
      <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-xl">
        <button
          onClick={() => setTab("sessions")}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-bold transition-all ${
            tab === "sessions" ? "bg-white text-brand shadow-sm" : "text-gray-500"
          }`}
        >
          <Laptop size={16} /> الجلسات النشطة
        </button>
        <button
          onClick={() => setTab("activity")}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-bold transition-all ${
            tab === "activity" ? "bg-white text-brand shadow-sm" : "text-gray-500"
          }`}
        >
          <Clock size={16} /> سجل النشاط
        </button>
      </div>

      {tab === "sessions" ? (
        <div className="space-y-5">
          <p className="text-sm text-gray-500 -mt-2">الأجهزة المتصلة بحسابك حالياً</p>
          {sessionsLoading ? (
            <div className="text-center text-gray-400 text-sm py-8">جارِ التحميل...</div>
          ) : sessionsError ? (
            <div className="text-center text-red-500 text-sm py-8">{sessionsError}</div>
          ) : (
            <div className="space-y-5">
              {current && (
                <div className="space-y-2">
                  <SessionCard session={current} isCurrent />
                </div>
              )}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-sm font-bold text-gray-700">أجهزة أخرى</h2>
                  {others.length > 0 && (
                    <button
                      onClick={handleLogoutAllOthers}
                      disabled={loggingOutAll}
                      className="flex items-center gap-1 text-[11px] font-bold text-red-600 active:opacity-70 transition-opacity disabled:opacity-50"
                    >
                      <LogOut size={12} /> {loggingOutAll ? "جارِ..." : "تسجيل الخروج من الكل"}
                    </button>
                  )}
                </div>
                {others.length === 0 ? (
                  <div className="text-center text-gray-400 text-xs py-6 border border-dashed border-gray-200 rounded-2xl">
                    لا توجد أجهزة أخرى متصلة بحسابك حالياً
                  </div>
                ) : (
                  others.map((s, i) => (
                    <SessionCard
                      key={s.id ?? i}
                      session={s}
                      onLogout={() => handleLogoutSession(s)}
                      loggingOut={loggingOutId === s.id}
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-sm text-gray-500 -mt-2">جميع العمليات المسجلة على حسابك مع بيانات التتبع (الوقت، IP، الموقع، الجهاز)</p>
          {activityLoading ? (
            <div className="text-center text-gray-400 text-sm py-8">جارِ التحميل...</div>
          ) : activityError ? (
            <div className="text-center text-red-500 text-sm py-8">{activityError}</div>
          ) : logs.length === 0 ? (
            <div className="text-center text-gray-400 text-xs py-10 border border-dashed border-gray-200 rounded-2xl">
              لا يوجد نشاط مسجل حتى الآن
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map((entry) => (
                <LogRow key={entry.id} entry={entry} />
              ))}
              {hasMore && (
                <button
                  onClick={() => loadActivityPage(page + 1, true)}
                  disabled={loadingMore}
                  className="w-full py-3 text-sm font-bold text-brand bg-brand/5 rounded-xl active:opacity-70 transition-opacity disabled:opacity-50"
                >
                  {loadingMore ? "جارِ التحميل..." : "عرض المزيد"}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
