import { useState } from "react";
import type { ReactNode } from "react";
import { X, Image as ImageIcon, FileSpreadsheet, FileText, Share2, MessageCircle, CheckCircle2 } from "lucide-react";
import {
  OrderShareRow,
  orderToImageBlob,
  paymentToImageBlob,
  orderToCsvBlob,
  orderToPdfBlob,
  downloadBlob,
  shareFile,
  shareViaWhatsApp,
  buildShareText,
} from "../utils/orderShare";

interface OrderShareModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  rows: OrderShareRow[];
  orderId: number;
  /** نوع البطاقة: طلب (بنفسجي) أو دفعة (أخضر) - يغيّر تصميم الصورة والـPDF */
  variant?: "order" | "payment";
}

type ShareFormat = "image" | "csv" | "pdf";

export default function OrderShareModal({ open, onClose, title, rows, orderId, variant = "order" }: OrderShareModalProps) {
  const [busyFormat, setBusyFormat] = useState<ShareFormat | null>(null);
  const [readyBlob, setReadyBlob] = useState<{ blob: Blob; filename: string; format: ShareFormat } | null>(null);

  if (!open) return null;

  const accent = variant === "payment"
    ? { light: "bg-green-50", border: "border-green-500", text: "text-green-600", btn: "bg-green-600" }
    : { light: "bg-brand-light", border: "border-brand", text: "text-brand", btn: "bg-brand" };

  const idPrefix = variant === "payment" ? "payment" : "order";

  const formats: { key: ShareFormat; label: string; icon: ReactNode; desc: string }[] = [
    { key: "image", label: "صورة", icon: <ImageIcon size={20} />, desc: "بطاقة PNG جاهزة للمشاركة" },
    { key: "csv", label: "CSV", icon: <FileSpreadsheet size={20} />, desc: "ملف بيانات لإكسل" },
    { key: "pdf", label: "PDF", icon: <FileText size={20} />, desc: "مستند قابل للطباعة" },
  ];

  const generate = async (format: ShareFormat) => {
    setBusyFormat(format);
    setReadyBlob(null);
    try {
      let blob: Blob;
      let filename: string;
      if (format === "image") {
        blob = variant === "payment" ? await paymentToImageBlob(title, rows) : await orderToImageBlob(title, rows);
        filename = `${idPrefix}-${orderId}.png`;
      } else if (format === "csv") {
        blob = orderToCsvBlob(title, rows);
        filename = `${idPrefix}-${orderId}.csv`;
      } else {
        blob = await orderToPdfBlob(title, rows, variant === "payment" ? "green" : "purple");
        filename = `${idPrefix}-${orderId}.html`;
      }
      downloadBlob(blob, filename);
      setReadyBlob({ blob, filename, format });
    } catch {
      // فشل صامت مع إبقاء الواجهة سليمة
    } finally {
      setBusyFormat(null);
    }
  };

  const handleShareFile = async () => {
    if (!readyBlob) return;
    const text = buildShareText(title, rows);
    const shared = await shareFile(readyBlob.blob, readyBlob.filename, title, text);
    if (!shared) {
      // fallback: مشاركة نصية عبر واتساب إن تعذرت مشاركة الملف
      shareViaWhatsApp(text);
    }
  };

  const handleShareWhatsApp = () => {
    const text = buildShareText(title, rows);
    shareViaWhatsApp(text);
  };

  const handleNativeShareGeneral = async () => {
    const text = buildShareText(title, rows);
    const nav = navigator as any;
    if (nav.share) {
      try {
        await nav.share({ title, text });
        return;
      } catch {
        // تجاهل الإلغاء
      }
    }
    shareViaWhatsApp(text);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      dir="rtl"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl p-5 space-y-4 animate-in slide-in-from-bottom"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-800 text-base">
            {variant === "payment" ? `مشاركة الدفعة #TX${orderId}` : `مشاركة الطلب #${orderId}`}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-full bg-gray-100 text-gray-500 active:scale-95">
            <X size={16} />
          </button>
        </div>

        <p className="text-xs text-gray-400">اختر صيغة التنزيل، ثم شارك الملف مباشرة بعد التنزيل.</p>

        <div className="grid grid-cols-3 gap-2">
          {formats.map(f => (
            <button
              key={f.key}
              onClick={() => generate(f.key)}
              disabled={busyFormat !== null}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-center transition-all active:scale-95 ${
                readyBlob?.format === f.key
                  ? `${accent.light} ${accent.border} ${accent.text}`
                  : "bg-gray-50 border-gray-100 text-gray-600"
              } disabled:opacity-60`}
            >
              {busyFormat === f.key ? (
                <div className="w-5 h-5 border-2 border-gray-300 border-t-brand rounded-full animate-spin" />
              ) : readyBlob?.format === f.key ? (
                <CheckCircle2 size={20} />
              ) : (
                f.icon
              )}
              <span className="text-[11px] font-bold">{f.label}</span>
              <span className="text-[9px] text-gray-400 leading-tight">{f.desc}</span>
            </button>
          ))}
        </div>

        {readyBlob && (
          <div className="space-y-2 pt-1">
            <p className="text-[11px] text-green-600 font-bold flex items-center gap-1">
              <CheckCircle2 size={13} /> تم تنزيل الملف، يمكنك الآن مشاركته
            </p>
            <button
              onClick={handleShareFile}
              className={`w-full flex items-center justify-center gap-2 ${accent.btn} text-white font-bold py-3 rounded-xl active:scale-95 transition-all`}
            >
              <Share2 size={16} /> مشاركة الملف ({formats.find(f => f.key === readyBlob.format)?.label})
            </button>
          </div>
        )}

        <div className="flex gap-2 pt-1 border-t border-gray-100">
          <button
            onClick={handleShareWhatsApp}
            className="flex-1 flex items-center justify-center gap-1.5 bg-green-50 text-green-700 font-bold py-2.5 rounded-xl text-xs active:scale-95 transition-all"
          >
            <MessageCircle size={15} /> واتساب
          </button>
          <button
            onClick={handleNativeShareGeneral}
            className="flex-1 flex items-center justify-center gap-1.5 bg-gray-100 text-gray-700 font-bold py-2.5 rounded-xl text-xs active:scale-95 transition-all"
          >
            <Share2 size={15} /> مشاركة عامة
          </button>
        </div>
      </div>
    </div>
  );
}
