/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * CategorySectionsAccordion — "الأسلوب الجديد" لعرض الأقسام:
 * شريط أفقي واحد أسفل البانرات، كل عنصر فيه بوكس به صورة القسم بجانبها اسمه، ثم
 * بعده بوكس القسم التالي... يُفتح القسم الأول تلقائياً، ومحتواه (أقسامه الفرعية
 * ومنتجاته المباشرة) يظهر في لوحة واحدة أسفل الشريط، تتبدّل عند اختيار قسم آخر.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Star, ChevronLeft } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Category, Subcategory, SubSubCategory, Product, StoreAppearance, UserData } from "../types";
import OptimizedImage from "./OptimizedImage";
import { gridColsClass, ratioToClass, itemCardChrome, DEFAULT_APPEARANCE } from "../utils/useStoreAppearance";

// ── [RTL SCROLL] المتصفحات تختلف في معنى scrollLeft داخل حاوية dir="rtl" (ثلاث سلوكيات
// معروفة: default/negative/reverse) — نكتشف السلوك الفعلي مرة واحدة بعنصر اختبار خفي،
// لنحدّد بدقة متى وصل الشريط لبدايته/نهايته وبأي اتجاه نُحرّكه، بدل الاعتماد على علامة
// scrollLeft الخام التي تختلف معناها بين Chrome/Firefox/Safari.
type RtlScrollType = "default" | "negative" | "reverse";
let cachedRtlScrollType: RtlScrollType | null = null;
function detectRtlScrollType(): RtlScrollType {
  if (cachedRtlScrollType) return cachedRtlScrollType;
  if (typeof document === "undefined") return "reverse";
  const el = document.createElement("div");
  el.style.cssText = "position:absolute;visibility:hidden;top:-9999px;width:2px;height:2px;overflow:scroll;direction:rtl;";
  el.innerHTML = `<div style="width:4px;height:1px"></div>`;
  document.body.appendChild(el);
  let type: RtlScrollType;
  if (el.scrollLeft > 0) {
    type = "default";
  } else {
    el.scrollLeft = 1;
    type = el.scrollLeft === 0 ? "negative" : "reverse";
  }
  document.body.removeChild(el);
  cachedRtlScrollType = type;
  return type;
}
/** هل يوجد أقسام تالية (يسار الشريط) لم تُشاهَد بعد؟ */
function canScrollToMoreCategories(el: HTMLDivElement): boolean {
  const max = el.scrollWidth - el.clientWidth;
  const EPS = 2;
  if (max <= EPS) return false;
  const type = detectRtlScrollType();
  const sl = el.scrollLeft;
  if (type === "default") return sl > EPS;
  if (type === "negative") return sl > -max + EPS;
  return sl < max - EPS; // reverse
}
/** يحرّك الشريط نحو "المزيد" (الأقسام التالية) بمقدار amount بكسل، بسلاسة. */
function scrollStripToMore(el: HTMLDivElement, amount: number) {
  const max = el.scrollWidth - el.clientWidth;
  const type = detectRtlScrollType();
  let min: number, cap: number, sign: number;
  if (type === "default") { min = 0; cap = max; sign = -1; }
  else if (type === "negative") { min = -max; cap = 0; sign = -1; }
  else { min = 0; cap = max; sign = 1; }
  const target = Math.min(cap, Math.max(min, el.scrollLeft + sign * amount));
  el.scrollTo({ left: target, behavior: "smooth" });
}

export interface CategorySectionsAccordionProps {
  categories: Category[];
  categoriesLoading?: boolean;
  subcategories?: Subcategory[];
  appearance?: StoreAppearance;
  theme?: any;
  navigateTo: (newView: any) => void;
  setPageLoading: (val: boolean) => void;
  fetchSubSubCategories: (subId?: number) => Promise<SubSubCategory[]>;
  fetchProducts: (subId: number, isSubSub?: boolean, fromCategory?: boolean) => Promise<void>;
  isFavorite: (favKey: string) => boolean;
  useLongPressHandlers: (item: any, e: React.TouchEvent | React.MouseEvent) => void;
  user: UserData | null;
  fmtPrice: (usd: number, decimals?: number) => string;
  setCheckoutQuantity: (val: number) => void;
}

