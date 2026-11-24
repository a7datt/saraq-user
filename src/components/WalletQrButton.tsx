import React from "react";
import { QrCode, X, Lock } from "lucide-react";
import QRCode from "qrcode";

interface WalletQrButtonProps {
  /** عنوان المحفظة الذي سيُحوَّل إلى QR */
  address?: string | null;
  /** هل فعّل الأدمن الـ QR لطريقة الدفع هذه */
  enabled?: boolean;
  /** اسم طريقة الدفع (يُعرض أعلى الـ QR) */
  methodName?: string;
  /** [INVOICE-RESTYLE] قفل الأدمن: يظهر الـ QR مباشرة بلا حاجة لضغط الزر، مع أيقونة قفل صغيرة */
  alwaysOpen?: boolean;
  /** [PHASE-1] مصدر الرمز: auto = توليد من العنوان، image = صورة QR مرفوعة من الأدمن */
  qrMode?: "auto" | "image" | null;
  qrImageUrl?: string | null;
}

/**
 * زر "اظهار الـ QR": يظهر فقط إذا فعّل الأدمن الـ QR لطريقة الدفع ووُجد عنوان محفظة.
 * يُولَّد الـ QR محلياً داخل المتصفح (لا يُرسل العنوان لأي خدمة خارجية).
 * إن قفله الأدمن "مفتوحاً دائماً" (alwaysOpen) يُعرض الرمز مباشرة بلا أي ضغط.
 */
const WalletQrButton: React.FC<WalletQrButtonProps> = ({ address, enabled, methodName, alwaysOpen, qrMode, qrImageUrl }) => {
  const [open, setOpen] = React.useState(false);
  const [dataUrl, setDataUrl] = React.useState<string>("");
  const [failed, setFailed] = React.useState(false);
  const value = (address || "").trim();
  const locked = !!alwaysOpen;
  // [PHASE-1] وضع الصورة الجاهزة: يُعرض الرابط المرفوع كما هو. وإن لم يوجد رابط يُرجَع للتوليد التلقائي.
  const uploadedImage = qrMode === "image" && (qrImageUrl || "").trim() ? (qrImageUrl || "").trim() : "";

  // [INVOICE-RESTYLE] مولَّد دائماً (لا يعتمد على فتح نافذة) حين يكون مقفلاً مفتوحاً، كي يظهر
  // الرمز فور تحميل الصفحة دون أي تفاعل من المستخدم.
  React.useEffect(() => {
    if ((!open && !locked) || !value || uploadedImage) return;
    let cancelled = false;
    setFailed(false);
    QRCode.toDataURL(value, { width: 512, margin: 2, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } })
      .then(url => { if (!cancelled) setDataUrl(url); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [open, locked, value, uploadedImage]);

  // إغلاق بمفتاح Escape
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!enabled || !value) return null;

  // [INVOICE-RESTYLE] وضع "القفل المفتوح دائماً": الرمز ظاهر مباشرة ضمن الصفحة، بلا زر ولا نافذة
  // منبثقة، مع شارة قفل صغيرة تُبيّن أن الأدمن ثبّته مفتوحاً.
  if (locked) {
    return (
      <div className="flex flex-col items-center gap-1.5 mx-auto">
        <div className="relative bg-white p-2 rounded-xl border border-gray-100 flex items-center justify-center min-h-[160px] w-[160px]">
          {failed ? (
            <p className="text-xs text-red-500">تعذّر إنشاء الـ QR</p>
          ) : uploadedImage ? (
            <img src={uploadedImage} alt="QR" className="w-full h-auto" onError={() => setFailed(true)} />
          ) : dataUrl ? (
            <img src={dataUrl} alt="QR عنوان المحفظة" className="w-full h-auto" style={{ imageRendering: "pixelated" }} />
          ) : (
            <p className="text-xs text-gray-400">جاري الإنشاء...</p>
          )}
          <span className="absolute -top-2 -left-2 bg-amber-500 text-white rounded-full p-1 shadow" title="مثبَّت مفتوحاً من الإدارة">
            <Lock size={11} />
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-center gap-1.5 mx-auto bg-white text-brand border border-brand-soft text-xs font-bold px-3 py-1.5 rounded-lg"
      >
        <QrCode size={14} /> اظهار الـ QR
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[1000] bg-black/60 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white rounded-2xl p-5 w-full max-w-xs text-center space-y-3 shadow-xl"
            onClick={e => e.stopPropagation()}
            dir="rtl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-800">{methodName ? `QR ${methodName}` : "QR عنوان المحفظة"}</h3>
              <button type="button" onClick={() => setOpen(false)} className="p-1 rounded-full bg-gray-100 text-gray-600" aria-label="إغلاق">
                <X size={16} />
              </button>
            </div>
            <div className="bg-white p-2 rounded-xl border border-gray-100 flex items-center justify-center min-h-[240px]">
              {failed ? (
                <p className="text-xs text-red-500">تعذّر إنشاء الـ QR</p>
              ) : uploadedImage ? (
                <img src={uploadedImage} alt="QR" className="w-full h-auto" onError={() => setFailed(true)} />
              ) : dataUrl ? (
                <img src={dataUrl} alt="QR عنوان المحفظة" className="w-full h-auto" style={{ imageRendering: "pixelated" }} />
              ) : (
                <p className="text-xs text-gray-400">جاري الإنشاء...</p>
              )}
            </div>
            <p className="text-[11px] text-gray-500 break-all font-mono" dir="ltr">{value}</p>
            <p className="text-[11px] text-gray-400">امسح الرمز من تطبيق المحفظة</p>
          </div>
        </div>
      )}
    </>
  );
};

export default WalletQrButton;
