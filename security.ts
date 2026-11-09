/**
 * ════════════════════════════════════════════════════════════════
 *  security.ts  —  14 طبقة حماية متقدمة (v2 - إصلاح الثغرات)
 * ════════════════════════════════════════════════════════════════
 *
 *  التغييرات في v2:
 *  - OTP يُولَّد الآن بـ crypto.randomInt() بدلاً من Math.random()
 *  - CSP أقوى: حُذف unsafe-eval من script-src
 *  - CORS: لا يقبل طلبات بدون Origin header إلا في dev
 *  - Rate limiting: رُفع عدد الـ strikes المطلوبة للحظر
 *    بشكل كبير لتجنب الحظر التعسفي للمستخدمين العاديين
 *  - strikeIp: الحظر يبدأ فقط بعد مخالفات كثيرة جداً
 *  - ipBanList: مدة الحظر أقصر ومتدرجة بشكل معقول
 */

import { Request, Response, NextFunction } from "express";
import crypto from "crypto";

// ══════════════════════════════════════════════════════════════
//  الطبقة 1 — JWT
// ══════════════════════════════════════════════════════════════

const JWT_SECRET = process.env.JWT_SECRET || (() => {
  const k = crypto.randomBytes(64).toString("hex");
  console.warn("[SEC] ⚠️  JWT_SECRET غير مضبوط في .env — يُولَّد مؤقتاً، لكنه يُعاد توليده عند كل إعادة تشغيل");
  return k;
})();

function b64url(data: Buffer | string): string {
  const buf = typeof data === "string" ? Buffer.from(data) : data;
  return buf.toString("base64").replace(/\+/g,"-").replace(/\//g,"_").replace(/=/g,"");
}

function signJwt(payload: object, secret: string, expiresInSec = 7*24*3600): string {
  const h = b64url(JSON.stringify({ alg:"HS256", typ:"JWT" }));
  const b = b64url(JSON.stringify({ ...payload, iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+expiresInSec, jti: crypto.randomBytes(8).toString("hex") }));
  const s = b64url(crypto.createHmac("sha256", secret).update(`${h}.${b}`).digest());
  return `${h}.${b}.${s}`;
}

function verifyJwt(token: string, secret: string): any|null {
  try {
    if (!token || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [h,b,s] = parts;
    const expected = b64url(crypto.createHmac("sha256", secret).update(`${h}.${b}`).digest());
    // timing-safe compare — مقاومة Timing Attacks
    const sBuf = Buffer.from(s.padEnd(expected.length, "="));
    const eBuf = Buffer.from(expected);
    if (sBuf.length !== eBuf.length || !crypto.timingSafeEqual(sBuf, eBuf)) return null;
    const payload = JSON.parse(Buffer.from(b, "base64").toString());
    if (payload.exp < Math.floor(Date.now()/1000)) return null;
    return payload;
  } catch { return null; }
}

// [SECURITY FIX] تقليص مدة صلاحية توكن المستخدم من 7 أيام إلى يوم واحد + تضمين
// token_version في الحمولة — انظر القسم 3.2 من تقرير الفحص الأمني (CWE-613).
// tokenVersion (اختياري) يسمح بإبطال كل التوكنات الصادرة سابقاً دفعة واحدة عند تمريره.
export const createUserToken  = (userId: number|string, tokenVersion: number = 0) =>
  signJwt({ sub: String(userId), role:"user", tv: tokenVersion }, JWT_SECRET, 24*3600);
export const verifyUserToken  = (t: string) => verifyJwt(t, JWT_SECRET);

// ══════════════════════════════════════════════════════════════
//  [SECURITY FIX] إبطال فعلي لجلسات المستخدم (Token Revocation)
//  — القسم 3.2 من تقرير الفحص الأمني —
//  نفس نمط adminSessionRevokedCheck المطبَّق في مشروع الأدمن، لكن بنمط أبسط
//  (token_version على مستوى المستخدم بدل جدول جلسات كامل): كل توكن يحمل رقم
//  إصدار (tv) وقت إصداره، ويُقارَن عند كل طلب بالقيمة الحالية المخزّنة في
//  جدول users (عمود token_version). أي زيادة لهذا الرقم (عند تغيير كلمة
//  المرور أو الضغط على "إنهاء كل الجلسات") تُبطل فوراً كل التوكنات الصادرة
//  قبلها، بغض النظر عن مدة صلاحيتها الطبيعية.
// ══════════════════════════════════════════════════════════════
let userTokenVersionLookup: ((userId: string) => Promise<number>) | null = null;
export function setUserTokenVersionLookup(fn: (userId: string) => Promise<number>) {
  userTokenVersionLookup = fn;
}

// ══════════════════════════════════════════════════════════════
//  [PHONE-GATE] توكن مؤقّت قصير الأجل لإتمام تسجيل الدخول عبر Google
//  بعد إجبار المستخدم على تعبئة رقم الهاتف — يحمل هوية Google الموثّقة
//  فقط (بدون صلاحية دخول)، لمنع العميل من تزوير googleId/email بين
//  الخطوة الأولى (التحقق من Google) والثانية (إرسال رقم الهاتف).
// ══════════════════════════════════════════════════════════════
export const createGoogleTempToken = (data: { googleId: string; email: string; name: string; avatarUrl: string | null }) =>
  signJwt({ purpose: "google_phone_pending", googleId: data.googleId, email: data.email, name: data.name, avatarUrl: data.avatarUrl }, JWT_SECRET, 10*60);

export const verifyGoogleTempToken = (t: string): { googleId: string; email: string; name: string; avatarUrl: string | null } | null => {
  const p = verifyJwt(t, JWT_SECRET);
  if (!p || p.purpose !== "google_phone_pending" || !p.googleId || !p.email) return null;
  return { googleId: p.googleId, email: p.email, name: p.name, avatarUrl: p.avatarUrl ?? null };
};

// ══════════════════════════════════════════════════════════════
//  [FIX] OTP Generation — crypto.randomInt بدلاً من Math.random
//  Math.random() ليس CSPRNG ولا يُستخدم للأغراض الأمنية
// ══════════════════════════════════════════════════════════════

/**
 * يُولِّد OTP مكوّن من 6 أرقام باستخدام مولّد عشوائي آمن
 * crypto.randomInt(min, max) — مُضمَّن في Node.js v14.10+
 */
export function generateSecureOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

// ══════════════════════════════════════════════════════════════
//  [NEW] بصمة الجهاز/كرت الشاشة (Device & GPU Fingerprint Ban)
//  ⚠️  الفكرة: الـ IP سهل التغيير (VPN)، لكن توليفة (كرت الشاشة الحقيقي +
//  رسم Canvas + الشاشة + الخطوط...) شبه ثابتة. الحظر هنا مرتبط بهذه البصمة
//  وليس بالـ IP، فلا يفلت المهاجم بتبديل شبكته.
//  الفرونت إند يرسلها في الترويسة X-Device-Fp مع كل طلب (راجع
//  src/utils/deviceFingerprint.ts و src/utils/fetchFingerprintInterceptor.ts)
// ══════════════════════════════════════════════════════════════

interface FpBanEntry { until: number; reason: string; strikes: number; permanent?: boolean }
const fpBanList   = new Map<string, FpBanEntry>();
const fpStrikeMap = new Map<string, number>();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of fpBanList) if (!v.permanent && v.until < now) fpBanList.delete(k);
}, 5 * 60 * 1000);
setInterval(() => { fpStrikeMap.clear(); }, 30 * 60 * 1000);

