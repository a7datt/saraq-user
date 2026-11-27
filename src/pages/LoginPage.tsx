import React, { useState, useEffect, useRef } from "react";
import { Phone, Check, Dumbbell, Mail, Lock, User, Eye, EyeOff, Gift, Briefcase } from "lucide-react";
import CountryCodePhoneInput, { isValidPhoneForCountry, getRequiredDigits } from "../components/CountryCodePhoneInput";
import { UserData } from "../types";
import VerifyEmailView from "../components/VerifyEmailView";
import { getDeviceInfoHeader } from "../utils/deviceFingerprint";

interface Theme {
  primary: string;
  primaryHover: string;
  text: string;
  textDark: string;
  bgLight: string;
  border: string;
  shadow: string;
  gradient: string;
  icon: string;
  button: string;
  buttonHover: string;
}

export interface LoginPageProps {
  theme: Theme;
  setUser: (data: UserData) => void;
  setView: (val: any) => void;
  setActiveTab: (tab: string) => void;
}

// ──────────────────────────────────────────────────────────────
// حقل إدخال موحّد بأيقونة — لإعادة استخدام نفس الشكل البصري
// ──────────────────────────────────────────────────────────────
interface FieldProps {
  icon: React.ReactNode;
  type: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  autoComplete?: string;
  pattern?: string;
  rightSlot?: React.ReactNode;
}

