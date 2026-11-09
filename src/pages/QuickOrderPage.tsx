import React, { useState } from "react";
import { ArrowRight, ChevronDown, Star } from "lucide-react";
import { UserData } from "../types";
import OptimizedImage from "../components/OptimizedImage";
import NameVerificationWidget from "../components/NameVerificationWidget";
import { buildUi, PillInput, PickerSheet, PickerRow, filterValueByKeyboardTypes } from "./CheckoutPage";
import { showToast } from "../components/ToastContainer";
import OrderResultCard, { OrderResultData } from "../components/OrderResultCard";

// [REDESIGN] أُعيد تصميم هذه الصفحة بالكامل لتطابق هوية صفحة تأكيد الطلب الجديدة (نفس توكنز
// buildUi المُصدَّرة من CheckoutPage.tsx) بدل تصميمها القديم المنفصل — كانت الصفحتان بشكلين
// مختلفين جذرياً لنفس وظيفة "شراء منتج" رغم كونهما نفس التجربة من منظور المستخدم.

export interface QuickOrderPageProps {
  view: { type: string; data?: any; [key: string]: any };
  user: UserData | null;
  siteSettings: any[];
  theme: any;
  isDarkMode?: boolean;
  isModal?: boolean;
  fmtPrice: (usd: number, decimals?: number) => string;
  setView: (val: any) => void;
  setActiveTab: (tab: string) => void;
  fetchUser: (id: number) => void;
  navigateBack: () => void;
  isFavorite: (favKey: string) => boolean;
  addToFavorites: (item: any) => void;
  removeFromFavorites: (favKey: string) => void;
}

