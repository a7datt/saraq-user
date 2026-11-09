import React, { useState } from "react";
import { ArrowRight, CheckCircle, XCircle, Clock, Copy, Share2, Download, Printer, ShieldCheck } from "lucide-react";
import { motion } from "motion/react";
import type { UiTokens } from "../pages/CheckoutPage";
import OrderPollingStatus from "./OrderPollingStatus";
import OptimizedImage from "./OptimizedImage";
import { showToast } from "./ToastContainer";
import {
  OrderShareRow,
  orderToImageBlob,
  downloadBlob,
  shareFile,
  buildShareText,
  printReceipt,
} from "../utils/orderShare";

/* ============================================================================
 * [REDESIGN v2] بطاقة نتيجة الطلب الموحّدة — هيدر متدرّج حسب حالة الطلب (أخضر
 * للنجاح، كهرماني لقيد المراجعة، أحمر للرفض) بدل لون الهوية الثابت، مع أيقونات
 * فقط (بلا أي إيموجي) وأنيميشن دخول احترافي (نبضة حلقة خلف أيقونة الحالة).
 * تدعم مشاركة/حفظ/نسخ/طباعة الإيصال كفاتورة.
 * ========================================================================== */

export interface OrderResultData {
  orderId: number | string;
  prod?: { name?: string; image_url?: string; [key: string]: any };
  externalOrderId?: string | null;
  externalStatus?: string;
  replayApi?: any[];
  note?: string | null;
  /** يُستخدم عند عدم وجود finalPrice دقيق محسوب بنفس مكان العرض (مثل الطلب السريع) */
  finalPriceOverride?: number;
}

interface OrderResultCardProps {
  orderResult: OrderResultData;
  finalPrice: number;
  fmtPrice: (usd: number, decimals?: number) => string;
  theme: any;
  ui: UiTokens;
  isModal: boolean;
  goBack: () => void;
  /** يصفّر حالة نتيجة الطلب بالمكوّن الأب (محلي أو عام) */
  onReset: () => void;
  setView: (v: any) => void;
  setActiveTab: (t: string) => void;
  onStatusUpdate?: (newStatus: string, replayApi: any[]) => void;
}

const STATUS_MAP: Record<string, { label: string; gradient: [string, string]; shareColor: "green" | "red" | "blue"; Icon: typeof CheckCircle }> = {
  accept: { label: "تم التنفيذ بنجاح", gradient: ["#16a34a", "#059669"], shareColor: "green", Icon: CheckCircle },
  completed: { label: "تم التنفيذ بنجاح", gradient: ["#16a34a", "#059669"], shareColor: "green", Icon: CheckCircle },
  processing: { label: "قيد المعالجة", gradient: ["#f59e0b", "#b45309"], shareColor: "blue", Icon: Clock },
  pending: { label: "قيد المعالجة", gradient: ["#f59e0b", "#b45309"], shareColor: "blue", Icon: Clock },
  reject: { label: "تم الرفض", gradient: ["#ef4444", "#b91c1c"], shareColor: "red", Icon: XCircle },
  rejected: { label: "تم الرفض", gradient: ["#ef4444", "#b91c1c"], shareColor: "red", Icon: XCircle },
  cancelled: { label: "تم الرفض", gradient: ["#ef4444", "#b91c1c"], shareColor: "red", Icon: XCircle },
};

