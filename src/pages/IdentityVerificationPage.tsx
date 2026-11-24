import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, ShieldCheck, Upload, Clock, XCircle, CheckCircle2 } from "lucide-react";
import VerifiedBadge from "../components/VerifiedBadge";
import { showToast } from "../components/ToastContainer";

interface Props {
  user: any;
  setView: (v: any) => void;
  fetchUser?: (id: number) => void;
}

interface Status { enabled: boolean; description: string; verified: boolean; status: "none" | "pending" | "approved" | "rejected"; reject_reason: string }

const authHeader = (): Record<string, string> => {
  try { return { Authorization: `Bearer ${localStorage.getItem("authToken") || ""}` }; } catch { return {}; }
};

// تصغير الصورة قبل الرفع (أقصى بُعد 1600px، JPEG) لتسريع الرفع وتجاوز حدّ الحجم
async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("compress")), "image/jpeg", 0.85));
}

/** [PHASE-3] صفحة توثيق الهوية للمستخدم: غير موثّق / قيد المراجعة / موثّق / مرفوض (مع السبب وإعادة الإرسال). */
export default function IdentityVerificationPage({ user, setView, fetchUser }: Props) {
  const [st, setSt] = useState<Status | null>(null);
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [frontUrl, setFrontUrl] = useState("");
  const [backUrl, setBackUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const frontRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    try {
      const r = await fetch("/api/identity/status", { headers: authHeader() });
      if (r.ok) setSt(await r.json());
    } catch { /* تجاهل */ }
  };
  useEffect(() => { load(); }, []);
  useEffect(() => () => { if (frontUrl) URL.revokeObjectURL(frontUrl); if (backUrl) URL.revokeObjectURL(backUrl); }, [frontUrl, backUrl]);

  const pick = (side: "front" | "back", f: File | null) => {
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { showToast("اختر صورة بصيغة JPG أو PNG أو WEBP", "error"); return; }
    const url = URL.createObjectURL(f);
    if (side === "front") { setFront(f); setFrontUrl(url); } else { setBack(f); setBackUrl(url); }
  };

  const upload = async (side: "front" | "back", file: File): Promise<string> => {
    const blob = await compressImage(file);
    const r = await fetch(`/api/identity/upload/${side}`, { method: "POST", headers: { ...authHeader(), "Content-Type": "image/jpeg" }, body: blob });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.key) throw new Error(d?.error || "فشل رفع الصورة");
    return d.key as string;
  };

  const submit = async () => {
    if (!front || !back) { showToast("ارفع صورة الهوية الأمامية والخلفية", "error"); return; }
    setBusy(true);
    try {
      const [frontKey, backKey] = await Promise.all([upload("front", front), upload("back", back)]);
      const r = await fetch("/api/identity/submit", { method: "POST", headers: { ...authHeader(), "Content-Type": "application/json" }, body: JSON.stringify({ frontKey, backKey }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.error || "فشل إرسال الطلب");
      showToast("تم إرسال طلب التوثيق، سيتم مراجعته قريباً", "success");
      setFront(null); setBack(null); setFrontUrl(""); setBackUrl("");
      await load();
      if (user?.id && fetchUser) fetchUser(user.id);
    } catch (e: any) { showToast(e?.message || "حدث خطأ", "error"); }
    setBusy(false);
  };

  const status = st?.status || "none";
  const canSubmit = !!st?.enabled && (status === "none" || status === "rejected");

  const Slot = ({ label, url, onPick, inputRef }: { label: string; url: string; onPick: (f: File | null) => void; inputRef: React.RefObject<HTMLInputElement | null> }) => (
    <div className="space-y-1.5">
      <p className="text-xs font-bold text-gray-500">{label}</p>
      <button type="button" onClick={() => inputRef.current?.click()} className="w-full aspect-[16/10] rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center overflow-hidden active:scale-[0.99]">
        {url ? <img src={url} alt={label} className="w-full h-full object-cover" /> : <span className="flex flex-col items-center gap-1 text-gray-400 text-xs font-bold"><Upload size={22} />اضغط لاختيار صورة</span>}
      </button>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { onPick(e.target.files?.[0] || null); e.target.value = ""; }} />
    </div>
  );

  return (
    <div className="px-4 space-y-4 pb-20" dir="rtl">
      <div className="flex items-center gap-2 mb-2">
        <button onClick={() => setView({ type: "main" })} className="p-2 bg-gray-100 rounded-full active:scale-95"><ArrowRight size={20} className="text-gray-600" /></button>
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><ShieldCheck size={20} className="text-sky-500" /> توثيق الهوية</h2>
      </div>

      {!st ? <p className="text-center text-sm text-gray-400 py-10">جاري التحميل...</p>
        : !st.enabled && status !== "approved" ? <p className="text-center text-sm text-gray-500 bg-gray-50 rounded-xl p-6">توثيق الهوية غير متاح حالياً.</p>
        : (
          <>
            {st.description && <p className="text-sm text-gray-600 leading-relaxed bg-white border border-gray-100 rounded-xl p-4 whitespace-pre-line">{st.description}</p>}

            {status === "approved" && (
              <div className="flex items-center gap-2 bg-green-50 text-green-700 rounded-xl p-4 text-sm font-bold"><CheckCircle2 size={20} /> حسابك موثّق <VerifiedBadge size={18} /></div>
            )}
            {status === "pending" && (
              <div className="flex items-center gap-2 bg-amber-50 text-amber-700 rounded-xl p-4 text-sm font-bold"><Clock size={20} /> طلبك قيد المراجعة، لا يمكنك إرسال طلب آخر الآن.</div>
            )}
            {status === "rejected" && (
              <div className="bg-red-50 text-red-600 rounded-xl p-4 text-sm space-y-1">
                <p className="font-bold flex items-center gap-2"><XCircle size={20} /> تم رفض طلبك</p>
                {st.reject_reason && <p>السبب: {st.reject_reason}</p>}
                <p className="text-xs text-red-500">يمكنك إرسال طلب جديد بصور أوضح.</p>
              </div>
            )}

            {canSubmit && (
              <div className="bg-white border border-gray-100 rounded-xl p-4 space-y-4">
                <Slot label="صورة الهوية — الوجه الأمامي" url={frontUrl} onPick={f => pick("front", f)} inputRef={frontRef} />
                <Slot label="صورة الهوية — الوجه الخلفي" url={backUrl} onPick={f => pick("back", f)} inputRef={backRef} />
                <button onClick={submit} disabled={busy || !front || !back} className="w-full py-3 rounded-xl bg-brand text-white font-bold text-sm disabled:opacity-40 active:scale-[0.98]">
                  {busy ? "جارِ الإرسال..." : "إرسال طلب التوثيق"}
                </button>
                <p className="text-[11px] text-gray-400 text-center">صورك محفوظة في مكان محمي ولا يراها إلا فريق الإدارة.</p>
              </div>
            )}
          </>
        )}
    </div>
  );
}
