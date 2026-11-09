import React from "react";
import { motion } from "motion/react";
import { ArrowRight, ShoppingBag, Star, ShoppingCart } from "lucide-react";
import { SubSubCategory, Product, StoreAppearance } from "../types";
import OptimizedImage from "../components/OptimizedImage";
import { gridColsClass, ratioToClass, itemCardChrome, DEFAULT_APPEARANCE } from "../utils/useStoreAppearance";

export interface SubSubCategoriesPageProps {
  navigateBack: () => void;
  view: { type: string; id?: number; data?: any; catId?: number; fromSubSub?: boolean; fromCategory?: boolean; subId?: number; subName?: string; fromFav?: boolean };
  subSubCategories: SubSubCategory[];
  products: Product[];
  pageLoading: boolean;
  setPageLoading: (val: boolean) => void;
  fetchProducts: (subId: number, isSubSub?: boolean) => Promise<void>;
  navigateTo: (newView: any) => void;
  isFavorite: (favKey: string) => boolean;
  useLongPressHandlers: (item: any, e: React.TouchEvent | React.MouseEvent) => void;
  theme: any;
  fmtPrice: (usd: number, decimals?: number) => string;
  user: any;
  setView: (val: any) => void;
  setCheckoutQuantity: (val: number) => void;
  appearance?: StoreAppearance;
}