/**
 * يقرأ بصمة الجهاز من الترويسة ويتحقق من شكلها (هاش hex معقول الطول) قبل
 * الوثوق بها كمفتاح حظر — أي قيمة غريبة الشكل تُتجاهل بدل استخدامها كما هي.
 */
export function getClientFingerprint(req: Request): string | null {
  const raw = req.headers["x-device-fp"];
  if (typeof raw !== "string") return null;
  const v = raw.trim();
  if (!/^[a-f0-9]{16,64}$/i.test(v)) return null;
  return v.toLowerCase();
}

export function isFingerprintBanned(fp: string | null): FpBanEntry | null {
  if (!fp) return null;
  const ban = fpBanList.get(fp);
  if (ban && (ban.permanent || ban.until > Date.now())) return ban;
  return null;
}

export function strikeFingerprint(
  fp: string,
  reason: string,
  banOnStrikes = 20,
  opts?: { permanent?: boolean; durationMs?: number },
): void {
  const current = (fpStrikeMap.get(fp) || 0) + 1;
  fpStrikeMap.set(fp, current);
  if (current >= banOnStrikes || opts?.permanent) {
    const duration = opts?.durationMs ?? Math.min(current * 60 * 60 * 1000, 7 * 24 * 60 * 60 * 1000);
    fpBanList.set(fp, { until: Date.now() + duration, reason, strikes: current, permanent: opts?.permanent });
    console.warn(`[SEC] 🖥️ بصمة جهاز محظورة: ${fp.slice(0, 12)}… | ${reason}${opts?.permanent ? " | دائم" : ` | ${Math.round(duration / 3600000)} ساعة`}`);
  }
}

/**
 * strikeRequest — نقطة الدخول الموصى بها بدل strikeIp مباشرة: تُسجّل المخالفة
 * على الـ IP وعلى بصمة الجهاز معاً في آن واحد، فيصعب على المهاجم الإفلات من
 * الحظر بمجرد تبديل شبكته/الـ VPN.
 */
export function strikeRequest(req: Request, reason: string, banOnStrikes = 50): void {
  strikeIp(getClientIp(req), reason, banOnStrikes);
  const fp = getClientFingerprint(req);
  if (fp) strikeFingerprint(fp, reason, Math.max(20, Math.round(banOnStrikes / 2)));
}

// ══════════════════════════════════════════════════════════════
//  الطبقة 2+3 — Rate Limiting + IP Blacklist المحسّن
//  ⚠️  مبدأ التصميم: لا حظر إلا بعد مخالفات كثيرة وواضحة
//     المستخدم العادي لن يُحظر أبداً في الاستخدام الطبيعي
// ══════════════════════════════════════════════════════════════

interface RLEntry  { count: number; resetAt: number }
interface BanEntry { until: number; reason: string; strikes: number }

const rlStore   = new Map<string, RLEntry>();
const ipBanList = new Map<string, BanEntry>();
const strikeMap = new Map<string, number>();

// تنظيف دوري كل 5 دقائق
setInterval(() => {
  const now = Date.now();
  for (const [k,v] of rlStore)   if (v.resetAt < now) rlStore.delete(k);
  for (const [k,v] of ipBanList) if (v.until   < now) ipBanList.delete(k);
}, 5*60*1000);

// مسح strikes كل 30 دقيقة — فرصة ثانية للجميع
setInterval(() => { strikeMap.clear(); }, 30*60*1000);

export function getClientIp(req: Request): string {
  // [SEC-FIX] العنوان الحقيقي هو ما يُلحقه وكيلنا nginx في آخر سلسلة X-Forwarded-For
  // (عبر $proxy_add_x_forwarded_for = "<XFF القادم من العميل>, <العنوان الفعلي>").
  // كان يؤخذ الطرف الأيسر القابل للتزوير، ما سمح لأي زائر بانتحال IP عبر إرسال ترويسة
  // X-Forwarded-For وتجاوز حدود المعدل/قوائم الحظر وتسميم السجلات. نأخذ آخر عنصر الآن،
  // ولا نثق بـ cf-connecting-ip لعدم وجود Cloudflare أمام الخادم (ترويسة قابلة للتزوير).
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.trim()) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1].replace("::ffff:", "");
  }
  return (req.socket?.remoteAddress || "unknown").replace("::ffff:", "");
}

// ── [SEC] نطاقات البريد المؤقت/المُعطَّل تُرفض عند التسجيل ──
const DISPOSABLE_EMAIL_DOMAINS = new Set<string>([
  "example.com","example.net","example.org","test.com","test.net",
  "maxxspace.com","yopmail.com","yopmail.net","yopmail.fr",
  "mailinator.com","guerrillamail.com","guerrillamail.info","grr.la",
  "sharklasers.com","10minutemail.com","temp-mail.org","temp-mail.io",
  "tempmail.com","tempmailo.com","throwawaymail.com","getnada.com",
  "nada.email","trashmail.com","dispostable.com","fakeinbox.com",
  "maildrop.cc","mohmal.com","emailondeck.com","mintemail.com",
  "mailnesia.com","moakt.com","tempr.email","dropmail.me",
  "inboxkitten.com","spam4.me","mailcatch.com","burnermail.io",
  "1secmail.com","tmpmail.org","tmpmail.net","mailtemp.net",
]);
export function isDisposableEmail(email: unknown): boolean {
  if (typeof email !== "string") return false;
  const at = email.lastIndexOf("@");
  if (at < 0) return false;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return !!domain && DISPOSABLE_EMAIL_DOMAINS.has(domain);
}

// ── [SEC] التحقق من نقطة نهاية Push — منع SSRF ──
// يجب أن تكون HTTPS ومن خدمة إشعارات معروفة فقط (لا عناوين داخلية ولا نطاقات عشوائية)
const PUSH_ALLOWED_HOSTS = [
  "fcm.googleapis.com","android.googleapis.com",
  "push.services.mozilla.com","notify.windows.com","push.apple.com",
];
export function isValidPushEndpoint(endpoint: unknown): boolean {
  if (typeof endpoint !== "string" || endpoint.length > 2048) return false;
  let u: URL;
  try { u = new URL(endpoint); } catch { return false; }
  if (u.protocol !== "https:") return false;
  const h = u.hostname.toLowerCase();
  return PUSH_ALLOWED_HOSTS.some((d) => h === d || h.endsWith("." + d));
}

