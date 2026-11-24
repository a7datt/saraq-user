import { useProductDiscounts } from "../utils/useProductDiscounts";
import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { ArrowRight, CheckCircle, ExternalLink, Star, ChevronDown, X, Layers } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { UserData } from "../types";
import OptimizedImage from "../components/OptimizedImage";
import ImageGalleryCarousel from "../components/ImageGalleryCarousel";
import NameVerificationWidget from "../components/NameVerificationWidget";
import { showToast } from "../components/ToastContainer";
import OrderResultCard, { OrderResultData } from "../components/OrderResultCard";

/* ============================================================================
 * أنواع مساعدة
 * ========================================================================== */

type FieldKeyboardType = "numbers" | "letters" | "symbols";
type FieldDef = { id: string; key?: string; label: string; required: boolean; isDefault?: boolean; keyboard_types?: FieldKeyboardType[]; nvSource?: boolean };
type PackageDataEntry = { label: string; price: number };

export interface CheckoutPageProps {
  view: { type: string; data?: any; [key: string]: any };
  user: UserData | null;
  siteSettings: any[];
  theme: any;
  /** يتبع وضع الموقع الليلي/النهاري — خلفية سوداء بالليلي وبيضاء بالنهاري (وليس أسود دائماً) */
  isDarkMode?: boolean;
  /** true عند العرض كنافذة منبثقة (بانل) بدل صفحة كاملة — يتحكم بالخلفية الممتدة مقابل اللوحة العائمة */
  isModal?: boolean;
  fmtPrice: (usd: number, decimals?: number) => string;
  setView: (val: any) => void;
  setActiveTab: (tab: string) => void;
  fetchUser: (id: number) => void;
  fetchOrders: () => void;
  checkoutQuantity: number;
  setCheckoutQuantity: (val: number) => void;
  checkoutOrderResult: any;
  setCheckoutOrderResult: (val: any) => void;
  navigateBack: () => void;
  isFavorite: (favKey: string) => boolean;
  addToFavorites: (item: any) => void;
  removeFromFavorites: (favKey: string) => void;
}

const STORAGE_KEY = "checkoutPageProduct";

/* ============================================================================
 * عمود واحد مُمركز (صورة/اسم/سعر/حقول/أزرار/وصف)، مع رموز ألوان تتبع الوضع
 * الليلي/النهاري بدل الأسود الثابت.
 * ========================================================================== */
// مُصدَّرة لإعادة استخدامها بصفحات أخرى (مثل QuickOrderPage) بدل تكرار نفس توكنز التصميم
export type UiTokens = ReturnType<typeof buildUi>;
export function buildUi(dark: boolean) {
  return {
    dark,
    bg: dark ? "bg-black" : "bg-white",
    text: dark ? "text-white" : "text-gray-800",
    muted: dark ? "text-zinc-500" : "text-gray-400",
    mutedStrong: dark ? "text-zinc-400" : "text-gray-500",
    border: dark ? "border-zinc-800" : "border-gray-200",
    borderFocus: dark ? "focus:border-zinc-600" : "focus:border-gray-400",
    placeholder: dark ? "placeholder-zinc-500" : "placeholder-gray-400",
    chip: dark ? "bg-zinc-900 text-zinc-400" : "bg-gray-100 text-gray-500",
    sheetBg: dark ? "bg-zinc-900" : "bg-white",
    sheetBorder: dark ? "border-zinc-800" : "border-gray-100",
    rowSelected: dark ? "bg-zinc-800 border-zinc-600" : "bg-gray-100 border-gray-300",
    rowHover: dark ? "hover:bg-zinc-800/60" : "hover:bg-gray-50",
    breakdownBg: dark ? "bg-zinc-900/70" : "bg-gray-50",
    dividerDashed: dark ? "border-zinc-700" : "border-gray-200",
    modalBorder: dark ? "border-zinc-700" : "border-gray-300",
  };
}

