import React from "react";
import { ArrowRight, ChevronRight, Copy, Image as ImageIcon, Ticket, X, CheckCircle } from "lucide-react";
import { PaymentMethod, StoreAppearance, UserData } from "../types";
import { showToast } from "../components/ToastContainer";
import OptimizedImage from "../components/OptimizedImage";
import { uploadImage } from "../utils/uploadImage";
import { ensurePaymentMethodDefaultFields, parsePaymentFieldsJson, PaymentFieldDef } from "../utils/defaultFields";
import { ratioToClass, gridColsClass, DEFAULT_APPEARANCE } from "../utils/useStoreAppearance";

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
    }
  };

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
    const walletCur = (selectedMethod as any).currency as { name?: string; symbol?: string; exchange_rate?: number } | null | undefined;
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
        setView({ type: "success", data: `تم شحن ${Number(added).toFixed(4)}$${orig} بنجاح عبر ${selectedMethod.name}!` });
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
    const walletCurrencyLocal = (selectedMethod as any).currency as { name?: string; symbol?: string; exchange_rate?: number } | null | undefined;
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
    const isAuto = selectedMethod.method_type === 'syriatel' || selectedMethod.method_type === 'shamcash';
    // عملة محفظة طريقة الدفع الفعلية (من العملات المحفوظة في لوحة التحكم) — تدعم أي عملة وليس فقط USD/SYP
    const walletCurrency = (selectedMethod as any).currency as { name?: string; symbol?: string; exchange_rate?: number } | null | undefined;
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
    return (
      <div className="px-4 space-y-6 pb-20">
        <div className="flex items-center gap-2 mb-6">
          <button onClick={() => setSelectedMethod(null)} className="p-2 bg-gray-100 rounded-full">
            <ArrowRight size={20} className="text-gray-600" />
          </button>
          <h2 className="text-xl font-bold text-gray-800">شحن عبر {selectedMethod.name}</h2>
        </div>
        <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm space-y-6">
          {isAuto ? (
            <>
              <div className="bg-green-50 p-4 rounded-lg border border-green-100 text-center space-y-1">
                <p className="text-green-700 font-bold text-sm"><CheckCircle size={14} /> شحن تلقائي فوري</p>
                <p className="text-green-600 text-xs">يتم التحقق من العملية تلقائياً وإضافة الرصيد فوراً</p>
              </div>
              <div className="bg-brand-light p-4 rounded-lg border border-brand-soft text-center space-y-2">
                <p className="text-brand text-xs mb-1">{selectedMethod.method_type === 'syriatel' ? 'رقم سيريتل كاش' : 'عنوان شام كاش'}</p>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <p className="text-sm font-bold text-brand tracking-wider break-all">{selectedMethod.wallet_address}</p>
                  <button onClick={() => { navigator.clipboard.writeText(selectedMethod.wallet_address).then(() => showToast("تم نسخ الرقم!", 'success')).catch(() => showToast("فشل النسخ", 'error')); }}
                    className="flex items-center gap-1 bg-brand text-white text-[10px] font-bold px-2 py-1 rounded-md shrink-0">
                    <Copy size={11} /> نسخ
                  </button>
                </div>
                {selectedMethod.min_amount > 0 && (
                  <p className="text-xs text-brand mt-2 font-bold">
                    أقل مبلغ: {!isUsdWallet
                      ? `${Math.round(selectedMethod.min_amount * exchangeRate).toLocaleString("en-US")} ${currencySymbol}`
                      : `${selectedMethod.min_amount} $`}
                  </p>
                )}
                {(selectedMethod as any).bonus_type && (selectedMethod as any).bonus_percent > 0 && (
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
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-gray-700">رقم العملية (Transaction ID)</label>
                  <input type="text" value={walletTxNumber} onChange={e => setWalletTxNumber(e.target.value)}
                    placeholder={selectedMethod.method_type === 'syriatel' ? 'مثال: TXN_12345' : 'مثال: 202235201'}
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
                  <p className="text-sm font-bold text-brand tracking-wider break-all">{selectedMethod.wallet_address}</p>
                  <button onClick={() => { navigator.clipboard.writeText(selectedMethod.wallet_address).then(() => showToast("تم نسخ عنوان المحفظة!", 'success')).catch(() => showToast("فشل النسخ", 'error')); }}
                    className="flex items-center gap-1 bg-brand text-white text-[10px] font-bold px-2 py-1 rounded-md shrink-0">
                    <Copy size={11} /> نسخ
                  </button>
                </div>
                <p className="text-[10px] text-brand/70 font-medium">طريقة الدفع: {selectedMethod.name}</p>
                {selectedMethod.description && <p className="text-xs text-brand/60 font-light mt-1">{selectedMethod.description}</p>}
                {selectedMethod.min_amount > 0 && (
                  <p className="text-xs text-brand mt-1 font-bold">
                    أقل مبلغ: {!isUsdWallet
                      ? `${Math.round(selectedMethod.min_amount * exchangeRate).toLocaleString("en-US")} ${currencySymbol}`
                      : `${selectedMethod.min_amount} $`}
                  </p>
                )}
                {(selectedMethod as any).bonus_type && (selectedMethod as any).bonus_percent > 0 && (
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
                className="relative bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden hover:border-brand-soft transition-colors active:scale-95">
                {(method as any).bonus_type && (method as any).bonus_percent > 0 && (
                  <span className={`absolute top-1 left-1 z-10 px-1.5 py-0.5 rounded-full text-[8px] font-bold text-white shadow-sm ${(method as any).bonus_type === "bonus" ? "bg-green-500" : "bg-red-500"}`}>
                    {(method as any).bonus_type === "bonus" ? "+" : "-"}{(method as any).bonus_percent}%
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