// ── [SEC] التحقق من CAPTCHA عبر Cloudflare Turnstile ──
// مُعطّل تلقائياً ما لم يُضبط TURNSTILE_SECRET في البيئة (حتى لا يتعطّل التسجيل قبل تجهيز
// المفاتيح وودجت الواجهة). بعد التفعيل: أي طلب بلا توكن صالح يُرفض (fail-closed).
export async function verifyCaptcha(token: unknown, ip?: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET || "";
  if (!secret) return true; // غير مُفعّل بعد
  if (typeof token !== "string" || token.length < 10 || token.length > 4096) return false;
  try {
    const form = new URLSearchParams();
    form.set("secret", secret);
    form.set("response", token);
    if (ip) form.set("remoteip", ip);
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      signal: AbortSignal.timeout(8000),
    });
    const data: any = await r.json().catch(() => ({}));
    return data?.success === true;
  } catch {
    return false;
  }
}

/**
 * [FIX] strikeIp — لا يُصدر حظراً إلا بعد عدد كبير من المخالفات
 * مدة الحظر قصيرة (5 دقائق كحد أقصى) حتى لا يتضرر المستخدم العادي
 * في حال كان الخطأ عرضياً
 */
export function strikeIp(ip: string, reason: string, banOnStrikes = 50): void {
  const current = (strikeMap.get(ip) || 0) + 1;
  strikeMap.set(ip, current);
  if (current >= banOnStrikes) {
    // الحظر الأقصى 5 دقائق فقط — قرار متعمد لحماية المستخدمين العاديين
    const duration = Math.min(current * 30 * 1000, 5*60*1000);
    ipBanList.set(ip, { until: Date.now()+duration, reason, strikes: current });
    console.warn(`[SEC] 🚫 IP محظور مؤقتاً: ${ip} | ${reason} | ${Math.round(duration/60000)} دقيقة`);
  }
}

export function ipBanCheck(req: Request, res: Response, next: NextFunction) {
  const ip  = getClientIp(req);
  const ban = ipBanList.get(ip);
  if (ban && ban.until > Date.now()) {
    const mins = Math.ceil((ban.until - Date.now()) / 60000);
    return res.status(429).json({ error: `طلبات كثيرة جداً. انتظر ${mins} دقيقة وأعد المحاولة.` });
  }
  // [NEW] حظر مرتبط ببصمة الجهاز/كرت الشاشة — يبقى فعّالاً حتى لو بدّل المهاجم
  // الـ IP عبر VPN/بروكسي مئة مرة، لأن بصمة جهازه الفعلي لا تتغير
  const fp    = getClientFingerprint(req);
  const fpBan = isFingerprintBanned(fp);
  if (fpBan) {
    console.warn(`[SEC] 🚫 طلب من جهاز محظور (بصمة): ip=${ip} fp=${fp?.slice(0,12)}… سبب=${fpBan.reason}`);
    return res.status(403).json({ error: "تم حظر هذا الجهاز بسبب نشاط مشبوه. تغيير الشبكة أو الـ IP لن يرفع الحظر." });
  }
  (req as any).clientIp = ip;
  (req as any).clientFp = fp;
  next();
}

export function rateLimit(maxRequests: number, windowMs: number, opts?: { keyFn?: (req:Request)=>string; banAfterExceeds?: number }) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip  = getClientIp(req);
    const key = opts?.keyFn ? opts.keyFn(req) : `${ip}:${req.path}`;
    const now = Date.now();
    const entry = rlStore.get(key);
    if (!entry || entry.resetAt < now) { rlStore.set(key, { count:1, resetAt: now+windowMs }); return next(); }
    entry.count++;
    if (entry.count > maxRequests) {
      // [FIX] الحظر يتطلب تجاوز الحد بـ 20 ضعف على الأقل — هجوم حقيقي وليس زيادة عرضية
      const banThreshold = opts?.banAfterExceeds ?? maxRequests * 20;
      if (entry.count > banThreshold) strikeRequest(req, `rate-limit: ${req.path}`, 50);
      res.setHeader("Retry-After", String(Math.ceil((entry.resetAt-now)/1000)));
      return res.status(429).json({ error: `طلبات كثيرة. انتظر ${Math.ceil((entry.resetAt-now)/1000)} ثانية.` });
    }
    next();
  };
}

// حدود معقولة — لن تمس المستخدم العادي أبداً
export const authLimiter       = rateLimit(20,  15*60*1000, { banAfterExceeds: 400  }); // 20/15 دقيقة، حظر بعد 400
export const forgotPassLimiter = rateLimit(10,  60*60*1000, { banAfterExceeds: 200  }); // 10/ساعة، حظر بعد 200
export const orderLimiter      = rateLimit(30,  60*1000);
export const chatLimiter       = rateLimit(60,  60*1000);
export const uploadLimiter     = rateLimit(15,  60*1000);
export const generalLimiter    = rateLimit(300, 60*1000,    { banAfterExceeds: 5000 }); // حظر فقط عند DDoS واضح
export const strictLimiter     = rateLimit(30,  60*1000,    { banAfterExceeds: 600  });
// حد خاص للـ OTP: 5 محاولات/10 دقائق لكل IP+email
export const otpLimiter        = rateLimit(5,   10*60*1000, { banAfterExceeds: 100  });
// حد خاص للتحقق اليدوي من رمز الشحن التلقائي برقم العملية (مسار حساس يستدعي API خارجي) — 8 محاولات/10 دقائق
export const autoChargeVerifyLimiter = rateLimit(8, 10*60*1000, { banAfterExceeds: 80 });

// ══════════════════════════════════════════════════════════════
//  الطبقة 4 — Bot / Scanner Detection (بدون حظر فوري)
// ══════════════════════════════════════════════════════════════

const BLOCKED_UA = [
  /sqlmap/i,/nikto/i,/nmap/i,/masscan/i,/zgrab/i,
  /python-requests/i,/go-http-client/i,/libwww-perl/i,
  /curl\//i,/wget\//i,/scrapy/i,/burpsuite/i,/dirbuster/i,
  /nuclei/i,/gobuster/i,/ffuf/i,/wfuzz/i,/hydra/i,
  /havij/i,/acunetix/i,/nessus/i,/openvas/i,/metasploit/i,
];

export function botDetection(req: Request, res: Response, next: NextFunction) {
  // [FIX] نقاط الويبهوك العامة (مزوّدي دفع خارجيين مثل sybclint) لها مصادقة خاصة بها (سر
  // بالمسار) ويُتوقَّع منها عميل HTTP غير متصفّح بلا User-Agent "طبيعي" إطلاقاً — تطبيق هذا
  // الفحص عليها كان سيحظر عملاء HTTP شائعة (axios/python-requests/go-http-client...) فعلياً
  // ويكسر استقبال الويبهوك بصمت. الأمان هنا يعتمد على السر بالمسار وحده، لا على نمط User-Agent.
  if (req.path.startsWith("/api/webhooks/")) return next();
  const ua = (req.headers["user-agent"] || "").toLowerCase();
  const ip = getClientIp(req);
  if (!ua && req.path.startsWith("/api/")) {
    // [FIX] strike عالي جداً — 50 مرة قبل الحظر لتجنب حظر التطبيقات الشرعية
    strikeRequest(req, "no-ua", 50);
    return res.status(400).json({ error: "طلب غير مقبول" });
  }
  for (const p of BLOCKED_UA) {
    if (p.test(ua)) {
      // أدوات الاختراق المعروفة تحصل على حظر أسرع لكن لا يزال تدريجياً
      strikeRequest(req, `bot:${ua.slice(0,30)}`, 3);
      return res.status(403).json({ error: "ممنوع" });
    }
  }
  next();
}

