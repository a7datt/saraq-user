/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { ArrowRight, LayoutGrid, Star, ShoppingCart } from "lucide-react";
import { motion } from "motion/react";
import { Subcategory, SubSubCategory, StoreAppearance, Product, UserData } from "../types";
import OptimizedImage from "../components/OptimizedImage";
import { gridColsClass, ratioToClass, itemCardChrome, DEFAULT_APPEARANCE } from "../utils/useStoreAppearance";

export interface SubcategoriesPageProps {
  navigateBack: () => void;
  view: { type: string; id?: number; data?: any; catId?: number; fromSubSub?: boolean; fromCategory?: boolean; subId?: number; subName?: string; fromFav?: boolean };
  subcategories: Subcategory[];
  categoryDirectProducts?: Product[];
  pageLoading: boolean;
  setPageLoading: (val: boolean) => void;
  fetchSubSubCategories: (subId?: number) => Promise<SubSubCategory[]>;
  fetchProducts: (subId: number, isSubSub?: boolean, fromCategory?: boolean) => Promise<void>;
  navigateTo: (newView: any) => void;
  isFavorite: (favKey: string) => boolean;
  useLongPressHandlers: (item: any, e: React.TouchEvent | React.MouseEvent) => void;
  appearance?: StoreAppearance;
  theme?: any;
  user?: UserData | null;
  fmtPrice?: (usd: number, decimals?: number) => string;
  setCheckoutQuantity?: (val: number) => void;
}

