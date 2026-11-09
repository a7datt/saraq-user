import React, { useState } from "react";
import { ArrowRight, User, Plus, CheckCircle, Download } from "lucide-react";
import { showToast } from "../components/ToastContainer";
import { UserData } from "../types";
import OptimizedImage from "../components/OptimizedImage";
import { uploadImage } from "../utils/uploadImage";
import CountryCodePhoneInput, { isValidPhoneForCountry, getRequiredDigits, splitStoredPhone } from "../components/CountryCodePhoneInput";

interface Theme {
  bgLight: string;
  icon: string;
}

export interface EditProfilePageProps {
  user: UserData | null;
  theme: Theme;
  setView: (val: any) => void;
  fetchUser: (id: number) => void;
}

export default function EditProfilePage({ user, theme, setView, fetchUser }: EditProfilePageProps) {
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const initialPhone = splitStoredPhone(user?.phone);
  const [countryCode, setCountryCode] = useState(initialPhone.countryCode);
  const [phone, setPhone] = useState(initialPhone.digits);
  const [oldPassword, setOldPassword] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [avatarUploading, setAvatarUploading] = useState(false);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const url = await uploadImage(file);
      const token = localStorage.getItem("authToken") || "";
      const updateRes = await fetch(`/api/user/${user?.id}/avatar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ avatar_url: url })
      });
      if (updateRes.ok) { fetchUser(user!.id); showToast("تم تحديث الصورة الشخصية بنجاح", 'success'); }
      else { showToast("فشل تحديث الصورة", 'error'); }
    } catch { showToast("فشل رفع الصورة", 'error'); } finally { setAvatarUploading(false); }
  };

  const handleUpdate = async () => {
    if (!user) return;
    if (password.trim().length > 0 && oldPassword.trim().length === 0) {
      setError("يجب إدخال كلمة المرور القديمة أولاً");
      return;
    }
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length > 0 && !isValidPhoneForCountry(countryCode, phoneDigits)) {
      setError(`رقم الهاتف يجب أن يتكون من ${getRequiredDigits(countryCode)} أرقام بالضبط`);
      return;
    }
    const fullPhone = phoneDigits.length > 0 ? `${countryCode}${phoneDigits}` : "";
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/user/update", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("authToken") || ""}` },
        body: JSON.stringify({ userId: user.id, name, email, phone: fullPhone, password, oldPassword })
      });
      const data = await res.json();
      if (res.ok) {
        await fetchUser(user!.id);
        setView({ type: "success", data: "تم تحديث المعلومات بنجاح" });
      } else {
        setError(data.error || "فشل التحديث");
      }
    } catch (e) {
      setError("خطأ في الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 space-y-6 pb-20">
      <div className="flex items-center justify-between pt-2 mb-2">
        <div className="flex items-center gap-3">
          <button onClick={() => setView({ type: "main" })} className="p-2 bg-gray-100 rounded-lg text-gray-600 active:scale-90 transition-all">
            <ArrowRight size={20} />
          </button>
          <h2 className="font-bold text-gray-800 text-lg">تعديل الملف الشخصي</h2>
        </div>
        <button
          onClick={() => {
            const text = `بيانات دخول متجرنا:\nالاسم: ${user?.name}\nالبريد: ${user?.email}\nرقم الدخول: ${user?.id}`;
            const blob = new Blob([text], { type: "text/plain" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `my_account_info.txt`;
            a.click();
          }}
          className="p-2 bg-gray-100 rounded-lg text-gray-500 active:scale-90 transition-all"
          title="تنزيل نسخة من بياناتي"
        >
          <Download size={18} />
        </button>
      </div>

      {/* صورة الحساب مع زر التغيير */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <div className={`w-24 h-24 ${theme.bgLight} rounded-full flex items-center justify-center ${theme.icon} border-4 border-white shadow-lg overflow-hidden`}>
            {user?.avatar_url ? (
              <OptimizedImage src={user.avatar_url} width={192} height={192} alt="Avatar" className="w-full h-full object-cover" />
            ) : <User size={48} />}
            {avatarUploading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-full">
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>
          <label className="absolute bottom-0 right-0 bg-brand text-white p-2 rounded-full cursor-pointer shadow-lg hover:opacity-90 transition-colors">
            <Plus size={16} />
            <input type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={avatarUploading} />
          </label>
        </div>
        <p className="text-xs text-gray-400">اضغط على + لتغيير الصورة</p>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-700">الاسم الكامل</label>
          <input 
            type="text" value={name} onChange={(e) => setName(e.target.value)}
            className="w-full bg-gray-50 border border-gray-100 rounded-lg px-4 py-3 outline-none focus:border-brand"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-700">البريد الإلكتروني</label>
          <input 
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-gray-50 border border-gray-100 rounded-lg px-4 py-3 outline-none focus:border-brand"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-700">رقم الهاتف</label>
          <CountryCodePhoneInput
            countryCode={countryCode}
            onCountryCodeChange={setCountryCode}
            phone={phone}
            onPhoneChange={setPhone}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-700">كلمة المرور القديمة</label>
          <input 
            type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)}
            placeholder="أدخلها فقط إذا كنت ستغيّر كلمة المرور"
            className="w-full bg-gray-50 border border-gray-100 rounded-lg px-4 py-3 outline-none focus:border-brand"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-bold text-gray-700">كلمة المرور الجديدة (اختياري)</label>
          <input 
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="اتركها فارغة إذا لم ترد التغيير"
            className="w-full bg-gray-50 border border-gray-100 rounded-lg px-4 py-3 outline-none focus:border-brand"
          />
          <button
            type="button"
            onClick={() => setView({ type: "profile_forgot_password" })}
            className="text-brand text-sm font-bold hover:underline"
          >
            هل نسيت كلمة المرور؟
          </button>
        </div>

        {error && <p className="text-red-500 text-sm text-center font-medium">{error}</p>}

        <button
          disabled={loading}
          onClick={handleUpdate}
          className="w-full flex items-center justify-center bg-brand text-white py-3.5 rounded-lg font-bold shadow-lg shadow-brand-soft disabled:opacity-50"
        >
          {loading ? "جاري الحفظ..." : "حفظ التغييرات"}
        </button>
      </div>
    </div>
  );
}
