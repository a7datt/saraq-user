import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  LogIn,
  UserPlus,
  KeyRound,
  Smartphone,
  User,
  Image,
  Wallet,
  ShoppingBag,
  Ticket,
  Trophy,
  AlertTriangle,
  Wifi,
  MapPin,
  Clock,
} from "lucide-react";
import { UserData } from "../types";

interface Theme {
  bgLight: string;
  icon: string;
}

export interface ActivityLogPageProps {
  user: UserData | null;
  theme: Theme;
  setView: (val: any) => void;
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

export default function ActivityLogPage({ user, theme, setView }: ActivityLogPageProps) {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const pageSize = 30;

  const loadPage = async (targetPage: number, append: boolean) => {
    if (!user?.id) return;
    if (append) setLoadingMore(true); else setLoading(true);
    setError("");
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
        setError(data.error || "تعذر تحميل سجل النشاط");
      }
    } catch {
      setError("خطأ في الاتصال بالخادم");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    loadPage(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const hasMore = logs.length < total;

  return (
    <div className="px-4 space-y-6 pb-20">
      <div className="flex items-center gap-3 pt-2 mb-2">
        <button
          onClick={() => setView({ type: "settings" })}
          className="p-2 bg-gray-100 rounded-lg text-gray-600 active:scale-90 transition-all"
        >
          <ArrowRight size={20} />
        </button>
        <h1 className="text-lg font-bold text-gray-800">سجل النشاط</h1>
      </div>

      <p className="text-sm text-gray-500 -mt-2">جميع العمليات المسجلة على حسابك مع بيانات التتبع (الوقت، IP، الموقع، الجهاز)</p>

      {loading ? (
        <div className="text-center text-gray-400 text-sm py-8">جارِ التحميل...</div>
      ) : error ? (
        <div className="text-center text-red-500 text-sm py-8">{error}</div>
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
              onClick={() => loadPage(page + 1, true)}
              disabled={loadingMore}
              className="w-full py-3 text-sm font-bold text-brand bg-brand/5 rounded-xl active:opacity-70 transition-opacity disabled:opacity-50"
            >
              {loadingMore ? "جارِ التحميل..." : "عرض المزيد"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
