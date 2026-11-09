import { useState } from "react";
import { KeyRound, Check, Dumbbell } from "lucide-react";
import { UserData } from "../types";
import VerifyEmailView from "../components/VerifyEmailView";

export interface ForgotPasswordPageProps {
  setUser: (data: UserData) => void;
  setView: (val: any) => void;
  setActiveTab: (tab: string) => void;
  initialEmail?: string;
  lockEmail?: boolean;
  backView?: any;
}

export default function ForgotPasswordPage({ setUser, setView, setActiveTab, initialEmail, lockEmail, backView }: ForgotPasswordPageProps) {
  const [step, setStep] = useState<"email" | "otp" | "newpass">("email");
  const [email, setEmail] = useState(initialEmail || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState("");

  const handleSendOtp = async () => {
    if (!email) return setError("أدخل بريدك الإلكتروني");
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (res.ok) { setStep("otp"); }
      else { setError(data.error || "حدث خطأ"); }
    } catch { setError("خطأ في الاتصال"); }
    finally { setLoading(false); }
  };

  const handleResetPassword = async () => {
    if (newPassword.length < 8) return setError("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
    if (!/[A-Za-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) return setError("يجب أن تحتوي كلمة المرور على أحرف وأرقام");
    if (newPassword !== confirmPassword) return setError("كلمتا المرور غير متطابقتين");
    setResetting(true); setError("");
    try {
      // We pass a dummy code here since OTP was already verified in step "otp"
      // Server accepts recently-verified OTPs
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: "verified", newPassword })
      });
      const data = await res.json();
      if (res.ok) {
        // Auto login after password reset
        const loginRes = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password: newPassword })
        });
        const loginData = await loginRes.json();
        if (loginRes.ok && loginData.id) {
          setUser(loginData);
          if (loginData.token) localStorage.setItem("authToken", loginData.token);
          localStorage.setItem("userId", String(loginData.id));
          setView({ type: "main" });
          setActiveTab("home");
        } else {
          setView({ type: "login" });
        }
      } else { setError(data.error || "حدث خطأ"); }
    } catch { setError("خطأ في الاتصال"); }
    finally { setResetting(false); }
  };

  // Step 3: New password
  if (step === "newpass") {
    const getStrength = (pw: string) => {
      let s = 0;
      if (pw.length >= 8) s++;
      if (pw.length >= 12) s++;
      if (/[A-Z]/.test(pw)) s++;
      if (/[0-9]/.test(pw)) s++;
      if (/[^A-Za-z0-9]/.test(pw)) s++;
      return s;
    };
    const score = getStrength(newPassword);
    const levels = [
      { label: "ضعيفة جداً", color: "bg-red-500", width: "w-1/5" },
      { label: "ضعيفة", color: "bg-orange-400", width: "w-2/5" },
      { label: "متوسطة", color: "bg-yellow-400", width: "w-3/5" },
      { label: "جيدة", color: "bg-blue-500", width: "w-4/5" },
      { label: <span className="inline-flex items-center gap-1">قوية <Dumbbell size={12} className="inline" /></span>, color: "bg-green-500", width: "w-full" },
    ];
    const lvl = levels[Math.min(score, 4)];
    return (
      <div className="px-6 flex flex-col items-center justify-center min-h-[80vh] pb-20">
        <div className="w-20 h-20 bg-brand rounded-lg flex items-center justify-center text-white shadow-xl shadow-brand-soft mb-6">
          <KeyRound size={40} />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-1">كلمة مرور جديدة</h2>
        <p className="text-gray-400 text-sm mb-8 text-center">تم التأكيد · اكتب كلمة المرور الجديدة</p>
        <div className="w-full space-y-4">
          <div className="space-y-2">
            <input type="password" placeholder="كلمة المرور الجديدة"
              value={newPassword} onChange={e => setNewPassword(e.target.value)}
              className="w-full bg-white border border-gray-100 rounded-lg px-5 py-4 outline-none focus:border-brand shadow-sm"/>
            {newPassword.length > 0 && (
              <div className="space-y-1 px-1">
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-300 ${lvl.color} ${lvl.width}`} />
                </div>
                <p className={`text-[11px] font-bold ${score < 2 ? "text-red-500" : score < 4 ? "text-yellow-600" : "text-green-600"}`}>
                  قوة كلمة المرور: {lvl.label}
                </p>
                <ul className="text-[10px] text-gray-400 space-y-0.5">
                  <li className={newPassword.length >= 8 ? "text-green-500" : ""}><Check size={12} className="inline" /> 8 أحرف على الأقل</li>
                  <li className={/[A-Za-z]/.test(newPassword) ? "text-green-500" : ""}><Check size={12} className="inline" /> أحرف إنجليزية</li>
                  <li className={/[0-9]/.test(newPassword) ? "text-green-500" : ""}><Check size={12} className="inline" /> أرقام (0-9)</li>
                  <li className={/[^A-Za-z0-9]/.test(newPassword) ? "text-green-500" : ""}><Check size={12} className="inline" /> رمز خاص (!@#...)</li>
                </ul>
              </div>
            )}
          </div>
          <input type="password" placeholder="تأكيد كلمة المرور"
            value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
            className={`w-full bg-white border rounded-lg px-5 py-4 outline-none shadow-sm ${confirmPassword && confirmPassword !== newPassword ? "border-red-300 focus:border-red-400" : "border-gray-100 focus:border-brand"}`}/>
          {confirmPassword && confirmPassword !== newPassword && (
            <p className="text-red-500 text-xs text-center">كلمتا المرور غير متطابقتين</p>
          )}
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
          <button disabled={resetting || score < 2 || newPassword !== confirmPassword} onClick={handleResetPassword}
            className="w-full bg-brand text-white py-4 rounded-lg font-bold shadow-lg shadow-brand-soft disabled:opacity-50">
            {resetting ? "جاري الحفظ..." : "حفظ كلمة المرور وتسجيل الدخول"}
          </button>
        </div>
      </div>
    );
  }

  // Step 2: OTP verification
  if (step === "otp") {
    return (
      <VerifyEmailView
        email={email}
        type="reset"
        onSuccess={() => setStep("newpass")}
      />
    );
  }

  // Step 1: Enter email
  return (
    <div className="px-6 flex flex-col items-center justify-center min-h-[80vh] pb-20">
      <div className="w-20 h-20 bg-brand rounded-lg flex items-center justify-center text-white shadow-xl shadow-brand-soft mb-6">
        <KeyRound size={40} />
      </div>
      <h2 className="text-2xl font-bold text-gray-800 mb-1">استرداد كلمة المرور</h2>
      <p className="text-gray-400 text-sm mb-8 text-center">
        {lockEmail ? "سيتم إرسال رمز التحقق إلى بريدك الإلكتروني المرتبط بالحساب" : "لاسترداد كلمة مرورك ضع الإيميل بالأسفل"}
      </p>
      <div className="w-full space-y-4">
        {lockEmail ? (
          <div className="w-full bg-gray-50 border border-gray-100 rounded-lg px-5 py-4 text-gray-700 font-medium text-center">
            {email || "—"}
          </div>
        ) : (
          <input type="email" placeholder="البريد الإلكتروني"
            value={email} onChange={e => setEmail(e.target.value)}
            className="w-full bg-white border border-gray-100 rounded-lg px-5 py-4 outline-none focus:border-brand shadow-sm"
            onKeyDown={e => e.key === "Enter" && handleSendOtp()}
          />
        )}
        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        <button disabled={loading || !email} onClick={handleSendOtp}
          className="w-full bg-brand text-white py-4 rounded-lg font-bold shadow-lg shadow-brand-soft disabled:opacity-50">
          {loading ? "جاري الإرسال..." : "تأكيد"}
        </button>
        <button onClick={() => setView(backView || { type: "login" })}
          className="w-full text-gray-400 text-sm font-medium pt-1">
          {lockEmail ? "العودة لتعديل الملف الشخصي" : "العودة لتسجيل الدخول"}
        </button>
      </div>
    </div>
  );
}
