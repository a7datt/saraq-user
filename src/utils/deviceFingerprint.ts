/**
 * deviceFingerprint — بصمة جهاز قوية (كرت الشاشة GPU + Canvas + خصائص الشاشة
 * والمتصفح) تُستخدم لحظر الأجهزة الخبيثة حتى لو غيّر صاحبها الـ IP عبر VPN.
 *
 * الفكرة: عنوان الـ IP سهل التبديل (VPN/بروكسي مجاني)، لكن توليفة (كرت الشاشة
 * الفعلي + طريقة رسم الـ Canvas + دقة الشاشة + المنطقة الزمنية...) شبه ثابتة
 * لنفس الجهاز الحقيقي. هذه ليست تقنية تحديد هوية دقيقة 100% (بعض الأجهزة
 * المتطابقة قد تتشارك بصمة قريبة)، لكنها خط دفاع فعّال يرفع كلفة الإفلات من
 * الحظر بشكل كبير جداً على أي مهاجم/بوت عادي.
 *
 * تُحسب مرة واحدة فقط وتُخزَّن بذاكرة الصفحة (متغيّر JS)، وليس في أي تخزين
 * دائم بالمتصفح (لا localStorage ولا cookies) — فهي "بصمة جهاز" مبنية على
 * خصائص الجهاز نفسه لا على قيمة مخزَّنة يمكن مسحها.
 */

let cachedFingerprint: Promise<string> | null = null;

/** بصمة رسم Canvas — تختلف بدقة طفيفة بين مجموعات GPU/تعريفات/أنظمة تشغيل مختلفة */
function getCanvasFingerprint(): string {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 240;
    canvas.height = 40;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(0, 0, 100, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("saraqib-store-FP-🔒-傻瓜", 2, 15);
    ctx.strokeStyle = "rgba(102,204,0,0.7)";
    ctx.strokeRect(1, 1, 60, 20);
    return canvas.toDataURL();
  } catch {
    return "";
  }
}

/** بصمة كرت الشاشة (GPU) عبر WebGL — أقوى إشارة ثابتة لهوية الجهاز الفعلي */
function getGpuFingerprint(): string {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl")) as WebGLRenderingContext | null;
    if (!gl) return "";
    const dbgInfo = gl.getExtension("WEBGL_debug_renderer_info");
    const vendor = dbgInfo
      ? gl.getParameter(dbgInfo.UNMASKED_VENDOR_WEBGL)
      : gl.getParameter(gl.VENDOR);
    const renderer = dbgInfo
      ? gl.getParameter(dbgInfo.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER);
    return `${vendor}|${renderer}`;
  } catch {
    return "";
  }
}

async function sha256Hex(input: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    // بيئة نادرة بدون SubtleCrypto (سياق غير آمن مثلاً) — هاش بسيط احتياطي
    // بدل تعطيل الميزة كلياً. الخادم يتجاهل تلقائياً أي قيمة لا تشبه هاش hex.
    let h = 0;
    for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0;
    return Math.abs(h).toString(16).padStart(16, "0");
  }
}

async function computeFingerprint(): Promise<string> {
  const parts = [
    navigator.userAgent,
    navigator.platform,
    navigator.language,
    String(navigator.hardwareConcurrency || ""),
    String((navigator as any).deviceMemory || ""),
    String(window.screen?.width),
    String(window.screen?.height),
    String(window.screen?.colorDepth),
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    getGpuFingerprint(),
    getCanvasFingerprint(),
  ];
  return sha256Hex(parts.join("###"));
}

/**
 * getDeviceFingerprint — يُحسب مرة واحدة فقط لكل جلسة صفحة ويُعاد استخدام
 * نفس القيمة (Promise مخزَّن) في كل طلب لاحق، تجنباً لإعادة رسم Canvas/WebGL
 * في كل نداء API (عملية غير مجانية على المعالج).
 */
export function getDeviceFingerprint(): Promise<string> {
  if (!cachedFingerprint) cachedFingerprint = computeFingerprint();
  return cachedFingerprint;
}

/**
 * getDeviceInfoHeader — الدالة القديمة (بصمة خفيفة، خصائص متصفح عامة فقط)،
 * ما زالت مُستخدمة فعلياً في صفحتي تسجيل الدخول وتفعيل الحساب. أُبقيها كما
 * هي لعدم كسر أي استدعاء قائم.
 */
export function getDeviceInfoHeader(): string {
  try {
    return JSON.stringify({
      screenWidth: window.screen?.width,
      screenHeight: window.screen?.height,
      colorDepth: window.screen?.colorDepth,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      platform: navigator.platform,
    });
  } catch {
    return "{}";
  }
}
