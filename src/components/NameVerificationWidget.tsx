/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from "react";
import { ShieldCheck, Loader2, User2, RefreshCw } from "lucide-react";
import { showToast } from "./ToastContainer";
import { FreeFireProfileModal, VerifiedPlayerInfo } from "./FreeFireProfileModal";

export type { VerifiedPlayerInfo };

interface NameVerificationWidgetProps {
  productId: number | string;
  uid: string;
  theme: any;
  game?: string;
  userId?: number | string;
  /** يُستدعى فور نجاح عملية التحقق مع خصم فعلي من الرصيد، ليتسنى للصفحة الأم تحديث الرصيد المعروض فوراً */
  onBalanceCharged?: (chargedAmount: number) => void;
  /** "legacy" (افتراضي): الشكل الأصلي بحدود متقطّعة، تستخدمه بقية الصفحات (مثل الطلب السريع) دون
   *  تغيير. "light"/"dark": خانة بيضاوية موحّدة بأيقونة تحديث دائرية — تستخدمها صفحة تأكيد الطلب
   *  فقط، وتتبع وضع الموقع الليلي/النهاري الفعلي بدل لون ثابت. */
  pillMode?: "legacy" | "light" | "dark";
}

/**
 * ودجت التحقق من اسم اللاعب — تُعرض أسفل تفاصيل المنتج وفوق ملخص السعر عند تفعيل
 * الميزة للمنتج. تستخدم المعرف الذي أدخله المستخدم في خانة الـ ID، وتعتمد على
 * منطقة الخادم المحددة من لوحة التحكم للمنتج (لا تُعرض للمستخدم لأنها مربوطة بالمنتج).
 * عند نجاح التحقق، يمكن للمستخدم فتح بروفايل احترافي شامل يعرض كل بيانات الحساب.
 *
 * ملاحظة مهمة: هذا المكوّن لا يعتمد فقط على بيانات المنتج المخزَّنة مسبقاً في الواجهة
 * (والتي قد تكون قديمة إن فُتحت صفحة تأكيد الطلب من ذاكرة الجهاز)، بل يتحقق مباشرةً
 * من الخادم عند التحميل لمعرفة ما إذا كان مزوّد الـ API لا يزال مفعّلاً. إن عطّل
 * الأدمن المزوّد، يختفي الزر فوراً حتى لو كان المنتج معلَّماً بأن التحقق مفعّل
 * محلياً؛ وعند إعادة التفعيل يعود الزر بدون أي حاجة لإعادة ضبط المنتج يدوياً.
 */
