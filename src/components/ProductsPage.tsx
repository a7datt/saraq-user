import React from "react";
import { ArrowRight, ShoppingBag, Star } from "lucide-react";
import { motion } from "motion/react";
import { Product, StoreAppearance } from "../types";
import OptimizedImage from "../components/OptimizedImage";
import { ratioToClass, gridColsClass, DEFAULT_APPEARANCE, useIsMobileViewport } from "../utils/useStoreAppearance";

export interface ProductsPageProps {
  navigateBack: () => void;
  navigateTo: (newView: any) => void;
  view: { type: string; id?: number; data?: any; catId?: number; fromSubSub?: boolean; fromCategory?: boolean; subId?: number; subName?: string; fromFav?: boolean };
  products: Product[];
  pageLoading: boolean;
  isFavorite: (favKey: string) => boolean;
  useLongPressHandlers: (item: any, e: React.TouchEvent | React.MouseEvent) => void;
  theme: any;
  fmtPrice: (usd: number, decimals?: number) => string;
  user: any;
  setView: (val: any) => void;
  setCheckoutQuantity: (val: number) => void;
  appearance?: StoreAppearance;
  siteSettings?: any[];
}

// [FIX] سعر VIP بعد الخصم — نفس صيغة الحساب المستخدمة في صفحة الدفع تماماً:
// السعر بعد الخصم = السعر الأصلي × (1 - نسبة الخصم ÷ 100). إن لم يكن المستخدم VIP يُعاد السعر الأصلي دون أي تعديل.
function getVipPrice(price: number, user: any, siteSettings?: any[]): { finalPrice: number; isVip: boolean; pct: number } {
  const isVip = !!user?.is_vip;
  if (!isVip) return { finalPrice: price, isVip: false, pct: 0 };
  const pct = parseFloat(siteSettings?.find((s: any) => s.key === "vip_discount")?.value || "5") || 0;
  const finalPrice = price * (1 - pct / 100);
  return { finalPrice, isVip: true, pct };
}