function InputField({ icon, type, placeholder, value, onChange, autoComplete, pattern, rightSlot }: FieldProps) {
  return (
    <div className="relative">
      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none">
        {icon}
      </span>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        pattern={pattern}
        className="w-full bg-white border border-gray-100 rounded-xl pr-12 pl-12 py-4 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-light/40 shadow-sm transition-all"
      />
      {rightSlot && (
        <span className="absolute left-4 top-1/2 -translate-y-1/2">
          {rightSlot}
        </span>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// مؤشر قوة كلمة المرور
// ──────────────────────────────────────────────────────────────
function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const levels = [
    { label: "ضعيفة جداً", color: "bg-red-500", width: "w-1/5", text: "text-red-500" },
    { label: "ضعيفة", color: "bg-orange-400", width: "w-2/5", text: "text-orange-500" },
    { label: "متوسطة", color: "bg-yellow-400", width: "w-3/5", text: "text-yellow-600" },
    { label: "جيدة", color: "bg-blue-500", width: "w-4/5", text: "text-blue-600" },
    {
      label: (
        <span className="inline-flex items-center gap-1">
          قوية <Dumbbell size={12} className="inline" />
        </span>
      ),
      color: "bg-green-500",
      width: "w-full",
      text: "text-green-600",
    },
  ];
  const lvl = levels[Math.min(score, 4)];

  const rules = [
    { ok: password.length >= 8, label: "8 أحرف على الأقل" },
    { ok: /[A-Z]/.test(password), label: "حرف كبير (A-Z)" },
    { ok: /[0-9]/.test(password), label: "رقم (0-9)" },
    { ok: /[^A-Za-z0-9]/.test(password), label: "رمز خاص (!@#...)" },
  ];

  return (
    <div className="space-y-1.5 px-1 pt-1">
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-300 ${lvl.color} ${lvl.width}`} />
      </div>
      <p className={`text-[11px] font-bold ${lvl.text}`}>كلمة المرور: {lvl.label}</p>
      <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-gray-400">
        {rules.map((r, i) => (
          <li key={i} className={`flex items-center gap-1 ${r.ok ? "text-green-500" : ""}`}>
            <Check size={11} /> {r.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function LoginPage({ theme, setUser, setView, setActiveTab }: LoginPageProps) {
  const [isRegister, setIsRegister] = useState(() => { try { return !!localStorage.getItem("agentCode"); } catch { return false; } });
  // [AGENTS] كود الوكيل (يُعبّأ تلقائياً من رابط الوكيل ?agent=CODE) — يظهر فقط إن كان نظام الوكلاء مفعّلاً
  const [agentCode, setAgentCode] = useState(() => { try { return localStorage.getItem("agentCode") || ""; } catch { return ""; } });
  const [agentsEnabled, setAgentsEnabled] = useState(false);
  useEffect(() => {
    fetch("/api/agents/config").then(r => r.ok ? r.json() : null).then(d => setAgentsEnabled(!!d?.enabled)).catch(() => {});
  }, []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState("+963");
  const [referralCode, setReferralCode] = useState(localStorage.getItem("referralCode") || "");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null);
  // [SEC] Cloudflare Turnstile (CAPTCHA) — يظهر فقط عند ضبط VITE_TURNSTILE_SITEKEY وقت البناء
  const TURNSTILE_SITEKEY: string = (import.meta as any).env?.VITE_TURNSTILE_SITEKEY || "";
  const [captchaToken, setCaptchaToken] = useState("");
  const turnstileRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isRegister || !TURNSTILE_SITEKEY) return;
    let cancelled = false;
    const SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    const ready = new Promise<void>((resolve) => {
      if ((window as any).turnstile) return resolve();
      if (!document.querySelector(`script[src="${SRC}"]`)) {
        const s = document.createElement("script");
        s.src = SRC; s.async = true; s.defer = true; document.head.appendChild(s);
      }
      const iv = setInterval(() => { if ((window as any).turnstile) { clearInterval(iv); resolve(); } }, 100);
      setTimeout(() => { clearInterval(iv); resolve(); }, 10000);
    });
    ready.then(() => {
      if (cancelled || !turnstileRef.current || widgetIdRef.current || !(window as any).turnstile) return;
      try {
        widgetIdRef.current = (window as any).turnstile.render(turnstileRef.current, {
          sitekey: TURNSTILE_SITEKEY,
          callback: (tok: string) => setCaptchaToken(tok),
          "error-callback": () => setCaptchaToken(""),
          "expired-callback": () => setCaptchaToken(""),
          theme: "auto",
        });
      } catch { /* ignore */ }
    });
    return () => { cancelled = true; };
  }, [isRegister, TURNSTILE_SITEKEY]);

  const onAuthSuccess = (data: any) => {
    setUser(data);
    // حفظ الـ token فقط — البيانات الحساسة تبقى في React state
    if (data.token) localStorage.setItem("authToken", data.token);
    localStorage.setItem("userId", String(data.id));
    localStorage.removeItem("referralCode");
    localStorage.removeItem("agentCode");
    setView({ type: "main" });
    setActiveTab("home");
  };

  const handleAuth = async () => {
    setLoading(true);
    setError("");

    // ── Validation محلي قبل الإرسال ──
    if (isRegister) {
      if (!name || name.trim().length < 2 || name.trim().length > 60) {
        setError("الاسم يجب أن يكون بين 2 و60 حرف");
        setLoading(false); return;
      }
      if (/<[^>]*>/.test(name)) {
        setError("الاسم لا يجب أن يحتوي على رموز HTML");
        setLoading(false); return;
      }
      const digitsOnly = phone.replace(/\D/g, "");
      if (!digitsOnly) {
        setError("رقم الهاتف مطلوب");
        setLoading(false); return;
      }
      if (!isValidPhoneForCountry(phoneCountryCode, digitsOnly)) {
        setError(`رقم الهاتف يجب أن يتكون من ${getRequiredDigits(phoneCountryCode)} أرقام بالضبط`);
        setLoading(false); return;
      }
      if (TURNSTILE_SITEKEY && !captchaToken) {
        setError("يرجى إكمال التحقق من الكابتشا");
        setLoading(false); return;
      }
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError("البريد الإلكتروني غير صحيح");
      setLoading(false); return;
    }
    if (password.length < 8) {
      setError("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
      setLoading(false); return;
    }

    const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
    const body = isRegister
      ? { name: name.trim(), email: email.trim().toLowerCase(), password, phone: `${phoneCountryCode}${phone.replace(/\D/g, "")}`, referralCode, captchaToken, ...(agentsEnabled && agentCode.trim() ? { agentCode: agentCode.trim() } : {}) }
      : { email: email.trim().toLowerCase(), password };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Device-Info": getDeviceInfoHeader() },
        body: JSON.stringify(body)
      });

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Expected JSON response from auth API");
      }

      const data = await res.json();
      if (res.ok) {
        if (data.requiresVerification) {
          // Registration success → show OTP verification
          setVerifyEmail(data.email || email);
        } else {
          onAuthSuccess(data);
        }
      } else {
        if (data.requiresVerification) {
          // Account not verified → show OTP
          setVerifyEmail(data.email || email);
        } else {
          setError(data.error || "حدث خطأ ما");
          if (widgetIdRef.current && (window as any).turnstile) { try { (window as any).turnstile.reset(widgetIdRef.current); } catch {} setCaptchaToken(""); }
        }
      }
    } catch (e: any) {
      if (e.name === 'TypeError' && e.message === 'Failed to fetch') {
        setError("فشل الاتصال بالخادم (تأكد من اتصالك بالإنترنت)");
      } else {
        setError("حدث خطأ غير متوقع أثناء تسجيل الدخول");
        console.error("Auth error:", e);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    const clientId = (import.meta as any).env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) { setError("تسجيل الدخول عبر Google غير مفعّل حالياً"); return; }
    setGoogleLoading(true);
    const redirectUri = window.location.origin;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'token',
      scope: 'openid email profile',
      state: 'google_oauth',
      prompt: 'select_account',
      include_granted_scopes: 'true',
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  };

  // شاشة تأكيد البريد عبر OTP
  if (verifyEmail) {
    return (
      <VerifyEmailView
        email={verifyEmail}
        type="verify"
        onSuccess={(userData) => {
          if (userData && userData.id) {
            onAuthSuccess(userData);
          } else {
            setVerifyEmail(null);
          }
        }}
      />
    );
  }

  return (
    <div className="px-4 flex flex-col items-center justify-center min-h-[80vh] pb-20 bg-gray-50">
      <div className="w-full max-w-sm">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
          {/* Header */}
          <h2 className="text-xl font-bold text-gray-800 mb-1 text-center">
            {isRegister ? "إنشاء حساب جديد" : "تسجيل الدخول"}
          </h2>
          <p className="text-gray-400 text-xs mb-5 text-center leading-relaxed">
            أهلاً بك في متجرنا، يرجى إدخال بياناتك للمتابعة
          </p>

          {/* Tab Toggle */}
          <div className="grid grid-cols-2 gap-1 bg-gray-100 rounded-xl p-1 mb-6">
            <button
              type="button"
              onClick={() => { setIsRegister(false); setError(""); }}
              className={`py-2.5 rounded-lg text-sm font-bold transition-all ${
                !isRegister ? "bg-white text-brand shadow-sm" : "text-gray-400"
              }`}
            >
              تسجيل الدخول
            </button>
            <button
              type="button"
              onClick={() => { setIsRegister(true); setError(""); }}
              className={`py-2.5 rounded-lg text-sm font-bold transition-all ${
                isRegister ? "bg-white text-brand shadow-sm" : "text-gray-400"
              }`}
            >
              حساب جديد
            </button>
          </div>

      {/* Form */}
      <div className="w-full space-y-4">
        {isRegister && (
          <InputField
            icon={<User size={18} />}
            type="text"
            placeholder="الاسم الكامل"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}

        <InputField
          icon={<Mail size={18} />}
          type="email"
          placeholder="البريد الإلكتروني"
          value={email}
          onChange={(e) => setEmail(e.target.value.toLowerCase().trim())}
          autoComplete="email"
        />

        {isRegister && (
          <CountryCodePhoneInput
            countryCode={phoneCountryCode}
            onCountryCodeChange={setPhoneCountryCode}
            phone={phone}
            onPhoneChange={(val) => {
              const cleaned = val.replace(/[^\d\s\-]/g, "");
              if (cleaned.length <= 20) setPhone(cleaned);
            }}
          />
        )}

        {isRegister && TURNSTILE_SITEKEY && (
          <div ref={turnstileRef} className="flex justify-center min-h-[65px]" />
        )}

        <div className="space-y-2">
          <InputField
            icon={<Lock size={18} />}
            type={showPassword ? "text" : "password"}
            placeholder="كلمة المرور"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isRegister ? "new-password" : "current-password"}
            rightSlot={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="text-gray-300 hover:text-gray-500 transition-colors"
                aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
          />
          {isRegister && <PasswordStrength password={password} />}
        </div>

        {!isRegister && (
          <button
            type="button"
            onClick={() => setView({ type: "forgot_password" })}
            className="block w-full text-right text-xs text-brand font-bold -mt-1 hover:underline"
          >
            نسيت كلمة المرور؟
          </button>
        )}

        {isRegister && (
          <InputField
            icon={<Gift size={18} />}
            type="text"
            placeholder="كود الإحالة (اختياري)"
            value={referralCode}
            onChange={(e) => setReferralCode(e.target.value)}
          />
        )}

        {isRegister && agentsEnabled && (
          <InputField
            icon={<Briefcase size={18} />}
            type="text"
            placeholder="كود الوكيل (اختياري)"
            value={agentCode}
            onChange={(e) => setAgentCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16))}
          />
        )}

        {error && (
          <p className="text-red-500 text-sm text-center bg-red-50 border border-red-100 rounded-lg py-2.5 px-3">
            {error}
          </p>
        )}

        <button
          type="button"
          disabled={loading}
          onClick={handleAuth}
          className="w-full bg-brand text-white py-4 rounded-xl font-bold text-[15px] shadow-lg shadow-brand-soft disabled:opacity-50 active:scale-[0.98] transition-transform mt-1"
        >
          {loading ? "جاري المعالجة..." : (isRegister ? "إنشاء الحساب" : "دخول")}
        </button>

        {/* Divider */}
        <div className="relative flex items-center py-1">
          <div className="flex-grow border-t border-gray-200" />
          <span className="mx-3 text-xs text-gray-400 font-medium">أو</span>
          <div className="flex-grow border-t border-gray-200" />
        </div>

        {/* Google Sign-In */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={googleLoading}
          className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 rounded-xl py-3.5 font-bold text-gray-700 text-sm active:scale-[0.98] transition-all hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {googleLoading ? (
            <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.6 20H24v8h11.3C33.6 33.6 29.3 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l5.7-5.7C34.6 5.1 29.6 3 24 3 12.4 3 3 12.4 3 24s9.4 21 21 21c11.1 0 20.4-8.1 20.4-21 0-1.4-.1-2.7-.4-4z" />
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.1 8.1 2.9l5.7-5.7C34.6 5.1 29.6 3 24 3 16.3 3 9.7 7.9 6.3 14.7z" />
              <path fill="#4CAF50" d="M24 45c5.5 0 10.4-1.9 14.2-5.1l-6.6-5.4C29.6 36 26.9 37 24 37c-5.2 0-9.6-3.4-11.2-8.1l-6.6 5.1C9.7 41.1 16.3 45 24 45z" />
              <path fill="#1976D2" d="M43.6 20H24v8h11.3c-.8 2.2-2.2 4-4 5.4l6.6 5.4C41.8 35.4 44 30.1 44 24c0-1.4-.1-2.7-.4-4z" />
            </svg>
          )}
          {googleLoading ? "جاري التوجيه إلى Google..." : "تسجيل الدخول عبر Google"}
        </button>
        </div>

        {/* Support — outside card, footer style */}
        <button
          type="button"
          onClick={() => { setActiveTab("profile"); setView({ type: "chat" }); }}
          className="w-full flex items-center justify-center gap-2 text-gray-400 text-xs font-bold pt-5"
        >
          <Phone size={14} /> تواصل مع الدعم الفني
        </button>
      </div>
    </div>
  </div>
  );
}