export default function SubSubCategoriesPage(props: SubSubCategoriesPageProps) {
  const {
    navigateBack,
    view,
    subSubCategories,
    products,
    setPageLoading,
    fetchProducts,
    navigateTo,
    isFavorite,
    useLongPressHandlers,
    theme,
    fmtPrice,
    user,
    setView,
    setCheckoutQuantity,
    appearance = DEFAULT_APPEARANCE,
  } = props;

  const subsubGridCls = gridColsClass(appearance.subsub_columns_mobile, appearance.subsub_columns_desktop);
  const subsubRatioCls = ratioToClass(appearance.subsub_image_ratio);

  const directProducts = products.filter(p => !p.sub_sub_category_id);

  // [FIX] نفس مشكلة صفحة الأقسام الفرعية: كانت المنتجات المباشرة تُعرض دائماً قبل
  // كل الأقسام الفرعية-الفرعية بترتيب ثابت في الكود، متجاهلة order_index الفعلي.
  // الحل: دمج القائمتين وفرزهما معاً حسب order_index الحقيقي، بنفس منطق الأدمن.
  type MixedItem =
    | { __kind: "product"; data: Product }
    | { __kind: "subsub"; data: SubSubCategory };
  const mixedItems: MixedItem[] = [
    ...directProducts.map(p => ({ __kind: "product" as const, data: p })),
    ...subSubCategories.map(s => ({ __kind: "subsub" as const, data: s })),
  // [FIX-2] توحيد حسم التعادل على order_index ASC ثم id ASC فقط (مطابق للخادم ولوحة الأدمن)
  // بدل الاعتماد على created_at أولاً، لمنع اختلاف الترتيب المعروض بين الشاشات.
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

      {/* منتجات القسم الفرعي المباشرة + بطاقات الأقسام الفرعية-الفرعية، جنباً إلى جنب بنفس الشبكة */}
      {(subSubCategories.length > 0 || directProducts.length > 0) && (
        <div className={`grid ${subsubGridCls} gap-3`}>
          {mixedItems.map(entry => {
            if (entry.__kind === "product") {
              const prod = entry.data;
              return (
                <motion.div
                  whileTap={(prod as any).available === false ? undefined : { scale: 0.95 }}
                  key={`prod_${prod.id}`}
                  onClick={() => {
                    if ((prod as any).available === false) return;
                    if (!user) return navigateTo({ type: "login" });
                    if (prod.store_type === "quick_order") {
                      navigateTo({ type: "quick_order", data: prod });
                    } else {
                      setCheckoutQuantity(
                        (Array.isArray((prod as any).package_values) && (prod as any).package_values.length > 0)
                          ? (prod as any).package_values[0]
                          : (parseFloat(String(prod.min_quantity)) || 0)
                      );
                      navigateTo({ type: "checkout", data: prod });
                    }
                  }}
                  className={`${itemCardChrome(appearance, "bg-white rounded-lg border border-gray-100 shadow-sm")} flex flex-col items-center overflow-hidden transition-all ${
                    (prod as any).available === false ? "opacity-60 grayscale cursor-not-allowed" : `${itemCardChrome(appearance, "hover:shadow-md")} cursor-pointer active:scale-95`
                  }`}
                >
                  <div className={`w-full ${subsubRatioCls} overflow-hidden rounded-lg bg-gray-50 relative`}>
                    <OptimizedImage
                      src={prod.image_url || "https://picsum.photos/seed/prod/100/100"}
                      width={240}
                      height={240}
                      alt={prod.name}
                      className="w-full h-full object-cover"
                      draggable={false}
                      onDragStart={e => e.preventDefault()}
                      onContextMenu={e => e.preventDefault()}
                    />
                    {(prod as any).available === false && (
                      <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                        <span className="bg-gray-800/80 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">غير متوفر</span>
                      </div>
                    )}
                  </div>
                  <div className="w-full px-1 py-1.5">
                    <p className="font-bold text-gray-700 text-[9px] text-center leading-tight truncate text-prod-name">{prod.name}</p>
                    <p className={`${(prod as any).available === false ? "text-gray-400" : (theme?.text || "text-[var(--brand)]")} text-[9px] text-center font-bold`}>
                      {prod.store_type === "quantities"
                        ? fmtPrice(parseFloat(prod.price as any) || 0, 6) + " / وحدة"
                        : fmtPrice(parseFloat(prod.price as any) || 0)}
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
            const ss = entry.data;
            const favKey = `sss_${ss.id}`;
            let lpTimer2: any = null;
            return (
              <motion.button
                whileTap={{ scale: 0.95 }}
                key={ss.id}
                onClick={async () => {
                  setPageLoading(true);
                  await fetchProducts(ss.id, true);
                  navigateTo({ type: "products", id: ss.id, data: ss.name, fromSubSub: true, subId: view.id, subName: view.data, catId: view.catId, fromFav: view.fromFav });
                  setPageLoading(false);
                }}
                onContextMenu={e => e.preventDefault()}
                onTouchStart={e => { lpTimer2 = setTimeout(() => useLongPressHandlers({ ...ss, _fav_key: favKey, _fav_type: "sub_sub_category", _fav_label: ss.name, _fav_image: ss.image_url, category_id: view.catId, subcategory_id: view.id }, e), 600); }}
                onTouchEnd={() => clearTimeout(lpTimer2)}
                onTouchMove={() => clearTimeout(lpTimer2)}
                onMouseDown={e => { lpTimer2 = setTimeout(() => useLongPressHandlers({ ...ss, _fav_key: favKey, _fav_type: "sub_sub_category", _fav_label: ss.name, _fav_image: ss.image_url, category_id: view.catId, subcategory_id: view.id }, e), 600); }}
                onMouseUp={() => clearTimeout(lpTimer2)}
                onMouseLeave={() => clearTimeout(lpTimer2)}
                className={`${itemCardChrome(appearance, `bg-white rounded-lg border ${isFavorite(favKey) ? "border-yellow-400" : "border-gray-100"} shadow-sm`)} flex flex-col items-center overflow-hidden active:scale-95 transition-transform relative`}
              >
                {isFavorite(favKey) && <span className="absolute top-1 right-1 text-yellow-400 text-xs z-10"><Star size={14} /></span>}
                <div className={`w-full ${subsubRatioCls} overflow-hidden rounded-lg bg-gray-50`}>
                  <OptimizedImage
                    src={ss.image_url || "https://picsum.photos/seed/ss/100/100"}
                    width={240}
                    height={240}
                    alt={ss.name}
                    className="w-full h-full object-cover"
                    draggable={false}
                    onDragStart={e => e.preventDefault()}
                    onContextMenu={e => e.preventDefault()}
                  />
                </div>
                <span className="font-bold text-gray-700 text-[9px] text-center w-full px-1 py-1.5 leading-tight text-subsub-name">{ss.name}</span>
              </motion.button>
            );
          })}
        </div>
      )}

      {subSubCategories.length === 0 && directProducts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
          <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center text-gray-200">
            <ShoppingBag size={40} />
          </div>
          <div>
            <p className="font-bold text-gray-500 text-lg">لم تتم إضافة منتجات بعد</p>
            <p className="text-gray-400 text-sm mt-1">عُد لاحقاً، سيتم إضافة محتوى قريباً</p>
          </div>
        </div>
      )}
    </div>
  );
}
