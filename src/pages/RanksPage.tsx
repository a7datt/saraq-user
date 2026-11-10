import React, { useEffect, useState } from "react";
import { ArrowRight, Check, Lock, Percent, Sparkles, TrendingUp } from "lucide-react";
import { UserData, Rank, MyRankInfo } from "../types";
import OptimizedImage from "../components/OptimizedImage";

export interface RanksPageProps {
  user: UserData | null;
  setView: (val: any) => void;
  setActiveTab: (tab: string) => void;
  rankInfo: MyRankInfo | null;
  refreshRank: () => void;
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

export default function RanksPage({ user, setView, setActiveTab, rankInfo, refreshRank }: RanksPageProps) {
  const [publicRanks, setPublicRanks] = useState<Rank[]>([]);

  useEffect(() => {
    refreshRank();
    if (!user) {
      fetch("/api/ranks").then(r => r.json()).then(d => setPublicRanks(Array.isArray(d) ? d : [])).catch(() => {});
    }
  }, [user?.id]);

  const ranks: Rank[] = rankInfo?.ranks?.length ? rankInfo.ranks : publicRanks;
  const current = rankInfo?.current || null;
  const next = rankInfo?.next || null;
  const total = rankInfo?.total_recharge_sum ?? 0;
  const progress = rankInfo?.progress_percent ?? 0;
  const remaining = rankInfo?.remaining ?? 0;
  const currentOrder = current ? Number(current.sort_order) : -1;

  return (
    <div className="p-4 pb-28 space-y-4" dir="rtl">
      <div className="flex items-center gap-2">
        <button onClick={() => { setActiveTab("home"); setView({ type: "main" }); }} className="p-2 bg-gray-100 rounded-full">
          <ArrowRight size={20} className="text-gray-600" />
        </button>
        <h2 className="text-xl font-black text-gray-800">نظام الرتب</h2>
      </div>

      {/* بطاقة الرتبة الحالية + شريط التقدم */}
      {user ? (
        <div className="relative overflow-hidden rounded-2xl border border-[var(--brand)]/40 bg-gradient-to-br from-zinc-900 via-black to-zinc-900 text-white p-5 shadow-[0_0_40px_-12px_var(--brand)]">
          <div className="absolute -top-16 -left-16 w-48 h-48 rounded-full bg-[var(--brand)]/20 blur-3xl pointer-events-none" />
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 shrink-0 rank-badge-current rounded-2xl flex items-center justify-center" style={{ ["--rank-color" as any]: current?.color || "var(--brand)" }}>
              {current?.image_url ? (
                <OptimizedImage src={current.image_url} width={160} height={160} alt={current.name} className="w-full h-full object-contain drop-shadow-lg" eager />
              ) : (
                <Sparkles size={34} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-white/60 font-bold">رتبتك الحالية</p>
              <p className="text-2xl font-black truncate" style={{ color: current?.color || "#fff" }}>{current?.name || "—"}</p>
              {current?.has_discount && Number(current.discount_percent) > 0 && (
                <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-black bg-[var(--brand)] text-white px-2 py-0.5 rounded-full">
                  <Percent size={11} /> خصم {fmt(Number(current.discount_percent))}% على مشترياتك
                </span>
              )}
              {rankInfo?.is_manual && (
                <p className="text-[10px] text-amber-300 font-bold mt-1">رتبة ممنوحة من الإدارة</p>
              )}
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center justify-between text-[11px] font-bold mb-1.5">
              <span className="text-white/70 flex items-center gap-1"><TrendingUp size={12} /> إجمالي ما شحنته: <b className="text-white">{fmt(total)}$</b></span>
              {next ? <span className="text-white/70">الرتبة التالية: <b style={{ color: next.color }}>{next.name}</b></span> : <span className="text-amber-300">وصلت لأعلى رتبة</span>}
            </div>
            <div className="h-3.5 w-full rounded-full bg-white/10 overflow-hidden border border-white/10">
              <div
                className="h-full rounded-full rank-progress-fill transition-all duration-700"
                style={{ width: `${Math.max(progress, next ? 3 : 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-1.5 text-[11px] font-black">
              {next ? (
                <>
                  <span>{fmt(total)}$ / {fmt(Number(next.required_amount))}$</span>
                  <span className="text-[var(--brand)] brightness-150">متبقي {fmt(remaining)}$</span>
                </>
              ) : (
                <span className="text-white/70">أنت في القمة — شكراً لثقتك بنا</span>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 text-center">
          <p className="font-bold text-gray-700 mb-3">سجّل الدخول لمعرفة رتبتك وتقدّمك</p>
          <button onClick={() => setView({ type: "login" })} className="bg-brand text-white font-black px-5 py-2.5 rounded-xl text-sm">تسجيل الدخول</button>
        </div>
      )}

      {/* قائمة كل الرتب */}
      <div className="space-y-3">
        <p className="text-sm font-black text-gray-700">جميع الرتب المتاحة</p>
        {ranks.length === 0 && <p className="text-center text-xs text-gray-400 py-6">لا توجد رتب معرّفة بعد</p>}
        {ranks.map((r) => {
          const order = Number(r.sort_order);
          const isCurrent = current && String(current.id) === String(r.id);
          const achieved = user ? (currentOrder >= order && !isCurrent) : false;
          const locked = user ? order > currentOrder : true;
          const benefits = (r.benefits || "").split("\n").map(s => s.trim()).filter(Boolean);
          return (
            <div
              key={r.id}
              className={`relative rounded-2xl border p-4 transition-all ${isCurrent ? "border-[var(--brand)] bg-white shadow-[0_0_30px_-14px_var(--brand)] ring-1 ring-[var(--brand)]/40" : "border-gray-200 bg-white"}`}
              style={isCurrent ? { borderColor: r.color } : undefined}
            >
              {isCurrent && (
                <span className="absolute -top-2.5 right-4 text-[10px] font-black bg-[var(--brand)] text-white px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow">
                  <Check size={10} /> رتبتك الحالية
                </span>
              )}
              <div className="flex items-start gap-3">
                <div className="w-16 h-16 shrink-0 rounded-xl flex items-center justify-center bg-gray-50 border border-gray-100" style={{ boxShadow: isCurrent ? `0 0 18px -4px ${r.color}` : undefined }}>
                  {r.image_url ? (
                    <OptimizedImage src={r.image_url} width={128} height={128} alt={r.name} className={`w-full h-full object-contain ${locked && !isCurrent ? "opacity-60 grayscale-[35%]" : ""}`} />
                  ) : (
                    <Sparkles size={26} style={{ color: r.color }} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-black text-base" style={{ color: r.color }}>{r.name}</h3>
                    {achieved && <span className="text-[9px] font-bold text-green-600 bg-green-50 border border-green-100 px-1.5 py-0.5 rounded flex items-center gap-0.5"><Check size={9} /> مكتسبة</span>}
                    {locked && !isCurrent && <span className="text-[9px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded flex items-center gap-0.5"><Lock size={9} /> مقفلة</span>}
                  </div>
                  {r.description && <p className="text-[12px] text-gray-500 mt-1 leading-relaxed">{r.description}</p>}
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-[11px] font-black bg-gray-100 text-gray-700 px-2 py-1 rounded-lg">
                      {Number(r.required_amount) > 0 ? `المطلوب: شحن ${fmt(Number(r.required_amount))}$` : "رتبة البداية — بدون شرط"}
                    </span>
                    <span className={`text-[11px] font-black px-2 py-1 rounded-lg flex items-center gap-1 ${r.has_discount && Number(r.discount_percent) > 0 ? "bg-[var(--brand)]/10 text-[var(--brand)]" : "bg-gray-100 text-gray-400"}`}>
                      <Percent size={11} />
                      {r.has_discount && Number(r.discount_percent) > 0 ? `خصم ${fmt(Number(r.discount_percent))}%` : "بدون خصم"}
                    </span>
                  </div>
                  {benefits.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {benefits.map((b, i) => (
                        <li key={i} className="text-[11px] text-gray-600 flex items-start gap-1.5">
                          <Check size={11} className="mt-0.5 shrink-0" style={{ color: r.color }} /> <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-gray-400 text-center leading-relaxed px-4">
        تُرقّى رتبتك تلقائياً حسب إجمالي ما شحنته بالدولار، ويُطبَّق خصم رتبتك مباشرة على كل عملية شراء.
      </p>
    </div>
  );
}
