import React, { useEffect, useState } from "react";
import { ArrowRight, Smartphone, Wifi, Clock, ShieldCheck, Laptop, LogOut } from "lucide-react";
import { UserData } from "../types";
import { showToast } from "../components/ToastContainer";

interface Theme {
  bgLight: string;
  icon: string;
}

export interface ActiveSessionsPageProps {
  user: UserData | null;
  theme: Theme;
  setView: (val: any) => void;
}

interface SessionInfo {
  id?: number;
  device: string;
  ip: string;
  last_active: string;
}

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

const SessionCard = ({ session, isCurrent, onRevoke, revoking }: { session: SessionInfo; isCurrent?: boolean; onRevoke?: () => void; revoking?: boolean }) => (
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
      {isCurrent && (
        <span className="flex items-center gap-1 text-[11px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">
          <ShieldCheck size={12} /> نشطة الآن
        </span>
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
        <Clock size={15} className="text-gray-400" />
        <span className="text-gray-500">آخر نشاط:</span>
        <span className="font-medium text-gray-700">{formatDate(session.last_active)}</span>
      </div>
    </div>
    {!isCurrent && onRevoke && (
      <button
        onClick={onRevoke}
        disabled={revoking}
        className="w-full flex items-center justify-center gap-1.5 bg-red-50 text-red-500 text-xs font-bold py-2.5 rounded-xl active:scale-95 transition-transform disabled:opacity-50"
      >
        <LogOut size={14} />
        {revoking ? "جاري الإنهاء..." : "إنهاء هذه الجلسة"}
      </button>
    )}
  </div>
);

export default function ActiveSessionsPage({ user, theme, setView }: ActiveSessionsPageProps) {
  const [current, setCurrent] = useState<SessionInfo | null>(null);
  const [others, setOthers] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revokingId, setRevokingId] = useState<number | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("authToken") || ""}` });

  // [FIX] الصفحة كانت تعرض الأجهزة فقط بلا أي إجراء — نقاط النهاية بالخادم كانت جاهزة أصلاً
  // (revoke/:sessionId وrevoke-all) لكن غير مستخدمة من أي مكان بالواجهة.
  const revokeSession = async (sessionId?: number) => {
    if (!user?.id || !sessionId) return;
    setRevokingId(sessionId);
    try {
      const res = await fetch(`/api/user/${user.id}/sessions/${sessionId}/revoke`, { method: "POST", headers: authHeaders() });
      const data = await res.json();
      if (res.ok && data.success) {
        setOthers(prev => prev.filter(s => s.id !== sessionId));
        showToast("تم إنهاء الجلسة بنجاح", "success");
      } else {
        showToast(data.error || "تعذّر إنهاء الجلسة", "error");
      }
    } catch {
      showToast("خطأ في الاتصال بالخادم", "error");
    } finally {
      setRevokingId(null);
    }
  };

  const revokeAllOthers = async () => {
    if (!user?.id || others.length === 0) return;
    setRevokingAll(true);
    try {
      const res = await fetch(`/api/user/${user.id}/sessions/revoke-all`, { method: "POST", headers: authHeaders() });
      const data = await res.json();
      if (res.ok && data.success) {
        setOthers([]);
        showToast("تم تسجيل الخروج من كل الأجهزة الأخرى", "success");
      } else {
        showToast(data.error || "تعذّر إنهاء الجلسات", "error");
      }
    } catch {
      showToast("خطأ في الاتصال بالخادم", "error");
    } finally {
      setRevokingAll(false);
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/user/${user.id}/sessions`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("authToken") || ""}` },
        });
        const data = await res.json();
        if (res.ok) {
          setCurrent(data.current || null);
          setOthers(Array.isArray(data.others) ? data.others : []);
        } else {
          setError(data.error || "تعذر تحميل الجلسات");
        }
      } catch {
        setError("خطأ في الاتصال بالخادم");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user?.id]);

  return (
    <div className="px-4 space-y-6 pb-20">
      <div className="flex items-center gap-3 pt-2 mb-2">
        <button
          onClick={() => setView({ type: "main" })}
          className="p-2 bg-gray-100 rounded-lg text-gray-600 active:scale-90 transition-all"
        >
          <ArrowRight size={20} />
        </button>
        <h1 className="text-lg font-bold text-gray-800">الجلسات النشطة</h1>
      </div>

      <p className="text-sm text-gray-500 -mt-2">الأجهزة المتصلة بحسابك حالياً</p>

      {loading ? (
        <div className="text-center text-gray-400 text-sm py-8">جارِ التحميل...</div>
      ) : error ? (
        <div className="text-center text-red-500 text-sm py-8">{error}</div>
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
                  onClick={revokeAllOthers}
                  disabled={revokingAll}
                  className="text-[11px] font-bold text-red-500 disabled:opacity-50"
                >
                  {revokingAll ? "جاري الإنهاء..." : "إنهاء الكل"}
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
                  onRevoke={() => revokeSession(s.id)}
                  revoking={revokingId === s.id}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
