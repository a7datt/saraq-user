/**
 * fetchFingerprintInterceptor — يُلحق بصمة الجهاز (X-Device-Fp) تلقائياً بكل
 * طلبات الـ API الصادرة من التطبيق عبر fetch()، دون الحاجة لتعديل كل الملفات
 * (~20 ملف) التي تستدعي fetch() مباشرة عبر التطبيق.
 *
 * هذا الملف "أثر جانبي فقط" (side-effect module) — يجب استيراده مرة واحدة في
 * main.tsx قبل أي شيء آخر، وليس فيه أي export مستخدَم مباشرة.
 *
 * ملاحظة أمان: الهيدر يُضاف فقط لطلبات نفس الأصل (same-origin) التي تبدأ
 * بـ /api، حتى لا نُسرّب بصمة الجهاز لأي خدمة خارجية (Google, ImgBB, geo-IP...).
 */
import { getDeviceFingerprint } from "./deviceFingerprint";

const originalFetch = window.fetch.bind(window);

function isSameOriginApiUrl(url: string): boolean {
  if (url.startsWith("/api")) return true;
  try {
    const u = new URL(url, window.location.origin);
    return u.origin === window.location.origin && u.pathname.startsWith("/api");
  } catch {
    return false;
  }
}

window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  try {
    const isRequestObj = typeof Request !== "undefined" && input instanceof Request;
    const url = typeof input === "string" ? input : isRequestObj ? (input as Request).url : String(input);

    if (isSameOriginApiUrl(url)) {
      const fp = await getDeviceFingerprint();
      const headers = new Headers(init?.headers ?? (isRequestObj ? (input as Request).headers : undefined));
      headers.set("X-Device-Fp", fp);
      init = { ...init, headers };
    }
  } catch {
    // أي فشل في حساب البصمة لا يجب أبداً أن يمنع الطلب الأساسي من الإرسال
    // (نفس مبدأ صمام الأمان في الباك إند: ميزة ثانوية لا توقف الوظيفة الأساسية)
  }
  return originalFetch(input, init);
};