const QuickOrderPage = ({
  view,
  user,
  siteSettings,
  theme,
  isDarkMode,
  isModal,
  fmtPrice,
  setView,
  setActiveTab,
  fetchUser,
  navigateBack,
  isFavorite,
  addToFavorites,
  removeFromFavorites,
}: QuickOrderPageProps) => {
  const prod = view.data;
  const ui = React.useMemo(() => buildUi(!!isDarkMode), [isDarkMode]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [orderResult, setOrderResult] = useState<OrderResultData | null>(null);

  type KeyboardType = "numbers" | "letters" | "symbols";

  // الحقول (الافتراضية + المخصصة) المحفوظة على المنتج من لوحة الإدارة
  const allFields: Array<{ id: string; label: string; required: boolean; isDefault?: boolean; keyboard_types?: KeyboardType[] }> = React.useMemo(() => {
    try {
      if (!prod?.custom_fields) return [];
      const parsed = typeof prod.custom_fields === "string" ? JSON.parse(prod.custom_fields) : prod.custom_fields;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [prod?.custom_fields]);

  // إذا لم يحفظ الأدمن أي حقل افتراضي صريح بعد (سواء لم تكن هناك حقول مخصصة إطلاقاً،
  // أو كانت موجودة بالصيغة القديمة قبل isDefault)، نعرض حقل المعرف الافتراضي القياسي كحد أدنى
  const explicitDefaultFields = allFields.filter(f => f.isDefault);
  const defaultFields = explicitDefaultFields.length > 0
    ? explicitDefaultFields
    : [{ id: "__legacy_default_id__", label: prod?.input_label?.trim() || "ضع المعرف (ID)", required: true, isDefault: true }];
  const customFields = allFields.filter(f => !f.isDefault);

  // خانة/خانات المعرف المُختارة صراحةً من الأدمن لتُستخدم كمصدر للتحقق من الاسم (تدعم أي نوع منتج)
  const nvSourceFields = React.useMemo(() => allFields.filter((f: any) => f.nvSource === true), [allFields]);

  const vipDiscountPct = parseFloat(siteSettings?.find((s: any) => s.key === "vip_discount")?.value || "5") / 100;

  // دعم منتجات "الباقات المحددة" (package_values) في متجر الطلب السريع
  const hasPackageValues = Array.isArray(prod?.package_values) && prod.package_values.length > 0;
  const [selectedPackageValue, setSelectedPackageValue] = useState<number | null>(
    hasPackageValues ? prod.package_values[0] : null
  );
  const [packagePickerOpen, setPackagePickerOpen] = useState(false);
  const unitPrice = Number(prod?.price) || 0;
  const safeQty = hasPackageValues ? (selectedPackageValue ?? prod.package_values[0]) : 1;
  const baseTotal = unitPrice * safeQty;
  const finalPrice = user?.is_vip ? baseTotal * (1 - vipDiscountPct) : baseTotal;
  const showBreakdown = hasPackageValues;

  const favKey = `prod_${prod?.id}`;
  const favorited = isFavorite(favKey);
  const toggleFavorite = () => {
    if (favorited) {
      removeFromFavorites(favKey);
      showToast("أُزيل من المفضلة", "info");
    } else {
      addToFavorites({ ...prod, _fav_key: favKey, _fav_type: "product", _fav_label: prod.name, _fav_image: prod.image_url });
      showToast("أُضيف إلى المفضلة", "success");
    }
  };

  const handleQuickOrder = async () => {
    if (!user) return;
    if (hasPackageValues && !prod.package_values.includes(safeQty)) {
      return setError("يرجى اختيار قيمة باقة صحيحة");
    }
    for (const field of defaultFields) {
      if (field.required && !fieldValues[field.id]?.trim()) {
        return setError(`الحقل "${field.label}" إلزامي`);
      }
    }
    for (const field of customFields) {
      if (field.required && !fieldValues[field.id]?.trim()) {
        return setError(`الحقل "${field.label}" إلزامي`);
      }
    }

    const primaryValue = fieldValues[defaultFields[0]?.id] || "";

    setLoading(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("authToken") || ""}` },
        body: JSON.stringify({
          userId: user.id,
          productId: prod.id,
          quantity: safeQty,
          extraData: {
            playerId: primaryValue,
            input: primaryValue,
            storeType: 'quick_order',
            defaultFields: defaultFields.map(f => ({ label: f.label, value: fieldValues[f.id] || "", required: f.required })),
            customFields: customFields.length > 0
              ? customFields.map(f => ({ label: f.label, value: fieldValues[f.id] || "", required: f.required }))
              : undefined
          }
        })
      });

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Expected JSON response from orders API");
      }

      const data = await res.json();
      if (data.success) {
        fetchUser(user.id);
        setOrderResult({
          ...data,
          prod,
          externalOrderId: data.externalOrderId || null,
          externalStatus: data.pendingAdmin ? "pending" : (data.externalStatus || "completed"),
          replayApi: Array.isArray(data.replayApi) ? data.replayApi.map(String) : (data.inventoryDelivered ? [data.inventoryDelivered] : []),
          finalPriceOverride: finalPrice,
          note: data.pendingAdmin ? "تم استلام طلبك بنجاح! سيتم مراجعته والرد عليك قريباً." : "تم إرسال الطلب السريع بنجاح!",
        });
      } else {
        setError(data.error || "حدث خطأ ما");
      }
    } catch (e: any) {
      if (e.name === 'TypeError' && e.message === 'Failed to fetch') {
        setError("فشل الاتصال بالخادم (تأكد من اتصالك بالإنترنت)");
      } else {
        setError("حدث خطأ ما أثناء إرسال الطلب");
        console.error("Quick order error:", e);
      }
    } finally {
      setLoading(false);
    }
  };

  if (orderResult) {
    return (
      <OrderResultCard
        orderResult={orderResult}
        finalPrice={finalPrice}
        fmtPrice={fmtPrice}
        theme={theme}
        ui={ui}
        isModal={!!isModal}
        goBack={navigateBack}
        onReset={() => setOrderResult(null)}
        setView={setView}
        setActiveTab={setActiveTab}
        onStatusUpdate={(newStatus, replayApi) => setOrderResult((prev) => (prev ? { ...prev, externalStatus: newStatus, replayApi } : prev))}
      />
    );
  }

  return (
    <div className={isModal ? `${ui.bg} border ${ui.modalBorder} rounded-3xl py-6 px-5` : `${ui.bg} min-h-screen py-6 px-5`}>
      <div className="max-w-sm mx-auto">
        <div className="flex items-center justify-between mb-2">
          <button onClick={navigateBack} className={`p-2 rounded-full active:scale-90 transition-transform ${ui.chip}`}>
            <ArrowRight size={18} />
          </button>
          <button
            onClick={toggleFavorite}
            className={`p-2 rounded-full active:scale-90 transition-transform ${favorited ? "bg-amber-500/15 text-amber-500" : ui.chip}`}
          >
            <Star size={18} fill={favorited ? "currentColor" : "none"} />
          </button>
        </div>

        <div className="flex flex-col items-center text-center">
          {/* ===== صورة المنتج ===== */}
          <div className="w-20 h-20 rounded-xl overflow-hidden">
            <OptimizedImage
              src={prod.image_url || "https://picsum.photos/seed/prod/300/300"}
              width={160} height={160} alt={prod.name}
              className="w-full h-full object-cover"
            />
          </div>

          {/* ===== الاسم ===== */}
          <h2 className={`font-bold text-xs mt-3 ${ui.text}`}>{prod.name}</h2>

          {/* ===== السعر ===== */}
          <div className="flex items-center justify-center gap-2 flex-wrap mt-1">
            {user?.is_vip && <span className={`line-through text-[11px] ${ui.muted}`}>{fmtPrice(unitPrice)}</span>}
            <span className={`font-black text-lg ${theme.text}`}>{fmtPrice(unitPrice)}</span>
          </div>
          {user?.is_vip && (
            <div className="flex items-center justify-center gap-1.5 flex-wrap mt-2">
              <span className="text-[10px] bg-amber-500/15 text-amber-500 px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
                <Star size={9} fill="currentColor" /> VIP
              </span>
            </div>
          )}

          {/* ===== تفصيل السعر (فقط عند وجود باقات) ===== */}
          {showBreakdown && (
            <div className={`w-full mt-4 ${ui.breakdownBg} rounded-2xl p-3.5 space-y-1.5 text-sm`}>
              <div className="flex justify-between"><span className={ui.muted}>سعر الوحدة</span><span className={`font-bold ${ui.text}`}>{fmtPrice(unitPrice)}</span></div>
              <div className="flex justify-between"><span className={ui.muted}>الكمية</span><span className={`font-bold ${ui.text}`}>{safeQty}</span></div>
              <div className={`border-t border-dashed ${ui.dividerDashed} my-1`} />
              <div className="flex justify-between"><span className={ui.muted}>المجموع</span><span className={`font-bold ${theme.text}`}>{fmtPrice(baseTotal)}</span></div>
            </div>
          )}

          {user?.is_vip && (
            <div className="w-full mt-3 flex items-center justify-between text-xs bg-amber-500/10 border border-amber-500/20 rounded-2xl px-3.5 py-2.5">
              <div className="flex items-center gap-1.5 text-amber-500 font-bold">
                <Star size={12} fill="currentColor" /> خصم VIP ({siteSettings?.find((s: any) => s.key === "vip_discount")?.value || "5"}%)
              </div>
              <span className="text-amber-500 font-bold">- {fmtPrice(baseTotal * vipDiscountPct)}</span>
            </div>
          )}

          {/* ===== خانات الطلب (باقة/حقول) ===== */}
          <div className="w-full mt-8 space-y-3">
            {hasPackageValues && (
              <button
                type="button"
                onClick={() => setPackagePickerOpen(true)}
                className={`w-full bg-transparent border ${ui.border} rounded-full px-5 py-3.5 flex items-center justify-between active:scale-[0.99] transition-transform`}
              >
                <span className={`font-bold text-sm ${ui.text}`}>{selectedPackageValue ?? prod.package_values[0]} <span className={`font-normal ${ui.muted}`}>— {fmtPrice(unitPrice * (selectedPackageValue ?? prod.package_values[0]))}</span></span>
                <ChevronDown size={18} className={ui.muted} />
              </button>
            )}
            <PickerSheet open={hasPackageValues && packagePickerOpen} title="اختر الباقة" onClose={() => setPackagePickerOpen(false)} ui={ui}>
              {hasPackageValues && prod.package_values.map((v: number) => {
                const isSelected = v === (selectedPackageValue ?? prod.package_values[0]);
                return (
                  <PickerRow key={v} label={v} price={fmtPrice(unitPrice * v)} selected={isSelected} theme={theme} ui={ui}
                    onClick={() => { setSelectedPackageValue(v); setPackagePickerOpen(false); }} />
                );
              })}
            </PickerSheet>

            {defaultFields.map((field) => (
              <PillInput
                key={field.id} label={field.label} required={field.required}
                value={fieldValues[field.id] || ""}
                onChange={(v) => setFieldValues(prev => ({ ...prev, [field.id]: filterValueByKeyboardTypes(v, field.keyboard_types) }))}
                keyboardTypes={field.keyboard_types}
                ui={ui}
              />
            ))}

            {customFields.map((field) => (
              <PillInput
                key={field.id} label={field.label} required={field.required}
                value={fieldValues[field.id] || ""}
                onChange={(v) => setFieldValues(prev => ({ ...prev, [field.id]: filterValueByKeyboardTypes(v, field.keyboard_types) }))}
                keyboardTypes={field.keyboard_types}
                ui={ui}
              />
            ))}
          </div>

          {/* ===== التحقق من الاسم — يظهر فقط عند تفعيله لهذا المنتج ===== */}
          {!!prod?.id && (
            <div className="w-full mt-3">
              <NameVerificationWidget
                productId={prod.id}
                uid={
                  nvSourceFields.length > 0
                    ? nvSourceFields.map((f: any) => (fieldValues[f.id] || "").trim()).filter(Boolean).join(" ")
                    : (fieldValues[defaultFields[0]?.id] || "")
                }
                theme={theme}
                game={prod.name_verification_game}
                userId={user?.id}
                onBalanceCharged={() => { if (user?.id) fetchUser(user.id); }}
                pillMode={isDarkMode ? "dark" : "light"}
              />
            </div>
          )}

          {error && <p className="text-red-500 text-sm text-center font-medium mt-4">{error}</p>}

          {/* ===== إلغاء / تأكيد الدفع ===== */}
          <div className="w-full flex items-center justify-center gap-3 mt-6">
            <button
              disabled={loading}
              onClick={handleQuickOrder}
              className={`${theme.bgLight} ${theme.text} font-bold text-base px-10 py-4 rounded-full disabled:opacity-50 active:scale-95 transition-transform`}
            >
              {loading ? "جاري الإرسال..." : "تأكيد الدفع"}
            </button>
            <button
              onClick={navigateBack}
              className="border-2 border-red-400/60 text-red-400 font-bold text-base px-10 py-4 rounded-full active:scale-95 transition-transform"
            >
              إلغاء
            </button>
          </div>

          {/* ===== وصف المنتج ===== */}
          {prod.description && (
            <p className={`text-xs leading-relaxed whitespace-pre-line mt-5 ${ui.muted}`}>{prod.description}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuickOrderPage;
