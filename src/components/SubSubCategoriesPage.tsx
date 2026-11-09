import React from "react";
import { motion } from "motion/react";
import { ArrowRight, ShoppingBag, Star } from "lucide-react";
import { SubSubCategory, Product, StoreAppearance } from "../types";
import OptimizedImage from "../components/OptimizedImage";
import { gridColsClass, ratioToClass, DEFAULT_APPEARANCE } from "../utils/useStoreAppearance";

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

  return (
    <div className="px-4 space-y-4 pb-20">
      <div className="flex items-center gap-2 mb-6">
        <button onClick={navigateBack} className="p-2 bg-gray-100 rounded-full">
          <ArrowRight size={20} className="text-gray-600" />
        </button>
        <h2 className="text-xl font-bold text-gray-800">{view.data}</h2>
      </div>

      {/* Sub-sub-categories */}
      {subSubCategories.length > 0 && (
        <div className={`grid ${subsubGridCls} gap-3`}>
          {subSubCategories.map(ss => {
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
                className={`bg-white rounded-lg border ${isFavorite(favKey) ? "border-yellow-400" : "border-gray-100"} shadow-sm flex flex-col items-center overflow-hidden active:scale-95 transition-transform relative`}
              >
                {isFavorite(favKey) && <span className="absolute top-1 right-1 text-yellow-400 text-xs z-10"><Star size={14} /></span>}
                <div className={`w-full ${subsubRatioCls} overflow-hidden bg-gray-50`}>
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

      {/* Direct products (no sub-sub-category) */}
      {directProducts.length > 0 && (
        <div className="space-y-4">
          {subSubCategories.length > 0 && (
            <p className="text-xs font-bold text-gray-400 px-1">منتجات القسم</p>
          )}
          <div className="grid grid-cols-1 gap-4">
            {directProducts.map(prod => (
              <div
                key={prod.id}
                className="bg-white p-4 rounded-lg border border-gray-100 shadow-sm flex flex-col gap-4 cursor-pointer"
                onClick={() => {
                  if (!user) return navigateTo({ type: "login" });
                  if (prod.store_type === 'quick_order') {
                    navigateTo({ type: "quick_order", data: prod });
                  } else {
                    setCheckoutQuantity((Array.isArray((prod as any).package_values) && (prod as any).package_values.length > 0) ? (prod as any).package_values[0] : (parseFloat(String(prod.min_quantity)) || 0));
                    navigateTo({ type: "checkout", data: prod });
                  }
                }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gray-50 rounded-lg flex items-center justify-center overflow-hidden">
                    <OptimizedImage src={prod.image_url || "https://picsum.photos/seed/prod/100/100"} width={128} height={128} alt={prod.name} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-gray-800 text-prod-name">{prod.name}</h4>
                    <p className={`${theme.text} font-bold`}>
                      {prod.store_type === 'quantities'
                        ? fmtPrice(parseFloat(prod.price as any) || 0, 6) + " / وحدة"
                        : fmtPrice(parseFloat(prod.price as any) || 0)}
                    </p>
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
                </div>
                <p className="text-gray-500 text-sm leading-relaxed">{prod.description || "لا يوجد وصف متاح لهذا المنتج."}</p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!user) return navigateTo({ type: "login" });
                    if (prod.store_type === 'quick_order') {
                      navigateTo({ type: "quick_order", data: prod });
                    } else {
                      setCheckoutQuantity((Array.isArray((prod as any).package_values) && (prod as any).package_values.length > 0) ? (prod as any).package_values[0] : (parseFloat(String(prod.min_quantity)) || 0));
                      navigateTo({ type: "checkout", data: prod });
                    }
                  }}
                  className={`w-full ${theme.button} text-white py-3 rounded-lg font-bold ${theme.buttonHover} transition-colors`}
                >
                  {prod.store_type === 'quick_order' ? "طلب سريع" : "شراء الآن"}
                </button>
              </div>
            ))}
          </div>
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