export default function SubcategoriesPage(props: SubcategoriesPageProps) {
  const {
    navigateBack,
    view,
    subcategories,
    categoryDirectProducts = [],
    pageLoading,
    setPageLoading,
    fetchSubSubCategories,
    fetchProducts,
    navigateTo,
    isFavorite,
    useLongPressHandlers,
    appearance = DEFAULT_APPEARANCE,
    theme = {},
    user = null,
    fmtPrice = (usd: number) => `$${usd}`,
    setCheckoutQuantity = () => {},
  } = props;

  const subGridCls = gridColsClass(appearance.sub_columns_mobile, appearance.sub_columns_desktop);
  const subRatioCls = ratioToClass(appearance.sub_image_ratio);

  // [FIX] كانت الصفحة تعرض دائماً كل المنتجات المباشرة أولاً ثم كل الأقسام الفرعية بعدها،
  // بترتيب ثابت في الكود يتجاهل ترتيب الأدمن الفعلي (order_index) تماماً — فمهما رتّب
  // الأدمن (قسم، منتج، قسمين...) كانت الواجهة تُظهر المنتجات في البداية دوماً.
  // الحل: دمج المنتجات المباشرة والأقسام الفرعية في قائمة واحدة، ثم فرزها معاً حسب
  // order_index الحقيقي (وcreated_at ثم id كحسم تعادل)، تماماً كما في لوحة تحكم الأدمن،
  // بحيث تعكس الواجهة نفس التسلسل المختلط الذي اختاره الأدمن بالضبط.
  type MixedItem =
    | { __kind: "product"; data: Product }
    | { __kind: "subcategory"; data: Subcategory };
  const mixedItems: MixedItem[] = [
    ...categoryDirectProducts.map(p => ({ __kind: "product" as const, data: p })),
    ...subcategories.map(s => ({ __kind: "subcategory" as const, data: s })),
  // [FIX-2] حسم التعادل كان يعتمد created_at أولاً بينما كل نقاط الجلب في الخادم ولوحة
  // الأدمن تحسم التعادل بـ id تصاعدياً فقط — توحيد المنطق هنا يمنع اختلاف الترتيب المعروض
  // عن الترتيب الفعلي المحفوظ، ويمنع تغيّره من تلقاء نفسه بين الشاشات.
  ].sort((x, y) => {
    const ox = Number((x.data as any)?.order_index) || 0;
    const oy = Number((y.data as any)?.order_index) || 0;
    if (ox !== oy) return ox - oy;
    return (Number(x.data.id) || 0) - (Number(y.data.id) || 0);
  });

  return (
    <div className="px-4 space-y-4 pb-20">
      <div className="flex items-center gap-2 mb-6">
        <button onClick={navigateBack} className="p-2 bg-gray-100 rounded-full">
          <ArrowRight size={20} className="text-gray-600" />
        </button>
        <h2 className="text-xl font-bold text-gray-800">{view.data}</h2>
      </div>
      {subcategories.length === 0 && categoryDirectProducts.length === 0 && pageLoading ? (
        <div className={`grid ${subGridCls} gap-3`}>
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="bg-gray-100 rounded-lg overflow-hidden animate-pulse">
              <div className="w-full aspect-square bg-gray-200" />
              <div className="h-4 bg-gray-200 mx-2 my-2 rounded-full" />
            </div>
          ))}
        </div>
      ) : subcategories.length === 0 && categoryDirectProducts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-gray-200">
            <LayoutGrid size={40} />
          </div>
          <div>
            <p className="font-bold text-gray-500 text-lg">لم تتم إضافة أقسام بعد</p>
            <p className="text-gray-400 text-sm mt-1">عُد لاحقاً، سيتم إضافة محتوى قريباً</p>
          </div>
        </div>
      ) : (
        <div className={`grid ${subGridCls} gap-3`}>
          {mixedItems.map(entry => {
            if (entry.__kind === "product") {
              const prod = entry.data;
              return (
                <motion.div
                  whileTap={prod.available === false ? undefined : { scale: 0.95 }}
                  key={`prod_${prod.id}`}
                  onClick={() => {
                    if (prod.available === false) return;
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
                  }}
                  className={`${itemCardChrome(appearance, "bg-white rounded-lg border border-gray-100 shadow-sm")} flex flex-col items-center overflow-hidden transition-all ${
                    prod.available === false ? "opacity-60 grayscale cursor-not-allowed" : `${itemCardChrome(appearance, "hover:shadow-md")} cursor-pointer active:scale-95`
                  }`}
                >
                  <div className={`w-full ${subRatioCls} overflow-hidden rounded-lg bg-gray-50 relative`}>
                    <OptimizedImage
                      src={prod.image_url || ""}
                      width={240}
                      height={240}
                      alt={prod.name}
                      className="w-full h-full object-cover"
                      draggable={false}
                      onDragStart={e => e.preventDefault()}
                      onContextMenu={e => e.preventDefault()}
                    />
                    {prod.available === false && (
                      <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                        <span className="bg-gray-800/80 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">غير متوفر</span>
                      </div>
                    )}
                  </div>
                  <div className="w-full px-1 py-1.5">
                    <p className="font-bold text-gray-700 text-[9px] text-center leading-tight truncate text-prod-name">{prod.name}</p>
                    <p className={`${prod.available === false ? "text-gray-400" : (theme.text || "text-[var(--brand)]")} text-[9px] text-center font-bold`}>
                      {fmtPrice(parseFloat(String((prod as any).price || 0)))}
                    </p>
                    {(prod as any).purchase_count !== undefined && (
                      <p className="text-gray-400 text-[8px] text-center flex items-center justify-center gap-0.5">
                        <ShoppingCart size={9} /> تم شراؤه {(prod as any).purchase_count} {(prod as any).purchase_count === 1 ? "مرة" : "مرات"}
                      </p>
                    )}
                  </div>
                </motion.div>
              );
            }
            const sub = entry.data;
            const favKey = `sub_${sub.id}`;
            let lpTimer: any = null;
            return (
              <motion.button
                whileTap={{ scale: 0.95 }}
                key={sub.id}
                onClick={async () => {
                  setPageLoading(true);
                  const subSubs = await fetchSubSubCategories(sub.id);
                  await fetchProducts(sub.id);
                  if (subSubs.length > 0) {
                    navigateTo({ type: "sub_sub_categories", id: sub.id, data: sub.name, catId: view.id });
                  } else {
                    navigateTo({ type: "products", id: sub.id, data: sub.name, fromSubSub: false });
                  }
                  setPageLoading(false);
                }}
                onContextMenu={e => e.preventDefault()}
                onTouchStart={e => { lpTimer = setTimeout(() => useLongPressHandlers({ ...sub, _fav_key: favKey, _fav_type: "subcategory", _fav_label: sub.name, _fav_image: sub.image_url, category_id: view.id }, e), 600); }}
                onTouchEnd={() => clearTimeout(lpTimer)}
                onTouchMove={() => clearTimeout(lpTimer)}
                onMouseDown={e => { lpTimer = setTimeout(() => useLongPressHandlers({ ...sub, _fav_key: favKey, _fav_type: "subcategory", _fav_label: sub.name, _fav_image: sub.image_url, category_id: view.id }, e), 600); }}
                onMouseUp={() => clearTimeout(lpTimer)}
                onMouseLeave={() => clearTimeout(lpTimer)}
                className={`${itemCardChrome(appearance, `bg-white rounded-lg border ${isFavorite(favKey) ? "border-yellow-400" : "border-gray-100"} shadow-sm`)} flex flex-col items-center overflow-hidden active:scale-95 transition-transform relative`}
              >
                {isFavorite(favKey) && <span className="absolute top-1 right-1 text-yellow-400 text-xs z-10"><Star size={12} /></span>}
                <div className={`w-full ${subRatioCls} overflow-hidden rounded-lg bg-gray-50`}>
                  <OptimizedImage
                    src={sub.image_url || "https://picsum.photos/seed/sub/100/100"}
                    width={240}
                    height={240}
                    alt={sub.name}
                    className="w-full h-full object-cover"
                    draggable={false}
                    onDragStart={e => e.preventDefault()}
                    onContextMenu={e => e.preventDefault()}
                  />
                </div>
                <span className="font-bold text-gray-700 text-[9px] text-center w-full px-1 py-1.5 leading-tight text-sub-name">{sub.name}</span>
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}