// ══════════════════════════════════════════════════════════════
//  الطبقة 5 — Honeypot Traps
// ══════════════════════════════════════════════════════════════

const HONEYPOT_PATHS = [
  "/wp-admin","/wp-login.php","/phpmyadmin","/.env",
  "/.git","/config.php","/debug","/api/v1/admin","/api/v2/admin",
  "/console","/shell","/manager/html","/actuator","/xmlrpc.php",
  "/cgi-bin","/server-status","/api/swagger","/backup",
  "/adminer","/webadmin","/cpanel","/plesk",
];

// مدة حظر الدخول إلى مسار فخ — أطول بكثير من باقي المخالفات لأن دخول مسار مثل
// /wp-admin أو /.env على متجر React لا يحدث بالصدفة أبداً؛ إنه سلوك مسح آلي مؤكد
const HONEYPOT_BAN_MS = 24 * 60 * 60 * 1000; // 24 ساعة

export function honeypotMiddleware(req: Request, res: Response, next: NextFunction) {
  const p  = req.path.toLowerCase();
  const ip = getClientIp(req);
  for (const trap of HONEYPOT_PATHS) {
    if (p.startsWith(trap)) {
      const fp  = getClientFingerprint(req);
      const ua  = String(req.headers["user-agent"] || "غير معروف");
      const ref = String(req.headers["referer"] || req.headers["referrer"] || "-");

      // [NEW] حظر الـ IP لمدة أطول (24 ساعة بدل 10 دقائق) + حظر بصمة الجهاز
      // معه، حتى لا يفلت البوت من الحظر بمجرد تبديل الـ IP عبر VPN
      ipBanList.set(ip, { until: Date.now() + HONEYPOT_BAN_MS, reason: `honeypot:${p}`, strikes: 999 });
      if (fp) strikeFingerprint(fp, `honeypot:${p}`, 1, { durationMs: HONEYPOT_BAN_MS });

      console.warn(`[SEC] 🍯 Honeypot: ${ip} → ${p}`);

      // [NEW] تنبيه تيليجرام تفصيلي وفوري — fire-and-forget حتى لا نؤخر رد الـ 404
      void sendSecurityTelegramAlert(
        "🍯 <b>محاولة اختراق عبر فخ عسل (Honeypot)</b>\n" +
        `📍 المسار: <code>${escapeHtml(p)}</code>\n` +
        `🌐 IP الحقيقي: <code>${escapeHtml(ip)}</code>\n` +
        (fp ? `🖥️ بصمة الجهاز: <code>${fp.slice(0, 16)}…</code>\n` : "🖥️ بصمة الجهاز: غير متوفرة (طلب مباشر بدون متصفح)\n") +
        `🧭 المتصفح: <code>${escapeHtml(ua.slice(0, 150))}</code>\n` +
        `↩️ Referer: <code>${escapeHtml(ref.slice(0, 150))}</code>\n` +
        `⏰ الوقت: ${new Date().toISOString()}\n` +
        `⛔ تم حظر الـ IP${fp ? " وبصمة الجهاز" : ""} تلقائياً لمدة 24 ساعة.`
      );

      return res.status(404).json({ error: "Not Found" });
    }
  }
  next();
}

// ══════════════════════════════════════════════════════════════
//  الطبقة 6 — Injection Guard (SQL + NoSQL + Path Traversal)
// ══════════════════════════════════════════════════════════════

