import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, Briefcase, Copy, Users, Wallet, Search, Share2 } from "lucide-react";
import { showToast } from "../components/ToastContainer";

interface Props {
  setView: (v: any) => void;
}

interface Client { id: number; name: string; email: string; balance: number; total_recharge: number; commission: number; created_at: string }
interface AgentInfo {
  system_enabled: boolean;
  is_agent: boolean;
  code?: string;
  percent?: number;
  clients?: Client[];
  clientsCount?: number;
  ordersCount?: number;
  totalCommission?: number;
}

const authHeader = (): Record<string, string> => {
  try { return { Authorization: `Bearer ${localStorage.getItem("authToken") || ""}` }; } catch { return {}; }
};
const money = (n: number) => `${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString("en-US")}$`;

/** [AGENTS] حساب الوكيل: رابط وكود الوكيل + قائمة العملاء المسجّلين عبره. */
export default function AgentPage({ setView }: Props) {
  const [info, setInfo] = useState<AgentInfo | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/agent/me", { headers: authHeader() })
      .then(r => r.json()).then(setInfo)
      .catch(() => setInfo({ system_enabled: false, is_agent: false }));
  }, []);

  const link = info?.code ? `${window.location.origin}/?agent=${info.code}` : "";
  const copy = (text: string, msg: string) => {
    navigator.clipboard.writeText(text).then(() => showToast(msg, "success")).catch(() => showToast("تعذّر النسخ", "error"));
  };
  const share = () => {
    if ((navigator as any).share) (navigator as any).share({ title: "رابط الوكيل", url: link }).catch(() => {});
    else copy(link, "تم نسخ رابط الوكيل");
  };

  const clients = useMemo(() => {
    const list = info?.clients || [];
    const s = q.trim().toLowerCase();
    if (!s) return list;
    return list.filter(c => String(c.id).includes(s) || (c.name || "").toLowerCase().includes(s) || (c.email || "").toLowerCase().includes(s));
  }, [info, q]);

  const totals = useMemo(() => {
    const list = info?.clients || [];
    return { recharge: list.reduce((a, c) => a + (c.total_recharge || 0), 0), balance: list.reduce((a, c) => a + (c.balance || 0), 0) };
  }, [info]);

  return (
    <div className="px-4 space-y-4 pb-20" dir="rtl">
      <div className="flex items-center gap-2 mb-2">
        <button onClick={() => setView({ type: "main" })} className="p-2 bg-gray-100 rounded-full active:scale-95"><ArrowRight size={20} className="text-gray-600" /></button>
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Briefcase size={20} className="text-brand" /> حساب الوكيل</h2>
      </div>

      {!info ? <p className="text-center text-sm text-gray-400 py-10">جاري التحميل...</p>
        : !info.is_agent ? (
          <p className="text-center text-sm text-gray-500 bg-gray-50 rounded-xl p-6">
            {info.system_enabled ? "حساب الوكيل غير مفعّل لحسابك. تواصل مع الإدارة لتفعيله." : "نظام الوكلاء غير متاح حالياً."}
          </p>
        ) : (
          <>
            <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
              <div>
                <p className="text-xs font-bold text-gray-500 mb-1.5">رابط الوكيل</p>
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0 bg-gray-50 rounded-lg px-3 py-2.5 text-xs font-mono text-gray-700 truncate" dir="ltr">{link}</div>
                  <button onClick={() => copy(link, "تم نسخ رابط الوكيل")} className="p-2.5 rounded-lg bg-brand text-white active:scale-95" aria-label="نسخ الرابط"><Copy size={16} /></button>
                  <button onClick={share} className="p-2.5 rounded-lg bg-gray-100 text-gray-600 active:scale-95" aria-label="مشاركة"><Share2 size={16} /></button>
                </div>
              </div>
              <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5">
                <span className="text-xs font-bold text-gray-500">كود الوكيل</span>
                <button onClick={() => copy(info.code || "", "تم نسخ كود الوكيل")} className="flex items-center gap-1.5 font-mono font-black text-brand tracking-widest">{info.code} <Copy size={13} /></button>
              </div>
              <p className="text-[12px] leading-relaxed text-gray-500">
                كل من ينشئ حساباً جديداً عبر رابطك أو يكتب كودك أثناء التسجيل يُضاف إلى عملائك. تربح <b className="text-gray-700">{info.percent}%</b> من صافي ربح المتجر في كل عملية شراء يقوم بها عملاؤك (وليس من الشحن)، وتُضاف العمولة إلى رصيدك تلقائياً.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Stat icon={<Users size={16} />} label="عدد العملاء" value={String(info.clientsCount || 0)} />
              <Stat icon={<Wallet size={16} />} label="أرباحك من العمولات" value={money(info.totalCommission || 0)} />
              <Stat label="إجمالي شحن العملاء" value={money(totals.recharge)} />
              <Stat label="أرصدة العملاء الحالية" value={money(totals.balance)} />
            </div>

            <div className="bg-white border border-gray-100 rounded-xl p-3 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-black text-gray-800">عملائي</p>
                <span className="text-[11px] text-gray-400">{info.ordersCount || 0} عملية شراء بعمولة</span>
              </div>
              {(info.clients || []).length > 0 && (
                <div className="relative">
                  <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث بالاسم أو الإيميل أو رقم الحساب" className="w-full bg-gray-50 rounded-lg pr-9 pl-3 py-2.5 text-sm outline-none" />
                </div>
              )}
              {clients.length === 0 ? (
                <p className="text-center text-xs text-gray-400 py-6">{(info.clients || []).length ? "لا توجد نتائج" : "لا يوجد عملاء بعد. شارك رابطك لتبدأ."}</p>
              ) : (
                <div className="space-y-2">
                  {clients.map(c => (
                    <div key={c.id} className="border border-gray-100 rounded-lg p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-800 truncate">{c.name}</p>
                          <p className="text-[11px] text-gray-500 truncate" dir="ltr">{c.email}</p>
                        </div>
                        <span className="shrink-0 text-[11px] font-bold bg-gray-100 text-gray-600 rounded-md px-2 py-0.5">#{c.id}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5 text-center">
                        <Mini label="إجمالي الشحن" value={money(c.total_recharge)} />
                        <Mini label="الرصيد الحالي" value={money(c.balance)} />
                        <Mini label="عمولتك منه" value={money(c.commission)} accent />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-3">
      <p className="text-[11px] font-bold text-gray-500 flex items-center gap-1">{icon}{label}</p>
      <p className="text-base font-black text-gray-800 mt-1">{value}</p>
    </div>
  );
}

function Mini({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-md py-1.5 ${accent ? "bg-green-50" : "bg-gray-50"}`}>
      <p className="text-[10px] text-gray-500">{label}</p>
      <p className={`text-xs font-black ${accent ? "text-green-700" : "text-gray-800"}`}>{value}</p>
    </div>
  );
}