export const NameVerificationWidget: React.FC<NameVerificationWidgetProps> = ({ productId, uid, theme, game, userId, onBalanceCharged, pillMode = "legacy" }) => {
  const isDarkPill = pillMode === "dark";
  const isPill = pillMode !== "legacy";
  const isFreeFire = game === "freefire";
  const [loading, setLoading] = useState(false);
  const [player, setPlayer] = useState<VerifiedPlayerInfo | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  // نبدأ بعدم عرض أي شيء إطلاقاً (null) لحين وصول رد الخادم الفعلي. عرض الزر تفاؤلياً قبل
  // التأكد يسبب ظهور الزر لجزء من الثانية ثم اختفاءه للمنتجات غير المفعّلة، وهو خلل بصري.
  // كذلك سعر التحقق يصل مع نفس الرد فلا يظهر الزر إلا وسعره جاهز معه دفعة واحدة، بلا أي وميض.
  const [liveEnabled, setLiveEnabled] = useState<boolean | null>(null);
  const [pricePerCheck, setPricePerCheck] = useState<number>(0);
  const [insufficientBalance, setInsufficientBalance] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!productId) {
      setLiveEnabled(false);
      return;
    }
    fetch(`/api/name-verification/status/${encodeURIComponent(String(productId))}`)
      .then(r => r.json().then(data => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (cancelled) return;
        if (!ok) {
          // خطأ فعلي من الخادم (وليس تعطيلاً متعمَّداً من الأدمن) — نُسجّله بالكونسول
          // للمساعدة على التشخيص بدل إخفاء الزر بصمت وكأنه تعطيل مقصود
          console.error("[NameVerification] status check failed:", data?.error || "unknown");
          setLiveEnabled(false);
          return;
        }
        setLiveEnabled(!!data?.enabled);
        const p = Number(data?.price_per_check);
        setPricePerCheck(Number.isFinite(p) && p > 0 ? p : 0);
      })
      .catch((err) => {
        // في حال تعذّر الاتصال، لا نُظهر الزر تحسباً لعدم توفر مفتاح API فعلياً
        console.error("[NameVerification] status check network error:", err);
        if (!cancelled) setLiveEnabled(false);
      });
    return () => { cancelled = true; };
  }, [productId]);

  const handleVerify = async () => {
    if (loading) return;
    if (!uid || !uid.trim()) {
      showToast("يرجى إدخال معرف اللاعب (UID) أولاً", "error");
      return;
    }
    setLoading(true);
    setInsufficientBalance(false);
    try {
      const res = await fetch("/api/name-verification/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`,
        },
        body: JSON.stringify({ product_id: productId, uid: uid.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setPlayer(data.data);
        // الخصم يحدث في الخادم فور نجاح جلب البيانات من المزوّد؛ هنا فقط نُبلّغ الصفحة الأم
        // بضرورة تحديث الرصيد المعروض للمستخدم مباشرة كي يظهر الخصم فوراً بالواجهة دون تأخير
        // أو انتظار أي إجراء آخر (كإتمام الطلب).
        const charged = Number(data?.charged);
        if (Number.isFinite(charged) && charged > 0) {
          onBalanceCharged?.(charged);
        }
      } else {
        if (res.status === 400 && /رصيدك الحالي غير كافٍ/.test(data?.error || "")) {
          setInsufficientBalance(true);
        }
        showToast(data?.error || "تعذر التحقق من الحساب. يرجى المحاولة لاحقاً.", "error");
      }
    } catch {
      showToast("تعذر الاتصال بالخادم لإتمام عملية التحقق. يرجى التأكد من اتصالك بالإنترنت والمحاولة مرة أخرى.", "error");
    } finally {
      setLoading(false);
    }
  };

  // لا نعرض شيئاً أبداً إن كان المزوّد معطّلاً من لوحة التحكم (أو أثناء التحقق الأولي من الحالة)
  if (liveEnabled !== true) return null;

  return (
    <div className="space-y-2">
      {!player ? (
        <>
          {isPill ? (
            <button
              type="button"
              disabled={loading}
              onClick={handleVerify}
              className={`w-full flex items-center rounded-full overflow-hidden disabled:opacity-60 border ${isDarkPill ? "bg-zinc-900 border-zinc-800" : "bg-transparent border-gray-200"}`}
            >
              <span className={`flex-1 text-center font-bold text-sm py-3.5 ${isDarkPill ? "text-white" : "text-gray-800"}`}>
                {loading ? "جارٍ التحقق..." : "التحقق من الاسم"}
              </span>
              <span className={`w-12 h-12 flex items-center justify-center shrink-0 border-r ${isDarkPill ? "border-zinc-800 text-zinc-300" : "border-gray-200 text-gray-500"}`}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              </span>
            </button>
          ) : (
            <button
              type="button"
              disabled={loading}
              onClick={handleVerify}
              className={`w-full flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm border-2 border-dashed transition-colors disabled:opacity-60 ${theme?.border || "border-gray-200"} text-gray-700 hover:bg-gray-50`}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> جارٍ التحقق...
                </>
              ) : (
                <>
                  <ShieldCheck size={16} /> تحقق من الاسم
                </>
              )}
            </button>
          )}
          {/* سعر التحقق لكل عملية — لا يظهر إطلاقاً إن كان السعر صفراً (بدون أي خصم من رصيد المستخدم) */}
          {pricePerCheck > 0 && (
            <p className={`text-[11px] font-bold text-center ${insufficientBalance ? "text-red-500" : isDarkPill ? "text-zinc-500" : isPill ? "text-gray-400" : "text-gray-500"}`}>
              سعر التحقق من الاسم لكل مرة: {pricePerCheck} $
            </p>
          )}
        </>
      ) : (
        <div className={`w-full flex items-center justify-between gap-2 py-2.5 px-4 rounded-full border ${isDarkPill ? "bg-green-500/10 border-green-500/20" : "bg-green-50 border-green-200"}`}>
          <div className="flex items-center gap-2 min-w-0">
            <User2 size={16} className={`shrink-0 ${isDarkPill ? "text-green-400" : "text-green-600"}`} />
            <span className={`font-bold text-sm truncate ${isDarkPill ? "text-green-400" : "text-green-800"}`}>{player.nickname || "تم التحقق"}</span>
          </div>
          {isFreeFire && (
            <button
              type="button"
              onClick={() => setShowProfile(true)}
              className={`text-[11px] font-bold rounded-full px-2.5 py-1.5 shrink-0 transition-colors ${
                isDarkPill ? "text-green-400 bg-zinc-900 border border-green-500/20 hover:bg-green-500/10" : "text-green-700 bg-white border border-green-200 hover:bg-green-100"
              }`}
            >
              عرض البروفايل
            </button>
          )}
        </div>
      )}

      {isFreeFire && showProfile && player && (
        <FreeFireProfileModal player={player} onClose={() => setShowProfile(false)} />
      )}
    </div>
  );
};

export default NameVerificationWidget;
