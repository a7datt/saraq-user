import React from "react";
import { ArrowRight, ChevronRight, ChevronDown, Copy, Image as ImageIcon, Ticket, X, FilePlus, ShieldCheck, AlertTriangle } from "lucide-react";
import QRCode from "qrcode";
import { PaymentMethod, StoreAppearance, UserData, Currency } from "../types";
import { showToast } from "../components/ToastContainer";
import OptimizedImage from "../components/OptimizedImage";
import WalletQrButton from "../components/WalletQrButton";
import { uploadImage } from "../utils/uploadImage";
import { ensurePaymentMethodDefaultFields, parsePaymentFieldsJson, PaymentFieldDef } from "../utils/defaultFields";
import { ratioToClass, gridColsClass, itemCardChrome, DEFAULT_APPEARANCE } from "../utils/useStoreAppearance";

// يحوّل مدة القبول بالدقائق إلى نص عربي مقروء ("30 دقيقة" / "ساعة" / "3 ساعات")
function formatAcceptWindowDuration(minutes: number): string {
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    if (hours === 1) return "ساعة";
    if (hours === 2) return "ساعتين";
    return `${hours} ساعات`;
  }
  if (minutes === 1) return "دقيقة واحدة";
  if (minutes === 2) return "دقيقتين";
  return `${minutes} دقيقة`;
}

// ===================== WALLET CHARGE VIEW (كل الـ state داخله لمنع إغلاق الكيبورد) =====================
interface WalletChargeViewProps {
  user: any;
  paymentMethods: PaymentMethod[];
  setView: (v: any) => void;
  fetchUser: (id: number) => void;
  fetchTransactions: () => void;
  sypRate: number;
  appearance?: StoreAppearance;
}