export const PillInput = ({ label, required, value, onChange, keyboardTypes, ui }: {
  label: string; required: boolean; value: string; onChange: (v: string) => void; keyboardTypes?: FieldKeyboardType[]; ui: UiTokens;
}) => {
  const numbersOnly = !!keyboardTypes && keyboardTypes.length === 1 && keyboardTypes[0] === "numbers";
  return (
    <div className="w-full">
      <input
        type={numbersOnly ? "tel" : "text"}
        inputMode={numbersOnly ? "numeric" : "text"}
        value={value}
        onChange={(e) => onChange(filterValueByKeyboardTypes(e.target.value, keyboardTypes))}
        placeholder={`${label}${required ? "" : " (اختياري)"}`}
        className={`w-full bg-transparent border ${ui.border} ${ui.text} ${ui.placeholder} text-center text-sm rounded-full px-5 py-3.5 outline-none ${ui.borderFocus} transition-colors`}
      />
    </div>
  );
};

/** يفلتر القيمة المُدخلة بحيث تحوي فقط الأنواع المسموحة من الأحرف حسب اختيار الأدمن لهذا الحقل */
export const filterValueByKeyboardTypes = (value: string, keyboardTypes?: FieldKeyboardType[]): string => {
  if (!keyboardTypes || keyboardTypes.length === 0 || keyboardTypes.length === 3) return value;
  const allowNumbers = keyboardTypes.includes("numbers");
  const allowLetters = keyboardTypes.includes("letters");
  const allowSymbols = keyboardTypes.includes("symbols");
  let pattern = "";
  if (allowNumbers) pattern += "0-9";
  if (allowLetters) pattern += "a-zA-Z\\u0600-\\u06FF";
  if (allowSymbols) pattern += " !-\\/:-@\\[-`{-~";
  if (!pattern) return value;
  const re = new RegExp(`[^${pattern}]`, "g");
  return value.replace(re, "");
};

export const TypeBadge = ({ storeType, isPackaged }: { storeType: string; isPackaged: boolean }) => {
  if (storeType === "external_api" || storeType === "inventory") {
    return <span className="text-[10px] bg-blue-500/15 text-blue-400 px-2.5 py-1 rounded-full font-bold flex items-center gap-1"><ExternalLink size={9} /> شحن فوري</span>;
  }
  if (isPackaged) {
    return <span className="text-[10px] bg-purple-500/15 text-purple-400 px-2.5 py-1 rounded-full font-bold flex items-center gap-1"><Layers size={9} /> باقات</span>;
  }
  if (storeType === "quantities") {
    return <span className="text-[10px] bg-zinc-500/15 text-zinc-400 px-2.5 py-1 rounded-full font-bold">حسب الكمية</span>;
  }
  return null;
};