const OrderResultCard = ({
  orderResult, finalPrice, fmtPrice, theme, ui, isModal, goBack, onReset, setView, setActiveTab, onStatusUpdate,
}: OrderResultCardProps) => {
  const [busy, setBusy] = useState<"share" | "save" | null>(null);
  const st = (orderResult.externalStatus || "").toLowerCase();
  const s = STATUS_MAP[st] || STATUS_MAP["processing"];
  const isFinal = st === "accept" || st === "completed" || st === "reject" || st === "rejected" || st === "cancelled";
  const displayPrice = orderResult.finalPriceOverride ?? finalPrice;
  const StatusIcon = s.Icon;

  const codes: string[] = (orderResult.replayApi || [])
    .map((x: any) => {
      if (!x) return null;
      if (typeof x === "string") return x.trim() || null;
      if (typeof x === "number") return String(x);
      if (typeof x === "object") {
        const v = x.replay ?? x.code ?? x.value ?? x.key ?? x.data ?? null;
        return v !== null ? String(v) : null;
      }
      return String(x);
    })
    .filter(Boolean) as string[];

  const productName = orderResult.prod?.name || "";
  const productImage = orderResult.prod?.image_url;

  const buildRows = (): OrderShareRow[] => {
    const rows: OrderShareRow[] = [
      { label: "رقم الطلب", value: `#${orderResult.orderId}` },
      ...(productName ? [{ label: "المنتج", value: productName }] : []),
      { label: "الحالة", value: s.label, color: s.shareColor },
      { label: "المبلغ المدفوع", value: fmtPrice(displayPrice) },
    ];
    if (orderResult.externalOrderId) rows.push({ label: "رقم الطلب الخارجي", value: String(orderResult.externalOrderId) });
    codes.forEach((c, i) => rows.push({ label: codes.length > 1 ? `الكود ${i + 1}` : "الكود", value: c, color: "green" }));
    return rows;
  };

  const receiptTitle = () => `إيصال الطلب #${orderResult.orderId}`;

  const handleShare = async () => {
    if (busy) return;
    setBusy("share");
    try {
      const rows = buildRows();
      const blob = await orderToImageBlob(receiptTitle(), rows, s.gradient);
      const filename = `order-${orderResult.orderId}.png`;
      const shared = await shareFile(blob, filename, receiptTitle(), buildShareText(receiptTitle(), rows));
      if (!shared) downloadBlob(blob, filename);
    } catch {
      showToast("تعذّرت مشاركة الإيصال", "error");
    } finally {
      setBusy(null);
    }
  };

  const handleSave = async () => {
    if (busy) return;
    setBusy("save");
    try {
      const rows = buildRows();
      const blob = await orderToImageBlob(receiptTitle(), rows, s.gradient);
      downloadBlob(blob, `order-${orderResult.orderId}.png`);
      showToast("تم حفظ الإيصال كصورة", "success");
    } catch {
      showToast("تعذّر حفظ الإيصال", "error");
    } finally {
      setBusy(null);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildShareText(receiptTitle(), buildRows()));
      showToast("تم نسخ تفاصيل الطلب", "success");
    } catch {
      showToast("تعذّر النسخ", "error");
    }
  };

  const handlePrint = () => {
    printReceipt(receiptTitle(), buildRows(), s.gradient);
  };

  const goHome = () => { onReset(); setView({ type: "main" }); setActiveTab("home"); };
  const goOrders = () => { onReset(); setActiveTab("orders"); setView({ type: "main" }); };

  const actionBtnCls = `flex flex-col items-center gap-1 py-2.5 rounded-2xl border ${ui.border} ${ui.mutedStrong} text-[10.5px] font-bold active:scale-95 transition-transform disabled:opacity-50`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={`overflow-hidden rounded-3xl ${isModal ? "" : "min-h-screen"} ${ui.dark ? "shadow-none" : "shadow-xl"}`}
    >
      <div className="max-w-sm mx-auto">
        {/* ===== هيدر متدرّج حسب الحالة ===== */}
        <div
          className="relative px-6 pt-7 pb-14 text-center"
          style={{ background: `linear-gradient(135deg, ${s.gradient[0]}, ${s.gradient[1]})` }}
        >
          <button onClick={goBack} className="absolute top-4 right-4 p-2 rounded-full bg-white/15 text-white active:scale-90 transition-transform">
            <ArrowRight size={18} />
          </button>

          <div className="relative mx-auto w-20 h-20 mt-2">
            <motion.div
              className="absolute inset-0 rounded-full bg-white"
              initial={{ scale: 1, opacity: 0.35 }}
              animate={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
            />
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.05 }}
              className="relative w-20 h-20 rounded-full bg-white flex items-center justify-center shadow-lg"
            >
              <StatusIcon size={36} style={{ color: s.gradient[0] }} strokeWidth={2.2} />
            </motion.div>
          </div>

          <h2 className="text-white font-bold text-base mt-4">{s.label}</h2>
          <p className="text-white/80 text-xs mt-1">رقم الطلب #{orderResult.orderId}</p>
        </div>

        {/* ===== جسم البطاقة ===== */}
        <div className={`${ui.bg} relative -mt-7 rounded-t-3xl px-5 pt-6 pb-6 flex flex-col items-center text-center gap-4`}>
          {productImage && (
            <div className={`w-14 h-14 rounded-2xl overflow-hidden border ${ui.border} -mt-1`}>
              <OptimizedImage src={productImage} width={112} height={112} alt={productName} className="w-full h-full object-cover" />
            </div>
          )}
          {productName && <h3 className={`text-sm font-bold ${ui.text}`}>{productName}</h3>}

          {orderResult.note && (
            <p className={`text-xs -mt-2 ${ui.mutedStrong}`}>{orderResult.note}</p>
          )}

          {codes.length > 0 && (
            <div className={`w-full rounded-2xl p-4 space-y-2.5 text-right border ${ui.dark ? "bg-green-500/5 border-green-500/20" : "bg-green-50 border-green-200"}`}>
              <p className={`text-sm font-bold flex items-center gap-2 justify-center ${ui.dark ? "text-green-400" : "text-green-800"}`}>
                <ShieldCheck size={15} /> بيانات التفعيل
              </p>
              {codes.map((code: string, i: number) => (
                <div key={i} className={`flex items-center justify-between gap-3 rounded-xl p-3 border ${ui.dark ? "bg-zinc-900 border-green-500/10" : "bg-white border-green-100"}`}>
                  <p className={`font-mono font-bold text-sm break-all ${ui.dark ? "text-green-400" : "text-green-800"}`}>{code}</p>
                  <button onClick={() => { navigator.clipboard.writeText(code); showToast("تم النسخ", "success"); }} className="shrink-0 bg-green-500 text-white px-3 py-1.5 rounded-lg text-xs font-bold active:scale-95 flex items-center gap-1">
                    <Copy size={12} /> نسخ
                  </button>
                </div>
              ))}
              <p className={`text-[11px] ${ui.dark ? "text-green-500/60" : "text-green-600"}`}>احتفظ بهذه البيانات في مكان آمن</p>
            </div>
          )}

          {!isFinal && orderResult.externalOrderId && (
            <div className="w-full">
              <OrderPollingStatus
                externalOrderId={orderResult.externalOrderId}
                onStatusChange={(newStatus: string, replayApi: any[]) => onStatusUpdate && onStatusUpdate(newStatus, replayApi)}
              />
            </div>
          )}

          <div className="w-full flex items-center justify-between text-sm px-1">
            <span className={ui.muted}>المبلغ المدفوع</span>
            <span className={`font-bold ${theme.text}`}>{fmtPrice(displayPrice)}</span>
          </div>
          {orderResult.externalOrderId && (
            <div className="w-full flex items-center justify-between text-sm px-1 -mt-3">
              <span className={ui.muted}>رقم الطلب الخارجي</span>
              <span className={`text-xs ${ui.mutedStrong}`}>{orderResult.externalOrderId}</span>
            </div>
          )}

          {/* ===== مشاركة / حفظ / نسخ / طباعة كفاتورة ===== */}
          <div className="w-full grid grid-cols-4 gap-2 pt-1">
            <button onClick={handleShare} disabled={busy !== null} className={actionBtnCls}>
              <Share2 size={16} /> مشاركة
            </button>
            <button onClick={handleSave} disabled={busy !== null} className={actionBtnCls}>
              <Download size={16} /> حفظ
            </button>
            <button onClick={handleCopy} className={actionBtnCls}>
              <Copy size={16} /> نسخ
            </button>
            <button onClick={handlePrint} className={actionBtnCls}>
              <Printer size={16} /> طباعة
            </button>
          </div>

          <div className="w-full flex gap-3 pt-1">
            <button onClick={goHome} className={`flex-1 border ${ui.border} ${ui.mutedStrong} py-3.5 rounded-full font-bold`}>
              الرئيسية
            </button>
            <button onClick={goOrders} className={`flex-1 ${theme.button} text-white py-3.5 rounded-full font-bold`}>
              طلباتي
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default OrderResultCard;
