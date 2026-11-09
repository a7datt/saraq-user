import React, { useState, useEffect } from "react";
import { Mail, RotateCcw } from "lucide-react";
import { getDeviceInfoHeader } from "../utils/deviceFingerprint";

export interface VerifyEmailViewProps {
  email: string;
  onSuccess: (userData?: any) => void;
  type?: "verify" | "reset";
}

export default function VerifyEmailView({ email, onSuccess, type = "verify" }: VerifyEmailViewProps) {
  const [digits, setDigits] = useState<string[]>(["","","","","",""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendTimer, setResendTimer] = useState(60);
  const [resending, setResending] = useState(false);
  const inputRefs = Array.from({ length: 6 }, () => React.useRef<HTMLInputElement>(null));

  useEffect(() => {
    inputRefs[0].current?.focus();
    const t = setInterval(() => setResendTimer(s => s > 0 ? s - 1 : 0), 1000);
    return () => clearInterval(t);
  }, []);

  const handleDigit = (i: number, val: string) => {
    const v = val.replace(/[^0-9]/g, "").slice(-1);
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    if (v && i < 5) inputRefs[i + 1].current?.focus();
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      inputRefs[i - 1].current?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData("text").replace(/[^0-9]/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setDigits(pasted.split(""));
      inputRefs[5].current?.focus();
    }
  };

  const handleVerify = async () => {
    const code = digits.join("");
    if (code.length < 6) return setError("أدخل الرمز المكون من 6 أرقام");
    setLoading(true); setError("");
    try {
      const endpoint = type === "verify" ? "/api/auth/verify-email" : "/api/auth/verify-reset-otp";
      // [Device Fingerprint] الـ header يُرسل فقط عند تفعيل حساب جديد (type=verify) — هذه هي
      // اللحظة التي يفحص فيها الباك إند تطابق بصمة الجهاز مع حساب محظور آخر. لا حاجة له عند
      // استرجاع كلمة المرور (type=reset) لأن الحساب موجود ومفعّل أصلاً.
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(type === "verify" ? { "X-Device-Info": getDeviceInfoHeader() } : {}),
        },
        body: JSON.stringify({ email, code })
      });
      const data = await res.json();
      if (res.ok) {
        onSuccess(data);
      } else {
        setError(data.error || "الرمز غير صحيح");
        setDigits(["","","","","",""]);
        inputRefs[0].current?.focus();
      }
    } catch { setError("خطأ في الاتصال"); }
    finally { setLoading(false); }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setResending(true);
    try {
      await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, type })
      });
      setResendTimer(60);
      setDigits(["","","","",""," "]);
      setDigits(["","","","","",""]);
      inputRefs[0].current?.focus();
    } catch {}
    finally { setResending(false); }
  };

  return (
    <div className="px-6 flex flex-col items-center justify-center min-h-[80vh] pb-20">
      <div className="w-20 h-20 bg-brand rounded-lg flex items-center justify-center text-white shadow-xl shadow-brand-soft mb-8">
        <Mail size={40} />
      </div>
      <h2 className="text-2xl font-bold text-gray-800 mb-2">
        {type === "verify" ? "تحقق من بريدك" : "أدخل رمز التحقق"}
      </h2>
      <p className="text-gray-400 text-sm mb-2 text-center">
        أرسلنا رمزاً مكوناً من 6 أرقام إلى
      </p>
      <p className="text-brand font-bold text-sm mb-8 text-center">{email}</p>

      {/* OTP Boxes */}
      <div className="flex gap-3 mb-6 dir-ltr" dir="ltr" onPaste={handlePaste}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={inputRefs[i]}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={e => handleDigit(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            className={`w-12 h-14 text-center text-2xl font-black rounded-lg border-2 outline-none transition-all
              ${d ? 'border-brand bg-brand-light text-brand' : 'border-gray-200 bg-white text-gray-800'}
              focus:border-brand focus:bg-brand-light`}
          />
        ))}
      </div>

      {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}

      <button
        disabled={loading || digits.join("").length < 6}
        onClick={handleVerify}
        className="w-full bg-brand text-white py-4 rounded-lg font-bold shadow-lg shadow-brand-soft disabled:opacity-50 mb-4"
      >
        {loading ? "جاري التحقق..." : "تأكيد الرمز"}
      </button>

      <button
        disabled={resendTimer > 0 || resending}
        onClick={handleResend}
        className="flex items-center gap-2 text-sm font-bold disabled:text-gray-300 text-brand"
      >
        <RotateCcw size={16} />
        {resendTimer > 0 ? `إعادة الإرسال بعد ${resendTimer}s` : (resending ? "جاري الإرسال..." : "إعادة إرسال الرمز")}
      </button>

      {/* Spam tip */}
      <div className="mt-6 mx-auto max-w-xs bg-amber-50 border border-amber-100 rounded-lg p-4">
        <p className="text-[11px] text-amber-700 text-center leading-relaxed">
          <span className="font-bold block mb-1">لا ترى البريد الإلكتروني؟</span>
          في حال عدم رؤيتك للبريد من البريد الوارد، اضغط على القائمة الجانبية
          <span className="font-bold mx-1">|||</span>
          ثم اذهب إلى <span className="font-bold">الرسائل غير المرغوب فيها</span>، حدّث الصفحة وسترى الإيميل.
        </p>
      </div>
    </div>
  );
}
