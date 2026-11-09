import React, { useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { showToast } from "../components/ToastContainer";
import { UserData } from "../types";

export interface ReferralPageProps {
  user: UserData | null;
  siteSettings: any[] | null;
  setView: (val: any) => void;
}

export default function ReferralPage({ user, siteSettings, setView }: ReferralPageProps) {
  const [stats, setStats] = useState<{ count: number; referrals: any[] }>({ count: 0, referrals: [] });
  const commissionRate = parseFloat(siteSettings?.find((s: any) => s.key === "referral_commission")?.value || "5");
  const referralLink = `${window.location.origin}/?ref=${user?.id}`;
  const [referralCodeInput, setReferralCodeInput] = useState("");
  const [hasUsedReferral, setHasUsedReferral] = useState<boolean>(!!user?.referred_by_id);
  const [applying, setApplying] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setStatsLoading(true);
      const token = localStorage.getItem("authToken") || "";
      fetch(`/api/referrals/stats/${user.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      })
        .then(res => res.json())
        .then(data => setStats({ count: data.count || 0, referrals: data.referrals || [] }))
        .catch(console.error)
        .finally(() => setStatsLoading(false));
    }
  }, [user]);

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    showToast("تم نسخ رابط الإحالة", 'success');
  };

  const applyReferralCode = async () => {
    if (!referralCodeInput.trim()) return;
    setApplying(true);
    try {
      const token = localStorage.getItem("authToken") || "";
      const res = await fetch("/api/referrals/apply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ referralCode: referralCodeInput.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "حدث خطأ", 'error');
        if (data.error === "لقد استخدمت كود احالة بالفعل") {
          setHasUsedReferral(true);
        }
        return;
      }
      setHasUsedReferral(true);
      showToast("تم تفعيل كود الإحالة بنجاح", 'success');
    } catch {
      showToast("حدث خطأ، حاول مرة أخرى", 'error');
    } finally {
      setApplying(false);
    }
  };

  return (
    <div className="px-4 space-y-6 pb-20">
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => setView({ type: "main" })} className="p-2 bg-gray-100 rounded-full">
          <ArrowRight size={20} className="text-gray-600" />
        </button>
        <h2 className="text-xl font-bold text-gray-800">نظام الإحالة</h2>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm text-center space-y-4">
        <div className="w-24 h-24 mx-auto flex items-center justify-center">
          <img
            src="https://i.ibb.co/d0kSkmhR/1000041910-removebg-preview.png"
            alt="نظام الإحالة"
            className="w-24 h-24 object-contain aspect-square"
          />
        </div>
        <h3 className="font-bold text-lg">اربح {commissionRate}% من كل عملية شراء</h3>
        <p className="text-gray-500 text-sm">شارك رابط الإحالة الخاص بك مع أصدقائك واحصل على عمولة {commissionRate}% من كل عملية شراء يقومون بها، تضاف مباشرة إلى رصيدك.</p>
        
        <div className="bg-brand-light p-4 rounded-lg">
          <p className="text-xs text-brand font-bold mb-1">عدد المستخدمين المسجلين عبر رابطك</p>
          {statsLoading ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-brand bg-white/60 px-2.5 py-1 rounded-full animate-pulse">
              <span className="w-2 h-2 rounded-full bg-brand animate-ping" />
              جاري التحميل...
            </span>
          ) : (
            <p className="text-2xl font-bold text-brand">{stats.count}</p>
          )}
        </div>

        {!statsLoading && stats.referrals.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-bold text-gray-700 text-right">المستخدمون المُحالون</p>
            <div className="space-y-2">
              {stats.referrals.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-2">
                  <span className="text-sm text-gray-700 font-medium">{r.name || "مستخدم"}</span>
                  <span className="text-[10px] text-gray-400">{new Date(r.created_at).toLocaleDateString("ar-EG")}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-sm font-bold text-gray-700 text-right">رابط الإحالة الخاص بك</p>
          <div className="flex gap-2">
            <button onClick={copyLink} className="bg-brand text-white px-4 py-2 rounded-lg font-bold text-sm">نسخ</button>
            <input 
              readOnly 
              value={referralLink}
              className="flex-1 bg-gray-50 border border-gray-100 rounded-lg px-4 py-2 text-sm text-left outline-none"
            />
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t border-gray-100">
          <p className="text-sm font-bold text-gray-700 text-right">هل لديك كود إحالة؟</p>
          {hasUsedReferral ? (
            <div className="flex items-center justify-center gap-2 bg-green-50 text-green-600 rounded-lg px-4 py-3 text-sm font-bold">
              <span>لقد استخدمت كود احالة بالفعل</span>
              <span>✓</span>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={applyReferralCode}
                disabled={applying || !referralCodeInput.trim()}
                className="bg-brand text-white px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50"
              >
                {applying ? "جاري..." : "استخدام"}
              </button>
              <input
                type="text"
                value={referralCodeInput}
                onChange={(e) => setReferralCodeInput(e.target.value)}
                placeholder="ضع رقم الإحالة"
                className="flex-1 bg-gray-50 border border-gray-100 rounded-lg px-4 py-2 text-sm text-right outline-none"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