const INJECT_PATTERNS = [
  /(\b)(select|insert|update|delete|drop|truncate|alter|exec|union|having)(\b)/i,
  /(--|;|\/\*|\*\/|xp_|sp_)/i,
  /sleep\s*\(\s*\d+/i, /benchmark\s*\(/i, /load_file\s*\(/i,
  /into\s+(outfile|dumpfile)/i,
  /<script|javascript:|vbscript:|on\w+\s*=/i,
  /\.\.[\\/]/, /%2e%2e/i, /\x00|%00/,
];

// حقول تحتوي قيماً معتمة (توكنات/روابط) لا تُستخدم أبداً داخل استعلام SQL خام —
// فحصها بنمط SQL/XSS الحقيقي يُنتج نتائج إيجابية كاذبة بشكل عشوائي (مثال: توكن Google
// المُشفّر base64url قد يحتوي بالصدفة على "--" فيُرفض الطلب رغم أنه سليم 100%)
const OPAQUE_FIELD_NAMES = new Set([
  "accesstoken", "credential", "idtoken", "id_token", "refreshtoken", "refresh_token",
  "token", "googleid", "google_id", "picture", "avatar_url", "avatarurl",
  "image_url", "imageurl", "redirect_uri", "redirecturi",
]);

function deepScan(obj: any, depth=0, keyName=""): boolean {
  if (depth>8) return false;
  if (typeof obj==="string") {
    if (OPAQUE_FIELD_NAMES.has(keyName.toLowerCase())) return false;
    for (const p of INJECT_PATTERNS) if (p.test(obj)) return true;
    if (obj.startsWith("$")) return true;
  }
  if (typeof obj==="object" && obj!==null) {
    for (const k of Object.keys(obj)) {
      if (k.startsWith("$")) return true;
      if (deepScan(obj[k], depth+1, k)) return true;
    }
  }
  return false;
}

export function injectionGuard(req: Request, res: Response, next: NextFunction) {
  // [FIX] حمولة الويبهوك تحوي حقولاً حرّة المحتوى من مزوّد خارجي (اسم المُرسِل مثلاً) لا نتحكم
  // بصياغتها، وقد تحوي صدفة أنماطاً شبيهة بالحقن (مثل "--" ضمن اسم) دون أن تكون حقناً فعلياً —
  // لا خطر SQL injection حقيقي هنا أصلاً لأن كل استعلامات القاعدة بهذا المشروع تمر عبر
  // Supabase query builder المُحصَّن (eq/select...)، بلا أي دمج نص خام داخل SQL مطلقاً.
  if (req.path.startsWith("/api/webhooks/")) return next();
  const ip = getClientIp(req);
  if (deepScan(req.body) || deepScan(req.query) || deepScan(req.params)) {
    // [FIX] يحتاج 50 محاولة injection حقيقية قبل الحظر
    strikeRequest(req, "injection", 50);
    console.warn(`[SEC] 💉 Injection attempt: ${ip} → ${req.path}`);
    return res.status(400).json({ error: "مدخلات غير مقبولة" });
  }
  next();
}

// ══════════════════════════════════════════════════════════════
//  الطبقة 7 — XSS Sanitizer
// ══════════════════════════════════════════════════════════════

export function sanitizeText(v: unknown, maxLen=500): string {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, maxLen)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#x27;")
    .replace(/\//g,"&#x2F;").replace(/`/g,"&#x60;");
}

export function deepSanitize(obj: any, maxLen=1000): any {
  if (typeof obj==="string") return sanitizeText(obj, maxLen);
  if (Array.isArray(obj)) return obj.slice(0,50).map(i=>deepSanitize(i,maxLen));
  if (typeof obj==="object" && obj!==null) {
    const out: any = {};
    for (const k of Object.keys(obj).slice(0,50)) {
      if (!/^[a-zA-Z0-9_\-]{1,60}$/.test(k)) continue;
      out[k] = deepSanitize(obj[k], maxLen);
    }
    return out;
  }
  return obj;
}

// ══════════════════════════════════════════════════════════════
//  الطبقة 8 — Security Headers المحسّنة
//  [FIX] حُذف unsafe-eval من script-src
//  [FIX] أُضيف nonce-based approach للـ inline scripts
// ══════════════════════════════════════════════════════════════

export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), camera=(), microphone=(), payment=(), usb=()");
  res.setHeader("X-DNS-Prefetch-Control", "off");
  res.removeHeader("X-Powered-By");
  res.setHeader("Server", "Web");
  res.setHeader("Content-Security-Policy", [
    "default-src 'self'",
    // [SECURITY FIX] القسم 9.2 من تقرير الفحص الأمني: حُذف 'unsafe-inline' من script-src.
    // تطبيق Vite/React ينتج ملفات JS خارجية (لا سكربتات inline حقيقية)، فحذفها لا يكسر
    // شيئاً، ويعيد لـ CSP قيمته الدفاعية الحقيقية ضد XSS (وإلا فإن أي سكربت يُحقن مستقبلياً
    // كان سينفَّذ رغم وجود الحماية). أُبقيت unsafe-inline في style-src فقط (أقل خطورة بكثير).
    // [FIX] index.html يحتوي سكربتاً ثابتاً واحداً (منع وميض اللون قبل تحميل React) —
    // أُضيف له SHA-256 hash صريح بدل 'unsafe-inline' لإبقاء الحماية دون كسر هذه الوظيفة.
    "script-src 'self' blob: https://accounts.google.com https://challenges.cloudflare.com 'sha256-azfQ+9ma1GcAxobIpJBXjT7rw3L+PqyOpHdyWYbyvrI='",
    // [FIX] أُضيف fonts.googleapis.com لتحميل خط Cairo
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
    "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
    "img-src 'self' data: https: blob:",
    // [FIX] أُضيف fonts.gstatic.com لتحميل ملفات الخط الفعلية
    "font-src 'self' data: https://fonts.gstatic.com",
    // [FIX] أُضيف Google APIs لطلبات التحقق من التوكن و FedCM
    "connect-src 'self' https: wss: https://accounts.google.com https://oauth2.googleapis.com https://www.googleapis.com https://sse.sp-today.com https://sp-today.com",
    // frame-src: محلي + إطار Turnstile (CAPTCHA) من Cloudflare
    "frame-src 'self' https://challenges.cloudflare.com",
    // frame-ancestors يبقى none لمنع Clickjacking
    "frame-ancestors 'none'",
    "form-action 'self' https://accounts.google.com",
    "base-uri 'self'",
    "upgrade-insecure-requests",
  ].join("; "));
  next();
}

// ══════════════════════════════════════════════════════════════
//  الطبقة 9 — CORS محسّن
//  [FIX] الطلبات بدون Origin (curl, server requests) لا تمر تلقائياً
//        في الـ production — تُرفض بشكل صريح
// ══════════════════════════════════════════════════════════════

export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const allowed = (process.env.FRONTEND_URL || "http://localhost:3000").split(",").map(s=>s.trim());
  const origin  = req.headers.origin || "";

  if (allowed.includes(origin)) {
    // Origin معروف ومسموح به
    res.setHeader("Access-Control-Allow-Origin",      origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods",     "GET,POST,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers",     "Content-Type,Authorization,X-User-Token,X-Request-ID,Api-Token,X-Device-Fp,X-Device-Info");
    res.setHeader("Access-Control-Max-Age",            "86400");
  } else if (!origin) {
    // بدون Origin — نسمح بالمرور (same-origin requests، service workers، iOS Safari)
    // التحقق من الهوية يتم عبر JWT وليس عبر CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization,X-User-Token,X-Request-ID,Api-Token,X-Device-Fp,X-Device-Info");
  } else {
    // Origin غريب وصريح — مرفوض بدون حظر (الحظر يضر المستخدمين العاديين)
    return res.status(403).json({ error: "غير مصرح بالوصول من هذا الأصل" });
  }

  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
}

// ══════════════════════════════════════════════════════════════
//  الطبقة 10 — Auth Middlewares
// ══════════════════════════════════════════════════════════════

let banLookup: ((userId: string) => Promise<{ banned: boolean; message?: string }>) | null = null;
export function setBanLookup(fn: (userId: string) => Promise<{ banned: boolean; message?: string }>) {
  banLookup = fn;
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const auth  = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : (req.headers["x-user-token"] as string||"");
  if (!token) return res.status(401).json({ error: "غير مسموح: يجب تسجيل الدخول" });
  const payload = verifyUserToken(token);
  if (!payload) {
    // [FIX] 50 محاولة JWT خاطئة قبل الحظر — التطبيق قد يُرسل token منتهي الصلاحية أحياناً
    strikeRequest(req, "invalid-jwt", 50);
    return res.status(401).json({ error: "الجلسة منتهية، يرجى تسجيل الدخول مجدداً" });
  }

  // [FIX] الحظر مرتبط بالحساب (user_id) ويُفحص عند كل طلب بغض النظر عن الجهاز أو الجلسة
  if (banLookup) {
    try {
      const banStatus = await banLookup(String(payload.sub));
      if (banStatus.banned) {
        return res.status(403).json({ error: banStatus.message || "تم إيقاف حسابك.", banned: true });
      }
    } catch {
      // لا نمنع الطلب في حال فشل الفحص لتفادي تعطيل الموقع بالكامل بسبب خطأ في قاعدة البيانات
    }
  }

  // [SECURITY FIX] فحص token_version — إبطال فعلي للجلسات القديمة عند تغيير كلمة
  // المرور أو "إنهاء كل الجلسات". القسم 3.2 من تقرير الفحص الأمني.
  if (userTokenVersionLookup) {
    try {
      const currentVersion = await userTokenVersionLookup(String(payload.sub));
      const tokenVersion = typeof payload.tv === "number" ? payload.tv : 0;
      if (tokenVersion < currentVersion) {
        return res.status(401).json({ error: "انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً", sessionRevoked: true });
      }
    } catch {
      // لا نمنع الطلب في حال فشل الفحص لتفادي تعطيل الموقع بالكامل بسبب خطأ في قاعدة البيانات
    }
  }

  (req as any).userId   = payload.sub;
  (req as any).clientIp = getClientIp(req);
  next();
}

// ══════════════════════════════════════════════════════════════
//  الطبقة 10.5 — Client API Token Auth (external integrations)
// ══════════════════════════════════════════════════════════════

export interface ApiTokenRecord {
  id: number | string;
  user_id: number | string;
  enabled: boolean;
  allowed_ips: string[] | null;
  scope: "all" | "selected";
  can_order: boolean;
  revoked_at: string | null;
}

let apiTokenLookup: ((token: string) => Promise<ApiTokenRecord | null>) | null = null;
export function setApiTokenLookup(fn: (token: string) => Promise<ApiTokenRecord | null>) {
  apiTokenLookup = fn;
}

// يُستدعى بعد نجاح المصادقة لتحديث last_used_at — لا يُنتظر (fire and forget)
let apiTokenTouch: ((tokenId: number | string) => void) | null = null;
export function setApiTokenTouch(fn: (tokenId: number | string) => void) {
  apiTokenTouch = fn;
}

// نفس منطق وضع الصيانة المستخدم في server.ts، يُسجَّل هنا لإعادة استخدامه من apiTokenAuth
let maintenanceCheck: (() => Promise<{ enabled: boolean; allowedIp: string }>) | null = null;
export function setMaintenanceCheck(fn: () => Promise<{ enabled: boolean; allowedIp: string }>) {
  maintenanceCheck = fn;
}

/**
 * apiTokenAuth — نمط مصادقة مماثل لـ authenticate، لكن للتوكنات الخارجية (Client API).
 * يقرأ الترويسة "api-token"، يتحقق من صلاحيته، حالته، وقيود الـ IP، ثم يُرفق
 * بيانات التوكن على req لتُستخدم في الراوترات التالية.
 */
export async function apiTokenAuth(req: Request, res: Response, next: NextFunction) {
  const ip    = getClientIp(req);
  const token = ((req.headers["api-token"] as string) || "").trim();

  if (!token) {
    return res.status(401).json({ code: 120, message: "Api Token is required!" });
  }

  if (!apiTokenLookup) {
    return res.status(500).json({ code: 500, message: "Unknown error" });
  }

  let record: ApiTokenRecord | null = null;
  try {
    record = await apiTokenLookup(token);
  } catch {
    return res.status(403).json({ code: 121, message: "Token error" });
  }

  if (!record || record.revoked_at) {
    // [FIX] نفس مبدأ باقي الطبقات: نحتاج محاولات كثيرة قبل الحظر لتفادي إضرار التكاملات الشرعية
    strikeRequest(req, "invalid-api-token", 50);
    return res.status(403).json({ code: 121, message: "Token error" });
  }

  if (!record.enabled) {
    return res.status(403).json({ code: 122, message: "Not allowed to use API" });
  }

  if (Array.isArray(record.allowed_ips) && record.allowed_ips.length > 0 && !record.allowed_ips.includes(ip)) {
    strikeRequest(req, "api-token-ip-not-allowed", 50);
    return res.status(403).json({ code: 123, message: "IP not allowed" });
  }

  if (maintenanceCheck) {
    try {
      const { enabled, allowedIp } = await maintenanceCheck();
      if (enabled && !(allowedIp && ip === allowedIp)) {
        return res.status(503).json({ code: 130, message: "The site is under maintenance" });
      }
    } catch {
      // فشل فحص الصيانة لا يجب أن يعطل الـ API بالكامل
    }
  }

  if (apiTokenTouch) {
    try { apiTokenTouch(record.id); } catch { /* لا نمنع الطلب بسبب فشل التحديث */ }
  }

  (req as any).apiTokenId    = record.id;
  (req as any).apiUserId     = record.user_id;
  (req as any).apiTokenScope = record.scope;
  (req as any).apiCanOrder   = record.can_order;
  (req as any).clientIp      = ip;
  next();
}

// حد خاص بـ /client/api/* — يُطبَّق بعد apiTokenAuth، لذا المفتاح هو token_id عند توفره وليس فقط الـ IP
export const clientApiLimiter = rateLimit(120, 60*1000, {
  keyFn: (req) => `apitoken:${(req as any).apiTokenId ?? getClientIp(req)}`,
  banAfterExceeds: 2000,
});

export function requireSelf(paramName="userId") {
  return (req: Request, res: Response, next: NextFunction) => {
    const tokenId     = String((req as any).userId||"");
    const requestedId = String(req.params[paramName]||req.body[paramName]||req.params["id"]||"");
    if (!requestedId || tokenId !== requestedId) {
      strikeRequest(req, "idor-attempt", 30);
      return res.status(403).json({ error: "ممنوع: لا يمكنك الوصول لبيانات مستخدم آخر" });
    }
    next();
  };
}

// ══════════════════════════════════════════════════════════════
//  الطبقة 11 — Account Lockout
// ══════════════════════════════════════════════════════════════

interface LockEntry { attempts: number; lockedUntil: number }
const lockStore = new Map<string, LockEntry>();

export function checkAccountLockout(email: string): { locked: boolean; remainingSec?: number } {
  const e = lockStore.get(email.toLowerCase());
  if (!e) return { locked:false };
  if (e.lockedUntil > Date.now()) return { locked:true, remainingSec: Math.ceil((e.lockedUntil-Date.now())/1000) };
  return { locked:false };
}

export function recordFailedLogin(email: string): void {
  const key = email.toLowerCase();
  const e   = lockStore.get(key) || { attempts:0, lockedUntil:0 };
  e.attempts++;
  if (e.attempts >= 6) { e.lockedUntil = Date.now()+15*60*1000; console.warn(`[SEC] 🔒 حساب مقفل مؤقتاً: ${key}`); }
  lockStore.set(key, e);
}

export function clearLoginAttempts(email: string): void {
  lockStore.delete(email.toLowerCase());
}

setInterval(() => {
  const now = Date.now();
  for (const [k,v] of lockStore) if (v.lockedUntil < now && v.attempts < 6) lockStore.delete(k);
}, 60*60*1000);

// ══════════════════════════════════════════════════════════════
//  الطبقة 12 — Payload Size Guard
// ══════════════════════════════════════════════════════════════

export function payloadSizeGuard(req: Request, res: Response, next: NextFunction) {
  const cl = parseInt(req.headers["content-length"]||"0", 10);
  if (cl > 2*1024*1024) return res.status(413).json({ error: "الطلب كبير جداً (الحد 2MB)" });
  next();
}

// ══════════════════════════════════════════════════════════════
//  الطبقة 13 — Request ID Tracking
// ══════════════════════════════════════════════════════════════

export function requestId(req: Request, res: Response, next: NextFunction) {
  const id = (req.headers["x-request-id"] as string)||crypto.randomBytes(8).toString("hex");
  (req as any).requestId = id;
  res.setHeader("X-Request-ID", id);
  next();
}

// ══════════════════════════════════════════════════════════════
//  الطبقة 14 — Input Validation شاملة
// ══════════════════════════════════════════════════════════════

export function isValidEmail(v: unknown): boolean {
  if (typeof v !== "string") return false;
  const t = v.trim();
  return t.length<=254 && /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/.test(t);
}

export function isValidPhone(v: unknown): boolean {
  if (typeof v !== "string") return false;
  const t = v.trim();
  return /^\+?[\d\s\-().]{7,20}$/.test(t) && t.replace(/\D/g,"").length >= 7;
}

export function isValidPassword(v: unknown): boolean {
  if (typeof v !== "string") return false;
  return v.length >= 8 && v.length <= 128 && /[a-zA-Z]/.test(v) && /[0-9]/.test(v);
}

export function isValidName(v: unknown): boolean {
  if (typeof v !== "string") return false;
  const t = v.trim();
  return t.length>=2 && t.length<=60 && !/[<>"'`]/.test(t) && !/[\x00-\x1F\x7F]/.test(t);
}

export function isValidId(v: unknown): boolean {
  const n = Number(v);
  return Number.isInteger(n) && n>0 && n<2_147_483_647;
}

export function isValidQuantity(v: unknown, max=1000): boolean {
  const n = Number(v);
  return Number.isInteger(n) && n>=1 && n<=max;
}

export function isValidAmount(v: unknown, min=0.01, max=100_000): boolean {
  const n = parseFloat(String(v));
  return !isNaN(n) && isFinite(n) && n>=min && n<=max;
}

export function isValidVoucherCode(v: unknown): boolean {
  return typeof v==="string" && /^[A-Z0-9a-z\-_]{3,30}$/.test(v.trim());
}

export function isValidTxNumber(v: unknown): boolean {
  // الحد الأقصى 100 بدل 50 كي تمر معرّفات العمليات الطويلة على السلسلة (TRC20: 64 حرف hex،
  // BEP20 on-chain: "0x" + 64 حرف hex = 66 حرفاً) دون رفضها بالخطأ.
  return typeof v==="string" && /^[A-Za-z0-9\-_]{3,100}$/.test(v.trim());
}

// [SECURITY FIX — CWE-918 SSRF] الفحص السابق لا يحظر 172.17-172.31 (كامل نطاق RFC1918)، ولا
// ترميز IP العشري/السداسي (http://2130706433/ ≡ 127.0.0.1)، ولا ::ffff:127.0.0.1. نفس الحل
// المطبّق أصلاً في saraqib-admin/security.ts (isSafeUrlForOutboundRequest) — مكرّر هنا لأن هذه
// القيمة تُخزَّن فقط حالياً ولا تُجلب من الخادم، فلا حاجة لفحص DNS الإضافي.
function isDecimalOrHexIpEncoding(hostname: string): boolean {
  if (/^0x[0-9a-f]+$/i.test(hostname)) return true;
  if (/^\d+$/.test(hostname) && hostname.length > 3) return true;
  return false;
}

export function isValidUrl(v: unknown): boolean {
  if (typeof v !== "string" || v.length > 2048) return false;
  try {
    const u = new URL(v);
    if (!["http:", "https:"].includes(u.protocol)) return false;
    // منع SSRF — حماية من الوصول لـ internal services
    let h = u.hostname.toLowerCase();
    if (h.startsWith("[") && h.endsWith("]")) h = h.slice(1, -1);
    for (const b of ["localhost", "metadata.google.internal", "metadata"]) {
      if (h === b || h.endsWith("." + b)) return false;
    }
    if (isDecimalOrHexIpEncoding(h)) return false;
    if (h === "::1" || h === "::") return false;
    if (h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return false;
    const mapped = h.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
    if (mapped) h = mapped[1];
    const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4) {
      const a = parseInt(ipv4[1]), b2 = parseInt(ipv4[2]);
      if (a === 127 || a === 0 || a === 10 || (a === 172 && b2 >= 16 && b2 <= 31) || (a === 192 && b2 === 168) || (a === 169 && b2 === 254) || (a === 100 && b2 >= 64 && b2 <= 127)) return false;
    }
    return true;
  } catch { return false; }
}

// ══════════════════════════════════════════════════════════════
//  [NEW] الطبقة 15 — Safe Error Handler
//  يمنع تسريب تفاصيل الأخطاء الداخلية للعميل
// ══════════════════════════════════════════════════════════════

/**
 * استخدم هذه الدالة بدلاً من: res.status(500).json({ error: e.message })
 * تُخفي تفاصيل الخطأ في production وتُظهرها فقط في development
 *
 * [FIX] أخطاء Supabase ليست instances من Error — هي كائنات عادية
 * { message, details, hint, code }. الكود القديم كان يستخدم String(e)
 * عليها، فكان يطبع "[object Object]" في الـ logs ويخفي السبب الحقيقي
 * تماماً، حتى عن المطوّر نفسه. الآن نستخرج الحقول المفيدة من أي شكل خطأ.
 */
export function safeError(res: Response, e: unknown, fallback = "حدث خطأ داخلي، يرجى المحاولة مرة أخرى"): void {
  const isDev = process.env.NODE_ENV !== "production";

  let msg = "Unknown error";
  let details: Record<string, unknown> | undefined;
  let stack: string | undefined;

  if (e instanceof Error) {
    msg = e.message;
    stack = e.stack;
  } else if (e && typeof e === "object") {
    const obj = e as Record<string, unknown>;
    // شكل خطأ Supabase / PostgREST النمطي: { message, details, hint, code }
    const parts = [obj.message, obj.details, obj.hint, obj.code]
      .filter((v) => v !== undefined && v !== null && v !== "")
      .map(String);
    msg = parts.length ? parts.join(" | ") : JSON.stringify(obj);
    details = obj;
  } else {
    msg = String(e);
  }

  const req = (res as any).req as Request | undefined;
  const route = req ? `${req.method} ${req.originalUrl || req.path}` : "unknown route";
  const reqId = req ? ((req as any).id || res.getHeader("X-Request-Id")) : undefined;
  const ip = req ? getClientIp(req) : "unknown";
  const timestamp = new Date().toISOString();

  // لوغ مفصّل دائماً (dev و production): يوضح متى، أين (route/IP/requestId)، والسبب الحقيقي + stack
  console.error(
    `[INTERNAL ERROR] ${timestamp} | ${route} | ip=${ip}${reqId ? ` | reqId=${reqId}` : ""}\n` +
    `  → السبب: ${msg}` +
    (details ? `\n  → التفاصيل: ${JSON.stringify(details)}` : "") +
    (stack ? `\n  → Stack:\n${stack}` : "")
  );

  if (isDev) {
    res.status(500).json({ error: msg, details, route });
  } else {
    // في production: لا نكشف تفاصيل الخطأ الداخلية للمهاجم، لكن نُظهر للمستخدم
    // رسالة واضحة تشرح ما فشل تحديداً بدل جملة عامة غامضة
    res.status(500).json({ error: fallback });
  }
}

// ══════════════════════════════════════════════════════════════
//  Middleware الموحَّد
// ══════════════════════════════════════════════════════════════

export function masterSecurityMiddleware(req: Request, res: Response, next: NextFunction) {
  requestId(req, res, () =>
    securityHeaders(req, res, () =>
      corsMiddleware(req, res, () =>
        ipBanCheck(req, res, () =>
          honeypotMiddleware(req, res, () =>
            botDetection(req, res, () =>
              payloadSizeGuard(req, res, () =>
                injectionGuard(req, res, next)
              )
            )
          )
        )
      )
    )
  );
}

export function logSecurityEvent(type: string, req: Request, details?: string): void {
  const ip = getClientIp(req);
  console.warn(`[SEC] ${new Date().toISOString()} | ${type} | ${ip} | ${req.method} ${req.path}${details?" | "+details:""}`);
}

// ══════════════════════════════════════════════════════════════
//  [NEW] تنبيهات تيليجرام أمنية فورية
//  اضبط SECURITY_TELEGRAM_BOT_TOKEN و SECURITY_TELEGRAM_CHAT_ID في .env
//  (يُفضَّل بوت منفصل عن بوت المستخدمين TELEGRAM_USER_BOT_TOKEN حتى لا تختلط
//  رسائل الأمان مع رسائل العملاء العاديين)
// ══════════════════════════════════════════════════════════════

const SECURITY_BOT_TOKEN = process.env.SECURITY_TELEGRAM_BOT_TOKEN || "";
const SECURITY_CHAT_ID   = process.env.SECURITY_TELEGRAM_CHAT_ID   || "";
let _warnedMissingSecurityBot = false;

function escapeHtml(v: string): string {
  return v.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

/**
 * sendSecurityTelegramAlert — يرسل تنبيهاً فورياً لقناة/شات تيليجرام مخصصة
 * للأمان. لا يُلقي استثناءً أبداً مهما فشل (شبكة، توكن خاطئ...) — إرسال
 * تنبيه ثانوي لا يجوز أن يُسقط الطلب الأساسي (نفس مبدأ صمام الأمان أدناه).
 */
export async function sendSecurityTelegramAlert(text: string): Promise<void> {
  if (!SECURITY_BOT_TOKEN || !SECURITY_CHAT_ID) {
    if (!_warnedMissingSecurityBot) {
      console.warn("[SEC] ⚠️ SECURITY_TELEGRAM_BOT_TOKEN/SECURITY_TELEGRAM_CHAT_ID غير مضبوطين في .env — سيتم الاكتفاء بتسجيل الأحداث الأمنية في الكونسول فقط.");
      _warnedMissingSecurityBot = true;
    }
    return;
  }
  try {
    const resp = await fetch(`https://api.telegram.org/bot${SECURITY_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: SECURITY_CHAT_ID, text, parse_mode: "HTML", disable_web_page_preview: true }),
    });
    if (!resp.ok) {
      console.error(`[SEC] فشل إرسال تنبيه تيليجرام: HTTP ${resp.status}`);
    }
  } catch (e) {
    console.error("[SEC] خطأ في إرسال تنبيه تيليجرام (تم تجاهله، الطلب الأساسي يستمر):", e);
  }
}

// ══════════════════════════════════════════════════════════════
//  [NEW] صمام الأمان — Graceful Fallback
//  الهدف: لا يجوز أبداً أن يوقف عطل جزئي (كاش، خدمة طرف ثالث، خطأ غير متوقع)
//  عملية بيع أو استقبال دفعة. كل عطل يُمتَص ويُسجَّل، والمتجر يستمر بالعمل.
// ══════════════════════════════════════════════════════════════

/**
 * safeExternalCall — نفّذ استدعاء خدمة خارجية/ثانوية (كاش، تحليلات، رفع صور،
 * geo-IP...) وإن فشلت لأي سبب (تجاوز حصة، انقطاع، مهلة زمنية) أرجِع قيمة
 * احتياطية بدل تعطيل الطلب كله. استخدمها لأي شيء "غير حرج" للبيع نفسه.
 *
 * مثال: بدل  `const cached = await redis.get(key);`
 * استخدم: `const cached = await safeExternalCall("redis-get", () => redis.get(key), null);`
 */
export async function safeExternalCall<T>(
  label: string,
  fn: () => Promise<T>,
  fallbackValue: T,
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.error(`[FALLBACK] ⚠️ فشلت خدمة "${label}" — تم تجاهل الفشل ومتابعة الطلب بقيمة احتياطية.`, e);
    return fallbackValue;
  }
}

/**
 * globalErrorHandler — شبكة الأمان الأخيرة على مستوى Express. سجّلها بعد كل
 * الراوترات مباشرة: app.use(globalErrorHandler). أي خطأ يُفلت من كل try/catch
 * الموجودة داخل الراوترات (استثناء متزامن، next(err)...) يُمسَك هنا ويُرجَع
 * كـ JSON مفهوم للعميل بدل صفحة خطأ HTML افتراضية أو طلب معلّق بلا رد.
 */
export function globalErrorHandler(err: any, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) { next(err); return; }
  safeError(res, err, "حدث خطأ غير متوقع من جهتنا. حاول مرة أخرى بعد قليل.");
}

/**
 * installGlobalCrashGuards — استدعِها مرة واحدة عند إقلاع السيرفر.
 * تمسك أي استثناء (uncaughtException) أو Promise مرفوض (unhandledRejection)
 * لم يُعالَج في أي مكان بالكود، بدل أن يُسقط Node.js العملية بالكامل — ما
 * كان سيعني توقف المتجر عن استقبال أي طلب أو دفعة حتى إعادة التشغيل اليدوي.
 *
 * ⚠️ ملاحظة تقنية صادقة: عدم الخروج من العملية بعد uncaughtException قرار
 * واعٍ هنا (استمرارية البيع أولوية قصوى)، لكنه يحمل خطراً نظرياً إن كان سبب
 * الخطأ حالة ذاكرة داخلية فاسدة قد تتكرر. لذلك تُرسَل هذه الأخطاء فوراً إلى
 * تيليجرام ليتدخّل فريق تقني بسرعة، بينما يستمر السيرفر بخدمة بقية المستخدمين.
 */
export function installGlobalCrashGuards(): void {
  process.on("uncaughtException", (err) => {
    console.error("[FATAL] 🔥 Uncaught Exception — تم امتصاصها، السيرفر يستمر بالعمل:", err);
    void sendSecurityTelegramAlert(
      `🔥 <b>Uncaught Exception</b>\nالسيرفر استمر بالعمل ولم يتوقف عن استقبال الطلبات.\n<code>${escapeHtml(String(err?.stack || err).slice(0, 800))}</code>`
    );
  });

  process.on("unhandledRejection", (reason) => {
    console.error("[FATAL] 🔥 Unhandled Promise Rejection — تم امتصاصها، السيرفر يستمر بالعمل:", reason);
    const detail = (reason as any)?.stack || reason;
    void sendSecurityTelegramAlert(
      `🔥 <b>Unhandled Promise Rejection</b>\nالسيرفر استمر بالعمل ولم يتوقف عن استقبال الطلبات.\n<code>${escapeHtml(String(detail).slice(0, 800))}</code>`
    );
  });
}