export default function ProductsPage(props: ProductsPageProps) {
  const {
    navigateBack,
    navigateTo,
    view,
    products,
    pageLoading,
    isFavorite,
    useLongPressHandlers,
    theme,
    fmtPrice,
    user,
    setView,
    setCheckoutQuantity,
    appearance = DEFAULT_APPEARANCE,
    siteSettings,
  } = props;

  const prodRatioCls = ratioToClass(appearance.prod_image_ratio);
  const isMobileViewport = useIsMobileViewport();
  // إذا كان عدد الأعمدة المختار للشاشة الحالية (جوال أو كمبيوتر) أكثر من 1، نستخدم تخطيط شبكي مربّع
  // (صورة + وصف مختصر + زر شراء تحتها) بدل الصف الأفقي الافتراضي.
  const activeColumns = isMobileViewport ? (appearance.prod_columns_mobile || 1) : (appearance.prod_columns_desktop || 1);
  const useGridLayout = activeColumns > 1;
  const prodGridCls = gridColsClass(appearance.prod_columns_mobile, appearance.prod_columns_desktop);

  return (
    <div className="px-4 space-y-4 pb-20">
      <div className="flex items-center gap-2 mb-6">
        <button onClick={navigateBack} className="p-2 bg-gray-100 rounded-full">
          <ArrowRight size={20} className="text-gray-600" />
        </button>
        <h2 className="text-xl font-bold text-gray-800">{view.data}</h2>
      </div>
      {products.length === 0 && pageLoading ? (
        useGridLayout ? (
          <div className={`grid ${prodGridCls} gap-3`}>
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="bg-white rounded-xl overflow-hidden animate-pulse shadow-sm">
                <div className={`w-full ${prodRatioCls} bg-gray-200`} />
                <div className="p-2 space-y-1.5">
                  <div className="h-3 bg-gray-200 rounded-full w-3/4" />
                  <div className="h-3 bg-gray-100 rounded-full w-1/2" />
                  <div className="h-7 bg-gray-200 rounded-lg w-full mt-1" />
                </div>
              </div>
            ))}
          </div>
        ) : (
        <div className="grid grid-cols-1 gap-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="bg-white rounded-lg p-4 flex gap-4 animate-pulse shadow-sm">
              <div className="w-20 h-20 bg-gray-200 rounded-lg flex-shrink-0" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-4 bg-gray-200 rounded-full w-3/4" />
                <div className="h-3 bg-gray-100 rounded-full w-1/2" />
                <div className="h-3 bg-gray-100 rounded-full w-2/3" />
                <div className="h-8 bg-gray-200 rounded-lg w-1/3 mt-2" />
              </div>
            </div>
          ))}
        </div>
        )
      ) : products.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-gray-200">
            <ShoppingBag size={40} />
          </div>
          <div>
            <p className="font-bold text-gray-500 text-lg">لم تتم إضافة منتجات بعد</p>
            <p className="text-gray-400 text-sm mt-1">عُد لاحقاً، سيتم إضافة منتجات قريباً</p>
          </div>
        </div>
      ) : useGridLayout ? (
        <div className={`grid ${prodGridCls} gap-3`}>
          {products.map((prod, idx) => {
            const isUnavailable = (prod as any).available === false;
            const isApi = prod.store_type === 'external_api';
            const isQuantity = prod.store_type === 'quantities';
            const isQuick = prod.store_type === 'quick_order';
            let lpTimerGrid: any = null;
            return (
              <motion.div
                key={prod.id}
                initial={{ opacity: 0, y: 14, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.25, delay: Math.min(idx * 0.04, 0.3), ease: "easeOut" }}
                whileTap={{ scale: 0.97 }}
                className={`bg-white rounded-xl border shadow-sm overflow-hidden flex flex-col transition-all relative ${isUnavailable ? "border-gray-200 grayscale select-none" : "cursor-pointer"} ${isUnavailable ? "" : isFavorite(`prod_${prod.id}`) ? "border-yellow-400" : "border-gray-100"}`}
                onContextMenu={e => e.preventDefault()}
                onClick={() => {
                  if (isUnavailable) return;
                  if (!user) return navigateTo({ type: "login" });
                  if (isQuick) {
                    navigateTo({ type: "quick_order", data: prod });
                  } else {
                    setCheckoutQuantity((Array.isArray((prod as any).package_values) && (prod as any).package_values.length > 0) ? (prod as any).package_values[0] : (parseFloat(String(prod.min_quantity)) || 0));
                    navigateTo({ type: "checkout", data: prod });
                  }
                }}
                onTouchStart={e => { if (isUnavailable) return; lpTimerGrid = setTimeout(() => useLongPressHandlers({ ...prod, _fav_key: `prod_${prod.id}`, _fav_type: "product", _fav_label: prod.name, _fav_image: prod.image_url, _view_id: view.id, _view_data: view.data, _view_fromSubSub: view.fromSubSub, _view_catId: view.catId, _view_subId: view.subId, _view_subName: view.subName }, e), 600); }}
                onTouchEnd={() => clearTimeout(lpTimerGrid)}
                onTouchMove={() => clearTimeout(lpTimerGrid)}
                onMouseDown={e => { if (isUnavailable) return; lpTimerGrid = setTimeout(() => useLongPressHandlers({ ...prod, _fav_key: `prod_${prod.id}`, _fav_type: "product", _fav_label: prod.name, _fav_image: prod.image_url, _view_id: view.id, _view_data: view.data, _view_fromSubSub: view.fromSubSub, _view_catId: view.catId, _view_subId: view.subId, _view_subName: view.subName }, e), 600); }}
                onMouseUp={() => clearTimeout(lpTimerGrid)}
                onMouseLeave={() => clearTimeout(lpTimerGrid)}
              >
                <div className={`relative w-full ${prodRatioCls} bg-gray-50 overflow-hidden ${isUnavailable ? "pointer-events-none" : ""}`}>
                  <OptimizedImage
                    src={prod.image_url || "https://picsum.photos/seed/prod/300/300"}
                    width={300}
                    height={300}
                    alt={prod.name}
                    className="h-full w-full object-cover"
                  />
                  {isFavorite(`prod_${prod.id}`) && (
                    <span className="absolute top-2 left-2 text-yellow-400 text-sm drop-shadow"><Star size={13} /></span>
                  )}
                  {isUnavailable && (
                    <div className="absolute inset-0 bg-black/35 flex items-center justify-center z-10">
                      <span className="bg-white/95 text-gray-700 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm border border-gray-200">غير متوفر</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col flex-1 px-2.5 py-2 gap-0.5">
                  <h4 className="font-bold text-gray-800 text-xs truncate text-prod-name">{prod.name}</h4>
                  {prod.description && (
                    <p className="text-gray-400 text-[10px] leading-snug line-clamp-2">{prod.description}</p>
                  )}
                  {(() => {
                    const unitBase = isQuantity ? (Number(prod.price) || 0) / Math.max(1, parseFloat(String((prod as any).min_quantity)) || 1) : (Number(prod.price) || 0);
                    const { finalPrice, isVip } = getVipPrice(unitBase, user, siteSettings);
                    const suffix = isQuantity ? " / وحدة" : "";
                    if (isVip) {
                      return (
                        <p className={`font-bold text-xs mt-0.5 flex items-center gap-1 flex-wrap`}>
                          <span className="text-amber-500">{fmtPrice(finalPrice, isQuantity ? 6 : undefined)}{suffix}</span>
                          <span className="text-gray-400 text-[10px] line-through font-normal">{fmtPrice(unitBase, isQuantity ? 6 : undefined)}</span>
                        </p>
                      );
                    }
                    return (
                      <p className={`${isUnavailable ? "text-gray-400" : theme.text} font-bold text-xs mt-0.5`}>
                        {fmtPrice(unitBase, isQuantity ? 6 : undefined)}{suffix}
                      </p>
                    );
                  })()}
                  {Array.isArray((prod as any).package_values) && (prod as any).package_values.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-0.5">
                      {(prod as any).package_values.slice(0, 4).map((val: number) => (
                        <span key={val} className="text-[9px] font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{val}</span>
                      ))}
                      {(prod as any).package_values.length > 4 && (
                        <span className="text-[9px] font-bold text-gray-400">+{(prod as any).package_values.length - 4}</span>
                      )}
                    </div>
                  )}
                  <button
                    disabled={isUnavailable}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isUnavailable) return;
                      if (!user) return navigateTo({ type: "login" });
                      if (isQuick) {
                        navigateTo({ type: "quick_order", data: prod });
                      } else {
                        setCheckoutQuantity((Array.isArray((prod as any).package_values) && (prod as any).package_values.length > 0) ? (prod as any).package_values[0] : (parseFloat(String(prod.min_quantity)) || 0));
                        navigateTo({ type: "checkout", data: prod });
                      }
                    }}
                    className={`w-full mt-1.5 px-2 py-1.5 rounded-lg font-bold text-[11px] leading-none whitespace-nowrap overflow-visible transition-all active:scale-95 ${isUnavailable ? "bg-gray-100 text-gray-400 cursor-not-allowed" : `${theme.button} text-white ${theme.buttonHover}`}`}
                  >
                    {isUnavailable ? "—" : isQuick ? "طلب" : "شراء الآن"}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {products.map((prod, idx) => {
            const isUnavailable = (prod as any).available === false;
            const isApi = prod.store_type === 'external_api';
            const isQuantity = prod.store_type === 'quantities';
            const isQuick = prod.store_type === 'quick_order';
            let lpTimerProd: any = null;
            return (
            <motion.div
              key={prod.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(idx * 0.04, 0.3), ease: "easeOut" }}
              whileTap={{ scale: 0.98 }}
              className={`bg-white rounded-lg border shadow-sm overflow-hidden transition-all relative ${isUnavailable ? "border-gray-200 grayscale select-none" : "cursor-pointer"} ${isUnavailable ? "" : isFavorite(`prod_${prod.id}`) ? "border-yellow-400" : "border-gray-100"}`}
              onContextMenu={e => e.preventDefault()}
              onClick={() => {
                if (isUnavailable) return;
                if (!user) return navigateTo({ type: "login" });
                if (isQuick) {
                  navigateTo({ type: "quick_order", data: prod });
                } else {
                  setCheckoutQuantity((Array.isArray((prod as any).package_values) && (prod as any).package_values.length > 0) ? (prod as any).package_values[0] : (parseFloat(String(prod.min_quantity)) || 0));
                  navigateTo({ type: "checkout", data: prod });
                }
              }}
              onTouchStart={e => { if (isUnavailable) return; lpTimerProd = setTimeout(() => useLongPressHandlers({ ...prod, _fav_key: `prod_${prod.id}`, _fav_type: "product", _fav_label: prod.name, _fav_image: prod.image_url, _view_id: view.id, _view_data: view.data, _view_fromSubSub: view.fromSubSub, _view_catId: view.catId, _view_subId: view.subId, _view_subName: view.subName }, e), 600); }}
              onTouchEnd={() => clearTimeout(lpTimerProd)}
              onTouchMove={() => clearTimeout(lpTimerProd)}
              onMouseDown={e => { if (isUnavailable) return; lpTimerProd = setTimeout(() => useLongPressHandlers({ ...prod, _fav_key: `prod_${prod.id}`, _fav_type: "product", _fav_label: prod.name, _fav_image: prod.image_url, _view_id: view.id, _view_data: view.data, _view_fromSubSub: view.fromSubSub, _view_catId: view.catId, _view_subId: view.subId, _view_subName: view.subName }, e), 600); }}
              onMouseUp={() => clearTimeout(lpTimerProd)}
              onMouseLeave={() => clearTimeout(lpTimerProd)}
            >
              <div className={`flex ${isUnavailable ? "pointer-events-none" : ""}`} dir="rtl">
                {/* Right: Product Image 1:1 */}
                <div className="relative shrink-0 w-28 aspect-square">
                  <OptimizedImage
                    src={prod.image_url || "https://picsum.photos/seed/prod/300/300"}
                    width={300}
                    height={300}
                    alt={prod.name}
                    className="h-full w-full object-cover"
                  />
                  {/* Favorite star */}
                  {isFavorite(`prod_${prod.id}`) && (
                    <span className="absolute top-2 left-2 text-yellow-400 text-sm drop-shadow"><Star size={14} /></span>
                  )}
                </div>

                {/* Middle: Name, Description, Price — close to image */}
                <div className="flex flex-col justify-center px-3 py-2 min-w-0 overflow-hidden items-start flex-1">
                  <h4 className="font-bold text-gray-800 text-sm truncate w-full text-prod-name">{prod.name}</h4>
                  {prod.description && (
                    <p className="text-gray-400 text-[11px] leading-snug mt-0.5 line-clamp-2">{prod.description}</p>
                  )}
                  {(() => {
                    const unitBase = isQuantity ? (Number(prod.price) || 0) / Math.max(1, parseFloat(String((prod as any).min_quantity)) || 1) : (Number(prod.price) || 0);
                    const { finalPrice, isVip } = getVipPrice(unitBase, user, siteSettings);
                    const suffix = isQuantity ? " / وحدة" : "";
                    if (isVip) {
                      return (
                        <p className="font-bold text-sm mt-1 flex items-center gap-1.5 flex-wrap">
                          <span className="text-amber-500">{fmtPrice(finalPrice, isQuantity ? 6 : undefined)}{suffix}</span>
                          <span className="text-gray-400 text-[11px] line-through font-normal">{fmtPrice(unitBase, isQuantity ? 6 : undefined)}</span>
                        </p>
                      );
                    }
                    return (
                      <p className={`${isUnavailable ? "text-gray-400" : theme.text} font-bold text-sm mt-1`}>
                        {fmtPrice(unitBase, isQuantity ? 6 : undefined)}{suffix}
                      </p>
                    );
                  })()}
                  {Array.isArray((prod as any).package_values) && (prod as any).package_values.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(prod as any).package_values.slice(0, 4).map((val: number) => (
                        <span key={val} className="text-[9px] font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{val}</span>
                      ))}
                      {(prod as any).package_values.length > 4 && (
                        <span className="text-[9px] font-bold text-gray-400">+{(prod as any).package_values.length - 4}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Left: Buy Button */}
                <div className="flex flex-col items-center justify-center px-3 shrink-0 min-w-[92px]">
                  <button
                    disabled={isUnavailable}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (isUnavailable) return;
                      if (!user) return navigateTo({ type: "login" });
                      if (isQuick) {
                        navigateTo({ type: "quick_order", data: prod });
                      } else {
                        setCheckoutQuantity((Array.isArray((prod as any).package_values) && (prod as any).package_values.length > 0) ? (prod as any).package_values[0] : (parseFloat(String(prod.min_quantity)) || 0));
                        navigateTo({ type: "checkout", data: prod });
                      }
                    }}
                    className={`px-4 py-2 rounded-lg font-bold text-sm leading-none transition-all active:scale-95 whitespace-nowrap overflow-visible ${isUnavailable ? "bg-gray-100 text-gray-400 cursor-not-allowed" : `${theme.button} text-white ${theme.buttonHover}`}`}
                  >
                    {isUnavailable ? "—" : isQuick ? "طلب" : "شراء الآن"}
                  </button>
                </div>
              </div>

              {/* Unavailable overlay */}
              {isUnavailable && (
                <div className="absolute inset-0 bg-black/35 flex items-center justify-center pointer-events-none z-10">
                  <span className="bg-white/95 text-gray-700 text-xs font-bold px-3 py-1 rounded-full shadow-sm border border-gray-200">غير متوفر</span>
                </div>
              )}
            </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
