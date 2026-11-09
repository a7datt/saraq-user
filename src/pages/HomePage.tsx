/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { ChevronDown, Star, ChevronRight, Image as ImageIcon, LayoutGrid, LayoutList, Flame, ShoppingCart, X, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Category, Banner, Offer, SubSubCategory, Subcategory, UserData, StoreAppearance } from "../types";
import OptimizedImage from "../components/OptimizedImage";
import { gridColsClass, ratioToClass, itemCardChrome, DEFAULT_APPEARANCE, useIsMobileViewport } from "../utils/useStoreAppearance";
import CategorySectionsAccordion from "../components/CategorySectionsAccordion";
import SearchOverlay from "../components/SearchOverlay";

export interface HomePageProps {
  banners: Banner[];
  homeSortMode: "strip" | "categories" | "most_purchased" | "favorites";
  setHomeSortMode: (val: "strip" | "categories" | "most_purchased" | "favorites") => void;
  showSortDropdown: boolean;
  setShowSortDropdown: (val: boolean | ((prev: boolean) => boolean)) => void;
  categories: Category[];
  categoriesLoading?: boolean;
  subcategories?: Subcategory[];
  theme: any;
  setPageLoading: (val: boolean) => void;
  fetchSubcategories: (catId?: number) => Promise<void>;
  navigateTo: (newView: any) => void;
  isFavorite: (favKey: string) => boolean;
  useLongPressHandlers: (item: any, e: React.TouchEvent | React.MouseEvent) => void;
  mostPurchasedLoading: boolean;
  mostPurchased: any[];
  user: UserData | null;
  setCheckoutQuantity: (val: number) => void;
  fmtPrice: (usd: number, decimals?: number) => string;
  favorites: any[];
  setViewHistory: (val: any[] | ((prev: any[]) => any[])) => void;
  fetchSubSubCategories: (subId?: number) => Promise<SubSubCategory[]>;
  fetchProducts: (subId: number, isSubSub?: boolean) => Promise<void>;
  setView: (val: any) => void;
  removeFromFavorites: (favKey: string) => void;
  offers: Offer[];
  fetchMostPurchased: () => Promise<void>;
  appearance?: StoreAppearance;
}

