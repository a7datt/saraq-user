import { UserNameBar } from "../components/VerifiedBadge";
import React, { useState, useMemo } from "react";
import {
  ArrowRight, CheckCircle, ChevronDown, Clock, XCircle,
  History, X, CalendarDays, ArrowDownCircle, ArrowUpCircle, Share2,
} from "lucide-react";
import { Transaction, Order } from "../types";
import OptimizedImage from "../components/OptimizedImage";
import OrderShareModal from "../components/OrderShareModal";
import { buildPaymentShareData, OrderShareRow } from "../utils/orderShare";

const parseCustomFieldsData = (raw: any): Array<{ key?: string; label: string; value: string; required?: boolean; isDefault?: boolean; type?: string }> => {
  try {
    if (!raw) return [];
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};

const toIsoDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// ===================== نوع موحّد لسجل الحركات (شحن دخول + طلبات خروج) =====================
type LedgerEntry = {
  id: string;
  kind: 'in' | 'out';
  date: string;
  amount: number;
  title: string;
  subtitle: string;
  status: string;
  statusLabel: string;
  statusColor: string;
};

function buildLedger(transactions: Transaction[], orders: Order[]): LedgerEntry[] {
  const inEntries: LedgerEntry[] = transactions.map(t => ({
    id: `tx-${t.id}`,
    kind: 'in',
    date: t.created_at,
    amount: t.amount,
    title: `شحن رصيد عبر ${t.method_name}`,
    subtitle: t.status === 'approved' ? 'تمت إضافة الرصيد' : t.status === 'rejected' ? 'تم رفض عملية الشحن' : 'بانتظار التحقق من العملية',
    status: t.status,
    statusLabel: t.status === 'approved' ? 'مقبولة' : t.status === 'rejected' ? 'مرفوضة' : 'قيد التحقق',
    statusColor: t.status === 'approved' ? 'text-green-600 bg-green-50' : t.status === 'rejected' ? 'text-red-600 bg-red-50' : 'text-orange-600 bg-orange-50',
  }));
  const outEntries: LedgerEntry[] = orders.map(o => ({
    id: `ord-${o.id}`,
    kind: 'out',
    date: o.created_at,
    amount: o.total_amount,
    title: o.product_name,
    subtitle: [o.category_name, o.subcategory_name].filter(Boolean).join(" • ") || "طلب شراء",
    status: o.status,
    statusLabel: o.status === 'completed' ? 'مكتمل' : (o.status === 'failed' || o.status === 'cancelled') ? 'ملغي' : o.status === 'pending_admin' ? 'ينتظر الموافقة' : 'قيد المعالجة',
    statusColor: o.status === 'completed' ? 'text-green-600 bg-green-50' : (o.status === 'failed' || o.status === 'cancelled') ? 'text-red-600 bg-red-50' : 'text-blue-600 bg-blue-50',
  }));
  return [...inEntries, ...outEntries].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// ===================== مودال سجل الدفعات والرصيد (تتبع كامل) =====================
interface LedgerModalProps {
  transactions: Transaction[];
  orders: Order[];
  onClose: () => void;
}

const LedgerModal: React.FC<LedgerModalProps> = ({ transactions, orders, onClose }) => {
  const [kindFilter, setKindFilter] = useState<'all' | 'in' | 'out'>('all');
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const hasDateFilter = !!(dateFrom || dateTo);

  const allEntries = useMemo(() => buildLedger(transactions, orders), [transactions, orders]);

  const filtered = useMemo(() => allEntries.filter(e => {
    if (kindFilter !== 'all' && e.kind !== kindFilter) return false;
    if (dateFrom || dateTo) {
      const iso = toIsoDate(new Date(e.date));
      if (dateFrom && iso < dateFrom) return false;
      if (dateTo && iso > dateTo) return false;
    }
    return true;
  }), [allEntries, kindFilter, dateFrom, dateTo]);

  const totalIn = useMemo(() => allEntries.filter(e => e.kind === 'in' && e.status === 'approved').reduce((s, e) => s + Number(e.amount), 0), [allEntries]);
  const totalOut = useMemo(() => allEntries.filter(e => e.kind === 'out' && e.status === 'completed').reduce((s, e) => s + Number(e.amount), 0), [allEntries]);

  const clearDateFilter = () => { setDateFrom(""); setDateTo(""); };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[88vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom"
      >
        {/* رأس المودال */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-brand-light rounded-lg flex items-center justify-center text-brand"><History size={18} /></div>
            <h3 className="font-bold text-lg text-gray-800">سجل الدفعات والرصيد</h3>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full active:scale-95">
            <X size={18} className="text-gray-600" />
          </button>
        </div>

        {/* ملخص الرصيد الداخل والخارج */}
        <div className="grid grid-cols-2 gap-2 px-4 pt-4 shrink-0">
          <div className="bg-brand-light/40 border border-brand-soft rounded-lg p-3 flex items-center gap-2">
            <ArrowDownCircle size={20} className="text-brand shrink-0" />
            <div>
              <p className="text-[10px] text-brand/70 font-bold">إجمالي الرصيد المشحون</p>
              <p className="text-sm font-black text-brand">{totalIn.toFixed(3)} $</p>
            </div>
          </div>
          <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 flex items-center gap-2">
            <ArrowUpCircle size={20} className="text-gray-500 shrink-0" />
            <div>
              <p className="text-[10px] text-gray-400 font-bold">إجمالي الرصيد المصروف</p>
              <p className="text-sm font-black text-gray-700">{totalOut.toFixed(3)} $</p>
            </div>
          </div>
        </div>

        {/* الفلاتر */}
        <div className="px-4 pt-3 space-y-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar flex-1">
              {[
                { key: 'all', label: 'الكل' },
                { key: 'in', label: 'دخول رصيد' },
                { key: 'out', label: 'خروج / شراء' },
              ].map(f => (
                <button
                  key={f.key}
                  onClick={() => setKindFilter(f.key as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap border transition-all active:scale-95 ${
                    kindFilter === f.key ? 'bg-gray-800 text-white border-transparent' : 'bg-white border-gray-100 text-gray-500'
                  }`}
                >{f.label}</button>
              ))}
            </div>
            <button
              onClick={() => setShowDatePicker(v => !v)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold border shrink-0 active:scale-95 ${
                hasDateFilter ? 'bg-brand text-white border-transparent' : 'bg-white border-gray-100 text-gray-500'
              }`}
            >
              <CalendarDays size={13} />
            </button>
          </div>

          {showDatePicker && (
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-2.5 flex items-center gap-2">
              <div className="flex-1 space-y-1">
                <label className="text-[10px] font-bold text-gray-400">من</label>
                <input type="date" value={dateFrom} max={dateTo || undefined} onChange={e => setDateFrom(e.target.value)}
                  className="w-full bg-white border border-gray-100 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-brand" />
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-[10px] font-bold text-gray-400">حتى</label>
                <input type="date" value={dateTo} min={dateFrom || undefined} onChange={e => setDateTo(e.target.value)}
                  className="w-full bg-white border border-gray-100 rounded-lg px-2 py-1.5 text-xs outline-none focus:border-brand" />
              </div>
              {hasDateFilter && (
                <button onClick={clearDateFilter} className="self-end mb-0.5 p-1.5 bg-gray-100 rounded-lg text-gray-500 active:scale-95 shrink-0">
                  <X size={14} />
                </button>
              )}
            </div>
          )}
        </div>

        {/* قائمة الحركات بالترتيب الزمني */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5">
          {filtered.length === 0 && (
            <div className="text-center py-16 text-gray-400 text-sm">لا توجد حركات مطابقة</div>
          )}
          {filtered.map(entry => (
            <div key={entry.id} className="flex items-center gap-3 bg-white border border-gray-100 rounded-lg p-3 shadow-sm">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                entry.kind === 'in' ? 'bg-brand-light text-brand' : 'bg-gray-100 text-gray-500'
              }`}>
                {entry.kind === 'in' ? <ArrowDownCircle size={18} /> : <ArrowUpCircle size={18} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-gray-800 truncate">{entry.title}</p>
                <p className="text-[11px] text-gray-400 truncate">{entry.subtitle}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{new Date(entry.date).toLocaleString("ar-EG")}</p>
              </div>
              <div className="text-left shrink-0">
                <p className={`font-bold text-sm ${entry.kind === 'in' ? 'text-brand' : 'text-gray-700'}`}>
                  {entry.kind === 'in' ? '+' : '-'}{entry.amount} $
                </p>
                <span className={`inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${entry.statusColor}`}>
                  {entry.statusLabel}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
// ===================== END LEDGER MODAL =====================

export interface PaymentsPageProps {
  user?: { name?: string; identity_verified?: boolean } | null;
  setView: (val: any) => void;
  transactions: Transaction[];
  orders?: Order[];
}

const PaymentsPage = ({ setView, transactions, orders = [], user }: PaymentsPageProps) => {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<'approved' | 'pending' | 'rejected'>('approved');
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showLedger, setShowLedger] = useState(false);
  const hasDateFilter = !!(dateFrom || dateTo);
  const [shareTx, setShareTx] = useState<{ title: string; rows: OrderShareRow[]; txId: number } | null>(null);

  const approvedCount = transactions.filter(t => t.status === 'approved').length;
  const pendingCount  = transactions.filter(t => t.status !== 'approved' && t.status !== 'rejected').length;
  const rejectedCount = transactions.filter(t => t.status === 'rejected').length;

  const filters: { key: 'approved' | 'pending' | 'rejected'; label: string; count?: number; color: string }[] = [
    { key: 'approved', label: 'مقبولة',       count: approvedCount, color: 'bg-green-500 text-white' },
    { key: 'pending',  label: 'قيد التحقق',   count: pendingCount,  color: 'bg-orange-500 text-white' },
    { key: 'rejected', label: 'مرفوضة',       count: rejectedCount, color: 'bg-red-500 text-white' },
  ];

  const clearDateFilter = () => { setDateFrom(""); setDateTo(""); };

  const filteredTransactions = useMemo(() => transactions.filter(t => {
    if (statusFilter === 'approved' && t.status !== 'approved') return false;
    if (statusFilter === 'rejected' && t.status !== 'rejected') return false;
    if (statusFilter === 'pending' && (t.status === 'approved' || t.status === 'rejected')) return false;
    if (dateFrom || dateTo) {
      const iso = toIsoDate(new Date(t.created_at));
      if (dateFrom && iso < dateFrom) return false;
      if (dateTo && iso > dateTo) return false;
    }
    return true;
  }), [transactions, statusFilter, dateFrom, dateTo]);

  return (
    <div className="px-4 space-y-4 pb-20">
      <UserNameBar user={user} />
      {/* رأس الصفحة */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <button onClick={() => setView({ type: "main" })} className="p-2 bg-gray-100 rounded-full active:scale-95">
            <ArrowRight size={20} className="text-gray-600" />
          </button>
          <h2 className="text-2xl font-bold text-gray-800">دفعاتي</h2>
        </div>
        <button
          onClick={() => setShowLedger(true)}
          className="flex items-center gap-1.5 bg-brand text-white px-3 py-2 rounded-lg text-xs font-bold shadow-sm active:scale-95"
        >
          <History size={14} /> سجل الدفعات
        </button>
      </div>

      {/* فلترة الحالة + التاريخ */}
      <div className="flex items-center gap-2">
        <div className="flex gap-2 overflow-x-auto no-scrollbar flex-1">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => { setStatusFilter(f.key); setExpandedId(null); }}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-all active:scale-95 border ${
                statusFilter === f.key ? f.color + ' border-transparent shadow-sm' : 'bg-white border-gray-100 text-gray-500'
              }`}
            >
              {f.label}
              {f.count !== undefined && (
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                  statusFilter === f.key ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-600'
                }`}>{f.count}</span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowDatePicker(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition-all active:scale-95 shrink-0 ${
            hasDateFilter ? 'bg-brand text-white border-transparent shadow-sm' : 'bg-white border-gray-100 text-gray-500'
          }`}
        >
          <CalendarDays size={14} />
        </button>
      </div>

      {/* منتقي فترة التاريخ */}
      {showDatePicker && (
        <div className="bg-white border border-gray-100 rounded-lg p-3 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="flex-1 space-y-1">
              <label className="text-[10px] font-bold text-gray-400">من</label>
              <input type="date" value={dateFrom} max={dateTo || undefined} onChange={e => { setDateFrom(e.target.value); setExpandedId(null); }}
                className="w-full bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand" />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-[10px] font-bold text-gray-400">حتى</label>
              <input type="date" value={dateTo} min={dateFrom || undefined} onChange={e => { setDateTo(e.target.value); setExpandedId(null); }}
                className="w-full bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand" />
            </div>
            {hasDateFilter && (
              <button onClick={clearDateFilter} className="self-end p-2 mb-0.5 bg-gray-100 rounded-lg text-gray-500 active:scale-95 shrink-0">
                <X size={16} />
              </button>
            )}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {filteredTransactions.map(t => (
          <div key={t.id} className="relative bg-white rounded-lg border border-gray-100 overflow-hidden shadow-sm">
            <button
              onClick={(e) => {
                e.stopPropagation();
                const { title, rows } = buildPaymentShareData(t);
                setShareTx({ title, rows, txId: t.id });
              }}
              className="absolute top-2 left-2 z-10 p-1 text-gray-300 hover:text-green-600 active:scale-95 transition-colors"
              aria-label="مشاركة الدفعة"
            >
              <Share2 size={13} />
            </button>
            <div
              onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                const { title, rows } = buildPaymentShareData(t);
                setShareTx({ title, rows, txId: t.id });
              }}
              onTouchStart={(e) => {
                const timer = setTimeout(() => {
                  const { title, rows } = buildPaymentShareData(t);
                  setShareTx({ title, rows, txId: t.id });
                }, 550);
                const clear = () => clearTimeout(timer);
                e.currentTarget.addEventListener('touchend', clear, { once: true });
                e.currentTarget.addEventListener('touchmove', clear, { once: true });
              }}
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors select-none"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  t.status === 'approved' ? 'bg-green-50 text-green-600' : 
                  t.status === 'rejected' ? 'bg-red-50 text-red-600' : 'bg-orange-50 text-orange-600'
                }`}>
                  {t.status === 'approved' ? <CheckCircle size={20} /> : 
                   t.status === 'rejected' ? <XCircle size={20} /> : <Clock size={20} />}
                </div>
                <div>
                  <p className="font-bold text-sm text-gray-800">{t.method_name}</p>
                  <p className="text-[10px] text-gray-400">{new Date(t.created_at).toLocaleDateString("ar-EG")}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-left">
                  <p className="font-bold text-brand">+{t.amount} $</p>
                  <p className={`text-[10px] font-medium ${
                    t.status === 'approved' ? 'text-green-600' : 
                    t.status === 'rejected' ? 'text-red-500' : 'text-orange-500'
                  }`}>
                    {t.status === 'approved' ? 'مقبولة' : t.status === 'rejected' ? 'مرفوضة' : 'قيد التحقق'}
                  </p>
                </div>
                <ChevronDown size={16} className={`text-gray-400 transition-transform ${expandedId === t.id ? 'rotate-180' : ''}`} />
              </div>
            </div>
            
            {expandedId === t.id && (
              <div className="px-4 pb-4 pt-2 border-t border-gray-50 space-y-3 bg-gray-50/50">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400 text-xs">رقم العملية</p>
                    <p className="font-bold text-gray-700">#TX{t.id}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">تاريخ الطلب</p>
                    <p className="font-bold text-gray-700">{new Date(t.created_at).toLocaleString("ar-EG")}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">طريقة الشحن</p>
                    <p className="font-bold text-gray-700">{t.method_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-xs">المبلغ</p>
                    <p className="font-bold text-brand">{t.amount} $</p>
                  </div>
                </div>
                {t.bonus_type && t.bonus_percent ? (() => {
                  // في "قيد التحقق"/"مرفوضة" لم تُطبَّق العمولة بعد على amount — فهو نفسه المبلغ الأصلي،
                  // ونحسب "المتوقع بعد العمولة" هنا للعرض فقط. أما في "مكتملة" فالعمولة مُطبَّقة فعلياً.
                  const isApproved = t.status === "approved";
                  const pct = Number(t.bonus_percent) || 0;
                  const baseAmount = isApproved ? Number(t.original_amount ?? t.amount) : Number(t.amount || 0);
                  const finalAmount = isApproved
                    ? Number(t.amount || 0)
                    : (t.bonus_type === "bonus" ? baseAmount * (1 + pct / 100) : baseAmount * (1 - pct / 100));
                  const diff = Math.abs(finalAmount - baseAmount);
                  return (
                    <div className={`rounded-lg p-3 border ${t.bonus_type === "bonus" ? "bg-green-50 border-green-100" : "bg-red-50 border-red-100"}`}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-500 font-bold">المبلغ الأصلي</span>
                        <span className="font-bold text-gray-700">{baseAmount.toFixed(3)} $</span>
                      </div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className={`font-bold ${t.bonus_type === "bonus" ? "text-green-600" : "text-red-500"}`}>
                          {t.bonus_type === "bonus" ? `🎁 بونص ${t.bonus_percent}%` : `⚠️ عمولة ${t.bonus_percent}%`}
                        </span>
                        <span className={`font-bold ${t.bonus_type === "bonus" ? "text-green-600" : "text-red-500"}`}>
                          {t.bonus_type === "bonus" ? "+" : "-"}{diff.toFixed(3)} $
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-black/5">
                        <span className="text-gray-600 font-bold">{isApproved ? "المبلغ المشحون فعلياً" : "المبلغ المتوقع بعد الاعتماد"}</span>
                        <span className="font-black text-brand">{finalAmount.toFixed(3)} $</span>
                      </div>
                    </div>
                  );
                })() : null}
                {(() => {
                  const fields = parseCustomFieldsData(t.custom_fields_data);
                  if (fields.length > 0) {
                    return fields.filter(f => (f.value || "").trim()).map((f, idx) => (
                      f.type === "image" ? (
                        <div key={idx}>
                          <p className="text-gray-400 text-xs mb-2">{f.label}</p>
                          <div className="w-full h-48 bg-white rounded-md border border-gray-200 overflow-hidden">
                            <OptimizedImage src={f.value} width={600} quality={85} alt={f.label} className="w-full h-full object-contain" onClick={() => window.open(f.value, '_blank')} />
                          </div>
                        </div>
                      ) : (
                        <div key={idx}>
                          <p className="text-gray-400 text-xs">{f.label}</p>
                          <p className="text-gray-700 text-sm">{f.value}</p>
                        </div>
                      )
                    ));
                  }
                  return (
                    <>
                      {t.note && (
                        <div>
                          <p className="text-gray-400 text-xs">ملاحظات</p>
                          <p className="text-gray-700 text-sm">{t.note.replace(/\[sam-api\]\s*-?\s*/gi, "")}</p>
                        </div>
                      )}
                      {t.receipt_image_url && (
                        <div>
                          <p className="text-gray-400 text-xs mb-2">صورة الإيصال</p>
                          <div className="w-full h-48 bg-white rounded-md border border-gray-200 overflow-hidden">
                            <OptimizedImage
                              src={t.receipt_image_url}
                              width={600}
                              quality={85}
                              alt="Receipt"
                              className="w-full h-full object-contain"
                              onClick={() => window.open(t.receipt_image_url, '_blank')}
                            />
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        ))}
        {filteredTransactions.length === 0 && (
          <div className="text-center py-20 space-y-4">
            <img
              src="https://i.ibb.co/GQXdcZ6W/1000030618-removebg-preview.png"
              alt="لا توجد عمليات دفع"
              className="w-36 h-36 object-contain mx-auto"
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              draggable={false}
              onDragStart={e => e.preventDefault()}
              onContextMenu={e => e.preventDefault()}
            />
            <p className="text-gray-400">
              {hasDateFilter ? 'لا توجد عمليات دفع في هذه الفترة' : 'لا توجد عمليات دفع في هذا التصنيف'}
            </p>
            {hasDateFilter && (
              <button onClick={clearDateFilter} className="text-brand font-bold text-sm">مسح فلتر التاريخ</button>
            )}
          </div>
        )}
      </div>

      {showLedger && (
        <LedgerModal transactions={transactions} orders={orders} onClose={() => setShowLedger(false)} />
      )}

      {shareTx && (
        <OrderShareModal
          open={!!shareTx}
          onClose={() => setShareTx(null)}
          title={shareTx.title}
          rows={shareTx.rows}
          orderId={shareTx.txId}
          variant="payment"
        />
      )}
    </div>
  );
};

export default PaymentsPage;
