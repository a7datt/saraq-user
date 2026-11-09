import React, { useEffect, useState } from "react";
import {
  ArrowRight,
  Key,
  Copy,
  Check,
  Power,
  RefreshCw,
  Plus,
  X,
  ShieldCheck,
  BookOpen,
  Globe,
  AlertTriangle,
} from "lucide-react";
import { UserData } from "../types";
import { showConfirm } from "../components/CustomDialogContainer";

interface Theme {
  bgLight: string;
  icon: string;
}

export interface UserApiPageProps {
  user: UserData | null;
  theme: Theme;
  setView: (val: any) => void;
}

interface ApiTokenState {
  exists: boolean;
  id?: number;
  token?: string;
  enabled?: boolean;
  allowed_ips?: string[];
  scope?: string;
  can_order?: boolean;
}

const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`,
});

const BASE_URL = `${window.location.origin}/client/api`;

const UserApiPage: React.FC<UserApiPageProps> = ({ theme, setView }) => {
  const [state, setState] = useState<ApiTokenState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<"token" | "base" | null>(null);
  const [ipInput, setIpInput] = useState("");
  const [ipError, setIpError] = useState("");
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const fetchToken = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/user/api-token", { headers: authHeaders() });
      const data = await res.json();
      setState(data);
    } catch {
      setState({ exists: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchToken(); }, []);

  const handleCreate = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/user/api-token", { method: "POST", headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) return showToast(data.error || "تعذّر إنشاء المفتاح");
      setState(data);
      showToast("تم تفعيل الـ API لحسابك");
    } catch {
      showToast("حدث خطأ، حاول مجدداً");
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async () => {
    if (!state) return;
    setBusy(true);
    try {
      const res = await fetch("/api/user/api-token", {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ enabled: !state.enabled }),
      });
      const data = await res.json();
      if (!res.ok) return showToast(data.error || "تعذّر التحديث");
      setState((prev) => (prev ? { ...prev, enabled: data.enabled } : prev));
      showToast(data.enabled ? "تم تفعيل المفتاح" : "تم تعطيل المفتاح");
    } catch {
      showToast("حدث خطأ، حاول مجدداً");
    } finally {
      setBusy(false);
    }
  };

  const handleRegenerate = () => {
    showConfirm(
      "سيتم إبطال المفتاح الحالي فوراً وتوليد مفتاح جديد. أي تكامل يستخدم المفتاح القديم سيتوقف عن العمل. هل تريد المتابعة؟",
      "تأكيد إعادة التوليد",
      async () => {
        setBusy(true);
        try {
          const res = await fetch("/api/user/api-token/regenerate", { method: "POST", headers: authHeaders() });
          const data = await res.json();
          if (!res.ok) return showToast(data.error || "تعذّر إعادة التعيين");
          setState((prev) => (prev ? { ...prev, token: data.token } : prev));
          showToast("تم توليد مفتاح جديد");
        } catch {
          showToast("حدث خطأ، حاول مجدداً");
        } finally {
          setBusy(false);
        }
      },
      true
    );
  };

  const handleCopy = async (text: string, which: "token" | "base") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  };

  const saveIps = async (nextIps: string[]) => {
    setBusy(true);
    try {
      const res = await fetch("/api/user/api-token", {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ allowed_ips: nextIps }),
      });
      const data = await res.json();
      if (!res.ok) { setIpError(data.error || "عنوان IP غير صالح"); return false; }
      setState((prev) => (prev ? { ...prev, allowed_ips: data.allowed_ips } : prev));
      return true;
    } catch {
      setIpError("حدث خطأ، حاول مجدداً");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleAddIp = async () => {
    const ip = ipInput.trim();
    setIpError("");
    if (!ip) return;
    const current = state?.allowed_ips || [];
    if (current.includes(ip)) { setIpInput(""); return; }
    const ok = await saveIps([...current, ip]);
    if (ok) setIpInput("");
  };

  const handleRemoveIp = async (ip: string) => {
    const current = state?.allowed_ips || [];
    await saveIps(current.filter((x) => x !== ip));
  };

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3">
        <button onClick={() => setView({ type: "settings" })} className="p-1.5 -mr-1.5 text-gray-500">
          <ArrowRight size={20} />
        </button>
        <h1 className="text-base font-bold text-gray-800">الـ API</h1>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-4">
        {toast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow-lg">
            {toast}
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">جارِ التحميل...</div>
        ) : !state?.exists ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 text-center space-y-3">
            <Key size={36} className="mx-auto text-gray-200" />
            <p className="text-sm font-bold text-gray-700">لم تُفعّل الـ API بعد</p>
            <p className="text-xs text-gray-400 leading-relaxed">
              فعّل الـ API للحصول على مفتاح خاص يتيح لك سحب منتجاتنا وربطها بمتجرك أو موقعك تلقائياً.
            </p>
            <button
              onClick={handleCreate}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 bg-[var(--brand)] text-white text-sm font-bold py-3 rounded-lg shadow-sm active:scale-95 transition-all disabled:opacity-60"
            >
              <Plus size={16} /> تفعيل الـ API
            </button>
          </div>
        ) : (
          <>
            {/* مفتاح الـ API */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                  <Key size={15} className="text-[var(--brand)]" /> مفتاح الـ API
                </h2>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${state.enabled ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-400"}`}>
                  {state.enabled ? "مفعّل" : "معطّل"}
                </span>
              </div>

              <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5 flex items-center justify-between gap-2" dir="ltr">
                <code className="text-[11px] font-mono text-gray-600 truncate">{state.token}</code>
                <button onClick={() => handleCopy(state.token || "", "token")} className="shrink-0 text-gray-400 hover:text-[var(--brand)] p-1">
                  {copied === "token" ? <Check size={15} className="text-green-500" /> : <Copy size={15} />}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggle}
                  disabled={busy}
                  className={`flex-1 flex items-center justify-center gap-1.5 text-xs font-bold rounded-lg py-2.5 active:scale-95 transition-all disabled:opacity-60 ${state.enabled ? "bg-amber-50 text-amber-600" : "bg-green-50 text-green-600"}`}
                >
                  <Power size={14} /> {state.enabled ? "تعطيل" : "تفعيل"}
                </button>
                <button
                  onClick={handleRegenerate}
                  disabled={busy}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold text-red-500 bg-red-50 rounded-lg py-2.5 active:scale-95 transition-all disabled:opacity-60"
                >
                  <RefreshCw size={14} /> إعادة تعيين
                </button>
              </div>
              <p className="text-[10px] text-gray-400 leading-relaxed flex items-start gap-1.5">
                <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                إعادة التعيين تُبطل المفتاح الحالي فوراً؛ حدّث أي تكامل قائم بالمفتاح الجديد.
              </p>
            </div>

            {/* قائمة السماح بـ IP */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
              <h2 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                <ShieldCheck size={15} className="text-[var(--brand)]" /> قائمة السماح بـ IP
              </h2>
              <p className="text-[11px] text-gray-400 leading-relaxed">
                أضف عناوين IP المسموح لها فقط بالوصول إلى مفتاحك. إن تركتها فارغة، يُقبل الطلب من أي عنوان.
              </p>

              <div className="flex items-center gap-2">
                <input
                  value={ipInput}
                  onChange={(e) => setIpInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddIp()}
                  placeholder="مثال: 192.168.1.1"
                  dir="ltr"
                  className="flex-1 text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-gray-700 focus:outline-none focus:border-[var(--brand)]"
                />
                <button
                  onClick={handleAddIp}
                  disabled={busy || !ipInput.trim()}
                  className="shrink-0 bg-gray-800 text-white text-xs font-bold px-3.5 py-2.5 rounded-lg active:scale-95 transition-all disabled:opacity-40"
                >
                  إضافة
                </button>
              </div>
              {ipError && <p className="text-[11px] text-red-500 font-bold">{ipError}</p>}

              {(state.allowed_ips || []).length === 0 ? (
                <p className="text-[11px] text-gray-300 text-center py-2">لا توجد قيود — مسموح لأي IP</p>
              ) : (
                <div className="space-y-1.5">
                  {(state.allowed_ips || []).map((ip) => (
                    <div key={ip} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2" dir="ltr">
                      <code className="text-xs font-mono text-gray-600">{ip}</code>
                      <button onClick={() => handleRemoveIp(ip)} className="text-gray-400 hover:text-red-500 p-0.5">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Base URL */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
              <h2 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                <Globe size={15} className="text-[var(--brand)]" /> الرابط الأساسي (Base URL)
              </h2>
              <div className="bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5 flex items-center justify-between gap-2" dir="ltr">
                <code className="text-[11px] font-mono text-gray-600 truncate">{BASE_URL}</code>
                <button onClick={() => handleCopy(BASE_URL, "base")} className="shrink-0 text-gray-400 hover:text-[var(--brand)] p-1">
                  {copied === "base" ? <Check size={15} className="text-green-500" /> : <Copy size={15} />}
                </button>
              </div>
            </div>

            {/* رابط التوثيق */}
            <a
              href="/api-docs"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between bg-white rounded-xl border border-gray-100 shadow-sm p-4 active:scale-95 transition-all"
            >
              <span className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
                <BookOpen size={15} className="text-[var(--brand)]" /> صفحة التوثيق
              </span>
              <ArrowRight size={16} className="text-gray-300 rotate-180" />
            </a>
          </>
        )}
      </div>
    </div>
  );
};

export default UserApiPage;