// React.memo يمنع إعادة رسم المكوّن عند أي تحديث خارجي لا يخصه
const WalletChargeView: React.FC<WalletChargeViewProps> = React.memo(({
  user, paymentMethods, setView, fetchUser, fetchTransactions, sypRate, appearance = DEFAULT_APPEARANCE,
}) => {
  const [selectedMethod, setSelectedMethodState] = React.useState<PaymentMethod | null>(null);
  const [walletAmount, setWalletAmount] = React.useState("");
  const [walletNote, setWalletNote] = React.useState("");
  const [walletReceiptUrl, setWalletReceiptUrl] = React.useState("");
  const [walletUploading, setWalletUploading] = React.useState(false);
  const [walletTxNumber, setWalletTxNumber] = React.useState("");
  const [walletLoading, setWalletLoading] = React.useState(false);
  const [walletCustomFieldValues, setWalletCustomFieldValues] = React.useState<Record<string, string>>({});
  // [INVOICE-RESTYLE] ضغطة مطولة على عنوان المحفظة تُظهره مكبَّراً فوق الصفحة مع زر إغلاق ×
  const [zoomedAddress, setZoomedAddress] = React.useState<string | null>(null);
  const addressLongPressTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const startAddressLongPress = (addr: string) => {
    if (addressLongPressTimer.current) clearTimeout(addressLongPressTimer.current);
    addressLongPressTimer.current = setTimeout(() => setZoomedAddress(addr), 550);
  };
  const cancelAddressLongPress = () => {
    if (addressLongPressTimer.current) { clearTimeout(addressLongPressTimer.current); addressLongPressTimer.current = null; }
  };
  // مدة قبول العمليات (بالدقائق) لكل بوابة تلقائية — تُستخدم لعرض نافذة القبول الزمنية الحية للمستخدم
  const [acceptWindows, setAcceptWindows] = React.useState<Record<string, number>>({});
  const [acceptWindowNow, setAcceptWindowNow] = React.useState<number>(Date.now());

  // ===== نظام فواتير شام كاش الجديد (verification_mode === 'invoices') =====
  const [invoice, setInvoice] = React.useState<{ invoiceNumber: string; expiresAt: string; amount: number; currency: string } | null>(null);
  const [invoiceCreating, setInvoiceCreating] = React.useState(false);
  const [invoiceTranId, setInvoiceTranId] = React.useState("");
  const [invoiceVerifying, setInvoiceVerifying] = React.useState(false);
  const [invoiceCancelling, setInvoiceCancelling] = React.useState(false);
  const [invoiceNow, setInvoiceNow] = React.useState<number>(Date.now());
  // لحظة إنشاء الفاتورة — تُستخدم لحساب نسبة اكتمال الدائرة ولعدّاد "إلغاء المعاملة" التجميلي
  const [invoiceCreatedAtMs, setInvoiceCreatedAtMs] = React.useState<number | null>(null);
  const [invoiceQrDataUrl, setInvoiceQrDataUrl] = React.useState<string>("");
  // [FIX] الضغط على QR الفاتورة يُظهره مكبَّراً في منتصف الصفحة مع زر إغلاق ×
  const [qrZoomOpen, setQrZoomOpen] = React.useState(false);

  const invoiceExpiresAtMs = invoice ? new Date(invoice.expiresAt).getTime() : null;
  const invoiceSecondsLeft = invoiceExpiresAtMs ? Math.max(0, Math.floor((invoiceExpiresAtMs - invoiceNow) / 1000)) : null;
  const invoiceExpired = invoiceSecondsLeft !== null && invoiceSecondsLeft <= 0;
  // مجموع ثواني مدة الفاتورة (من لحظة الإنشاء حتى الانتهاء — يحدّدها الأدمن عبر max_age_minutes) — أساس نسبة الدائرة
  const invoiceTotalSeconds = (invoiceCreatedAtMs && invoiceExpiresAtMs)
    ? Math.max(1, Math.round((invoiceExpiresAtMs - invoiceCreatedAtMs) / 1000))
    : null;
  const invoiceRingFraction = (invoiceTotalSeconds && invoiceSecondsLeft !== null)
    ? Math.max(0, Math.min(1, invoiceSecondsLeft / invoiceTotalSeconds))
    : 1;
  // عدّاد "إلغاء المعاملة" التجميلي (45 ثانية من لحظة إنشاء الفاتورة) — عرض فقط، لا يمنع
  // الإلغاء الفعلي أبداً حتى بعد انتهائه (الزر يبقى يعمل دائماً).
  const invoiceCancelGraceLeft = invoiceCreatedAtMs
    ? Math.max(0, 45 - Math.floor((invoiceNow - invoiceCreatedAtMs) / 1000))
    : 0;

  React.useEffect(() => {
    if (!invoice || invoiceExpired) return;
    const interval = setInterval(() => setInvoiceNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [invoice, invoiceExpired]);

  // [FIX] الـ QR يُشفّر عنوان محفظة شام كاش الذي ضبطه الأدمن (وليس رقم الفاتورة الداخلي) —
  // فمسح الرمز يُظهر عنوان المحفظة نفسه الذي يجب التحويل إليه. يظهر دوماً فور إنشاء الفاتورة،
  // بلا أي ضغط زر.
  React.useEffect(() => {
    const addr = selectedMethod?.wallet_address;
    if (!invoice || !addr) { setInvoiceQrDataUrl(""); return; }
    // [PHASE-1] صورة QR جاهزة مرفوعة من الأدمن تُعرض كما هي بدل التوليد من العنوان
    if (selectedMethod?.qr_mode === "image" && (selectedMethod?.qr_image_url || "").trim()) { setInvoiceQrDataUrl((selectedMethod.qr_image_url as string).trim()); return; }
    let cancelled = false;
    QRCode.toDataURL(addr, { width: 320, margin: 1, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } })
      .then(url => { if (!cancelled) setInvoiceQrDataUrl(url); })
      .catch(() => { if (!cancelled) setInvoiceQrDataUrl(""); });
    return () => { cancelled = true; };
  }, [invoice, selectedMethod?.wallet_address, selectedMethod?.qr_mode, selectedMethod?.qr_image_url]);

  // ===== الشحن التلقائي (Webhook) — رمز مميز بدل مبلغ محدد مسبقاً (verification_mode === 'webhook') =====
  const [autoCode, setAutoCode] = React.useState<{ code: string; walletAddress: string; expiresAt: string; createdAt: string } | null>(null);
  const [autoCodeCreating, setAutoCodeCreating] = React.useState(false);
  const [autoCodeCancelling, setAutoCodeCancelling] = React.useState(false);
  const [autoCodeNow, setAutoCodeNow] = React.useState<number>(Date.now());
  const [autoCodeQrDataUrl, setAutoCodeQrDataUrl] = React.useState<string>("");
  const [autoCodeQrZoomOpen, setAutoCodeQrZoomOpen] = React.useState(false);
  const [autoCodeManualOpen, setAutoCodeManualOpen] = React.useState(false);
  const [autoCodeManualTranId, setAutoCodeManualTranId] = React.useState("");

  React.useEffect(() => {
    if (!autoCode) { setAutoCodeManualOpen(false); setAutoCodeManualTranId(""); }
  }, [autoCode]);
  const [autoCodeManualVerifying, setAutoCodeManualVerifying] = React.useState(false);

  const autoCodeExpiresAtMs = autoCode ? new Date(autoCode.expiresAt).getTime() : null;
  const autoCodeSecondsLeft = autoCodeExpiresAtMs ? Math.max(0, Math.floor((autoCodeExpiresAtMs - autoCodeNow) / 1000)) : null;
  const autoCodeExpired = autoCodeSecondsLeft !== null && autoCodeSecondsLeft <= 0;
  const autoCodeTotalSeconds = (autoCode && autoCodeExpiresAtMs)
    ? Math.max(1, Math.round((autoCodeExpiresAtMs - new Date(autoCode.createdAt).getTime()) / 1000))
    : null;
  const autoCodeRingFraction = (autoCodeTotalSeconds && autoCodeSecondsLeft !== null)
    ? Math.max(0, Math.min(1, autoCodeSecondsLeft / autoCodeTotalSeconds))
    : 1;

  React.useEffect(() => {
    if (!autoCode || autoCodeExpired) return;
    const interval = setInterval(() => setAutoCodeNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [autoCode, autoCodeExpired]);

  // QR لعنوان المحفظة — نفس منطق فاتورة شام كاش تماماً
  React.useEffect(() => {
    const addr = selectedMethod?.wallet_address;
    if (!autoCode || !addr) { setAutoCodeQrDataUrl(""); return; }
    // [PHASE-1] صورة QR جاهزة مرفوعة من الأدمن تُعرض كما هي بدل التوليد من العنوان
    if (selectedMethod?.qr_mode === "image" && (selectedMethod?.qr_image_url || "").trim()) { setAutoCodeQrDataUrl((selectedMethod.qr_image_url as string).trim()); return; }
    let cancelled = false;
    QRCode.toDataURL(addr, { width: 320, margin: 1, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } })
      .then(url => { if (!cancelled) setAutoCodeQrDataUrl(url); })
      .catch(() => { if (!cancelled) setAutoCodeQrDataUrl(""); });
    return () => { cancelled = true; };
  }, [autoCode, selectedMethod?.wallet_address, selectedMethod?.qr_mode, selectedMethod?.qr_image_url]);

  // [RESUME] نفس فكرة استئناف الفاتورة المعلّقة — رمز فعّال سابق يُستعاد تلقائياً عند دخول الشاشة
  React.useEffect(() => {
    if (!user || autoCode) return;
    fetch("/api/transactions/auto-charge-code/pending", { headers: authHeaders() })
      .then(res => res.json())
      .then(data => {
        if (!data?.pending) return;
        const matched = paymentMethods.find(m => m.id === data.paymentMethodId);
        if (matched) setSelectedMethodState(matched);
        setAutoCode({ code: data.code, walletAddress: data.walletAddress, expiresAt: data.expiresAt, createdAt: data.createdAt });
        setAutoCodeNow(Date.now());
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, paymentMethods]);

  const handleGenerateAutoCode = async () => {
    if (!user || !selectedMethod) return;
    setAutoCodeCreating(true);
    try {
      const res = await fetch("/api/transactions/auto-charge-code", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ paymentMethodId: selectedMethod.id })
      });
      const data = await res.json();
      if (data.success) {
        if (data.resumed && data.paymentMethodId && data.paymentMethodId !== selectedMethod.id) {
          const matched = paymentMethods.find(m => m.id === data.paymentMethodId);
          if (matched) setSelectedMethodState(matched);
        }
        setAutoCode({ code: data.code, walletAddress: data.walletAddress, expiresAt: data.expiresAt, createdAt: data.createdAt });
        setAutoCodeNow(Date.now());
      } else {
        showToast(data.error || "فشل توليد الرمز", 'error');
      }
    } catch { showToast("فشل الاتصال بالخادم", 'error'); }
    finally { setAutoCodeCreating(false); }
  };

  const handleManualVerifyAutoCode = async () => {
    if (!autoCode || !autoCodeManualTranId.trim()) { showToast("يرجى إدخال رقم العملية", 'error'); return; }
    setAutoCodeManualVerifying(true);
    try {
      const res = await fetch(`/api/transactions/auto-charge-code/${encodeURIComponent(autoCode.code)}/verify-manual`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ tranId: autoCodeManualTranId.trim() })
      });
      const data = await res.json();
      if (data.success) {
        fetchUser(user!.id); fetchTransactions();
        setAutoCode(null); setAutoCodeManualOpen(false); setAutoCodeManualTranId("");
        showToast("تم شحن الرصيد بنجاح", 'success');
        setView({ type: "success", data: "تمت إضافة رصيد إلى حسابك.", dark: true });
      } else {
        showToast(data.error || "فشل التحقق من العملية", 'error');
      }
    } catch { showToast("فشل الاتصال بالخادم", 'error'); }
    finally { setAutoCodeManualVerifying(false); }
  };

  const handleCancelAutoCode = async () => {
    if (!autoCode) return;
    setAutoCodeCancelling(true);
    try {
      const res = await fetch(`/api/transactions/auto-charge-code/${encodeURIComponent(autoCode.code)}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        showToast("تم إلغاء الرمز", 'success');
        setAutoCode(null);
      } else {
        showToast(data.error || "فشل إلغاء الرمز", 'error');
      }
    } catch { showToast("فشل الاتصال بالخادم", 'error'); }
    finally { setAutoCodeCancelling(false); }
  };

  // استطلاع دوري (كل 3 ثوانٍ) لمعرفة لحظة اعتماد التحويل تلقائياً عبر الـ Webhook — يتوقف فور
  // الوصول لحالة نهائية (مُعتمَد/منتهٍ/ملغى) أو عند مغادرة الشاشة.
  React.useEffect(() => {
    if (!autoCode || autoCodeExpired) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/transactions/auto-charge-code/${encodeURIComponent(autoCode.code)}/status`, { headers: authHeaders() });
        const data = await res.json();
        if (cancelled) return;
        if (data.status === "used") {
          fetchUser(user!.id); fetchTransactions();
          const added = data.matchedAmount != null ? Number(data.matchedAmount) : null;
          const orig = added != null && data.matchedCurrency ? ` (${added.toLocaleString("en-US")} ${data.matchedCurrency})` : "";
          setAutoCode(null);
          showToast("تم شحن الرصيد بنجاح", 'success');
          setView({ type: "success", data: `تمت إضافة رصيد إلى حسابك${orig}.`, dark: true });
        } else if (data.status === "expired") {
          setAutoCode(null);
        } else if (data.status === "cancelled") {
          setAutoCode(null);
          showToast("تم إلغاء هذا الرمز", 'error');
        }
      } catch { /* نحاول مجدداً بالاستطلاع التالي */ }
    };
    const interval = setInterval(poll, 3000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [autoCode?.code, autoCodeExpired]);

  const authHeaders = () => ({ "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("authToken") || ""}` });

  // [RESUME] عند دخول شاشة الشحن، نتحقق إن كانت للمستخدم فاتورة شام كاش معلّقة بالفعل (مثلاً
  // بعد تحديث الصفحة أو مغادرتها دون إلغائها) ليعود إليها مباشرة بنفس شاشة العدّاد/QR، بدل أن
  // يضطر لبدء فاتورة جديدة أو يخسر فاتورته القديمة.
  const restoreAnyPendingInvoice = React.useCallback(() => {
    if (!user) return;
    fetch("/api/transactions/shamcash-invoice/pending", { headers: authHeaders() })
      .then(res => res.json())
      .then(data => {
        if (!data?.pending) return;
        const matched = paymentMethods.find(m => m.id === data.paymentMethodId);
        if (matched) setSelectedMethodState(matched);
        setInvoice({ invoiceNumber: data.invoiceNumber, expiresAt: data.expiresAt, amount: data.amount, currency: data.currency });
        setInvoiceCreatedAtMs(data.createdAt ? new Date(data.createdAt).getTime() : Date.now());
        setInvoiceNow(Date.now());
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, paymentMethods]);

  React.useEffect(() => {
    if (invoice) return;
    restoreAnyPendingInvoice();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, paymentMethods]);

  // [RESUME-3] زر "العودة للفاتورة" بالإشعارات قد يُضغط وشاشة المحفظة مفتوحة بالفعل (بدون إعادة
  // تحميل تُفعّل الأثر أعلاه) — نستمع لحدث مخصّص يُطلقه ذلك الزر (من App.tsx) لإعادة التحقق فوراً
  // بغض النظر عن حالة المكوّن الحالية.
  React.useEffect(() => {
    const handler = () => restoreAnyPendingInvoice();
    window.addEventListener("restore-pending-invoice", handler);
    return () => window.removeEventListener("restore-pending-invoice", handler);
  }, [restoreAnyPendingInvoice]);

  // [RESUME-2] الأعلى يستعيد الفاتورة مرة واحدة فقط عند أول تحميل للصفحة. لكن إن أغلق المستخدم
  // شاشة الفاتورة بزر "رجوع" (دون إلغائها فعلياً) ثم أعاد اختيار نفس طريقة الدفع، كانت الحالة
  // المحلية لا تزال فارغة فيظهر له نموذج إدخال مبلغ جديد رغم وجود فاتورته القديمة سارية بالخادم.
  // هذا الأثر يعيد التحقق من فاتورة معلّقة مطابقة لطريقة الدفع المُختارة تحديداً كلما تغيّر الاختيار.
  React.useEffect(() => {
    if (!user || invoice || !selectedMethod) return;
    const isInvoiceCapable = ['shamcash', 'syriatel', 'crypto_usdt_trc20', 'crypto_usdt_bep20'].includes(selectedMethod.method_type || '') && selectedMethod.verification_mode === 'invoices';
    if (!isInvoiceCapable) return;
    fetch("/api/transactions/shamcash-invoice/pending", { headers: authHeaders() })
      .then(res => res.json())
      .then(data => {
        if (!data?.pending || data.paymentMethodId !== selectedMethod.id) return;
        setInvoice({ invoiceNumber: data.invoiceNumber, expiresAt: data.expiresAt, amount: data.amount, currency: data.currency });
        setInvoiceCreatedAtMs(data.createdAt ? new Date(data.createdAt).getTime() : Date.now());
        setInvoiceNow(Date.now());
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMethod?.id]);

  const handleCreateInvoice = async () => {
    if (!user || !selectedMethod || !walletAmount) { showToast("يرجى إدخال المبلغ", 'error'); return; }
    const numAmount = parseFloat(walletAmount);
    if (isNaN(numAmount) || numAmount <= 0) { showToast("يرجى إدخال مبلغ صحيح", 'error'); return; }
    setInvoiceCreating(true);
    try {
      const res = await fetch("/api/transactions/shamcash-invoice", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ paymentMethodId: selectedMethod.id, amount: numAmount })
      });
      const data = await res.json();
      if (data.success) {
        // [RESUME] قد يُعيد الخادم فاتورة معلّقة سابقة بدل إنشاء فاتورة جديدة (مثلاً فاتورة
        // قديمة بطريقة دفع أخرى) — نُطابق طريقة الدفع المعروضة معها ونستخدم وقت إنشائها
        // الحقيقي حتى تبقى نسبة الدائرة التنازلية صحيحة بدل أن تبدأ من الصفر خطأً.
        if (data.resumed && data.paymentMethodId && data.paymentMethodId !== selectedMethod.id) {
          const matched = paymentMethods.find(m => m.id === data.paymentMethodId);
          if (matched) setSelectedMethodState(matched);
        }
        setInvoice({ invoiceNumber: data.invoiceNumber, expiresAt: data.expiresAt, amount: data.amount, currency: data.currency });
        setInvoiceNow(Date.now());
        setInvoiceCreatedAtMs(data.createdAt ? new Date(data.createdAt).getTime() : Date.now());
      } else {
        showToast(data.error || "فشل إنشاء الفاتورة", 'error');
      }
    } catch { showToast("فشل الاتصال بالخادم", 'error'); }
    finally { setInvoiceCreating(false); }
  };

  const handleVerifyInvoice = async () => {
    if (!invoice || !invoiceTranId.trim()) { showToast("يرجى إدخال رقم العملية", 'error'); return; }
    setInvoiceVerifying(true);
    try {
      const res = await fetch("/api/transactions/shamcash-invoice/verify", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ invoiceNumber: invoice.invoiceNumber, tranId: invoiceTranId.trim() })
      });
      const data = await res.json();
      if (data.success) {
        fetchUser(user!.id); fetchTransactions();
        const added = data.addedUsd ?? invoice.amount;
        const orig = data.originalAmount ? ` (${Number(data.originalAmount).toLocaleString("en-US")} ${data.currency})` : "";
        setInvoice(null); setInvoiceTranId(""); setInvoiceCreatedAtMs(null);
        showToast("تم شحن الرصيد بنجاح", 'success');
        setView({ type: "success", data: `تمت إضافة ${Number(added).toFixed(4)}$${orig} إلى رصيدك.`, dark: true });
      } else {
        showToast(data.error || "فشل التحقق من الفاتورة", 'error');
        if (data.code === "EXPIRED") { setInvoice(null); setInvoiceCreatedAtMs(null); }
      }
    } catch { showToast("فشل الاتصال بالخادم", 'error'); }
    finally { setInvoiceVerifying(false); }
  };

  const handleCancelInvoice = async () => {
    if (!invoice) return;
    setInvoiceCancelling(true);
    try {
      const res = await fetch(`/api/transactions/shamcash-invoice/${encodeURIComponent(invoice.invoiceNumber)}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        showToast("تم إلغاء الفاتورة", 'success');
        setInvoice(null); setInvoiceTranId(""); setWalletAmount(""); setInvoiceCreatedAtMs(null);
      } else {
        showToast(data.error || "فشل إلغاء الفاتورة", 'error');
      }
    } catch { showToast("فشل الاتصال بالخادم", 'error'); }
    finally { setInvoiceCancelling(false); }
  };

  // يُنسّق الثواني المتبقية كـ mm:ss
  const formatCountdown = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  React.useEffect(() => {
    fetch("/api/payment-gateways/accept-windows")
      .then(res => res.json())
      .then(data => setAcceptWindows(data && typeof data === "object" ? data : {}))
      .catch(() => {});
  }, []);

  // الحقول الديناميكية (الافتراضية: ملاحظة + صورة الإيصال، وحتى 3 حقول مخصصة) — تُطبَّق مباشرة من إعدادات لوحة التحكم
  const methodFields: PaymentFieldDef[] = React.useMemo(() => {
    return ensurePaymentMethodDefaultFields(parsePaymentFieldsJson(selectedMethod?.custom_fields));
  }, [selectedMethod?.custom_fields]);
  const noteField = methodFields.find(f => f.isDefault && f.key === "note");
  const imageField = methodFields.find(f => f.isDefault && f.key === "receipt_image");
  const noteEnabled = !noteField || noteField.enabled !== false;
  const imageEnabled = !imageField || imageField.enabled !== false;
  const imageRequired = imageEnabled && !!imageField?.required;
  const walletCustomFields = React.useMemo(() => methodFields.filter(f => !f.isDefault), [methodFields]);

  const setSelectedMethod = (m: PaymentMethod | null) => {
    setSelectedMethodState(m);
    if (!m) {
      setWalletAmount(""); setWalletNote(""); setWalletReceiptUrl(""); setWalletTxNumber(""); setWalletCustomFieldValues({});
      setInvoice(null); setInvoiceTranId(""); setInvoiceCreatedAtMs(null); setQrZoomOpen(false);
      setAutoCode(null); setAutoCodeQrZoomOpen(false);
    }
  };

  // اسم بوابة الدفع كما هو مخزّن في جدول payment_gateways (gateway_code)
  const gatewayCodeFor = (methodType?: string) => methodType === 'shamcash' ? 'shamcash' : methodType === 'syriatel' ? 'syriatelcash' : methodType === 'binance' ? 'binance' : methodType === 'crypto_usdt_trc20' ? 'crypto_usdt_trc20' : methodType === 'crypto_usdt_bep20' ? 'crypto_usdt_bep20' : null;

  const activeAcceptWindowMinutes = (() => {
    const code = gatewayCodeFor(selectedMethod?.method_type);
    const minutes = code ? acceptWindows[code] : 0;
    return minutes && minutes > 0 ? minutes : null;
  })();

  // يُحدَّث كل ثانية طالما في نافذة قبول فعّالة، مشان تبقى "من - إلى" حيّة ومتزامنة مع "الآن"
  React.useEffect(() => {
    if (!activeAcceptWindowMinutes) return;
    const interval = setInterval(() => setAcceptWindowNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activeAcceptWindowMinutes]);

  const acceptWindowLabels = activeAcceptWindowMinutes ? (() => {
    const fmt = (ms: number) => new Date(ms).toLocaleTimeString("ar-SY", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true });
    return {
      from: fmt(acceptWindowNow - activeAcceptWindowMinutes * 60000),
      to: fmt(acceptWindowNow),
    };
  })() : null;

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setWalletUploading(true);
    setReceiptImgError(false);
    try {
      const url = await uploadImage(file);
      setWalletReceiptUrl(url);
    } catch (err: any) { showToast("فشل رفع الصورة: " + (err?.message || "خطأ غير معروف"), 'error'); }
    finally { setWalletUploading(false); }
  };

  const [receiptImgError, setReceiptImgError] = React.useState(false);
  const clearReceipt = (e: React.MouseEvent) => { e.stopPropagation(); e.preventDefault(); setWalletReceiptUrl(""); setReceiptImgError(false); };

  const handleAutoTopUp = async () => {
    if (!user || !selectedMethod || !walletAmount || !walletTxNumber) {
      showToast("يرجى إدخال المبلغ ورقم العملية", 'error'); return;
    }
    const walletCur = (selectedMethod as any).currency as Currency | null | undefined;
    const isUsdCur = !walletCur || walletCur.name?.toUpperCase() === "USD" || walletCur.symbol === "$";
    const methodCurrency = !isUsdCur ? "SYP" : "USD";
    const numAmount = parseFloat(walletAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast("يرجى إدخال مبلغ صحيح", 'error'); return;
    }
    // تحقق من الحد الأدنى بنفس منطق الشحن اليدوي: نحوّل المبلغ (بعملة الطريقة) إلى USD أولاً،
    // لأن selectedMethod.min_amount مخزّن دائماً بالدولار — منع إرسال طلبات تحقق تلقائي لمبالغ أقل من الحد الأدنى
    const exchangeRateAuto = walletCur?.exchange_rate && walletCur.exchange_rate > 0 ? walletCur.exchange_rate : 1;
    const usdAmountAuto = isUsdCur ? numAmount : numAmount / exchangeRateAuto;
    if (usdAmountAuto < selectedMethod.min_amount) {
      const minDisplayAuto = !isUsdCur
        ? `${Math.round(selectedMethod.min_amount * exchangeRateAuto).toLocaleString("en-US")} ${walletCur?.symbol || ""}`
        : `${selectedMethod.min_amount} $`;
      showToast(`أقل مبلغ للشحن عبر هذه الطريقة هو ${minDisplayAuto}`, 'error');
      return;
    }
    setWalletLoading(true);
    try {
      const res = await fetch("/api/transactions/verify-auto", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("authToken") || ""}` },
        body: JSON.stringify({
          userId: user.id,
          paymentMethodId: selectedMethod.id,
          amount: numAmount,
          txNumber: walletTxNumber.trim(),
          inputCurrency: methodCurrency
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchUser(user.id); fetchTransactions();
        const added = data.addedUsd ?? numAmount;
        const orig = data.originalAmount
          ? ` (${Number(data.originalAmount).toLocaleString("en-US")} ${data.currency})`
          : "";
        showToast("تم شحن الرصيد بنجاح", 'success');
        setView({ type: "success", data: `تمت إضافة ${Number(added).toFixed(4)}$${orig} إلى رصيدك.`, dark: true });
      } else { showToast(data.error || "فشل التحقق", 'error'); }
    } catch { showToast("فشل الاتصال بالخادم", 'error'); }
    finally { setWalletLoading(false); }
  };

  const handleTopUp = async () => {
    if (!user || !selectedMethod || !walletAmount) {
      showToast("يرجى إدخال المبلغ", 'error'); return;
    }
    if (imageRequired && !walletReceiptUrl) {
      showToast(`يرجى رفع ${imageField?.label || "صورة الإيصال"}`, 'error'); return;
    }
    if (noteEnabled && noteField?.required && !walletNote.trim()) {
      showToast(`الحقل "${noteField.label}" إلزامي`, 'error'); return;
    }
    for (const field of walletCustomFields) {
      if (field.required && !walletCustomFieldValues[field.id]?.trim()) {
        showToast(`الحقل "${field.label}" إلزامي`, 'error'); return;
      }
    }
    const numAmount = parseFloat(walletAmount);
    if (isNaN(numAmount) || numAmount <= 0) {
      showToast("يرجى إدخال مبلغ صحيح", 'error'); return;
    }
    // نحوّل المبلغ المُدخل (بعملة طريقة الدفع) إلى مكافئه بالدولار قبل الإرسال والتحقق من الحد الأدنى،
    // لأن الخادم والرصيد يتعاملان بالدولار دائماً — يمنع خصم/إضافة رصيد خاطئ عند اختيار عملة غير الدولار
    const walletCurrencyLocal = (selectedMethod as any).currency as Currency | null | undefined;
    const isUsdWalletLocal = !walletCurrencyLocal || walletCurrencyLocal.name?.toUpperCase() === "USD" || walletCurrencyLocal.symbol === "$";
    const exchangeRateLocal = walletCurrencyLocal?.exchange_rate && walletCurrencyLocal.exchange_rate > 0 ? walletCurrencyLocal.exchange_rate : 1;
    const usdAmount = isUsdWalletLocal ? numAmount : numAmount / exchangeRateLocal;
    if (usdAmount < selectedMethod.min_amount) {
      const minDisplay = !isUsdWalletLocal
        ? `${Math.round(selectedMethod.min_amount * exchangeRateLocal).toLocaleString("en-US")} ${walletCurrencyLocal?.symbol || ""}`
        : `${selectedMethod.min_amount} $`;
      showToast(`أقل مبلغ للشحن عبر هذه الطريقة هو ${minDisplay}`, 'error'); return;
    }
    setWalletLoading(true);
    try {
      const customFieldsData = [
        ...(noteEnabled && noteField ? [{ key: "note", label: noteField.label, value: walletNote, required: !!noteField.required, isDefault: true, type: "text" }] : []),
        ...(imageEnabled && imageField ? [{ key: "receipt_image", label: imageField.label, value: walletReceiptUrl, required: !!imageField.required, isDefault: true, type: "image" }] : []),
        ...walletCustomFields.map(f => ({ label: f.label, value: walletCustomFieldValues[f.id] || "", required: !!f.required, isDefault: false, type: "text" })),
      ];
      const res = await fetch("/api/transactions/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("authToken") || ""}` },
        body: JSON.stringify({
          userId: user.id,
          paymentMethodId: selectedMethod.id,
          amount: parseFloat(usdAmount.toFixed(4)),
          originalAmount: numAmount,
          originalCurrency: isUsdWalletLocal ? "USD" : (walletCurrencyLocal?.symbol || "SYP"),
          note: noteEnabled ? walletNote : undefined,
          receiptImageUrl: imageEnabled ? walletReceiptUrl : undefined,
          customFieldsData: JSON.stringify(customFieldsData),
        })
      });
      const data = await res.json();
      if (data.success) { setView({ type: "success", data: "تم إرسال طلب الشحن بنجاح، يرجى انتظار التحقق." }); fetchTransactions(); }
      else { showToast(data.error || "فشل إرسال الطلب", 'error'); }
    } catch (e) { showToast("فشل الاتصال بالخادم، يرجى المحاولة لاحقاً", 'error'); console.error(e); }
    finally { setWalletLoading(false); }
  };

  if (selectedMethod) {
    const isAuto = ['syriatel', 'shamcash', 'binance', 'crypto_usdt_trc20', 'crypto_usdt_bep20'].includes(selectedMethod.method_type || '');
    // البوابات التي تدعم نظام الفواتير (شام كاش/سيرياتيل كاش/العملات الرقمية)، وعندما يختار الأدمن هذا النظام بدل جلب المعاملات القديم
    const isShamCashInvoiceMode = ['shamcash', 'syriatel', 'crypto_usdt_trc20', 'crypto_usdt_bep20'].includes(selectedMethod.method_type || '') && selectedMethod.verification_mode === 'invoices';
    // الشحن التلقائي (Webhook) — رمز مميز بدل الفاتورة، دون أي مبلغ يُدخله المستخدم مسبقاً
    const isAutoChargeWebhookMode = ['shamcash', 'syriatel', 'crypto_usdt_trc20', 'crypto_usdt_bep20'].includes(selectedMethod.method_type || '') && selectedMethod.verification_mode === 'webhook';
    // عملة محفظة طريقة الدفع الفعلية (من العملات المحفوظة في لوحة التحكم) — تدعم أي عملة وليس فقط USD/SYP
    const walletCurrency = (selectedMethod as any).currency as Currency | null | undefined;
    const isUsdWallet = !walletCurrency || walletCurrency.name?.toUpperCase() === "USD" || walletCurrency.symbol === "$";
    // نبقي methodCurrency لأغراض التوافق مع الـ API (حد أقصى للمبلغ إلخ) — شام كاش وسيرياتيل كاش لا يقبلان إلا ل.س
    const methodCurrency: "USD" | "SYP" = !isUsdWallet ? "SYP" : "USD";
    const currencySymbol = walletCurrency?.symbol || "$";
    const currencyName = walletCurrency?.name || "الدولار";
    const exchangeRate = walletCurrency?.exchange_rate && walletCurrency.exchange_rate > 0 ? walletCurrency.exchange_rate : 1;
    const walletAmountNum = parseFloat(walletAmount) || 0;
    // مكافئ الدولار الأمريكي للمبلغ المُدخل بعملة المحفظة (1 دولار = exchangeRate من عملة المحفظة)
    const usdEquivalent = walletAmountNum > 0
      ? (isUsdWallet ? walletAmountNum : (walletAmountNum / exchangeRate)).toFixed(4)
      : null;
    // نفس حساب usdEquivalent لكن بناءً على مبلغ الفاتورة المُنشأة فعلياً (بعد الإنشاء) — هذا هو
    // المبلغ الحقيقي الذي سيُضاف إلى رصيد المستخدم (بالدولار دائماً، بصرف النظر عن عملة الفاتورة)
    const invoiceUsdEquivalent = invoice
      ? (isUsdWallet ? invoice.amount : (invoice.amount / exchangeRate)).toFixed(4)
      : null;
    return (
      <div className="px-4 space-y-6 pb-20">
        <div className="flex items-center gap-2 mb-6">
          <button onClick={() => setSelectedMethod(null)} className="p-2 bg-gray-100 rounded-full">
            <ArrowRight size={20} className="text-gray-600" />
          </button>
          <h2 className="text-xl font-bold text-gray-800">شحن عبر {selectedMethod.name}</h2>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm space-y-6">
          {isShamCashInvoiceMode ? (
            <>
              {!invoice && (selectedMethod.min_amount > 0 || ((selectedMethod as any).bonus_type && (selectedMethod as any).bonus_percent > 0 && (selectedMethod as any).bonus_visible !== false)) && (
                <div className="space-y-1 -mt-2">
                  {selectedMethod.min_amount > 0 && (
                    <p className="text-xs text-gray-400 font-bold">
                      أقل مبلغ: {!isUsdWallet
                        ? `${Math.round(selectedMethod.min_amount * exchangeRate).toLocaleString("en-US")} ${currencySymbol}`
                        : `${selectedMethod.min_amount} $`}
                    </p>
                  )}
                  {(selectedMethod as any).bonus_type && (selectedMethod as any).bonus_percent > 0 && (selectedMethod as any).bonus_visible !== false && (
                    <p className={`text-xs font-bold ${(selectedMethod as any).bonus_type === "bonus" ? "text-green-600" : "text-red-500"}`}>
                      {(selectedMethod as any).bonus_type === "bonus"
                        ? `🎁 بونص ${(selectedMethod as any).bonus_percent}% على هذه الطريقة`
                        : `⚠️ عمولة ${(selectedMethod as any).bonus_percent}% على هذه الطريقة`}
                    </p>
                  )}
                </div>
              )}

              {!invoice ? (
                <div className="space-y-3">
                  {/* [INVOICE-RESTYLE] عملة العرض — ثابتة غير قابلة للتبديل، فعملة محفظة طريقة
                      الدفع هذه تُضبط من الإدارة ولا تتعدّد داخل هذه الشاشة. السهم في أقصى اليسار
                      (آخر عنصر DOM كي يرسو عند نهاية السطر الأفقي RTL) زخرفي بلا أي وظيفة. */}
                  <div
                    className="w-full bg-gray-100 rounded-2xl px-4 py-3 flex items-center justify-between cursor-not-allowed select-none"
                    title="عملة هذه المحفظة ثابتة ولا يمكن تبديلها"
                  >
                    <div className="text-right">
                      <p className="text-[11px] text-gray-400">العملة التي ستدفع بها</p>
                      <p className="font-bold text-gray-700 text-sm">{isUsdWallet ? "USD" : currencyName}</p>
                    </div>
                    <ChevronDown size={16} className="text-gray-400 shrink-0" />
                  </div>

                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg pointer-events-none">
                      {isUsdWallet ? "$" : currencySymbol}
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={walletAmount}
                      onChange={e => setWalletAmount(e.target.value)}
                      placeholder="المبلغ"
                      className="w-full bg-gray-100 rounded-2xl pl-10 pr-4 py-3.5 text-right outline-none focus:ring-2 focus:ring-brand-light"
                    />
                  </div>

                  {walletAmountNum > 0 && usdEquivalent !== null && (
                    <div className="flex items-center justify-between rounded-2xl px-4 py-3.5 bg-emerald-50">
                      <span className="text-sm font-bold text-gray-700">الرصيد الذي سيتم إضافته إلى محفظتك:</span>
                      <span className="text-sm font-bold text-emerald-600 whitespace-nowrap">{usdEquivalent} $</span>
                    </div>
                  )}
                  {!isUsdWallet && (
                    <p className="text-[11px] text-gray-400 text-center">1 $ = {exchangeRate.toLocaleString("en-US")} {currencySymbol}</p>
                  )}
                  {walletAmountNum > 0 && (selectedMethod as any).bonus_type && (selectedMethod as any).bonus_type !== "none" && (selectedMethod as any).bonus_percent > 0 && (selectedMethod as any).bonus_visible !== false && (() => {
                    const bonusType = (selectedMethod as any).bonus_type;
                    const bonusPercent = (selectedMethod as any).bonus_percent;
                    const isBonus = bonusType === "bonus";
                    const finalAmount = isBonus
                      ? walletAmountNum * (1 + bonusPercent / 100)
                      : walletAmountNum * (1 - bonusPercent / 100);
                    const finalAmountFormatted = Number.isInteger(finalAmount) ? finalAmount.toLocaleString("en-US") : finalAmount.toLocaleString("en-US", { maximumFractionDigits: 2 });
                    return (
                      <p className={`text-xs font-bold rounded-2xl px-4 py-3 text-center ${isBonus ? "text-green-700 bg-green-50" : "text-red-600 bg-red-50"}`}>
                        {isBonus ? `🎁 بونص إيداع بنسبة ${bonusPercent}%` : `⚠️ عمولة إيداع بنسبة ${bonusPercent}%`} — المبلغ الذي {isBonus ? "ستحصل" : "سيُخصم و ستحصل"} عليه هو {finalAmountFormatted} {currencySymbol}
                      </p>
                    );
                  })()}

                  <button disabled={invoiceCreating || !walletAmount} onClick={handleCreateInvoice}
                    className="w-full flex items-center justify-center gap-2 bg-black text-white py-4 rounded-full font-bold disabled:opacity-50">
                    {invoiceCreating ? "جاري إنشاء الفاتورة..." : (<>إنشاء فاتورة <FilePlus size={18} /></>)}
                  </button>
                </div>
              ) : invoiceExpired ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl border border-red-200 bg-red-50 text-center space-y-1">
                    <p className="text-red-600 font-bold text-sm">⏱️ انتهت صلاحية الفاتورة</p>
                    <p className="text-xs text-gray-400">أنشئ فاتورة جديدة لإتمام الشحن</p>
                  </div>
                  <button onClick={() => { setInvoice(null); setInvoiceTranId(""); setInvoiceCreatedAtMs(null); }}
                    className="w-full bg-black text-white py-4 rounded-full font-bold">
                    إنشاء فاتورة جديدة
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-right text-sm font-bold text-gray-800">يرجى عدم مغادرة الصفحة حتى إتمام العملية.</p>
                  <p className="text-right text-xs text-gray-500 -mt-3">يرجى إرسال المبلغ المطلوب إلى بيانات التحويل التالية.</p>

                  {/* [FIX] QR لعنوان محفظة شام كاش الذي ضبطه الأدمن (وليس رقم الفاتورة الداخلي) —
                      مسح الرمز يُظهر عنوان المحفظة نفسه، ظاهر دوماً بلا ضغط زر + قابل للنسخ —
                      صفّ بترتيب يسار→يمين صريح (dir="ltr") مطابق للصورة المرجعية بدل اعتماد
                      انعكاس RTL التلقائي. */}
                  <div dir="ltr" className="bg-gray-100 rounded-2xl p-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => invoiceQrDataUrl && setQrZoomOpen(true)}
                      className="shrink-0 bg-white rounded-xl p-1.5 flex items-center justify-center w-[84px] h-[84px]"
                      aria-label="تكبير رمز QR"
                    >
                      {invoiceQrDataUrl ? (
                        <img src={invoiceQrDataUrl} alt="QR عنوان المحفظة" className="w-full h-full" style={{ imageRendering: "pixelated" }} />
                      ) : (
                        <span className="text-[9px] text-gray-400">...</span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(selectedMethod.wallet_address).then(() => showToast("تم نسخ عنوان المحفظة!", 'success')).catch(() => showToast("فشل النسخ", 'error')); }}
                      className="flex-1 flex items-center gap-2 min-w-0"
                    >
                      <Copy size={14} className="text-gray-500 shrink-0" />
                      <span className="text-xs font-bold text-gray-800 truncate">{selectedMethod.wallet_address}</span>
                    </button>
                  </div>

                  {/* فقّاعة "المبلغ المطلوب" — محدّدة فقط (بلا تعبئة)، نفس ترتيب يسار→يمين */}
                  <button
                    type="button"
                    dir="ltr"
                    onClick={() => { navigator.clipboard.writeText(`${invoice.currency} ${invoice.amount}`).then(() => showToast("تم نسخ المبلغ!", 'success')).catch(() => showToast("فشل النسخ", 'error')); }}
                    className="w-full flex items-center justify-center gap-2 border border-gray-300 rounded-full py-3"
                  >
                    <Copy size={13} className="text-gray-500" />
                    <span className="font-bold text-sm">{invoice.currency} {Number(invoice.amount).toLocaleString("en-US")}</span>
                    <span className="text-xs text-gray-500 mr-1">المبلغ المطلوب</span>
                  </button>

                  <p className="text-right text-sm">
                    <span className="text-gray-800 font-bold">المبلغ الذي سيُضاف إلى رصيدك: </span>
                    <span className="text-emerald-600 font-bold">{invoiceUsdEquivalent} $</span>
                  </p>

                  <p className="text-right text-xs text-gray-500">بعد إتمام التحويل، أدخل رقم العملية قبل انتهاء الوقت.</p>

                  {/* عدّاد تنازلي دائري — "الوقت المتبقي" يعلو الدائرة كتسمية منفصلة، والدائرة
                      تحوي الرقم فقط. المدة يضبطها الأدمن عبر إعدادات بوابة شام كاش (max_age_minutes). */}
                  <div className="flex flex-col items-center gap-2 py-1">
                    <span className="text-xs text-gray-400">الوقت المتبقي</span>
                    <div className="relative w-32 h-32">
                      <svg viewBox="0 0 120 120" className="w-32 h-32 -rotate-90">
                        <circle cx="60" cy="60" r="52" fill="none" strokeWidth="7" stroke="#f3f4f6" />
                        <circle
                          cx="60" cy="60" r="52" fill="none" strokeWidth="7" strokeLinecap="round"
                          stroke="#000000"
                          strokeDasharray={2 * Math.PI * 52}
                          strokeDashoffset={2 * Math.PI * 52 * (1 - invoiceRingFraction)}
                          style={{ transition: "stroke-dashoffset 1s linear" }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="font-bold text-2xl tabular-nums" dir="ltr">{formatCountdown(invoiceSecondsLeft || 0)}</span>
                      </div>
                    </div>
                  </div>

                  <input type="text" value={invoiceTranId} onChange={e => setInvoiceTranId(e.target.value)}
                    placeholder="رقم عملية التحويل"
                    className="w-full bg-gray-100 rounded-2xl px-4 py-3.5 text-right outline-none focus:ring-2 focus:ring-brand-light" />

                  <button disabled={invoiceVerifying || invoiceCancelling || !invoiceTranId.trim()} onClick={handleVerifyInvoice}
                    className="w-full flex items-center justify-center gap-2 bg-black text-white py-4 rounded-full font-bold disabled:opacity-50">
                    {invoiceVerifying ? "جاري التحقق..." : (<>إتمام الطلب <ShieldCheck size={18} /></>)}
                  </button>

                  {/* [INVOICE-RESTYLE] العدّاد هنا تجميلي فقط (45 ثانية من لحظة إنشاء الفاتورة) —
                      الإلغاء الفعلي يبقى متاحاً دائماً بالضغط، حتى بعد انتهاء هذا العدّاد. */}
                  <div className="flex justify-center">
                    <button disabled={invoiceCancelling} onClick={handleCancelInvoice}
                      className="flex items-center gap-2 bg-red-50 text-red-400 text-sm font-bold px-4 py-1.5 rounded-full disabled:opacity-50">
                      {invoiceCancelling
                        ? "جاري الإلغاء..."
                        : `إلغاء المعاملة${invoiceCancelGraceLeft > 0 ? ` (${formatCountdown(invoiceCancelGraceLeft)})` : ""}`}
                      <span className="w-4 h-4 rounded-full border border-red-300 flex items-center justify-center">
                        <X size={10} />
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : isAutoChargeWebhookMode ? (
            <>
              {!autoCode ? (
                <div className="space-y-4">
                  {(selectedMethod.min_amount > 0 || ((selectedMethod as any).bonus_type && (selectedMethod as any).bonus_percent > 0 && (selectedMethod as any).bonus_visible !== false)) && (
                    <div className="space-y-1 -mt-2">
                      {selectedMethod.min_amount > 0 && (
                        <p className="text-xs text-gray-400 font-bold">
                          أقل مبلغ: {!isUsdWallet
                            ? `${Math.round(selectedMethod.min_amount * exchangeRate).toLocaleString("en-US")} ${currencySymbol}`
                            : `${selectedMethod.min_amount} $`}
                        </p>
                      )}
                      {(selectedMethod as any).bonus_type && (selectedMethod as any).bonus_percent > 0 && (selectedMethod as any).bonus_visible !== false && (
                        <p className={`text-xs font-bold ${(selectedMethod as any).bonus_type === "bonus" ? "text-green-600" : "text-red-500"}`}>
                          {(selectedMethod as any).bonus_type === "bonus"
                            ? `🎁 بونص ${(selectedMethod as any).bonus_percent}% على هذه الطريقة`
                            : `⚠️ عمولة ${(selectedMethod as any).bonus_percent}% على هذه الطريقة`}
                        </p>
                      )}
                    </div>
                  )}
                  <div className="bg-brand-light p-4 rounded-2xl border border-brand-soft text-center space-y-1.5">
                    <p className="text-brand text-sm font-bold">شحن تلقائي فوري</p>
                    <p className="text-xs text-gray-500 leading-relaxed">احصل على رمز مميز خاص بك، حوّل أي مبلغ تريده إلى عنوان المحفظة، وضع الرمز في خانة الملاحظة — سيُضاف الرصيد تلقائياً فور وصول التحويل.</p>
                  </div>
                  <button disabled={autoCodeCreating} onClick={handleGenerateAutoCode}
                    className="w-full flex items-center justify-center gap-2 bg-black text-white py-4 rounded-full font-bold disabled:opacity-50">
                    {autoCodeCreating ? "جاري توليد الرمز..." : (<>توليد رمز الشحن <FilePlus size={18} /></>)}
                  </button>
                </div>
              ) : autoCodeExpired ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl border border-red-200 bg-red-50 text-center space-y-1">
                    <p className="text-red-600 font-bold text-sm">⏱️ انتهت صلاحية الرمز</p>
                    <p className="text-xs text-gray-400">ولّد رمزاً جديداً لإتمام الشحن</p>
                  </div>
                  <button onClick={() => setAutoCode(null)}
                    className="w-full bg-black text-white py-4 rounded-full font-bold">
                    توليد رمز جديد
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-right text-sm font-bold text-gray-800">يرجى عدم مغادرة الصفحة حتى إتمام العملية.</p>
                  <p className="text-right text-xs text-gray-500 -mt-3">حوّل أي مبلغ تريده إلى بيانات التحويل التالية، وضع الرمز أدناه في خانة الملاحظة حرفياً.</p>

                  <div dir="ltr" className="bg-gray-100 rounded-2xl p-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => autoCodeQrDataUrl && setAutoCodeQrZoomOpen(true)}
                      className="shrink-0 bg-white rounded-xl p-1.5 flex items-center justify-center w-[84px] h-[84px]"
                      aria-label="تكبير رمز QR"
                    >
                      {autoCodeQrDataUrl ? (
                        <img src={autoCodeQrDataUrl} alt="QR عنوان المحفظة" className="w-full h-full" style={{ imageRendering: "pixelated" }} />
                      ) : (
                        <span className="text-[9px] text-gray-400">...</span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(autoCode.walletAddress).then(() => showToast("تم نسخ عنوان المحفظة!", 'success')).catch(() => showToast("فشل النسخ", 'error')); }}
                      className="flex-1 flex items-center gap-2 min-w-0"
                    >
                      <Copy size={14} className="text-gray-500 shrink-0" />
                      <span className="text-xs font-bold text-gray-800 truncate">{autoCode.walletAddress}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => { navigator.clipboard.writeText(autoCode.code).then(() => showToast("تم نسخ الرمز!", 'success')).catch(() => showToast("فشل النسخ", 'error')); }}
                    className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-brand-soft rounded-full py-3.5 bg-brand-light"
                  >
                    <Copy size={14} className="text-brand" />
                    <span className="font-black text-lg tracking-widest text-brand" dir="ltr">{autoCode.code}</span>
                  </button>
                  <p className="text-center text-xs text-gray-500">⚠️ ضع هذا الرمز حرفياً في خانة "الملاحظة" عند التحويل، وإلا لن يُشحن رصيدك تلقائياً</p>

                  <div className="flex flex-col items-center gap-2 py-1">
                    <span className="text-xs text-gray-400">الوقت المتبقي</span>
                    <div className="relative w-32 h-32">
                      <svg viewBox="0 0 120 120" className="w-32 h-32 -rotate-90">
                        <circle cx="60" cy="60" r="52" fill="none" strokeWidth="7" stroke="#f3f4f6" />
                        <circle
                          cx="60" cy="60" r="52" fill="none" strokeWidth="7" strokeLinecap="round"
                          stroke="#000000"
                          strokeDasharray={2 * Math.PI * 52}
                          strokeDashoffset={2 * Math.PI * 52 * (1 - autoCodeRingFraction)}
                          style={{ transition: "stroke-dashoffset 1s linear" }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="font-bold text-2xl tabular-nums" dir="ltr">{formatCountdown(autoCodeSecondsLeft || 0)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-2 text-gray-400 text-xs">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    بانتظار وصول التحويل... سيُشحن رصيدك تلقائياً فور وصوله
                  </div>

                  <div className="flex flex-col items-center gap-1.5">
                    <button type="button" onClick={() => setAutoCodeManualOpen(v => !v)}
                      className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold px-5 py-2.5 rounded-full shadow-md shadow-orange-200 animate-pulse">
                      <AlertTriangle size={16} />
                      هل فشل التحقق؟ اضغط هنا
                    </button>
                    <p className="text-[11px] text-orange-500 font-bold text-center">
                      ⚠️ بالضغط ستُفتح خانة أدناه لوضع رقم العملية والتحقق منها مباشرة
                    </p>
                  </div>

                  {autoCodeManualOpen && (
                    <div className="space-y-2.5 bg-orange-50 border-2 border-orange-300 rounded-2xl p-3.5">
                      <p className="text-xs text-orange-700 font-bold leading-relaxed text-center">
                        ⚠️ إن حوّلت فعلاً ووضعت الرمز في الملاحظة ولم يُشحن رصيدك بعد، أدخل رقم العملية (tran_id) كما يظهر لديك لنتحقق منها مباشرة.
                      </p>
                      <input
                        type="text"
                        inputMode="text"
                        dir="ltr"
                        value={autoCodeManualTranId}
                        onChange={e => setAutoCodeManualTranId(e.target.value)}
                        placeholder="رقم العملية"
                        className="w-full border-2 border-orange-300 focus:border-orange-500 outline-none rounded-full px-4 py-2.5 text-sm text-center font-bold bg-white"
                      />
                      <button disabled={autoCodeManualVerifying || !autoCodeManualTranId.trim()} onClick={handleManualVerifyAutoCode}
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-full font-bold text-sm disabled:opacity-50">
                        {autoCodeManualVerifying ? "جاري التحقق..." : "تحقق الآن"}
                      </button>
                    </div>
                  )}

                  <div className="flex justify-center">
                    <button disabled={autoCodeCancelling} onClick={handleCancelAutoCode}
                      className="flex items-center gap-2 bg-red-50 text-red-400 text-sm font-bold px-4 py-1.5 rounded-full disabled:opacity-50">
                      {autoCodeCancelling ? "جاري الإلغاء..." : "إلغاء"}
                      <span className="w-4 h-4 rounded-full border border-red-300 flex items-center justify-center">
                        <X size={10} />
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : isAuto ? (
            <>
              {acceptWindowLabels && (
                <div className="bg-green-50 p-3 rounded-lg border border-green-200 text-center space-y-1.5">
                  <p className="text-green-700 text-xs font-bold">
                    ✅ يُقبل أي تحويل {selectedMethod.name} تم خلال آخر {formatAcceptWindowDuration(activeAcceptWindowMinutes!)}
                  </p>
                  <div className="flex items-center justify-center gap-3 text-[11px] font-bold text-green-800">
                    <span>من {acceptWindowLabels.from}</span>
                    <span className="text-green-400">←</span>
                    <span>إلى {acceptWindowLabels.to} (الآن)</span>
                  </div>
                  <p className="text-green-500 text-[10px]">أي تحويل قبل الوقت المذكور "من" سيتم رفضه تلقائياً، بغض النظر متى فتحت هذه الصفحة</p>
                </div>
              )}
              <div className="bg-brand-light p-4 rounded-lg border border-brand-soft text-center space-y-2">
                <p className="text-brand text-xs mb-1">{selectedMethod.method_type === 'syriatel' ? 'رقم سيريتل كاش' : selectedMethod.method_type === 'binance' ? 'معرف Binance (Binance ID)' : selectedMethod.method_type === 'crypto_usdt_trc20' ? 'عنوان USDT (TRC20)' : selectedMethod.method_type === 'crypto_usdt_bep20' ? 'عنوان USDT (BEP20)' : 'عنوان شام كاش'}</p>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <p
                    className="text-sm font-bold text-brand tracking-wider break-all cursor-pointer select-none"
                    onContextMenu={e => e.preventDefault()}
                    onTouchStart={() => startAddressLongPress(selectedMethod.wallet_address)}
                    onTouchEnd={cancelAddressLongPress}
                    onTouchMove={cancelAddressLongPress}
                    onMouseDown={() => startAddressLongPress(selectedMethod.wallet_address)}
                    onMouseUp={cancelAddressLongPress}
                    onMouseLeave={cancelAddressLongPress}
                  >
                    {selectedMethod.wallet_address}
                  </p>
                  <button onClick={() => { navigator.clipboard.writeText(selectedMethod.wallet_address).then(() => showToast("تم نسخ الرقم!", 'success')).catch(() => showToast("فشل النسخ", 'error')); }}
                    className="flex items-center gap-1 bg-brand text-white text-[10px] font-bold px-2 py-1 rounded-md shrink-0">
                    <Copy size={11} /> نسخ
                  </button>
                </div>
                <WalletQrButton address={selectedMethod.wallet_address} enabled={selectedMethod.qr_enabled} alwaysOpen={selectedMethod.qr_always_open} qrMode={selectedMethod.qr_mode} qrImageUrl={selectedMethod.qr_image_url} methodName={selectedMethod.name} />
                {selectedMethod.min_amount > 0 && (
                  <p className="text-xs text-brand mt-2 font-bold">
                    أقل مبلغ: {!isUsdWallet
                      ? `${Math.round(selectedMethod.min_amount * exchangeRate).toLocaleString("en-US")} ${currencySymbol}`
                      : `${selectedMethod.min_amount} $`}
                  </p>
                )}
                {(selectedMethod as any).bonus_type && (selectedMethod as any).bonus_percent > 0 && (selectedMethod as any).bonus_visible !== false && (
                  <p className={`text-xs mt-1 font-bold ${(selectedMethod as any).bonus_type === "bonus" ? "text-green-600" : "text-red-500"}`}>
                    {(selectedMethod as any).bonus_type === "bonus"
                      ? `🎁 بونص ${(selectedMethod as any).bonus_percent}% على هذه الطريقة`
                      : `⚠️ عمولة ${(selectedMethod as any).bonus_percent}% على هذه الطريقة`}
                  </p>
                )}
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">
                    {isUsdWallet ? "المبلغ المرسل بالدولار ($)" : `المبلغ المرسل بـ ${currencyName} (${currencySymbol})`}
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={walletAmount}
                    onChange={e => setWalletAmount(e.target.value)}
                    placeholder={isUsdWallet ? "0.00" : "مثال: 50000"}
                    className="w-full bg-gray-50 border border-gray-100 rounded-lg px-4 py-3 outline-none focus:border-brand"
                  />
                  {/* عرض سعر الصرف والمكافئ بالدولار دائماً — بما فيها حالة الدولار نفسه (1$ = 1$) */}
                  {walletAmountNum > 0 && usdEquivalent !== null && (
                    <p className={`text-xs font-bold rounded-md px-3 py-2 ${isUsdWallet ? "text-emerald-700 bg-emerald-50" : "text-amber-700 bg-amber-50"}`}>
                      {walletAmountNum.toLocaleString("en-US")} {currencySymbol} = {usdEquivalent} $
                    </p>
                  )}
                  {!isUsdWallet && (
                    <p className="text-[11px] text-gray-400">1 $ = {exchangeRate.toLocaleString("en-US")} {currencySymbol}</p>
                  )}
                  {walletAmountNum > 0 && (selectedMethod as any).bonus_type && (selectedMethod as any).bonus_type !== "none" && (selectedMethod as any).bonus_percent > 0 && (selectedMethod as any).bonus_visible !== false && (() => {
                    const bonusType = (selectedMethod as any).bonus_type;
                    const bonusPercent = (selectedMethod as any).bonus_percent;
                    const isBonus = bonusType === "bonus";
                    const finalAmount = isBonus
                      ? walletAmountNum * (1 + bonusPercent / 100)
                      : walletAmountNum * (1 - bonusPercent / 100);
                    const finalAmountFormatted = Number.isInteger(finalAmount) ? finalAmount.toLocaleString("en-US") : finalAmount.toLocaleString("en-US", { maximumFractionDigits: 2 });
                    return (
                      <p className={`text-xs font-bold rounded-md px-3 py-2 ${isBonus ? "text-green-700 bg-green-50" : "text-red-600 bg-red-50"}`}>
                        {isBonus ? `🎁 بونص إيداع بنسبة ${bonusPercent}%` : `⚠️ عمولة إيداع بنسبة ${bonusPercent}%`} — المبلغ الذي {isBonus ? "ستحصل" : "سيُخصم و ستحصل"} عليه هو {finalAmountFormatted} {currencySymbol}
                      </p>
                    );
                  })()}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">رقم العملية (Transaction ID)</label>
                  <input type="text" value={walletTxNumber} onChange={e => setWalletTxNumber(e.target.value)}
                    placeholder={selectedMethod.method_type === 'syriatel' ? 'مثال: TXN_12345' : selectedMethod.method_type === 'binance' ? 'مثال: 448233816541765632' : (selectedMethod.method_type === 'crypto_usdt_trc20' || selectedMethod.method_type === 'crypto_usdt_bep20') ? 'هاش العملية (Transaction Hash)' : 'مثال: 202235201'}
                    className="w-full bg-gray-50 border border-gray-100 rounded-lg px-4 py-3 outline-none focus:border-brand font-mono" />
                  <p className="text-xs text-gray-400">أدخل رقم العملية كما يظهر في تطبيق {selectedMethod.name}</p>
                </div>
                <button disabled={walletLoading || !walletTxNumber || !walletAmount} onClick={handleAutoTopUp}
                  className="w-full bg-brand text-white py-4 rounded-lg font-bold shadow-lg shadow-brand-soft disabled:opacity-50">
                  {walletLoading ? "جاري التحقق..." : "تحقق وشحن فوراً"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="bg-brand-light p-4 rounded-lg border border-brand-soft text-center space-y-2">
                <p className="text-brand text-xs font-semibold mb-1">رقم المحفظة / العنوان</p>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <p
                    className="text-sm font-bold text-brand tracking-wider break-all cursor-pointer select-none"
                    onContextMenu={e => e.preventDefault()}
                    onTouchStart={() => startAddressLongPress(selectedMethod.wallet_address)}
                    onTouchEnd={cancelAddressLongPress}
                    onTouchMove={cancelAddressLongPress}
                    onMouseDown={() => startAddressLongPress(selectedMethod.wallet_address)}
                    onMouseUp={cancelAddressLongPress}
                    onMouseLeave={cancelAddressLongPress}
                  >
                    {selectedMethod.wallet_address}
                  </p>
                  <button onClick={() => { navigator.clipboard.writeText(selectedMethod.wallet_address).then(() => showToast("تم نسخ عنوان المحفظة!", 'success')).catch(() => showToast("فشل النسخ", 'error')); }}
                    className="flex items-center gap-1 bg-brand text-white text-[10px] font-bold px-2 py-1 rounded-md shrink-0">
                    <Copy size={11} /> نسخ
                  </button>
                </div>
                <WalletQrButton address={selectedMethod.wallet_address} enabled={selectedMethod.qr_enabled} alwaysOpen={selectedMethod.qr_always_open} qrMode={selectedMethod.qr_mode} qrImageUrl={selectedMethod.qr_image_url} methodName={selectedMethod.name} />
                <p className="text-[10px] text-brand/70 font-medium">طريقة الدفع: {selectedMethod.name}</p>
                {selectedMethod.description && <p className="text-xs text-brand/60 font-light mt-1">{selectedMethod.description}</p>}
                {selectedMethod.min_amount > 0 && (
                  <p className="text-xs text-brand mt-1 font-bold">
                    أقل مبلغ: {!isUsdWallet
                      ? `${Math.round(selectedMethod.min_amount * exchangeRate).toLocaleString("en-US")} ${currencySymbol}`
                      : `${selectedMethod.min_amount} $`}
                  </p>
                )}
                {(selectedMethod as any).bonus_type && (selectedMethod as any).bonus_percent > 0 && (selectedMethod as any).bonus_visible !== false && (
                  <p className={`text-xs mt-1 font-bold ${(selectedMethod as any).bonus_type === "bonus" ? "text-green-600" : "text-red-500"}`}>
                    {(selectedMethod as any).bonus_type === "bonus"
                      ? `🎁 بونص ${(selectedMethod as any).bonus_percent}% على هذه الطريقة`
                      : `⚠️ عمولة ${(selectedMethod as any).bonus_percent}% على هذه الطريقة`}
                  </p>
                )}
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">
                    {isUsdWallet ? "المبلغ المراد شحنه ($)" : `المبلغ المراد شحنه بـ ${currencyName} (${currencySymbol})`}
                  </label>
                  <input type="text" inputMode="decimal" value={walletAmount} onChange={e => setWalletAmount(e.target.value)} placeholder={isUsdWallet ? "0.00" : "مثال: 50000"}
                    className="w-full bg-gray-50 border border-gray-100 rounded-lg px-4 py-3 outline-none focus:border-brand" />
                  {walletAmountNum > 0 && usdEquivalent !== null && (
                    <p className={`text-xs font-bold rounded-md px-3 py-2 ${isUsdWallet ? "text-emerald-700 bg-emerald-50" : "text-amber-700 bg-amber-50"}`}>
                      {walletAmountNum.toLocaleString("en-US")} {currencySymbol} = {usdEquivalent} $
                    </p>
                  )}
                  {!isUsdWallet && (
                    <p className="text-[11px] text-gray-400">1 $ = {exchangeRate.toLocaleString("en-US")} {currencySymbol}</p>
                  )}
                  {walletAmountNum > 0 && (selectedMethod as any).bonus_type && (selectedMethod as any).bonus_type !== "none" && (selectedMethod as any).bonus_percent > 0 && (selectedMethod as any).bonus_visible !== false && (() => {
                    const bonusType = (selectedMethod as any).bonus_type;
                    const bonusPercent = (selectedMethod as any).bonus_percent;
                    const isBonus = bonusType === "bonus";
                    const finalAmount = isBonus
                      ? walletAmountNum * (1 + bonusPercent / 100)
                      : walletAmountNum * (1 - bonusPercent / 100);
                    const finalAmountFormatted = Number.isInteger(finalAmount) ? finalAmount.toLocaleString("en-US") : finalAmount.toLocaleString("en-US", { maximumFractionDigits: 2 });
                    return (
                      <p className={`text-xs font-bold rounded-md px-3 py-2 ${isBonus ? "text-green-700 bg-green-50" : "text-red-600 bg-red-50"}`}>
                        {isBonus ? `🎁 بونص إيداع بنسبة ${bonusPercent}%` : `⚠️ عمولة إيداع بنسبة ${bonusPercent}%`} — المبلغ الذي {isBonus ? "ستحصل" : "سيُخصم و ستحصل"} عليه هو {finalAmountFormatted} {currencySymbol}
                      </p>
                    );
                  })()}
                </div>
                {noteEnabled && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 flex items-center gap-1">
                      {noteField?.label || "ملاحظات إضافية"}
                      {noteField?.required
                        ? <span className="text-red-400 text-xs">*</span>
                        : <span className="text-gray-400 text-xs font-normal">(اختياري)</span>}
                    </label>
                    <textarea value={walletNote} onChange={e => setWalletNote(e.target.value)} placeholder="اختياري..."
                      className="w-full bg-gray-50 border border-gray-100 rounded-lg px-4 py-3 outline-none focus:border-brand h-24 resize-none" />
                  </div>
                )}
                {imageEnabled && (
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 flex items-center gap-1">
                      {imageField?.label || "إرفاق صورة الإيصال"}
                      {imageField?.required
                        ? <span className="text-red-400 text-xs">*</span>
                        : <span className="text-gray-400 text-xs font-normal">(اختياري)</span>}
                    </label>
                    <label className={`w-full h-32 border-2 border-dashed border-gray-200 rounded-lg text-gray-400 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors relative isolate overflow-hidden ${walletReceiptUrl ? "" : "flex flex-col items-center justify-center gap-2"}`}>
                      {walletReceiptUrl ? (
                        <>
                          {!receiptImgError ? (
                            <img
                              key={walletReceiptUrl}
                              src={walletReceiptUrl}
                              alt="Receipt"
                              className="absolute inset-0 w-full h-full object-cover block z-0"
                              onError={() => setReceiptImgError(true)}
                            />
                          ) : (
                            <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-2 bg-gray-50 z-0">
                              <ImageIcon size={32} />
                              <span className="text-xs">تم الرفع بنجاح</span>
                            </div>
                          )}
                          <button type="button" onClick={clearReceipt} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600 transition-colors z-30"><X size={16} /></button>
                        </>
                      ) : (
                        <>
                          <ImageIcon size={32} />
                          <span className="text-xs">{walletUploading ? "جاري الرفع..." : "اضغط لرفع الصورة"}</span>
                        </>
                      )}
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={walletUploading} />
                    </label>
                  </div>
                )}
                {walletCustomFields.map(field => (
                  <div key={field.id} className="space-y-2">
                    <label className="text-sm font-bold text-gray-700 flex items-center gap-1">
                      {field.label}
                      {field.required
                        ? <span className="text-red-400 text-xs">*</span>
                        : <span className="text-gray-400 text-xs font-normal">(اختياري)</span>}
                    </label>
                    <input type="text" value={walletCustomFieldValues[field.id] || ""} onChange={e => setWalletCustomFieldValues(prev => ({ ...prev, [field.id]: e.target.value }))}
                      placeholder={field.label}
                      className="w-full bg-gray-50 border border-gray-100 rounded-lg px-4 py-3 outline-none focus:border-brand" />
                  </div>
                ))}
                <button disabled={walletLoading || walletUploading || !walletAmount || (imageRequired && !walletReceiptUrl)} onClick={handleTopUp}
                  className="w-full bg-brand text-white py-4 rounded-lg font-bold shadow-lg shadow-brand-soft disabled:opacity-50">
                  {walletLoading ? "جاري الإرسال..." : "إرسال طلب التحقق"}
                </button>
              </div>
            </>
          )}
        </div>

        {/* [INVOICE-RESTYLE] عرض مكبَّر لعنوان المحفظة بعد الضغط المطوّل عليه */}
        {zoomedAddress && (
          <div
            className="fixed inset-0 z-[1000] bg-black/60 flex items-center justify-center p-4"
            onClick={() => setZoomedAddress(null)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="bg-white rounded-2xl p-5 w-full max-w-xs text-center space-y-3 shadow-xl"
              onClick={e => e.stopPropagation()}
              dir="rtl"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-800">عنوان المحفظة</h3>
                <button type="button" onClick={() => setZoomedAddress(null)} className="p-1 rounded-full bg-gray-100 text-gray-600" aria-label="إغلاق">
                  <X size={16} />
                </button>
              </div>
              <p className="text-lg font-bold text-gray-800 break-all leading-relaxed" dir="ltr">{zoomedAddress}</p>
              <button
                type="button"
                onClick={() => { navigator.clipboard.writeText(zoomedAddress).then(() => showToast("تم نسخ العنوان!", 'success')).catch(() => showToast("فشل النسخ", 'error')); }}
                className="w-full flex items-center justify-center gap-1.5 bg-brand text-white text-xs font-bold px-3 py-2 rounded-lg"
              >
                <Copy size={12} /> نسخ
              </button>
            </div>
          </div>
        )}

        {/* [FIX] عرض مكبَّر لـ QR الفاتورة في منتصف الصفحة مع زر إغلاق × */}
        {qrZoomOpen && invoiceQrDataUrl && (
          <div
            className="fixed inset-0 z-[1000] bg-black/60 flex items-center justify-center p-4"
            onClick={() => setQrZoomOpen(false)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="bg-white rounded-2xl p-5 w-full max-w-xs text-center space-y-3 shadow-xl"
              onClick={e => e.stopPropagation()}
              dir="rtl"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-800">QR عنوان المحفظة</h3>
                <button type="button" onClick={() => setQrZoomOpen(false)} className="p-1 rounded-full bg-gray-100 text-gray-600" aria-label="إغلاق">
                  <X size={16} />
                </button>
              </div>
              <div className="bg-white p-2 rounded-xl border border-gray-100 flex items-center justify-center">
                <img src={invoiceQrDataUrl} alt="QR عنوان المحفظة" className="w-full h-auto" style={{ imageRendering: "pixelated" }} />
              </div>
              <p className="text-[11px] text-gray-500 break-all font-mono" dir="ltr">{selectedMethod.wallet_address}</p>
            </div>
          </div>
        )}

        {/* نفس عرض QR المكبَّر، لعنوان محفظة رمز الشحن التلقائي */}
        {autoCodeQrZoomOpen && autoCodeQrDataUrl && autoCode && (
          <div
            className="fixed inset-0 z-[1000] bg-black/60 flex items-center justify-center p-4"
            onClick={() => setAutoCodeQrZoomOpen(false)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="bg-white rounded-2xl p-5 w-full max-w-xs text-center space-y-3 shadow-xl"
              onClick={e => e.stopPropagation()}
              dir="rtl"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-800">QR عنوان المحفظة</h3>
                <button type="button" onClick={() => setAutoCodeQrZoomOpen(false)} className="p-1 rounded-full bg-gray-100 text-gray-600" aria-label="إغلاق">
                  <X size={16} />
                </button>
              </div>
              <div className="bg-white p-2 rounded-xl border border-gray-100 flex items-center justify-center">
                <img src={autoCodeQrDataUrl} alt="QR عنوان المحفظة" className="w-full h-auto" style={{ imageRendering: "pixelated" }} />
              </div>
              <p className="text-[11px] text-gray-500 break-all font-mono" dir="ltr">{autoCode.walletAddress}</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  const sortedMethods = [...paymentMethods].sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0));

  return (
    <div className="px-4 space-y-6 pb-20">
      <h2 className="text-2xl font-bold text-gray-800 mb-1">شحن الرصيد</h2>

      {/* بطاقة استرداد كود الرصيد */}
      <button onClick={() => setView({ type: "voucher_redeem" })}
        className="w-full bg-gradient-to-r from-brand to-brand-soft p-5 rounded-lg text-white shadow-lg shadow-brand-soft flex items-center justify-between active:scale-[0.98] transition-transform">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center shrink-0"><Ticket size={26} /></div>
          <div className="text-right">
            <h3 className="font-bold text-base">استرداد كود رصيد</h3>
            <p className="text-white/80 text-[11px]">اشحن رصيدك عبر الأكواد والقسائم</p>
          </div>
        </div>
        <ChevronRight size={22} className="text-white/60 shrink-0" />
      </button>

      {/* طرق الشحن المباشر */}
      <div className="space-y-3">
        <h3 className="font-bold text-gray-800">طرق الشحن المباشر</h3>
        {sortedMethods.length > 0 ? (
          <div className={`grid ${gridColsClass(appearance.pay_columns_mobile, appearance.pay_columns_desktop)} gap-2`}>
            {sortedMethods.map(method => (
              <button key={method.id} onClick={() => setSelectedMethod(method)}
                className={`relative overflow-hidden transition-colors active:scale-95 ${itemCardChrome(appearance, "bg-white rounded-lg border border-gray-100 shadow-sm hover:border-brand-soft")}`}>
                {(method as any).bonus_type && (method as any).bonus_percent > 0 && (method as any).bonus_visible !== false && (
                  <span className={`absolute top-1 left-1 z-10 px-1.5 py-0.5 rounded-full text-[8px] font-bold text-white shadow-sm ${(method as any).bonus_type === "bonus" ? "bg-green-500" : "bg-red-500"}`}>
                    {(method as any).bonus_type === "bonus" ? "بونص +" : "عمولة -"}{(method as any).bonus_percent}%
                  </span>
                )}
                <div className="w-full flex items-center justify-center bg-gray-50 py-1.5">
                  <div className={`w-3/4 ${ratioToClass(appearance.pay_image_ratio)} overflow-hidden rounded-md`}>
                    <OptimizedImage src={method.image_url || "https://picsum.photos/seed/pay/100/100"} width={180} height={180} alt={method.name} className="w-full h-full object-cover" />
                  </div>
                </div>
                <div className="px-1.5 py-1.5">
                  <span className="font-bold text-gray-800 text-[9px] text-center block leading-tight text-pay-name">{method.name}</span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 text-gray-400 text-sm bg-white rounded-lg border border-gray-100">
            لا توجد طرق شحن متاحة حالياً
          </div>
        )}
      </div>
    </div>
  );
// إغلاق React.memo
}, (prevProps, nextProps) => {
  // نعيد الرسم فقط عند تغيير paymentMethods أو user.id أو user.balance
  // هذا يمنع إعادة رسم المكوّن عند تحديث بيانات المستخدم الأخرى
  if (prevProps.paymentMethods !== nextProps.paymentMethods) return false;
  if (prevProps.user?.id !== nextProps.user?.id) return false;
  if (prevProps.user?.balance !== nextProps.user?.balance) return false;
  return true;
});
// ===================== END WALLET CHARGE VIEW =====================

export interface WalletPageProps {
  user: UserData | null;
  paymentMethods: PaymentMethod[];
  setView: (val: any) => void;
  fetchUser: (id: number) => void;
  fetchTransactions: () => void;
  sypRate: number;
  appearance?: StoreAppearance;
}

const WalletPage = ({
  user,
  paymentMethods,
  setView,
  fetchUser,
  fetchTransactions,
  sypRate,
  appearance,
}: WalletPageProps) => (
  <WalletChargeView
    user={user}
    paymentMethods={paymentMethods}
    setView={setView}
    fetchUser={fetchUser}
    fetchTransactions={fetchTransactions}
    sypRate={sypRate}
    appearance={appearance}
  />
);

export default WalletPage;