type MixedItem =
  | { __kind: "product"; data: Product }
  | { __kind: "subcategory"; data: Subcategory };

interface CatContent { loading: boolean; items: MixedItem[]; loaded: boolean; }

export default function CategorySectionsAccordion(props: CategorySectionsAccordionProps) {
  const {
    categories,
    categoriesLoading = false,
    subcategories = [],
    appearance = DEFAULT_APPEARANCE,
    theme = {},
    navigateTo,
    setPageLoading,
    fetchSubSubCategories,
    fetchProducts,
    isFavorite,
    useLongPressHandlers,
    user,
    fmtPrice,
    setCheckoutQuantity,
  } = props;

  const subGridCls = gridColsClass(appearance.sub_columns_mobile, appearance.sub_columns_desktop);
  const subRatioCls = ratioToClass(appearance.sub_image_ratio);

  const [activeId, setActiveId] = useState<number | null>(null);
  const [content, setContent] = useState<Record<number, CatContent>>({});

  // [SKELETON] عدد عناصر الهيكل الوهمي أثناء التحميل يطابق العدد الحقيقي للأقسام الفرعية التابعة
  // للقسم النشِط (مصدرها القائمة الكاملة المُحمَّلة مسبقاً على مستوى الصفحة) بدل رقم ثابت تخميني —
  // يبقى الرقم الثابت احتياطاً فقط حين لا نعرف العدد الحقيقي بعد (لم تُحمَّل القائمة، أو القسم
  // النشِط غير محدد بعد).
  const FALLBACK_SKELETON_COUNT = 6;
  const activeSubCount = activeId != null ? subcategories.filter(s => s.category_id === activeId).length : 0;
  const skeletonCount = activeSubCount > 0 ? activeSubCount : FALLBACK_SKELETON_COUNT;
  const skeletonKeys = Array.from({ length: skeletonCount }, (_, i) => i);

  // [DESKTOP] overflow-x-auto لا يوفّر أي وسيلة تحريك بالماوس (لا سحب ولا عجلة أفقية) —
  // نضيف السحب بالماوس (كما في شريط البانرات) وتحويل عجلة الماوس العمودية إلى تمرير أفقي،
  // لتبقى اللمسة على الموبايل كما هي دون أي تغيير.
  const stripRef = useRef<HTMLDivElement | null>(null);
  const dragState = useRef({ dragging: false, moved: false, startX: 0, startScrollLeft: 0 });

  const handleStripWheel = (e: React.WheelEvent) => {
    const el = stripRef.current;
    if (!el) return;
    const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (delta === 0) return;
    e.preventDefault();
    el.scrollLeft += delta;
  };

  const handleStripMouseDown = (e: React.MouseEvent) => {
    const el = stripRef.current;
    if (!el) return;
    dragState.current = { dragging: true, moved: false, startX: e.clientX, startScrollLeft: el.scrollLeft };
  };
  const handleStripMouseMove = (e: React.MouseEvent) => {
    const el = stripRef.current;
    const st = dragState.current;
    if (!el || !st.dragging) return;
    const dx = e.clientX - st.startX;
    if (Math.abs(dx) > 4) st.moved = true;
    el.scrollLeft = st.startScrollLeft - dx;
  };
  const endStripDrag = () => { dragState.current.dragging = false; };
  // نمنع نقرة القسم من تنفَّذ إن كان المستخدم قد سحب الشريط (لا نفتح قسماً عن طريق الخطأ)
  const handleStripClickCapture = (e: React.MouseEvent) => {
    if (dragState.current.moved) { e.preventDefault(); e.stopPropagation(); dragState.current.moved = false; }
  };

  // ── سهم "يوجد أقسام تالية" — يظهر فقط عند وجود محتوى متبقٍّ ويختفي تلقائياً عند النهاية.
  const [canGoMore, setCanGoMore] = useState(false);
  const updateStripArrow = useCallback(() => {
    const el = stripRef.current;
    if (!el) return;
    setCanGoMore(canScrollToMoreCategories(el));
  }, []);
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    updateStripArrow();
    el.addEventListener("scroll", updateStripArrow, { passive: true });
    const ro = new ResizeObserver(updateStripArrow);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", updateStripArrow); ro.disconnect(); };
  }, [categories, updateStripArrow]);
  const clickStripArrow = () => {
    const el = stripRef.current;
    if (!el) return;
    scrollStripToMore(el, 220);
  };

  // القسم الأول مفتوح دائماً تلقائياً عند توفّر الأقسام
  useEffect(() => {
    if (activeId == null && categories.length > 0) setActiveId(categories[0].id);
  }, [categories]);

  // جلب محتوى القسم النشِط (كسولاً، مرة واحدة لكل قسم)
  useEffect(() => {
    if (activeId == null) return;
    const cur = content[activeId];
    if (cur && (cur.loaded || cur.loading)) return;
    let alive = true;
    const catId = activeId;
    setContent(prev => ({ ...prev, [catId]: { loading: true, items: prev[catId]?.items || [], loaded: false } }));
    (async () => {
      try {
        const [subs, prods] = await Promise.all([
          fetch(`/api/categories/${catId}/subcategories`).then(r => (r.ok ? r.json() : [])).catch(() => []),
          fetch(`/api/categories/${catId}/products`).then(r => (r.ok ? r.json() : [])).catch(() => []),
        ]);
        if (!alive) return;
        const items: MixedItem[] = [
          ...(Array.isArray(prods) ? prods : []).map((p: Product) => ({ __kind: "product" as const, data: p })),
          ...(Array.isArray(subs) ? subs : []).map((s: Subcategory) => ({ __kind: "subcategory" as const, data: s })),
        ].sort((x, y) => {
          const ox = Number((x.data as any)?.order_index) || 0;
          const oy = Number((y.data as any)?.order_index) || 0;
          if (ox !== oy) return ox - oy;
          return (Number(x.data.id) || 0) - (Number(y.data.id) || 0);
        });
        setContent(prev => ({ ...prev, [catId]: { loading: false, items, loaded: true } }));
      } catch {
        if (!alive) return;
        setContent(prev => ({ ...prev, [catId]: { loading: false, items: [], loaded: true } }));
      }
    })();
    return () => { alive = false; };
  }, [activeId]);

  const openSubcategory = async (sub: Subcategory, catId: number) => {
    setPageLoading(true);
    try {
      const subSubs = await fetchSubSubCategories(sub.id);
      await fetchProducts(sub.id);
      if (subSubs.length > 0) {
        navigateTo({ type: "sub_sub_categories", id: sub.id, data: sub.name, catId });
      } else {
        navigateTo({ type: "products", id: sub.id, data: sub.name, fromSubSub: false, catId });
      }
    } finally {
      setPageLoading(false);
    }
  };

  const openProduct = (prod: Product) => {
    if ((prod as any).available === false) return;
    if (!user) return navigateTo({ type: "login" });
    if ((prod as any).store_type === "quick_order") {
      navigateTo({ type: "quick_order", data: prod, fromCategory: true });
    } else {
      setCheckoutQuantity(
        (Array.isArray((prod as any).package_values) && (prod as any).package_values.length > 0)
          ? (prod as any).package_values[0]
          : (parseFloat(String((prod as any).min_quantity)) || 0)
      );
      navigateTo({ type: "checkout", data: prod, fromCategory: true });
    }
  };

  if (categoriesLoading) {
    return (
      <div className="space-y-3">
        <div className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-4 px-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="shrink-0 flex items-center gap-2 bg-gray-100 rounded-full p-1.5 pl-4 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-gray-200 shrink-0" />
              <div className="h-3 w-16 bg-gray-200 rounded-full" />
            </div>
          ))}
        </div>
        <div className={`grid ${subGridCls} gap-3`}>
          {skeletonKeys.map(i => (
            <div key={i} className="bg-gray-100 rounded-lg overflow-hidden animate-pulse">
              <div className={`w-full ${subRatioCls} bg-gray-200`} />
              <div className="h-3 bg-gray-200 mx-2 my-2 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-10">
        <img
          src="https://i.ibb.co/dw8dLTgw/1000030062-removebg-preview.png"
          alt="لا توجد أقسام"
          className="w-48 h-48 object-contain"
          loading="lazy" decoding="async" referrerPolicy="no-referrer"
          draggable={false} onDragStart={e => e.preventDefault()} onContextMenu={e => e.preventDefault()}
        />
        <p className="text-gray-400 text-sm mt-2">لا توجد أقسام حالياً</p>
      </div>
    );
  }

  const c = activeId != null ? content[activeId] : undefined;

  return (
    <div className="space-y-3.5">
      {/* الشريط الأفقي: بوكس صورة+اسم لكل قسم، جنباً إلى جنب — قابل للسحب بالماوس وعجلة التمرير */}
      <div className="relative">
      <div
        ref={stripRef}
        onWheel={handleStripWheel}
        onMouseDown={handleStripMouseDown}
        onMouseMove={handleStripMouseMove}
        onMouseUp={endStripDrag}
        onMouseLeave={endStripDrag}
        onClickCapture={handleStripClickCapture}
        className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-4 px-4 cursor-grab active:cursor-grabbing select-none"
      >
        {categories.map(cat => {
          const isActive = activeId === cat.id;
          const favKey = `cat_${cat.id}`;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveId(cat.id)}
              /* [FIX] الأسلوب الجديد فقط: الضغط المطوّل كان لا يعمل بشكل موثوق (يتداخل مع سحب
                 الشريط بالماوس) — استُبدل بكليك يمين (قائمة السياق) لإظهار خياري
                 المفضلة/المشاركة، بدل تعطيله بالكامل كما كان. */
              onContextMenu={e => { e.preventDefault(); useLongPressHandlers({ ...cat, _fav_key: favKey, _fav_type: "category", _fav_label: cat.name, _fav_image: cat.image_url }, e); }}
              className={`shrink-0 flex items-center gap-2 rounded-full border p-1 pl-3.5 transition-all ${
                // [FIX] theme.bgLight/border هنا نظام ألوان شخصي للمستخدم (VIP/لون مخصص) ويتحوّل
                // لأحمر ثابت (bg-red-50) للمستخدم العادي — لا علاقة له بلون المتجر ولا يتكيّف مع
                // الوضع الليلي. نستخدم بدلاً منه لون المتجر الفعلي (bg-brand-light/border-brand-soft)
                // الذي يُعاد حسابه تلقائياً لكل من الوضعين عبر applyThemeToDocument.
                isActive
                  ? "bg-brand-light border-brand-soft shadow-sm"
                  : "bg-white border-gray-100"
              }`}
            >
              <span className="relative w-9 h-9 rounded-full overflow-hidden bg-gray-50 shrink-0">
                <OptimizedImage
                  src={cat.image_url}
                  width={72}
                  height={72}
                  alt={cat.name}
                  className="w-full h-full object-cover"
                  draggable={false}
                  onDragStart={e => e.preventDefault()}
                />
                {isFavorite(favKey) && (
                  <span className="absolute -top-0.5 -right-0.5 text-yellow-400 bg-white rounded-full"><Star size={10} /></span>
                )}
              </span>
              <span className={`font-bold text-[13px] whitespace-nowrap ${isActive ? "text-brand" : "text-gray-700"}`}>
                {cat.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* سهم صغير يشير فقط لوجود أقسام تالية — خلفه دائرة شبه شفافة بلون معكوس
          (أسود شبه شفاف بالنهاري، أبيض شبه شفاف بالليلي) والسهم بالعكس تماماً
          (أبيض بالنهاري، أسود بالليلي) ليبرز فوق الدائرة في كل الحالات. */}
      <AnimatePresence>
        {canGoMore && (
          <motion.button
            type="button"
            onClick={clickStripArrow}
            aria-label="المزيد من الأقسام"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="absolute left-0.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/20 dark:bg-white/20 flex items-center justify-center"
          >
            <ChevronLeft size={13} className="text-white dark:text-black" />
          </motion.button>
        )}
      </AnimatePresence>
      </div>

      {/* لوحة محتوى القسم النشِط: أقسامه الفرعية ومنتجاته المباشرة */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeId ?? "none"}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          {(!c || c.loading) ? (
            <div className={`grid ${subGridCls} gap-3`}>
              {skeletonKeys.map(i => (
                <div key={i} className="bg-gray-100 rounded-lg overflow-hidden animate-pulse">
                  <div className={`w-full ${subRatioCls} bg-gray-200`} />
                  <div className="h-3 bg-gray-200 mx-2 my-2 rounded-full" />
                </div>
              ))}
            </div>
          ) : c.items.length === 0 ? (
            <p className="text-center text-gray-400 text-xs py-10">لا يوجد محتوى في هذا القسم بعد</p>
          ) : (
            <div className={`grid ${subGridCls} gap-3`}>
              {c.items.map(entry => {
                if (entry.__kind === "product") {
                  const prod = entry.data;
                  return (
                    <motion.div
                      whileTap={(prod as any).available === false ? undefined : { scale: 0.95 }}
                      key={`prod_${prod.id}`}
                      onClick={() => openProduct(prod)}
                      className={`${itemCardChrome(appearance, "bg-white rounded-lg border border-gray-100 shadow-sm")} flex flex-col items-center overflow-hidden transition-all ${
                        (prod as any).available === false ? "opacity-60 grayscale cursor-not-allowed" : `${itemCardChrome(appearance, "hover:shadow-md")} cursor-pointer active:scale-95`
                      }`}
                    >
                      <div className={`w-full ${subRatioCls} overflow-hidden rounded-lg bg-gray-50 relative`}>
                        <OptimizedImage
                          src={prod.image_url || ""}
                          width={240} height={240} alt={prod.name}
                          className="w-full h-full object-cover"
                          draggable={false} onDragStart={e => e.preventDefault()} onContextMenu={e => e.preventDefault()}
                        />
                        {(prod as any).available === false && (
                          <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                            <span className="bg-gray-800/80 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">غير متوفر</span>
                          </div>
                        )}
                      </div>
                      <div className="w-full px-1 py-1.5">
                        <p className="font-bold text-gray-700 text-[9px] text-center leading-tight truncate text-prod-name">{prod.name}</p>
                        <p className={`${(prod as any).available === false ? "text-gray-400" : (theme.text || "text-[var(--brand)]")} text-[9px] text-center font-bold`}>
                          {fmtPrice(parseFloat(String((prod as any).price || 0)))}
                        </p>
                      </div>
                    </motion.div>
                  );
                }
                const sub = entry.data;
                const favKey = `sub_${sub.id}`;
                return (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    key={`sub_${sub.id}`}
                    onClick={() => openSubcategory(sub, activeId as number)}
                    /* [FIX] الأسلوب الجديد فقط: كليك يمين بدل الضغط المطوّل — انظر نفس الملاحظة
                       أعلى شريط الأقسام الرئيسية. */
                    onContextMenu={e => { e.preventDefault(); useLongPressHandlers({ ...sub, _fav_key: favKey, _fav_type: "subcategory", _fav_label: sub.name, _fav_image: sub.image_url, category_id: activeId }, e); }}
                    className={`${itemCardChrome(appearance, `bg-white rounded-lg border ${isFavorite(favKey) ? "border-yellow-400" : "border-gray-100"} shadow-sm`)} flex flex-col items-center overflow-hidden active:scale-95 transition-transform relative`}
                  >
                    {isFavorite(favKey) && <span className="absolute top-1 right-1 text-yellow-400 z-10"><Star size={12} /></span>}
                    <div className={`w-full ${subRatioCls} overflow-hidden rounded-lg bg-gray-50`}>
                      <OptimizedImage
                        src={sub.image_url || "https://picsum.photos/seed/sub/100/100"}
                        width={240} height={240} alt={sub.name}
                        className="w-full h-full object-cover"
                        draggable={false} onDragStart={e => e.preventDefault()} onContextMenu={e => e.preventDefault()}
                      />
                    </div>
                    <span className="font-bold text-gray-700 text-[9px] text-center w-full px-1 py-1.5 leading-tight text-sub-name">{sub.name}</span>
                  </motion.button>
                );
              })}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