export default function HomePage(props: HomePageProps) {
  const [quickActionOffer, setQuickActionOffer] = useState<Offer | null>(null);
  const {
    banners,
    homeSortMode,
    setHomeSortMode,
    showSortDropdown,
    setShowSortDropdown,
    categories,
    categoriesLoading = false,
    subcategories = [],
    theme,
    setPageLoading,
    fetchSubcategories,
    navigateTo,
    isFavorite,
    useLongPressHandlers,
    mostPurchasedLoading,
    mostPurchased,
    user,
    setCheckoutQuantity,
    fmtPrice,
    favorites,
    setViewHistory,
    fetchSubSubCategories,
    fetchProducts,
    setView,
    removeFromFavorites,
    offers,
    fetchMostPurchased,
    appearance = DEFAULT_APPEARANCE,
  } = props;

  const catGridCls = gridColsClass(appearance.cat_columns_mobile, appearance.cat_columns_desktop);
  const catRatioCls = ratioToClass(appearance.cat_image_ratio);
  const prodGridCls = gridColsClass(appearance.prod_columns_mobile, appearance.prod_columns_desktop);
  const prodRatioCls = ratioToClass(appearance.prod_image_ratio);
  const isMobileViewport = useIsMobileViewport();
  const activeProdColumns = isMobileViewport ? (appearance.prod_columns_mobile || 1) : (appearance.prod_columns_desktop || 1);
  const useGridLayout = activeProdColumns > 1;

  const [currentBanner, setCurrentBanner] = useState(0);
  const [bannerPaused, setBannerPaused] = useState(false);
  const bannerLongPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (banners.length > 1 && !bannerPaused) {
      const timer = setInterval(() => {
        setCurrentBanner((prev) => (prev + 1) % banners.length);
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [banners, bannerPaused]);

  const handleBannerPressStart = () => {
    if (bannerLongPressTimer.current) clearTimeout(bannerLongPressTimer.current);
    bannerLongPressTimer.current = setTimeout(() => {
      setBannerPaused(true);
    }, 450);
  };

  const handleBannerPressEnd = () => {
    if (bannerLongPressTimer.current) {
      clearTimeout(bannerLongPressTimer.current);
      bannerLongPressTimer.current = null;
    }
  };

  const handleBannerDragEnd = (_e: any, info: { offset: { x: number }; velocity: { x: number } }) => {
    if (Math.abs(info.offset.x) > 10) bannerDraggedRef.current = true;
    if (banners.length < 2) return;
    setBannerPaused(true);
    const swipeThreshold = 50;
    if (info.offset.x < -swipeThreshold) {
      setCurrentBanner((prev) => (prev + 1) % banners.length);
    } else if (info.offset.x > swipeThreshold) {
      setCurrentBanner((prev) => (prev - 1 + banners.length) % banners.length);
    }
  };

  const bannerDraggedRef = React.useRef(false);
  const handleBannerClick = () => {
    if (bannerDraggedRef.current) { bannerDraggedRef.current = false; return; }
    const link = banners[currentBanner]?.link_url;
    if (link) window.open(link, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-8 pb-20 bg-gray-50">
      {/* Hero Carousel */}
      <div className="px-4 pt-2">
        <div className={`aspect-[3/1] bg-gray-100 rounded-2xl overflow-hidden relative shadow-md ${theme.shadow}`}>
          {banners.length > 0 ? (
            <AnimatePresence mode="wait">
              <motion.img
                key={banners[currentBanner].id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                src={banners[currentBanner].image_url}
                className={`w-full h-full object-cover touch-pan-y ${banners.length > 1 ? "cursor-grab active:cursor-grabbing" : banners[currentBanner]?.link_url ? "cursor-pointer" : ""}`}
                referrerPolicy="no-referrer"
                drag={banners.length > 1 ? "x" : false}
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.2}
                onDragEnd={handleBannerDragEnd}
                onPointerDown={handleBannerPressStart}
                onPointerUp={handleBannerPressEnd}
                onPointerLeave={handleBannerPressEnd}
                onClick={handleBannerClick}
              />
            </AnimatePresence>
          ) : (
            <div className={`h-full bg-gradient-to-br ${theme.gradient} flex flex-col justify-center px-6 text-white relative overflow-hidden`}>
              <div className="absolute inset-0 bg-black/10" />
              <div className="relative">
                <h2 className="text-2xl font-bold mb-1">أفضل العروض</h2>
                <p className="text-white/90 text-sm">اشحن ألعابك المفضلة بضغطة واحدة</p>
                <button className="mt-4 bg-white text-brand px-5 py-2 rounded-full text-sm font-bold w-fit shadow-sm">اكتشف الآن</button>
              </div>
            </div>
          )}

          {banners.length > 1 && (
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
              {banners.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1.5 rounded-full transition-all ${idx === currentBanner ? "w-4 bg-white" : "w-1.5 bg-white/40"}`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

    {/* البحث — يبقي المستخدم بالصفحة الرئيسية ويعرض النتائج كقائمة منسدلة أسفله، قابل للتعطيل من لوحة التحكم ← مظهر المتجر */}
    {appearance.search_enabled !== false && (
      <div className="px-4">
        <SearchOverlay
          onClose={() => {}}
          navigateTo={navigateTo}
          user={user}
          setCheckoutQuantity={setCheckoutQuantity}
          fmtPrice={fmtPrice}
          theme={theme}
        />
      </div>
    )}

    {/* Categories / Most Purchased / Favorites */}
    <div className="px-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-800 text-[15px]">
          {homeSortMode === "strip" ? "تصفّح الأقسام" : homeSortMode === "categories" ? "الأقسام الرئيسية" : homeSortMode === "most_purchased" ? "أكثر المنتجات شراءً" : "مفضلاتي"}
        </h3>
        {/* Custom Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowSortDropdown(v => !v)}
            className={`flex items-center gap-1.5 text-sm font-bold px-3 py-1.5 rounded-full border ${theme.border} ${theme.text} bg-white shadow-sm`}
          >
            {homeSortMode === "strip" ? "الأسلوب الجديد" : homeSortMode === "categories" ? "الأقسام" : homeSortMode === "most_purchased" ? "الأكثر شراءً" : "المفضلة"}
            <ChevronDown size={14} className={`transition-transform ${showSortDropdown ? "rotate-180" : ""}`} />
          </button>
          <AnimatePresence>
            {showSortDropdown && (
              <>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setShowSortDropdown(false)}
                  className="fixed inset-0 z-40"
                />
                <motion.div
                  initial={{ opacity: 0, scale: 0.92, y: -6 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.92, y: -6 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className="absolute left-0 top-full mt-2 z-50 bg-white rounded-lg shadow-xl border border-gray-100 overflow-hidden min-w-[160px]"
                >
                  {[
                    { value: "strip", label: "الأسلوب الجديد", icon: <LayoutList size={16} /> },
                    { value: "categories", label: "الأقسام الرئيسية", icon: <LayoutGrid size={16} /> },
                    { value: "most_purchased", label: "الأكثر شراءً", icon: <Flame size={16} /> },
                    { value: "favorites", label: "مفضلاتي", icon: <Star size={16} /> },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        const v = opt.value as any;
                        setHomeSortMode(v);
                        // [HOME-MODE] اختيار المستخدم الصريح من هذه القائمة يُحفظ محلياً ويتغلّب
                        // على الأسلوب الافتراضي الذي يضبطه الأدمن، للأبد وفي كل زيارة قادمة —
                        // بخلاف أي استدعاء آخر لـ setHomeSortMode في الموقع (مثل اختصارات
                        // الانتقال للمفضلة)، والتي لا تُعتبر اختياراً دائماً فلا تُحفظ هنا.
                        try { localStorage.setItem("saraqib_store_home_mode", v); } catch {}
                        if (v === "most_purchased") fetchMostPurchased();
                        setShowSortDropdown(false);
                      }}
                      style={homeSortMode === opt.value ? { color: "#000000" } : undefined}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-right transition-colors ${
                        homeSortMode === opt.value
                          ? `${theme.bgLight} font-black`
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      <span className="text-base">{opt.icon}</span>
                      <span className="flex-1 text-right">{opt.label}</span>
                      {homeSortMode === opt.value && <span className={`w-2 h-2 rounded-full ${theme.button}`} />}
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ===== NEW STRIP / ACCORDION VIEW (الأسلوب الجديد) ===== */}
      {homeSortMode === "strip" && (
        <CategorySectionsAccordion
          categories={categories}
          categoriesLoading={categoriesLoading}
          subcategories={subcategories}
          appearance={appearance}
          theme={theme}
          navigateTo={navigateTo}
          setPageLoading={setPageLoading}
          fetchSubSubCategories={fetchSubSubCategories}
          fetchProducts={fetchProducts}
          isFavorite={isFavorite}
          useLongPressHandlers={useLongPressHandlers}
          user={user}
          fmtPrice={fmtPrice}
          setCheckoutQuantity={setCheckoutQuantity}
        />
      )}

      {/* ===== CATEGORIES VIEW ===== */}
      {homeSortMode === "categories" && (
        categoriesLoading ? (
          <div className={`grid ${catGridCls} gap-3`}>
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="bg-gray-100 rounded-xl overflow-hidden animate-pulse">
                <div className={`w-full ${catRatioCls} bg-gray-200`} />
                <div className="h-4 bg-gray-200 mx-2 my-2 rounded-full" />
              </div>
            ))}
          </div>
        ) : categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center py-10">
            <img
              src="https://i.ibb.co/dw8dLTgw/1000030062-removebg-preview.png"
              alt="لا توجد أقسام رئيسية"
              className="w-56 h-56 object-contain"
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              draggable={false}
              onDragStart={e => e.preventDefault()}
              onContextMenu={e => e.preventDefault()}
            />
            <p className="text-gray-400 text-sm mt-2">لا توجد أقسام رئيسية حالياً</p>
          </div>
        ) : (
        <div className={`grid ${catGridCls} gap-3`}>
          {categories.map(cat => {
            const favKey = `cat_${cat.id}`;
            let longPressTimer: any = null;
            return (
              <motion.button
                whileTap={{ scale: 0.95 }}
                key={cat.id}
                onClick={async () => {
                  setPageLoading(true);
                  await fetchSubcategories(cat.id);
                  navigateTo({ type: "subcategories", id: cat.id, data: cat.name });
                  setPageLoading(false);
                }}
                onContextMenu={e => e.preventDefault()}
                onTouchStart={e => {
                  const touch = e.touches[0];
                  longPressTimer = setTimeout(() => {
                    useLongPressHandlers({ ...cat, _fav_key: favKey, _fav_type: "category", _fav_label: cat.name, _fav_image: cat.image_url }, e);
                  }, 600);
                }}
                onTouchEnd={() => clearTimeout(longPressTimer)}
                onTouchMove={() => clearTimeout(longPressTimer)}
                onMouseDown={e => {
                  longPressTimer = setTimeout(() => {
                    useLongPressHandlers({ ...cat, _fav_key: favKey, _fav_type: "category", _fav_label: cat.name, _fav_image: cat.image_url }, e);
                  }, 600);
                }}
                onMouseUp={() => clearTimeout(longPressTimer)}
                onMouseLeave={() => clearTimeout(longPressTimer)}
                className={`${itemCardChrome(appearance, `bg-white rounded-xl border ${isFavorite(favKey) ? "border-yellow-400" : "border-gray-100"} shadow-sm hover:shadow-md`)} flex flex-col items-center overflow-hidden hover:${theme.border} transition-all relative`}
              >
                {isFavorite(favKey) && <span className="absolute top-1 right-1 text-yellow-400 text-xs"><Star size={14} /></span>}
                <div className={`w-full ${catRatioCls} overflow-hidden rounded-xl bg-gray-50`}>
                  <OptimizedImage
                    src={cat.image_url}
                    width={240}
                    height={240}
                    alt={cat.name}
                    className="w-full h-full object-cover"
                    draggable={false}
                    onDragStart={e => e.preventDefault()}
                  />
                </div>
                <span className="font-bold text-gray-700 text-[10px] text-center w-full px-1 py-1.5 leading-tight text-cat-name">{cat.name}</span>
              </motion.button>
            );
          })}
        </div>
        )
      )}

      {/* ===== MOST PURCHASED VIEW ===== */}
      {homeSortMode === "most_purchased" && (
        useGridLayout ? (
        <div className={`grid ${prodGridCls} gap-3`}>
          {mostPurchasedLoading ? (
            [1,2,3,4,5,6,7,8,9].map(i => (
              <div key={i} className="bg-gray-100 rounded-xl overflow-hidden animate-pulse">
                <div className={`w-full ${prodRatioCls} bg-gray-200`} />
                <div className="h-4 bg-gray-200 mx-2 my-2 rounded-full" />
              </div>
            ))
          ) : mostPurchased.length === 0 ? (
            <div className="col-span-3 flex flex-col items-center text-center text-gray-400 py-10 text-sm gap-3">
              <img
                src="https://i.ibb.co/B2prCfNJ/1000030614-removebg-preview.png"
                alt="لا توجد بيانات بعد"
                className="w-36 h-36 object-contain"
                loading="lazy"
              decoding="async"
                referrerPolicy="no-referrer"
                draggable={false}
                onDragStart={e => e.preventDefault()}
                onContextMenu={e => e.preventDefault()}
              />
              لا توجد بيانات بعد
            </div>
          ) : mostPurchased.slice(0, 9).map((prod: any) => (
            <motion.div
              whileTap={prod.available === false ? undefined : { scale: 0.95 }}
              key={prod.id}
              onClick={() => {
                if (prod.available === false) return;
                if (!user) return navigateTo({ type: "login" });
                if (prod.store_type === 'quick_order') {
                  navigateTo({ type: "quick_order", data: prod, fromMostPurchased: true });
                } else {
                  setCheckoutQuantity((Array.isArray((prod as any).package_values) && (prod as any).package_values.length > 0) ? (prod as any).package_values[0] : (parseFloat(String(prod.min_quantity)) || 0));
                  navigateTo({ type: "checkout", data: prod, fromMostPurchased: true });
                }
              }}
              className={`${itemCardChrome(appearance, "bg-white rounded-xl border border-gray-100 shadow-sm")} flex flex-col items-center overflow-hidden transition-all ${
                prod.available === false
                  ? 'opacity-60 grayscale cursor-not-allowed'
                  : `${itemCardChrome(appearance, "hover:shadow-md")} cursor-pointer`
              }`}
            >
              <div className={`w-full ${prodRatioCls} overflow-hidden rounded-xl bg-gray-50 relative`}>
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
                <p className="font-bold text-gray-700 text-[10px] text-center leading-tight truncate text-prod-name">{prod.name}</p>
                <p className={`${prod.available === false ? 'text-gray-400' : theme.text} text-[10px] text-center font-bold`}>{fmtPrice(parseFloat(prod.price || 0))}</p>
                <p className="text-gray-400 text-[9px] text-center flex items-center justify-center gap-0.5"><ShoppingCart size={10} /> تم شراؤه {prod.purchase_count} {prod.purchase_count === 1 ? "مرة" : "مرات"}</p>
              </div>
            </motion.div>
          ))}
        </div>
        ) : (
        <div className="grid grid-cols-1 gap-3">
          {mostPurchasedLoading ? (
            [1,2,3,4].map(i => (
              <div key={i} className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden animate-pulse">
                <div className="flex" dir="rtl">
                  <div className="shrink-0 w-28 aspect-square bg-gray-200" />
                  <div className="flex-1 px-3 py-2 space-y-2">
                    <div className="h-3 bg-gray-200 rounded-full w-3/4" />
                    <div className="h-3 bg-gray-100 rounded-full w-1/2" />
                  </div>
                </div>
              </div>
            ))
          ) : mostPurchased.length === 0 ? (
            <div className="flex flex-col items-center text-center text-gray-400 py-10 text-sm gap-3">
              <img
                src="https://i.ibb.co/B2prCfNJ/1000030614-removebg-preview.png"
                alt="لا توجد بيانات بعد"
                className="w-36 h-36 object-contain"
                loading="lazy"
              decoding="async"
                referrerPolicy="no-referrer"
                draggable={false}
                onDragStart={e => e.preventDefault()}
                onContextMenu={e => e.preventDefault()}
              />
              لا توجد بيانات بعد
            </div>
          ) : mostPurchased.slice(0, 9).map((prod: any) => (
            <motion.div
              whileTap={prod.available === false ? undefined : { scale: 0.98 }}
              key={prod.id}
              onClick={() => {
                if (prod.available === false) return;
                if (!user) return navigateTo({ type: "login" });
                if (prod.store_type === 'quick_order') {
                  navigateTo({ type: "quick_order", data: prod, fromMostPurchased: true });
                } else {
                  setCheckoutQuantity((Array.isArray((prod as any).package_values) && (prod as any).package_values.length > 0) ? (prod as any).package_values[0] : (parseFloat(String(prod.min_quantity)) || 0));
                  navigateTo({ type: "checkout", data: prod, fromMostPurchased: true });
                }
              }}
              className={`${itemCardChrome(appearance, "bg-white rounded-lg border border-gray-100 shadow-sm")} overflow-hidden transition-all relative ${
                prod.available === false ? 'grayscale cursor-not-allowed' : `${itemCardChrome(appearance, "hover:shadow-md")} cursor-pointer`
              }`}
            >
              <div className="flex" dir="rtl">
                <div className="relative shrink-0 w-28 aspect-square rounded-lg overflow-hidden">
                  <OptimizedImage
                    src={prod.image_url || ""}
                    width={300}
                    height={300}
                    alt={prod.name}
                    className="h-full w-full object-cover"
                    draggable={false}
                    onDragStart={e => e.preventDefault()}
                    onContextMenu={e => e.preventDefault()}
                  />
                </div>
                <div className="flex flex-col justify-center px-3 py-2 min-w-0 overflow-hidden items-start flex-1">
                  <h4 className="font-bold text-gray-800 text-sm truncate w-full text-prod-name">{prod.name}</h4>
                  <p className={`${prod.available === false ? 'text-gray-400' : theme.text} font-bold text-sm mt-1`}>{fmtPrice(parseFloat(prod.price || 0))}</p>
                  <p className="text-gray-400 text-[10px] mt-1 flex items-center gap-0.5"><ShoppingCart size={10} /> تم شراؤه {prod.purchase_count} {prod.purchase_count === 1 ? "مرة" : "مرات"}</p>
                </div>
                {prod.available === false && (
                  <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                    <span className="bg-gray-800/80 text-white text-[9px] font-bold px-2 py-0.5 rounded-full">غير متوفر</span>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
        )
      )}

      {/* ===== FAVORITES VIEW ===== */}
      {homeSortMode === "favorites" && (
        <div>
          {favorites.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
              <img
                src="https://i.ibb.co/FLdx8PK2/1000030213-removebg-preview.png"
                alt="لا توجد مفضلات"
                className="w-36 h-36 object-contain mx-auto mb-3"
                loading="lazy"
              decoding="async"
                referrerPolicy="no-referrer"
                draggable={false}
                onDragStart={e => e.preventDefault()}
                onContextMenu={e => e.preventDefault()}
              />
              <p className="text-sm">لا توجد مفضلات بعد</p>
              <p className="text-xs mt-1">اضغط مطولاً على أي قسم أو منتج لإضافته</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4 pt-1">
              {favorites.slice(0, 9).map((fav: any) => (
                <div key={fav._fav_key} className="relative isolate">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={async () => {
                      // Reset history when coming from favorites - start fresh from main
                      setViewHistory([{ type: "main" }]);
                      if (fav._fav_type === "category") {
                        setPageLoading(true);
                        await fetchSubcategories(fav.id);
                        const nextView = { type: "subcategories", id: fav.id, data: fav.name, fromFav: true };
                        setViewHistory([{ type: "main" }, nextView]);
                        setView(nextView);
                        setPageLoading(false);
                      } else if (fav._fav_type === "subcategory") {
                        setPageLoading(true);
                        const subSubs = await fetchSubSubCategories(fav.id);
                        await fetchProducts(fav.id);
                        if (subSubs.length > 0) {
                          const nextView = { type: "sub_sub_categories", id: fav.id, data: fav.name, catId: fav.category_id, fromFav: true };
                          setViewHistory([{ type: "main" }, nextView]);
                          setView(nextView);
                        } else {
                          const nextView = { type: "products", id: fav.id, data: fav.name, fromSubSub: false, catId: fav.category_id, fromFav: true };
                          setViewHistory([{ type: "main" }, nextView]);
                          setView(nextView);
                        }
                        setPageLoading(false);
                      } else if (fav._fav_type === "sub_sub_category") {
                        setPageLoading(true);
                        await fetchProducts(fav.id, true);
                        const nextView = { type: "products", id: fav.id, data: fav.name, fromSubSub: true, catId: fav.category_id, subId: fav.subcategory_id, fromFav: true };
                        setViewHistory([{ type: "main" }, nextView]);
                        setView(nextView);
                        setPageLoading(false);
                      } else if (fav._fav_type === "product") {
                        setPageLoading(true);
                        const subId = fav._view_id;
                        const isSubSub = fav._view_fromSubSub ?? true;
                        await fetchProducts(subId, isSubSub);
                        const prodListView = {
                          type: "products",
                          id: subId,
                          data: fav._view_data,
                          fromSubSub: isSubSub,
                          catId: fav._view_catId,
                          subId: fav._view_subId,
                          subName: fav._view_subName,
                          fromFav: true,
                        };
                        setViewHistory([{ type: "main" }, prodListView]);
                        setView(prodListView);
                        setPageLoading(false);
                        setTimeout(() => {
                          if (!user) return navigateTo({ type: "login" });
                          if (fav.store_type === 'quick_order') {
                            navigateTo({ type: "quick_order", data: fav });
                          } else {
                            setCheckoutQuantity((Array.isArray((fav as any).package_values) && (fav as any).package_values.length > 0) ? (fav as any).package_values[0] : (parseFloat(String(fav.min_quantity)) || 0));
                            navigateTo({ type: "checkout", data: fav });
                          }
                        }, 150);
                      }
                    }}
                    className={`relative w-full ${itemCardChrome(appearance, "bg-white rounded-xl border border-yellow-300 shadow-sm hover:shadow-md")} flex flex-col items-center overflow-hidden transition-all`}
                    onContextMenu={e => e.preventDefault()}
                  >
                    <div className="w-full aspect-square overflow-hidden rounded-xl bg-gray-50 relative">
                      <OptimizedImage
                        src={fav._fav_image || ""}
                        width={240}
                        height={240}
                        alt={fav._fav_label}
                        className="w-full h-full object-cover block"
                        draggable={false}
                        onDragStart={e => e.preventDefault()}
                        onContextMenu={e => e.preventDefault()}
                      />
                      <span className="absolute top-1 right-1 text-yellow-400 text-xs z-10"><Star size={14} /></span>
                    </div>
                    <span className="font-bold text-gray-700 text-[10px] text-center w-full px-1 py-1.5 leading-tight truncate">{fav._fav_label}</span>
                  </motion.button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeFromFavorites(fav._fav_key); }}
                    className="absolute top-1 left-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white text-[10px] z-30 shadow-md"
                  ><X size={12} /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>

    {/* Dynamic Offers */}
    {offers.length > 0 && (
      <div className="px-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-800 text-[15px]">عروض مميزة</h3>
        </div>
        <div className="space-y-3">
          {offers.map(offer => (
            <div key={offer.id} onClick={() => setQuickActionOffer(offer)} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md flex items-center gap-4 transition-all cursor-pointer">
              <div className="w-12 h-12 shrink-0 bg-orange-50 rounded-lg flex items-center justify-center overflow-hidden">
                {offer.image_url ? (
                  <OptimizedImage src={offer.image_url} width={96} height={96} className="w-full h-full object-cover" />
                ) : (
                  <ImageIcon size={22} className="text-orange-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-bold text-gray-800 text-sm truncate">{offer.title}</h4>
                <p className="text-gray-400 text-xs truncate">{offer.description}</p>
              </div>
              {offer.link_url ? (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); window.open(offer.link_url, "_blank", "noopener,noreferrer"); }}
                  className="shrink-0 w-9 h-9 rounded-full bg-[var(--brand)]/10 text-[var(--brand)] flex items-center justify-center"
                  aria-label="فتح الرابط"
                >
                  <ExternalLink size={16} />
                </button>
              ) : (
                <ChevronRight size={20} className="text-gray-300 shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>
    )}

    {/* Offer Quick Action Modal */}
    <AnimatePresence>
      {quickActionOffer && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] bg-black/50 flex items-end justify-center"
          onClick={() => setQuickActionOffer(null)}
        >
          <motion.div
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "tween", duration: 0.25 }}
            className="bg-white w-full max-w-lg rounded-t-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-800 text-base">{quickActionOffer.title}</h3>
              <button onClick={() => setQuickActionOffer(null)} className="text-gray-400"><X size={22} /></button>
            </div>
            {quickActionOffer.image_url && (
              <div className="w-full h-36 rounded-xl overflow-hidden bg-orange-50">
                <OptimizedImage src={quickActionOffer.image_url} width={480} height={288} className="w-full h-full object-cover" />
              </div>
            )}
            {quickActionOffer.description && (
              <p className="text-gray-500 text-sm">{quickActionOffer.description}</p>
            )}
            {quickActionOffer.link_url ? (
              <button
                onClick={() => { window.open(quickActionOffer.link_url, "_blank", "noopener,noreferrer"); setQuickActionOffer(null); }}
                className="w-full bg-[var(--brand)] text-white py-3.5 rounded-lg font-bold text-sm"
              >
                عرض التفاصيل
              </button>
            ) : (
              <button onClick={() => setQuickActionOffer(null)} className="w-full bg-gray-100 text-gray-500 py-3.5 rounded-lg font-bold text-sm">
                إغلاق
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
  );
}
