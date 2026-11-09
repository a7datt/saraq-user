/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * SearchOverlay — بحث شامل بالمتجر (منتجات + أقسام بكل مستوياتها)، يظهر كقائمة منسدلة ضمن
 * الصفحة الرئيسية نفسها (دون مغادرتها أو تغطيتها بالكامل) أسفل حقل البحث مباشرة.
 */
import React from "react";
import { X, Search as SearchIcon, Layers, Package, FolderTree } from "lucide-react";
import OptimizedImage from "./OptimizedImage";

interface SearchProduct {
  id: number;
  name: string;
  image_url: string;
  price: number;
  store_type: string;
  min_quantity: number;
  available?: boolean;
}
interface SearchCategoryLike {
  id: number;
  name: string;
  image_url: string;
}

type ResultKind = "category" | "subcategory" | "subsubcategory" | "product";

const KIND_LABEL: Record<ResultKind, string> = {
  category: "قسم رئيسي",
  subcategory: "قسم فرعي",
  subsubcategory: "فرع فرعي",
  product: "منتج",
};
const KIND_ICON: Record<ResultKind, React.ReactNode> = {
  category: <Layers size={11} />,
  subcategory: <FolderTree size={11} />,
  subsubcategory: <FolderTree size={11} />,
  product: <Package size={11} />,
};

export interface SearchOverlayProps {
  onClose: () => void;
  navigateTo: (newView: any) => void;
  user: any;
  setCheckoutQuantity: (val: number) => void;
  fmtPrice: (usd: number, decimals?: number) => string;
  theme: any;
}

export default function SearchOverlay({ onClose, navigateTo, user, setCheckoutQuantity, fmtPrice, theme }: SearchOverlayProps) {
  const [q, setQ] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [results, setResults] = React.useState<{
    products: SearchProduct[];
    categories: SearchCategoryLike[];
    subcategories: SearchCategoryLike[];
    subSubCategories: SearchCategoryLike[];
  }>({ products: [], categories: [], subcategories: [], subSubCategories: [] });
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);

  // إغلاق القائمة: تصفير نص البحث محلياً — الصفحة الرئيسية تبقى كما هي دون أي تنقّل أو تغطية
  const closePanel = () => { setQ(""); onClose && onClose(); };

  // إغلاق القائمة عند الضغط خارجها
  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) closePanel();
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // بحث مؤجَّل (debounce) 350ms لتفادي إغراق الخادم بطلب لكل ضغطة مفتاح
  React.useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setResults({ products: [], categories: [], subcategories: [], subSubCategories: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then(res => res.json())
        .then(data => setResults({
          products: Array.isArray(data?.products) ? data.products : [],
          categories: Array.isArray(data?.categories) ? data.categories : [],
          subcategories: Array.isArray(data?.subcategories) ? data.subcategories : [],
          subSubCategories: Array.isArray(data?.subSubCategories) ? data.subSubCategories : [],
        }))
        .catch(() => setResults({ products: [], categories: [], subcategories: [], subSubCategories: [] }))
        .finally(() => setLoading(false));
    }, 350);
    return () => clearTimeout(timer);
  }, [q]);

  const openProduct = (prod: SearchProduct) => {
    if (prod.available === false) return;
    if (!user) { navigateTo({ type: "login" }); closePanel(); return; }
    if (prod.store_type === "quick_order") {
      navigateTo({ type: "quick_order", data: prod });
    } else {
      setCheckoutQuantity(parseFloat(String(prod.min_quantity)) || 0);
      navigateTo({ type: "checkout", data: prod });
    }
    closePanel();
  };

  const openCategory = (cat: SearchCategoryLike) => {
    navigateTo({ type: "subcategories", id: cat.id, data: cat.name });
    closePanel();
  };
  const openSubcategory = (sub: SearchCategoryLike) => {
    navigateTo({ type: "sub_sub_categories", id: sub.id, data: sub.name });
    closePanel();
  };
  const openSubSubCategory = (ss: SearchCategoryLike) => {
    navigateTo({ type: "products", id: ss.id, data: ss.name, fromSubSub: true });
    closePanel();
  };

  const hasQuery = q.trim().length >= 2;
  const totalResults = results.products.length + results.categories.length + results.subcategories.length + results.subSubCategories.length;
  const showPanel = q.trim().length > 0;

  const Row = ({ img, name, kind, onClick, disabled, trailing }: { img: string; name: string; kind: ResultKind; onClick: () => void; disabled?: boolean; trailing?: React.ReactNode }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-3 p-2 rounded-xl transition-colors text-right ${disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50 active:bg-gray-100"}`}
    >
      <div className="w-11 h-11 rounded-lg overflow-hidden bg-gray-100 shrink-0">
        <OptimizedImage src={img} width={88} height={88} alt={name} className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0 text-right">
        <p className="text-sm font-bold text-gray-800 truncate">{name}</p>
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gray-400 mt-0.5">
          {KIND_ICON[kind]} {KIND_LABEL[kind]}
        </span>
      </div>
      {trailing}
    </button>
  );

  return (
    <div ref={wrapRef} className="relative">
      <div className="flex items-center gap-2 bg-white border border-gray-100 shadow-sm rounded-full px-4 py-2.5">
        <SearchIcon size={17} className="text-gray-400 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="ابحث عن منتج أو قسم..."
          className="flex-1 bg-transparent outline-none text-sm text-gray-800 placeholder-gray-400"
        />
        {q.length > 0 && (
          <button onClick={() => { setQ(""); inputRef.current?.focus(); }} className="p-1 text-gray-400 shrink-0" aria-label="مسح البحث">
            <X size={16} />
          </button>
        )}
      </div>

      {showPanel && (
        <div className="absolute top-[calc(100%+6px)] left-0 right-0 z-30 bg-white rounded-2xl shadow-xl border border-gray-100 max-h-[70vh] overflow-y-auto p-2">
          {!hasQuery ? (
            <div className="flex flex-col items-center justify-center text-center py-8 text-gray-400">
              <p className="text-xs">أكمل الكتابة للبحث (حرفان على الأقل)</p>
            </div>
          ) : loading ? (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-gray-200 border-t-brand rounded-full animate-spin" />
            </div>
          ) : totalResults === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-8 text-gray-400">
              <p className="text-xs">لا توجد نتائج لـ "{q.trim()}"</p>
            </div>
          ) : (
            <div className="space-y-1">
              {results.categories.map(c => (
                <Row key={`cat_${c.id}`} img={c.image_url} name={c.name} kind="category" onClick={() => openCategory(c)} />
              ))}
              {results.subcategories.map(s => (
                <Row key={`sub_${s.id}`} img={s.image_url} name={s.name} kind="subcategory" onClick={() => openSubcategory(s)} />
              ))}
              {results.subSubCategories.map(ss => (
                <Row key={`ssub_${ss.id}`} img={ss.image_url} name={ss.name} kind="subsubcategory" onClick={() => openSubSubCategory(ss)} />
              ))}
              {results.products.map(prod => {
                const unavailable = prod.available === false;
                return (
                  <Row
                    key={`prod_${prod.id}`}
                    img={prod.image_url}
                    name={prod.name}
                    kind="product"
                    disabled={unavailable}
                    onClick={() => openProduct(prod)}
                    trailing={
                      <span className={`text-xs font-bold shrink-0 ${unavailable ? "text-gray-400" : theme?.text || "text-[var(--brand)]"}`}>
                        {unavailable ? "غير متوفر" : fmtPrice(parseFloat(String(prod.price)) || 0)}
                      </span>
                    }
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