/** نافذة اختيار سفلية لاختيار الباقة */
export const PickerSheet = ({ open, title, onClose, children, ui }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode; ui: UiTokens }) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] bg-black/60 flex items-end justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
          transition={{ type: "tween", duration: 0.25 }}
          className={`${ui.sheetBg} w-full max-w-sm rounded-t-3xl max-h-[75vh] overflow-hidden flex flex-col border-t ${ui.sheetBorder}`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={`p-4 border-b ${ui.sheetBorder} flex items-center justify-between flex-shrink-0`}>
            <h3 className={`font-bold text-sm ${ui.text}`}>{title}</h3>
            <button onClick={onClose} className={`p-1.5 rounded-full ${ui.rowHover}`}>
              <X size={18} className={ui.mutedStrong} />
            </button>
          </div>
          <div className="overflow-y-auto p-2">{children}</div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

export const PickerRow = ({ label, price, selected, onClick, theme, ui }: { label: React.ReactNode; price: string; selected: boolean; onClick: () => void; theme: any; ui: UiTokens }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl transition-colors ${selected ? ui.rowSelected + " border" : `border border-transparent ${ui.rowHover}`}`}
  >
    <span className={`font-bold ${selected ? theme.text : ui.text}`}>{label}</span>
    <div className="flex items-center gap-2">
      <span className={`text-sm ${ui.mutedStrong}`}>{price}</span>
      {selected && <CheckCircle size={18} className={theme.text} />}
    </div>
  </button>
);

/* ============================================================================
 * شاشة نتيجة الطلب بعد الإرسال انتقلت إلى مكوّن موحّد قابل لإعادة الاستخدام —
 * src/components/OrderResultCard.tsx — يُستخدم الآن أيضاً من QuickOrderPage.tsx
 * بدل شاشة نجاح نصية منفصلة لكل مسار شراء.
 * ========================================================================== */

/* ============================================================================
 * الصفحة الرئيسية
 * ========================================================================== */

const CheckoutPage = ({
  view, user, siteSettings, theme, isDarkMode = false, isModal = false, fmtPrice, setView, setActiveTab, fetchUser, fetchOrders,
  checkoutQuantity, setCheckoutQuantity, checkoutOrderResult, setCheckoutOrderResult, navigateBack,
  isFavorite, addToFavorites, removeFromFavorites,
}: CheckoutPageProps) => {
  const ui = useMemo(() => buildUi(!!isDarkMode), [isDarkMode]);

  /* ---------- استرجاع بيانات المنتج (مع دعم النجاة من إعادة تحميل الصفحة) ---------- */
  const prod = useMemo(() => {
    const fromView = view.data || checkoutOrderResult?.prod;
    if (fromView && fromView.id) {
      try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(fromView)); } catch {}
      return fromView;
    }
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {}
    return fromView || {};
  }, [view.data, checkoutOrderResult?.prod]);

  const hasProd = !!(view.data || checkoutOrderResult?.prod || prod?.id);
  const quotedDiscounts = useProductDiscounts([prod?.id], !!user);
  const quotedPct = quotedDiscounts[String(prod?.id)] || 0;

  /* ---------- تصنيف نوع المنتج ---------- */
  const isFixedQuantity = prod.min_quantity != null && prod.max_quantity != null && Number(prod.min_quantity) === Number(prod.max_quantity);
  const hasPackageValues = Array.isArray(prod.package_values) && prod.package_values.length > 0;
  const hasPackagesData = prod.store_type === "packages" && Array.isArray(prod.packages_data) && prod.packages_data.length > 0;
  const isPackaged = hasPackageValues || hasPackagesData;
  const isGallery = prod.store_type === "gallery";

  const parsedMinQty = parseFloat(String(prod.min_quantity));
  const parsedMaxQty = parseFloat(String(prod.max_quantity));
  const effectiveFixedQty = isFixedQuantity ? (parsedMinQty || 1) : null;
  const singleUnitOnly =
    !isPackaged &&
    (
      (!isFixedQuantity && (parsedMinQty || 1) <= 1 && (parsedMaxQty || 1) <= 1) ||
      (isFixedQuantity && effectiveFixedQty === 1)
    );
  const showQuantityField =
    (prod.store_type === "quantities" || prod.store_type === "external_api" || prod.store_type === "quick_order") &&
    !singleUnitOnly && !isFixedQuantity && !isPackaged;

  /* ---------- حالة الباقات ---------- */
  const [selectedPackageValue, setSelectedPackageValue] = useState<number | null>(
    hasPackageValues
      ? Number(checkoutQuantity) && prod.package_values.includes(Number(checkoutQuantity))
        ? Number(checkoutQuantity)
        : prod.package_values[0]
      : null
  );
  const [selectedPackageLabel, setSelectedPackageLabel] = useState<string | null>(
    hasPackagesData ? prod.packages_data[0].label : null
  );
  const [packagePickerOpen, setPackagePickerOpen] = useState(false);

  /* ---------- حالة الكمية الحرة ---------- */
  const qtyRef = useRef<HTMLInputElement>(null);
  const [displayQty, setDisplayQty] = useState<string>(
    isFixedQuantity ? String(prod.min_quantity) : showQuantityField ? String(checkoutQuantity || prod.min_quantity || 1) : "1"
  );
  const [qtyError, setQtyError] = useState("");

  const minQtyLimit = parseFloat(String(prod.min_quantity)) || 1;
  const maxQtyLimit = prod.max_quantity != null ? parseFloat(String(prod.max_quantity)) : null;

  const validateQuantity = useCallback(
    (val: string) => {
      if (!showQuantityField || isFixedQuantity || isPackaged) { setQtyError(""); return true; }
      const q = parseFloat(val);
      if (isNaN(q) || val.trim() === "") { setQtyError("يرجى إدخال كمية صحيحة"); return false; }
      if (q < minQtyLimit) { setQtyError(`الكمية أقل من الحد الأدنى المسموح (${minQtyLimit})`); return false; }
      if (maxQtyLimit != null && q > maxQtyLimit) { setQtyError(`الكمية أكثر من الحد الأقصى المسموح (${maxQtyLimit})`); return false; }
      setQtyError("");
      return true;
    },
    [showQuantityField, isFixedQuantity, isPackaged, minQtyLimit, maxQtyLimit]
  );

  useEffect(() => { validateQuantity(displayQty); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  useEffect(() => { if (!hasProd) setView({ type: "main" }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [hasProd]);

  /* ---------- حقول الإدخال (افتراضية + مخصصة) ---------- */
  const allFields: FieldDef[] = useMemo(() => {
    try {
      if (!prod.custom_fields) return [];
      const parsed = typeof prod.custom_fields === "string" ? JSON.parse(prod.custom_fields) : prod.custom_fields;
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }, [prod.custom_fields]);

  const defaultFields: FieldDef[] = useMemo(() => {
    const explicit = allFields.filter((f) => f.isDefault);
    if (explicit.length > 0) return explicit;
    if (prod?.input_label && String(prod.input_label).trim().length > 0) {
      return [{ id: "__legacy_default_id__", label: String(prod.input_label).trim(), required: true, isDefault: true }];
    }
    if (prod?.store_type === "quantities" || prod?.store_type === "quick_order") {
      return [{ id: "__legacy_default_id__", label: "ضع المعرف (ID)", required: true, isDefault: true }];
    }
    return [];
  }, [allFields, prod?.input_label, prod?.store_type]);

  const parsedCustomFields = useMemo(() => allFields.filter((f) => !f.isDefault), [allFields]);

  const nvSourceFields: FieldDef[] = useMemo(() => allFields.filter((f) => f.nvSource === true), [allFields]);

  const galleryImages: string[] = useMemo(() => {
    if (!isGallery) return [];
    try {
      const raw = prod.image_urls;
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      return Array.isArray(parsed) ? parsed.filter(Boolean) : prod.image_url ? [prod.image_url] : [];
    } catch { return prod.image_url ? [prod.image_url] : []; }
  }, [isGallery, prod.image_urls, prod.image_url]);

  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [extraInput, setExtraInput] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const orderResult = checkoutOrderResult;
  const setOrderResult = setCheckoutOrderResult;

  /* ---------- حساب السعر ---------- */
  const rawPrice = parseFloat(String(prod.price)) || 0;
  const selectedPackageEntry: PackageDataEntry | null = hasPackagesData
    ? prod.packages_data.find((p: PackageDataEntry) => p.label === selectedPackageLabel) || prod.packages_data[0]
    : null;
  const unitPrice = hasPackagesData
    ? Number(selectedPackageEntry?.price) || 0
    : prod.store_type === "quantities"
    ? rawPrice / Math.max(1, parseFloat(String(prod.price_per_unit)) || 1)
    : rawPrice;

  const parsedQty = hasPackageValues
    ? selectedPackageValue ?? 0
    : isFixedQuantity
    ? parseFloat(String(prod.min_quantity)) || 0
    : parseFloat(displayQty) || 0;

  const safeQty = hasPackagesData
    ? 1
    : hasPackageValues
    ? selectedPackageValue ?? prod.package_values[0]
    : isFixedQuantity
    ? parseFloat(String(prod.min_quantity))
    : Math.max(1, parsedQty || 1);

  const baseTotal = unitPrice * safeQty;
  const vipDiscountPct = quotedPct / 100; // [PHASE-2] من محرك القواعد عبر السيرفر
  const finalPrice = vipDiscountPct > 0 ? baseTotal * (1 - vipDiscountPct) : baseTotal;

  const showBreakdown = safeQty > 1 || isPackaged;

  /* ---------- الإرسال ---------- */
  const handlePurchase = async () => {
    if (!user) return;
    if (loading) return;

    if (showQuantityField && !isFixedQuantity && !isPackaged && !validateQuantity(displayQty)) {
      console.error("[Validation] Quantity out of allowed range, order blocked before submit", { displayQty, minQtyLimit, maxQtyLimit });
      return;
    }

    const extraData = extraInput.trim() || (defaultFields.length > 0 ? (customFieldValues[defaultFields[0].id] || "").trim() : "");

    const quantity = hasPackagesData
      ? 1
      : hasPackageValues
      ? Number(selectedPackageValue || 0)
      : isFixedQuantity
      ? parseFloat(String(prod.min_quantity)) || 0
      : parseFloat(qtyRef.current?.value || displayQty || "0") || 1;

    const needsInput = prod.store_type === "external_api" && !!prod.requires_input && defaultFields.length === 0;
    if (needsInput && !extraData) return setError("يرجى إدخال البيانات المطلوبة");
    if (hasPackagesData && !selectedPackageLabel) return setError("يرجى اختيار باقة صحيحة من القائمة");
    if (hasPackageValues && !prod.package_values.includes(quantity)) return setError("يرجى اختيار قيمة باقة صحيحة");
    if (!isPackaged && !isFixedQuantity && (prod.store_type === "quantities" || prod.store_type === "external_api") && quantity < (prod.min_quantity || 1))
      return setError(`أقل كمية مسموحة هي ${prod.min_quantity || 1}`);
    if (!isPackaged && !isFixedQuantity && prod.max_quantity && quantity > prod.max_quantity)
      return setError(`أكبر كمية مسموحة هي ${prod.max_quantity}`);

    for (const field of defaultFields) {
      if (field.required && !customFieldValues[field.id]?.trim()) return setError(`الحقل "${field.label}" إلزامي`);
    }
    for (const field of parsedCustomFields) {
      if (field.required && !customFieldValues[field.id]?.trim()) return setError(`الحقل "${field.label}" إلزامي`);
    }

    setCheckoutQuantity(quantity);
    setLoading(true);
    try {
      const primaryDefaultValue = defaultFields.length > 0 ? customFieldValues[defaultFields[0].id] || "" : extraData;
      const autoPlayerId = extraData;

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("authToken") || ""}` },
        body: JSON.stringify({
          userId: user.id,
          productId: prod.id,
          quantity,
          extraData: {
            input: prod.store_type === "external_api" ? (prod.requires_input ? extraData : autoPlayerId) : primaryDefaultValue,
            playerId: prod.store_type === "external_api" ? (prod.requires_input ? extraData : autoPlayerId) : primaryDefaultValue,
            storeType: prod.store_type,
            packageLabel: hasPackagesData ? selectedPackageLabel : undefined,
            defaultFields: defaultFields.length > 0 ? defaultFields.map((f) => ({ label: f.label, value: customFieldValues[f.id] || "", required: f.required })) : undefined,
            customFields: parsedCustomFields.length > 0 ? parsedCustomFields.map((f) => ({ label: f.label, value: customFieldValues[f.id] || "", required: f.required })) : undefined,
          },
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchUser(user.id);
        fetchOrders();
        if (data.pendingAdmin) {
          setOrderResult({
            ...data, prod, externalOrderId: null, externalStatus: "pending", replayApi: [],
            note: "تم استلام طلبك بنجاح! سيتم مراجعته والرد عليك قريباً.",
          });
        } else if (prod.store_type === "external_api") {
          setOrderResult({
            ...data, prod,
            externalOrderId: data.externalOrderId || null,
            externalStatus: data.externalStatus || "processing",
            replayApi: Array.isArray(data.replayApi) ? data.replayApi.map(String) : [],
          });
        } else if (prod.store_type === "inventory" && data.inventoryDelivered) {
          setOrderResult({ ...data, prod, externalOrderId: null, externalStatus: "completed", replayApi: [data.inventoryDelivered] });
        } else {
          setOrderResult({ ...data, prod, externalOrderId: null, externalStatus: "completed", replayApi: [] });
        }
      } else {
        setError(data.error || "حدث خطأ ما");
      }
    } catch {
      setError("فشل الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  };

  /* ---------- عرض نتيجة الطلب ---------- */
  if (orderResult) {
    return (
      <OrderResultCard
        orderResult={orderResult as OrderResultData}
        finalPrice={finalPrice}
        fmtPrice={fmtPrice}
        theme={theme}
        ui={ui}
        isModal={isModal}
        goBack={navigateBack}
        onReset={() => setCheckoutOrderResult(null)}
        setView={setView}
        setActiveTab={setActiveTab}
        onStatusUpdate={(newStatus, replayApi) => {
          setOrderResult((prev: any) => ({ ...prev, externalStatus: newStatus, replayApi }));
          fetchOrders();
        }}
      />
    );
  }

  if (!hasProd) return null;

  const showLegacyExternalField = prod.store_type === "external_api" && defaultFields.length === 0 && !!prod.requires_input;
  const legacyLabel = (prod.input_label && String(prod.input_label).trim()) || prod.params?.[0] || "معرف اللاعب (Player ID)";

  const favKey = `prod_${prod.id}`;
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

        {/* ===== صورة المنتج ===== */}
        <div className="flex flex-col items-center text-center">
          {isGallery ? (
            <div className="w-full">
              <ImageGalleryCarousel images={galleryImages} alt={prod.name} />
            </div>
          ) : (
            <div className="w-20 h-20 rounded-xl overflow-hidden">
              <OptimizedImage
                src={prod.image_url || "https://picsum.photos/seed/prod/300/300"}
                width={160} height={160} alt={prod.name}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* ===== الاسم ===== */}
          <h2 className={`font-bold text-xs mt-3 ${ui.text}`}>{prod.name}</h2>

          {/* ===== السعر ===== */}
          <div className="flex items-center justify-center gap-2 flex-wrap mt-1">
            {vipDiscountPct > 0 && <span className={`line-through text-[11px] ${ui.muted}`}>{fmtPrice(unitPrice)}</span>}
            <span className={`font-black text-lg ${theme.text}`}>{fmtPrice(unitPrice * (1 - vipDiscountPct))}</span>
          </div>
          {(vipDiscountPct > 0 || prod.store_type === "external_api" || prod.store_type === "inventory" || isPackaged || prod.store_type === "quantities") && (
            <div className="flex items-center justify-center gap-1.5 flex-wrap mt-2">
              {vipDiscountPct > 0 && (
                <span className="text-[10px] bg-amber-500/15 text-amber-500 px-2.5 py-1 rounded-full font-bold flex items-center gap-1">
                  <Star size={9} fill="currentColor" /> {user?.is_vip ? "VIP" : "خصم"}
                </span>
              )}
              <TypeBadge storeType={prod.store_type} isPackaged={isPackaged} />
            </div>
          )}

          {/* ===== تفصيل السعر (فقط عند أكثر من وحدة أو باقات) ===== */}
          {showBreakdown && (
            <div className={`w-full mt-4 ${ui.breakdownBg} rounded-2xl p-3.5 space-y-1.5 text-sm`}>
              <div className="flex justify-between"><span className={ui.muted}>سعر الوحدة</span><span className={`font-bold ${ui.text}`}>{fmtPrice(unitPrice)}</span></div>
              <div className="flex justify-between"><span className={ui.muted}>{hasPackagesData ? "الباقة" : "الكمية"}</span><span className={`font-bold ${ui.text}`}>{hasPackagesData ? selectedPackageEntry?.label : safeQty}</span></div>
              <div className={`border-t border-dashed ${ui.dividerDashed} my-1`} />
              <div className="flex justify-between"><span className={ui.muted}>المجموع</span><span className={`font-bold ${theme.text}`}>{fmtPrice(baseTotal)}</span></div>
            </div>
          )}

          {vipDiscountPct > 0 && (
            <div className="w-full mt-3 flex items-center justify-between text-xs bg-amber-500/10 border border-amber-500/20 rounded-2xl px-3.5 py-2.5">
              <div className="flex items-center gap-1.5 text-amber-500 font-bold">
                <Star size={12} fill="currentColor" /> خصمك ({+quotedPct.toFixed(2)}%)
              </div>
              <span className="text-amber-500 font-bold">- {fmtPrice(baseTotal * vipDiscountPct)}</span>
            </div>
          )}

          {/* ===== خانات الطلب (باقة/كمية/حقول) — كل خانة أسفل الأخرى ===== */}
          <div className="w-full mt-8 space-y-3">
            {hasPackagesData && (
              <button
                type="button"
                onClick={() => setPackagePickerOpen(true)}
                className={`w-full bg-transparent border ${ui.border} rounded-full px-5 py-3.5 flex items-center justify-between active:scale-[0.99] transition-transform`}
              >
                <span className={`font-bold text-sm ${ui.text}`}>{selectedPackageEntry?.label} <span className={`font-normal ${ui.muted}`}>— {fmtPrice(Number(selectedPackageEntry?.price) || 0)}</span></span>
                <ChevronDown size={18} className={ui.muted} />
              </button>
            )}
            <PickerSheet open={hasPackagesData && packagePickerOpen} title="اختر الباقة" onClose={() => setPackagePickerOpen(false)} ui={ui}>
              {hasPackagesData && prod.packages_data.map((pkg: PackageDataEntry, i: number) => {
                const isSelected = pkg.label === (selectedPackageLabel ?? prod.packages_data[0].label);
                return (
                  <PickerRow key={i} label={pkg.label} price={fmtPrice(Number(pkg.price) || 0)} selected={isSelected} theme={theme} ui={ui}
                    onClick={() => { setSelectedPackageLabel(pkg.label); setPackagePickerOpen(false); }} />
                );
              })}
            </PickerSheet>

            {(prod.store_type === "quantities" || prod.store_type === "external_api" || prod.store_type === "quick_order" || hasPackageValues) && !singleUnitOnly && (
              hasPackageValues ? (
                <button
                  type="button"
                  onClick={() => setPackagePickerOpen(true)}
                  className={`w-full bg-transparent border ${ui.border} rounded-full px-5 py-3.5 flex items-center justify-between active:scale-[0.99] transition-transform`}
                >
                  <span className={`font-bold text-sm ${ui.text}`}>{selectedPackageValue ?? prod.package_values[0]} <span className={`font-normal ${ui.muted}`}>— {fmtPrice(unitPrice * (selectedPackageValue ?? prod.package_values[0]))}</span></span>
                  <ChevronDown size={18} className={ui.muted} />
                </button>
              ) : isFixedQuantity ? null : (
                <div className="space-y-1.5">
                  <input
                    ref={qtyRef}
                    type="number"
                    min={prod.min_quantity || 1}
                    max={prod.max_quantity || undefined}
                    step="any"
                    value={displayQty}
                    onChange={(e) => { setDisplayQty(e.target.value); validateQuantity(e.target.value); }}
                    onBlur={(e) => validateQuantity(e.target.value)}
                    placeholder={`الكمية${prod.min_quantity ? ` (أقل: ${prod.min_quantity})` : ""}${prod.max_quantity ? ` (أكثر: ${prod.max_quantity})` : ""}`}
                    className={`w-full text-center text-sm rounded-full px-5 py-3.5 outline-none transition-colors ${
                      qtyError ? "bg-red-500/10 border border-red-500/60 text-red-400" : `bg-transparent border ${ui.border} ${ui.text} ${ui.borderFocus}`
                    }`}
                  />
                  {qtyError && <p className="text-red-500 text-xs font-medium text-center">{qtyError}</p>}
                </div>
              )
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

            {showLegacyExternalField && (
              <PillInput label={legacyLabel} required value={extraInput} onChange={setExtraInput} ui={ui} />
            )}

            {defaultFields.map((field) => (
              <PillInput
                key={field.id} label={field.label} required={field.required}
                value={customFieldValues[field.id] || ""}
                onChange={(v) => setCustomFieldValues((prev) => ({ ...prev, [field.id]: v }))}
                keyboardTypes={field.keyboard_types}
                ui={ui}
              />
            ))}

            {parsedCustomFields.map((field) => (
              <PillInput
                key={field.id} label={field.label} required={field.required}
                value={customFieldValues[field.id] || ""}
                onChange={(v) => setCustomFieldValues((prev) => ({ ...prev, [field.id]: v }))}
                keyboardTypes={field.keyboard_types}
                ui={ui}
              />
            ))}
          </div>

          {/* ===== التحقق من الاسم — يظهر فقط عند تفعيله لهذا المنتج ===== */}
          {!!prod.id && (
            <div className="w-full mt-3">
              <NameVerificationWidget
                productId={prod.id}
                uid={
                  nvSourceFields.length > 0
                    ? nvSourceFields.map((f) => (customFieldValues[f.id] || "").trim()).filter(Boolean).join(" ")
                    : (extraInput.trim() || (defaultFields.length > 0 ? (customFieldValues[defaultFields[0].id] || "") : ""))
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

          {/* ===== إلغاء / شراء ===== */}
          <div className="w-full flex items-center justify-center gap-3 mt-6">
            <button
              disabled={loading || !!qtyError}
              onClick={handlePurchase}
              className={`${theme.bgLight} ${theme.text} font-bold text-base px-10 py-4 rounded-full disabled:opacity-50 active:scale-95 transition-transform`}
            >
              {loading ? "جاري الشراء..." : "شراء"}
            </button>
            <button
              onClick={navigateBack}
              className="border-2 border-red-400/60 text-red-400 font-bold text-base px-10 py-4 rounded-full active:scale-95 transition-transform"
            >
              إلغاء
            </button>
          </div>

          {/* ===== وصف المنتج — يظهر كاملاً أسفل الشراء والإلغاء ===== */}
          {prod.description && (
            <p className={`text-xs leading-relaxed whitespace-pre-line mt-5 ${ui.muted}`}>{prod.description}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
