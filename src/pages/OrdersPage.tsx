import { useState, useMemo } from "react";
import {
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  CalendarDays,
  X,
  Hash,
  Package,
  KeyRound,
  MessageSquare,
  Share2,
} from "lucide-react";
import { Order } from "../types";
import OrderPollingStatus from "../components/OrderPollingStatus";
import OrderShareModal from "../components/OrderShareModal";
import { formatPriceUSD } from "../utils/formatPrice";
import { buildOrderShareData, getArabicStatus, OrderShareRow } from "../utils/orderShare";

export interface OrdersPageProps {
  orders: Order[];
  setActiveTab: (tab: string) => void;
  fetchOrders: () => void;
}

function formatResponseTime(seconds?: number | null): string | null {
  if (seconds == null || Number.isNaN(seconds)) return null;
  if (seconds < 60) return `${seconds} ثانية`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} دقيقة`;
  return `${(seconds / 3600).toFixed(1)} ساعة`;
}

export default function OrdersPage({ orders, setActiveTab, fetchOrders }: OrdersPageProps) {
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'failed' | 'pending'>('all');
  const [dateFrom, setDateFrom] = useState<string>(""); // yyyy-mm-dd
  const [dateTo, setDateTo] = useState<string>("");     // yyyy-mm-dd
  const [showDatePicker, setShowDatePicker] = useState(false);
  const hasDateFilter = !!(dateFrom || dateTo);
  const [shareOrder, setShareOrder] = useState<{ title: string; rows: OrderShareRow[]; orderId: number } | null>(null);

  const isCompletedStatus = (s?: string) => s === 'completed' || s === 'accepted' || s === 'approved';
  const isFailedStatus = (s?: string) => s === 'failed' || s === 'cancelled' || s === 'rejected';

  const completedCount = orders.filter(o => isCompletedStatus(o.status)).length;
  const failedCount    = orders.filter(o => isFailedStatus(o.status)).length;
  const pendingCount   = orders.filter(o => !isCompletedStatus(o.status) && !isFailedStatus(o.status)).length;

  const toIsoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const filteredOrders = useMemo(() => orders.filter(o => {
    if (filterStatus === 'completed' && !isCompletedStatus(o.status)) return false;
    if (filterStatus === 'failed' && !isFailedStatus(o.status)) return false;
    if (filterStatus === 'pending' && (isCompletedStatus(o.status) || isFailedStatus(o.status))) return false;
    if (dateFrom || dateTo) {
      const iso = toIsoDate(new Date(o.created_at));
      if (dateFrom && iso < dateFrom) return false;
      if (dateTo && iso > dateTo) return false;
    }
    return true;
  }), [orders, filterStatus, dateFrom, dateTo]);

  const clearDateFilter = () => { setDateFrom(""); setDateTo(""); };

  const filters: { key: 'all' | 'completed' | 'failed' | 'pending'; label: string; count?: number; color: string }[] = [
    { key: 'all',       label: 'الكل',         color: 'bg-gray-800 text-white' },
    { key: 'completed', label: 'مكتملة',  count: completedCount, color: 'bg-green-500 text-white' },
    { key: 'failed',    label: 'مرفوضة',  count: failedCount,    color: 'bg-red-500 text-white' },
    { key: 'pending',   label: 'قيد المراجعة', count: pendingCount, color: 'bg-blue-500 text-white' },
  ];

  // يدمج meta الطلب مع extra_data الخاص بأول عنصر (احتياطي لأي بيانات غير مُزامَنة في meta)
  const getMergedMetaStr = (order: Order): string => {
    try {
      const base = JSON.parse(order.meta || "{}");
      const itemExtra = order.order_items?.[0]?.extra_data;
      if (itemExtra) {
        const extra = JSON.parse(itemExtra);
        return JSON.stringify({ ...extra, ...base }); // meta الطلب له الأولوية (الأحدث/الأدق)
      }
      return JSON.stringify(base);
    } catch { return order.meta || "{}"; }
  };

  const getOrderCodes = (metaStr: string): string[] => {
    try {
      const meta = JSON.parse(metaStr || "{}");
      const raw: any[] = [];
      if (Array.isArray(meta.ahminix_replay)) raw.push(...meta.ahminix_replay);
      if (Array.isArray(meta.replay_api)) raw.push(...meta.replay_api);
      // تحويل كل شيء لـ string (يمنع React Error #31)
      return [...new Set(
        raw.map((x: any) => {
          if (!x) return null;
          if (typeof x === "string") return x.trim() || null;
          if (typeof x === "number") return String(x);
          if (typeof x === "object") {
            const v = x.replay ?? x.code ?? x.value ?? x.key ?? x.data ?? null;
            return v !== null ? String(v) : null;
          }
          return String(x);
        }).filter(Boolean) as string[]
      )];
    } catch { return []; }
  };

  // يستخرج محتوى المنتج المُسلَّم من المخزون (أكواد التفعيل، حسابات، إلخ)
  const getInventoryDelivered = (metaStr: string): string | null => {
    try {
      const meta = JSON.parse(metaStr || "{}");
      const val = meta.inventory_delivered;
      if (!val) return null;
      return String(val).trim() || null;
    } catch { return null; }
  };

  const getMetaLabels = (metaStr: string) => {
    // الحقول الداخلية التي لا نعرضها
    const hidden = new Set([
      'storeType','order_mode','ahminix_order_id','ahminix_order_uuid','ahminix_status','ahminix_replay',
      'replay_api','defaultFields','customFields','cost_price','provider_id','last_api_error',
      'product_name','completed_at','external_api','vip_discount','quick_order',
      'api_error_code','api_error_msg','api_error_at','api_send_attempted',
      'admin_approved_at','refunded','refunded_at','category_name','subcategory_name','subsubcategory_name',
      'admin_completed_at','inventory_delivered','delivered','delivered_at','delivered_count',
      'created_at','updated_at','synced_at','expires_at','discount_expires_at','profit_reset_at',
      'reset_at','last_test_at','last_message_at',
    ]);
    const labelMap: Record<string, string> = {
      playerId:  "معرف اللاعب",
      player_id: "معرف اللاعب",
      input:     "معرف اللاعب",
      quantity:  "الكمية",
      quantities:"الكميات",
      phone:     "رقم الهاتف",
      gameId:    "معرف اللعبة",
      accountId: "معرف الحساب",
      userId:    "معرف المستخدم",
      server:    "السيرفر",
      zone:      "المنطقة",
      email:     "البريد الإلكتروني",
      note:      "ملاحظة",
      username:  "اسم المستخدم",
      password:  "كلمة المرور",
      discordId: "معرف الديسكورد",
      whatsapp:  "واتساب",
      region:    "المنطقة",
      level:     "المستوى",
      character: "الشخصية",
      rank:      "الرتبة",
      method:    "الطريقة",
      code:      "الكود",
    };
    try {
      const meta = JSON.parse(metaStr || "{}");
      const flat = Object.entries(meta)
        .filter(([k, v]) => !hidden.has(k) && v !== null && v !== undefined && String(v).trim() !== "" && typeof v !== "object")
        .map(([k, v]: any) => ({ label: labelMap[k] || "بيانات المنتج", value: String(v) }));
      // إزالة تكرار نفس الـ label (مثال: playerId و input كلاهما "معرف اللاعب")
      const seenLabels = new Set<string>();
      const flatDeduped = flat.filter(e => {
        if (seenLabels.has(e.label)) return false;
        seenLabels.add(e.label);
        return true;
      });
      // الحقول الافتراضية والمخصصة (طلب سريع / كميات) محفوظة كمصفوفة كائنات {label, value, required}
      const expandFieldArray = (arr: any): { label: string; value: string }[] => {
        if (!Array.isArray(arr)) return [];
        return arr
          .filter((f: any) => f && String(f.value ?? "").trim() !== "")
          .map((f: any) => ({ label: f.label || "حقل", value: String(f.value) }));
      };
      const fieldEntries = [
        ...expandFieldArray(meta.defaultFields),
        ...expandFieldArray(meta.customFields),
      ];
      // تجنب تكرار نفس القيمة إن ظهرت أيضاً في playerId/input المسطّحة
      const seen = new Set(flatDeduped.map(e => `${e.label}:${e.value}`));
      const extra = fieldEntries.filter(e => !seen.has(`${e.label}:${e.value}`));
      return [...flatDeduped, ...extra];
    } catch { return []; }
  };

  return (
    <div className="px-4 space-y-4 pb-20">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-2xl font-bold text-gray-800">طلباتي</h2>
        <button
          onClick={() => setShowDatePicker(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition-all active:scale-95 ${
            hasDateFilter ? 'bg-brand text-white border-transparent shadow-sm' : 'bg-white border-gray-100 text-gray-500'
          }`}
        >
          <CalendarDays size={14} />
          {hasDateFilter ? "فترة محددة" : "فلترة بالتاريخ"}
        </button>
      </div>

      {/* منتقي فترة التاريخ (من - حتى) */}
      {showDatePicker && (
        <div className="bg-white border border-gray-100 rounded-lg p-3 shadow-sm space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex-1 space-y-1">
              <label className="text-[10px] font-bold text-gray-400">من</label>
              <input
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={e => { setDateFrom(e.target.value); setExpandedOrderId(null); }}
                className="w-full bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-[10px] font-bold text-gray-400">حتى</label>
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={e => { setDateTo(e.target.value); setExpandedOrderId(null); }}
                className="w-full bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </div>
            {hasDateFilter && (
              <button
                onClick={clearDateFilter}
                className="self-end p-2 mb-0.5 bg-gray-100 rounded-lg text-gray-500 active:scale-95 shrink-0"
                aria-label="مسح فلتر التاريخ"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* شريط التصفية حسب الحالة */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => { setFilterStatus(f.key); setExpandedOrderId(null); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all active:scale-95 border ${
              filterStatus === f.key
                ? f.color + ' border-transparent shadow-sm'
                : 'bg-white border-gray-100 text-gray-500'
            }`}
          >
            {f.label}
            {f.count !== undefined && (
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                filterStatus === f.key ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-600'
              }`}>{f.count}</span>
            )}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filteredOrders.map(order => {
          const isExpanded = expandedOrderId === order.id;
          const isCompleted = isCompletedStatus(order.status);
          const isFailed = isFailedStatus(order.status);
          const arabicStatus = getArabicStatus(order.status);
          const statusLabel = arabicStatus.label;

          const metaStr = getMergedMetaStr(order);
          const metaEntries = getMetaLabels(metaStr);
          const codes = getOrderCodes(metaStr);
          const inventoryContent = getInventoryDelivered(metaStr);
          const item = order.order_items?.[0];
          const orderedQty = item?.quantity && item.quantity > 1 ? item.quantity : null;
          const unitPrice = item?.price_at_purchase;
          
          return (
            <div key={order.id} className="relative bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm transition-shadow hover:shadow-md">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const extraRows: OrderShareRow[] = metaEntries.map(m => ({ label: m.label, value: m.value }));
                  if (inventoryContent) extraRows.push({ label: "بيانات المنتج المُسلَّم", value: inventoryContent });
                  if (codes.length > 0) extraRows.push({ label: "أكواد التفعيل", value: codes.join(" / ") });
                  const { title, rows } = buildOrderShareData(order, extraRows);
                  setShareOrder({ title, rows, orderId: order.id });
                }}
                className="absolute top-2 left-2 z-10 p-1 text-gray-300 hover:text-brand active:scale-95 transition-colors"
                aria-label="مشاركة الطلب"
              >
                <Share2 size={13} />
              </button>
              {/* رأس البطاقة */}
              <div
                onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  const extraRows: OrderShareRow[] = metaEntries.map(m => ({ label: m.label, value: m.value }));
                  if (inventoryContent) extraRows.push({ label: "بيانات المنتج المُسلَّم", value: inventoryContent });
                  if (codes.length > 0) extraRows.push({ label: "أكواد التفعيل", value: codes.join(" / ") });
                  const { title, rows } = buildOrderShareData(order, extraRows);
                  setShareOrder({ title, rows, orderId: order.id });
                }}
                onTouchStart={(e) => {
                  const timer = setTimeout(() => {
                    const extraRows: OrderShareRow[] = metaEntries.map(m => ({ label: m.label, value: m.value }));
                    if (inventoryContent) extraRows.push({ label: "بيانات المنتج المُسلَّم", value: inventoryContent });
                    if (codes.length > 0) extraRows.push({ label: "أكواد التفعيل", value: codes.join(" / ") });
                    const { title, rows } = buildOrderShareData(order, extraRows);
                    setShareOrder({ title, rows, orderId: order.id });
                  }, 550);
                  const clear = () => clearTimeout(timer);
                  e.currentTarget.addEventListener('touchend', clear, { once: true });
                  e.currentTarget.addEventListener('touchmove', clear, { once: true });
                }}
                className="p-3.5 pt-5 flex items-center gap-2 cursor-pointer hover:bg-gray-50/70 transition-colors select-none"
              >
                {/* 1. أيقونة حالة الطلب + تسميتها تحتها */}
                <div className="flex flex-col items-center gap-1 shrink-0 w-12">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    isCompleted ? 'bg-green-50 text-green-600' :
                    isFailed ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
                  }`}>
                    {isCompleted ? <CheckCircle size={16} /> :
                     isFailed ? <XCircle size={16} /> : <Clock size={16} />}
                  </div>
                  <span className={`text-[9px] font-bold leading-none text-center ${
                    isCompleted ? 'text-green-600' :
                    isFailed ? 'text-red-500' : 'text-blue-500'
                  }`}>
                    {statusLabel}
                  </span>
                </div>

                {/* 2. اسم المنتج (أسود) وسعره (رمادي) تحته */}
                <div className="min-w-0 shrink-0 max-w-[38%]">
                  <p className="font-bold text-sm text-gray-900 truncate">{order.product_name}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">{order.total_amount} $</p>
                </div>

                {/* 3. مساحة فارغة بالمنتصف */}
                <div className="flex-1 min-w-0" />

                {/* 4. تفاصيل ثانوية صغيرة سطر تحت سطر */}
                <div className="flex flex-col items-end gap-0.5 shrink-0 text-left">
                  {isCompleted && formatResponseTime(order.response_time_seconds) && (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                      <Clock size={9} /> {formatResponseTime(order.response_time_seconds)}
                    </span>
                  )}
                  {order.admin_response && (
                    <span className={`flex items-center gap-1 text-[10px] font-bold ${isFailed ? 'text-red-500' : 'text-amber-600'}`}>
                      <MessageSquare size={9} /> يوجد رد
                    </span>
                  )}
                </div>

                {/* 5. رقم الطلب + السهم أقصى اليسار */}
                <div className="flex items-center gap-2 shrink-0 pl-0.5">
                  <span className="flex items-center gap-0.5 text-[10px] text-gray-400 font-bold">
                    <Hash size={9} />{order.id}
                  </span>
                  <ChevronDown size={16} className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </div>
              </div>

              {/* تفاصيل الطلب (عند التوسيع) */}
              {isExpanded && (
                <div className="px-4 pb-4 pt-3 border-t border-gray-100 space-y-3 bg-gray-50/60">

                  {/* معلومات أساسية */}
                  <div className="bg-white rounded-lg border border-gray-100 p-3">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-gray-400">رقم الطلب</p>
                        <p className="font-bold text-gray-700">#{order.id}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">تاريخ الطلب</p>
                        <p className="font-bold text-gray-700">{new Date(order.created_at).toLocaleString("ar-EG")}</p>
                      </div>
                      {isCompleted && formatResponseTime(order.response_time_seconds) && (
                        <div>
                          <p className="text-gray-400">مدة الاستجابة</p>
                          <p className="font-bold text-green-600">{formatResponseTime(order.response_time_seconds)}</p>
                        </div>
                      )}
                      {order.category_name && (
                        <div>
                          <p className="text-gray-400">القسم الرئيسي</p>
                          <p className="font-bold text-gray-700">{order.category_name}</p>
                        </div>
                      )}
                      {order.subcategory_name && (
                        <div>
                          <p className="text-gray-400">القسم الفرعي</p>
                          <p className="font-bold text-gray-700">{order.subcategory_name}</p>
                        </div>
                      )}
                      <div className="col-span-2">
                        <p className="text-gray-400">المنتج</p>
                        <p className="font-bold text-gray-700">{order.product_name}</p>
                      </div>
                      {orderedQty && (
                        <div>
                          <p className="text-gray-400">الكمية</p>
                          <p className="font-bold text-gray-700">{orderedQty}</p>
                        </div>
                      )}
                      {orderedQty && unitPrice !== undefined && unitPrice !== null && (
                        <div>
                          <p className="text-gray-400">سعر الوحدة</p>
                          <p className="font-bold text-gray-700">{formatPriceUSD(unitPrice)}</p>
                        </div>
                      )}
                      <div className="col-span-2 pt-1 border-t border-gray-50 flex items-center justify-between">
                        <span className="text-gray-400">الإجمالي</span>
                        <span className="font-bold text-brand text-sm">{formatPriceUSD(order.total_amount)}</span>
                      </div>
                    </div>
                  </div>

                  {/* بيانات الطلب المُدخلة من المستخدم */}
                  {metaEntries.length > 0 && (
                    <div className="bg-white rounded-lg border border-gray-100 p-3 space-y-2">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                        <Package size={12} /> تفاصيل الطلب
                      </p>
                      {metaEntries.map(({ label, value }, i) => (
                        <div key={i} className="flex justify-between items-center text-xs gap-2">
                          <span className="text-gray-500 shrink-0">{label}</span>
                          <span className="font-bold text-gray-700 text-left break-all">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* المنتج المُسلَّم من المخزون (inventory_delivered) */}
                  {inventoryContent && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-2">
                      <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
                        <KeyRound size={12} /> بيانات المنتج المُسلَّم
                      </p>
                      <div className="flex items-center justify-between gap-2 bg-white rounded-md p-2 border border-emerald-100">
                        <p className="font-mono font-bold text-emerald-800 text-sm break-all whitespace-pre-wrap">{inventoryContent}</p>
                        <button
                          onClick={() => { navigator.clipboard.writeText(inventoryContent); }}
                          className="shrink-0 text-[10px] bg-emerald-100 text-emerald-700 px-2 py-1 rounded-md font-bold active:scale-95"
                        >نسخ</button>
                      </div>
                    </div>
                  )}

                  {/* أكواد التفعيل القادمة من الـ API */}
                  {codes.length > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 space-y-2">
                      <p className="text-[10px] font-bold text-green-700 uppercase tracking-wider flex items-center gap-1">
                        <CheckCircle size={12} /> بيانات التفعيل
                      </p>
                      {codes.map((code, i) => (
                        <div key={i} className="flex items-center justify-between gap-2 bg-white rounded-md p-2 border border-green-100">
                          <p className="font-mono font-bold text-green-800 text-sm break-all">{code}</p>
                          <button
                            onClick={() => { navigator.clipboard.writeText(code); }}
                            className="shrink-0 text-[10px] bg-green-100 text-green-700 px-2 py-1 rounded-md font-bold active:scale-95"
                          >نسخ</button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* تحديث تلقائي لحالة الطلبات قيد المعالجة عبر API خارجي */}
                  {(order.status === 'processing' || order.status === 'pending') && (() => {
                    try {
                      const meta = JSON.parse(metaStr || "{}");
                      const pollId = meta.ahminix_order_uuid || meta.ahminix_order_id;
                      if (!pollId) return null;
                      return (
                        <OrderPollingStatus
                          externalOrderId={String(pollId)}
                          onStatusChange={() => { fetchOrders(); }}
                        />
                      );
                    } catch { return null; }
                  })()}

                  {/* رد الإدارة */}
                  {order.admin_response && (
                    <div className={`p-3 rounded-lg border-2 ${
                      isFailed ? 'bg-red-50 border-red-200' : isCompleted ? 'bg-green-50 border-green-200' : 'bg-brand-light border-brand-soft'
                    }`}>
                      <p className={`text-[11px] font-bold mb-1.5 flex items-center gap-1.5 ${
                        isFailed ? 'text-red-600' : isCompleted ? 'text-green-600' : 'text-brand'
                      }`}>
                        {isFailed ? <XCircle size={13} /> : isCompleted ? <CheckCircle size={13} /> : null}
                        {isFailed ? 'سبب الرفض' : 'رد الإدارة'}
                      </p>
                      <p className={`text-xs leading-relaxed whitespace-pre-wrap break-words ${
                        isFailed ? 'text-red-700' : isCompleted ? 'text-green-700' : 'text-brand'
                      }`}>{order.admin_response}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filteredOrders.length === 0 && (
          <div className="text-center py-16 space-y-4">
            <img
              src="https://i.ibb.co/0RmPLRqs/1000029984.png"
              alt="لا توجد طلبات"
              className="w-48 h-48 object-contain mx-auto"
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
            />
            <p className="text-gray-400">
              {hasDateFilter
                ? 'لا توجد طلبات في هذه الفترة'
                : filterStatus === 'all' ? 'لم تقم بأي طلبات بعد' : 'لا توجد طلبات في هذا التصنيف'}
            </p>
            {hasDateFilter && (
              <button onClick={clearDateFilter} className="text-brand font-bold text-sm">مسح فلتر التاريخ</button>
            )}
            {!hasDateFilter && filterStatus === 'all' && (
              <button onClick={() => setActiveTab("home")} className="text-brand font-bold">ابدأ التسوق الآن</button>
            )}
          </div>
        )}
      </div>

      {shareOrder && (
        <OrderShareModal
          open={!!shareOrder}
          onClose={() => setShareOrder(null)}
          title={shareOrder.title}
          rows={shareOrder.rows}
          orderId={shareOrder.orderId}
        />
      )}
    </div>
  );
}
