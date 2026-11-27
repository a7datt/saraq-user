import "dotenv/config";
import express from "express";
import { loadDiscountRules, resolveDiscountPercent, sanitizeRulesInput, maxDiscountPercentForCost, pickMostSpecificRule } from "./discountEngine";
import helmet from "helmet";
import hpp from "hpp";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
// [SECURITY FIX] القسم 11.1 من تقرير الفحص الأمني: أُزيل استيراد node-telegram-bot-api
// (يحمل اعتماديات فرعية بثغرات Critical: form-data، request، protobufjs). المكتبة كانت
// مستوردة فقط للنوع TelegramBot، وuserBot يبقى دائماً null في هذا المشروع (البوت الفعلي
// يعمل من مشروع admin المنفصل) — كود ميت لا يُنفَّذ إطلاقاً في وقت التشغيل، فحذفه آمن
// بالكامل ويُزيل الثغرة نهائياً من هذا المشروع دون الحاجة لأي اختبار وظيفي.
import bcrypt from "bcryptjs";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";
import crypto from "crypto";
import fs from "fs";
import { resolveSeoForPath, injectSeoIntoHtml, buildRobotsTxt, buildSitemapXml } from "./seo.ts";
import { VOLSEVER_GAME_MAP, verifyVolseverName } from "./volsever.ts";
import { createAgentCore } from "./agentCore.ts";
import { applyPaymentMethodBonus, generateAutoChargeCode, timingSafeEqualStrings, encryptProviderData, decryptProviderData, isEncrypted } from "./paymentMath.ts";

/**
 * notifyAdminServer — [FIX-ROOT-CAUSE] هذا السيرفر (saraqib-store-user) يعمل كعملية PM2 منفصلة
 * تماماً عن saraqib-store-admin (لوحة التحكم)، ولا يحتوي على أي كود لبوت الأدمن على تيليجرام أو
 * نظام الصلاحيات/الإشعارات الخاص به. لذلك كانت كل الأحداث (طلب جديد، شحن رصيد، تسجيل
 * مستخدم) تصير هنا دون أي إشعار يصل لبوت الأدمن إطلاقاً، بغض النظر عن صحة الصلاحيات هناك.
 * هذه الدالة ترسل نداء HTTP داخلي (نفس الخادم الفعلي، عبر 127.0.0.1) لمسار
 * /api/internal/notify-admins على saraqib-store-admin، والذي بدوره يستدعي notifyAdmins() الحقيقية
 * هناك ويرسل عبر بوت الأدمن. الاتصال محمي بمفتاح سري مشترك (ADMIN_INTERNAL_SECRET) بدلاً
 * من توكن أدمن حقيقي، لأنه اتصال خادم-لخادم. أي فشل هنا يُسجَّل فقط في اللوغ ولا يوقف أو
 * يبطئ استجابة الطلب/الدفعة للمستخدم (fire-and-forget آمن).
 */
const BOT_STORE_TYPE_LABELS: Record<string, string> = {
  normal: "عادي",
  quick_order: "طلب سريع",
  quantities: "بالكميات",
  external_api: "تلقائي",
  inventory: "مخزون",
  gallery: "معرض",
};
// [FIX-ROOT-CAUSE] نسخة مطابقة تماماً لدالة formatOrderExtraDataForBot في saraqib-store-admin
function formatOrderExtraDataForBot(meta: any): string {
  if (!meta || typeof meta !== "object" || Object.keys(meta).length === 0) return "لا يوجد";
  const lines: string[] = [];
  const seen = new Set<string>();
  const playerId = String(meta.playerId || meta.player_id || meta.input || "").trim();
  if (playerId) {
    lines.push(`  • معرف اللاعب: ${playerId}`);
    seen.add(playerId);
  }
  if (meta.storeType) {
    lines.push(`  • نوع المتجر: ${BOT_STORE_TYPE_LABELS[meta.storeType] || meta.storeType}`);
  }
  const fields = [
    ...(Array.isArray(meta.defaultFields) ? meta.defaultFields : []),
    ...(Array.isArray(meta.customFields) ? meta.customFields : []),
  ];
  for (const f of fields) {
    if (!f) continue;
    const label = String(f.label ?? "").trim();
    const value = String(f.value ?? "").trim();
    if (!label || !value) continue;
    const key = `${label}::${value}`;
    if (seen.has(key) || seen.has(value)) continue;
    seen.add(key);
    lines.push(`  • ${label}: ${value}`);
  }
  if (meta.ahminix_order_id) lines.push(`  • معرف Ahminix: ${meta.ahminix_order_id}`);
  return lines.length > 0 ? `\n${lines.join("\n")}` : "لا يوجد";
}
async function notifyAdminServer(notificationKey: string, text: string, actionType?: "order" | "topup", entityId?: string | number): Promise<void> {
  const secret = process.env.ADMIN_INTERNAL_SECRET || "";
  const adminServerUrl = process.env.ADMIN_SERVER_URL || "";
  if (!secret || !adminServerUrl) {
    console.warn(
      `[NOTIFY-ADMIN-SERVER] لم يتم إرسال إشعار "${notificationKey}" — ADMIN_INTERNAL_SECRET أو ADMIN_SERVER_URL غير مضبوطين في متغيرات البيئة لهذا السيرفر (saraqib-store-user).`
    );
    return;
  }
  try {
    const resp = await fetch(`${adminServerUrl.replace(/\/$/, "")}/api/internal/notify-admins`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-internal-secret": secret },
      body: JSON.stringify({ notificationKey, text, actionType, entityId }),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => "");
      console.error(`[NOTIFY-ADMIN-SERVER] فشل إرسال إشعار "${notificationKey}" إلى saraqib-store-admin: HTTP ${resp.status} ${body}`);
    }
  } catch (e: any) {
    console.error(`[NOTIFY-ADMIN-SERVER] خطأ شبكة عند إرسال إشعار "${notificationKey}" إلى saraqib-store-admin:`, e?.message || e);
  }
}

/**
 * uploadBufferToImgbb — يرفع Buffer صورة (مثلاً القادمة من بوت تيليجرام) إلى ImgBB.
 * نستخدم multipart/form-data (Blob) بدل تحويل الصورة إلى base64 ثم إرسالها كنص عبر
 * URLSearchParams، لأن الـ base64 يكبّر حجم البيانات المرسلة ~33% ويبطئ الرفع بلا داعٍ.
 */
async function uploadBufferToImgbb(buffer: ArrayBuffer, filename = "image.jpg"): Promise<string> {
  // [SEC-FIX] كان هناك مفتاح ImgBB API مكتوب مباشرة في الكود كقيمة احتياطية (CWE-798:
  // Hardcoded Credentials) — أي شخص يطّلع على الكود (المستودع، أدوات bundling غير الآمنة،
  // إلخ) يحصل على مفتاح صالح للرفع إلى حساب ImgBB، ما قد يُستخدم لاستنزاف حصة الحساب أو
  // رفع محتوى غير مرغوب باسمه. المفتاح يجب أن يأتي فقط من متغيرات البيئة.
  const imgbbKey = process.env.IMGBB_API_KEY || "";
  if (!imgbbKey) {
    throw new Error("IMGBB_API_KEY غير مضبوط في متغيرات البيئة — تعذّر رفع الصورة");
  }
  const formData = new FormData();
  formData.append("image", new Blob([buffer]), filename);
  const imgbbRes = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbKey}`, {
    method: "POST",
    body: formData,
  });
  const imgbbData = (await imgbbRes.json()) as any;
  if (!imgbbData.success) throw new Error("ImgBB upload failed");
  return imgbbData.data.url as string;
}
import {
  createUserToken, verifyUserToken,
  createGoogleTempToken, verifyGoogleTempToken,
  authenticate, requireSelf, setBanLookup, setUserTokenVersionLookup,
  authLimiter, forgotPassLimiter, orderLimiter, chatLimiter, uploadLimiter, generalLimiter, otpLimiter, autoChargeVerifyLimiter,
  masterSecurityMiddleware, ipBanCheck, botDetection, injectionGuard,
  securityHeaders, corsMiddleware,
  isValidEmail, isValidPhone, isValidPassword, isValidName,
  isValidId, isValidQuantity, isValidAmount,
  sanitizeText, deepSanitize, isValidVoucherCode, isValidTxNumber, isValidUrl,
  checkAccountLockout, recordFailedLogin, clearLoginAttempts,
  logSecurityEvent, payloadSizeGuard, requestId,
  safeError, generateSecureOtp, getClientIp, isDisposableEmail, isValidPushEndpoint, verifyCaptcha,
  apiTokenAuth, clientApiLimiter, setApiTokenLookup, setApiTokenTouch, setMaintenanceCheck,
  type ApiTokenRecord,
  // [NEW] صمام الأمان (Graceful Fallback) — حظر بصمة الجهاز وتنبيهات تيليجرام
  // يعملان داخلياً ضمن security.ts (ipBanCheck/honeypotMiddleware) ولا يحتاجان
  // استيراداً مباشراً هنا؛ safeExternalCall متاحة لأي جزء مستقبلي في server.ts
  // يستدعي خدمة خارجية ثانوية (كاش/تحليلات) ويريد صمام أمان جاهزاً حولها.
  globalErrorHandler, installGlobalCrashGuards, safeExternalCall,
  // [SEC-FIX] مطلوبة لإرسال تنبيه فوري عند فشل زيادة الرصيد بعد اعتماد معاملة تلقائياً (verify-auto)
  sendSecurityTelegramAlert,
} from "./security.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Supabase Configuration ---
const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
}

const supabase = createClient(supabaseUrl, supabaseKey);

// [FIX-PAGINATION] PostgREST يُطبّق حدّاً افتراضياً (1000 صف) على كل استعلام SELECT
// بلا .range()/.limit() صريح، ويُسقِط أي صف بعده بصمت (بلا خطأ). مع متجر يملك آلاف
// المنتجات بقسم واحد، أي استعلام "كل منتجات هذا القسم" بلا هذه الدالة كان يُخفي
// بصمت كل منتج يقع بعد الصف الألف. تجلب هذه الدالة كل الصفوف بصفحات متتالية
// (1000 لكل صفحة، وهو أقصى ما يسمح به PostgREST) حتى تنتهي النتائج فعلاً.
const PRODUCTS_FETCH_PAGE_SIZE = 1000;
async function fetchAllRowsPaged<T = any>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: any }>
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PRODUCTS_FETCH_PAGE_SIZE) {
    const { data: page, error } = await buildQuery(from, from + PRODUCTS_FETCH_PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(page || []));
    if (!page || page.length < PRODUCTS_FETCH_PAGE_SIZE) break;
  }
  return rows;
}

// نسبة عمولة/بونص طريقة الدفع وبقية الدوال المالية البحتة انتقلت إلى paymentMath.ts
// (لتمكين اختبارها آلياً بدون تشغيل السيرفر كاملاً) — استيراد أدناه.

// --- Web Push Configuration ---
let vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY!,
  privateKey: process.env.VAPID_PRIVATE_KEY!,
};

if (vapidKeys.publicKey && vapidKeys.privateKey) {
  try {
    webpush.setVapidDetails(
      "mailto:yallamha86@gmail.com",
      vapidKeys.publicKey,
      vapidKeys.privateKey
    );
  } catch (e) {
    console.error("Failed to set VAPID details. Push notifications may not work.", e);
  }
}

// --- Store logo: يُجلب من قاعدة البيانات (store_appearance.logo_url) الذي يضبطه الأدمن من "مظهر المتجر" ---
// [SECURITY FIX — CWE-208 Timing Attack] hash ثابت لا يطابق أي كلمة مرور حقيقية، يُستخدم لتشغيل
// bcrypt.compare صوري بنفس التكلفة الزمنية عند عدم وجود مستخدم، لمنع تعداد البريد الإلكتروني
// عبر فرق التوقيت بين "بريد غير مسجل" (ينتهي فوراً) و"بريد مسجل" (ينتظر bcrypt.compare)
const DUMMY_BCRYPT_HASH = "$2b$12$wPr2Rk3o8mT6yQeZnZ1QhOQWjxPZFLT1U3vLZC5pqyQyQpN9mOQfG";

const FALLBACK_LOGO = "/logo.svg"; // احتياطي أخير فقط إذا لم يرفع الأدمن لوغو بعد
let storeLogoCache: { url: string; at: number } | null = null;
const STORE_LOGO_TTL_MS = 60_000;

const getStoreLogoUrl = async (): Promise<string> => {
  if (storeLogoCache && Date.now() - storeLogoCache.at < STORE_LOGO_TTL_MS) return storeLogoCache.url;
  try {
    const { data } = await supabase.from("store_appearance").select("logo_url").eq("id", 1).maybeSingle();
    const url = String((data as any)?.logo_url || "").trim() || FALLBACK_LOGO;
    storeLogoCache = { url, at: Date.now() };
    return url;
  } catch {
    return storeLogoCache?.url || FALLBACK_LOGO;
  }
};

const guessImageMime = (url: string): string => {
  const ext = (url.split("?")[0].split("#")[0].split(".").pop() || "").toLowerCase();
  if (ext === "webp") return "image/webp";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "svg") return "image/svg+xml";
  if (ext === "gif") return "image/gif";
  return "image/png";
};

// manifest.json ديناميكي: نفس ملف public/manifest.json لكن أيقونات التطبيق (PWA) من لوغو المتجر
const buildDynamicManifest = async (): Promise<any> => {
  let base: any = {};
  for (const p of [path.join(__dirname, "dist", "manifest.json"), path.join(__dirname, "public", "manifest.json")]) {
    try {
      if (fs.existsSync(p)) { base = JSON.parse(fs.readFileSync(p, "utf-8")); break; }
    } catch { /* جرّب المسار التالي */ }
  }
  const logo = await getStoreLogoUrl();
  const type = guessImageMime(logo);
  base.icons = [
    { src: logo, sizes: "192x192", type, purpose: "any" },
    { src: logo, sizes: "512x512", type, purpose: "any" },
    { src: logo, sizes: "512x512", type, purpose: "maskable" },
  ];
  return base;
};

// --- Push Notifications ---
const sendPushNotification = async (userId: string | null, title: string, body: string, url: string = "/") => {
  try {
    let query = supabase.from("push_subscriptions").select("subscription");
    if (userId) query = query.eq("user_id", userId);

    const { data: subscriptions } = await query;
    const icon = await getStoreLogoUrl();

    if (subscriptions) {
      subscriptions.forEach(sub => {
        try {
          const subscription = JSON.parse(sub.subscription);
          webpush.sendNotification(subscription, JSON.stringify({ title, body, url, icon }))
            .catch(async err => {
              if (err.statusCode === 410 || err.statusCode === 404) {
                await supabase.from("push_subscriptions").delete().eq("subscription", sub.subscription);
              }
            });
        } catch (e) {
          console.error("Push error", e);
        }
      });
    }
  } catch (e) {
    console.error("Push notification error", e);
  }
};

// --- Telegram Helpers ---
// [FIX] بوت المستخدمين مُعطَّل بالكامل في هذا المشروع (سيرفر اليوزر) لتفادي تضارب
// تشغيل نفس بوت التيليجرام من مشروعين مختلفين في آن واحد (رسائل مكررة/عشوائية).
// البوت الفعلي يعمل من مشروع منفصل يقرأ نفس قاعدة البيانات. لذلك userBot يبقى
// دائماً null هنا، وكل الدوال التالية التي تعتمد عليه تتحول تلقائياً لعدم فعل شيء.
const sendTelegramToUser = async (userId: string, text: string) => {
  const { data: user } = await supabase.from("users").select("telegram_chat_id").eq("id", userId).single();
  if (!user?.telegram_chat_id) return;
  if (!userBot) return;
  try {
    await userBot.sendMessage(user.telegram_chat_id, text);
  } catch (e) {
    console.error("Telegram user notify error", e);
  }
};

// [FIX] يبقى null دوماً — تشغيل البوت الفعلي (startBots) أُزيل من هذا المشروع، راجع التعليق أعلاه.
// [SECURITY FIX] النوع أصبح any بدل TelegramBot بعد حذف الاستيراد أعلاه (القسم 11.1) —
// القيمة تبقى null دائماً فلا تغيير فعلي في السلوك، فقط إزالة الاعتمادية غير المستخدمة.
let userBot: any | null = null;

// ============================================================
// START SERVER
// ============================================================
// =================== PAYMENT GATEWAYS (DYNAMIC, DB-DRIVEN) ===================
// إعدادات شام كاش / سيرياتيل كاش (الرابط + المفتاح) تُقرأ من جدول payment_gateways
// المفتاح مشفر بـ AES-256-GCM في القاعدة ويُفك تشفيره فقط لحظة الاستخدام في الذاكرة
// لا يوجد أي رابط أو مفتاح ثابت في الكود أو ملفات env

type GatewayCode = "shamcash" | "syriatelcash" | "binance" | "crypto_usdt_trc20" | "crypto_usdt_bep20";

interface GatewayConfig {
  api_url: string;
  api_key: string; // decrypted, in-memory only
  api_secret?: string; // decrypted, in-memory only (Binance only)
  is_active: boolean;
  max_age_minutes: number; // 0 = بلا حد زمني (يقبل أي عملية قديمة) — يُستخدم أيضاً كـ"مدة صلاحية الفاتورة بالدقائق" عندما verification_mode = 'invoices'
  verification_mode: "transactions" | "invoices" | "webhook"; // متاح لكل البوابات عدا Binance
}

// جزء المسار الذي يحدد نوع المحفظة في /v1/wallets/{type}/... لدى sybclint (apis-shamcash.com) —
// شام كاش وسيرياتيل كاش والعملات الرقمية (TRC20/BEP20) كلها نفس المزوّد بنفس بنية المسارات،
// بخلاف Binance التي لها API منفصل كلياً (binanceSignedRequest) خارج نطاق هذا التوثيق.
const SYBCLINT_WALLET_PATH: Partial<Record<GatewayCode, string>> = {
  shamcash: "shamcash",
  syriatelcash: "syriatel",
  crypto_usdt_trc20: "crypto-usdt-trc20",
  crypto_usdt_bep20: "crypto-usdt-bep20",
};

// تحويل method_type (قيمة payment_methods.method_type) إلى gateway_code (قيمة payment_gateways.gateway_code)
// — محصور بالبوابات التي يمكن أن تدعم نظام الفواتير (Binance مستثنى، له API منفصل كلياً بلا فواتير)
const INVOICE_ELIGIBLE_METHOD_TYPES: Record<string, GatewayCode> = {
  shamcash: "shamcash",
  syriatel: "syriatelcash",
  crypto_usdt_trc20: "crypto_usdt_trc20",
  crypto_usdt_bep20: "crypto_usdt_bep20",
};

const GATEWAY_LABEL_AR: Record<GatewayCode, string> = {
  shamcash: "شام كاش",
  syriatelcash: "سيرياتيل كاش",
  binance: "Binance Pay",
  crypto_usdt_trc20: "USDT (TRC20)",
  crypto_usdt_bep20: "USDT (BEP20)",
};

/** يحاول استخراج توقيت العملية من أي حقل زمني شائع تُرجعه البوابات (شام كاش/سيرياتيل/Binance) */
function extractTxTimestampMs(t: any): number | null {
  const raw = t?.tranTime ?? t?.transactionTime ?? t?.createTime ?? t?.created_at ?? t?.createdAt ?? t?.time ?? t?.date ?? t?.timestamp ?? null;
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") {
    // ثوانٍ يونكس مقابل ميلي ثانية
    return raw < 10_000_000_000 ? raw * 1000 : raw;
  }
  const parsed = Date.parse(String(raw));
  return Number.isNaN(parsed) ? null : parsed;
}

/** يتحقق أن توقيت العملية يقع ضمن نافذة القبول المحددة من لوحة التحكم (max_age_minutes) */
function isWithinAcceptWindow(t: any, maxAgeMinutes: number): { ok: boolean; ageMinutes?: number } {
  if (!maxAgeMinutes || maxAgeMinutes <= 0) return { ok: true }; // 0 = بلا حد زمني
  const ms = extractTxTimestampMs(t);
  if (ms === null) return { ok: true }; // لا يوجد حقل زمني في استجابة البوابة: لا نرفض بسبب غياب البيانات
  const ageMinutes = (Date.now() - ms) / 60000;
  return { ok: ageMinutes <= maxAgeMinutes, ageMinutes };
}

const gatewayConfigCache = new Map<GatewayCode, { config: GatewayConfig | null; expires: number }>();
const GATEWAY_CACHE_TTL_MS = 30_000;

function invalidateGatewayCache(code?: GatewayCode) {
  if (code) gatewayConfigCache.delete(code);
  else gatewayConfigCache.clear();
}

/** يجلب إعدادات بوابة من القاعدة ويفك تشفير المفتاح، مع كاش قصير الأمد في الذاكرة */
async function getGatewayConfig(code: GatewayCode): Promise<GatewayConfig | null> {
  const cached = gatewayConfigCache.get(code);
  if (cached && cached.expires > Date.now()) return cached.config;

  const { data, error } = await supabase
    .from("payment_gateways")
    .select("api_url, api_key_enc, api_secret_enc, is_active, max_age_minutes, verification_mode")
    .eq("gateway_code", code)
    .single();

  if (error || !data) {
    gatewayConfigCache.set(code, { config: null, expires: Date.now() + GATEWAY_CACHE_TTL_MS });
    return null;
  }

  let apiKey = "";
  try {
    if (data.api_key_enc) apiKey = decryptProviderData(data.api_key_enc);
  } catch (e) {
    console.error(`[GATEWAY] فشل فك تشفير مفتاح ${code}:`, e);
  }

  let apiSecret = "";
  try {
    if (data.api_secret_enc) apiSecret = decryptProviderData(data.api_secret_enc);
  } catch (e) {
    console.error(`[GATEWAY] فشل فك تشفير سر ${code}:`, e);
  }

  const config: GatewayConfig = {
    api_url: (data.api_url || "").trim().replace(/[/]+$/, ""),
    api_key: apiKey,
    api_secret: apiSecret || undefined,
    is_active: !!data.is_active,
    max_age_minutes: Number(data.max_age_minutes) || 0,
    verification_mode: (data.verification_mode === "invoices" || data.verification_mode === "webhook") ? data.verification_mode : "transactions"
  };
  gatewayConfigCache.set(code, { config, expires: Date.now() + GATEWAY_CACHE_TTL_MS });
  return config;
}

// ─── Binance Pay: طلب موقّع بـ HMAC-SHA256 (X-MBX-APIKEY + signature) ───────
async function binanceSignedRequest(path: string, params: Record<string, string | number> = {}): Promise<any> {
  const cfg = await getGatewayConfig("binance");
  if (!cfg || !cfg.api_url || !cfg.api_key || !cfg.api_secret) {
    return { status: 0, data: { error: "بوابة Binance غير مُهيّأة — أضف الرابط والمفتاح والسر من لوحة التحكم" } };
  }
  const isDevEnv = process.env.NODE_ENV !== "production";
  const query: Record<string, string> = {};
  for (const [k, v] of Object.entries(params)) query[k] = String(v);
  query.timestamp = String(Date.now());
  query.recvWindow = query.recvWindow || "5000";

  const qs = Object.keys(query)
    .sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(query[k])}`)
    .join("&");

  const signature = crypto.createHmac("sha256", cfg.api_secret).update(qs).digest("hex");
  const url = `${cfg.api_url}${path}?${qs}&signature=${signature}`;

  if (isDevEnv) console.log(`[GATEWAY:binance] Request: GET ${path}`);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "X-MBX-APIKEY": cfg.api_key
      }
    });
    const text = await res.text();
    if (isDevEnv) console.log(`[GATEWAY:binance] Response status:`, res.status, "body:", text.substring(0, 300));
    try { return { status: res.status, data: JSON.parse(text) }; }
    catch { return { status: res.status, data: { error: text } }; }
  } catch (e: any) {
    return { status: 0, data: { error: String(e) } };
  }
}

async function gatewayRequest(code: GatewayCode, method: "GET" | "POST" | "DELETE", path: string, body?: any): Promise<any> {
  const cfg = await getGatewayConfig(code);
  if (!cfg || !cfg.api_url || !cfg.api_key) {
    return { status: 0, data: { error: `بوابة ${code} غير مُهيّأة — أضف الرابط والمفتاح من لوحة التحكم` } };
  }
  const url = `${cfg.api_url}${path}`;
  console.log(`[GATEWAY:${code}] Request:`, method, url);
  const res = await fetch(url, {
    method,
    headers: {
      "Accept": "application/json",
      "Content-Type": "application/json",
      "Authorization": `Bearer ${cfg.api_key}`
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const text = await res.text();
  console.log(`[GATEWAY:${code}] Response status:`, res.status, "body:", text.substring(0, 300));
  try { return { status: res.status, data: JSON.parse(text) }; }
  catch { return { status: res.status, data: { error: text } }; }
}

// ===================== تحقق موحّد من معاملات sybclint (شام كاش/سيرياتيل كاش/عملات رقمية) =====================
// [SECURITY FIX] فرض direction=in + مطابقة tranId/amount/currency الصارمة مقابل مدخلات المستخدم
// وعملة المحفظة الفعلية + نافذة القبول الزمنية (max_age_minutes) — نفس مستوى التحقق لكل بوابات
// sybclint دون استثناء (كانت سابقاً مطبّقة لشام كاش فقط، وسيرياتيل كاش بلا أي تحقق مبلغ/عملة/زمن).
// تم إزالة فحص peerUserName/peerAccountNumber بناءً على طلب صريح سابق، لأن شام كاش تُخفي جزءاً
// من هذه الحقول طبيعياً حتى بالعمليات المشروعة.
async function verifySybclintTx(
  gatewayCode: GatewayCode,
  txNumber: string,
  walletAddress: string,
  expectedAmount?: number,
  expectedCurrency?: string
): Promise<{ found: boolean; amount?: number; currency?: string; rejected?: boolean; rejectReason?: string; debug?: string }> {
  try {
    const cfg = await getGatewayConfig(gatewayCode);
    const pathType = SYBCLINT_WALLET_PATH[gatewayCode] || gatewayCode;
    const r = await gatewayRequest(gatewayCode, "GET", `/v1/wallets/${pathType}/${encodeURIComponent(walletAddress)}/transactions?direction=in`);
    if (r.status === 200 && Array.isArray(r.data)) {
      const incoming = r.data.filter((t: any) => {
        if (t.direction !== undefined) return String(t.direction).toLowerCase() === "in";
        if (t.tranKind !== undefined) return Number(t.tranKind) === 1;
        return true;
      });

      const tx = incoming.find((t: any) => String(t.tranId ?? t.id ?? "") === String(txNumber));
      if (!tx) {
        return { found: false, debug: JSON.stringify(r.data).substring(0, 300) };
      }

      const window = isWithinAcceptWindow(tx, cfg?.max_age_minutes || 0);
      if (!window.ok) {
        return {
          found: true,
          rejected: true,
          rejectReason: `انتهت مهلة قبول العملية (عمرها ${Math.round(window.ageMinutes || 0)} دقيقة، والمسموح ${cfg?.max_age_minutes} دقيقة)`,
        };
      }

      const txAmount = Math.abs(parseFloat(String(tx.amount || "0")));
      let txCurrency = String(tx.currency || "").toUpperCase();
      // USDT معادل عملياً لـ USD (1:1) بمحافظ العملات الرقمية — نطبّعه للمقارنة دون تغيير القيمة المعروضة
      if ((gatewayCode === "crypto_usdt_trc20" || gatewayCode === "crypto_usdt_bep20") && txCurrency === "USDT") {
        txCurrency = "USD";
      }

      if (expectedCurrency && txCurrency !== String(expectedCurrency).toUpperCase()) {
        return {
          found: true,
          rejected: true,
          rejectReason: `عملة العملية (${txCurrency}) لا تطابق عملة المحفظة المطلوبة (${String(expectedCurrency).toUpperCase()})`,
          amount: txAmount,
          currency: txCurrency,
        };
      }
      if (typeof expectedAmount === "number" && Math.abs(txAmount - expectedAmount) > 0.0001) {
        return {
          found: true,
          rejected: true,
          rejectReason: `المبلغ المُدخل (${expectedAmount}) لا يطابق المبلغ الفعلي للعملية (${txAmount} ${txCurrency})`,
          amount: txAmount,
          currency: txCurrency,
        };
      }

      return { found: true, amount: txAmount, currency: txCurrency || "SYP" };
    }
    return { found: false, debug: JSON.stringify(r.data).substring(0, 300) };
  } catch (e: any) { return { found: false, debug: String(e) }; }
}

/** يبحث عن عملية واحدة محددة برقمها (tranId) ضمن محفظة sybclint دون جلب السجل كاملاً —
 * (GET /v1/wallets/{type}/{walletAddress}/transactions/{tranId}) أسرع وأقل بياناتاً من
 * verifySybclintTx، ويُستخدم في مسار التحقق اليدوي البديل لرمز الشحن التلقائي. */
async function verifySybclintTxById(
  gatewayCode: GatewayCode,
  walletAddress: string,
  tranId: string
): Promise<{ found: boolean; transaction?: any; invalid?: boolean; debug?: string }> {
  try {
    const pathType = SYBCLINT_WALLET_PATH[gatewayCode] || gatewayCode;
    const r = await gatewayRequest(gatewayCode, "GET", `/v1/wallets/${pathType}/${encodeURIComponent(walletAddress)}/transactions/${encodeURIComponent(tranId)}`);
    if (r.status === 400) return { found: false, invalid: true };
    if (r.status === 200 && r.data?.success && r.data?.data) {
      const d = r.data.data;
      if (!d.found || !d.transaction) return { found: false };
      return { found: true, transaction: d.transaction };
    }
    return { found: false, debug: JSON.stringify(r.data).substring(0, 300) };
  } catch (e: any) { return { found: false, debug: String(e) }; }
}

async function verifySyriatelTx(txNumber: string, phoneOrCode: string, expectedAmount?: number, expectedCurrency?: string) {
  return verifySybclintTx("syriatelcash", txNumber, phoneOrCode, expectedAmount, expectedCurrency);
}

async function verifyShamCashTx(txNumber: string, walletAddress: string, expectedAmount?: number, expectedCurrency?: string) {
  return verifySybclintTx("shamcash", txNumber, walletAddress, expectedAmount, expectedCurrency);
}

async function verifyCryptoTx(network: "trc20" | "bep20", txNumber: string, walletAddress: string, expectedAmount?: number, expectedCurrency?: string) {
  const gatewayCode: GatewayCode = network === "trc20" ? "crypto_usdt_trc20" : "crypto_usdt_bep20";
  return verifySybclintTx(gatewayCode, txNumber, walletAddress, expectedAmount, expectedCurrency);
}

// ===================== نظام الفواتير (Invoices) — بديل اختياري لنظام جلب المعاملات =====================
// مشترك بين كل بوابات sybclint (شام كاش/سيرياتيل كاش/العملات الرقمية TRC20+BEP20) — مسار الفواتير
// نفسه (/v1/invoices) غير مرتبط بنوع المحفظة إطلاقاً، فقط عنوان المحفظة (walletAddress) هو ما يُحدِّد
// المزوّد الفعلي ضمنياً لدى sybclint. Binance خارج هذا النظام كلياً (API منفصل تماماً).
// ملاحظة أمنية مهمة (حسب التوثيق): حقل amount في POST /v1/invoices يجب أن يُرسَل كنص (string)
// يطابق ^\d+(\.\d{1,2})?$ — إرساله كرقم JSON عادي يفشل بـ 400 VALIDATION_ERROR.
// كما أن فواتير EUR لديها سلوك تحويل غير مكتمل من طرف شام كاش (تُقارن رقمياً وكأنها SYP دون
// سعر صرف فعلي) — لذلك نمنع صراحة إنشاء فاتورة بعملة EUR في هذا النظام إلى أن يُصلَح ذلك.
// العملة الداخلية المخزَّنة دائماً SYP أو USD (USDT تُعامَل كمكافئ 1:1 لـ USD داخلياً، وتُترجَم
// فقط عند إرسال الطلب الفعلي لمحافظ العملات الرقمية عبر apiInvoiceCurrencyFor أدناه).
const INVOICE_ALLOWED_CURRENCIES: Partial<Record<GatewayCode, readonly string[]>> = {
  shamcash: ["SYP", "USD"],
  syriatelcash: ["SYP"],
  crypto_usdt_trc20: ["USD"],
  crypto_usdt_bep20: ["USD"],
};

/** يحوّل العملة الداخلية (SYP/USD) إلى الصيغة التي يتوقعها الـ API فعلياً لكل بوابة (USDT لمحافظ العملات الرقمية) */
function apiInvoiceCurrencyFor(gatewayCode: GatewayCode, internalCurrency: string): string {
  const upper = String(internalCurrency || "").toUpperCase();
  if ((gatewayCode === "crypto_usdt_trc20" || gatewayCode === "crypto_usdt_bep20") && upper === "USD") return "USDT";
  return upper;
}

function formatAmountForShamCashInvoice(amount: number): string {
  // ينسّق المبلغ كنص بأقصى منزلتين عشريتين ويحذف الأصفار الزائدة، مطابقاً لصيغة شام كاش ^\d+(\.\d{1,2})?$
  const rounded = Math.round(amount * 100) / 100;
  return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(2);
}

/** يُنشئ فاتورة دفع معلّقة لدى sybclint. يرجع invoiceNumber + expiresAt أو رسالة خطأ عربية واضحة. */
async function createShamCashInvoice(
  gatewayCode: GatewayCode,
  walletAddress: string,
  amount: number,
  currency: string,
  expiresInMinutes: number
): Promise<{ ok: true; invoiceNumber: string; expiresAt: string } | { ok: false; error: string }> {
  const upperCurrency = String(currency || "").toUpperCase();
  const allowed = INVOICE_ALLOWED_CURRENCIES[gatewayCode] || ["SYP", "USD"];
  if (!allowed.includes(upperCurrency)) {
    return { ok: false, error: `عملة "${upperCurrency}" غير مدعومة حالياً لهذه الفواتير (المتاح: ${allowed.join("، ")}).` };
  }
  const clampedExpiry = Math.max(5, Math.min(1440, Math.floor(expiresInMinutes) || 30));
  const r = await gatewayRequest(gatewayCode, "POST", "/v1/invoices", {
    amount: formatAmountForShamCashInvoice(amount),
    currency: apiInvoiceCurrencyFor(gatewayCode, upperCurrency),
    walletAddress,
    expiresInMinutes: clampedExpiry
  });
  if (r.status === 201 && r.data?.invoiceNumber) {
    return { ok: true, invoiceNumber: r.data.invoiceNumber, expiresAt: r.data.expiresAt };
  }
  const errCode = r.data?.error;
  const msgByCode: Record<string, string> = {
    WALLET_INACTIVE: "المحفظة المرتبطة بطريقة الدفع هذه غير نشطة. راجع الإدارة.",
    VALIDATION_ERROR: "بيانات الفاتورة غير صالحة (تحقق من المبلغ والعملة).",
    INVALID_WEBHOOK_URL: "رابط Webhook غير آمن أو غير مسموح به.",
  };
  return { ok: false, error: msgByCode[errCode] || r.data?.message || "تعذّر إنشاء الفاتورة. حاول لاحقاً." };
}

/** يتحقق من فاتورة عبر رقم عملية tran_id ويترجم أكواد الأخطاء لرسائل عربية مفهومة. */
async function verifyShamCashInvoice(
  gatewayCode: GatewayCode,
  invoiceNumber: string,
  tranId: string
): Promise<{ ok: true; paidAmount?: number } | { ok: false; error: string; code?: string }> {
  const r = await gatewayRequest(gatewayCode, "POST", `/v1/invoices/${encodeURIComponent(invoiceNumber)}/verify`, { tran_id: tranId });
  if (r.status === 200) {
    return { ok: true, paidAmount: r.data?.paidAmount };
  }
  const errCode = r.data?.error;
  const msgByCode: Record<string, string> = {
    MISSING_TRAN_ID: "يرجى إدخال رقم العملية.",
    NOT_FOUND: "رقم الفاتورة غير موجود.",
    TRANSACTION_NOT_FOUND: "لم يتم العثور على العملية بعد لدى المزوّد. انتظر دقيقة وأعد المحاولة.",
    WALLET_NOT_FOUND: "محفظة الفاتورة لم تعد موجودة. راجع الإدارة.",
    ALREADY_PAID: "هذه الفاتورة مدفوعة بالفعل.",
    INVALID_STATUS: "حالة الفاتورة لا تسمح بالتحقق الآن (قد تكون ملغاة).",
    TRAN_ID_USED: "رقم العملية هذا مستخدم من قبل لفاتورة أخرى.",
    EXPIRED: "انتهت صلاحية الفاتورة. أنشئ فاتورة جديدة.",
    AMOUNT_MISMATCH: "المبلغ المُحوَّل لا يطابق قيمة الفاتورة.",
  };
  return { ok: false, error: msgByCode[errCode] || r.data?.message || "تعذّر التحقق من الفاتورة.", code: errCode };
}

/** يُلغي فاتورة لدى المزوّد (يُستخدم عند ضغط المستخدم على "إلغاء الفاتورة"). لا يرمي عند الفشل — فقط يُبلّغ. */
async function cancelShamCashInvoice(gatewayCode: GatewayCode, invoiceNumber: string): Promise<{ ok: boolean; error?: string }> {
  const r = await gatewayRequest(gatewayCode, "DELETE", `/v1/invoices/${encodeURIComponent(invoiceNumber)}`);
  if (r.status === 200) return { ok: true };
  return { ok: false, error: r.data?.message || "تعذّر إلغاء الفاتورة لدى المزوّد" };
}

/**
 * يبحث عن فاتورة معلّقة سارية الصلاحية بعد للمستخدم (إن وُجدت، لأي بوابة)، ليُعاد استخدامها بدل
 * إنشاء فاتورة وحجز "قيد التحقق" جديدين كل مرة — هذا ما يسمح للمستخدم بالعودة لفاتورته المعلّقة
 * (مثلاً بعد تحديث الصفحة أو إعادة فتح المحفظة) بدل أن يخسرها أو يُنشئ فاتورة مكرّرة.
 * إن وُجدت فاتورة معلّقة انتهت صلاحيتها بالزمن فعلاً (ولو لم يُحدَّث سجلها بعد لأن المستخدم لم
 * يحاول التحقق منها)، نُحرّرها الآن (status=expired + حذف حجز transactions المرتبط) ونُرجع null.
 */
async function findActivePendingShamCashInvoice(userId: number): Promise<null | {
  invoiceNumber: string; expiresAt: string | null; createdAt: string | null; walletAddress: string; amount: number; currency: string; paymentMethodId: number; gatewayCode: GatewayCode;
}> {
  const { data: inv } = await supabase.from("shamcash_invoices")
    .select("*").eq("user_id", userId).eq("status", "pending")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!inv) return null;

  if (inv.expires_at && new Date(inv.expires_at).getTime() < Date.now()) {
    await supabase.from("shamcash_invoices").update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", inv.id);
    await supabase.from("transactions").delete().eq("id", inv.transaction_id).eq("status", "pending_verification");
    clearPendingInvoiceNotification(inv.invoice_number).catch(() => {});
    return null;
  }

  const { data: method } = await supabase.from("payment_methods").select("wallet_address").eq("id", inv.payment_method_id).maybeSingle();
  return {
    invoiceNumber: inv.invoice_number,
    expiresAt: inv.expires_at,
    createdAt: inv.created_at,
    walletAddress: method?.wallet_address || "",
    amount: parseFloat(String(inv.amount)),
    currency: inv.currency,
    paymentMethodId: inv.payment_method_id,
    gatewayCode: (inv.gateway_code || "shamcash") as GatewayCode,
  };
}

/**
 * يضمن وجود إشعار واحد فقط (idempotent عبر action_ref=رقم الفاتورة) يُخبر المستخدم أن لديه
 * فاتورة شحن لم تُستكمل بعد، مع زرَّي "العودة للفاتورة"/"إلغاء الفاتورة" (تُعرَّف الأزرار بالواجهة
 * بناءً على حقل action). يُستدعى عند كل تحقق من الفاتورة المعلّقة (فتح/تحديث صفحة المحفظة) بدل أن
 * يُترك المستخدم بلا أي تنبيه إن غادر الصفحة دون إكمال الدفع أو إلغاء الفاتورة.
 */
async function ensurePendingInvoiceNotification(userId: number, invoiceNumber: string, amount: number, currency: string) {
  try {
    const { data: existing } = await supabase.from("notifications")
      .select("id").eq("user_id", userId).eq("action_ref", invoiceNumber).eq("action", "shamcash_invoice_pending").maybeSingle();
    if (existing) return;
    await supabase.from("notifications").insert({
      user_id: userId,
      title: "لديك فاتورة شحن غير مكتملة",
      message: `لم تُكمل فاتورة شحن بقيمة ${amount} ${currency}. يمكنك العودة إليها لإتمام الدفع أو إلغاؤها.`,
      type: "warning",
      action: "shamcash_invoice_pending",
      action_ref: invoiceNumber,
    });
  } catch (e) { console.error("[INVOICE NOTIF] فشل إنشاء إشعار الفاتورة المعلّقة:", e); }
}

/** يحذف إشعار الفاتورة المعلّقة (إن وُجد) بعد دفعها أو إلغائها أو انتهاء صلاحيتها، فلا يبقى الزر معروضاً لفاتورة لم تعد قابلة للمتابعة */
async function clearPendingInvoiceNotification(invoiceNumber: string) {
  try {
    await supabase.from("notifications").delete().eq("action", "shamcash_invoice_pending").eq("action_ref", invoiceNumber);
  } catch (e) { console.error("[INVOICE NOTIF] فشل حذف إشعار الفاتورة:", e); }
}

// ===================== الشحن التلقائي (Webhook) — بديل ثالث لنظامي جلب المعاملات والفواتير =====================
// بدل أن يُدخل المستخدم مبلغاً ثم رقم عملية (جلب المعاملات)، أو يُنشئ فاتورة بمبلغ محدد مسبقاً
// (الفواتير)، هنا يحصل المستخدم على رمز مميز (7 خانات) يضعه في ملاحظة التحويل، ويحوّل أي مبلغ
// يريده دون تحديد مسبق — موقعنا يستقبل كل معاملة واردة جديدة فور حدوثها عبر Webhook من sybclint
// (بدل الاعتماد على استعلام المستخدم أو تحقق لحظي)، يطابق الملاحظة مع رمز فعّال، ويعتمد الشحن
// تلقائياً بالمبلغ الفعلي الوارد. يعمل بنفس الآلية لكل بوابات sybclint (شام كاش/سيرياتيل/عملات
// رقمية) — Binance مستثنى (API منفصل كلياً بلا Webhook من هذا النوع).
// ملاحظة: حقل "provider" بحمولة الويبهوك يطابق حرفياً نفس مفاتيح INVOICE_ELIGIBLE_METHOD_TYPES
// (shamcash/syriatel/crypto_usdt_trc20/crypto_usdt_bep20) فنعيد استخدامها بدل تكرار نفس التحويل.

// generateAutoChargeCode انتقلت إلى paymentMath.ts

// سر رابط الويبهوك (settings.sybclint_webhook_secret_enc) — مُخزَّن مشفَّراً بنفس AES-256-GCM
// المستخدم لمفاتيح البوابات، ويُقارَن بالقيمة الواردة بالمسار بمقارنة ثابتة الزمن (timingSafeEqual)
// لمنع تخمينه عبر فروقات التوقيت — هذا السر هو طبقة الحماية الوحيدة لنقطة الويبهوك العامة، لأن
// توثيق sybclint لا يوفّر أي آلية توقيع (HMAC) للتحقق من أصالة الطلب.
let cachedWebhookSecret: { value: string | null; expires: number } | null = null;
const WEBHOOK_SECRET_CACHE_TTL_MS = 60_000;
async function getSybclintWebhookSecret(): Promise<string | null> {
  if (cachedWebhookSecret && cachedWebhookSecret.expires > Date.now()) return cachedWebhookSecret.value;
  const { data } = await supabase.from("settings").select("value").eq("key", "sybclint_webhook_secret_enc").maybeSingle();
  let secret: string | null = null;
  if (data?.value) {
    try { secret = decryptProviderData(data.value); } catch (e) { console.error("[WEBHOOK] فشل فك تشفير سر الويبهوك:", e); }
  }
  cachedWebhookSecret = { value: secret, expires: Date.now() + WEBHOOK_SECRET_CACHE_TTL_MS };
  return secret;
}
// timingSafeEqualStrings انتقلت إلى paymentMath.ts

// التحقق من معاملة Binance Pay — نفس منطق verifyShamCashTx تمامًا
// [FIX] المستخدم يُدخل رقم العملية كما يظهره تطبيق Binance للمستخدم العادي، وهو orderId
// (مثال: 448233816541765632) وليس transactionId الداخلي (مثال: P_A23QKS52M1H71116) —
// لذلك نطابق على orderId أولاً مع الإبقاء على transactionId كبديل احتياطي.
// [FIX] المعاملات الواردة الحقيقية تظهر amount موجب والصادرة amount سالب — نرفض الصادرة صراحة
// بدل الاعتماد فقط على تطابق receiverInfo.binanceId (الذي يظهر أيضاً بمعاملات صادرة كطرف مقابل).
// [FIX] عملة Binance Pay الفعلية غالباً USDT (وليست USD) — نعامل USDT كمعادل لـ USD 1:1 عند المقارنة.
async function verifyBinanceTx(
  txId: string,
  receiverBinanceId: string,
  expectedAmount?: number,
  expectedCurrency?: string
): Promise<{ found: boolean; amount?: number; currency?: string; rejected?: boolean; rejectReason?: string; debug?: string }> {
  try {
    const r = await binanceSignedRequest("/sapi/v1/pay/transactions", {});
    const list = Array.isArray(r?.data?.data) ? r.data.data : (Array.isArray(r?.data) ? r.data : []);
    if (r.status === 200 && Array.isArray(list)) {
      // فقط المعاملات الواردة فعلياً: المستلم هو حساب المتجر + المبلغ موجب (الصادرة تُسجَّل بمبلغ سالب)
      const incoming = list.filter((t: any) => {
        const rid = String(t?.receiverInfo?.binanceId ?? "");
        const isReceiver = rid && String(receiverBinanceId) === rid;
        const rawAmount = parseFloat(String(t?.amount ?? "0"));
        return isReceiver && rawAmount > 0;
      });

      const tx = incoming.find((t: any) =>
        String(t.orderId ?? "") === String(txId) || String(t.transactionId ?? "") === String(txId)
      );
      if (!tx) {
        return { found: false, debug: JSON.stringify(list).substring(0, 300) };
      }

      const txAmount = Math.abs(parseFloat(String(tx.amount || "0")));
      let txCurrency = String(tx.currency || "").toUpperCase();
      // USDT معادل عملياً لـ USD بمعاملات Binance Pay — نطبّعه للمقارنة دون تغيير القيمة المعروضة
      const normalizedTxCurrency = txCurrency === "USDT" ? "USD" : txCurrency;

      if (expectedCurrency && normalizedTxCurrency !== String(expectedCurrency).toUpperCase()) {
        return {
          found: true,
          rejected: true,
          rejectReason: `عملة العملية (${txCurrency}) لا تطابق عملة المحفظة المطلوبة (${String(expectedCurrency).toUpperCase()})`,
          amount: txAmount,
          currency: txCurrency,
        };
      }
      if (typeof expectedAmount === "number" && Math.abs(txAmount - expectedAmount) > 0.0001) {
        return {
          found: true,
          rejected: true,
          rejectReason: `المبلغ المُدخل (${expectedAmount}) لا يطابق المبلغ الفعلي للعملية (${txAmount} ${txCurrency})`,
          amount: txAmount,
          currency: txCurrency,
        };
      }

      return { found: true, amount: txAmount, currency: normalizedTxCurrency };
    }
    return { found: false, debug: JSON.stringify(r.data).substring(0, 300) };
  } catch (e: any) { return { found: false, debug: String(e) }; }
}

// جلب قائمة المحافظ (للتشخيص / اختبار الاتصال)
async function samapiListWallets(code: GatewayCode): Promise<any> {
  return gatewayRequest(code, "GET", "/v1/wallets");
}

// =================== PROVIDERS API — MULTI-PROVIDER SYSTEM ===================
// التوكنات وروابط API تُخزَّن مشفرة في جدول providers بقاعدة البيانات
// لا يوجد أي رابط أو توكن ثابت في الكود

// ─── مفتاح التشفير من .env (AES-256-GCM) ───────────────────────────────────
// يجب أن يكون 64 حرف hex (32 بايت). مثال لتوليده:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
const PROVIDER_ENCRYPTION_KEY = process.env.PROVIDER_ENCRYPTION_KEY || "";
if (!PROVIDER_ENCRYPTION_KEY) {
  console.error("[SECURITY] ❌ PROVIDER_ENCRYPTION_KEY غير مضبوط في .env — بيانات المزودين لن تعمل!");
}

// encryptProviderData / decryptProviderData / isEncrypted انتقلت إلى paymentMath.ts

// ─── Cache بسيط للمزودين (TTL: 60 ثانية) لتقليل queries على DB ─────────────
const _providerCache = new Map<number, { data: any; ts: number }>();
const PROVIDER_CACHE_TTL = 60_000;

/**
 * جلب بيانات مزود من DB مع cache وفك تشفير التوكن
 */
async function getProvider(providerId: number): Promise<{
  id: number; name: string; base_url: string; api_token: string; order_method?: "GET" | "POST"; provider_type: "standard" | "megaapi"
} | null> {
  const cached = _providerCache.get(providerId);
  if (cached && Date.now() - cached.ts < PROVIDER_CACHE_TTL) {
    return cached.data;
  }
  const { data, error } = await supabase
    .from("providers")
    .select("id, name, base_url, api_token_enc, is_active, provider_type")
    .eq("id", providerId)
    .eq("is_active", true)
    .single();
  if (error || !data) return null;
  let token = "";
  try {
    token = isEncrypted(data.api_token_enc) ? decryptProviderData(data.api_token_enc) : data.api_token_enc;
  } catch (e: any) {
    console.error(`[PROVIDER] فشل فك تشفير توكن المزود #${providerId}:`, e.message);
    return null;
  }
  const orderMethod = await getProviderOrderMethod(providerId);
  const result = {
    id: data.id,
    name: data.name,
    base_url: (data.base_url || "").replace(/\/$/, ""),
    api_token: token,
    order_method: orderMethod,
    provider_type: (data.provider_type === "megaapi" ? "megaapi" : "standard") as "standard" | "megaapi",
  };
  _providerCache.set(providerId, { data: result, ts: Date.now() });
  return result;
}

/** إبطال cache مزود معين (بعد التعديل مثلاً) */
function invalidateProviderCache(providerId?: number) {
  if (providerId) _providerCache.delete(providerId);
  else _providerCache.clear();
}

/**
 * جلب مزود منتج معين عبر products.provider_id
 */
async function getProviderForProduct(productId: number): ReturnType<typeof getProvider> {
  const { data: product } = await supabase
    .from("products")
    .select("provider_id")
    .eq("id", productId)
    .single();
  if (!product?.provider_id) return null;
  return getProvider(product.provider_id);
}

/**
 * إصلاح ذاتي: يعيد مزامنة عمود products.available لمنتجات المخزون بناءً على
 * العدد الفعلي للعناصر المتاحة حالياً في inventory_units.
 * هذا يمنع بقاء منتج مخفياً بسبب علم "available" قديم بعد إعادة تعبئة المخزون
 * (مثلاً عند إضافة عنصر واحد يدوياً بدل الاستيراد الجماعي).
 * فلتر اختياري (subcategory_id / sub_sub_category_id) لتقليل النطاق حسب الصفحة المطلوبة.
 */
async function syncInventoryProductsAvailability(filter: { subcategory_id?: any; sub_sub_category_id?: any } = {}): Promise<void> {
  try {
    const invProducts = await fetchAllRowsPaged((f, t) => {
      let query: any = supabase.from("products").select("id, inventory_group_id, available").eq("store_type", "inventory").not("inventory_group_id", "is", null);
      if (filter.subcategory_id) query = query.eq("subcategory_id", filter.subcategory_id);
      if (filter.sub_sub_category_id) query = query.eq("sub_sub_category_id", filter.sub_sub_category_id);
      return query.order("id", { ascending: true }).range(f, t);
    });
    if (!invProducts || invProducts.length === 0) return;

    for (const p of invProducts) {
      const { count } = await supabase
        .from("inventory_units")
        .select("id", { count: "exact", head: true })
        .eq("group_id", p.inventory_group_id)
        .eq("status", "available");
      const hasStock = (count || 0) > 0;
      if (hasStock && p.available === false) {
        await supabase.from("products").update({ available: true }).eq("id", p.id);
      } else if (!hasStock && p.available !== false) {
        await supabase.from("products").update({ available: false }).eq("id", p.id);
      }
    }
  } catch {
    // فشل صامت — لا نريد أن يمنع هذا الفحص التحسيني عرض المنتجات
  }
}

function generateUUIDv4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * يرسل طلب GET إلى Provider API
 */
// ============================================================
// EMAIL / OTP HELPERS (Resend API)
// ============================================================
const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const FROM_EMAIL = process.env.FROM_EMAIL || "saraqib-store@apis.sy";
const STORE_NAME = process.env.STORE_NAME || "Saraqib Store";

// --- Google OAuth Configuration ---
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
if (!GOOGLE_CLIENT_ID) console.warn("[GOOGLE] GOOGLE_CLIENT_ID غير مضبوط في .env");

// [FIX] استخدام crypto.randomInt بدلاً من Math.random
// Math.random() ليس CSPRNG ولا يُستخدم لأغراض أمنية
function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

async function sendOtpEmail(to: string, otp: string, type: "verify" | "reset"): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn("[EMAIL] RESEND_API_KEY not set - skipping email send");
    return false;
  }
  const subject = type === "verify"
    ? `${STORE_NAME} - رمز تفعيل الحساب`
    : `${STORE_NAME} - رمز إعادة تعيين كلمة المرور`;
  const title = type === "verify" ? "تفعيل حسابك" : "إعادة تعيين كلمة المرور";
  const desc = type === "verify"
    ? "شكراً لتسجيلك! أدخل الرمز أدناه لتفعيل حسابك."
    : "تلقينا طلباً لإعادة تعيين كلمة مرورك. أدخل الرمز أدناه.";

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,sans-serif;direction:rtl">
<div style="max-width:480px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
  <div style="background:#B00000;padding:32px 24px;text-align:center">
    <h1 style="color:#fff;margin:0;font-size:24px;font-weight:bold">${STORE_NAME}</h1>
    <p style="color:rgba(255,255,255,.85);margin:8px 0 0;font-size:14px">${title}</p>
  </div>
  <div style="padding:32px 24px;text-align:center">
    <p style="color:#555;font-size:15px;margin:0 0 24px">${desc}</p>
    <div style="background:#f8f8f8;border:2px dashed #B00000;border-radius:12px;padding:24px;margin:0 0 24px">
      <p style="margin:0 0 8px;font-size:13px;color:#888">رمز التحقق</p>
      <p style="margin:0;font-size:40px;font-weight:900;letter-spacing:12px;color:#B00000;font-family:monospace">${otp}</p>
    </div>
    <p style="color:#999;font-size:12px;margin:0">صالح لمدة 10 دقائق · لا تشاركه مع أحد</p>
  </div>
  <div style="background:#f8f8f8;padding:16px;text-align:center;border-top:1px solid #eee">
    <p style="margin:0;font-size:11px;color:#bbb">إذا لم تطلب هذا الرمز، يمكنك تجاهل هذا البريد. الدعم التقني https://wa.me/963982559890</p>
  </div>
</div>
</body>
</html>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ from: FROM_EMAIL, to, subject, html })
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("[EMAIL] Resend error:", data);
      return false;
    }
    console.log("[EMAIL] Sent OTP to:", to, "id:", data.id);
    return true;
  } catch (e: any) {
    console.error("[EMAIL] Send failed:", e.message);
    return false;
  }
}

async function saveOtp(email: string, type: "verify" | "reset"): Promise<string> {
  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min
  // Invalidate old OTPs of same type
  await supabase.from("email_verifications")
    .update({ used: true })
    .eq("email", email)
    .eq("type", type)
    .eq("used", false);
  // Insert new OTP
  await supabase.from("email_verifications").insert({ email, code: otp, type, expires_at: expiresAt });
  return otp;
}

async function verifyOtp(email: string, code: string, type: "verify" | "reset"): Promise<boolean> {
  const { data } = await supabase.from("email_verifications")
    .select("id, expires_at")
    .eq("email", email)
    .eq("code", code)
    .eq("type", type)
    .eq("used", false)
    .single();
  if (!data) return false;
  if (new Date(data.expires_at) < new Date()) return false;
  await supabase.from("email_verifications").update({ used: true }).eq("id", data.id);
  return true;
}

// تحويل replay_api لمصفوفة strings دائماً
// الـ API قد يُرجع: strings | numbers | {replay: "..."} | {code: "..."} | objects أخرى
function normalizeReplayApi(raw: any): string[] {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  const result: string[] = [];
  for (const x of arr) {
    if (x === null || x === undefined) continue;
    if (typeof x === "string" && x.trim()) { result.push(x.trim()); continue; }
    if (typeof x === "number") { result.push(String(x)); continue; }
    if (typeof x === "object") {
      // استخراج القيمة من أي مفتاح شائع
      const val = x.replay ?? x.code ?? x.value ?? x.key ?? x.data ?? x.result ?? null;
      if (val !== null && val !== undefined) {
        result.push(String(val));
      } else {
        // آخر حل: JSON stringify لكن نتجنب {} الفارغة
        const str = JSON.stringify(x);
        if (str !== "{}" && str !== "[]") result.push(str);
      }
      continue;
    }
    result.push(String(x));
  }
  return result;
}

async function providerGet(base_url: string, api_token: string, path: string): Promise<any> {
  const url = `${base_url}${path}`;
  console.log("[PROVIDER] GET:", url);
  const res = await fetch(url, {
    headers: { "api-token": api_token, "Accept": "application/json" }
  });
  const text = await res.text();
  console.log("[PROVIDER] Response:", res.status, text.substring(0, 300));
  try { return JSON.parse(text); } catch { return { error: text }; }
}

/**
 * يرسل طلب POST لإنشاء طلب عند المزود
 * POST /newOrder/{productId}/params?qty=1&playerId=xxx&order_uuid=xxx
 */
function normalizeProviderOrderMethod(value?: string | null): "GET" | "POST" {
  const normalized = String(value || "POST").trim().toUpperCase();
  return normalized === "GET" ? "GET" : "POST";
}

function extractProviderErrorText(payload: any): string {
  if (!payload) return "";
  if (typeof payload === "string") return payload;
  if (typeof payload === "object") {
    const candidates = [payload.message, payload.error, payload.error_message, payload.detail, payload.description, payload.response, payload.body];
    for (const candidate of candidates) {
      if (typeof candidate === "string" && candidate.trim()) return candidate;
    }
    try { return JSON.stringify(payload); } catch { return ""; }
  }
  return String(payload);
}

// [BUG FIX] المزوّد قد يغيّر صيغة رسالة "الطريقة غير مدعومة" — نتعرّف الآن أيضاً على HTTP 405
// مباشرة وعلى عبارات "method not allowed"/"method_not_allowed"
function isUnsupportedMethodError(payload: any, httpStatus?: number): boolean {
  if (httpStatus === 405) return true;
  const text = extractProviderErrorText(payload).toLowerCase();
  return text.includes("method is not supported") ||
    text.includes("method not allowed") ||
    text.includes("method_not_allowed") ||
    (text.includes("supported methods") && (text.includes("get") || text.includes("head") || text.includes("post")));
}

async function getProviderOrderMethod(providerId: number): Promise<"GET" | "POST"> {
  try {
    const { data, error } = await supabase.from("providers").select("order_method").eq("id", providerId).maybeSingle();
    if (!error && data?.order_method) return normalizeProviderOrderMethod(data.order_method);
  } catch {}
  return "POST";
}

async function persistProviderOrderMethod(providerId: number, orderMethod: "GET" | "POST") {
  try {
    await supabase.from("providers").update({ order_method: orderMethod }).eq("id", providerId);
    invalidateProviderCache(providerId);
  } catch (e: any) {
    console.warn(`[PROVIDER] فشل حفظ order_method للمزود #${providerId}:`, e.message);
  }
}

function buildMegaApiOrderFields(product: any, extraData: any): Record<string, string> {
  const result: Record<string, string> = {};
  let fieldDefs: any[] = [];
  try {
    const parsed = typeof product?.custom_fields === "string" ? JSON.parse(product.custom_fields) : product?.custom_fields;
    fieldDefs = Array.isArray(parsed) ? parsed : [];
  } catch { fieldDefs = []; }
  const sentValues: Array<{ label: string; value: string }> = [
    ...(Array.isArray(extraData?.defaultFields) ? extraData.defaultFields : []),
    ...(Array.isArray(extraData?.customFields) ? extraData.customFields : []),
  ];
  fieldDefs.forEach((def: any, idx: number) => {
    const key = def?.providerFieldKey || def?.key || def?.id || `param${idx + 1}`;
    let value = "";
    if (idx === 0) value = String(extraData?.playerId || "").trim();
    if (!value) {
      const match = sentValues.find(f => f.label === def.label) || sentValues[idx];
      value = (match?.value || "").toString().trim();
    }
    if (value) result[key] = value;
  });
  return result;
}

async function megaApiCreateOrder(
  base_url: string, api_token: string, productId: string, qty: number,
  orderFields: Record<string, string>, orderUuid: string
): Promise<any> {
  const params: Record<string, string> = { qty: String(qty), uuid: orderUuid, ...orderFields };
  const qs = new URLSearchParams(params).toString();
  const url = `${base_url}/requestorder/${productId}/params?${qs}`;
  console.log("[MEGAAPI] Order URL:", url.replace(api_token, "***"));
  const res = await fetch(url, { headers: { "apiToken": api_token, "Accept": "application/json" } });
  const text = await res.text();
  console.log("[MEGAAPI] Order response:", res.status, text.substring(0, 500));
  try { return { httpStatus: res.status, ...JSON.parse(text) }; } catch { return { httpStatus: res.status, error: true, message: text }; }
}

async function megaApiGet(base_url: string, api_token: string, path: string): Promise<any> {
  const url = `${base_url}${path}`;
  const res = await fetch(url, { headers: { "apiToken": api_token, "Accept": "application/json" } });
  const text = await res.text();
  try { return { httpStatus: res.status, ...JSON.parse(text) }; } catch { return { httpStatus: res.status, error: true, message: text }; }
}

async function megaApiCheckOrder(base_url: string, api_token: string, orderIdOrNumberOrUuid: string): Promise<any> {
  const res = await megaApiGet(base_url, api_token, `/order/${encodeURIComponent(orderIdOrNumberOrUuid)}`);
  const order = res?.data?.order;
  if (!order) return { status: res?.error ? "ERROR" : "OK", data: [] };
  return { status: "OK", data: [{ order_id: order.order_number, status: order.status, replay_api: [], price: order.price, created_at: order.created_at }] };
}

async function megaApiCheckOrderByUuid(base_url: string, api_token: string, uuid: string): Promise<any> {
  const res = await megaApiGet(base_url, api_token, `/checkordersbyuuid?uuids=${encodeURIComponent(uuid)}`);
  const order = res?.data?.orders?.[0];
  if (!order) return { status: res?.error ? "ERROR" : "OK", data: [] };
  return {
    status: "OK",
    data: [{
      order_id: order.order_number,
      status: order.status,
      replay_api: Array.isArray(order.codes) ? order.codes : [],
      notes: Array.isArray(order.notes) ? order.notes : [],
      price: order.amount,
      created_at: order.created_at,
    }]
  };
}

async function providerCreateOrder(
  base_url: string,
  api_token: string,
  productId: string,
  qty: number,
  playerId: string,
  orderUuid: string,
  extraParams?: Record<string, string>,
  preferredMethod: "GET" | "POST" = "POST",
  providerId?: number
): Promise<any> {
  const methods: Array<"GET" | "POST"> = [preferredMethod, preferredMethod === "GET" ? "POST" : "GET"];
  let lastPayload: any = null;

  for (let index = 0; index < methods.length; index++) {
    const method = methods[index];
    const params: Record<string, string> = {
      qty: String(qty),
      order_uuid: orderUuid,
    };
    if (playerId && playerId.trim() !== "") {
      params.playerId = playerId.trim();
    }
    // [MULTI-FIELD PROVIDER PARAMS] بعض منتجات المزوّد تتطلب حقولاً إضافية غير playerId
    // (مثال: بريد إلكتروني + كلمة سر). حسب توثيق Ahminix: "Any extra custom params are
    // accepted and stored" — لذا نُرسل كل حقل إضافي كـ query param باسمه الخاص، مع تفادي
    // الكتابة فوق qty/order_uuid/playerId المحجوزة أعلاه.
    if (extraParams) {
      for (const [key, value] of Object.entries(extraParams)) {
        if (!key || key === "qty" || key === "order_uuid" || key === "playerId") continue;
        if (value !== undefined && value !== null && String(value).trim() !== "") {
          params[key] = String(value).trim();
        }
      }
    }
    const qs = new URLSearchParams(params).toString();
    const url = `${base_url}/newOrder/${productId}/params?${qs}`;
    console.log(`[PROVIDER] ${method} order URL:`, url.replace(api_token, "***"));
    const res = await fetch(url, {
      method,
      headers: {
        "api-token": api_token,
        "Accept": "application/json",
        "Content-Type": "application/json"
      }
    });
    const text = await res.text();
    console.log(`[PROVIDER] Order response (${method}):`, res.status, text.substring(0, 500));
    let parsed: any;
    try { parsed = JSON.parse(text); } catch { parsed = { error: text }; }
    lastPayload = parsed;

    const unsupported = isUnsupportedMethodError(parsed, res.status);
    if (unsupported && index === 0) {
      console.warn(`[PROVIDER] ${method} غير مدعوم لهذا المزود، محاولة ${methods[1]}...`);
      continue;
    }

    if (providerId && index === 1 && method !== preferredMethod && !unsupported) {
      await persistProviderOrderMethod(providerId, method);
    }
    return parsed;
  }

  return lastPayload;
}

/**
 * يتحقق من حالة طلب عند مزود معين
 */
async function providerCheckOrder(base_url: string, api_token: string, orderId: string, isUuid = false): Promise<any> {
  const param = isUuid
    ? `orders=["${orderId}"]&uuid=1`
    : `orders=[${orderId}]`;
  return providerGet(base_url, api_token, `/check?${param}`);
}

/**
 * [MULTI-FIELD PROVIDER PARAMS]
 * يبني كائن الحقول الإضافية التي تُرسَل للمزوّد عند إنشاء الطلب (غير playerId)، اعتماداً على
 * حقول custom_fields المُخزَّنة على المنتج (المزامَنة من ap.params عند الجلب من المزوّد،
 * أو المُضافة يدوياً) وقيمها التي أدخلها العميل عبر extraData.defaultFields / extraData.customFields.
 * المطابقة تتم بالترتيب (index) بين حقول المنتج المخزّنة وحقول extraData المُرسَلة من CheckoutPage،
 * لأن كلاهما يُبنى من نفس مصفوفة custom_fields بنفس الترتيب.
 */
function buildProviderExtraParams(product: any, extraData: any): Record<string, string> {
  const result: Record<string, string> = {};
  if (!product?.custom_fields) return result;
  let fieldDefs: any[] = [];
  try {
    const parsed = typeof product.custom_fields === "string" ? JSON.parse(product.custom_fields) : product.custom_fields;
    fieldDefs = Array.isArray(parsed) ? parsed : [];
  } catch { return result; }
  if (fieldDefs.length === 0) return result;

  // كل قيم الحقول المُرسَلة من العميل (افتراضية + مخصصة) بنفس ترتيب custom_fields
  const sentValues: Array<{ label: string; value: string }> = [
    ...(Array.isArray(extraData?.defaultFields) ? extraData.defaultFields : []),
    ...(Array.isArray(extraData?.customFields) ? extraData.customFields : []),
  ];

  fieldDefs.forEach((def: any, idx: number) => {
    const key = def?.key || def?.id || `param${idx + 1}`;
    // أول حقل افتراضي يُستخدم كـ playerId أصلاً في مسار آخر — لا نُعيد إرساله هنا لتفادي التكرار
    if (idx === 0 && def?.isDefault) return;
    const match = sentValues.find(f => f.label === def.label) || sentValues[idx];
    const value = (match?.value || "").toString().trim();
    if (value) result[key] = value;
  });
  return result;
}

/**
 * يُحوّل حالة Ahminix الخام إلى حالة داخلية
 * API قد يُرجع: "accept"/"completed" → completed | "reject"/"rejected"/"cancelled" → cancelled | غير ذلك → processing
 */
/**
 * normalizeOrderStatus — تطبيع حالة الطلب بصرامة
 * أي حالة غامضة أو غير صريحة = processing (لا نحكم بالرفض إلا بتأكيد مزدوج)
 */
function normalizeOrderStatus(apiStatus: string): "completed" | "cancelled" | "processing" {
  const s = (apiStatus || "").toLowerCase().trim();
  if (!s) return "processing";

  const acceptedKeywords = ["accept","accepted","completed","done","success","approved","finish","finished","delivered"];
  const rejectedKeywords = ["reject","rejected","cancel","cancelled","failed","error","denied","declined","refused"];

  // قبول: أي كلمة من القائمة كافية
  if (acceptedKeywords.some(k => s.includes(k))) return "completed";

  // رفض: يجب أن تكون واضحة وصريحة
  if (rejectedKeywords.some(k => s.includes(k))) return "cancelled";

  // أي حالة غير معروفة = قيد المعالجة (لا نحكم بالرفض)
  return "processing";
}

/** للتوافق مع الاستدعاءات القديمة */
const mapAhminixStatus = normalizeOrderStatus;

/**
 * حساب مدة الاستجابة بالثانية: من وقت إنشاء الطلب (قيد المراجعة/المعالجة)
 * إلى لحظة تحوله إلى "مقبول" أو "مكتمل".
 */
function calcResponseTimeSeconds(createdAt: string | null | undefined): number | null {
  if (!createdAt) return null;
  const start = new Date(createdAt).getTime();
  if (Number.isNaN(start)) return null;
  const seconds = Math.round((Date.now() - start) / 1000);
  return seconds >= 0 ? seconds : null;
}

/** الحالات التي تُعتبر "استجابة نهائية" لقياس مدة الاستجابة */
const RESPONSE_TIME_FINAL_STATUSES = new Set(["completed", "accepted"]);

/**
 * هل الحالة الخام نهائية (مكتملة أو مرفوضة بتأكيد)؟
 */
function isAhminixFinalStatus(apiStatus: string): boolean {
  const status = normalizeOrderStatus(apiStatus);
  return status === "completed" || status === "cancelled";
}

/**
 * getFinalOrderStatus — يحاول 3 مرات قبل الحكم بالرفض
 * إذا كانت النتيجة "cancelled" يتحقق مرة إضافية قبل اعتمادها
 */
async function getFinalOrderStatus(
  checkFn: () => Promise<any>,
  maxAttempts = 3,
  delayMs = 2000
): Promise<{ status: "completed" | "cancelled" | "processing"; raw: string; data: any }> {
  let lastRaw = "";
  let lastData: any = null;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await checkFn();
      const ext = res?.data?.[0];
      if (!ext) {
        if (i < maxAttempts - 1) { await new Promise(r => setTimeout(r, delayMs)); continue; }
        return { status: "processing", raw: "", data: null };
      }
      lastRaw = ext.status || "";
      lastData = ext;
      const normalized = normalizeOrderStatus(lastRaw);

      // قبول → نخرج فوراً
      if (normalized === "completed") return { status: "completed", raw: lastRaw, data: ext };

      // قيد المعالجة → نحاول مرة أخرى
      if (normalized === "processing") {
        if (i < maxAttempts - 1) { await new Promise(r => setTimeout(r, delayMs)); continue; }
        return { status: "processing", raw: lastRaw, data: ext };
      }

      // مرفوض → لا نؤكد إلا في المحاولة الأخيرة
      if (normalized === "cancelled") {
        if (i < maxAttempts - 1) { await new Promise(r => setTimeout(r, delayMs)); continue; }
        return { status: "cancelled", raw: lastRaw, data: ext };
      }
    } catch {
      if (i < maxAttempts - 1) { await new Promise(r => setTimeout(r, delayMs)); continue; }
    }
  }
  return { status: "processing", raw: lastRaw, data: lastData };
}

/**
 * يجلب كل المنتجات من مزود خارجي عبر /client/api/products
 * ملاحظة: نقطة الاتصال هذه تُعيد الشكل { status: "OK", data: [...] } وليس مصفوفة مباشرة،
 * لذا يجب استخراج data.data أولاً؛ ندعم أيضاً مصفوفة مباشرة أو { products: [...] } لتوافق أوسع.
 */
// ============================================================
// خريطة منع الطلبات المكررة: key = "userId-productId-qty-playerId"
// نحتفظ بالطلب لمدة 10 ثوانٍ لرفض أي طلب مطابق في تلك المدة
// ============================================================
const recentOrdersMap = new Map<string, number>();
function isDuplicateOrder(userId: string, productId: string, qty: number, playerId: string): boolean {
  const key = `${userId}-${productId}-${qty}-${playerId}`;
  const last = recentOrdersMap.get(key);
  const now = Date.now();
  if (last && now - last < 10_000) return true; // مكرر خلال 10 ثوانٍ
  recentOrdersMap.set(key, now);
  // تنظيف المدخلات القديمة تلقائياً
  if (recentOrdersMap.size > 500) {
    for (const [k, t] of recentOrdersMap.entries()) {
      if (now - t > 10_000) recentOrdersMap.delete(k);
    }
  }
  return false;
}

/**
 * يتحقق من حالة الحظر المؤقت للمستخدم ويرفع الحظر تلقائياً إذا انتهت المدة
 * يُرجع true إذا كان المستخدم محظوراً الآن
 */
async function checkAndClearBan(user: any): Promise<{ banned: boolean; message?: string }> {
  if (!user.is_banned && !user.blocked_until) return { banned: false };
  const now = new Date();
  if (user.blocked_until) {
    const until = new Date(user.blocked_until);
    if (until <= now) {
      // الحظر انتهى — نرفعه تلقائياً
      await supabase.from("users").update({ is_banned: false, blocked_until: null }).eq("id", user.id);
      return { banned: false };
    }
    const remaining = Math.ceil((until.getTime() - now.getTime()) / 60000);
    return { banned: true, message: `تم إيقاف حسابك مؤقتاً. المتبقي: ${remaining} دقيقة.` };
  }
  if (user.is_banned) {
    return { banned: true, message: "تم إيقاف حسابك. تواصل مع الدعم." };
  }
  return { banned: false };
}

// [FIX] يربط middleware المصادقة بفحص الحظر على مستوى الحساب (user_id) — يعمل مع كل توكن/جهاز
setBanLookup(async (userId: string) => {
  const { data: u } = await supabase
    .from("users")
    .select("id, is_banned, blocked_until")
    .eq("id", userId)
    .single();
  if (!u) return { banned: false };
  return checkAndClearBan(u);
});

// [SECURITY FIX] يربط middleware المصادقة بفحص token_version — يُبطل فوراً كل التوكنات
// الصادرة قبل آخر تغيير لكلمة المرور أو ضغطة "إنهاء كل الجلسات". القسم 3.2 من تقرير الفحص الأمني.
setUserTokenVersionLookup(async (userId: string) => {
  const { data: u } = await supabase
    .from("users")
    .select("token_version")
    .eq("id", userId)
    .single();
  return u?.token_version ?? 0;
});

// [FIX] جدولة رفع الحظر المؤقت تلقائياً (startBanExpirySweep) أُزيلت من هذا المشروع — كانت
// نسخة مكررة حرفياً من saraqib-admin تعمل بشكل مستقل كل دقيقة بلا أي قفل تزامن، فتُحمّل القاعدة
// مرتين لنفس الغرض. هذا المشروع (المتجر) لا يعرض أصلاً أي قائمة "محظور" تحتاج دقة فورية —
// الحظر يُفحص ويُرفع تلقائياً عند انتهاء مدته في كل طلب فعلي عبر checkAndClearBan أعلاه (نفس
// الحماية الأمنية الفعلية، بلا أي تغيير). الجدولة الدورية بقيت فقط في saraqib-admin لأن غرضها
// الوحيد — المذكور بتعليقها الأصلي — هو إبقاء قائمة المستخدمين بلوحة التحكم دقيقة فوراً.

/**
 * يجلب رصيد ومعلومات حساب مزود معين
 */
async function providerGetProfile(base_url: string, api_token: string): Promise<any> {
  return providerGet(base_url, api_token, "/profile");
}

async function startServer() {
  // [NEW] صمام الأمان (Graceful Fallback) — تُثبَّت أولاً وقبل أي شيء آخر، حتى
  // تُمسَك أي أخطاء تحدث أثناء الإقلاع نفسه أيضاً، ولا يتوقف المتجر عن العمل
  // بسبب استثناء غير متوقع أو Promise مرفوض في أي مكان بالكود.
  installGlobalCrashGuards();

  const app = express();

  // حد حجم الطلب لمنع هجمات الذاكرة
  app.use(express.json({ limit: "2mb" }));
  app.use(express.urlencoded({ extended: true, limit: "2mb" }));

   const PORT = Number(process.env.PORT) || 3101;

  // [NEW] helmet — طبقة headers أمنية إضافية من المكتبة الرسمية
  app.use(helmet({
    contentSecurityPolicy: false, // نستخدم CSP المخصص في masterSecurityMiddleware
    crossOriginEmbedderPolicy: false, // قد يكسر بعض الموارد الخارجية
  }));

  // [NEW] hpp — يمنع HTTP Parameter Pollution (مثل ?id=1&id=2 لتجاوز الـ validation)
  app.use(hpp());

  // ═══ masterSecurityMiddleware — 14 طبقة حماية دفعة واحدة ═══
  app.use(masterSecurityMiddleware);
  // Rate limiting عام إضافي
  app.use(generalLimiter);

  app.use((req, res, next) => {
    if (req.url.startsWith("/api")) {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    }
    next();
  });

  // =================== API ROUTES ===================

  // [NEW] تسجيل النشاط والجلسات — تُستخدم عبر نقاط الدخول المهمة (تسجيل دخول، تغيير بيانات، طلبات...)
  // تتجاهل الأخطاء بصمت إن كانت الجداول غير موجودة بعد في قاعدة البيانات، دون التأثير على الاستجابة الرئيسية.

  const parseDeviceFromUA = (ua: string): string => {
    if (!ua) return "جهاز غير معروف";
    if (/android/i.test(ua)) return "هاتف Android";
    if (/iphone|ipad|ipod/i.test(ua)) return "جهاز iOS";
    if (/windows/i.test(ua)) return "كمبيوتر Windows";
    if (/macintosh|mac os/i.test(ua)) return "كمبيوتر Mac";
    if (/linux/i.test(ua)) return "كمبيوتر Linux";
    return "متصفح ويب";
  };

  // [NEW] تحويل IP إلى موقع جغرافي (مدينة، بلد) — نفس الطريقة التي كانت تُستخدم سابقاً
  const geoLocationCache = new Map<string, { value: string | null; ts: number }>();
  const resolveIpLocation = async (ip: string): Promise<string | null> => {
    if (!ip) return null;
    if (
      ip === "::1" || ip === "127.0.0.1" ||
      ip.startsWith("192.168.") || ip.startsWith("10.") ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(ip)
    ) {
      return null; // IP محلي/خاص — لا يمكن تحديد موقعه
    }
    const cached = geoLocationCache.get(ip);
    if (cached && Date.now() - cached.ts < 24 * 60 * 60 * 1000) return cached.value;
    // [NEW] صمام الأمان: لو تعطلت خدمة geo-IP الخارجية (بطء، انقطاع، تجاوز حصة
    // مجانية) نُرجع null بهدوء بدل تعطيل تسجيل النشاط/الجلسة كلها بسبب ميزة
    // ثانوية (عرض المدينة فقط) — لا علاقة لها بإتمام عمليات البيع أو الدفع.
    const value = await safeExternalCall("geo-ip-lookup", async () => {
      const resp = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`);
      if (!resp.ok) throw new Error("geoip request failed");
      const data: any = await resp.json();
      return data && data.success !== false && data.city
        ? `${data.city}, ${data.country || ""}`.trim().replace(/,\s*$/, "")
        : null;
    }, null);
    geoLocationCache.set(ip, { value, ts: Date.now() });
    return value;
  };

  const logActivity = async (
    userId: number | string,
    type: string,
    description: string,
    req: any,
    extra?: { is_unusual?: boolean }
  ) => {
    try {
      const ip = getClientIp(req) || null;
      const location = ip ? await resolveIpLocation(ip) : null;
      await supabase.from("activity_logs").insert({
        user_id: userId,
        type,
        description,
        ip,
        device: parseDeviceFromUA(String(req.headers?.["user-agent"] || "")),
        location,
        is_unusual: !!extra?.is_unusual,
      });
    } catch {
      // الجدول قد لا يكون موجوداً بعد — لا نكسر تدفق الطلب الأساسي
    }
  };

  const upsertSession = async (userId: number | string, req: any) => {
    try {
      const ip = getClientIp(req) || "";
      const device = parseDeviceFromUA(String(req.headers?.["user-agent"] || ""));
      const location = ip ? await resolveIpLocation(ip) : null;
      const { data: existing } = await supabase
        .from("user_sessions")
        .select("id")
        .eq("user_id", userId)
        .eq("device", device)
        .eq("ip", ip)
        .maybeSingle();
      if (existing) {
        await supabase.from("user_sessions").update({ last_active: new Date().toISOString(), location }).eq("id", existing.id);
      } else {
        await supabase.from("user_sessions").insert({ user_id: userId, device, ip, location, last_active: new Date().toISOString() });
      }
    } catch {
      // الجدول قد لا يكون موجوداً بعد
    }
  };

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
  });

  // ═══ تحليلات ذاتية + تتبّع أخطاء العميل (بدون أي خدمة خارجية) ═══
  const extractOptionalUserId = (req: any): string | null => {
    try {
      const auth = req.headers.authorization || "";
      const token = auth.startsWith("Bearer ") ? auth.slice(7) : (req.headers["x-user-token"] as string || "");
      if (!token) return null;
      const payload = verifyUserToken(token);
      return payload ? String(payload.sub) : null;
    } catch { return null; }
  };

  app.post("/api/analytics/track", async (req, res) => {
    try {
      const { event_type, path, session_id, device_type, referrer } = req.body || {};
      if (!event_type || typeof event_type !== "string" || event_type.length > 60) return res.status(204).end();
      await supabase.from("analytics_events").insert({
        event_type: event_type.slice(0, 60),
        path: typeof path === "string" ? path.slice(0, 200) : null,
        app: "user",
        user_id: extractOptionalUserId(req),
        session_id: typeof session_id === "string" ? session_id.slice(0, 80) : null,
        device_type: typeof device_type === "string" ? device_type.slice(0, 20) : null,
        referrer: typeof referrer === "string" ? referrer.slice(0, 200) : null,
      });
      res.status(204).end();
    } catch { res.status(204).end(); }
  });

  app.post("/api/analytics/error", async (req, res) => {
    try {
      const { message, stack, url } = req.body || {};
      if (!message || typeof message !== "string") return res.status(204).end();
      await supabase.from("client_error_logs").insert({
        app: "user",
        message: message.slice(0, 500),
        stack: typeof stack === "string" ? stack.slice(0, 3000) : null,
        url: typeof url === "string" ? url.slice(0, 300) : null,
        user_id: extractOptionalUserId(req),
        user_agent: String(req.headers?.["user-agent"] || "").slice(0, 300),
      });
      res.status(204).end();
    } catch { res.status(204).end(); }
  });

  // ═══ وضع الصيانة — يحجب كل الـ API عن غير الـ IP المسموح به (باستثناء الأدمن) ═══
  const getMaintenanceSettings = async () => {
    const { data } = await supabase.from("settings").select("key,value").in("key", ["maintenance_mode", "maintenance_allowed_ip"]);
    const enabled = (data?.find((s: any) => s.key === "maintenance_mode")?.value || "") === "true";
    const allowedIp = (data?.find((s: any) => s.key === "maintenance_allowed_ip")?.value || "").trim();
    return { enabled, allowedIp };
  };

  app.get("/api/maintenance-status", async (req, res) => {
    try {
      const { enabled, allowedIp } = await getMaintenanceSettings();
      const ip = getClientIp(req);
      const allowed = !enabled || (!!allowedIp && ip === allowedIp);
      res.json({ enabled, allowed, ip });
    } catch (e: any) {
      res.json({ enabled: false, allowed: true, ip: "" });
    }
  });

  // يُتيح لـ apiTokenAuth (في security.ts) إعادة استخدام نفس منطق وضع الصيانة
  setMaintenanceCheck(getMaintenanceSettings);

  // ═══ Client API — بحث/تحديث توكنات الوصول الخارجي ═══
  setApiTokenLookup(async (token: string): Promise<ApiTokenRecord | null> => {
    const { data, error } = await supabase.from("api_tokens").select("*").eq("token", token).maybeSingle();
    if (error || !data) return null;
    return {
      id: data.id,
      user_id: data.user_id,
      enabled: !!data.enabled,
      allowed_ips: Array.isArray(data.allowed_ips) ? data.allowed_ips : [],
      scope: data.scope === "all" ? "all" : "selected",
      can_order: data.can_order !== false,
      revoked_at: data.revoked_at || null,
    };
  });

  setApiTokenTouch((tokenId: number | string) => {
    supabase.from("api_tokens").update({ last_used_at: new Date().toISOString() }).eq("id", tokenId)
      .then(() => {}, () => {});
  });

  // isProductAllowedForToken — true إذا scope='all'، أو المنتج ضمن api_token_products،
  // أو تصنيف/تصنيف فرعي/تصنيف فرعي-فرعي للمنتج ضمن api_token_categories لهذا التوكن
  const isProductAllowedForToken = async (tokenId: number | string, productId: number | string): Promise<boolean> => {
    const { data: tokenRow } = await supabase.from("api_tokens").select("scope").eq("id", tokenId).maybeSingle();
    if (tokenRow?.scope === "all") return true;

    const { data: directMatch } = await supabase
      .from("api_token_products").select("id").eq("token_id", tokenId).eq("product_id", productId).maybeSingle();
    if (directMatch) return true;

    const { data: product } = await supabase
      .from("products").select("subcategory_id, sub_sub_category_id, subcategories(category_id)").eq("id", productId).maybeSingle();
    if (!product) return false;

    const categoryChecks: { category_type: string; category_id: any }[] = [];
    if (product.sub_sub_category_id) categoryChecks.push({ category_type: "sub_sub_category", category_id: product.sub_sub_category_id });
    if (product.subcategory_id) categoryChecks.push({ category_type: "subcategory", category_id: product.subcategory_id });
    const parentCategoryId = (product as any)?.subcategories?.category_id;
    if (parentCategoryId) categoryChecks.push({ category_type: "category", category_id: parentCategoryId });

    for (const check of categoryChecks) {
      const { data: catMatch } = await supabase
        .from("api_token_categories").select("id")
        .eq("token_id", tokenId).eq("category_type", check.category_type).eq("category_id", check.category_id)
        .maybeSingle();
      if (catMatch) return true;
    }
    return false;
  };

  // [PERF] يحمّل صلاحيات التوكن مرة واحدة ثم يفحص كل منتج في الذاكرة (بدل عدة استعلامات لكل منتج —
  // كان ذلك يُبطئ قائمة المنتجات جداً وقد ينهار مع آلاف المنتجات).
  const getTokenAllowanceChecker = async (tokenId: number | string): Promise<(p: any) => boolean> => {
    const { data: tokenRow } = await supabase.from("api_tokens").select("scope").eq("id", tokenId).maybeSingle();
    if (tokenRow?.scope === "all") return () => true;
    const prodRows = await fetchAllRowsPaged((f, t) => supabase.from("api_token_products").select("product_id").eq("token_id", tokenId).order("id").range(f, t));
    const catRows = await fetchAllRowsPaged((f, t) => supabase.from("api_token_categories").select("category_type, category_id").eq("token_id", tokenId).order("id").range(f, t));
    const prods = new Set(prodRows.map((r: any) => String(r.product_id)));
    const cats = new Set(catRows.map((r: any) => `${r.category_type}:${r.category_id}`));
    return (p: any) =>
      prods.has(String(p.id)) ||
      (!!p.sub_sub_category_id && cats.has(`sub_sub_category:${p.sub_sub_category_id}`)) ||
      (!!p.subcategory_id && cats.has(`subcategory:${p.subcategory_id}`)) ||
      (!!p?.subcategories?.category_id && cats.has(`category:${p.subcategories.category_id}`));
  };

  // ═══ إعدادات الـ API العامة (Public API Settings) ═══
  // كل الإعدادات تُخزَّن في جدول settings العام (key/value) بنفس نمط باقي الإعدادات في المشروع
  const PUBLIC_API_SETTINGS_KEYS = [
    "public_api_discount_percent",
    "public_api_rate_limit_max",
    "public_api_rate_limit_window_sec",
    "public_api_webhook_url",
    "public_api_default_scope",
  ];

  let publicApiSettingsCache: { data: Record<string, string>; ts: number } = { data: {}, ts: 0 };
  const getPublicApiSettings = async (): Promise<Record<string, string>> => {
    if (Date.now() - publicApiSettingsCache.ts < 15000 && publicApiSettingsCache.ts > 0) return publicApiSettingsCache.data;
    const { data } = await supabase.from("settings").select("key,value").in("key", PUBLIC_API_SETTINGS_KEYS);
    const map: Record<string, string> = {};
    (data || []).forEach((r: any) => { map[r.key] = r.value; });
    publicApiSettingsCache = { data: map, ts: Date.now() };
    return map;
  };
  const invalidatePublicApiSettingsCache = () => { publicApiSettingsCache = { data: {}, ts: 0 }; };

  const getPublicApiDiscountPercent = async (): Promise<number> => {
    const s = await getPublicApiSettings();
    const v = parseFloat(s.public_api_discount_percent || "0");
    return Number.isFinite(v) && v > 0 && v < 100 ? v : 0;
  };

  // [PHASE-2] خصم الـ API لكل منتج: نسبة التوكن المخصصة (custom_discount_percent) إن وُجدت تُطبَّق على كل
  // المنتجات (مع حماية التكلفة)، وإلا تُطبَّق قواعد api_global — القاعدة الأدق فقط.
  const getApiDiscountResolver = async (tokenId: number | string | null | undefined): Promise<(product: any) => number> => {
    let custom: number | null = null;
    if (tokenId != null) {
      try {
        const { data: tokenRow, error } = await supabase
          .from("api_tokens").select("custom_discount_percent").eq("id", tokenId).maybeSingle();
        if (!error && tokenRow && tokenRow.custom_discount_percent !== null && tokenRow.custom_discount_percent !== undefined) {
          const c = Number(tokenRow.custom_discount_percent);
          if (Number.isFinite(c) && c >= 0 && c < 100) custom = c;
        }
      } catch { /* العمود قد لا يكون موجوداً بعد */ }
    }
    if (custom !== null) {
      const flat = custom;
      return (product: any) => {
        const cap = maxDiscountPercentForCost(product);
        return cap !== null && flat > cap ? cap : flat;
      };
    }
    const rules = await loadDiscountRules(supabase, "api_global", null);
    return (product: any) => resolveDiscountPercent(rules, product).percent;
  };
  const getApiDiscountPercentForProduct = async (tokenId: number | string | null | undefined, product: any): Promise<number> =>
    (await getApiDiscountResolver(tokenId))(product);

  // ── Rate Limiting قابل للتعديل من لوحة التحكم لكل توكن API ──
  const clientApiRateStore = new Map<string, { count: number; resetAt: number }>();
  const dynamicClientApiLimiter = async (req: any, res: any, next: any) => {
    try {
      const s = await getPublicApiSettings();
      const max = Math.max(1, parseInt(s.public_api_rate_limit_max || "120") || 120);
      const windowMs = Math.max(1000, (parseInt(s.public_api_rate_limit_window_sec || "60") || 60) * 1000);
      const key = `apitoken:${req.apiTokenId ?? getClientIp(req)}`;
      const now = Date.now();
      const entry = clientApiRateStore.get(key);
      if (!entry || entry.resetAt < now) { clientApiRateStore.set(key, { count: 1, resetAt: now + windowMs }); return next(); }
      entry.count++;
      if (entry.count > max) {
        res.setHeader("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
        return res.status(429).json({ code: 429, message: `طلبات كثيرة. انتظر ${Math.ceil((entry.resetAt - now) / 1000)} ثانية.` });
      }
      next();
    } catch { next(); }
  };

  // ── سجل النشاط: يُسجَّل كل طلب Client API ناجح أو مرفوض ──
  const apiActivityLogger = (req: any, res: any, next: any) => {
    res.on("finish", () => {
      supabase.from("api_activity_logs").insert({
        token_id: req.apiTokenId || null,
        user_id: req.apiUserId || null,
        method: req.method,
        path: req.originalUrl || req.path,
        status_code: res.statusCode,
        ip_address: getClientIp(req),
      }).then(() => {}, () => {});
    });
    next();
  };

  // ── Webhook: إشعار خارجي عند تغيّر حالة طلب مُنشأ عبر الـ API الخارجي ──
  const triggerOrderWebhook = async (orderId: number | string, status: string) => {
    try {
      const s = await getPublicApiSettings();
      const url = (s.public_api_webhook_url || "").trim();
      if (!url) return;
      const payload = { event: "order.status_changed", order_id: orderId, status, timestamp: new Date().toISOString() };
      let statusCode = 0, success = false, errMsg: string | null = null;
      try {
        const resp: any = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: (AbortSignal as any).timeout ? (AbortSignal as any).timeout(8000) : undefined,
        });
        statusCode = resp.status;
        success = resp.ok;
      } catch (e: any) {
        errMsg = e?.message || "فشل الاتصال بالـ Webhook";
      }
      await supabase.from("api_webhook_logs").insert({
        url, event: payload.event, payload: JSON.stringify(payload), status_code: statusCode, success, error: errMsg,
      });
    } catch { /* لا نمنع تدفق الطلب بسبب فشل الـ webhook */ }
  };

  app.use(async (req, res, next) => {
    try {
      if (!req.path.startsWith("/api")) return next();
      const exempt = req.path === "/api/health" || req.path === "/api/settings" || req.path === "/api/maintenance-status";
      if (exempt) return next();
      const { enabled, allowedIp } = await getMaintenanceSettings();
      if (!enabled) return next();
      const ip = getClientIp(req);
      if (allowedIp && ip === allowedIp) return next();
      return res.status(503).json({ error: "الموقع في وضع الصيانة حالياً، يرجى المحاولة لاحقاً.", maintenance: true });
    } catch (e) {
      return next(); // فشل التحقق لا يجب أن يعطل الموقع بالكامل
    }
  });

  app.get("/api/settings", async (req, res) => {
    try {
      const { data, error } = await supabase.from("settings").select("*");
      if (error) throw error;
      res.json(Array.isArray(data) ? data : []);
    } catch (e: any) {
      safeError(res, e, "فشل تحميل إعدادات المتجر");
    }
  });

  // =================== [AGENTS] نظام الوكلاء ===================
  const agentCore = createAgentCore(supabase);

  // إعدادات عامة لإظهار/إخفاء عناصر الوكلاء في الواجهة (حقل كود الوكيل، القائمة الجانبية)
  app.get("/api/agents/config", async (_req, res) => {
    try {
      const st = await agentCore.getAgentSettings();
      let hasDirectory = false;
      if (st.directoryEnabled) {
        const { count } = await supabase.from("agents_directory").select("id", { count: "exact", head: true }).eq("is_active", true);
        hasDirectory = (count || 0) > 0;
      }
      res.json({ enabled: st.enabled, mode: st.mode, directoryEnabled: st.directoryEnabled && hasDirectory, percent: st.percent });
    } catch (e: any) { safeError(res, e, "فشل تحميل إعدادات الوكلاء"); }
  });

  // صفحة "وكلائنا" (عامة)
  app.get("/api/agents/directory", async (_req, res) => {
    try {
      const st = await agentCore.getAgentSettings();
      if (!st.directoryEnabled) return res.json([]);
      const { data, error } = await supabase.from("agents_directory")
        .select("id, name, image_url, website_url, phone, location, description, sort_order")
        .eq("is_active", true).order("sort_order", { ascending: true }).order("id", { ascending: true });
      if (error) throw error;
      res.json(data || []);
    } catch (e: any) { safeError(res, e, "فشل تحميل قائمة الوكلاء"); }
  });

  // حساب الوكيل: الكود والرابط والعملاء (رقم الحساب، الاسم، الإيميل، إجمالي الشحن، الرصيد الحالي)
  app.get("/api/agent/me", authenticate, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const st = await agentCore.getAgentSettings();
      const { data: me } = await supabase.from("users").select("id, agent_enabled, is_banned, agent_commission_percent").eq("id", userId).maybeSingle();
      if (!me) return res.status(404).json({ error: "المستخدم غير موجود" });
      if (!agentCore.isAgentWith(st, me)) return res.json({ system_enabled: st.enabled, is_agent: false });
      const code = await agentCore.ensureAgentCode(userId);
      const info = await agentCore.getAgentClients(userId);
      res.json({ system_enabled: true, is_agent: true, code, percent: agentCore.effectivePercent(st, me), ...info });
    } catch (e: any) { safeError(res, e, "فشل تحميل حساب الوكيل"); }
  });

  // =================== RANKS (نظام الرتب) ===================
  const RANK_PUBLIC_COLS = "id, name, image_url, color, required_amount, has_discount, discount_percent, description, benefits, is_active, sort_order";

  app.get("/api/ranks", async (_req, res) => {
    try {
      const { data, error } = await supabase.from("ranks").select(RANK_PUBLIC_COLS).eq("is_active", true).order("sort_order", { ascending: true });
      if (error) throw error;
      res.json(Array.isArray(data) ? data : []);
    } catch (e: any) {
      safeError(res, e, "فشل تحميل الرتب");
    }
  });

  // [PHASE-2] عرض نسبة الخصم الفعلية لكل منتج للمستخدم الحالي (للعرض فقط — الخصم الحقيقي يُحسب دائماً
  // من السيرفر عند الشراء). نفس منطق createOrderCore: الأعلى بين VIP والرتبة ومدى الحياة والمؤقت،
  // ولا يشمل خصم "المنتج الواحد" كي لا يُستهلك بمجرد العرض.
  app.post("/api/discount/quote", authenticate, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const ids = (Array.isArray(req.body?.productIds) ? req.body.productIds : [])
        .map((x: any) => Number(x)).filter((n: number) => Number.isInteger(n) && n > 0).slice(0, 300);
      if (ids.length === 0) return res.json({});
      const { data: user } = await supabase.from("users").select("id, is_vip, rank_id").eq("id", userId).maybeSingle();
      if (!user) return res.json({});
      const { data: stats } = await supabase.from("user_stats").select("*").eq("user_id", userId).maybeSingle();
      const { data: products } = await supabase.from("products")
        .select("id, price, price_per_unit, store_type, default_profit, subcategory_id, sub_sub_category_id, category_id, subcategories(category_id)").in("id", ids);
      const vipRules = user.is_vip ? await loadDiscountRules(supabase, "vip", null) : [];
      let rankRules: any[] = [];
      if (user.rank_id != null) {
        const { data: rk } = await supabase.from("ranks").select("has_discount, is_active").eq("id", user.rank_id).maybeSingle();
        if (rk && rk.is_active && rk.has_discount) rankRules = await loadDiscountRules(supabase, "rank", user.rank_id);
      }
      const out: Record<string, number> = {};
      for (const p of (products || [])) {
        let pct = Math.max(
          user.is_vip ? resolveDiscountPercent(vipRules, p).percent : 0,
          resolveDiscountPercent(rankRules, p).percent
        );
        if (stats) {
          if (stats.lifetime_discount > 0) pct = Math.max(pct, Number(stats.lifetime_discount));
          if (stats.discount_expires_at && new Date(stats.discount_expires_at) > new Date()) pct = Math.max(pct, Number(stats.active_discount) || 0);
        }
        out[String(p.id)] = +pct.toFixed(3);
      }
      res.json(out);
    } catch (e: any) {
      safeError(res, e, "فشل جلب نسب الخصم");
    }
  });

  // [PHASE-3] بوابة توثيق الهوية لطرق الدفع التي تتطلبها (التحقق من السيرفر دائماً — لا يعتمد على الواجهة).
  async function identityGate(userId: any, paymentMethodId: any): Promise<string | null> {
    try {
      const { data: m, error: mErr } = await supabase.from("payment_methods").select("requires_identity").eq("id", paymentMethodId).maybeSingle();
      if (mErr) return "تعذر التحقق من متطلبات طريقة الدفع، حاول مجدداً.";
      if (!m || !m.requires_identity) return null;
      const { data: u } = await supabase.from("users").select("identity_verified").eq("id", userId).maybeSingle();
      return u?.identity_verified ? null : "هذه الطريقة تتطلب توثيق الهوية. وثّق هويتك من صفحة حسابي أولاً.";
    } catch { return "تعذر التحقق من حالة توثيق الهوية، حاول مجدداً."; }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // [PHASE-3] توثيق الهوية — صور الهوية تُحفظ في مخزن خاص (identity-docs) ولا يصل إليها إلا الأدمن عبر السيرفر
  // ═══════════════════════════════════════════════════════════════════════════
  const IDENTITY_BUCKET = "identity-docs";
  const IDENTITY_MAX_BYTES = 6 * 1024 * 1024;

  async function getIdentitySettings(): Promise<{ enabled: boolean; description: string }> {
    const { data } = await supabase.from("settings").select("key,value").in("key", ["identity_verification_enabled", "identity_verification_description"]);
    const m: Record<string, string> = {};
    (data || []).forEach((r: any) => { m[r.key] = r.value; });
    return { enabled: m.identity_verification_enabled === "true", description: m.identity_verification_description || "" };
  }

  // فحص "الأرقام السحرية" للصورة الفعلية بدل الاعتماد على ترويسة المتصفح
  function sniffImage(buf: Buffer): { mime: string; ext: string } | null {
    if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: "image/jpeg", ext: "jpg" };
    if (buf.length > 12 && buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { mime: "image/png", ext: "png" };
    if (buf.length > 12 && buf.slice(0, 4).toString("ascii") === "RIFF" && buf.slice(8, 12).toString("ascii") === "WEBP") return { mime: "image/webp", ext: "webp" };
    return null;
  }

  app.get("/api/identity/status", authenticate, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const cfg = await getIdentitySettings();
      const { data: u } = await supabase.from("users").select("identity_verified").eq("id", userId).maybeSingle();
      const { data: last } = await supabase.from("identity_verifications")
        .select("status, reject_reason, created_at, reviewed_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle();
      const verified = !!u?.identity_verified;
      res.json({
        enabled: cfg.enabled, description: cfg.description, verified,
        status: verified ? "approved" : (last?.status || "none"),
        reject_reason: !verified && last?.status === "rejected" ? (last.reject_reason || "") : "",
        submitted_at: last?.created_at || null,
      });
    } catch (e: any) { safeError(res, e, "فشل تحميل حالة التوثيق"); }
  });

  // رفع صورة واحدة (أمامية/خلفية) كبايتات خام — تُخزَّن في المخزن الخاص ويُرجع مفتاحها فقط
  app.post("/api/identity/upload/:side", authenticate, uploadLimiter,
    express.raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: IDENTITY_MAX_BYTES }),
    async (req, res) => {
      try {
        const userId = String((req as any).userId);
        const side = req.params.side;
        if (side !== "front" && side !== "back") return res.status(400).json({ error: "جهة الصورة غير صحيحة" });
        const cfg = await getIdentitySettings();
        if (!cfg.enabled) return res.status(403).json({ error: "توثيق الهوية غير متاح حالياً" });
        const buf: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
        if (buf.length === 0) return res.status(400).json({ error: "لم يتم إرسال صورة" });
        if (buf.length > IDENTITY_MAX_BYTES) return res.status(413).json({ error: "حجم الصورة كبير (الحد 6MB)" });
        const kind = sniffImage(buf);
        if (!kind) return res.status(400).json({ error: "صيغة الصورة غير مدعومة (JPG أو PNG أو WEBP)" });
        const key = `${userId}/${crypto.randomUUID()}-${side}.${kind.ext}`;
        const { error } = await supabase.storage.from(IDENTITY_BUCKET).upload(key, buf, { contentType: kind.mime, upsert: false });
        if (error) throw error;
        res.json({ key });
      } catch (e: any) { safeError(res, e, "فشل رفع الصورة"); }
    });

  app.post("/api/identity/submit", authenticate, uploadLimiter, async (req, res) => {
    try {
      const userId = String((req as any).userId);
      const { frontKey, backKey } = req.body || {};
      const cfg = await getIdentitySettings();
      if (!cfg.enabled) return res.status(403).json({ error: "توثيق الهوية غير متاح حالياً" });
      const okKey = (k: any, side: string) => typeof k === "string" && k.length < 200 && new RegExp(`^${userId}/[0-9a-f-]{36}-${side}\\.(jpg|png|webp)$`).test(k);
      if (!okKey(frontKey, "front") || !okKey(backKey, "back")) return res.status(400).json({ error: "يجب رفع صورة الهوية الأمامية والخلفية" });

      const { data: u } = await supabase.from("users").select("identity_verified").eq("id", userId).maybeSingle();
      if (u?.identity_verified) return res.status(400).json({ error: "حسابك موثّق بالفعل" });
      const { data: pending } = await supabase.from("identity_verifications").select("id").eq("user_id", userId).eq("status", "pending").maybeSingle();
      if (pending) return res.status(409).json({ error: "لديك طلب توثيق قيد المراجعة بالفعل" });

      const { error } = await supabase.from("identity_verifications").insert({ user_id: userId, status: "pending", front_path: frontKey, back_path: backKey });
      if (error) {
        if ((error as any).code === "23505") return res.status(409).json({ error: "لديك طلب توثيق قيد المراجعة بالفعل" });
        throw error;
      }
      res.json({ success: true, status: "pending" });
    } catch (e: any) { safeError(res, e, "فشل إرسال طلب التوثيق"); }
  });

  app.get("/api/ranks/me", authenticate, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const [{ data: ranks, error: rErr }, { data: userRow }, { data: stats }] = await Promise.all([
        supabase.from("ranks").select(RANK_PUBLIC_COLS).eq("is_active", true).order("sort_order", { ascending: true }),
        supabase.from("users").select("id, rank_id, manual_rank_id").eq("id", userId).single(),
        supabase.from("user_stats").select("total_recharge_sum").eq("user_id", userId).maybeSingle(),
      ]);
      if (rErr) throw rErr;
      const list = Array.isArray(ranks) ? ranks : [];
      const total = parseFloat(String(stats?.total_recharge_sum ?? 0)) || 0;
      let current = list.find((r: any) => String(r.id) === String(userRow?.rank_id)) || null;
      if (!current) {
        // لم تُحسب الرتبة بعد (مستخدم قديم) — نحسبها فوراً في قاعدة البيانات
        const { data: recalced } = await supabase.rpc("recalc_user_rank", { p_user_id: userId });
        current = list.find((r: any) => String(r.id) === String(recalced)) || list[0] || null;
      }
      const currentOrder = current ? Number(current.sort_order) : -1;
      const next = list.find((r: any) => Number(r.sort_order) > currentOrder && parseFloat(String(r.required_amount)) > total) || null;
      const base = current ? parseFloat(String(current.required_amount)) || 0 : 0;
      const target = next ? parseFloat(String(next.required_amount)) || 0 : base;
      const progress = next && target > base ? Math.min(100, Math.max(0, ((total - base) / (target - base)) * 100)) : 100;
      res.json({
        ranks: list,
        current,
        next,
        total_recharge_sum: total,
        remaining: next ? Math.max(0, target - total) : 0,
        progress_percent: Math.round(progress),
        is_manual: !!userRow?.manual_rank_id && String(userRow.manual_rank_id) === String(current?.id),
      });
    } catch (e: any) {
      safeError(res, e, "فشل تحميل رتبتك");
    }
  });

  // GET /api/search?q=... — بحث شامل بالمتجر (منتجات + أقسام بكل مستوياتها)، كان مفقوداً كلياً
  app.get("/api/search", async (req, res) => {
    try {
      const qRaw = String(req.query.q || "").trim();
      if (!qRaw || qRaw.length < 2) return res.json({ products: [], categories: [], subcategories: [], subSubCategories: [] });
      const q = qRaw.slice(0, 80).replace(/[%_]/g, ""); // منع رموز LIKE الخاصة من التأثير على النمط

      const [productsRes, categoriesRes, subcategoriesRes, subSubCategoriesRes] = await Promise.all([
        supabase.from("products").select("id, name, image_url, price, store_type, min_quantity, available")
          .eq("available", true).ilike("name", `%${q}%`).limit(20), // [FIX] جدول products لا يملك عمود active — الصحيح available
        supabase.from("categories").select("id, name, image_url").eq("active", true).ilike("name", `%${q}%`).limit(5),
        supabase.from("subcategories").select("id, name, image_url, category_id").eq("active", true).ilike("name", `%${q}%`).limit(5),
        supabase.from("sub_sub_categories").select("id, name, image_url, subcategory_id").eq("active", true).ilike("name", `%${q}%`).limit(5),
      ]);

      for (const [label, r] of [["products", productsRes], ["categories", categoriesRes], ["subcategories", subcategoriesRes], ["subSubCategories", subSubCategoriesRes]] as const) {
        if (r.error) console.error(`[SEARCH] فشل استعلام ${label}:`, r.error);
      }
      res.json({
        products: productsRes.data || [],
        categories: categoriesRes.data || [],
        subcategories: subcategoriesRes.data || [],
        subSubCategories: subSubCategoriesRes.data || [],
      });
    } catch (e: any) {
      safeError(res, e, "فشل البحث");
    }
  });

  app.get("/api/categories", async (req, res) => {
    try {
      const { admin } = req.query as any;
      let query = supabase.from("categories").select("*").order("order_index");
      if (!admin) query = query.eq("active", true);
      const { data, error } = await query;
      if (error) throw error;
      res.json(Array.isArray(data) ? data : []);
    } catch (e: any) {
      safeError(res, e, "فشل تحميل قائمة التصنيفات");
    }
  });

  app.get("/api/categories/:id/subcategories", async (req, res) => {
    try {
      const { admin } = req.query as any;
      let query = supabase.from("subcategories").select("*").eq("category_id", req.params.id).order("order_index");
      if (!admin) query = query.eq("active", true);
      const { data, error } = await query;
      if (error) throw error;
      res.json(Array.isArray(data) ? data : []);
    } catch (e: any) {
      safeError(res, e, "فشل تحميل التصنيفات الفرعية لهذا التصنيف");
    }
  });

  app.get("/api/subcategories", async (req, res) => {
    try {
      const { admin } = req.query as any;
      let query = supabase.from("subcategories").select("*").order("order_index");
      if (!admin) query = query.eq("active", true);
      const { data, error } = await query;
      if (error) throw error;
      res.json(Array.isArray(data) ? data : []);
    } catch (e: any) {
      safeError(res, e, "فشل تحميل قائمة التصنيفات الفرعية");
    }
  });

  app.get("/api/subcategories/:id/products", async (req, res) => {
    try {
      await syncInventoryProductsAvailability({ subcategory_id: req.params.id });
      // [FIX] الترتيب كان غائباً تماماً (بدون .order) فيرجع Postgres الصفوف بترتيب
      // فيزيائي غير مضمون يتغير بعد أي UPDATE (توفر/سعر عبر المزامنة التلقائية)،
      // فيظهر الترتيب صحيحاً أحياناً ويختلط تلقائياً لاحقاً ويُخرج المنتج الذي نفذ
      // من مكانه. الحل: ترتيب صريح وثابت دائماً بـ order_index ثم id كفاصل تعادل.
      // [FIX-PAGINATION] راجع fetchAllRowsPaged — بدونه، قسم فرعي بأكثر من 1000 منتج
      // (حالة متاجر كبيرة فعلياً) يفقد كل منتج بعد الصف الألف بصمت أمام العميل.
      let data: any[];
      try {
        data = await fetchAllRowsPaged((from, to) =>
          supabase.from("products").select("*").eq("subcategory_id", req.params.id)
            .order("order_index", { ascending: true }).order("id", { ascending: true }).range(from, to)
        );
      } catch (error: any) {
        if (error?.code !== "42703") throw error;
        data = await fetchAllRowsPaged((from, to) =>
          supabase.from("products").select("*").eq("subcategory_id", req.params.id)
            .order("id", { ascending: true }).range(from, to)
        );
      }
      res.json(Array.isArray(data) ? data : []);
    } catch (e: any) {
      safeError(res, e, "فشل تحميل منتجات هذا التصنيف الفرعي");
    }
  });

  // منتجات مرتبطة مباشرة بقسم رئيسي (بدون قسم فرعي) — نفس نظام الترتيب والأعمدة
  app.get("/api/categories/:id/products", async (req, res) => {
    try {
      // [FIX-PAGINATION] راجع fetchAllRowsPaged — قسم رئيسي بأكثر من 1000 منتج مرتبط
      // به مباشرة كان يفقد كل منتج بعد الصف الألف بصمت أمام العميل.
      let data: any[];
      try {
        data = await fetchAllRowsPaged((from, to) =>
          supabase.from("products").select("*").eq("category_id", req.params.id)
            .order("order_index", { ascending: true }).order("id", { ascending: true }).range(from, to)
        );
      } catch (error: any) {
        if (error?.code !== "42703") throw error;
        data = await fetchAllRowsPaged((from, to) =>
          supabase.from("products").select("*").eq("category_id", req.params.id)
            .order("id", { ascending: true }).range(from, to)
        );
      }
      res.json(Array.isArray(data) ? data : []);
    } catch (e: any) {
      safeError(res, e, "فشل تحميل منتجات هذا القسم الرئيسي");
    }
  });

  // All products for admin (with optional subId filter)
  app.get("/api/products", async (req, res) => {
    try {
      const { subId, all } = req.query as any;
      await syncInventoryProductsAvailability(subId ? { subcategory_id: subId } : {});
      // [FIX] إضافة order_index كترتيب أساسي قبل id كي يلتزم بالترتيب الذي يضبطه الأدمن
      // [FIX-PAGINATION] راجع fetchAllRowsPaged — بلا هذا الجلب المُصفّح، أي فلتر يرجع
      // أكثر من 1000 منتج كان يفقد الباقي بصمت (حدّ PostgREST الافتراضي).
      const buildBase = () => {
        let q = supabase.from("products").select("*, subcategories(name, categories(name))");
        if (subId) q = q.eq("subcategory_id", subId);
        else if (!all) q = q.eq("available", true);
        return q;
      };
      let data: any[];
      try {
        data = await fetchAllRowsPaged((from, to) =>
          buildBase().order("order_index", { ascending: true }).order("id", { ascending: false }).range(from, to)
        );
      } catch (error: any) {
        if (error?.code !== "42703") throw error;
        data = await fetchAllRowsPaged((from, to) => buildBase().order("id", { ascending: false }).range(from, to));
      }
      const list = Array.isArray(data) ? data : [];
      // دفاع إضافي: حتى لو استخدم أي مكوّن آخر في الواجهة `name_verification_enabled` من هذه
      // القائمة مباشرة (بدل الفحص الحي عبر /api/name-verification/status)، نُطابقه هنا أيضاً
      // مع حالة تفعيل/تعطيل المزوّد من لوحة التحكم فور تحميل القائمة.
      const disabledProviders = await getDisabledNameVerificationProviders();
      if (disabledProviders.size > 0) {
        for (const p of list) {
          if (p?.name_verification_enabled) {
            const provider = nvProviderForGame(p.name_verification_game);
            if (provider && disabledProviders.has(provider)) {
              p.name_verification_enabled = false;
            }
          }
        }
      }
      res.json(list);
    } catch (e: any) {
      safeError(res, e, "فشل تحميل قائمة المنتجات");
    }
  });

  // ===== أكثر المنتجات شراءً — تُقرأ مباشرة من عرض مادي (mv_top_purchased_products) =====
  // العرض المادي يُحسب بالكامل داخل قاعدة البيانات (SQL) بشروط صارمة:
  // طلبات مكتملة فقط + عدد طلبات فريدة (لا كميات) + منتج متاح وله سعر حقيقي > 0 + طلبان مكتملان على الأقل
  // ويُحدَّث تلقائياً كل 10 دقائق عبر pg_cron (refresh_leaderboard_views)
  app.get("/api/most-purchased", authenticate, async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("mv_top_purchased_products")
        .select("product_id, name, price, price_per_unit, image_url, store_type, available, purchase_count")
        .order("purchase_count", { ascending: false })
        .limit(9);

      if (error) throw error;

      const result = (data || []).map((row: any) => ({
        id: row.product_id,
        name: row.name,
        price: row.price,
        price_per_unit: row.price_per_unit,
        image_url: row.image_url,
        store_type: row.store_type,
        available: row.available,
        purchase_count: row.purchase_count,
      }));

      res.json(result);
    } catch (e: any) {
      safeError(res, e, "فشل تحميل قائمة الأكثر مبيعاً");
    }
  });


  // ════════════════════════════════════════════════════════════════
  // نظام "التحقق من اسم اللاعب" (Name Verification) — قابل للتوسع لعدة ألعاب
  // ════════════════════════════════════════════════════════════════

  const NAME_VERIFICATION_GAMES: Record<string, { label: string; regions: { value: string; label: string }[]; settingsKey: string }> = {
    freefire: {
      label: "فري فاير (Free Fire)",
      settingsKey: "name_verification_freefire_key_enc",
      regions: [
        { value: "BD", label: "بنغلاديش (BD)" },
        { value: "IND", label: "الهند (IND)" },
        { value: "SG", label: "سنغافورة (SG)" },
        { value: "ME", label: "الشرق الأوسط (ME)" },
      ],
    },
    ...Object.fromEntries(
      Object.keys(VOLSEVER_GAME_MAP).map((slug) => [
        slug,
        { label: VOLSEVER_GAME_MAP[slug].label, settingsKey: "name_verification_volsever_key_enc", regions: [] as { value: string; label: string }[] },
      ])
    ),
  };

  /**
   * يُترجم أي خطأ فعلي يصل من مزوّد التحقق الخارجي (غالباً إنجليزي/تقني/غير واضح) إلى رسالة
   * عربية واضحة يفهمها المستخدم العادي، مع الإبقاء على السبب التقني الأصلي بسجل الخادم فقط
   * (console.error) للمساعدة على التشخيص دون كشفه للمستخدم.
   */
  function translateProviderError(rawMessage: string | null | undefined, httpStatus: number): string {
    const raw = String(rawMessage || "").toLowerCase();
    if (raw.includes("not found") || raw.includes("invalid uid") || raw.includes("no account") || raw.includes("does not exist") || raw.includes("player not found")) {
      return "لم يتم العثور على حساب بهذا المعرّف (UID). يرجى التأكد من صحة المعرّف والمنطقة والمحاولة مرة أخرى.";
    }
    if (raw.includes("rate limit") || raw.includes("too many") || httpStatus === 429) {
      return "عدد كبير من محاولات التحقق خلال وقت قصير. يرجى الانتظار قليلاً ثم إعادة المحاولة.";
    }
    if (raw.includes("unauthorized") || raw.includes("invalid key") || raw.includes("invalid api") || httpStatus === 401 || httpStatus === 403) {
      return "تعذر إتمام التحقق حالياً بسبب مشكلة في إعدادات الخدمة. تم إبلاغ الإدارة، يرجى المحاولة لاحقاً.";
    }
    if (raw.includes("timeout") || raw.includes("timed out")) {
      return "استغرقت عملية التحقق وقتاً أطول من المتوقع. يرجى المحاولة مرة أخرى.";
    }
    if (httpStatus >= 500) {
      return "خدمة التحقق من الاسم غير متاحة مؤقتاً. يرجى المحاولة بعد قليل.";
    }
    // أي رسالة أخرى غير مصنَّفة: لا نعرضها كما وصلت (قد تكون إنجليزية أو تقنية)، بل رسالة عامة واضحة
    return "لم يتم العثور على الحساب. يرجى التحقق من صحة المعرّف (UID) والمنطقة والمحاولة مرة أخرى.";
  }

  // [SECURITY FIX] القسم 5.2 من تقرير الفحص الأمني (CWE-319): تحويل الاتصال إلى HTTPS
  // بدل HTTP الصريح، لمنع إرسال مفتاح الـ API ونتائج الاستعلام بنص صريح قابل للاعتراض.
  async function verifyFreeFireName(uid: string, region: string, apiKey: string) {
    const url = `https://siambhau69.eu.cc/freefireinfo/bhau?uid=${encodeURIComponent(uid)}&region=${encodeURIComponent(region)}&key=${encodeURIComponent(apiKey)}`;
    let resp: Response;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      resp = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
    } catch (networkErr) {
      console.error("[NameVerification] freefire network error:", networkErr);
      throw Object.assign(new Error("تعذر الاتصال بخدمة التحقق. يرجى التأكد من اتصالك بالإنترنت والمحاولة لاحقاً."), { httpStatus: 502 });
    }
    const raw = await resp.text().catch(() => "");
    let data: any = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
    if (!resp.ok || !data || data.error || data["خطأ"]) {
      const rawMsg = data?.error || data?.["خطأ"] || `HTTP ${resp.status}`;
      console.error("[NameVerification] freefire provider error:", rawMsg, "| uid:", uid, "| region:", region);
      throw Object.assign(new Error(translateProviderError(String(rawMsg), resp.status)), { httpStatus: 400 });
    }
    const basic = data.basicInfo || {};
    const clan = data.clanBasicInfo || {};
    if (!basic.accountId && !basic.nickname) {
      console.error("[NameVerification] freefire empty response for uid:", uid, "| region:", region);
      throw Object.assign(new Error("لم يتم العثور على حساب بهذا المعرّف (UID) في هذه المنطقة. يرجى التأكد من صحة المعرّف والمنطقة."), { httpStatus: 400 });
    }
    return {
      accountId: basic.accountId ?? null,
      nickname: basic.nickname ?? null,
      region: basic.region ?? region,
      level: basic.level ?? null,
      clanName: clan.clanName ?? null,
      raw: data,
    };
  }

  // ═══ خرائط صور عناصر Free Fire (مستودع ItemID) — تُحمّل مرة واحدة في الذاكرة ═══
  // يطابق منطق موقع ItemID الأصلي بالضبط: أولاً يبحث عن أيقونة العنصر ضمن قائمة
  // صور مستودع ff-resources على GitHub (تغطية أوسع بكثير)، وإن لم توجد يستخدم
  // خريطة cdn.json كبديل. لا يوجد أي رابط وهمي أو مصدر خارجي غير موثوق.
  let ffItemImages: Record<string, { image: string | null; source: string | null; name?: string | null; type?: string | null }> = {};
  try {
    const dataPath = path.join(__dirname, "server-data", "item-images.json");
    if (fs.existsSync(dataPath)) ffItemImages = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  } catch (e) {
    console.error("تعذر تحميل بيانات عناصر Free Fire (ItemID):", e);
  }

  function resolveFFItem(id: number | string) {
    const key = String(id);
    const entry = ffItemImages[key];
    if (!entry || !entry.image) return { id: key, image: null, source: "none", name: entry?.name || null, type: entry?.type || null };
    return { id: key, image: entry.image, source: entry.source || "itemid", name: entry.name || null, type: entry.type || null };
  }

  app.post("/api/name-verification/item-images", authenticate, async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "قائمة المعرفات مطلوبة" });
      const uniqueIds = Array.from(new Set(ids.filter((v: any) => v !== null && v !== undefined))).slice(0, 40);
      const result: Record<string, any> = {};
      for (const id of uniqueIds) result[String(id)] = resolveFFItem(id as any);
      res.json({ success: true, data: result });
    } catch (e: any) {
      safeError(res, e, "فشل جلب صور العناصر");
    }
  });

  // مفاتيح إعدادات التفعيل/التعطيل والسعر لكل مزوّد (تُخزَّن في جدول settings كباقي الإعدادات)
  const NV_PROVIDER_ENABLED_SETTINGS_KEY: Record<string, string> = {
    freefire: "name_verification_freefire_provider_enabled",
    volsever: "name_verification_volsever_provider_enabled",
  };
  const NV_PROVIDER_PRICE_SETTINGS_KEY: Record<string, string> = {
    freefire: "name_verification_freefire_price_per_check",
    volsever: "name_verification_volsever_price_per_check",
  };

  // يُستخدم داخلياً لمعرفة أي مزوّدين معطَّلين حالياً، لإخفاء زر التحقق عن المنتجات المرتبطة بهما في الواجهة العامة
  async function getDisabledNameVerificationProviders(): Promise<Set<string>> {
    const settingKeys = Object.values(NV_PROVIDER_ENABLED_SETTINGS_KEY);
    const { data } = await supabase.from("settings").select("key,value").in("key", settingKeys);
    const byKey = new Map((data || []).map(r => [r.key, r.value]));
    const disabled = new Set<string>();
    for (const [game, key] of Object.entries(NV_PROVIDER_ENABLED_SETTINGS_KEY)) {
      if (byKey.get(key) === "false") disabled.add(game);
    }
    return disabled;
  }

  // يُعيد اسم "مزوّد" التحقق (freefire أو volsever) المرتبط بلعبة منتج معيّن
  function nvProviderForGame(game: string | null | undefined): string | null {
    if (!game) return null;
    const conf = NAME_VERIFICATION_GAMES[game];
    if (!conf) return null;
    if (conf.settingsKey === "name_verification_freefire_key_enc") return "freefire";
    if (conf.settingsKey === "name_verification_volsever_key_enc") return "volsever";
    return null;
  }

  // فحص حالة مزوّد تحقق الاسم لمنتج معيّن مباشرةً من الخادم (وليس من نسخة مخزَّنة على جهاز المستخدم)
  // يضمن اختفاء/ظهور زر التحقق في صفحة تأكيد الطلب فوراً بمجرد تعطيل/تفعيل المزوّد من لوحة التحكم،
  // حتى لو كانت بيانات المنتج المعروضة في الواجهة (prod) قديمة أو محفوظة مسبقاً بذاكرة الجهاز.
  // يُعيد أيضاً سعر عملية التحقق الحالي (price_per_check) ليُعرض تحت زر التحقق في صفحة تأكيد الطلب.
  app.get("/api/name-verification/status/:productId", async (req, res) => {
    try {
      const productId = req.params.productId;
      const { data: product, error } = await supabase
        .from("products").select("id,name_verification_enabled,name_verification_game,name_verification_region")
        .eq("id", productId).maybeSingle();
      if (error) throw error;
      if (!product || !product.name_verification_enabled) {
        return res.json({ enabled: false });
      }
      const provider = nvProviderForGame(product.name_verification_game);
      let pricePerCheck = 0;
      if (provider) {
        const disabledProviders = await getDisabledNameVerificationProviders();
        if (disabledProviders.has(provider)) {
          return res.json({ enabled: false });
        }
        const priceKey = NV_PROVIDER_PRICE_SETTINGS_KEY[provider];
        const { data: priceRow } = await supabase.from("settings").select("value").eq("key", priceKey).maybeSingle();
        const n = priceRow?.value !== undefined && priceRow?.value !== null ? parseFloat(String(priceRow.value)) : 0;
        pricePerCheck = Number.isFinite(n) && n > 0 ? n : 0;
      }
      res.json({ enabled: true, game: product.name_verification_game, region: product.name_verification_region, price_per_check: pricePerCheck });
    } catch (e: any) { safeError(res, e); }
  });

  app.post("/api/name-verification/verify", authenticate, async (req, res) => {
    try {
      const { product_id, uid } = req.body;
      if (!product_id) {
        return res.status(400).json({ error: "تعذر تحديد المنتج المطلوب. يرجى إعادة تحميل الصفحة والمحاولة مرة أخرى." });
      }
      if (!uid || typeof uid !== "string" || !uid.trim()) {
        return res.status(400).json({ error: "يرجى إدخال معرّف اللاعب (UID) قبل الضغط على زر التحقق." });
      }
      const { data: product, error: prodErr } = await supabase
        .from("products").select("id,name_verification_enabled,name_verification_game,name_verification_region")
        .eq("id", product_id).maybeSingle();
      if (prodErr) throw prodErr;
      if (!product || !product.name_verification_enabled) {
        return res.status(400).json({ error: "ميزة التحقق من الاسم غير مفعّلة لهذا المنتج." });
      }
      const game = product.name_verification_game;
      const region = product.name_verification_region;
      const gameConf = NAME_VERIFICATION_GAMES[game];
      if (!gameConf) {
        return res.status(400).json({ error: "لعبة أو تطبيق هذا المنتج غير مدعوم حالياً في نظام التحقق من الاسم. يرجى التواصل مع الدعم." });
      }

      // منع الاستخدام إن كان المزوّد معطَّلاً من لوحة التحكم، حتى لو تم استدعاء المسار مباشرة
      const provider = nvProviderForGame(game);
      if (provider) {
        const disabledProviders = await getDisabledNameVerificationProviders();
        if (disabledProviders.has(provider)) {
          return res.status(400).json({ error: "ميزة التحقق من الاسم متوقفة مؤقتاً من إدارة المتجر لهذا المنتج. يرجى المحاولة لاحقاً." });
        }
      }

      const { data: settingRow } = await supabase.from("settings").select("value").eq("key", gameConf.settingsKey).maybeSingle();
      if (!settingRow?.value) {
        return res.status(400).json({ error: "لم يتم تفعيل خدمة التحقق من الاسم من إدارة المتجر بعد. يرجى المحاولة لاحقاً أو التواصل مع الدعم." });
      }
      let apiKey: string;
      try {
        apiKey = decryptProviderData(settingRow.value);
      } catch (decryptErr) {
        console.error("[NameVerification] decrypt key error:", decryptErr, "| game:", game);
        return res.status(500).json({ error: "حدث خطأ تقني في إعدادات خدمة التحقق. يرجى التواصل مع الدعم الفني." });
      }

      // سعر عملية التحقق لهذا المزوّد (0 = بدون أي خصم، ولا نُظهر أي إشارة لرصيد/خصم في هذه الحالة)
      const priceSettingKey = NV_PROVIDER_PRICE_SETTINGS_KEY[provider || ""];
      let pricePerCheck = 0;
      if (priceSettingKey) {
        const { data: priceRow } = await supabase.from("settings").select("value").eq("key", priceSettingKey).maybeSingle();
        const n = priceRow?.value !== undefined && priceRow?.value !== null ? parseFloat(String(priceRow.value)) : 0;
        pricePerCheck = Number.isFinite(n) && n > 0 ? n : 0;
      }

      // إن كان هناك سعر لهذه العملية، نتحقق مسبقاً أن رصيد المستخدم كافٍ قبل استدعاء المزوّد الخارجي،
      // تفادياً لاستهلاك حصة الـ API مجاناً لطلبات لن يُخصم لها رصيد أصلاً
      if (pricePerCheck > 0) {
        const userId = (req as any).userId;
        const { data: userRow } = await supabase.from("users").select("balance").eq("id", userId).maybeSingle();
        const currentBalance = Number(userRow?.balance ?? 0);
        if (!userRow || currentBalance < pricePerCheck) {
          return res.status(400).json({ error: `رصيدك الحالي غير كافٍ لإجراء عملية التحقق (السعر: ${pricePerCheck} $). يرجى شحن رصيدك أولاً.` });
        }
      }

      try {
        let result: any;
        if (game === "freefire") {
          if (!region) {
            return res.status(400).json({ error: "لم يتم تحديد منطقة الخادم لهذا المنتج من إدارة المتجر. يرجى التواصل مع الدعم." });
          }
          result = await verifyFreeFireName(uid.trim(), region, apiKey);
        } else {
          result = await verifyVolseverName(game, uid.trim(), region || null, apiKey);
        }

        // نجحت عملية الجلب: نخصم السعر الآن فقط (خصم ذرّي بمقارنة/تبديل لتفادي التعارض بين طلبات متزامنة).
        // لو تعذّر الخصم لأي سبب بعد نجاح الجلب، لا نمنع المستخدم من رؤية النتيجة — فقط نُسجّل الأمر
        // للمراجعة، لأن عدم القدرة على الخصم ليس خطأ من المستخدم ولا يجب حجب بياناته المُتحقق منها عنه.
        let debitedAmount = 0;
        if (pricePerCheck > 0) {
          const userId = (req as any).userId;
          for (let attempt = 0; attempt < 3; attempt++) {
            const { data: freshUser } = await supabase.from("users").select("balance").eq("id", userId).maybeSingle();
            if (!freshUser) break;
            const freshBalance = Number(freshUser.balance);
            if (freshBalance < pricePerCheck) break; // أصبح الرصيد غير كافٍ بين الفحص المسبق ولحظة الخصم — لا نخصم جزئياً
            const { data: casRows } = await supabase
              .from("users")
              .update({ balance: freshBalance - pricePerCheck })
              .eq("id", userId)
              .eq("balance", freshBalance)
              .select("id");
            if (Array.isArray(casRows) && casRows.length > 0) { debitedAmount = pricePerCheck; break; }
          }
        }

        return res.json({ success: true, data: result, charged: debitedAmount, price_per_check: pricePerCheck });
      } catch (providerErr: any) {
        // فشل الجلب من المزوّد: لا يُخصم أي رصيد إطلاقاً بما أن الخصم أصلاً لا يحدث إلا بعد النجاح أعلاه
        return res.status(providerErr.httpStatus || 400).json({ error: providerErr.message || "معرف المستخدم أو المنطقة غير صالح. يرجى التحقق والمحاولة مرة أخرى." });
      }
    } catch (e: any) {
      safeError(res, e);
    }
  });

  // ═══ المستخدم — إعدادات الـ API الخاصة به ═══
  // إن لم يكن للمستخدم توكن بعد، لا نُنشئه تلقائياً؛ يُنشئه الأدمن أو المستخدم عبر زر "تفعيل الـ API"
  app.get("/api/user/api-token", authenticate, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { data, error } = await supabase
        .from("api_tokens")
        .select("*")
        .eq("user_id", userId)
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return res.json({ exists: false });
      res.json({
        exists: true,
        id: data.id,
        name: data.name,
        token: data.token,
        enabled: !!data.enabled,
        allowed_ips: Array.isArray(data.allowed_ips) ? data.allowed_ips : [],
        scope: data.scope,
        can_order: !!data.can_order,
        created_at: data.created_at,
        last_used_at: data.last_used_at,
      });
    } catch (e: any) {
      safeError(res, e, "فشل تحميل مفتاح API الخاص بك");
    }
  });

  // إنشاء توكن ذاتي للمستخدم إن لم يكن يملك واحداً (تفعيل أول مرة)
  app.post("/api/user/api-token", authenticate, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { data: existing, error: exErr } = await supabase
        .from("api_tokens")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (exErr) throw exErr;
      if (existing) return res.status(400).json({ error: "لديك مفتاح API بالفعل" });

      const { data: userRow, error: userErr } = await supabase
        .from("users")
        .select("name")
        .eq("id", userId)
        .single();
      if (userErr) throw userErr;

      const token = crypto.randomBytes(32).toString("hex");
      const { data, error } = await supabase
        .from("api_tokens")
        .insert({
          name: `توكن ${userRow?.name || userId}`,
          user_id: userId,
          token,
          allowed_ips: [],
          can_order: true,
          scope: "all",
          enabled: true,
        })
        .select("*")
        .single();
      if (error) throw error;
      res.json({
        exists: true,
        id: data.id,
        name: data.name,
        token: data.token,
        enabled: !!data.enabled,
        allowed_ips: [],
        scope: data.scope,
        can_order: !!data.can_order,
      });
    } catch (e: any) {
      safeError(res, e, "فشل إنشاء مفتاح API");
    }
  });

  // تعطيل/تفعيل توكن المستخدم، وتحديث قائمة السماح بالـ IP
  app.patch("/api/user/api-token", authenticate, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { enabled, allowed_ips } = req.body || {};
      const patch: any = {};
      if (enabled !== undefined) patch.enabled = !!enabled;
      if (allowed_ips !== undefined) {
        if (!Array.isArray(allowed_ips)) return res.status(400).json({ error: "صيغة قائمة الـ IP غير صحيحة" });
        const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
        const cleaned = allowed_ips.map((ip: any) => String(ip).trim()).filter(Boolean);
        for (const ip of cleaned) {
          if (!ipRegex.test(ip)) return res.status(400).json({ error: `عنوان IP غير صالح: ${ip}` });
        }
        patch.allowed_ips = cleaned;
      }
      if (Object.keys(patch).length === 0) return res.status(400).json({ error: "لا يوجد ما يُحدَّث" });

      const { data, error } = await supabase
        .from("api_tokens")
        .update(patch)
        .eq("user_id", userId)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: "لا يوجد مفتاح API لحسابك" });
      res.json({
        exists: true,
        id: data.id,
        token: data.token,
        enabled: !!data.enabled,
        allowed_ips: Array.isArray(data.allowed_ips) ? data.allowed_ips : [],
      });
    } catch (e: any) {
      safeError(res, e, "فشل تحديث مفتاح API");
    }
  });

  // إعادة تعيين (توليد) مفتاح API جديد للمستخدم — يُبطل القديم فوراً
  app.post("/api/user/api-token/regenerate", authenticate, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const token = crypto.randomBytes(32).toString("hex");
      const { data, error } = await supabase
        .from("api_tokens")
        .update({ token })
        .eq("user_id", userId)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: "لا يوجد مفتاح API لحسابك" });
      res.json({ exists: true, token: data.token });
    } catch (e: any) {
      safeError(res, e, "فشل تجديد مفتاح API");
    }
  });


  app.get("/api/subcategories/:id/sub-sub-categories", async (req, res) => {
    try {
      const { admin } = req.query as any;
      let query = supabase.from("sub_sub_categories").select("*").eq("subcategory_id", req.params.id).order("order_index");
      if (!admin) query = query.eq("active", true);
      const { data, error } = await query;
      if (error) throw error;
      res.json(Array.isArray(data) ? data : []);
    } catch (e: any) {
      safeError(res, e, "فشل تحميل التصنيفات الفرعية الثانوية");
    }
  });

  app.get("/api/sub-sub-categories", async (req, res) => {
    try {
      const { admin } = req.query as any;
      let query = supabase.from("sub_sub_categories").select("*").order("order_index");
      if (!admin) query = query.eq("active", true);
      const { data, error } = await query;
      if (error) throw error;
      res.json(Array.isArray(data) ? data : []);
    } catch (e: any) {
      safeError(res, e, "فشل تحميل قائمة التصنيفات الفرعية الثانوية");
    }
  });

  app.get("/api/sub-sub-categories/:id/products", async (req, res) => {
    try {
      await syncInventoryProductsAvailability({ sub_sub_category_id: req.params.id });
      // [FIX] نفس مشكلة ترتيب المنتجات: كان بدون .order إطلاقاً، فنضيف ترتيباً
      // ثابتاً بـ order_index ثم id كي لا يتغير الترتيب أو يتحرك المنتج الذي نفذ.
      // [FIX-PAGINATION] جلب مُصفّح (حدّ 1000 صف)
      let data: any[];
      try {
        data = await fetchAllRowsPaged((f, t) => supabase.from("products").select("*").eq("sub_sub_category_id", req.params.id)
          .order("order_index", { ascending: true }).order("id", { ascending: true }).range(f, t));
      } catch (err: any) {
        if (err?.code !== "42703") throw err;
        data = await fetchAllRowsPaged((f, t) => supabase.from("products").select("*").eq("sub_sub_category_id", req.params.id).order("id", { ascending: true }).range(f, t));
      }
      res.json(Array.isArray(data) ? data : []);
    } catch (e: any) {
      safeError(res, e, "فشل تحميل منتجات هذا التصنيف الفرعي الثانوي");
    }
  });

  app.get("/api/appearance", async (req, res) => {
    try {
      const { data, error } = await supabase.from("store_appearance").select("*").eq("id", 1).single();
      if (error && (error as any).code !== "PGRST116") throw error;
      res.json(data || {});
    } catch (e: any) {
      safeError(res, e, "فشل تحميل إعدادات مظهر المتجر");
    }
  });

  app.get("/api/banners", async (req, res) => {
    try {
      const { admin } = req.query as any;
      let query = supabase.from("banners").select("*").order("order_index");
      if (!admin) query = query.eq("active", true);
      const { data, error } = await query;
      if (error) throw error;
      res.json(Array.isArray(data) ? data : []);
    } catch (e: any) {
      safeError(res, e, "فشل تحميل البانرات الإعلانية");
    }
  });

  app.get("/api/offers", async (req, res) => {
    try {
      const { admin } = req.query as any;
      let query = supabase.from("offers").select("*").order("created_at", { ascending: false });
      if (!admin) query = query.eq("active", true);
      const { data, error } = await query;
      if (error) throw error;
      res.json(Array.isArray(data) ? data : []);
    } catch (e: any) {
      safeError(res, e, "فشل تحميل العروض الحالية");
    }
  });

  app.get("/api/payment-methods", async (req, res) => {
    try {
      const { admin } = req.query as any;
      let baseQuery = supabase.from("payment_methods").select("*, currency:currencies(id,name,symbol,exchange_rate)");
      if (!admin) baseQuery = baseQuery.eq("active", true);
      let { data, error } = await baseQuery.order("order_index", { ascending: true });
      if (error) {
        // عمود order_index قد لا يكون موجوداً بعد في قاعدة البيانات؛ نعيد المحاولة بدون ترتيب لتفادي كسر الصفحة
        let fallbackQuery = supabase.from("payment_methods").select("*, currency:currencies(id,name,symbol,exchange_rate)");
        if (!admin) fallbackQuery = fallbackQuery.eq("active", true);
        const fallback = await fallbackQuery;
        data = fallback.data; error = fallback.error;
      }
      if (error) throw error;
      const methods = Array.isArray(data) ? data : [];
      // إرفاق verification_mode لكل طرق البوابات التي تدعم نظام الفواتير، حتى تعرف الواجهة أي تدفق تستخدم (جلب معاملات/فواتير)
      const usedGatewayCodes = new Set<GatewayCode>();
      for (const m of methods) {
        const gw = INVOICE_ELIGIBLE_METHOD_TYPES[(m as any).method_type];
        if (gw) usedGatewayCodes.add(gw);
      }
      if (usedGatewayCodes.size > 0) {
        const cfgByGateway = new Map<GatewayCode, GatewayConfig | null>();
        for (const gw of usedGatewayCodes) cfgByGateway.set(gw, await getGatewayConfig(gw));
        for (const m of methods) {
          const gw = INVOICE_ELIGIBLE_METHOD_TYPES[(m as any).method_type];
          if (gw) (m as any).verification_mode = cfgByGateway.get(gw)?.verification_mode || "transactions";
        }
      }
      res.json(methods);
    } catch (e: any) {
      safeError(res, e, "فشل تحميل طرق الدفع المتاحة");
    }
  });

  // GET /api/payment-gateways/accept-windows — بيانات عامة غير حساسة فقط (بدون أي مفاتيح):
  // مدة قبول العمليات لكل بوابة تلقائية، لعرض عداد تنازلي في واجهة المستخدم
  app.get("/api/payment-gateways/accept-windows", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("payment_gateways")
        .select("gateway_code, max_age_minutes")
        .eq("is_active", true);
      if (error) throw error;
      const map: Record<string, number> = {};
      (data || []).forEach((g: any) => { map[g.gateway_code] = Number(g.max_age_minutes) || 0; });
      res.json(map);
    } catch (e: any) {
      safeError(res, e, "فشل تحميل بيانات مهلة العمليات");
    }
  });

  // =================== AUTH ===================

  // STEP 1: Send OTP for email verification before creating account
  app.post("/api/auth/register", authLimiter, async (req, res) => {
    const { name, email, password, phone, referralCode, agentCode } = req.body;
    // [SEC] التحقق من CAPTCHA أولاً (مُعطّل تلقائياً حتى ضبط TURNSTILE_SECRET) — يوقف الأتمتة
    if (!(await verifyCaptcha((req.body as any)?.captchaToken, getClientIp(req)))) {
      return res.status(400).json({ error: "فشل التحقق من الكابتشا. يرجى إعادة المحاولة." });
    }
    // ── Validation صارم ──
    if (!isValidName(name))     return res.status(400).json({ error: "الاسم يجب أن يكون بين 2 و60 حرف" });
    if (!isValidEmail(email))   return res.status(400).json({ error: "البريد الإلكتروني غير صحيح" });
    if (isDisposableEmail(email)) return res.status(400).json({ error: "نطاق بريد مؤقت غير مسموح به — استخدم بريداً إلكترونياً حقيقياً." });
    if (!isValidPassword(password)) return res.status(400).json({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" });
    if (!phone || !isValidPhone(phone)) return res.status(400).json({ error: "رقم الهاتف مطلوب ويجب أن يكون صحيحاً (أرقام فقط)" });
    if (referralCode && !isValidId(referralCode)) return res.status(400).json({ error: "رمز الإحالة غير صحيح" });
    // [AGENTS] كود الوكيل (اختياري): يُقبل فقط إن كان النظام مفعّلاً والوكيل مؤهّلاً
    let agentIdForNew: number | null = null;
    if (agentCode && String(agentCode).trim()) {
      agentIdForNew = await agentCore.resolveAgentIdByCode(agentCode);
      if (!agentIdForNew) return res.status(400).json({ error: "كود الوكيل غير صحيح أو غير مفعّل" });
    }
    try {
      // Check email not already registered & verified
      const { data: existing } = await supabase.from("users").select("id, is_verified").eq("email", email).single();
      if (existing?.is_verified) return res.status(400).json({ error: "البريد الإلكتروني مستخدم مسبقاً" });

      // If unverified account exists, allow re-sending OTP
      // Save registration data temporarily (we'll create account after verification)
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Store pending user data in email_verifications as JSON in a temp field
      // Actually: create the user as unverified, send OTP
      let userId: number;
      if (existing && !existing.is_verified) {
        // Update existing unverified user
        await supabase.from("users").update({ name, password_hash: hashedPassword, phone, ...(agentIdForNew ? { agent_id: agentIdForNew } : {}) }).eq("id", existing.id);
        userId = existing.id;
      } else {
        // Create new unverified user
        let referredById: number | null = null;
        if (referralCode) {
          const { data: referrer } = await supabase.from("users").select("id").eq("id", referralCode).single();
          if (referrer) referredById = referrer.id;
        }
        const { data: newUser, error } = await supabase.from("users").insert({
          name: sanitizeText(name, 60),
          email: email.toLowerCase().trim(),
          password_hash: hashedPassword,
          phone: phone ? phone.trim() : null,
          is_verified: false,
          referred_by_id: referredById,
          agent_id: agentIdForNew
        }).select("id").single();
        if (error) throw error;
        await supabase.from("user_stats").insert({ user_id: newUser.id });
        userId = newUser.id;
      }

      const otp = await saveOtp(email, "verify");
      const sent = await sendOtpEmail(email, otp, "verify");
      // [FIX] لا نطبع قيمة OTP في الـ logs — خطر أمني
      console.log(`[REGISTER] OTP sent to ${email} | delivered=${sent}`);
      res.json({ success: true, requiresVerification: true, email });
    } catch (e: any) {
      safeError(res, e, "فشل التسجيل، يرجى المحاولة مجدداً");
    }
  });

  // STEP 2: Verify OTP and activate account
  app.post("/api/auth/verify-email", authLimiter, async (req, res) => {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: "البيانات ناقصة" });
    try {
      const valid = await verifyOtp(email, code, "verify");
      if (!valid) return res.status(400).json({ error: "الرمز غير صحيح أو منتهي الصلاحية" });

      // Activate user
      const { data: user, error } = await supabase.from("users")
        .update({ is_verified: true })
        .eq("email", email)
        .select("*")
        .single();
      if (error || !user) return res.status(400).json({ error: "المستخدم غير موجود" });

      // Handle referral on first verification
      // [FIX] تحديث referral_count في users و user_stats معاً لضمان التزامن
      if (user.referred_by_id) {
        const { data: refUser } = await supabase.from("users").select("referral_count").eq("id", user.referred_by_id).single();
        const newRefCount = (refUser?.referral_count || 0) + 1;
        await supabase.from("users").update({ referral_count: newRefCount }).eq("id", user.referred_by_id);
        await supabase.from("user_stats").update({ referral_count: newRefCount }).eq("user_id", user.referred_by_id);
      }

      logActivity(user.id, "register", "إنشاء الحساب وتفعيله عبر البريد الإلكتروني", req);
      upsertSession(user.id, req);

      // [FIX-ROOT-CAUSE] إشعار بوت الأدمن بتسجيل مستخدم جديد مفعّل عبر saraqib-store-admin — نفس
      // قالب saraqib-store-admin بالضبط (يتضمن التاريخ والهاتف إن وُجد)
      const regDateStrUser = user.created_at ? new Date(user.created_at).toLocaleString("ar-EG") : new Date().toLocaleString("ar-EG");
      notifyAdminServer(
        "new_registrations",
        `👤 مستخدم جديد (مفعّل عبر البريد)\n\nالاسم: ${user.name}\nرقم الدخول: #${user.id}\nالإيميل: ${user.email}${user.phone ? `\nالهاتف: ${user.phone}` : ""}\nالتاريخ: ${regDateStrUser}`
      ).catch(() => {});

      const { password_hash: _ph, ...userWithoutPass } = user;
      const { data: stats } = await supabase.from("user_stats").select("*").eq("user_id", user.id).single();
      const verifyToken = createUserToken(user.id, user.token_version || 0);
      res.json({ ...userWithoutPass, stats, token: verifyToken });
    } catch (e: any) {
      safeError(res, e, "فشل تأكيد البريد الإلكتروني، تحقق من الرمز وحاول مجدداً");
    }
  });

  // Resend OTP — [FIX] أُضيف otpLimiter لمنع طلب OTP بشكل متكرر
  app.post("/api/auth/resend-otp", otpLimiter, async (req, res) => {
    const { email, type } = req.body; // type: 'verify' | 'reset'
    if (!email) return res.status(400).json({ error: "البريد مطلوب" });
    try {
      // Rate limit: max 1 OTP per 60 seconds
      const { data: last } = await supabase.from("email_verifications")
        .select("created_at")
        .eq("email", email).eq("type", type || "verify").eq("used", false)
        .order("created_at", { ascending: false }).limit(1).single();
      if (last && (Date.now() - new Date(last.created_at).getTime()) < 60000) {
        return res.status(429).json({ error: "انتظر دقيقة قبل إعادة الإرسال" });
      }
      const otp = await saveOtp(email, type || "verify");
      const sent = await sendOtpEmail(email, otp, type || "verify");
      // [FIX] لا نطبع قيمة OTP في الـ logs
      console.log(`[RESEND-OTP] ${email} type=${type} sent=${sent}`);
      res.json({ success: true });
    } catch (e: any) {
      safeError(res, e, "فشل إعادة إرسال رمز التحقق (OTP)");
    }
  });

  // Forgot password - send OTP
  // [SECURITY FIX] القسم 3.3 من تقرير الفحص الأمني (CWE-203: Observable Discrepancy):
  // الاستجابة موحّدة الآن دائماً (نجاح) بغض النظر عن وجود الحساب فعلياً، بنفس نمط
  // /api/auth/login الذي يتعمد رسالة موحدة، لمنع حصاد إيميلات (Account/User Enumeration).
  app.post("/api/auth/forgot-password", forgotPassLimiter, async (req, res) => {
    const { email } = req.body;
    if (!email || !isValidEmail(email)) return res.status(400).json({ error: "البريد مطلوب" });
    try {
      const { data: user } = await supabase.from("users").select("id").eq("email", email).single();
      if (user) {
        const otp = await saveOtp(email, "reset");
        const sent = await sendOtpEmail(email, otp, "reset");
        // [FIX] لا نطبع قيمة OTP في الـ logs
        console.log(`[FORGOT-PWD] OTP sent to ${email} | delivered=${sent}`);
      }
      // رسالة موحدة دائماً — لا تكشف ما إذا كان البريد مسجلاً أم لا
      res.json({ success: true, message: "إذا كان البريد مسجلاً لدينا، سيصلك رمز التحقق خلال لحظات" });
    } catch (e: any) {
      safeError(res, e, "فشل إرسال طلب استعادة كلمة المرور");
    }
  });

  // Verify reset OTP — [FIX] أُضيف otpLimiter لمنع brute-force على OTP
  app.post("/api/auth/verify-reset-otp", otpLimiter, async (req, res) => {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: "البيانات ناقصة" });
    try {
      const valid = await verifyOtp(email, code, "reset");
      if (!valid) return res.status(400).json({ error: "الرمز غير صحيح أو منتهي الصلاحية" });
      res.json({ success: true });
    } catch (e: any) {
      safeError(res, e, "فشل التحقق من رمز استعادة كلمة المرور");
    }
  });

  // Reset password
  app.post("/api/auth/reset-password", authLimiter, async (req, res) => {
    const { email, newPassword } = req.body;
    if (!isValidEmail(email) || !newPassword) return res.status(400).json({ error: "البيانات ناقصة" });
    if (!isValidPassword(newPassword)) return res.status(400).json({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" });
    try {
      // OTP was already verified in /verify-reset-otp step
      // Check that a verified OTP exists for this email within the last 15 minutes
      const { data: otpRecord } = await supabase.from("email_verifications")
        .select("id, expires_at, used, created_at")
        .eq("email", email).eq("type", "reset")
        .eq("used", true)
        .order("created_at", { ascending: false }).limit(1).single();
      if (!otpRecord) return res.status(400).json({ error: "لم يتم التحقق من البريد، ابدأ من جديد" });
      // تأكد أن التحقق تم خلال آخر 15 دقيقة
      const verifiedAt = new Date(otpRecord.created_at).getTime();
      if (Date.now() - verifiedAt > 15 * 60 * 1000) {
        return res.status(400).json({ error: "انتهت صلاحية جلسة إعادة التعيين، ابدأ من جديد" });
      }
      const salt = await bcrypt.genSalt(12);
      const hashedPassword = await bcrypt.hash(newPassword, salt);
      // [SECURITY FIX] الحصول على token_version الحالي وزيادته لإبطال كل التوكنات الصادرة
      // سابقاً فوراً — القسم 3.2 من تقرير الفحص الأمني (إبطال فعلي لجلسات المستخدم).
      const { data: resetUser } = await supabase.from("users").select("id, token_version").eq("email", email).single();
      const newTokenVersion = (resetUser?.token_version || 0) + 1;
      await supabase.from("users").update({ password_hash: hashedPassword, token_version: newTokenVersion }).eq("email", email);
      if (resetUser) logActivity(resetUser.id, "password_change", "إعادة تعيين كلمة المرور عبر البريد الإلكتروني", req, { is_unusual: true });
      res.json({ success: true });
    } catch (e: any) {
      safeError(res, e, "فشل إعادة تعيين كلمة المرور");
    }
  });

  // =================== GOOGLE OAUTH ===================
  app.post("/api/auth/google", authLimiter, async (req, res) => {
    const { credential, accessToken, name: directName, picture: directPicture, googleTempToken, phone, countryCode, agentCode } = req.body;

    if (!GOOGLE_CLIENT_ID) {
      return res.status(503).json({ error: "تسجيل الدخول عبر Google غير مفعّل" });
    }

    // ── [PHONE-GATE] رقم الهاتف إجباري لكل دخول عبر Google (حساب جديد أو حساب
    //    مسجّل مسبقاً بدون رقم هاتف) — هذه الدالة تُنهي إنشاء/ربط الحساب وتسجيل
    //    الدخول الفعلي، وتُخزّن fullPhone فقط عندما يكون متوفراً (المرحلة الثانية).
    const finalizeGoogleAuth = async (
      googleId: string, email: string, name: string, avatarUrl: string | null,
      fullPhone: string | null
    ) => {
      let { data: existingByGoogle } = await supabase
        .from("users")
        .select("*")
        .eq("google_id", googleId)
        .single();

      if (existingByGoogle) {
        // User exists via Google - login directly
        const banCheckGoogle = await checkAndClearBan(existingByGoogle);
        if (banCheckGoogle.banned) {
          return res.status(403).json({ error: banCheckGoogle.message });
        }
        if (fullPhone && !existingByGoogle.phone) {
          await supabase.from("users").update({ phone: fullPhone }).eq("id", existingByGoogle.id);
          existingByGoogle.phone = fullPhone;
        }
        // Update last login stats
        const today = new Date().toISOString().split("T")[0];
        const { data: stats } = await supabase
          .from("user_stats")
          .select("last_login_date, login_days_count")
          .eq("user_id", existingByGoogle.id)
          .single();
        if (stats && stats.last_login_date !== today) {
          await supabase.from("user_stats")
            .update({ last_login_date: today, login_days_count: (stats.login_days_count || 0) + 1 })
            .eq("user_id", existingByGoogle.id);
        }
        const { password_hash: _ph, ...userWithoutPass } = existingByGoogle;
        let { data: fullStats } = await supabase.from("user_stats").select("*").eq("user_id", existingByGoogle.id).single();
        if (!fullStats) {
          await supabase.from("user_stats").insert({ user_id: existingByGoogle.id });
          const { data: ns } = await supabase.from("user_stats").select("*").eq("user_id", existingByGoogle.id).single();
          fullStats = ns;
        }
        const token = createUserToken(existingByGoogle.id, existingByGoogle.token_version || 0);
        logActivity(existingByGoogle.id, "google_login", "تسجيل دخول عبر حساب Google", req);
        upsertSession(existingByGoogle.id, req);
        return res.json({ ...userWithoutPass, stats: fullStats, token, isNew: false });
      }

      // Check if email already registered (without Google)
      let { data: existingByEmail } = await supabase
        .from("users")
        .select("*")
        .eq("email", email)
        .single();

      let userId: number;
      let isNew = false;

      if (existingByEmail) {
        // Link Google to existing account
        const linkUpdate: Record<string, any> = {
          google_id: googleId,
          auth_provider: "google",
          is_verified: true,
          avatar_url: existingByEmail.avatar_url || avatarUrl
        };
        if (fullPhone && !existingByEmail.phone) linkUpdate.phone = fullPhone;
        await supabase.from("users").update(linkUpdate).eq("id", existingByEmail.id);
        userId = existingByEmail.id;

        // Refresh user data
        const { data: updatedUser } = await supabase.from("users").select("*").eq("id", userId).single();
        existingByEmail = updatedUser;
      } else {
        // Create new user via Google
        const googleAgentId = agentCode ? await agentCore.resolveAgentIdByCode(agentCode) : null; // [AGENTS]
        const { data: newUser, error: createErr } = await supabase.from("users").insert({
          name: sanitizeText(name, 60),
          email,
          google_id: googleId,
          auth_provider: "google",
          is_verified: true,
          avatar_url: avatarUrl,
          phone: fullPhone || null,
          balance: 0,
          agent_id: googleAgentId
        }).select("*").single();

        if (createErr) throw createErr;

        await supabase.from("user_stats").insert({ user_id: newUser.id });
        userId = newUser.id;
        isNew = true;

        // [FIX-ROOT-CAUSE] كانت هذه الإشعارات مفقودة كلياً — نفس قالب saraqib-store-admin بالضبط
        const regDateStrGoogle = newUser.created_at ? new Date(newUser.created_at).toLocaleString("ar-EG") : new Date().toLocaleString("ar-EG");
        notifyAdminServer(
          "new_registrations",
          `👤 مستخدم جديد (Google)\n\nالاسم: ${name}\nرقم الدخول: #${newUser.id}\nالإيميل: ${email}${fullPhone ? `\nالهاتف: ${fullPhone}` : ""}\nالتاريخ: ${regDateStrGoogle}`
        ).catch(() => {});
      }

      // Fetch final user data
      const { data: finalUser } = await supabase.from("users").select("*").eq("id", userId).single();
      if (!finalUser) return res.status(500).json({ error: "خطأ في جلب بيانات المستخدم" });

      const banCheckFinal = await checkAndClearBan(finalUser);
      if (banCheckFinal.banned) {
        return res.status(403).json({ error: banCheckFinal.message });
      }

      const { password_hash: _ph2, ...userWithoutPass2 } = finalUser;
      let { data: userStats } = await supabase.from("user_stats").select("*").eq("user_id", userId).single();
      if (!userStats) {
        await supabase.from("user_stats").insert({ user_id: userId });
        const { data: ns2 } = await supabase.from("user_stats").select("*").eq("user_id", userId).single();
        userStats = ns2;
      }

      const token = createUserToken(userId, finalUser?.token_version || 0);
      logActivity(userId, isNew ? "register" : "google_login", isNew ? "إنشاء حساب جديد عبر Google" : "ربط الحساب وتسجيل الدخول عبر Google", req);
      upsertSession(userId, req);
      return res.json({ ...userWithoutPass2, stats: userStats, token, isNew });
    };

    let googleId: string, email: string, name: string, avatarUrl: string | null;

    try {
      // ── [PHONE-GATE] المرحلة الثانية: العميل أرسل googleTempToken (هوية Google
      //    موثّقة من المرحلة الأولى) مع رقم الهاتف الذي طُلب منه تعبئته إجبارياً ──
      if (googleTempToken && typeof googleTempToken === "string") {
        const payload = verifyGoogleTempToken(googleTempToken);
        if (!payload) {
          return res.status(401).json({ error: "انتهت صلاحية الجلسة المؤقتة، يرجى إعادة تسجيل الدخول عبر Google" });
        }
        if (!countryCode || typeof countryCode !== "string" || !/^\+\d{1,4}$/.test(countryCode.trim())) {
          return res.status(400).json({ error: "رمز الدولة غير صحيح" });
        }
        const phoneDigits = typeof phone === "string" ? phone.replace(/\D/g, "") : "";
        if (phoneDigits.length < 7 || phoneDigits.length > 11) {
          return res.status(400).json({ error: "رقم الهاتف غير صحيح لهذه الدولة" });
        }
        const fullPhone = `${countryCode.trim()}${phoneDigits}`;
        return await finalizeGoogleAuth(payload.googleId, payload.email, payload.name, payload.avatarUrl, fullPhone);
      }

      if (accessToken && typeof accessToken === "string") {
        // ── مسار OAuth2 Token (الجديد) ─────────────────────────
        // التحقق من الـ access_token عبر userinfo
        const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (!userInfoRes.ok) {
          return res.status(401).json({ error: "رمز Google غير صالح" });
        }
        const userInfo: any = await userInfoRes.json();
        if (!userInfo.sub || !userInfo.email) {
          return res.status(401).json({ error: "بيانات Google ناقصة" });
        }
        // [SEC-FIX] CWE-345/CWE-287: يجب رفض أي بريد لم توثّق Google ملكيته صراحة.
        // بدون هذا الفحص، أي شخص يملك حساب Google ببريد إلكتروني *غير موثّق* (email_verified=false —
        // حالة نادرة لكنها موجودة فعلياً، مثل بريد ثانوي أُضيف لحساب Google Workspace دون تفعيله)
        // يستطيع تسجيل الدخول أو *ربط* حسابه تلقائياً بأي حساب موجود مسبقاً في متجرنا بنفس البريد
        // (أدناه في "Link Google to existing account") ويستولي عليه بالكامل — دون كلمة مرور ودون أي
        // تحقق آخر. الفحص هنا يرفض الطلب صراحة فقط عندما تُرجع Google email_verified=false بوضوح.
        if (userInfo.email_verified === false || String(userInfo.email_verified) === "false") {
          return res.status(401).json({ error: "بريد حساب Google هذا غير موثّق. يرجى توثيق بريدك لدى Google أولاً." });
        }
        googleId  = userInfo.sub;
        email     = (userInfo.email || "").toLowerCase().trim();
        name      = userInfo.name || directName || email.split("@")[0];
        avatarUrl = userInfo.picture || directPicture || null;

      } else if (credential && typeof credential === "string") {
        // ── مسار ID Token (القديم — نبقيه للتوافق) ────────────
        const tokenInfoRes = await fetch(
          `https://oauth2.googleapis.com/tokeninfo?id_token=${credential}`
        );
        if (!tokenInfoRes.ok) {
          return res.status(401).json({ error: "رمز Google غير صالح" });
        }
        const tokenInfo: any = await tokenInfoRes.json();
        if (tokenInfo.aud !== GOOGLE_CLIENT_ID) {
          return res.status(401).json({ error: "رمز Google غير مخصص لهذا التطبيق" });
        }
        if (!tokenInfo.sub || !tokenInfo.email) {
          return res.status(401).json({ error: "بيانات Google ناقصة" });
        }
        // [SEC-FIX] CWE-345/CWE-287: نفس فحص email_verified المطبَّق على مسار accessToken أعلاه —
        // tokeninfo القديم يُرجع الحقل كنص ("true"/"false") وليس boolean.
        if (String(tokenInfo.email_verified) === "false") {
          return res.status(401).json({ error: "بريد حساب Google هذا غير موثّق. يرجى توثيق بريدك لدى Google أولاً." });
        }
        googleId  = tokenInfo.sub;
        email     = (tokenInfo.email || "").toLowerCase().trim();
        name      = tokenInfo.name || tokenInfo.email.split("@")[0];
        avatarUrl = tokenInfo.picture || null;

      } else {
        return res.status(400).json({ error: "بيانات Google غير صحيحة" });
      }

      // ── [PHONE-GATE] المرحلة الأولى: تحقّقنا من هوية Google بنجاح — الآن نتحقق
      //    هل الحساب (سواء موجود عبر google_id، موجود عبر email بدون ربط، أو غير
      //    موجود إطلاقاً) يملك رقم هاتف مسجّل. إن لم يكن، نوقف الدخول هنا ونطلب
      //    من الواجهة عرض حقل رقم الهاتف الإجباري قبل أي دخول فعلي للواجهة.
      const { data: googleUserCheck } = await supabase
        .from("users").select("id, phone").eq("google_id", googleId).single();

      if (googleUserCheck) {
        if (!googleUserCheck.phone) {
          const tempToken = createGoogleTempToken({ googleId, email, name, avatarUrl });
          return res.json({ requiresPhone: true, googleTempToken: tempToken, name, avatarUrl });
        }
        return await finalizeGoogleAuth(googleId, email, name, avatarUrl, null);
      }

      const { data: emailUserCheck } = await supabase
        .from("users").select("id, phone").eq("email", email).single();

      if (!emailUserCheck || !emailUserCheck.phone) {
        // حساب جديد بالكامل، أو حساب موجود بنفس البريد لكن بدون رقم هاتف — كلاهما يتطلب تعبئته الآن
        const tempToken = createGoogleTempToken({ googleId, email, name, avatarUrl });
        return res.json({ requiresPhone: true, googleTempToken: tempToken, name, avatarUrl });
      }

      return await finalizeGoogleAuth(googleId, email, name, avatarUrl, null);
    } catch (e: any) {
      console.error("[GOOGLE AUTH] Error:", e.message);
      safeError(res, e, "فشل تسجيل الدخول عبر جوجل");
    }
  });

  app.post("/api/auth/login", authLimiter, async (req, res) => {
    const { email, password } = req.body;
    if (!isValidEmail(email) || typeof password !== "string" || password.length < 1) {
      return res.status(400).json({ error: "بيانات الدخول غير صحيحة" });
    }
    // ── Account Lockout Check ──
    const lockStatus = checkAccountLockout(email);
    if (lockStatus.locked) {
      logSecurityEvent("account-lockout", req, email);
      return res.status(429).json({ error: `الحساب مقفل مؤقتاً بسبب محاولات فاشلة. انتظر ${Math.ceil((lockStatus.remainingSec||0)/60)} دقيقة.` });
    }

    const { data: user } = await supabase.from("users").select("*").eq("email", email.toLowerCase().trim()).single();

    if (user) {
      const banCheck1 = await checkAndClearBan(user);
      if (banCheck1.banned) return res.status(403).json({ error: banCheck1.message });
      if (!user.is_verified) return res.status(403).json({ error: "يجب تفعيل حسابك أولاً عبر البريد الإلكتروني", requiresVerification: true, email: user.email });
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (isMatch) {
        const today = new Date().toISOString().split("T")[0];
        const { data: stats } = await supabase.from("user_stats").select("last_login_date, login_days_count").eq("user_id", user.id).single();
        if (stats && stats.last_login_date !== today) {
          await supabase.from("user_stats").update({ last_login_date: today, login_days_count: (stats.login_days_count || 0) + 1 }).eq("user_id", user.id);
        }

        const { password_hash, ...userWithoutPass } = user;
        let { data: fullStats } = await supabase.from("user_stats").select("*").eq("user_id", user.id).single();
        if (!fullStats) {
          await supabase.from("user_stats").insert({ user_id: user.id });
          const { data: newStats } = await supabase.from("user_stats").select("*").eq("user_id", user.id).single();
          fullStats = newStats;
        }
        const safeStats = fullStats || {
          user_id: user.id, total_orders_count: 0, referral_count: 0,
          login_days_count: 0, total_recharge_sum: 0, active_discount: 0,
          one_product_discount_percent: 0,
          has_flaming_theme: false, has_special_support: false,
          has_priority_orders: false, profile_badge: null, custom_theme_color: null
        };
        clearLoginAttempts(email); // reset عند النجاح
        logActivity(user.id, "login", "تسجيل دخول بالبريد الإلكتروني وكلمة المرور", req);
        upsertSession(user.id, req);
        // [FIX-ROOT-CAUSE] كان إشعار تسجيل الدخول مفقوداً كلياً — نفس قالب saraqib-store-admin (system_alerts)
        notifyAdminServer("system_alerts", `🔑 تسجيل دخول\nالاسم: ${user.name}\nرقم الدخول: #${user.id}`).catch(() => {});
        const userToken = createUserToken(user.id, user.token_version || 0);
        res.json({ ...userWithoutPass, stats: safeStats, token: userToken });
        return;
      } else {
        // كلمة مرور خاطئة — سجّل محاولة فاشلة
        recordFailedLogin(email);
        logSecurityEvent("failed-login", req, email);
      }
    } else {
      // [SECURITY FIX — CWE-208 Timing Attack] تشغيل bcrypt.compare صوري بنفس التكلفة الزمنية
      // حتى عندما لا يوجد مستخدم، لمنع تعداد البريد الإلكتروني عبر فرق التوقيت
      await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
      // مستخدم غير موجود — سجّل أيضاً لمنع User Enumeration
      recordFailedLogin(email);
    }
    // رسالة موحدة تمنع معرفة إذا كان البريد مسجلاً
    res.status(401).json({ error: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
  });

  // =================== USER ROUTES ===================

  app.get("/api/user/:id", authenticate, async (req, res) => {
    try {
      // المستخدم يقدر يشوف بياناته فقط
      if (String((req as any).userId) !== String(req.params.id)) {
        return res.status(403).json({ error: "ممنوع: لا يمكنك الوصول لبيانات مستخدم آخر" });
      }
      if (!isValidId(req.params.id)) return res.status(400).json({ error: "معرف غير صحيح" });
      const { data: user, error } = await supabase.from("users").select("*").eq("id", req.params.id).single();
      if (error) throw error;
      if (!user) return res.status(404).json({ error: "المستخدم غير موجود" });
      const { password_hash, ...userWithoutPass } = user;
      let { data: stats } = await supabase.from("user_stats").select("*").eq("user_id", user.id).single();
      if (!stats) {
        await supabase.from("user_stats").insert({ user_id: user.id });
        const { data: newStats } = await supabase.from("user_stats").select("*").eq("user_id", user.id).single();
        stats = newStats;
      }
      const safeStats = stats || { user_id: user.id, total_orders_count: 0, referral_count: 0, login_days_count: 0, total_recharge_sum: 0, active_discount: 0, one_product_discount_percent: 0, has_flaming_theme: false, has_special_support: false, has_priority_orders: false, profile_badge: null, custom_theme_color: null };
      res.json({ ...userWithoutPass, stats: safeStats });
    } catch (e: any) {
      safeError(res, e, "فشل تحميل بيانات المستخدم");
    }
  });

  // =================== SESSIONS & ACTIVITY LOG ===================

  app.get("/api/user/:id/sessions", authenticate, async (req, res) => {
    try {
      if (String((req as any).userId) !== String(req.params.id)) {
        return res.status(403).json({ error: "ممنوع: لا يمكنك الوصول لبيانات مستخدم آخر" });
      }
      if (!isValidId(req.params.id)) return res.status(400).json({ error: "معرف غير صحيح" });

      const currentIp = (req as any).clientIp || getClientIp(req) || "";
      const current = {
        device: parseDeviceFromUA(String(req.headers["user-agent"] || "")),
        ip: currentIp,
        location: await resolveIpLocation(currentIp),
        last_active: new Date().toISOString(),
      };
      upsertSession(req.params.id, req);

      let others: any[] = [];
      try {
        const { data, error } = await supabase
          .from("user_sessions")
          .select("id, device, ip, location, last_active")
          .eq("user_id", req.params.id)
          .order("last_active", { ascending: false })
          .limit(20);
        if (!error && Array.isArray(data)) {
          others = data.filter((s: any) => !(s.device === current.device && s.ip === current.ip));
        }
      } catch {
        others = [];
      }

      res.json({ current, others });
    } catch (e: any) {
      safeError(res, e, "فشل تحميل قائمة الجلسات النشطة");
    }
  });

  // ── إنهاء (تسجيل خروج) جلسة معينة لمستخدم من جهاز آخر ──
  app.post("/api/user/:id/sessions/:sessionId/revoke", authenticate, async (req, res) => {
    try {
      if (String((req as any).userId) !== String(req.params.id)) {
        return res.status(403).json({ error: "ممنوع: لا يمكنك الوصول لبيانات مستخدم آخر" });
      }
      if (!isValidId(req.params.id)) return res.status(400).json({ error: "معرف غير صحيح" });
      const { sessionId } = req.params;

      const { data: existing, error: fetchErr } = await supabase
        .from("user_sessions")
        .select("id")
        .eq("id", sessionId)
        .eq("user_id", req.params.id)
        .maybeSingle();
      if (fetchErr || !existing) return res.status(404).json({ error: "الجلسة غير موجودة" });

      const { error: delErr } = await supabase.from("user_sessions").delete().eq("id", sessionId).eq("user_id", req.params.id);
      if (delErr) throw delErr;

      await logActivity(req.params.id, "session_logout", "تم تسجيل الخروج من جهاز آخر", req);
      res.json({ success: true });
    } catch (e: any) {
      safeError(res, e, "فشل إلغاء تفعيل هذه الجلسة");
    }
  });

  // ── إنهاء جميع الجلسات الأخرى (كل الأجهزة عدا الجهاز الحالي) ──
  app.post("/api/user/:id/sessions/revoke-all", authenticate, async (req, res) => {
    try {
      if (String((req as any).userId) !== String(req.params.id)) {
        return res.status(403).json({ error: "ممنوع: لا يمكنك الوصول لبيانات مستخدم آخر" });
      }
      if (!isValidId(req.params.id)) return res.status(400).json({ error: "معرف غير صحيح" });

      const currentIp = (req as any).clientIp || getClientIp(req) || "";
      const currentDevice = parseDeviceFromUA(String(req.headers["user-agent"] || ""));

      const { data: rows, error: fetchErr } = await supabase
        .from("user_sessions")
        .select("id, device, ip")
        .eq("user_id", req.params.id);
      if (fetchErr) throw fetchErr;

      const toDelete = (rows || []).filter((s: any) => !(s.device === currentDevice && s.ip === currentIp)).map((s: any) => s.id);
      if (toDelete.length > 0) {
        const { error: delErr } = await supabase.from("user_sessions").delete().in("id", toDelete);
        if (delErr) throw delErr;
      }

      // [SECURITY FIX] زيادة token_version تُبطل فعلياً كل التوكنات القديمة (بما فيها
      // توكن مسروق على جهاز آخر) وليس فقط حذف سجل العرض في user_sessions —
      // القسم 3.2 من تقرير الفحص الأمني. المستخدم الحالي يحصل على توكن جديد فوراً
      // ليبقى مسجلاً دخولاً على جهازه، بينما تُبطَل بقية الأجهزة.
      const { data: currentUserRow } = await supabase.from("users").select("token_version").eq("id", req.params.id).single();
      const newTokenVersion = (currentUserRow?.token_version || 0) + 1;
      await supabase.from("users").update({ token_version: newTokenVersion }).eq("id", req.params.id);
      const refreshedToken = createUserToken(req.params.id, newTokenVersion);

      await logActivity(req.params.id, "session_logout_all", "تم تسجيل الخروج من جميع الأجهزة الأخرى", req);
      res.json({ success: true, revoked: toDelete.length, token: refreshedToken });
    } catch (e: any) {
      safeError(res, e, "فشل إلغاء تفعيل جميع الجلسات");
    }
  });

  app.get("/api/user/:id/activity-log", authenticate, async (req, res) => {
    try {
      if (String((req as any).userId) !== String(req.params.id)) {
        return res.status(403).json({ error: "ممنوع: لا يمكنك الوصول لبيانات مستخدم آخر" });
      }
      if (!isValidId(req.params.id)) return res.status(400).json({ error: "معرف غير صحيح" });

      const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
      const pageSize = 30;
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      let logs: any[] = [];
      let total = 0;
      try {
        const { data, error, count } = await supabase
          .from("activity_logs")
          .select("id, type, description, ip, device, location, is_unusual, created_at", { count: "exact" })
          .eq("user_id", req.params.id)
          .order("created_at", { ascending: false })
          .range(from, to);
        if (!error) {
          logs = Array.isArray(data) ? data : [];
          total = typeof count === "number" ? count : logs.length;
        }
      } catch {
        logs = [];
        total = 0;
      }

      res.json({ logs, total });
    } catch (e: any) {
      safeError(res, e, "فشل تحميل سجل النشاط");
    }
  });

  app.post("/api/user/:userId/avatar", authenticate, async (req, res) => {
    try {
      if (String((req as any).userId) !== String(req.params.userId)) {
        return res.status(403).json({ error: "ممنوع" });
      }
      const { avatarUrl } = req.body;
      if (!isValidUrl(avatarUrl)) return res.status(400).json({ error: "رابط الصورة غير صحيح" });
      await supabase.from("users").update({ avatar_url: avatarUrl }).eq("id", req.params.userId);
      logActivity(req.params.userId, "avatar_change", "تغيير الصورة الشخصية", req);
      res.json({ success: true });
    } catch (e: any) {
      safeError(res, e, "فشل رفع صورة الملف الشخصي");
    }
  });

  app.patch("/api/user/:id/avatar", authenticate, async (req, res) => {
    try {
      if (String((req as any).userId) !== String(req.params.id)) {
        return res.status(403).json({ error: "ممنوع" });
      }
      const { avatar_url } = req.body;
      if (!isValidUrl(avatar_url)) return res.status(400).json({ error: "رابط الصورة غير صحيح" });
      await supabase.from("users").update({ avatar_url }).eq("id", req.params.id);
      res.json({ success: true });
    } catch (e: any) {
      safeError(res, e, "فشل تحديث صورة الملف الشخصي");
    }
  });

  app.post("/api/user/update", authenticate, async (req, res) => {
    try {
      // userId يؤخذ من الـ JWT فقط — المستخدم لا يقدر يعدل حساب آخر
      const userId = (req as any).userId;
      const { name, phone, password, oldPassword } = req.body;

      // Validation صارم
      if (name !== undefined && !isValidName(name)) {
        return res.status(400).json({ error: "الاسم يجب أن يكون بين 2 و60 حرف بدون رموز HTML" });
      }
      if (phone !== undefined && phone !== "" && !isValidPhone(phone)) {
        return res.status(400).json({ error: "رقم الهاتف غير صحيح — أرقام فقط (7-20 رقم)" });
      }
      if (password !== undefined && password.trim().length > 0 && !isValidPassword(password)) {
        return res.status(400).json({ error: "كلمة المرور يجب أن تكون 8 أحرف على الأقل" });
      }

      const updateData: any = {};
      if (name    !== undefined) updateData.name  = sanitizeText(name, 60);
      if (phone   !== undefined) updateData.phone = phone.trim();
      if (password && password.trim().length > 0) {
        // [FIX] يتطلب كلمة المرور القديمة قبل تعيين كلمة مرور جديدة
        if (!oldPassword || typeof oldPassword !== "string" || oldPassword.trim().length === 0) {
          return res.status(400).json({ error: "يجب إدخال كلمة المرور القديمة" });
        }
        const { data: currentUser } = await supabase.from("users").select("password_hash").eq("id", userId).single();
        if (!currentUser) return res.status(404).json({ error: "المستخدم غير موجود" });
        const oldMatches = await bcrypt.compare(oldPassword, currentUser.password_hash);
        if (!oldMatches) {
          return res.status(400).json({ error: "كلمة المرور القديمة غير صحيحة" });
        }
        updateData.password_hash = await bcrypt.hash(password, 12);
        // [SECURITY FIX] عند تغيير كلمة المرور من الإعدادات، نزيد token_version لإبطال
        // فوري لكل التوكنات القديمة الصادرة قبل التغيير — القسم 3.2 من تقرير الفحص الأمني.
        const { data: verUser } = await supabase.from("users").select("token_version").eq("id", userId).single();
        updateData.token_version = (verUser?.token_version || 0) + 1;
      }

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({ error: "لا توجد بيانات للتحديث" });
      }

      await supabase.from("users").update(updateData).eq("id", userId);
      if (updateData.name !== undefined) logActivity(userId, "name_change", "تغيير الاسم الشخصي", req);
      if (updateData.phone !== undefined) logActivity(userId, "phone_change", "تغيير رقم الهاتف", req);
      if (updateData.password_hash !== undefined) logActivity(userId, "password_change", "تغيير كلمة المرور", req, { is_unusual: true });
      const { data: updatedUser } = await supabase
        .from("users")
        .select("*, user_stats(*)")
        .eq("id", userId)
        .single();
      if (updatedUser) {
        const { password_hash: _ph, ...safeUser } = updatedUser as any;
        const stats = Array.isArray(safeUser.user_stats) ? safeUser.user_stats[0] : safeUser.user_stats;
        delete safeUser.user_stats;
        // [SECURITY FIX] عند تغيير كلمة المرور نُصدر توكناً جديداً بنسخة (token_version) الحالية
        // كي يبقى المستخدم مسجلاً دخولاً على جهازه الحالي بينما تُبطَل بقية الأجهزة/التوكنات القديمة.
        const freshToken = updateData.password_hash !== undefined
          ? createUserToken(userId, updatedUser.token_version || 0)
          : undefined;
        res.json({ ...safeUser, stats, ...(freshToken ? { token: freshToken } : {}) });
      } else {
        res.json({ success: true });
      }
    } catch (e: any) {
      safeError(res, e, "فشل تحديث بيانات المستخدم");
    }
  });

  app.post("/api/user/unlink-telegram", authenticate, async (req, res) => {
    try {
      const userId = (req as any).userId;
      await supabase.from("users").update({ telegram_chat_id: null }).eq("id", userId);
      res.json({ success: true });
    } catch (e: any) {
      safeError(res, e, "فشل إلغاء ربط حساب تيليجرام");
    }
  });

  app.get("/api/telegram-bot/user-status", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("telegram_bot_settings")
        .select("token_enc, is_disabled, settings")
        .eq("bot_type", "user")
        .maybeSingle();
      if (error) throw error;
      const isConnected = !!(data && data.token_enc);
      const isDisabled = !!(data && data.is_disabled);
      const storedUsername = data && data.settings && data.settings.bot_username;
      res.json({
        available: isConnected && !isDisabled,
        bot_username: storedUsername || process.env.TELEGRAM_USER_BOT_USERNAME || "saraqib_store_bot",
      });
    } catch (e: any) {
      res.json({ available: false, bot_username: "saraqib_store_bot" });
    }
  });

  app.post("/api/user/generate-linking-code", authenticate, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { data: botRow } = await supabase
        .from("telegram_bot_settings")
        .select("token_enc, is_disabled")
        .eq("bot_type", "user")
        .maybeSingle();
      if (!botRow || !botRow.token_enc || botRow.is_disabled) {
        return res.status(503).json({ error: "لم يتم اضافة بوت بعد" });
      }
      const code = crypto.randomInt(100000, 999999).toString(); // [FIX] crypto بدلاً من Math.random
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const { error } = await supabase.from("telegram_linking_codes").insert({ user_id: userId, code, expires_at: expiresAt });
      if (error) throw error;
      res.json({ code });
    } catch (e: any) {
      safeError(res, e, "فشل إنشاء رمز الربط");
    }
  });

  app.post("/api/user/update-theme", authenticate, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { color } = req.body;
      if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) {
        return res.status(400).json({ error: "لون غير صحيح (استخدم HEX مثل #FF0000)" });
      }
      await supabase.from("user_stats").update({ custom_theme_color: color || null }).eq("user_id", userId);
      res.json({ success: true });
    } catch (e: any) {
      safeError(res, e, "فشل تحديث مظهر التطبيق");
    }
  });

  // =================== REFERRALS ===================

  app.post("/api/referrals/apply", authenticate, async (req, res) => {
    const userId = (req as any).userId;
    const { referralCode } = req.body;
    if (!referralCode || !isValidId(referralCode)) {
      return res.status(400).json({ error: "رمز الإحالة غير صحيح" });
    }
    try {
      const { data: me, error: meErr } = await supabase
        .from("users")
        .select("id, referred_by_id")
        .eq("id", userId)
        .single();
      if (meErr || !me) return res.status(404).json({ error: "المستخدم غير موجود" });

      if (me.referred_by_id) {
        return res.status(400).json({ error: "لقد استخدمت كود احالة بالفعل" });
      }

      if (String(referralCode) === String(userId)) {
        return res.status(400).json({ error: "لا يمكنك استخدام كود الإحالة الخاص بك" });
      }

      const { data: referrer, error: refErr } = await supabase
        .from("users")
        .select("id")
        .eq("id", referralCode)
        .single();
      if (refErr || !referrer) return res.status(404).json({ error: "كود الإحالة غير موجود" });

      await supabase.from("users").update({ referred_by_id: referrer.id }).eq("id", userId);

      const { data: refUser } = await supabase.from("users").select("referral_count").eq("id", referrer.id).single();
      const newRefCount = (refUser?.referral_count || 0) + 1;
      await supabase.from("users").update({ referral_count: newRefCount }).eq("id", referrer.id);
      await supabase.from("user_stats").update({ referral_count: newRefCount }).eq("user_id", referrer.id);

      res.json({ success: true });
    } catch (e: any) {
      safeError(res, e, "فشل تطبيق كود الإحالة");
    }
  });

  app.get("/api/referrals/stats/:userId", authenticate, async (req, res) => {
    if (String((req as any).userId) !== String(req.params.userId)) {
      return res.status(403).json({ error: "ممنوع" });
    }
    try {
      // [FIX] إضافة order بالتاريخ — الأحدث أولاً (كما في النسخة القديمة)
      const { data: referrals, error } = await supabase
        .from("users")
        .select("id, name, created_at")
        .eq("referred_by_id", req.params.userId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const actualCount = referrals?.length || 0;

      // [FIX] تحديث referral_count في users و user_stats معاً للتزامن
      await supabase.from("users").update({ referral_count: actualCount }).eq("id", req.params.userId);
      await supabase.from("user_stats").update({ referral_count: actualCount }).eq("user_id", req.params.userId);

      res.json({ count: actualCount, referrals: referrals || [] });
    } catch (e: any) {
      safeError(res, e, "فشل تحميل إحصائيات الإحالة");
    }
  });

  // =================== NOTIFICATIONS ===================

  app.get("/api/notifications/:userId", authenticate, async (req, res) => {
    if (String((req as any).userId) !== String(req.params.userId)) {
      return res.status(403).json({ error: "ممنوع" });
    }
    try {
      const { data, error } = await supabase.from("notifications").select("*")
        .or(`user_id.eq.${req.params.userId},user_id.is.null`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      res.json(Array.isArray(data) ? data : []);
    } catch (e: any) {
      res.json([]); // always array
    }
  });

  app.post("/api/notifications/mark-read", authenticate, async (req, res) => {
    try {
      const { notificationId } = req.body;
      if (!isValidId(notificationId)) return res.status(400).json({ error: "معرف غير صحيح" });
      // تأكد أن الإشعار يخص المستخدم
      const userId = (req as any).userId;
      await supabase.from("notifications").update({ is_read: true }).eq("id", notificationId).eq("user_id", userId);
      res.json({ success: true });
    } catch (e: any) {
      safeError(res, e, "فشل تحديث حالة الإشعارات كمقروءة");
    }
  });

  // =================== PUSH SUBSCRIPTIONS ===================

  app.get("/api/push/key", (req, res) => {
    res.json({ publicKey: vapidKeys.publicKey });
  });

  app.post("/api/push/subscribe", authenticate, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { subscription } = req.body || {};
      if (!subscription || typeof subscription !== "object" || !subscription.endpoint) {
        return res.status(400).json({ error: "بيانات الاشتراك غير صحيحة" });
      }
      // [SEC-FIX SSRF] قبول نقاط نهاية خدمات Push المعروفة فقط (HTTPS) — يمنع تخزين
      // عناوين داخلية/عشوائية (webhook.site، 127.0.0.1...) تُستغل لاحقاً عبر sendNotification.
      if (!isValidPushEndpoint(subscription.endpoint)) {
        return res.status(400).json({ error: "نقطة نهاية الإشعارات غير مدعومة." });
      }
      const subStr = JSON.stringify(subscription);
      const { data: existing } = await supabase.from("push_subscriptions").select("id").eq("user_id", userId).eq("subscription", subStr).maybeSingle();
      if (!existing) {
        const { error: insertErr } = await supabase.from("push_subscriptions").insert({ user_id: userId, subscription: subStr });
        if (insertErr) throw insertErr;
      }
      res.json({ success: true });
    } catch (e: any) {
      safeError(res, e, "فشل تفعيل إشعارات الدفع (Push)");
    }
  });

  // POST /api/push/unsubscribe — إلغاء تفعيل الإشعارات ذاتياً من الإعدادات (كل اشتراكات المستخدم)
  app.post("/api/push/unsubscribe", authenticate, async (req, res) => {
    try {
      const userId = (req as any).userId;
      await supabase.from("push_subscriptions").delete().eq("user_id", userId);
      res.json({ success: true });
    } catch (e: any) {
      safeError(res, e, "فشل إلغاء تفعيل إشعارات الدفع");
    }
  });

  // =================== ORDERS ===================

  // =================== ORDERS (shared core) ===================
  // createOrderCore — يحتوي على كامل منطق إنشاء الطلب (فحص الرصيد، خصم VIP،
  // التسليم التلقائي من المخزون، استدعاء المزود الخارجي، الإشعارات، سجل النشاط).
  // يُستخدم من /api/orders (المستخدم عبر الموقع) ومن /client/api/newOrder (توكن خارجي)
  // بنفس السلوك تماماً — بدون أي تغيير في سلوك /api/orders الحالي.
  type CreateOrderResult =
    | { ok: true; body: Record<string, any> }
    | { ok: false; statusCode: number; error: string; details?: any };

  // --- نظام الرتب: نسبة خصم رتبة المستخدم (0 إن لم تكن للرتبة خصم أو لم يكن المنتج ضمن
  //     الأقسام/الأقسام الفرعية التي حددها الأدمن لهذه الرتبة في rank_categories) ---
  async function getRankDiscountPercent(rankId: any, product: any): Promise<number> {
    if (rankId === null || rankId === undefined) return 0;
    try {
      const { data } = await supabase.from("ranks").select("has_discount, is_active").eq("id", rankId).maybeSingle();
      if (!data || !data.is_active || !data.has_discount) return 0;
      // [PHASE-2] محرك القواعد: القاعدة الأدق للمنتج فقط (منتج > فرع فرعي > فرعي > رئيسي > الكل) + حماية التكلفة
      const rules = await loadDiscountRules(supabase, "rank", rankId);
      return resolveDiscountPercent(rules, product).percent;
    } catch { return 0; }
  }

  // --- صافي ربح الطلب (يُستخدم حصراً لحساب عمولة الإحالة) ---
  // external_api: التكلفة = سعر المزوّد للوحدة (cost_price المحفوظ) × الكمية.
  // غير ذلك: default_profit للمنتج (ربح الوحدة) × الكمية. بلا أي معلومة تكلفة/ربح → 0.
  function computeOrderNetProfit(product: any, total: number, qty: number, costPerUnit: number): number {
    const q = Math.max(1, Number(qty) || 1);
    if (product?.store_type === "external_api" && costPerUnit > 0) {
      return Math.max(0, total - costPerUnit * q);
    }
    const dp = product?.default_profit;
    if (dp !== undefined && dp !== null && dp !== "" && !isNaN(parseFloat(String(dp)))) {
      return Math.max(0, parseFloat(String(dp)) * q);
    }
    return 0;
  }

  async function createOrderCore(
    userId: number | string,
    productId: number | string,
    quantity: any,
    extraData: any,
    source: "user" | "external_api",
    req: any
  ): Promise<CreateOrderResult> {
    // [SEC-FIX] CWE-460 خصم بلا إرجاع: يُضبط true فوراً بعد نجاح حجز الرصيد، ويُفحص
    // في الـ catch الخارجي لإرجاع الرصيد تلقائياً إن انهارت أي خطوة لاحقة باستثناء غير متوقع.
    let balanceReserved = false;
    let total = 0;
    try {
      if (!isValidId(productId)) return { ok: false, statusCode: 400, error: "معرف المنتج غير صحيح" };

      const { data: user, error: uErr } = await supabase.from("users").select("*").eq("id", userId).single();
      if (uErr) throw uErr;
      const { data: product, error: pErr } = await supabase.from("products").select("*, subcategories(category_id)").eq("id", productId).single();
      if (pErr) throw pErr;
      if (!product) return { ok: false, statusCode: 404, error: "غير موجود" };

      // التحقق من الكمية باستخدام حدود المنتج الفعلية
      // لنوع "quantities": min_quantity = الحد الأدنى للطلب، max_quantity = الحد الأقصى
      const productMaxQty = product?.max_quantity || 100_000;
      const productMinQty = product?.min_quantity || 1;

      let safeQty: number;
      let packagePrice: number | null = null;
      const isSpecificPackage = product?.package_type === "specificPackage" && Array.isArray(product?.package_values) && product.package_values.length > 0;
      const isPackagesStore = product?.store_type === "packages" && Array.isArray(product?.packages_data) && product.packages_data.length > 0;
      const isFixedQuantity = !isSpecificPackage && !isPackagesStore && productMinQty === productMaxQty;

      if (isPackagesStore) {
        // متجر الباقات: العميل يختار باقة من قائمة منسدلة (اسم الباقة يُرسل عبر extraData.packageLabel)
        const requestedLabel = (extraData?.packageLabel || extraData?.package_label || "").toString().trim();
        const matchedPkg = product.packages_data.find((p: any) => p && p.label === requestedLabel);
        if (!requestedLabel || !matchedPkg) {
          return { ok: false, statusCode: 400, error: "يرجى اختيار باقة صحيحة من القائمة" };
        }
        safeQty = 1;
        packagePrice = Number(matchedPkg.price);
        if (!Number.isFinite(packagePrice)) {
          return { ok: false, statusCode: 400, error: "سعر الباقة غير صحيح" };
        }
      } else if (isSpecificPackage) {
        // منتجات specificPackage: الكمية المرسلة يجب أن تطابق إحدى القيم المحددة في package_values بفارق دقة عائم صغير
        const requestedQty = parseFloat(quantity);
        const matched = product.package_values.some((v: any) => Math.abs(parseFloat(v) - requestedQty) < 1e-6);
        if (!Number.isFinite(requestedQty) || !matched) {
          return { ok: false, statusCode: 400, error: "الباقة/الكمية المختارة غير متاحة لهذا المنتج، يرجى اختيار قيمة من القائمة" };
        }
        safeQty = requestedQty;
      } else if (isFixedQuantity) {
        // كمية ثابتة (min == max): تُستخدم كما هي دون سماح للعميل بتغييرها
        safeQty = productMinQty;
      } else {
        // الحالة العادية
        safeQty = Math.floor(Number(quantity));
        if (!Number.isInteger(safeQty) || safeQty < 1) return { ok: false, statusCode: 400, error: "الكمية غير صحيحة" };
        if (safeQty < productMinQty) return { ok: false, statusCode: 400, error: `أقل كمية مسموح بها: ${productMinQty}` };
        if (safeQty > productMaxQty) return { ok: false, statusCode: 400, error: `أكبر كمية مسموح بها: ${productMaxQty}` };
      }

      // فحص الطلبات المكررة (نفس البيانات خلال 10 ثوانٍ)
      const playerIdForDedup = (extraData?.playerId || extraData?.input || "").toString().trim();
      if (isDuplicateOrder(String(userId), String(productId), safeQty, playerIdForDedup)) {
        return { ok: false, statusCode: 429, error: "طلب مكرر — يرجى الانتظار قليلاً قبل المحاولة مجدداً" };
      }

      if (!user) return { ok: false, statusCode: 404, error: "غير موجود" };
      // تحقق من أن المستخدم لم يُحظر
      const banCheckOrder = await checkAndClearBan(user);
      if (banCheckOrder.banned || user.is_blocked) {
        logSecurityEvent("banned-user-order", req, `userId:${userId}`);
        return { ok: false, statusCode: 403, error: banCheckOrder.message || "حسابك موقوف" };
      }

      // حساب السعر الصحيح حسب نوع المتجر
      // لنوع "quantities": price = سعر لـ price_per_unit وحدة (الكمية الأساسية) → سعر الوحدة = price / price_per_unit
      const rawPrice = parseFloat(product.price) || 0;
      let unitPrice: number;
      if (packagePrice !== null) {
        unitPrice = packagePrice;
      } else if (product.store_type === 'quantities') {
        const baseQty = Math.max(1, parseFloat(product.price_per_unit) || 1);
        unitPrice = rawPrice / baseQty;
      } else {
        unitPrice = rawPrice;
      }
      total = unitPrice * safeQty;

      const { data: stats } = await supabase.from("user_stats").select("*").eq("user_id", userId).single();
      // [PHASE-2] خصم VIP من محرك القواعد (قاعدة لكل قسم/قسم فرعي/فرع فرعي/منتج أو كل المنتجات).
      // طريقة الدمج مع باقي الخصومات لم تتغير: يُؤخذ الأعلى بين (VIP، الرتبة، مدى الحياة، المؤقت، لمنتج واحد، API).
      const vipRules = user.is_vip ? await loadDiscountRules(supabase, "vip", null) : [];
      let discountPercent = user.is_vip ? resolveDiscountPercent(vipRules, product).percent : 0;

      // خصم رتبة المستخدم (نظام الرتب) — يُطبَّق على المشتريات ويُؤخذ الأعلى بين الخصومات
      const rankDiscount = await getRankDiscountPercent((user as any).rank_id, product);
      if (rankDiscount > 0) discountPercent = Math.max(discountPercent, rankDiscount);

      if (stats) {
        // خصم مدى الحياة (الهدف 6: 3%، الهدف 7: 5%)
        if (stats.lifetime_discount && stats.lifetime_discount > 0) {
          discountPercent = Math.max(discountPercent, stats.lifetime_discount);
        }
        if (stats.discount_expires_at && new Date(stats.discount_expires_at) > new Date()) {
          discountPercent = Math.max(discountPercent, stats.active_discount || 0);
        }
        if (stats.one_product_discount_percent > 0) {
          discountPercent = Math.max(discountPercent, stats.one_product_discount_percent);
          await supabase.from("user_stats").update({ one_product_discount_percent: 0 }).eq("user_id", userId);
        }
      }

      // نسبة خصم على طلبات الـ API الخارجية — تُطبَّق نسبة التوكن المخصصة إن وُجدت، وإلا النسبة العامة لإعدادات الـ API
      if (source === "external_api") {
        // [PHASE-2] خصم الـ API: نسبة التوكن المخصصة (إن وُجدت) تتفوق، وإلا قواعد api_global (الأدق للمنتج)
        const apiDiscountPercent = await getApiDiscountPercentForProduct((req as any)?.apiTokenId, product);
        if (apiDiscountPercent > 0) discountPercent = Math.max(discountPercent, apiDiscountPercent);
      }

      if (discountPercent > 0) total *= (1 - discountPercent / 100);
      if (user.balance < total) return { ok: false, statusCode: 400, error: "الرصيد غير كافٍ" };

      // [SEC-FIX] Race Condition (CWE-362 / TOCTOU): كان الرصيد يُخصم لاحقاً عبر
      // "update({ balance: user.balance - total })" بالاعتماد على قيمة user.balance المقروءة
      // في بداية الدالة — بين تلك القراءة وتنفيذ الخصم توجد استدعاءات شبكة/DB متعددة (فحص
      // المخزون، إنشاء الطلب لدى المزود الخارجي...) وهي نافذة كافية لتنفيذ طلبات متزامنة
      // (منتجات/كميات مختلفة تتفادى فحص isDuplicateOrder) تقرأ جميعها نفس الرصيد القديم وتمرّ
      // من فحص "الرصيد كافٍ" أعلاه، فيُسمح بشراء ما يفوق الرصيد الفعلي (Double-Spend).
      // الإصلاح: نحجز المبلغ فوراً وبشكل ذرّي عبر دالة قاعدة بيانات واحدة تتحقق وتخصم في نفس
      // العملية (راجع migrations/001_atomic_balance_deduction.sql). إن فشل الحجز، لا شيء
      // تغيّر بعد (لم يُنشأ طلب بعد ولم يُطلب من أي مزود خارجي) فنرفض الطلب بأمان.
      const { data: reserveRows, error: reserveErr } = await supabase.rpc("deduct_balance_if_sufficient", {
        p_user_id: userId,
        p_amount: total,
      });
      const reserved = Array.isArray(reserveRows) ? reserveRows[0] : reserveRows;
      if (reserveErr || !reserved?.success) {
        return { ok: false, statusCode: 409, error: "الرصيد غير كافٍ" };
      }
      balanceReserved = true; // [SEC-FIX] من هذه اللحظة أي استثناء غير متوقع يجب أن يُرجع هذا المبلغ
      // دالة مساعدة لاسترجاع المبلغ المحجوز إن فشلت خطوة لاحقة بعد الحجز (تعويض/Compensation)
      const refundReservedBalance = async () => {
        try { await supabase.rpc("increment_balance", { user_id_param: userId, amount_param: total }); }
        catch (e) { console.error(`[ORDER] فشل استرجاع رصيد محجوز لمستخدم ${userId} بقيمة ${total}`, e); }
      };

      // =================== CHECK ORDER MODE (AUTO vs MANUAL) ===================
      // نقرأ وضع معالجة الطلبات من الإعدادات
      const { data: orderModeSetting } = await supabase.from("settings").select("value").eq("key", "order_processing_mode").single();
      const orderMode = orderModeSetting?.value || "manual"; // 'auto' or 'manual'

      let ahminixOrderId: string | null = null;
      let ahminixOrderStatus: string | null = null;
      let ahminixReplayApi: any[] = [];
      let ahminixOrderUuid: string | null = null;
      let providerOrderFailed = false;
      let providerFailReason = "";

      // =================== EXTERNAL API ORDER ===================
      const hasExternalId = product.external_id && String(product.external_id).trim() !== "";
      if (hasExternalId && orderMode === 'auto') {
        const provider = await getProviderForProduct(Number(productId));
        if (!provider) {
          return { ok: false, statusCode: 500, error: "لم يتم تحديد مزود API لهذا المنتج أو المزود غير نشط. قم بتعيين مزود من لوحة التحكم." };
        }

        let playerId = "";
        if (product.requires_input) {
          playerId = (
            extraData?.playerId ||
            extraData?.input ||
            extraData?.userId ||
            extraData?.gameId ||
            extraData?.accountId ||
            ""
          ).toString().trim();
          if (!playerId) {
            return { ok: false, statusCode: 400, error: "هذا المنتج يتطلب معرف اللاعب (Player ID)" };
          }
        } else {
          playerId = (
            extraData?.playerId ||
            extraData?.input ||
            user.phone ||
            String(user.id)
          ).toString().trim();
        }

        ahminixOrderUuid = generateUUIDv4();
        // بعض المزودين (مثل طرطوسي) لديهم منتجات specificPackage حيث يجب أن تطابق qty
        // قيمة محددة بالضبط (قد تكون كسرية مثل 1.92)، لذا نرسل safeQty كما هو دون أي تقريب إضافي.
        const qty = safeQty;

        const providerExtraParams = buildProviderExtraParams(product, extraData);
        console.log(`[PROVIDER:${provider.name}] Creating order: ext_id=${product.external_id}, qty=${qty}, playerId="${playerId}", type=${provider.provider_type}, extraParams=${JSON.stringify(providerExtraParams)}, uuid=${ahminixOrderUuid}`);

        if (provider.provider_type === "megaapi") {
          const megaFields = buildMegaApiOrderFields(product, { ...extraData, playerId });
          const megaRes = await megaApiCreateOrder(
            provider.base_url,
            provider.api_token,
            String(product.external_id).trim(),
            qty,
            megaFields,
            ahminixOrderUuid
          );
          // طلب مكرر (نفس UUID): error=true لكن data.order_number موجود — نعامله كنجاح
          const isMegaDuplicate = (megaRes?.error === true || megaRes?.err === true) && !!megaRes?.data?.order_number;
          const isMegaError = !megaRes || ((megaRes.error === true || megaRes.err === true) && !megaRes?.data?.order_number);
          if (isMegaError) {
            const errMsg = megaRes?.message || "فشل الطلب لدى المورد";
            console.error(`[PROVIDER:${provider.name}] (megaapi) Order failed:`, JSON.stringify(megaRes));
            await refundReservedBalance();
            return { ok: false, statusCode: 400, error: `فشل الطلب: ${errMsg}`, details: megaRes };
          }
          if (isMegaDuplicate) {
            console.warn(`[PROVIDER:${provider.name}] (megaapi) Duplicate order UUID=${ahminixOrderUuid} — treating as success`);
          }
          ahminixOrderId     = String(megaRes.data?.order_number || ahminixOrderUuid);
          ahminixOrderStatus = megaRes.data?.status || "processing";
          ahminixReplayApi   = [];
          console.log(`[PROVIDER:${provider.name}] (megaapi) Order created: id=${ahminixOrderId}, uuid=${ahminixOrderUuid}, status=${ahminixOrderStatus}`);
        } else {
          const ahminixRes = await providerCreateOrder(
            provider.base_url,
            provider.api_token,
            String(product.external_id).trim(),
            qty,
            playerId,
            ahminixOrderUuid,
            providerExtraParams,
            provider.order_method || "POST",
            provider.id
          );
          if (!ahminixRes || ahminixRes.status !== "OK") {
            const errorCodes: Record<number, string> = {
              120: "رمز API مطلوب",
              121: "خطأ في رمز API — تحقق من توكن المزود في لوحة التحكم",
              122: "غير مسموح باستخدام API",
              123: "عنوان IP غير مسموح به",
              130: "الموقع قيد الصيانة",
              100: "رصيد API غير كافٍ",
              105: "الكمية غير متوفرة",
              106: "الكمية غير مسموح بها",
              112: "الكمية صغيرة جداً",
              113: "الكمية كبيرة جداً",
              114: "معلمة غير صالحة - تحقق من بيانات اللاعب أو الـ Player ID",
              500: "خطأ غير معروف"
            };
            const code = ahminixRes?.code || ahminixRes?.error_code;
            const errMsg = (code && errorCodes[code]) || ahminixRes?.message || ahminixRes?.error || "فشل الطلب لدى المورد";
            console.error(`[PROVIDER:${provider.name}] Order failed:`, JSON.stringify(ahminixRes));
            if (code === 100) {
              providerOrderFailed = true;
              providerFailReason = errMsg;
            } else {
              await refundReservedBalance();
              return { ok: false, statusCode: 400, error: `فشل الطلب: ${errMsg}`, details: ahminixRes };
            }
          } else {
            ahminixOrderId   = String(ahminixRes.data?.order_id || ahminixOrderUuid);
            ahminixOrderStatus = ahminixRes.data?.status || "processing";
            ahminixReplayApi = normalizeReplayApi(ahminixRes.data?.replay_api);
            console.log(`[PROVIDER:${provider.name}] Order created: id=${ahminixOrderId}, uuid=${ahminixOrderUuid}, status=${ahminixOrderStatus}, replay=${ahminixReplayApi.length}`);
          }
        }
      }
      // ====================================================================

      // تحديد حالة الطلب بناءً على الوضع والنتيجة
      let initialStatus: string;
      if (providerOrderFailed) {
        // فشل الطلب لدى المزود (مثلاً رصيد API غير كافٍ) — نحوّله لمعلّق بانتظار موافقة الإدارة يدوياً بدل رفضه
        initialStatus = 'pending_admin';
      } else if (hasExternalId && orderMode === 'auto') {
        initialStatus = ahminixOrderStatus === 'accept' ? 'completed' : 'processing';
      } else if (hasExternalId && orderMode === 'manual') {
        initialStatus = 'pending_admin';
      } else if (product.store_type === 'external_api') {
        initialStatus = orderMode === 'auto' ? 'processing' : 'pending_admin';
      } else if (product.store_type === 'inventory') {
        initialStatus = 'completed';
      } else {
        initialStatus = 'pending';
      }

      if (product.store_type === 'inventory') {
        if (!product.inventory_group_id) {
          await refundReservedBalance();
          return { ok: false, statusCode: 400, error: "هذا المنتج غير مرتبط بمخزون. تواصل مع الدعم." };
        }
        const { count: availableCount } = await supabase
          .from("inventory_units")
          .select("id", { count: "exact", head: true })
          .eq("group_id", product.inventory_group_id)
          .eq("status", "available");
        if (!availableCount || availableCount < 1) {
          await supabase.from("products").update({ available: false }).eq("id", productId);
          await refundReservedBalance();
          return { ok: false, statusCode: 400, error: "نفذت الكمية من هذا المنتج حالياً" };
        }
      }

      // حفظ الطلب في قاعدة البيانات المحلية
      // cost_price: سعر التكلفة لحظة الشراء — يُحفظ هنا ليُستخدم في حساب الأرباح حتى لو تغيّر لاحقاً
      // price_per_unit هو سعر تكلفة المزوّد فقط لمنتجات external_api؛ لباقي الأنواع (خصوصاً quantities) هو كمية لا مبلغ.
      const snapshotCostPrice = product.store_type === 'external_api'
        ? (parseFloat(String(product.price_per_unit || 0)) || 0)
        : 0;
      // جلب provider_id من المنتج لحفظه في meta (يُستخدم لاحقاً في sync/check)
      const providerIdForMeta = (product as any).provider_id || null;

      const metaData: any = {
        ...extraData,
        order_mode: orderMode,
        product_name: product.name,
        cost_price: snapshotCostPrice,
        source,
        ...(providerIdForMeta ? { provider_id: providerIdForMeta } : {}),
        ...(providerOrderFailed ? { last_api_error: providerFailReason } : {}),
        ...(ahminixOrderId ? {
          ahminix_order_id: ahminixOrderId,
          ahminix_order_uuid: ahminixOrderUuid || ahminixOrderId,
          ahminix_status: ahminixOrderStatus,
          ahminix_replay: ahminixReplayApi
        } : {})
      };

      const { data: order, error: orderErr } = await supabase.from("orders").insert({
        user_id: userId,
        total_amount: total,
        meta: JSON.stringify(metaData),
        status: initialStatus
      }).select().single();
      if (orderErr) throw orderErr;

      await supabase.from("order_items").insert({
        order_id: order.id,
        product_id: productId,
        price_at_purchase: product.price,
        quantity: safeQty,
        extra_data: JSON.stringify(metaData)
      });

      // =================== INVENTORY AUTO-DELIVERY ===================
      // سحب عنصر واحد ذرّياً من المخزون (FOR UPDATE SKIP LOCKED يمنع race conditions)
      let inventoryDeliveredContent: string | null = null;
      if (product.store_type === 'inventory') {
        const { data: rpcResult, error: rpcErr } = await supabase.rpc("reserve_and_deliver_inventory_unit", {
          p_group_id: product.inventory_group_id,
          p_order_id: order.id,
          p_user_id: userId,
          p_product_id: productId
        });
        if (rpcErr || !rpcResult || !rpcResult[0]) {
          // نفدت الكمية بالضبط بين لحظة الفحص ولحظة التنفيذ: نلغي الطلب ونعيد الرصيد المحجوز فعلياً
          await supabase.from("orders").update({ status: "cancelled", admin_response: "نفذت الكمية أثناء المعالجة" }).eq("id", order.id);
          await supabase.from("products").update({ available: false }).eq("id", productId);
          // الطلب أُنشئ وخُصم رصيده فعلياً — نسترجع عبر الدالة الذرّية الوحيدة (idempotent)
          await supabase.rpc("refund_order_once", { p_order_id: order.id });
          return { ok: false, statusCode: 409, error: "نفذت الكمية من هذا المنتج للتو. تم إلغاء الطلب ولم يُخصم أي رصيد." };
        }
        inventoryDeliveredContent = rpcResult[0].content;
        const enrichedMeta = { ...metaData, inventory_delivered: inventoryDeliveredContent };
        await supabase.from("orders").update({ meta: JSON.stringify(enrichedMeta) }).eq("id", order.id);
        await supabase.from("order_items").update({ extra_data: JSON.stringify(enrichedMeta) }).eq("order_id", order.id);
      }
      // ====================================================================

      // [SEC-FIX] الرصيد تم حجزه وخصمه بالفعل بشكل ذرّي أعلاه (deduct_balance_if_sufficient)
      // قبل أي إجراء خارجي — لم نعد بحاجة لخصم إضافي هنا، والإبقاء عليه كان سيُسبب خصماً
      // مضاعفاً غير صحيح بالاعتماد على قيمة user.balance القديمة.
      logActivity(userId, "order", `طلب شراء: ${product.name} بقيمة ${total}`, req);

      // عمولة الإحالة = نسبة من صافي ربح الطلب (وليس من مبلغ الشراء ولا من الشحن)
      if (user.referred_by_id) {
        try {
          const { data: refCommSetting2 } = await supabase.from("settings").select("value").eq("key", "referral_commission").single();
          const refCommRate2 = (parseFloat(refCommSetting2?.value || "5") || 5) / 100;
          const netProfit = computeOrderNetProfit(product, total, safeQty, snapshotCostPrice);
          const commission = Math.round(netProfit * refCommRate2 * 10000) / 10000;
          if (commission > 0) {
            await supabase.rpc("increment_balance", { user_id_param: user.referred_by_id, amount_param: commission });
            await supabase.from("transactions").insert({ user_id: user.referred_by_id, amount: commission, note: `عمولة إحالة (${Math.round(refCommRate2 * 100)}% من صافي ربح الطلب #${order.id})`, status: "approved" });
          }
        } catch (refErr) {
          console.error(`[REFERRAL] فشل حساب/إضافة عمولة الإحالة للطلب #${order.id}:`, refErr);
        }
      }

      // [AGENTS] عمولة الوكيل = نسبة من صافي ربح المتجر في الطلب (مرة واحدة، تُعكس عند الاسترجاع)
      if (user.agent_id) {
        await agentCore.applyAgentCommission({ orderId: order.id, buyerId: userId, agentId: user.agent_id, netProfit: computeOrderNetProfit(product, total, safeQty, snapshotCostPrice) });
      }

      // إشعار فوري للمستخدم إذا تم قبول الطلب لحظياً
      if (ahminixOrderStatus === 'accept' && ahminixReplayApi?.length > 0) {
        const { data: userTg } = await supabase.from("users").select("telegram_chat_id").eq("id", userId).single();
        if (userTg?.telegram_chat_id && userBot) {
          const codes = ahminixReplayApi.filter(Boolean);
          userBot.sendMessage(
            userTg.telegram_chat_id,
            `✅ تم تنفيذ طلبك فوراً!\n\nالطلب: #ORD${order.id}\nالمنتج: ${product.name}\n\n🎁 بيانات التفعيل:\n${codes.join("\n")}`
          ).catch(() => {});
        }
      }

      // [FIX-ROOT-CAUSE] إشعار بوت الأدمن بالطلب الجديد عبر saraqib-store-admin (هذا السيرفر لا يملك
      // بوت أدمن خاصاً به). لا ننتظر (await) هذا النداء لتجنّب إبطاء استجابة المستخدم؛ أي فشل
      // يُسجَّل فقط في اللوغ عبر notifyAdminServer نفسها.
      const orderTypeLabelUser = providerOrderFailed ? '⚠️ طلب معلّق (فشل API)' : orderMode === 'auto' ? '🌐 طلب تلقائي' : '⏳ طلب ينتظر الموافقة';
      const externalInfoUser = ahminixOrderId ? `\nرقم طلب المزود: ${ahminixOrderId}\nالحالة لدى المزود: ${ahminixOrderStatus}` : (providerOrderFailed ? `\nسبب التعليق: ${providerFailReason}` : '');
      const sourceLabelUser = source === "external_api" ? "🔌 API خارجي (نظام طرف ثالث)" : "🌐 الموقع/البوت";
      const orderDateStrUser = order.created_at ? new Date(order.created_at).toLocaleString("ar-EG") : new Date().toLocaleString("ar-EG");
      const extraDataStrUser = formatOrderExtraDataForBot(metaData);
      const orderAdminMsg = [
        `${orderTypeLabelUser} #ORD${order.id}`,
        "",
        `👤 العميل: ${user.name}`,
        `🔢 رقم الدخول: #${user.id}`,
        `📦 المنتج: ${product.name} (#${product.id})`,
        `💵 الإجمالي: ${total}`,
        `📌 الحالة: ${initialStatus === 'pending_admin' ? '⏳ قيد المراجعة' : orderTypeLabelUser}`,
        `🗓️ التاريخ: ${orderDateStrUser}`,
        `🌐 المصدر: ${sourceLabelUser}`,
        `📋 بيانات إضافية: ${extraDataStrUser}`,
      ].join("\n") + `${externalInfoUser}${initialStatus === 'pending_admin' ? '\n\n⚠️ يحتاج موافقتك من لوحة التحكم' : ''}`;
      notifyAdminServer("new_orders", orderAdminMsg, "order", order.id).catch(() => {});

      if (source === "external_api") {
        triggerOrderWebhook(order.id, initialStatus).catch(() => {});
      }

      return {
        ok: true,
        body: {
          success: true,
          orderId: order.id,
          orderMode,
          pendingAdmin: initialStatus === 'pending_admin',
          status: initialStatus,
          price: total,
          productName: product.name,
          ...(providerOrderFailed ? { providerFailed: true, providerFailReason } : {}),
          ...(ahminixOrderId ? {
            externalOrderId: ahminixOrderId,
            externalStatus: ahminixOrderStatus,
            replayApi: ahminixReplayApi
          } : {}),
          ...(inventoryDeliveredContent ? {
            inventoryDelivered: inventoryDeliveredContent
          } : {})
        }
      };
    } catch (e: any) {
      // [FIX] لوغ مفصّل لسبب فشل إنشاء الطلب: الرسالة الحقيقية + تفاصيل الكائن (Supabase/PostgREST) + stack
      const errMsg = e?.message || (typeof e === "object" ? JSON.stringify(e) : String(e));
      console.error(
        `[ORDER CREATE ERROR] ${new Date().toISOString()} | userId=${userId} productId=${productId}\n` +
        `  → السبب: ${errMsg}` +
        (e?.details || e?.hint || e?.code ? `\n  → تفاصيل: ${JSON.stringify({ details: e?.details, hint: e?.hint, code: e?.code })}` : "") +
        (e?.stack ? `\n  → Stack:\n${e.stack}` : "")
      );
      // [SEC-FIX] خصم بلا إرجاع (money-loss): لو كان الرصيد قد خُصم قبل حدوث هذا الاستثناء
      // (مثل TypeError: fetch failed عند الاتصال بالمزوّد) فالمسارات المُعالَجة أعلاه استدعت
      // refundReservedBalance() بنفسها، لكن هذا المسار العام لم يكن يفعل ذلك — فيبقى الرصيد
      // مخصوماً للأبد دون أي طلب ناجح يقابله.
      if (balanceReserved) {
        try {
          await supabase.rpc("increment_balance", { user_id_param: userId, amount_param: total });
          console.error(`[ORDER] تم إرجاع الرصيد المحجوز (${total}$) لمستخدم ${userId} بعد فشل غير متوقع`);
        } catch (refundErr) {
          console.error(`[ORDER] ❌ فشل إرجاع الرصيد المحجوز (${total}$) لمستخدم ${userId}! يتطلب تدخلاً يدوياً فورياً.`, refundErr);
          void sendSecurityTelegramAlert(
            `🚨 <b>خصم رصيد بلا إرجاع — تدخل يدوي فوري مطلوب</b>\nuserId=${userId} productId=${productId} amount=${total}$\nفشل إنشاء الطلب وفشل الإرجاع التلقائي أيضاً.`
          );
        }
        return { ok: false, statusCode: 500, error: errMsg ? "حدث خطأ غير متوقع، تم إرجاع رصيدك بالكامل. يرجى المحاولة مرة أخرى." : "فشل إنشاء الطلب، تم إرجاع رصيدك. يرجى المحاولة مرة أخرى." };
      }
      return { ok: false, statusCode: 500, error: errMsg || "فشل إنشاء الطلب، يرجى المحاولة مرة أخرى", details: e };
    }
  }

  function isOrderError(r: CreateOrderResult): r is Extract<CreateOrderResult, { ok: false }> {
    return r.ok === false;
  }

  app.post("/api/orders", authenticate, orderLimiter, async (req, res) => {
    try {
      // userId يؤخذ من JWT فقط
      const userId = (req as any).userId;
      const { productId, quantity, extraData } = req.body;
      const result = await createOrderCore(userId, productId, quantity, extraData, "user", req);
      if (isOrderError(result)) {
        // [SEC-FIX] CWE-209: لا نُعيد result.details للعميل — قد يحتوي استجابة مزوّد خارجي خام
        // أو كائن استثناء داخلي (تفاصيل قاعدة بيانات). التفاصيل تُسجَّل داخلياً فقط (console.error
        // ضمن createOrderCore)، والعميل يحصل على رسالة الخطأ النصية الآمنة فقط.
        if (result.details !== undefined) {
          console.error(`[ORDER][/api/orders] تفاصيل داخلية (لا تُرسَل للعميل):`, JSON.stringify(result.details));
        }
        return res.status(result.statusCode).json({ error: result.error });
      }
      // نفس شكل الاستجابة الذي كان يُعاد سابقاً من هذا المسار — لا تغيير في السلوك للمستخدمين الحاليين
      const { status, price, productName, ...rest } = result.body;
      return res.json(rest);
    } catch (e: any) {
      safeError(res, e, "فشل إنشاء الطلب، تحقق من بيانات الطلب وحاول مجدداً");
    }
  });


  // =================== CLIENT API (external integrations via api-token) ===================
  function mapOrderErrorToApiCode(msg: string): number {
    if (!msg) return 500;
    if (msg.includes("الرصيد غير كافٍ")) return 100;
    if (msg.includes("نفذت الكمية")) return 105;
    if (msg.includes("أقل كمية مسموح بها")) return 112;
    if (msg.includes("أكبر كمية مسموح بها")) return 113;
    if (
      msg.includes("معرف المنتج غير صحيح") ||
      msg.includes("الكمية غير صحيحة") ||
      msg.includes("يتطلب معرف اللاعب") ||
      msg.includes("غير موجود") ||
      msg.includes("غير مرتبط بمخزون")
    ) return 114;
    return 500;
  }

  const clientApiRouter = express.Router();
  clientApiRouter.use(apiActivityLogger, apiTokenAuth, dynamicClientApiLimiter);

  clientApiRouter.get("/profile", async (req, res) => {
    try {
      const apiUserId = (req as any).apiUserId;
      const { data: user, error } = await supabase.from("users").select("balance, email").eq("id", apiUserId).single();
      if (error) throw error;
      res.json({ status: "OK", balance: user?.balance ?? 0, email: user?.email ?? null });
    } catch (e: any) {
      safeError(res, e, "فشل إنشاء الطلب، تحقق من بيانات الطلب وحاول مجدداً");
    }
  });

  const mapProductForClientApi = (p: any, base: boolean, discountPercent = 0) => {
    if (base) return { id: p.id, name: p.name };
    let params: any = null;
    try { params = p.custom_fields ? (typeof p.custom_fields === "string" ? JSON.parse(p.custom_fields) : p.custom_fields) : null; } catch { params = null; }
    const rawPrice = parseFloat(p.price) || 0;
    const finalPrice = discountPercent > 0 ? +(rawPrice * (1 - discountPercent / 100)).toFixed(2) : p.price;
    return {
      id: p.id,
      name: p.name,
      price: finalPrice,
      params,
      category_name: p?.subcategories?.categories?.name || null,
      available: !!p.available,
      qty_values: { min: p.min_quantity || 1, max: p.max_quantity ?? null },
      product_type: p.store_type,
      parent_id: p.sub_sub_category_id || p.subcategory_id || null,
    };
  };

  clientApiRouter.get("/products", async (req, res) => {
    try {
      const tokenId = (req as any).apiTokenId;
      const { products_id, base } = req.query as any;
      const idList = products_id ? String(products_id).split(",").map((x) => x.trim()).filter(Boolean) : [];
      const mkQuery = () => {
        let q: any = supabase.from("products").select("*, subcategories(name, category_id, categories(name))");
        if (idList.length) q = q.in("id", idList);
        return q;
      };
      // [FIX-PAGINATION] جلب مُصفّح: حدّ PostgREST 1000 صف كان يُسقط المنتجات بعد الألف من قائمة الـ API
      let data: any[] = [];
      try {
        data = await fetchAllRowsPaged((f, t) => mkQuery().order("order_index", { ascending: true }).order("id", { ascending: true }).range(f, t));
      } catch (err: any) {
        if (err?.code !== "42703") throw err;
        data = await fetchAllRowsPaged((f, t) => mkQuery().order("id", { ascending: true }).range(f, t));
      }

      const isAllowed = await getTokenAllowanceChecker(tokenId);
      const allowed = (data || []).filter((p: any) => isAllowed(p));
      const apiDiscountFor = await getApiDiscountResolver(tokenId);
      res.json({ status: "OK", data: allowed.map((p: any) => mapProductForClientApi(p, !!base, apiDiscountFor(p))) });
    } catch (e: any) {
      safeError(res, e, "فشل إنشاء الطلب، تحقق من بيانات الطلب وحاول مجدداً");
    }
  });

  clientApiRouter.get("/content/:categoryId", async (req, res) => {
    try {
      const tokenId = (req as any).apiTokenId;
      const categoryId = req.params.categoryId;

      const { data: subSubCategories } = await supabase.from("sub_sub_categories").select("*").eq("subcategory_id", categoryId).order("order_index");
      // [FIX] كان الترتيب غائباً هنا أيضاً (نفس مشكلة استبدال ترتيب الأدمن بترتيب فيزيائي عشوائي)
      const mkContentQuery = () => supabase.from("products").select("*, subcategories(name, category_id, categories(name))").eq("subcategory_id", categoryId);
      let products: any[] = [];
      try {
        products = await fetchAllRowsPaged((f, t) => mkContentQuery().order("order_index", { ascending: true }).order("id", { ascending: true }).range(f, t));
      } catch (err: any) {
        if (err?.code !== "42703") throw err;
        products = await fetchAllRowsPaged((f, t) => mkContentQuery().order("id", { ascending: true }).range(f, t));
      }

      const isAllowedContent = await getTokenAllowanceChecker(tokenId);
      const allowedProducts = (products || []).filter((p: any) => isAllowedContent(p));
      const apiDiscountFor = await getApiDiscountResolver(tokenId);

      res.json({
        status: "OK",
        categories: subSubCategories || [],
        products: allowedProducts.map((p: any) => mapProductForClientApi(p, false, apiDiscountFor(p))),
      });
    } catch (e: any) {
      safeError(res, e, "فشل إنشاء الطلب، تحقق من بيانات الطلب وحاول مجدداً");
    }
  });

  const handleClientNewOrder = async (req: any, res: any) => {
    try {
      const tokenId = (req as any).apiTokenId;
      const apiUserId = (req as any).apiUserId;
      const productId = req.params.productId;
      const src = req.method === "GET" ? req.query : req.body;
      const { qty, playerId, order_uuid, ...extraParams } = src || {};

      if (!isValidId(productId)) return res.status(400).json({ code: 114, message: "Unknown or invalid parameter" });
      if (!(await isProductAllowedForToken(tokenId, productId))) {
        return res.status(403).json({ code: 114, message: "Unknown or invalid parameter" });
      }
      if (!(req as any).apiCanOrder) {
        return res.status(403).json({ code: 122, message: "Not allowed to use API" });
      }
      if (!order_uuid || typeof order_uuid !== "string") {
        return res.status(400).json({ code: 114, message: "order_uuid is required" });
      }

      const ip = getClientIp(req);

      // محاولة إدراج idempotent — عند تعارض UNIQUE(token_id, order_uuid) نُعيد نتيجة الطلب الأصلي بدل تكراره
      const { error: logInsertErr } = await supabase.from("api_orders_log").insert({
        token_id: tokenId, order_uuid, ip_address: ip,
      });

      if (logInsertErr) {
        // تعارض على order_uuid لهذا التوكن → إعادة نفس نتيجة الطلب الأصلي
        const { data: existingLog } = await supabase
          .from("api_orders_log").select("order_id").eq("token_id", tokenId).eq("order_uuid", order_uuid).maybeSingle();
        if (existingLog?.order_id) {
          const { data: existingOrder } = await supabase.from("orders").select("*").eq("id", existingLog.order_id).single();
          if (existingOrder) {
            let meta: any = {};
            try { meta = JSON.parse(existingOrder.meta || "{}"); } catch {}
            return res.json({
              status: "OK",
              data: {
                order_id: existingOrder.id,
                status: existingOrder.status,
                price: existingOrder.total_amount,
                data: meta.inventory_delivered || null,
                replay_api: meta.ahminix_replay || [],
              },
            });
          }
        }
        return res.status(500).json({ code: 500, message: "Unknown error" });
      }

      const extraData = { ...extraParams, playerId };
      const result = await createOrderCore(apiUserId, productId, qty, extraData, "external_api", req);

      if (isOrderError(result)) {
        // لم يُنشأ الطلب — نحذف سجل idempotency لهذا UUID حتى تُقبل إعادة المحاولة لاحقاً
        await supabase.from("api_orders_log").delete().eq("token_id", tokenId).eq("order_uuid", order_uuid);
        const code = mapOrderErrorToApiCode(result.error);
        return res.status(result.statusCode >= 500 ? 500 : (result.statusCode || 400)).json({ code, message: result.error });
      }

      // ربط سجل الـ idempotency بالطلب الفعلي الذي أُنشئ
      await supabase.from("api_orders_log").update({ order_id: result.body.orderId }).eq("token_id", tokenId).eq("order_uuid", order_uuid);

      return res.json({
        status: "OK",
        data: {
          order_id: result.body.orderId,
          status: result.body.status,
          price: result.body.price,
          data: result.body.inventoryDelivered || null,
          replay_api: result.body.replayApi || [],
        },
      });
    } catch (e: any) {
      safeError(res, e, "فشل إنشاء الطلب، تحقق من بيانات الطلب وحاول مجدداً");
    }
  };

  clientApiRouter.get("/newOrder/:productId", handleClientNewOrder);
  clientApiRouter.post("/newOrder/:productId", handleClientNewOrder);
  clientApiRouter.get("/newOrder/:productId/params", handleClientNewOrder);
  clientApiRouter.post("/newOrder/:productId/params", handleClientNewOrder);

  clientApiRouter.get("/check", async (req, res) => {
    try {
      const tokenId = (req as any).apiTokenId;
      const { orders, uuid } = req.query as any;
      let orderRefs: any[] = [];
      try { orderRefs = JSON.parse(orders || "[]"); } catch { orderRefs = []; }
      if (!Array.isArray(orderRefs)) orderRefs = [];

      const byUuid = String(uuid) === "1";
      const results: any[] = [];

      for (const ref of orderRefs) {
        let orderId: any = null;
        if (byUuid) {
          const { data: logRow } = await supabase
            .from("api_orders_log").select("order_id").eq("token_id", tokenId).eq("order_uuid", String(ref)).maybeSingle();
          orderId = logRow?.order_id || null;
        } else {
          // نتأكد أن الطلب يعود فعلاً لهذا التوكن قبل إعادة أي بيانات عنه
          const { data: logRow } = await supabase
            .from("api_orders_log").select("order_id").eq("token_id", tokenId).eq("order_id", ref).maybeSingle();
          orderId = logRow?.order_id || null;
        }
        if (!orderId) continue;

        const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).single();
        if (!order) continue;
        const { data: item } = await supabase.from("order_items").select("quantity, price_at_purchase, product_id").eq("order_id", orderId).maybeSingle();
        let meta: any = {};
        try { meta = JSON.parse(order.meta || "{}"); } catch {}

        results.push({
          order_id: order.id,
          quantity: item?.quantity ?? null,
          data: meta.inventory_delivered || null,
          created_at: order.created_at,
          product_name: meta.product_name || null,
          price: order.total_amount,
          status: order.status,
          replay_api: meta.ahminix_replay || [],
        });
      }

      res.json({ status: "OK", data: results });
    } catch (e: any) {
      safeError(res, e, "فشل إنشاء الطلب، تحقق من بيانات الطلب وحاول مجدداً");
    }
  });

  app.use("/client/api", clientApiRouter);
  // ==========================================================================================

  // تتبع حالة طلب خارجي للمستخدم (بدون صلاحية أدمن)
  app.get("/api/orders/check-external/:orderId", authenticate, async (req, res) => {
    try {
      const orderId = req.params.orderId;
      const userId = (req as any).userId;

      // جلب طلبات المستخدم قيد المعالجة (processing أو pending)
      const { data: orders } = await supabase
        .from("orders")
        .select("id, meta, total_amount")
        .eq("user_id", userId)
        .in("status", ["processing", "pending"]);

      // نجد الطلب المطابق سواء بـ numeric ID أو UUID
      const matchOrder = (orders || []).find((o: any) => {
        try {
          const m = JSON.parse(o.meta || "{}");
          return String(m.ahminix_order_id) === String(orderId) ||
                 String(m.ahminix_order_uuid) === String(orderId);
        } catch { return false; }
      });

      if (!matchOrder) return res.status(403).json({ error: "غير مسموح أو الطلب غير موجود" });

      const meta = JSON.parse(matchOrder.meta || "{}");
      const ahminixId   = meta.ahminix_order_id;
      const ahminixUuid = meta.ahminix_order_uuid;

      // جلب المزود المرتبط بالطلب
      const providerIdMeta = meta?.provider_id;
      let providerForCheck: any = null;
      if (providerIdMeta) {
        providerForCheck = await getProvider(Number(providerIdMeta));
      }
      if (!providerForCheck) {
        const { data: oi } = await supabase.from("order_items").select("product_id").eq("order_id", matchOrder.id).single();
        if (oi?.product_id) providerForCheck = await getProviderForProduct(oi.product_id);
      }
      if (!providerForCheck) return res.status(500).json({ error: "لا يوجد مزود API مرتبط بهذا الطلب" });

      // دالة الجلب مع fallback UUID → numeric
      const doCheck = async () => {
        let r: any = null;
        if (providerForCheck.provider_type === "megaapi") {
          if (ahminixUuid) {
            r = await megaApiCheckOrderByUuid(providerForCheck.base_url, providerForCheck.api_token, ahminixUuid);
            if (!r?.data?.[0]) r = null;
          }
          if (!r && ahminixId) r = await megaApiCheckOrder(providerForCheck.base_url, providerForCheck.api_token, ahminixId);
        } else {
          if (ahminixUuid && ahminixUuid !== ahminixId) {
            r = await providerCheckOrder(providerForCheck.base_url, providerForCheck.api_token, ahminixUuid, true);
            if (r?.status !== "OK" || !r?.data?.[0]) r = null;
          }
          if (!r && ahminixId) {
            r = await providerCheckOrder(providerForCheck.base_url, providerForCheck.api_token, ahminixId, String(ahminixId).includes("-"));
          }
        }
        return r;
      };

      // استخدام getFinalOrderStatus مع إعادة محاولة قبل الحكم بالرفض
      const { status: newStatus, raw: rawStatus, data: ext } = await getFinalOrderStatus(doCheck, 3, 1500);

      if (!ext) return res.json({ status: "processing", replay_api: [] });

      const normalizedReplay = normalizeReplayApi(ext.replay_api);

      // تحديث DB فقط إذا الحالة نهائية
      if (newStatus === "completed" || newStatus === "cancelled") {
        const updatedMeta = {
          ...meta,
          ahminix_status: rawStatus,
          ahminix_replay: normalizedReplay,
          completed_at: new Date().toISOString()
        };
        await supabase.from("orders").update({
          status: newStatus,
          meta: JSON.stringify(updatedMeta)
        }).eq("id", matchOrder.id);

        if (newStatus === "cancelled") {
          // [FIX double-refund] استرجاع ذرّي وحيد (idempotent) عبر دالة واحدة تقفل صف الطلب
          // وتعتمد العمود refunded_at — تمنع الاسترجاع المزدوج بين كل المسارات والعمليتين.
          await supabase.rpc("refund_order_once", { p_order_id: matchOrder.id });
        }

        const notifTitle = newStatus === "completed" ? "✅ تم تنفيذ طلبك!" : "❌ تم إلغاء طلبك";
        const notifBody = newStatus === "completed"
          ? `تم تنفيذ طلب ${meta?.product_name || ""} بنجاح`
          : `تم إلغاء الطلب وإعادة رصيدك`;
        await sendPushNotification(String(userId), notifTitle, notifBody, "/");
        await supabase.from("notifications").insert({
          user_id: userId, title: notifTitle, message: notifBody,
          type: newStatus === "completed" ? "success" : "warning"
        });
      }

      res.json({ status: rawStatus || "processing", replay_api: normalizedReplay });
    } catch (e: any) {
      safeError(res, e, "فشل التحقق من حالة الطلب الخارجي");
    }
  });

  app.get("/api/orders/user/:userId", authenticate, async (req, res) => {
    if (String((req as any).userId) !== String(req.params.userId)) {
      return res.status(403).json({ error: "ممنوع" });
    }
    try {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          order_items(
            *,
            products(
              name, image_url, store_type,
              subcategories(
                name,
                categories(name)
              )
            )
          )
        `)
        .eq("user_id", req.params.userId)
        .order("created_at", { ascending: false });
      if (error) throw error;

      // flatten to add product_name, category_name, subcategory_name at top level
      const enriched = (data || []).map((order: any) => {
        const item = order.order_items?.[0];
        const product = item?.products;
        let orderMeta: any = {};
        try { orderMeta = JSON.parse(order.meta || "{}"); } catch {}
        return {
          ...order,
          product_name: product?.name || "منتج محذوف",
          category_name: product?.subcategories?.categories?.name || null,
          subcategory_name: product?.subcategories?.name || null,
          response_time_seconds: typeof orderMeta?.response_time_seconds === "number" ? orderMeta.response_time_seconds : null,
        };
      });

      res.json(enriched);
    } catch (e: any) {
      res.json([]);
    }
  });


  // =================== LEADERBOARD ===================

  /**
   * GET /api/leaderboard/:type
   * types: topup | referral | activity
   * Returns top 20 users for each category (lifetime, no prizes)
   */
  // كل تبويب يُقرأ مباشرة من عرضه المادي الخاص المنفصل تماماً (mv_leaderboard_*)
  // العروض المادية تُحسب بالكامل داخل قاعدة البيانات وتُحدَّث تلقائياً كل 10 دقائق عبر pg_cron
  app.get("/api/leaderboard/:type", async (req, res) => {
    try {
      const { type } = req.params;

      if (type === "topup") {
        // أكثر الأشخاص شحناً للرصيد (إجمالي مدى الحياة) — من mv_leaderboard_topup
        const { data, error } = await supabase
          .from("mv_leaderboard_topup")
          .select("user_id, name, avatar_url, profile_badge, total_recharge_sum")
          .order("total_recharge_sum", { ascending: false })
          .limit(20);
        if (error) throw error;
        const result = (data || []).map((row: any, i: number) => ({
          rank: i + 1,
          user_id: row.user_id,
          name: row.name || "مجهول",
          avatar_url: row.avatar_url || "",
          badge: row.profile_badge,
          value: `${parseFloat(row.total_recharge_sum || 0).toFixed(2)}`,
          unit: "$"
        }));
        return res.json(result);

      } else if (type === "referral") {
        // أكثر الأشخاص إحالةً — من mv_leaderboard_referral
        const { data, error } = await supabase
          .from("mv_leaderboard_referral")
          .select("user_id, name, avatar_url, profile_badge, referral_count")
          .order("referral_count", { ascending: false })
          .limit(20);
        if (error) throw error;
        const result = (data || []).map((row: any, i: number) => ({
          rank: i + 1,
          user_id: row.user_id,
          name: row.name || "مجهول",
          avatar_url: row.avatar_url || "",
          badge: row.profile_badge,
          value: `${row.referral_count || 0}`,
          unit: "إحالة"
        }));
        return res.json(result);

      } else if (type === "activity") {
        // أكثر الأشخاص نشاطاً (طلبات مكتملة فعلياً) — من mv_leaderboard_activity
        const { data, error } = await supabase
          .from("mv_leaderboard_activity")
          .select("user_id, name, avatar_url, profile_badge, completed_orders")
          .order("completed_orders", { ascending: false })
          .limit(20);
        if (error) throw error;
        const result = (data || []).map((row: any, i: number) => ({
          rank: i + 1,
          user_id: row.user_id,
          name: row.name || "مجهول",
          avatar_url: row.avatar_url || "",
          badge: row.profile_badge,
          value: `${row.completed_orders || 0}`,
          unit: "طلب مكتمل"
        }));
        return res.json(result);

      } else {
        return res.status(400).json({ error: "نوع غير معروف" });
      }
    } catch (e: any) {
      safeError(res, e, "فشل تحميل قائمة المتصدرين");
    }
  });


  // Auto-verify transaction for Syriatel/ShamCash
  // ===================== شام كاش: نظام الفواتير (Invoices) =====================
  // GET /api/transactions/shamcash-invoice/pending — يتحقق إن كان للمستخدم الحالي فاتورة شام كاش
  // معلّقة سارية الصلاحية بعد، ليتمكن من العودة إليها (مثلاً بعد تحديث الصفحة أو إعادة فتح
  // المحفظة) بدل أن يضطر لبدء فاتورة جديدة أو يخسر الفاتورة التي أنشأها فعلاً.
  app.get("/api/transactions/shamcash-invoice/pending", authenticate, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const pending = await findActivePendingShamCashInvoice(userId);
      if (!pending) return res.json({ pending: false });
      ensurePendingInvoiceNotification(userId, pending.invoiceNumber, pending.amount, pending.currency).catch(() => {});
      res.json({ pending: true, ...pending });
    } catch (e: any) { safeError(res, e); }
  });

  // POST /api/transactions/shamcash-invoice — يُنشئ فاتورة شام كاش + حجز محلي pending_verification
  // يُستدعى بعد اختيار المستخدم لطريقة الدفع وإدخال المبلغ، قبل إدخال رقم العملية.
  app.post("/api/transactions/shamcash-invoice", authenticate, uploadLimiter, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { paymentMethodId, amount } = req.body;
      if (!paymentMethodId || !amount) return res.status(400).json({ error: "بيانات ناقصة" });
      if (!isValidId(paymentMethodId)) return res.status(400).json({ error: "طريقة دفع غير صحيحة" });
      { const idBlock = await identityGate(userId, paymentMethodId); if (idBlock) return res.status(403).json({ error: idBlock, code: "IDENTITY_REQUIRED" }); }

      // [RESUME] إن كانت للمستخدم فاتورة معلّقة سارية بالفعل، نُعيدها كما هي بدل إنشاء فاتورة
      // وحجز "قيد التحقق" جديدين — يمنع تكدّس عدة حجوزات معلّقة لمستخدم واحد ويتيح له إكمال
      // فاتورته القديمة بمجرد إعادة محاولة الشحن.
      const resumable = await findActivePendingShamCashInvoice(userId);
      if (resumable) {
        ensurePendingInvoiceNotification(userId, resumable.invoiceNumber, resumable.amount, resumable.currency).catch(() => {});
        return res.json({
          success: true,
          resumed: true,
          invoiceNumber: resumable.invoiceNumber,
          expiresAt: resumable.expiresAt,
          createdAt: resumable.createdAt,
          walletAddress: resumable.walletAddress,
          amount: resumable.amount,
          currency: resumable.currency,
          paymentMethodId: resumable.paymentMethodId,
        });
      }

      const { data: method } = await supabase.from("payment_methods")
        .select("name, method_type, wallet_address, min_amount, payment_currency, currency_id, bonus_type, bonus_percent")
        .eq("id", paymentMethodId).single();

      const gatewayCode = INVOICE_ELIGIBLE_METHOD_TYPES[method?.method_type as string];
      if (!method || !gatewayCode) {
        return res.status(400).json({ error: "طريقة الدفع هذه لا تدعم نظام الفواتير" });
      }

      const cfg = await getGatewayConfig(gatewayCode);
      if (!cfg || cfg.verification_mode !== "invoices") {
        return res.status(400).json({ error: "هذه الطريقة تستخدم النظام القديم (جلب المعاملات) وليس نظام الفواتير" });
      }
      if (!method.wallet_address) {
        return res.status(400).json({ error: "لا يوجد عنوان محفظة مرتبط بطريقة الدفع هذه. راجع الإدارة." });
      }

      const maxAmount = 50000000; // نفس سقف verify-auto — يُعاد التحقق لاحقاً بحسب العملة الفعلية
      if (!isValidAmount(amount, 0.01, maxAmount)) return res.status(400).json({ error: "المبلغ غير صحيح" });
      const numAmount = parseFloat(String(amount));

      // تحديد عملة المحفظة الفعلية (نفس منطق verify-auto) — لازمة لتحديد عملة الفاتورة ومنع EUR
      let walletCurrency: { name: string; symbol: string; exchange_rate: number } | null = null;
      if (method.currency_id) {
        const { data: curRow, error: curErr } = await supabase
          .from("currencies").select("name, symbol, exchange_rate, is_active").eq("id", method.currency_id).maybeSingle();
        if (curErr || !curRow || !curRow.is_active) {
          return res.status(422).json({ error: "عملة المحفظة المرتبطة بطريقة الدفع هذه غير مفعّلة أو غير موجودة." });
        }
        const rate = parseFloat(String(curRow.exchange_rate));
        if (!rate || isNaN(rate) || rate <= 0) {
          return res.status(422).json({ error: `لا يوجد سعر صرف صالح للعملة "${curRow.name}".` });
        }
        walletCurrency = { name: curRow.name, symbol: curRow.symbol, exchange_rate: rate };
      } else {
        walletCurrency = { name: "الدولار الأمريكي", symbol: "$", exchange_rate: 1 };
      }
      const curNameUp = walletCurrency.name.toUpperCase();
      const curSymUp = (walletCurrency.symbol || "").toUpperCase();
      const isSyp = curNameUp === "SYP" || curNameUp.includes("ليرة") || curNameUp.includes("سوري") || curSymUp === "SYP" || curSymUp.includes("ل.س");
      const isUsd = curNameUp === "USD" || curNameUp.includes("دولار") || curSymUp === "USD" || curSymUp === "$";
      let invoiceCurrency: "SYP" | "USD";
      if (gatewayCode === "syriatelcash") {
        if (!isSyp) return res.status(422).json({ error: `طريقة الدفع هذه (سيرياتيل كاش) تقبل فقط عملة الليرة السورية (ل.س). العملة الحالية "${walletCurrency.name}" غير مسموحة.` });
        invoiceCurrency = "SYP";
      } else if (gatewayCode === "crypto_usdt_trc20" || gatewayCode === "crypto_usdt_bep20") {
        if (!isUsd) return res.status(422).json({ error: `طريقة الدفع هذه تقبل فقط الدولار ($) كمكافئ لـ USDT. العملة الحالية "${walletCurrency.name}" غير مسموحة.` });
        invoiceCurrency = "USD";
      } else {
        if (!isSyp && !isUsd) {
          return res.status(422).json({ error: `عملة الفواتير تدعم فقط الدولار ($) أو الليرة السورية (ل.س). العملة الحالية "${walletCurrency.name}" غير مدعومة.` });
        }
        invoiceCurrency = isSyp ? "SYP" : "USD";
      }

      // [FIX] مقارنة الحد الأدنى كانت تقارن numAmount بعملة المحفظة الخام (مثلاً ل.س) مباشرة
      // مع method.min_amount المخزَّن بالدولار دائماً — خلل في الوحدة يسمح بفواتير أقل من الحد
      // الأدنى الحقيقي (عدد كبير من الليرات يتجاوز رقمياً حداً أدنى صغيراً بالدولار رغم كونه أقل
      // قيمةً فعلياً). الإصلاح: نحوّل المبلغ لمكافئه بالدولار أولاً (بعد تحديد سعر الصرف الصحيح
      // أعلاه) ثم نقارنه بالحد الأدنى.
      const numAmountUsdEquivalent = isUsd ? numAmount : numAmount / walletCurrency.exchange_rate;
      if (numAmountUsdEquivalent < (method.min_amount || 0)) {
        return res.status(400).json({ error: `أقل مبلغ للشحن هو ${method.min_amount} $` });
      }

      // مدة صلاحية الفاتورة بالدقائق يضبطها الأدمن عبر نفس حقل max_age_minutes (بحدود 5-1440)
      const expiresInMinutes = Math.max(5, Math.min(1440, cfg.max_age_minutes || 30));

      // حجز محلي بنفس منطق حماية TOCTOU المستخدم في verify-auto — نستخدم رقماً مؤقتاً فريداً
      // كـ tx_number ريثما يُدخل المستخدم tran_id الحقيقي لاحقاً عند التحقق.
      const placeholderTxNumber = `INV_PENDING_${Date.now()}_${userId}_${Math.random().toString(36).slice(2, 8)}`;
      const { data: claimedTx, error: claimErr } = await supabase.from("transactions").insert({
        user_id: userId,
        payment_method_id: paymentMethodId,
        amount: numAmount,
        tx_number: placeholderTxNumber,
        status: "pending_verification",
        note: `حجز مبدئي بانتظار إنشاء فاتورة ${GATEWAY_LABEL_AR[gatewayCode]} والتحقق منها`
      }).select().single();
      if (claimErr) return res.status(400).json({ error: "تعذّر حجز عملية الشحن. حاول مجدداً." });

      const invoiceResult = await createShamCashInvoice(gatewayCode, method.wallet_address, numAmount, invoiceCurrency, expiresInMinutes);
      if (!invoiceResult.ok) {
        const invoiceErrorMsg: string = (invoiceResult as { ok: false; error: string }).error;
        await supabase.from("transactions").delete().eq("id", claimedTx.id).eq("status", "pending_verification");
        return res.status(400).json({ error: invoiceErrorMsg });
      }

      const { error: invInsertErr } = await supabase.from("shamcash_invoices").insert({
        transaction_id: claimedTx.id,
        invoice_number: invoiceResult.invoiceNumber,
        user_id: userId,
        payment_method_id: paymentMethodId,
        amount: numAmount,
        currency: invoiceCurrency,
        status: "pending",
        expires_at: invoiceResult.expiresAt,
        gateway_code: gatewayCode
      });
      if (invInsertErr) {
        // نادر جداً (invoice_number مكرر) — نحرر الحجز المحلي ونطلب من المستخدم إعادة المحاولة
        await supabase.from("transactions").delete().eq("id", claimedTx.id).eq("status", "pending_verification");
        return res.status(500).json({ error: "تعذّر حفظ الفاتورة محلياً. حاول مجدداً." });
      }

      res.json({
        success: true,
        resumed: false,
        invoiceNumber: invoiceResult.invoiceNumber,
        expiresAt: invoiceResult.expiresAt,
        walletAddress: method.wallet_address,
        amount: numAmount,
        currency: invoiceCurrency,
        paymentMethodId: Number(paymentMethodId)
      });
    } catch (e: any) { safeError(res, e); }
  });

  // POST /api/transactions/shamcash-invoice/verify — يُدخل المستخدم tran_id فيتحقق النظام من الفاتورة ويعتمد الشحن
  app.post("/api/transactions/shamcash-invoice/verify", authenticate, uploadLimiter, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { invoiceNumber, tranId } = req.body;
      if (!invoiceNumber || !tranId) return res.status(400).json({ error: "بيانات ناقصة" });
      if (!isValidTxNumber(tranId)) return res.status(400).json({ error: "رقم العملية غير صحيح (أحرف وأرقام فقط)" });

      const { data: inv } = await supabase.from("shamcash_invoices")
        .select("*").eq("invoice_number", invoiceNumber).eq("user_id", userId).single();
      if (!inv) return res.status(404).json({ error: "الفاتورة غير موجودة" });
      { const idBlock = await identityGate(userId, inv.payment_method_id); if (idBlock) return res.status(403).json({ error: idBlock, code: "IDENTITY_REQUIRED" }); }
      if (inv.status !== "pending") {
        const map: Record<string, string> = { paid: "هذه الفاتورة مدفوعة بالفعل.", expired: "انتهت صلاحية هذه الفاتورة.", cancelled: "تم إلغاء هذه الفاتورة." };
        return res.status(409).json({ error: map[inv.status] || "حالة الفاتورة لا تسمح بالتحقق" });
      }

      const gatewayCode = (inv.gateway_code || "shamcash") as GatewayCode;
      const verifyResult = await verifyShamCashInvoice(gatewayCode, invoiceNumber, String(tranId).trim());
      if (!verifyResult.ok) {
        const failedVerify = verifyResult as { ok: false; error: string; code?: string };
        const verifyErrorMsg: string = failedVerify.error;
        const verifyErrorCode: string | undefined = failedVerify.code;
        // نُحدّث الحالة محلياً لتبقى متزامنة عند EXPIRED — بقية الأخطاء تبقى pending ليعيد المستخدم المحاولة
        if (verifyErrorCode === "EXPIRED") {
          await supabase.from("shamcash_invoices").update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", inv.id);
          await supabase.from("transactions").delete().eq("id", inv.transaction_id).eq("status", "pending_verification");
          clearPendingInvoiceNotification(invoiceNumber).catch(() => {});
        }
        return res.status(422).json({ error: verifyErrorMsg, code: verifyErrorCode });
      }

      const { data: method } = await supabase.from("payment_methods")
        .select("name, currency_id, bonus_type, bonus_percent").eq("id", inv.payment_method_id).single();

      let walletCurrency = { name: "الدولار الأمريكي", symbol: "$", exchange_rate: 1 };
      if (method?.currency_id) {
        const { data: curRow } = await supabase.from("currencies").select("name, symbol, exchange_rate").eq("id", method.currency_id).maybeSingle();
        if (curRow) walletCurrency = { name: curRow.name, symbol: curRow.symbol, exchange_rate: parseFloat(String(curRow.exchange_rate)) || 1 };
      }

      const apiAmount = parseFloat(String(inv.amount));
      let finalUsdAmount = (walletCurrency.name.toUpperCase() === "USD" || walletCurrency.symbol === "$")
        ? apiAmount
        : parseFloat((apiAmount / walletCurrency.exchange_rate).toFixed(4));
      const preBonusUsdAmount = finalUsdAmount;
      finalUsdAmount = applyPaymentMethodBonus(finalUsdAmount, method as any);
      if (!finalUsdAmount || isNaN(finalUsdAmount) || finalUsdAmount <= 0) {
        return res.status(422).json({ error: "تعذّر احتساب المبلغ النهائي بالدولار." });
      }

      const { error: txErr } = await supabase.from("transactions")
        .update({
          amount: finalUsdAmount,
          original_amount: preBonusUsdAmount,
          tx_number: tranId,
          bonus_type: (method as any)?.bonus_type || null,
          bonus_percent: (method as any)?.bonus_percent || null,
          status: "approved",
          note: `تحقق تلقائي عبر فاتورة ${GATEWAY_LABEL_AR[gatewayCode]} ${invoiceNumber} - رقم العملية: ${tranId} - المبلغ: ${apiAmount} ${inv.currency}`
        })
        .eq("id", inv.transaction_id)
        .eq("status", "pending_verification");
      if (txErr) throw txErr;

      await supabase.from("shamcash_invoices").update({ status: "paid", updated_at: new Date().toISOString() }).eq("id", inv.id);
      clearPendingInvoiceNotification(invoiceNumber).catch(() => {});

      const { error: incErr } = await supabase.rpc("increment_balance", { user_id_param: userId, amount_param: finalUsdAmount });
      if (incErr) throw incErr;
      await supabase.rpc("add_recharge_sum", { p_user_id: userId, p_amount: finalUsdAmount }).then(({ error }) => { if (error) console.error("[RANKS] add_recharge_sum failed:", error.message); });
      const { data: freshUserRow } = await supabase.from("users").select("balance, name, telegram_chat_id").eq("id", userId).single();
      const newBalance = parseFloat((parseFloat(String(freshUserRow?.balance ?? 0)) || 0).toFixed(4));
      logActivity(userId, "recharge", `شحن رصيد تلقائي (فاتورة ${GATEWAY_LABEL_AR[gatewayCode]}) بقيمة ${finalUsdAmount}$`, req);

      const invoiceAdminMsg = `✅ شحن تلقائي عبر فاتورة ${GATEWAY_LABEL_AR[gatewayCode]}\nالمستخدم: ${freshUserRow?.name || userId}\nرقم الدخول: #${userId}\nالمبلغ: ${apiAmount} ${inv.currency} (${finalUsdAmount}$)\nرقم الفاتورة: ${invoiceNumber}\nرقم العملية: ${tranId}`;
      notifyAdminServer("topup_transactions", invoiceAdminMsg, "topup", inv.transaction_id).catch(() => {});
      if (freshUserRow?.telegram_chat_id) userBot?.sendMessage(freshUserRow.telegram_chat_id, `✅ تم شحن رصيدك بـ ${finalUsdAmount.toFixed(4)}$ عبر فاتورة ${GATEWAY_LABEL_AR[gatewayCode]} بنجاح!`);

      res.json({ success: true, newBalance, addedUsd: finalUsdAmount, originalAmount: apiAmount, currency: inv.currency });
    } catch (e: any) { safeError(res, e); }
  });

  // DELETE /api/transactions/shamcash-invoice/:invoiceNumber — إلغاء فاتورة معلّقة (زر "إلغاء الفاتورة")
  app.delete("/api/transactions/shamcash-invoice/:invoiceNumber", authenticate, uploadLimiter, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const invoiceNumber = String(req.params.invoiceNumber || "");
      const { data: inv } = await supabase.from("shamcash_invoices")
        .select("*").eq("invoice_number", invoiceNumber).eq("user_id", userId).single();
      if (!inv) return res.status(404).json({ error: "الفاتورة غير موجودة" });
      if (inv.status !== "pending") {
        return res.status(409).json({ error: "لا يمكن إلغاء فاتورة ليست بحالة معلّقة" });
      }

      const cancelResult = await cancelShamCashInvoice((inv.gateway_code || "shamcash") as GatewayCode, invoiceNumber);
      // نُحرر الحجز المحلي بغض النظر عن نتيجة الإلغاء لدى شام كاش (قد تكون انتهت بالفعل هناك) —
      // لكن نُبقي الفاتورة نفسها بحالة cancelled محلياً ليعرف المستخدم أنها لم تعد صالحة.
      await supabase.from("shamcash_invoices").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", inv.id);
      await supabase.from("transactions").delete().eq("id", inv.transaction_id).eq("status", "pending_verification");
      clearPendingInvoiceNotification(invoiceNumber).catch(() => {});

      if (!cancelResult.ok) {
        // الإلغاء المحلي تم بنجاح، لكن نُبلغ أن الإلغاء لدى المزوّد قد لا يكون تم (مثلاً الفاتورة انتهت هناك أصلاً)
        return res.json({ success: true, warning: cancelResult.error });
      }
      res.json({ success: true });
    } catch (e: any) { safeError(res, e); }
  });

  // ===================== الشحن التلقائي (Webhook) =====================
  // GET /api/transactions/auto-charge-code/pending — نفس فكرة استئناف الفاتورة المعلّقة
  app.get("/api/transactions/auto-charge-code/pending", authenticate, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { data: row } = await supabase.from("auto_charge_codes")
        .select("*").eq("user_id", userId).eq("status", "pending")
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (!row) return res.json({ pending: false });
      if (new Date(row.expires_at).getTime() < Date.now()) {
        await supabase.from("auto_charge_codes").update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", row.id).eq("status", "pending");
        return res.json({ pending: false });
      }
      const { data: method } = await supabase.from("payment_methods").select("wallet_address").eq("id", row.payment_method_id).maybeSingle();
      res.json({
        pending: true,
        code: row.code,
        walletAddress: method?.wallet_address || "",
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        paymentMethodId: row.payment_method_id,
      });
    } catch (e: any) { safeError(res, e); }
  });

  // POST /api/transactions/auto-charge-code — يولّد رمزاً مميزاً للمستخدم دون أي مبلغ مسبق
  app.post("/api/transactions/auto-charge-code", authenticate, uploadLimiter, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { paymentMethodId } = req.body;
      if (!paymentMethodId || !isValidId(paymentMethodId)) return res.status(400).json({ error: "طريقة دفع غير صحيحة" });
      { const idBlock = await identityGate(userId, paymentMethodId); if (idBlock) return res.status(403).json({ error: idBlock, code: "IDENTITY_REQUIRED" }); }

      // [RESUME] إن وُجد رمز فعّال سارٍ بالفعل لهذا المستخدم، نُعيده كما هو بدل توليد رمز جديد
      const { data: existing } = await supabase.from("auto_charge_codes")
        .select("*").eq("user_id", userId).eq("status", "pending")
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (existing && new Date(existing.expires_at).getTime() > Date.now()) {
        const { data: existingMethod } = await supabase.from("payment_methods").select("wallet_address").eq("id", existing.payment_method_id).maybeSingle();
        return res.json({
          success: true, resumed: true,
          code: existing.code,
          walletAddress: existingMethod?.wallet_address || "",
          expiresAt: existing.expires_at,
          createdAt: existing.created_at,
          paymentMethodId: existing.payment_method_id,
        });
      }

      const { data: method } = await supabase.from("payment_methods")
        .select("method_type, wallet_address").eq("id", paymentMethodId).single();
      const gatewayCode = INVOICE_ELIGIBLE_METHOD_TYPES[method?.method_type as string];
      if (!method || !gatewayCode) {
        return res.status(400).json({ error: "طريقة الدفع هذه لا تدعم الشحن التلقائي" });
      }
      const cfg = await getGatewayConfig(gatewayCode);
      if (!cfg || cfg.verification_mode !== "webhook") {
        return res.status(400).json({ error: "هذه الطريقة لا تستخدم نظام الشحن التلقائي حالياً" });
      }
      if (!method.wallet_address) {
        return res.status(400).json({ error: "لا يوجد عنوان محفظة مرتبط بطريقة الدفع هذه. راجع الإدارة." });
      }

      // [SEC] مدة صلاحية الرمز ثابتة 10 دقائق دائماً — لا تعتمد على max_age_minutes
      // لتبقى نافذة قبول الرمز قصيرة بغض النظر عن إعدادات أخرى قد يغيّرها الأدمن لاحقاً
      const AUTO_CHARGE_CODE_EXPIRY_MINUTES = 10;
      const expiresAt = new Date(Date.now() + AUTO_CHARGE_CODE_EXPIRY_MINUTES * 60_000).toISOString();

      // [SEC] تصادم الرمز شبه مستحيل إحصائياً (62^7) لكن نحاول عدة مرات احتياطاً فقط —
      // الفرادة الفعلية مضمونة ذرّياً عبر فهرس UNIQUE جزئي (status='pending') بقاعدة البيانات.
      let inserted: any = null;
      for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
        const code = generateAutoChargeCode();
        const { data, error } = await supabase.from("auto_charge_codes").insert({
          code, user_id: userId, payment_method_id: paymentMethodId, gateway_code: gatewayCode,
          status: "pending", expires_at: expiresAt,
        }).select().single();
        if (!error) inserted = data;
        // خطأ تعارض على الفهرس الفريد = رمز مستخدم حالياً من مستخدم آخر — نعيد المحاولة برمز جديد
      }
      if (!inserted) return res.status(500).json({ error: "تعذّر توليد رمز فريد. حاول مجدداً." });

      res.json({
        success: true, resumed: false,
        code: inserted.code,
        walletAddress: method.wallet_address,
        expiresAt: inserted.expires_at,
        createdAt: inserted.created_at,
        paymentMethodId: Number(paymentMethodId),
      });
    } catch (e: any) { safeError(res, e); }
  });

  // GET /api/transactions/auto-charge-code/:code/status — استطلاع دوري من الواجهة لمعرفة لحظة الاعتماد
  app.get("/api/transactions/auto-charge-code/:code/status", authenticate, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const code = String(req.params.code || "");
      const { data: row } = await supabase.from("auto_charge_codes")
        .select("*").eq("code", code).eq("user_id", userId).single();
      if (!row) return res.status(404).json({ error: "الرمز غير موجود" });

      if (row.status === "pending" && new Date(row.expires_at).getTime() < Date.now()) {
        await supabase.from("auto_charge_codes").update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", row.id).eq("status", "pending");
        return res.json({ status: "expired" });
      }
      if (row.status === "used") {
        let newBalance: number | null = null;
        if (row.transaction_id) {
          const { data: user } = await supabase.from("users").select("balance").eq("id", userId).single();
          newBalance = user ? parseFloat((parseFloat(String(user.balance ?? 0)) || 0).toFixed(4)) : null;
        }
        return res.json({ status: "used", matchedAmount: row.matched_amount, matchedCurrency: row.matched_currency, newBalance });
      }
      res.json({ status: row.status });
    } catch (e: any) { safeError(res, e); }
  });

  // DELETE /api/transactions/auto-charge-code/:code — إلغاء رمز معلّق (زر "إلغاء")
  app.delete("/api/transactions/auto-charge-code/:code", authenticate, uploadLimiter, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const code = String(req.params.code || "");
      const { data: casRows, error } = await supabase.from("auto_charge_codes")
        .update({ status: "cancelled", updated_at: new Date().toISOString() })
        .eq("code", code).eq("user_id", userId).eq("status", "pending")
        .select("id");
      if (error) throw error;
      if (!Array.isArray(casRows) || casRows.length === 0) {
        return res.status(409).json({ error: "لا يمكن إلغاء رمز ليس بحالة معلّقة" });
      }
      res.json({ success: true });
    } catch (e: any) { safeError(res, e); }
  });

  // POST /api/transactions/auto-charge-code/:code/verify-manual — زر "هل فشل التحقق؟": تحقق يدوي
  // برقم العملية (tran_id) عندما لا يصل Webhook تلقائياً لأي سبب (تأخير شبكة، تعطّل مؤقت لدى
  // مزوّد الدفع، إلخ). الضمانة الأمنية: يتحقق من تطابق ملاحظة التحويل (note) مع رمز الشحن
  // حرفياً بين ملاحظة التحويل (note) ورمز الشحن المملوك فعلياً لطالب الطلب — لا يكتفي بوجود
  // العملية في المحفظة، بل يضمن أنها مقصودة لهذا المستخدم بالذات.
  app.post("/api/transactions/auto-charge-code/:code/verify-manual", authenticate, autoChargeVerifyLimiter, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const code = String(req.params.code || "");
      const { tranId } = req.body;
      if (!code || !/^[0-9]{6}$/.test(code)) return res.status(400).json({ error: "رمز شحن غير صحيح" });
      if (!tranId || !isValidTxNumber(tranId)) {
        return res.status(400).json({ error: "رقم العملية غير صحيح (أحرف وأرقام و - و _ فقط)" });
      }

      const { data: codeRow } = await supabase.from("auto_charge_codes")
        .select("*").eq("code", code).eq("user_id", userId).eq("status", "pending").maybeSingle();
      if (!codeRow) return res.status(404).json({ error: "لا يوجد رمز شحن معلّق بهذا الرقم. أنشئ رمزاً جديداً." });
      { const idBlock = await identityGate(userId, codeRow.payment_method_id); if (idBlock) return res.status(403).json({ error: idBlock, code: "IDENTITY_REQUIRED" }); }

      if (new Date(codeRow.expires_at).getTime() < Date.now()) {
        await supabase.from("auto_charge_codes").update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", codeRow.id).eq("status", "pending");
        return res.status(409).json({ error: "انتهت صلاحية رمز الشحن هذا (10 دقائق). أنشئ رمزاً جديداً." });
      }

      const { data: method } = await supabase.from("payment_methods").select("wallet_address").eq("id", codeRow.payment_method_id).maybeSingle();
      if (!method?.wallet_address) return res.status(400).json({ error: "لا يوجد عنوان محفظة مرتبط بطريقة الدفع هذه. راجع الإدارة." });

      const gatewayCode = codeRow.gateway_code as GatewayCode;
      const lookup = await verifySybclintTxById(gatewayCode, method.wallet_address, String(tranId).trim());
      if (lookup.invalid) return res.status(400).json({ error: "رقم العملية غير صالح." });
      if (!lookup.found || !lookup.transaction) {
        return res.status(404).json({ error: "لم يتم العثور على هذه العملية في المحفظة بعد. تأكد من رقم العملية أو انتظر قليلاً وأعد المحاولة." });
      }

      const tx = lookup.transaction;
      if (String(tx.type || "").toLowerCase() !== "credit") {
        return res.status(422).json({ error: "هذه العملية ليست تحويلاً وارداً." });
      }
      const note = String(tx.note || "").trim();
      if (note !== codeRow.code) {
        return res.status(422).json({ error: "رقم العملية هذا لا يحتوي على رمز الشحن الصحيح في ملاحظة التحويل. تأكد أنك وضعت الرمز بالضبط." });
      }

      // [SEC] اعتماد ذرّي بنفس آلية الويبهوك — يمنع الاعتماد المضاعف لو استُدعي هذا المسار أكثر من
      // مرة بالتزامن، أو وصل Webhook لنفس الحدث بالتوازي مع هذا الطلب اليدوي.
      const { data: casRows } = await supabase.from("auto_charge_codes")
        .update({ status: "used", matched_amount: tx.amount, matched_currency: String(tx.currency || "").toUpperCase(), updated_at: new Date().toISOString() })
        .eq("id", codeRow.id).eq("status", "pending")
        .select("id");
      if (!Array.isArray(casRows) || casRows.length === 0) {
        return res.status(409).json({ error: "تم اعتماد هذا الرمز بالفعل (عبر الويبهوك الآلي على الأرجح)." });
      }

      await creditAutoChargeCode(codeRow, { id: tx.tran_id, type: "credit", amount: tx.amount, currency: tx.currency }, gatewayCode);

      const { data: freshUser } = await supabase.from("users").select("balance").eq("id", userId).single();
      res.json({
        success: true,
        newBalance: freshUser ? parseFloat((parseFloat(String(freshUser.balance ?? 0)) || 0).toFixed(4)) : null,
      });
    } catch (e: any) { safeError(res, e); }
  });

  // POST /api/webhooks/sybclint/:secret — نقطة استقبال عامة (بلا auth) لإشعارات المعاملات من sybclint
  // السر بالمسار هو طبقة الحماية الوحيدة (لا توقيع HMAC متاح بالتوثيق) — رفض فوري بمقارنة ثابتة الزمن.
  /** يعتمد رمز شحن تلقائي بعد مطابقته (الحالة انتقلت لـ "used" ذرّياً بالفعل قبل استدعاء هذه الدالة) —
   * يتحقق من تطابق عملة التحويل الفعلية مع عملة طريقة الدفع المُعدَّة، ثم يشحن الرصيد أو يُبقي
   * العملية معلّقة لمراجعة يدوية عند عدم التطابق (أموال حقيقية وصلت، لا تُهمَل أبداً بصمت). */
  async function creditAutoChargeCode(codeRow: any, tx: any, gatewayCode: GatewayCode): Promise<void> {
    // طلب وهمي آمن لـ logActivity — الطلب الحقيقي هنا هو طلب sybclint نفسه (IP/جهاز خادمهم)
    // وليس جهاز المستخدم الفعلي، فتسجيله كـ"نشاط المستخدم" يكون مضلِّلاً.
    const pseudoReq = { headers: {} } as any;

    const { data: method } = await supabase.from("payment_methods")
      .select("name, currency_id, bonus_type, bonus_percent").eq("id", codeRow.payment_method_id).single();

    let walletCurrency = { name: "الدولار الأمريكي", symbol: "$", exchange_rate: 1 };
    if (method?.currency_id) {
      const { data: curRow } = await supabase.from("currencies").select("name, symbol, exchange_rate").eq("id", method.currency_id).maybeSingle();
      if (curRow) walletCurrency = { name: curRow.name, symbol: curRow.symbol, exchange_rate: parseFloat(String(curRow.exchange_rate)) || 1 };
    }
    const curNameUp = walletCurrency.name.toUpperCase();
    const curSymUp = (walletCurrency.symbol || "").toUpperCase();
    const isSyp = curNameUp === "SYP" || curNameUp.includes("ليرة") || curNameUp.includes("سوري") || curSymUp === "SYP" || curSymUp.includes("ل.س");
    const isUsd = curNameUp === "USD" || curNameUp.includes("دولار") || curSymUp === "USD" || curSymUp === "$";
    const expectedCurrency = isSyp ? "SYP" : "USD";

    let txCurrency = String(tx.currency || "").toUpperCase();
    if ((gatewayCode === "crypto_usdt_trc20" || gatewayCode === "crypto_usdt_bep20") && txCurrency === "USDT") txCurrency = "USD";
    const txAmount = Math.abs(parseFloat(String(tx.amount || "0")));

    if (txCurrency !== expectedCurrency || !(txAmount > 0)) {
      // عملة غير متوقعة أو مبلغ غير صالح — نُسجّلها معلّقة لمراجعة يدوية بدل تجاهل أموال وصلت فعلاً
      const { data: pendingTx } = await supabase.from("transactions").insert({
        user_id: codeRow.user_id,
        payment_method_id: codeRow.payment_method_id,
        amount: 0,
        tx_number: `AUTO_${codeRow.code}_${tx.id ?? Date.now()}`,
        status: "pending",
        note: `[مراجعة يدوية] شحن تلقائي عبر رمز ${codeRow.code} — عملة واردة (${txCurrency || "?"}) لا تطابق عملة طريقة الدفع (${expectedCurrency})، المبلغ الوارد: ${tx.amount} ${tx.currency}`,
      }).select().single();
      await supabase.from("auto_charge_codes").update({ transaction_id: pendingTx?.id || null, updated_at: new Date().toISOString() }).eq("id", codeRow.id);
      notifyAdminServer("system_alerts", `⚠️ وصلت حوالة شحن تلقائي (${GATEWAY_LABEL_AR[gatewayCode]}) برمز صحيح (${codeRow.code}) لكن بعملة غير متوقعة (${txCurrency || "?"} بدل ${expectedCurrency}) — تحتاج مراجعة يدوية فورية. المستخدم #${codeRow.user_id}، المبلغ: ${tx.amount} ${tx.currency}`, "topup").catch(() => {});
      return;
    }

    const apiAmount = txAmount;
    let finalUsdAmount = isUsd ? apiAmount : parseFloat((apiAmount / walletCurrency.exchange_rate).toFixed(4));
    const preBonusUsdAmount = finalUsdAmount;
    finalUsdAmount = applyPaymentMethodBonus(finalUsdAmount, method as any);
    if (!finalUsdAmount || isNaN(finalUsdAmount) || finalUsdAmount <= 0) {
      console.error(`[WEBHOOK:sybclint] تعذّر احتساب المبلغ النهائي — code:${codeRow.code}`);
      return;
    }

    const { data: newTx } = await supabase.from("transactions").insert({
      user_id: codeRow.user_id,
      payment_method_id: codeRow.payment_method_id,
      amount: finalUsdAmount,
      original_amount: preBonusUsdAmount,
      // [FIX] بادئة AUTO_ تمنع أي تعارض محتمل مع tx_number الخام المخزَّن من نظام جلب المعاملات
      // القديم (قد يستخدم نفس رقم عملية المزوّد حرفياً دون بادئة) إن وُجد قيد UNIQUE على العمود.
      tx_number: `AUTO_${tx.id || codeRow.code}`,
      bonus_type: (method as any)?.bonus_type || null,
      bonus_percent: (method as any)?.bonus_percent || null,
      status: "approved",
      note: `شحن تلقائي عبر رمز ${codeRow.code} (${GATEWAY_LABEL_AR[gatewayCode]}) - رقم العملية: ${tx.id} - المبلغ: ${apiAmount} ${txCurrency}`,
    }).select().single();

    await supabase.from("auto_charge_codes").update({ transaction_id: newTx?.id || null, updated_at: new Date().toISOString() }).eq("id", codeRow.id);

    const { error: incErr } = await supabase.rpc("increment_balance", { user_id_param: codeRow.user_id, amount_param: finalUsdAmount });
    if (incErr) {
      console.error(`[WEBHOOK:sybclint] فشلت إضافة الرصيد بعد الاعتماد — code:${codeRow.code} userId:${codeRow.user_id}`, incErr);
      notifyAdminServer("system_alerts", `🚨 شحن تلقائي (${GATEWAY_LABEL_AR[gatewayCode]}) اعتُمد لكن فشلت إضافة الرصيد فعلياً للمستخدم #${codeRow.user_id}. رمز: ${codeRow.code}. يتطلب تدخل يدوي فوري.`, "topup", newTx?.id).catch(() => {});
      return;
    }
    {
      const { error: rsErr } = await supabase.rpc("add_recharge_sum", { p_user_id: codeRow.user_id, p_amount: finalUsdAmount });
      if (rsErr) console.error("[RANKS] add_recharge_sum failed:", rsErr.message);
    }

    const { data: freshUserRow } = await supabase.from("users").select("balance, name, telegram_chat_id").eq("id", codeRow.user_id).single();
    logActivity(codeRow.user_id, "recharge", `شحن رصيد تلقائي (${GATEWAY_LABEL_AR[gatewayCode]} - Webhook) بقيمة ${finalUsdAmount}$`, pseudoReq);

    const adminMsg = `✅ شحن تلقائي عبر Webhook (${GATEWAY_LABEL_AR[gatewayCode]})\nالمستخدم: ${freshUserRow?.name || codeRow.user_id}\nرقم الدخول: #${codeRow.user_id}\nالمبلغ: ${apiAmount} ${txCurrency} (${finalUsdAmount}$)\nالرمز: ${codeRow.code}\nرقم العملية: ${tx.id}`;
    notifyAdminServer("topup_transactions", adminMsg, "topup", newTx?.id).catch(() => {});
    if (freshUserRow?.telegram_chat_id) userBot?.sendMessage(freshUserRow.telegram_chat_id, `✅ تم شحن رصيدك بـ ${finalUsdAmount.toFixed(4)}$ عبر الشحن التلقائي (${GATEWAY_LABEL_AR[gatewayCode]}) بنجاح!`);
  }

  const webhookSybclintCallTimes: number[] = [];
  app.post("/api/webhooks/sybclint/:secret", async (req, res) => {
    try {
      const expectedSecret = await getSybclintWebhookSecret();
      const providedSecret = String(req.params.secret || "");
      if (!expectedSecret || !timingSafeEqualStrings(providedSecret, expectedSecret)) {
        return res.status(404).end();
      }

      // [SEC] حد معدّل بسيط يحمي من إغراق النقطة (حتى بعد اجتياز فحص السر) — 120 طلب/دقيقة
      const now = Date.now();
      while (webhookSybclintCallTimes.length && now - webhookSybclintCallTimes[0] > 60_000) webhookSybclintCallTimes.shift();
      if (webhookSybclintCallTimes.length >= 120) {
        console.warn("[WEBHOOK:sybclint] Rate limit exceeded");
        return res.status(429).json({ error: "rate limited" });
      }
      webhookSybclintCallTimes.push(now);

      const payload = req.body;
      if (!payload || payload.event !== "transaction.new" || !Array.isArray(payload.transactions)) {
        return res.json({ received: true });
      }
      const gatewayCode = INVOICE_ELIGIBLE_METHOD_TYPES[String(payload.provider || "")];
      if (!gatewayCode) return res.json({ received: true });

      for (const tx of payload.transactions) {
        try {
          if (!tx || tx.type !== "credit") continue;
          const description = String(tx.description || "").trim();
          if (!description) continue;

          const { data: codeRow } = await supabase.from("auto_charge_codes")
            .select("*").eq("code", description).eq("status", "pending").eq("gateway_code", gatewayCode)
            .maybeSingle();
          if (!codeRow) continue; // ليست كل معاملة مرتبطة برمز — طبيعي وليس خطأ
          if (new Date(codeRow.expires_at).getTime() < Date.now()) {
            await supabase.from("auto_charge_codes").update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", codeRow.id).eq("status", "pending");
            continue;
          }

          // [SEC] اعتماد ذرّي — يمنع الشحن المضاعف لو أعاد sybclint إرسال نفس الحدث (تسليم webhook متكرر)
          const { data: casRows } = await supabase.from("auto_charge_codes")
            .update({ status: "used", matched_amount: tx.amount, matched_currency: String(tx.currency || "").toUpperCase(), updated_at: new Date().toISOString() })
            .eq("id", codeRow.id).eq("status", "pending")
            .select("id");
          if (!Array.isArray(casRows) || casRows.length === 0) continue; // سُبق اعتماده من تسليم آخر لنفس الحدث

          await creditAutoChargeCode(codeRow, tx, gatewayCode);
        } catch (txErr) {
          console.error("[WEBHOOK:sybclint] فشل معالجة عملية ضمن الحمولة:", txErr);
        }
      }

      res.json({ received: true });
    } catch (e: any) {
      console.error("[WEBHOOK:sybclint] خطأ عام:", e);
      res.status(500).json({ error: "internal error" });
    }
  });

  app.post("/api/transactions/verify-auto", authenticate, uploadLimiter, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { paymentMethodId, amount, txNumber, inputCurrency } = req.body;
      if (!paymentMethodId || !amount || !txNumber) {
        return res.status(400).json({ error: "بيانات ناقصة" });
      }
      if (!isValidId(paymentMethodId)) return res.status(400).json({ error: "طريقة دفع غير صحيحة" });
      { const idBlock = await identityGate(userId, paymentMethodId); if (idBlock) return res.status(403).json({ error: idBlock, code: "IDENTITY_REQUIRED" }); }
      // نسمح بمبلغ أكبر إذا كان بالليرة السورية (حتى 50 مليون)
      const maxAmount = (inputCurrency === "SYP" || String(inputCurrency).toUpperCase() === "SYP") ? 50000000 : 100000;
      if (!isValidAmount(amount, 0.01, maxAmount)) return res.status(400).json({ error: "المبلغ غير صحيح" });
      if (!isValidTxNumber(txNumber)) return res.status(400).json({ error: "رقم العملية غير صحيح (أحرف وأرقام فقط)" });

      const { data: method } = await supabase.from("payment_methods")
        .select("name, method_type, api_account, wallet_address, min_amount, payment_currency, currency_id, bonus_type, bonus_percent")
        .eq("id", paymentMethodId).single();

      if (!method || !["syriatel", "shamcash", "binance", "crypto_usdt_trc20", "crypto_usdt_bep20"].includes(method.method_type)) {
        return res.status(400).json({ error: "طريقة الدفع غير صحيحة" });
      }

      const numAmount = parseFloat(amount);
      // [FIX] فُحص الحد الأدنى سابقاً هنا بمقارنة numAmount الخام (قد يكون بالليرة السورية، غير
      // موثوق أصلاً لأنه مُدخَل من المستخدم) مباشرة مع method.min_amount المخزَّن بالدولار —
      // خلل وحدة. أُزيل من هنا ونُقل الفحص الصحيح أسفل بعد حساب finalUsdAmount الموثوق (المشتقّ
      // من apiAmount الذي يتحقّق منه المزوّد الخارجي فعلياً، لا مما أدخله المستخدم).

      // [SEC-FIX] CWE-362 (TOCTOU / Race Condition): الكود القديم كان يتحقق من التكرار بـ SELECT
      // هنا، ثم لا يُدرج سجل المعاملة إلا لاحقاً بعد استدعاء شبكي بطيء للتحقق لدى مزوّد خارجي
      // (verifySyriatelTx/verifyShamCashTx) — فجوة زمنية حقيقية بين "الفحص" و"الاستخدام".
      // إذا أرسل المستخدم (أو مهاجم بسكربت) نفس رقم عملية حقيقي مرتين بالتزامن التقريبي، يمرّ
      // كلا الطلبين من فحص "غير مستخدم"، وكلاهما يُتحقق بنجاح لدى المزوّد (العملية حقيقية فعلاً)،
      // وكلاهما يُضيف الرصيد — فيُشحن المستخدم مرتين لقاء دفعة واحدة حقيقية (Double-Crediting).
      // الإصلاح: نحجز رقم العملية فوراً بإدراج سجل "قيد التحقق" قبل أي استدعاء شبكي بطيء. الإدراج
      // الثاني لنفس tx_number سيتعارض (يتطلب قيد UNIQUE(tx_number) في قاعدة البيانات — إن لم يكن
      // موجوداً بعد يجب إضافته: ALTER TABLE transactions ADD CONSTRAINT transactions_tx_number_unique
      // UNIQUE (tx_number);) فيُرفض فوراً وبشكل ذرّي، بدل الاعتماد على SELECT سابق غير آمن.
      let claimedTx: any = null;
      {
        const { data: claimData, error: claimErr } = await supabase.from("transactions").insert({
          user_id: userId,
          payment_method_id: paymentMethodId,
          amount: numAmount,
          tx_number: txNumber,
          status: "pending_verification",
          note: "حجز مبدئي بانتظار التحقق من المزوّد الخارجي"
        }).select().single();
        if (claimErr) {
          // تعارض على tx_number (أو خطأ آخر) = العملية مستخدمة مسبقاً أو قيد المعالجة الآن
          return res.status(400).json({ error: "رقم العملية مستخدم مسبقاً" });
        }
        claimedTx = claimData;
      }
      // من هذه النقطة فصاعداً، أي مخرج (نجاح أو فشل) يجب أن يُحدِّث أو يحذف claimedTx — نستخدم
      // abortClaim() في كل رفض لاحق لتحرير رقم العملية فوراً بدل تركه محجوزاً "للأبد" (ما كان
      // سيمنع صاحبه الحقيقي من إعادة المحاولة لاحقاً بعد إصلاح سبب الرفض، مثل تفعيل سعر الصرف).
      const abortClaim = async (statusCode: number, body: any) => {
        try {
          await supabase.from("transactions").delete().eq("id", claimedTx.id).eq("status", "pending_verification");
        } catch (e) {
          console.error(`[verify-auto] فشل تحرير حجز tx_number=${txNumber} (id=${claimedTx.id}):`, e);
        }
        return res.status(statusCode).json(body);
      };

      // تسجيل تدقيقي موحّد لكل محاولة تحقق تلقائي (نجحت أو رُفضت فعلياً من المزوّد نفسه) في جدول الفواتير،
      // ليظهر نظام "كود التحقق" (شام كاش/سيرياتيل/Binance/العملات الرقمية) ضمن تبويب "الفواتير والشحن
      // التلقائي" بلوحة الأدمن. غير معطِّل للمسار الفعلي أبداً (try/catch صامت).
      const logAutoVerifyAudit = async (status: "paid" | "rejected", amt: number, curr: string) => {
        try {
          await supabase.from("shamcash_invoices").insert({
            invoice_number: `AUTO-${txNumber}-${claimedTx.id}`,
            transaction_id: status === "paid" ? claimedTx.id : null,
            user_id: userId,
            payment_method_id: paymentMethodId,
            amount: amt > 0 ? amt : numAmount,
            currency: curr || "USD",
            status,
            gateway_code: INVOICE_ELIGIBLE_METHOD_TYPES[method.method_type] || method.method_type,
          });
        } catch (e) {
          console.error(`[verify-auto] فشل تسجيل سجل التدقيق لمحاولة tx_number=${txNumber}:`, e);
        }
      };

      // ============ Wallet currency & exchange rate resolution (critical) ============
      // كل طريقة دفع آلية (شام كاش/سيرياتيل كاش) يجب أن تكون مرتبطة بعملة محددة من جدول العملات.
      // بدون سعر صرف صالح لهذه العملة، يجب رفض العملية فوراً (Reject Transaction).
      let walletCurrency: { id: number | string; name: string; symbol: string; exchange_rate: number } | null = null;

      if (method.currency_id) {
        const { data: curRow, error: curErr } = await supabase
          .from("currencies")
          .select("id, name, symbol, exchange_rate, is_active")
          .eq("id", method.currency_id)
          .maybeSingle();
        if (curErr) {
          return abortClaim(400, { error: "تعذّر التحقق من عملة طريقة الدفع. يرجى المحاولة لاحقاً." });
        }
        if (!curRow || !curRow.is_active) {
          return abortClaim(400, { error: "عملة المحفظة المرتبطة بطريقة الدفع هذه غير مفعّلة أو غير موجودة. لا يمكن إتمام العملية." });
        }
        const rate = parseFloat(String(curRow.exchange_rate));
        if (!rate || isNaN(rate) || rate <= 0) {
          // Reject Transaction — no valid exchange rate found for the wallet currency
          return abortClaim(422, {
            error: `تعذّر إتمام العملية: لا يوجد سعر صرف صالح للعملة "${curRow.name}" المرتبطة بهذه الطريقة. يرجى مراجعة الإدارة.`
          });
        }
        walletCurrency = { id: curRow.id, name: curRow.name, symbol: curRow.symbol, exchange_rate: rate };
        // سيرياتيل كاش يقبل فقط الليرة السورية؛ شام كاش يقبل الدولار ($) أو الليرة السورية (ل.س) حسب رد الـ API
        const curNameUp = String(curRow.name || "").toUpperCase();
        const curSymUp = String(curRow.symbol || "").toUpperCase();
        const isSyp = curNameUp === "SYP" || curNameUp.includes("ليرة") || curNameUp.includes("سوري") || curSymUp === "SYP" || curSymUp.includes("ل.س") || curSymUp.includes("ل س");
        if (method.method_type === "syriatel" && !isSyp) {
          return abortClaim(422, {
            error: `طريقة الدفع هذه (سيرياتيل كاش) تقبل فقط عملة الليرة السورية (ل.س). العملة المرتبطة حالياً "${curRow.name}" غير مسموحة.`
          });
        }
        if (method.method_type === "shamcash" || method.method_type === "binance") {
          const isUsd = curNameUp === "USD" || curNameUp.includes("دولار") || curSymUp === "USD" || curSymUp === "$";
          const label = method.method_type === "shamcash" ? "شام كاش" : "Binance Pay";
          if (!isSyp && !isUsd) {
            return abortClaim(422, {
              error: `طريقة الدفع هذه (${label}) تقبل فقط الدولار ($) أو الليرة السورية (ل.س). العملة المرتبطة حالياً "${curRow.name}" غير مسموحة.`
            });
          }
        }
        if (method.method_type === "crypto_usdt_trc20" || method.method_type === "crypto_usdt_bep20") {
          const isUsd = curNameUp === "USD" || curNameUp.includes("دولار") || curSymUp === "USD" || curSymUp === "$";
          if (!isUsd) {
            return abortClaim(422, {
              error: `طريقة الدفع هذه تقبل فقط الدولار ($) كمكافئ لـ USDT. العملة المرتبطة حالياً "${curRow.name}" غير مسموحة.`
            });
          }
        }
      } else if (method.currency_id === null && (method.method_type === "shamcash" || method.method_type === "binance" || method.method_type === "crypto_usdt_trc20" || method.method_type === "crypto_usdt_bep20")) {
        // currency_id يكون null عندما يختار الأدمن عملة الدولار الافتراضية ($) لأنها ليست صفاً حقيقياً في جدول currencies
        // لذلك null هنا لا يعني "لا توجد عملة مرتبطة"، بل يعني تحديداً "الدولار ($)" — وهذا مسموح لشام كاش وBinance والعملات الرقمية
        walletCurrency = { id: "usd", name: "الدولار الأمريكي", symbol: "$", exchange_rate: 1 };
      } else {
        // طريقة دفع آلية بدون عملة مرتبطة إطلاقاً — يجب رفض العملية فوراً
        return abortClaim(422, {
          error: "تعذّر إتمام العملية: لا توجد عملة محفظة مرتبطة بطريقة الدفع هذه. يرجى مراجعة الإدارة لربط عملة."
        });
      }

      // عملة طريقة الدفع المحددة في الإعدادات (USD أو SYP) — تبقى للتوافق مع مسار sam-api القديم
      const methodCurrency = (method.payment_currency || "USD").toUpperCase();

      // Verify with sam-api.pro
      let verified = false;
      let apiAmount = 0;
      let apiCurrency = methodCurrency; // افتراضي من إعداد طريقة الدفع
      let apiDebug = "";

      if (method.method_type === "syriatel") {
        // استخدام api_account (رقم الهاتف/الكود) أولاً ثم wallet_address كبديل
        // [SECURITY FIX] نفس مستوى المطابقة الصارمة المطبّق على شام كاش الآن — مبلغ وعملة متوقعين
        // صريحين (سيرياتيل كاش SYP فقط) بدل اعتماد أي عملية مطابقة لرقم العملية بغض النظر عن مبلغها.
        const candidates = [method.api_account, method.wallet_address].filter(Boolean);
        let rejectReason = "";
        for (const phoneOrCode of candidates) {
          const result = await verifySyriatelTx(txNumber, phoneOrCode, numAmount, "SYP");
          if (result.rejected) { rejectReason = result.rejectReason || ""; continue; }
          if (result.found) { verified = true; apiAmount = result.amount || 0; apiCurrency = "SYP"; break; }
          apiDebug = result.debug || "";
        }
        if (!verified && rejectReason) {
          console.warn(`[SEC] verify-auto syriatel rejected — userId:${userId} txNumber:${txNumber} reason:${rejectReason}`);
          await logAutoVerifyAudit("rejected", numAmount, "SYP");
          return abortClaim(422, { error: rejectReason });
        }
      } else if (method.method_type === "shamcash") {
        // [SECURITY FIX] walletCurrency الفعلية + numAmount (مُدخل المستخدم) هما المرجع الملزم
        // للمطابقة الصارمة مقابل رد الـ API الحقيقي — يمنع اعتماد "9 ل.س" كأنها "9 دولار".
        const expectedCurrency =
          walletCurrency && (walletCurrency.name.toUpperCase() === "USD" || walletCurrency.symbol === "$")
            ? "USD"
            : "SYP";
        // استخدام wallet_address (عنوان المحفظة 32 hex) أولاً ثم api_account
        const candidates = [method.wallet_address, method.api_account].filter(Boolean);
        let rejectReason = "";
        for (const addr of candidates) {
          const result = await verifyShamCashTx(txNumber, addr, numAmount, expectedCurrency);
          if (result.rejected) { rejectReason = result.rejectReason || ""; continue; }
          if (result.found) { verified = true; apiAmount = result.amount || 0; apiCurrency = result.currency || methodCurrency; break; }
          apiDebug = result.debug || "";
        }
        if (!verified && rejectReason) {
          console.warn(`[SEC] verify-auto shamcash rejected — userId:${userId} txNumber:${txNumber} reason:${rejectReason}`);
          await logAutoVerifyAudit("rejected", numAmount, expectedCurrency);
          return abortClaim(422, { error: rejectReason });
        }
      } else if (method.method_type === "binance") {
        const expectedCurrency =
          walletCurrency && (walletCurrency.name.toUpperCase() === "USD" || walletCurrency.symbol === "$")
            ? "USD"
            : "SYP";
        const candidates = [method.wallet_address, method.api_account].filter(Boolean);
        let rejectReason = "";
        for (const binanceId of candidates) {
          const result = await verifyBinanceTx(txNumber, binanceId, numAmount, expectedCurrency);
          if (result.rejected) { rejectReason = result.rejectReason || ""; continue; }
          if (result.found) { verified = true; apiAmount = result.amount || 0; apiCurrency = result.currency || methodCurrency; break; }
          apiDebug = result.debug || "";
        }
        if (!verified && rejectReason) {
          console.warn(`[SEC] verify-auto binance rejected — userId:${userId} txNumber:${txNumber} reason:${rejectReason}`);
          await logAutoVerifyAudit("rejected", numAmount, expectedCurrency);
          return abortClaim(422, { error: rejectReason });
        }
      } else if (method.method_type === "crypto_usdt_trc20" || method.method_type === "crypto_usdt_bep20") {
        const network = method.method_type === "crypto_usdt_trc20" ? "trc20" : "bep20";
        const candidates = [method.wallet_address, method.api_account].filter(Boolean);
        let rejectReason = "";
        for (const addr of candidates) {
          const result = await verifyCryptoTx(network, txNumber, addr, numAmount, "USD");
          if (result.rejected) { rejectReason = result.rejectReason || ""; continue; }
          if (result.found) { verified = true; apiAmount = result.amount || 0; apiCurrency = result.currency || "USDT"; break; }
          apiDebug = result.debug || "";
        }
        if (!verified && rejectReason) {
          console.warn(`[SEC] verify-auto ${method.method_type} rejected — userId:${userId} txNumber:${txNumber} reason:${rejectReason}`);
          await logAutoVerifyAudit("rejected", numAmount, "USD");
          return abortClaim(422, { error: rejectReason });
        }
      }

      if (!verified) {
        console.log("[verify-auto][SAMAPI] Not found. debug:", apiDebug);
        return abortClaim(400, { 
          error: "لم يتم العثور على العملية. تأكد من رقم العملية أو انتظر قليلاً وأعد المحاولة."
        });
      }

      // [SECURITY FIX] لا اعتماد تلقائي دون مبلغ موثوق من الـ API نفسه — لا نستخدم numAmount
      // (مُدخل المستخدم) كبديل أبداً؛ apiAmount تم التحقق أعلاه أنه يطابق numAmount حرفياً عند النجاح.
      if (!(apiAmount > 0)) {
        console.warn(`[SEC] verify-auto missing api amount — userId:${userId} txNumber:${txNumber} method:${method.method_type}`);
        return abortClaim(422, { error: "تعذّر التحقق من مبلغ العملية تلقائياً من مزوّد الدفع. يرجى رفع إيصال العملية لمراجعة الإدارة يدوياً." });
      }

      const { data: user } = await supabase.from("users").select("id, name, balance").eq("id", userId).single();
      if (!user) return abortClaim(404, { error: "المستخدم غير موجود" });

      // ============ Convert to USD using the wallet's linked currency exchange rate ============
      // exchange_rate يمثل: 1 USD = exchange_rate <وحدة من عملة المحفظة> (نفس اتفاقية جدول currencies)
      let finalUsdAmount: number;
      if (walletCurrency.name.toUpperCase() === "USD" || walletCurrency.symbol === "$") {
        // العملة المرتبطة هي الدولار نفسه — لا حاجة لتحويل. apiAmount موثوق دائماً هنا (تحقق أعلاه).
        finalUsdAmount = apiAmount;
      } else {
        // نحوّل المبلغ الموثوق الوارد من الـ API فقط (تم التحقق أعلاه أنه > 0) بحسب سعر صرف العملة المرتبطة بالمحفظة
        const sourceAmount = apiAmount;
        finalUsdAmount = parseFloat((sourceAmount / walletCurrency.exchange_rate).toFixed(4));
      }

      // تطبيق عمولة/بونص طريقة الدفع (إن وُجدت) على المبلغ النهائي بالدولار قبل إضافته للرصيد
      const preBonusUsdAmount = finalUsdAmount;
      finalUsdAmount = applyPaymentMethodBonus(finalUsdAmount, method as any);

      if (!finalUsdAmount || isNaN(finalUsdAmount) || finalUsdAmount <= 0) {
        return abortClaim(422, { error: "تعذّر احتساب المبلغ النهائي بالدولار. تم رفض العملية." });
      }

      // [FIX] الفحص الصحيح للحد الأدنى — بالدولار وبناءً على preBonusUsdAmount الموثوق (المحوَّل
      // من apiAmount الذي تحقّق منه المزوّد الخارجي فعلاً)، بدل numAmount الخام غير الموثوق الذي
      // كان يُقارَن سابقاً بالقرب من بداية الدالة دون أي تحويل عملة.
      if (preBonusUsdAmount < (method.min_amount || 0)) {
        return abortClaim(400, { error: `أقل مبلغ للشحن هو ${method.min_amount} $` });
      }

      // [SEC-FIX] CWE-362: نُحدِّث سجل الحجز الذي أنشأناه في بداية الطلب (بدل إدراج سجل جديد) —
      // شرط .eq("status","pending_verification") يضمن أن هذا الطلب هو من يملك حق اعتماد هذا الحجز
      // تحديداً (دفاع إضافي في العمق حتى مع وجود قيد UNIQUE على tx_number).
      const { data: tx, error: txErr } = await supabase.from("transactions")
        .update({
          amount: finalUsdAmount,
          original_amount: preBonusUsdAmount,
          bonus_type: (method as any)?.bonus_type || null,
          bonus_percent: (method as any)?.bonus_percent || null,
          status: "approved",
          note: `تحقق تلقائي - رقم العملية: ${txNumber} - المبلغ الأصلي: ${apiAmount || numAmount} ${walletCurrency.symbol || apiCurrency} - سعر الصرف: ${walletCurrency.exchange_rate}`
        })
        .eq("id", claimedTx.id)
        .eq("status", "pending_verification")
        .select().single();
      if (txErr || !tx) {
        // لو تغيّرت حالة الحجز بالتزامن بشكل غير متوقع، نرفض بأمان دون المساس بالرصيد
        return res.status(409).json({ error: "تعذّر اعتماد العملية، يرجى إعادة المحاولة" });
      }
      await logAutoVerifyAudit("paid", apiAmount, apiCurrency);

      // [SEC-FIX] CWE-362: زيادة ذرّية عبر RPC بدل "قراءة ثم كتابة" لتفادي Lost Update
      // عند تزامن أكثر من عملية شحن لنفس المستخدم (راجع تعليق الإصلاح أعلاه).
      //
      // [SEC-FIX إضافي] معالجة فشل جزئي (Partial Failure): لو نجح تحديث المعاملة إلى "approved"
      // لكن فشلت زيادة الرصيد الفعلية (خطأ شبكة/DB عابر)، كان الكود القديم يرمي الاستثناء مباشرة
      // للـ catch العام — تاركاً معاملة معتمَدة ظاهرياً في السجلات دون أن يُضاف الرصيد فعلياً
      // للمستخدم (تعارض بين ما يظهر للإدارة/المستخدم وما حدث فعلياً). بدل ذلك، نتراجع صراحة عن
      // حالة الاعتماد (نعيدها إلى "pending" ليُعاد التحقق منها لاحقاً يدوياً) ونُبلغ المستخدم
      // بوضوح أن العملية لم تكتمل بعد بدل إخفاء الفشل عنه.
      const { error: incBalErr } = await supabase.rpc("increment_balance", { user_id_param: userId, amount_param: finalUsdAmount });
      if (!incBalErr) {
        const { error: rsErr } = await supabase.rpc("add_recharge_sum", { p_user_id: userId, p_amount: finalUsdAmount });
        if (rsErr) console.error("[RANKS] add_recharge_sum failed:", rsErr.message);
      }
      if (incBalErr) {
        console.error(`[verify-auto] فشلت زيادة الرصيد بعد اعتماد tx id=${tx.id} تلقائياً — سيُعاد وضعها كمعلّقة للمراجعة اليدوية:`, incBalErr);
        try {
          await supabase.from("transactions").update({
            status: "pending",
            note: `${tx.note} — [تنبيه] فشلت الزيادة التلقائية للرصيد، بانتظار مراجعة/اعتماد يدوي من الإدارة`
          }).eq("id", tx.id);
        } catch (e2) {
          console.error(`[verify-auto] فشل حتى تحويل tx id=${tx.id} إلى pending بعد فشل زيادة الرصيد:`, e2);
        }
        void sendSecurityTelegramAlert(
          `⚠️ <b>فشلت زيادة رصيد بعد اعتماد معاملة تلقائياً</b>\nuserId=${userId} txId=${tx.id} amount=${finalUsdAmount}$\nتحوّلت المعاملة إلى pending بانتظار مراجعة يدوية.`
        );
        return res.status(500).json({ error: "تم التحقق من العملية لكن حدث خطأ أثناء إضافة الرصيد. تم تحويل طلبك للمراجعة اليدوية وسيُضاف رصيدك قريباً." });
      }
      const { data: userAfter } = await supabase.from("users").select("balance").eq("id", userId).single();
      const newBalance = parseFloat(String(userAfter?.balance ?? ((parseFloat(String(user.balance)) || 0) + finalUsdAmount)));
      logActivity(userId, "recharge", `شحن رصيد تلقائي بقيمة ${finalUsdAmount}$ عبر ${method.name}`, req);

      if (user?.id) {
        const { data: u } = await supabase.from("users").select("telegram_chat_id").eq("id", userId).single();
        if (u?.telegram_chat_id) userBot?.sendMessage(u.telegram_chat_id, `✅ تم شحن رصيدك بـ ${finalUsdAmount.toFixed(4)}$ عبر ${method.name} بنجاح!`);
      }

      res.json({ success: true, newBalance, addedUsd: finalUsdAmount, originalAmount: apiAmount || numAmount, currency: walletCurrency.symbol || apiCurrency });
    } catch (e: any) {
      safeError(res, e, "فشل التحقق التلقائي من عملية الدفع");
    }
  });

  app.post("/api/transactions/upload", authenticate, uploadLimiter, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { paymentMethodId, amount, originalAmount, originalCurrency, note, receiptImageUrl, customFieldsData } = req.body;
      // Validation
      if (!isValidId(paymentMethodId)) return res.status(400).json({ error: "طريقة دفع غير صحيحة" });
      { const idBlock = await identityGate(userId, paymentMethodId); if (idBlock) return res.status(403).json({ error: idBlock, code: "IDENTITY_REQUIRED" }); }
      if (!isValidAmount(amount, 0.01, 100000)) return res.status(400).json({ error: "المبلغ يجب أن يكون رقماً موجباً" });
      if (note && typeof note === "string" && note.length > 300) return res.status(400).json({ error: "الملاحظة طويلة جداً (أقصاه 300 حرف)" });
      if (receiptImageUrl && !isValidUrl(receiptImageUrl)) return res.status(400).json({ error: "رابط الإيصال غير صحيح" });
      // الحقول المخصصة (الافتراضية المعاد تسميتها + حتى 3 حقول إضافية) — تُتحقق وتُحفظ بشكل منفصل
      let parsedCustomFieldsData: any[] = [];
      if (customFieldsData) {
        try {
          parsedCustomFieldsData = typeof customFieldsData === "string" ? JSON.parse(customFieldsData) : customFieldsData;
          if (!Array.isArray(parsedCustomFieldsData)) parsedCustomFieldsData = [];
        } catch { parsedCustomFieldsData = []; }
      }
      for (const f of parsedCustomFieldsData) {
        if (f?.required && !String(f?.value || "").trim()) {
          return res.status(400).json({ error: `الحقل "${f?.label || ""}" إلزامي` });
        }
        if (typeof f?.value === "string" && f.value.length > 500) {
          return res.status(400).json({ error: `الحقل "${f?.label || ""}" طويل جداً` });
        }
      }
      const { data: user } = await supabase.from("users").select("id, name").eq("id", userId).single();
      const { data: method } = await supabase.from("payment_methods").select("name, bonus_type, bonus_percent").eq("id", paymentMethodId).single();

      const { data: pending } = await supabase.from("transactions").select("id", { count: "exact" }).eq("user_id", userId).eq("status", "pending");
      if ((pending?.length || 0) >= 2) {
        return res.status(400).json({ error: "لا يمكنك إرسال أكثر من مدفوعتين قيد المراجعة." });
      }

      // نحفظ المبلغ الأصلي وعملته إن وُجدا (للتدقيق فقط) — المبلغ المعتمد للرصيد يبقى amount بالدولار دائماً
      const safeOriginalAmount = originalAmount !== undefined && !isNaN(Number(originalAmount)) ? Number(originalAmount) : null;
      const safeOriginalCurrency = typeof originalCurrency === "string" && originalCurrency.length <= 10 ? originalCurrency : null;

      // لقطة من عمولة/بونص طريقة الدفع وقت الإرسال — للعرض فقط في "قيد التحقق"/"مرفوضة" بالأدمن،
      // القيمة الفعلية المعتمدة للرصيد تُحسب وتُخزَّن من جديد لحظة موافقة الأدمن
      const pendingBonusType = (method as any)?.bonus_type || null;
      const pendingBonusPercent = (method as any)?.bonus_percent || null;

      let tx: any = null;
      {
        const { data, error } = await supabase.from("transactions").insert({
          user_id: userId,
          payment_method_id: paymentMethodId,
          amount,
          original_amount: safeOriginalAmount,
          original_currency: safeOriginalCurrency,
          bonus_type: pendingBonusType,
          bonus_percent: pendingBonusPercent,
          note,
          receipt_image_url: receiptImageUrl,
          custom_fields_data: parsedCustomFieldsData.length > 0 ? JSON.stringify(parsedCustomFieldsData) : null,
          status: "pending"
        }).select().single();
        if (error) {
          // تراجع آمن إن لم تكن أعمدة original_amount/original_currency/bonus_type/bonus_percent موجودة بعد في قاعدة البيانات
          const { data: fallbackData, error: fallbackErr } = await supabase.from("transactions").insert({
            user_id: userId,
            payment_method_id: paymentMethodId,
            amount,
            note,
            receipt_image_url: receiptImageUrl,
            custom_fields_data: parsedCustomFieldsData.length > 0 ? JSON.stringify(parsedCustomFieldsData) : null,
            status: "pending"
          }).select().single();
          if (fallbackErr) throw fallbackErr;
          tx = fallbackData;
        } else {
          tx = data;
        }
      }

      // [FIX-ROOT-CAUSE] نفس القالب المطابق تماماً لقالب saraqib-store-admin
      const topupAmountLabel = safeOriginalAmount && safeOriginalCurrency && safeOriginalCurrency !== "USD"
        ? `${amount}$ (${safeOriginalAmount.toLocaleString("en-US")} ${safeOriginalCurrency})`
        : `${amount}$`;
      const txDateStrUser = tx.created_at ? new Date(tx.created_at).toLocaleString("ar-EG") : new Date().toLocaleString("ar-EG");
      const topupAdminMsg = [
        `💰 طلب شحن جديد #TX${tx.id}`,
        "",
        `👤 المستخدم: ${user?.name}`,
        `🔢 رقم الدخول: #${userId}`,
        `💵 المبلغ: ${topupAmountLabel}`,
        `💳 طريقة الدفع: ${method?.name}`,
        `📌 الحالة: ⏳ قيد المراجعة`,
        `🗓️ التاريخ: ${txDateStrUser}`,
        `🧾 الإيصال: ${receiptImageUrl}`,
      ].join("\n");
      notifyAdminServer("topup_transactions", topupAdminMsg, "topup", tx.id).catch(() => {});

      res.json({ success: true, transactionId: tx.id });
    } catch (e: any) {
      safeError(res, e, "فشل رفع إيصال الدفع");
    }
  });

  app.get("/api/transactions/user/:userId", authenticate, async (req, res) => {
    if (String((req as any).userId) !== String(req.params.userId)) {
      return res.status(403).json({ error: "ممنوع" });
    }
    try {
      const { data, error } = await supabase.from("transactions").select("*, payment_methods(name)").eq("user_id", req.params.userId).order("created_at", { ascending: false });
      if (error) throw error;
      const mapped = (Array.isArray(data) ? data : []).map((t: any) => ({
        ...t,
        method_name: t.payment_methods?.name || t.method_name || "—"
      }));
      res.json(mapped);
    } catch (e: any) {
      res.json([]); // safe fallback
    }
  });

  // =================== VOUCHERS ===================

  app.post("/api/vouchers/redeem", authenticate, async (req, res) => {
    try {
      const userId = (req as any).userId;
      const { code } = req.body;
      if (!isValidVoucherCode(code)) return res.status(400).json({ error: "كود القسيمة غير صحيح (أحرف وأرقام فقط)" });
      const { data: voucher } = await supabase.from("vouchers").select("*").eq("code", code.trim().toUpperCase()).eq("active", true).single();
      if (!voucher) return res.status(404).json({ error: "قسيمة غير صالحة أو غير مفعّلة" });

      if (voucher.used_count >= voucher.max_uses) return res.status(400).json({ error: "تم استنفاد هذه القسيمة بالكامل" });

      // [SEC-FIX] Race condition (CWE-362 / TOCTOU): كان الكود يتحقق من "هل استُخدمت من قبل؟"
      // ثم يُدرج سجل الاستخدام في خطوة منفصلة لاحقة — ما يسمح بإرسال عدة طلبات متزامنة لنفس
      // القسيمة قبل اكتمال أي منها، فيمرّ فحص "لم تُستخدم" للجميع ويُضاف الرصيد أكثر من مرة.
      // الإصلاح: نحاول الإدراج أولاً ونعتمد على قيد UNIQUE(voucher_id, user_id) في قاعدة
      // البيانات ليرفض أي محاولة إدراج ثانية بشكل ذرّي. إن لم يكن هذا القيد موجوداً بعد، يجب
      // إضافته في Supabase: ALTER TABLE voucher_uses ADD CONSTRAINT voucher_uses_unique
      // UNIQUE (voucher_id, user_id);
      const { error: usageInsertErr } = await supabase
        .from("voucher_uses").insert({ voucher_id: voucher.id, user_id: userId });
      if (usageInsertErr) {
        // تعارض على القيد الفريد = استُخدمت القسيمة مسبقاً (أو خطأ آخر، نعامله كرفض آمن)
        return res.status(400).json({ error: "تم استخدام هذه القسيمة مسبقاً" });
      }

      // خصم الاستخدام بشرط ألا يكون قد استُنفد بالتزامن (فحص وتحديث ذرّي على مستوى القاعدة)
      const { data: voucherUpdateRows, error: voucherUpdateErr } = await supabase
        .from("vouchers")
        .update({ used_count: voucher.used_count + 1 })
        .eq("id", voucher.id)
        .lt("used_count", voucher.max_uses)
        .select("id");
      if (voucherUpdateErr || !voucherUpdateRows || voucherUpdateRows.length === 0) {
        // استُنفدت القسيمة بالتزامن — نتراجع عن سجل الاستخدام الذي أدرجناه فوراً
        await supabase.from("voucher_uses").delete().eq("voucher_id", voucher.id).eq("user_id", userId);
        return res.status(400).json({ error: "تم استنفاد هذه القسيمة بالكامل" });
      }

      await supabase.rpc("increment_balance", { user_id_param: userId, amount_param: voucher.amount });

      // [FIX] كان هذا السطر يعيّن عمود رقمي (vouchers_redeemed_count) إلى قيمة دالة JS
      // (supabase.rpc) بالخطأ بدل زيادته فعلياً — لم يكن يعمل كإحصائية على الإطلاق.
      try {
        const { data: statsRow } = await supabase.from("user_stats").select("vouchers_redeemed_count").eq("user_id", userId).maybeSingle();
        const nextCount = (statsRow?.vouchers_redeemed_count || 0) + 1;
        await supabase.from("user_stats").update({ vouchers_redeemed_count: nextCount }).eq("user_id", userId);
      } catch { /* إحصائية غير حرجة — لا نُفشل عملية الاسترداد بسببها */ }

      logActivity(userId, "voucher_redeem", `استخدام قسيمة بقيمة ${voucher.amount}`, req);

      res.json({ success: true, amount: voucher.amount });
    } catch (e: any) {
      safeError(res, e, "فشل استخدام كود القسيمة (Voucher)");
    }
  });

  // =================== CHAT ===================

  app.post("/api/chat/send", chatLimiter, async (req, res) => {
    try {
      let { user_id, guest_id, sender_role, content, image_url, type, rating } = req.body;
      // Validation
      if (sender_role && !["user","admin","guest"].includes(sender_role)) {
        return res.status(400).json({ error: "دور المرسل غير صحيح" });
      }
      if (content && typeof content === "string" && content.length > 2000) {
        return res.status(400).json({ error: "الرسالة طويلة جداً (أقصاه 2000 حرف)" });
      }
      if (image_url && !isValidUrl(image_url)) {
        return res.status(400).json({ error: "رابط الصورة غير صحيح" });
      }

      // [SEC-FIX] كان هذا المسار يثق بـ user_id و sender_role القادمين من العميل مباشرة دون أي
      // تحقق (لا يوجد authenticate على هذا المسار) — ما يسمح لأي زائر بانتحال أي user_id، أو
      // بانتحال دور "admin" وإرسال أي محتوى كأنه رد دعم فني رسمي (تصيّد/هندسة اجتماعية داخل
      // الشات الموثوق) — CWE-306 / CWE-290 (Authentication Bypass by Spoofing).
      if (user_id) {
        const auth = req.headers.authorization || "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : (req.headers["x-user-token"] as string || "");
        if (!token) return res.status(401).json({ error: "يجب تسجيل الدخول" });
        const payload = verifyUserToken(token);
        if (!payload) return res.status(401).json({ error: "الجلسة منتهية، يرجى تسجيل الدخول مجدداً" });
        // نتجاهل أي user_id قادم من العميل ونستخدم فقط الهوية المستخرجة من التوكن الموثّق
        user_id = payload.sub;
      }

      if (sender_role === "admin") {
        // لا يوجد مسار إداري منفصل لإرسال ردود الدعم — الواجهة الأمامية تستخدم هذا المسار
        // نفسه لعرض ردود الأسئلة الشائعة (FAQ) تلقائياً. لمنع انتحال شخصية الدعم الفني بمحتوى
        // حر، نقبل "admin" فقط إذا كان المحتوى مطابقاً تماماً لرد FAQ معروف من قاعدة البيانات.
        const { data: faqMatch } = await supabase
          .from("auto_replies").select("id").eq("is_faq", true).eq("reply_text", content || "").limit(1).maybeSingle();
        if (!faqMatch) {
          logSecurityEvent("chat-admin-impersonation-attempt", req, `content:${String(content || "").slice(0,120)}`);
          return res.status(403).json({ error: "غير مصرح بإرسال رسالة بهذا الدور" });
        }
      }

      if (sender_role === "user" && user_id) {
        const { data: user } = await supabase.from("users").select("is_vip").eq("id", user_id).single();

        const { data: limitSetting } = await supabase
          .from("settings").select("value").eq("key", "chat_min_messages").single();
        const limitConfig = limitSetting ? JSON.parse(limitSetting.value || "{}") : {};
        const limit = user?.is_vip
          ? (Math.max(0, parseInt(limitConfig.vip)) || 100)
          : (Math.max(0, parseInt(limitConfig.normal)) || 10);

        const today = new Date().toISOString().split("T")[0];
        const { data: countData } = await supabase.from("daily_message_counts").select("count").eq("user_id", user_id).eq("date", today).single();
        const currentCount = countData?.count || 0;

        if (currentCount >= limit) return res.status(403).json({ error: `لقد وصلت للحد اليومي (${limit} رسالة).` });

        if (countData) {
          await supabase.from("daily_message_counts").update({ count: currentCount + 1 }).eq("user_id", user_id).eq("date", today);
        } else {
          await supabase.from("daily_message_counts").insert({ user_id, date: today, count: 1 });
        }
      }

      const { data: msg, error } = await supabase.from("messages").insert({
        user_id, guest_id, sender_role, content, image_url, type: type || "text", rating
      }).select().single();
      if (error) throw error;

      if (sender_role === "user") {
        // ── عدّ رسائل المستخدم في هذه المحادثة لتحديد حاجة التدخل البشري ──
        let userMessageCount = 0;
        if (user_id) {
          const { count: uCount } = await supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user_id)
            .eq("sender_role", "user");
          userMessageCount = uCount || 0;
        } else if (guest_id) {
          const { count: gCount } = await supabase
            .from("messages")
            .select("id", { count: "exact", head: true })
            .eq("guest_id", guest_id)
            .eq("sender_role", "user");
          userMessageCount = gCount || 0;
        }

        if (content) {
          // 1) تحقق من الردود التلقائية أولاً (تطابق 100%)
          const { data: autoReply } = await supabase.from("auto_replies").select("reply_text").ilike("trigger_text", content.trim()).limit(1).single();
          if (autoReply) {
            await supabase.from("messages").insert({
              user_id, guest_id, sender_role: "admin", content: autoReply.reply_text, type: "bot_reply"
            });
          } else {
            // 2) تحقق من الذكاء الاصطناعي
            const { data: aiRow } = await supabase.from("settings").select("value").eq("key", "ai_chat_config").single();
            if (aiRow) {
              const aiCfg = JSON.parse(aiRow.value || "{}");
              if (!aiCfg.enabled) {
                // الذكاء الاصطناعي موجود بالإعدادات لكنه غير مفعّل — لا حاجة لرد تلقائي، الدعم البشري سيرد
              } else if (!aiCfg.api_key || !aiCfg.model) {
                // [FIX] تفعيل بدون مفتاح/موديل كان يفشل بصمت تام بدون أي تفسير. الآن نسجّل السبب بوضوح.
                console.error(`[AI CHAT] ⚠️ الذكاء الاصطناعي مفعّل لكن الإعدادات ناقصة — api_key موجود: ${!!aiCfg.api_key} | model موجود: ${!!aiCfg.model}. أكمل الإعدادات من لوحة الأدمن > إعدادات الشات.`);
              }
              if (aiCfg.enabled && aiCfg.api_key && aiCfg.model) {
                try {
                  // فك تشفير المفتاح قبل الاستخدام
                  const realApiKey = isEncrypted(aiCfg.api_key)
                    ? decryptProviderData(aiCfg.api_key)
                    : aiCfg.api_key;
                  let userContext = "";
                  // ── جلب سجل المحادثة السابقة (آخر 6 رسائل) لبناء سياق الحوار ──
                  let conversationHistory: { role: string; content: string }[] = [];
                  {
                    let histQuery = supabase
                      .from("messages")
                      .select("sender_role,content")
                      .order("created_at", { ascending: false })
                      .limit(6);
                    if (user_id) histQuery = histQuery.eq("user_id", user_id);
                    else if (guest_id) histQuery = histQuery.eq("guest_id", guest_id);
                    const { data: histMsgs } = await histQuery;
                    if (histMsgs && histMsgs.length > 0) {
                      conversationHistory = histMsgs
                        .reverse()
                        .filter((m: any) => m.content && m.content.trim())
                        .map((m: any) => ({
                          role: m.sender_role === "user" ? "user" : "assistant",
                          content: (m.content || "").slice(0, 400)
                        }));
                    }
                  }

                  if (user_id) {
                    const { data: userOrders } = await supabase
                      .from("orders")
                      .select("id,status,total_price,created_at,items")
                      .eq("user_id", user_id)
                      .order("created_at", { ascending: false })
                      .limit(5);
                    const { data: userPayments } = await supabase
                      .from("transactions")
                      .select("id,amount,type,created_at,status")
                      .eq("user_id", user_id)
                      .order("created_at", { ascending: false })
                      .limit(5);
                    const { data: userInfo } = await supabase
                      .from("users")
                      .select("name,email,balance")
                      .eq("id", user_id)
                      .single();

                    if (userInfo) {
                      userContext += `\n\n=== بيانات المستخدم الحالي ===\nالاسم: ${userInfo.name || "غير محدد"}\nالرصيد: ${userInfo.balance || 0}$`;
                    }
                    if (userOrders && userOrders.length > 0) {
                      userContext += `\n\nآخر طلبات المستخدم:\n${userOrders.map((o: any) => `- طلب #${o.id}: ${o.status} - ${o.total_price}`).join("\n")}`;
                    }
                    if (userPayments && userPayments.length > 0) {
                      userContext += `\n\nآخر معاملات المستخدم:\n${userPayments.map((p: any) => `- ${p.type} ${p.amount} (${p.status})`).join("\n")}`;
                    }
                  }

                  // ── جلب بيانات المتجر الكاملة من قاعدة البيانات ──

                  // 1) الأقسام الرئيسية
                  const { data: categories } = await supabase
                    .from("categories")
                    .select("id,name")
                    .eq("active", true)
                    .order("order_index");

                  // 2) الأقسام الفرعية
                  const { data: subcategories } = await supabase
                    .from("subcategories")
                    .select("id,name,category_id")
                    .eq("active", true)
                    .order("order_index");

                  // 3) الأقسام الفرعية الفرعية
                  const { data: subSubCategories } = await supabase
                    .from("sub_sub_categories")
                    .select("id,name,subcategory_id")
                    .eq("active", true)
                    .order("order_index");

                  // 4) المنتجات المتاحة (مع كل الحقول المفيدة)
                  const { data: products } = await supabase
                    .from("products")
                    .select("id,name,price,description,subcategory_id,sub_sub_category_id,available,min_quantity,max_quantity")
                    .eq("available", true)
                    .limit(80);

                  // 5) طرق الدفع
                  const { data: paymentMethods } = await supabase
                    .from("payment_methods")
                    .select("id,name,method_type,wallet_address,min_amount,payment_currency,instructions")
                    .eq("active", true);

                  // 6) رابط البوت ومعلومات المتجر من الإعدادات
                  const { data: botUsernameSetting } = await supabase
                    .from("settings").select("value").eq("key", "telegram_bot_username").single();
                  const { data: supportWhatsapp } = await supabase
                    .from("settings").select("value").eq("key", "support_whatsapp").single();
                  const { data: storeName } = await supabase
                    .from("settings").select("value").eq("key", "store_name").single();
                  const { data: defaultCurrencyRow } = await supabase
                    .from("currencies").select("exchange_rate,symbol").eq("is_default", true).maybeSingle();

                  // [FIX] جلب اسم البوت من إعدادات لوحة التحكم فقط (settings / telegram_bot_settings)
                  // — لم يعد يعتمد على process.env.TELEGRAM_USER_BOT_TOKEN.
                  let botUsername = botUsernameSetting?.value || "";
                  if (!botUsername) {
                    try {
                      const { data: userBotRow } = await supabase
                        .from("telegram_bot_settings").select("settings").eq("bot_type", "user").maybeSingle();
                      botUsername = userBotRow?.settings?.bot_username || "";
                    } catch { /* ignore */ }
                  }
                  const botLink = botUsername ? `https://t.me/${botUsername}` : "راجع إعدادات المتجر";
                  const sypRate = parseFloat(String(defaultCurrencyRow?.exchange_rate || "0"));
                  const sypSymbol = defaultCurrencyRow?.symbol || "ل.س";

                  // ── بناء سياق الأقسام والمنتجات ──
                  let storeContext = "";

                  // بناء شجرة الأقسام
                  if (categories && categories.length > 0) {
                    storeContext += "\n\n=== هيكل المتجر (الأقسام والمنتجات) ===";
                    for (const cat of categories) {
                      storeContext += `\n\n📁 القسم الرئيسي: ${cat.name}`;
                      const subs = (subcategories || []).filter((s: any) => s.category_id === cat.id);
                      for (const sub of subs) {
                        storeContext += `\n  📂 القسم الفرعي: ${sub.name}`;
                        // الأقسام الفرعية الفرعية
                        const subSubs = (subSubCategories || []).filter((ss: any) => ss.subcategory_id === sub.id);
                        for (const ss of subSubs) {
                          storeContext += `\n    📄 ${ss.name}`;
                          // منتجات القسم الفرعي الفرعي
                          const ssProds = (products || []).filter((p: any) => p.sub_sub_category_id === ss.id);
                          for (const p of ssProds) {
                            const priceStr = p.price ? `${p.price}$` : "";
                            const qtyStr = (p.min_quantity || p.max_quantity) ? ` (كمية: ${p.min_quantity || 1}–${p.max_quantity || "∞"})` : "";
                            storeContext += `\n      • ${p.name}${priceStr ? ": " + priceStr : ""}${qtyStr}`;
                            if (p.description) storeContext += ` — ${p.description}`;
                          }
                        }
                        // منتجات القسم الفرعي المباشرة (بدون قسم فرعي فرعي)
                        const directProds = (products || []).filter((p: any) => p.subcategory_id === sub.id && !p.sub_sub_category_id);
                        for (const p of directProds) {
                          const priceStr = p.price ? `${p.price}$` : "";
                          const qtyStr = (p.min_quantity || p.max_quantity) ? ` (كمية: ${p.min_quantity || 1}–${p.max_quantity || "∞"})` : "";
                          storeContext += `\n    • ${p.name}${priceStr ? ": " + priceStr : ""}${qtyStr}`;
                          if (p.description) storeContext += ` — ${p.description}`;
                        }
                      }
                    }
                  }

                  // ── بناء سياق طرق الدفع (الشحن) ──
                  let paymentContext = "";
                  if (paymentMethods && paymentMethods.length > 0) {
                    paymentContext = "\n\n=== طرق شحن الرصيد المتاحة ===";
                    for (const m of paymentMethods) {
                      const isAuto = ["syriatel", "shamcash", "binance", "crypto_usdt_trc20", "crypto_usdt_bep20"].includes(m.method_type);
                      const currency = m.payment_currency === "SYP" ? "ل.س" : "$";
                      const minAmt = m.min_amount
                        ? `أقل مبلغ: ${m.min_amount} ${currency}`
                        : "";
                      paymentContext += `\n\n💳 ${m.name}${isAuto ? " (شحن تلقائي فوري)" : " (يتطلب مراجعة يدوية)"}`;
                      if (m.wallet_address) paymentContext += `\n   العنوان/الرقم: ${m.wallet_address}`;
                      if (minAmt) paymentContext += `\n   ${minAmt}`;
                      if (m.instructions) paymentContext += `\n   التعليمات: ${m.instructions}`;
                      if (isAuto) {
                        paymentContext += `\n   طريقة الشحن: اذهب لصفحة المحفظة ← اختر "${m.name}" ← أدخل المبلغ ورقم العملية ← اضغط "شحن تلقائي"`;
                      } else {
                        paymentContext += `\n   طريقة الشحن: اذهب لصفحة المحفظة ← اختر "${m.name}" ← أدخل المبلغ ← ارفع صورة الإيصال ← اضغط "إرسال للمراجعة"`;
                      }
                    }
                    if (sypRate > 0) {
                      paymentContext += `\n\nسعر الصرف الحالي: 1$ = ${sypRate.toLocaleString("en-US")} ${sypSymbol}`;
                    }
                  }

                  // ── سياق البوت والتواصل ──
                  const contactContext = `\n\n=== معلومات التواصل والبوت ===
رابط بوت التيليغرام: ${botLink}
${supportWhatsapp?.value ? `واتساب الدعم: https://wa.me/${supportWhatsapp.value.replace("+", "")}` : ""}
اسم المتجر: ${storeName?.value || "سراقب ستور"}`;

                  // ── وصف صفحات الموقع الرئيسية ──
                  const pagesContext = `\n\n=== صفحات الموقع الرئيسية ===
- الرئيسية: عرض الأقسام والمنتجات المميزة
- المتجر/المنتجات: تصفح الأقسام ← اختر قسم رئيسي ← ثم فرعي ← ثم المنتج
- المحفظة: لشحن الرصيد وعرض المعاملات (زر "+" لإضافة رصيد)
- الطلبات: عرض جميع طلباتك وحالتها (معلق، مكتمل، مرفوض)
- الشات/الدعم: التواصل مع فريق الدعم مباشرة
- الملف الشخصي: بيانات حسابك والإعدادات
- الإحالة: رابط دعوة الأصدقاء للحصول على عمولة`;

                  // ── معلومات الطلبات والرفض ──
                  const ordersContext = `\n\n=== معلومات الطلبات وأسباب الرفض ===
حالات الطلب: معلق (pending) → مكتمل (completed) أو مرفوض (rejected)
أسباب الرفض الشائعة:
- بيانات غير صحيحة (ID، رقم هاتف، معرّف المستخدم)
- رصيد غير كافٍ في المحفظة
- المنتج غير متاح مؤقتاً
- الكمية المطلوبة خارج الحد المسموح (أقل من الحد الأدنى أو أكثر من الحد الأقصى)
- خطأ في التحقق عند المزود

عند رفض الطلب: تحقق من صفحة "طلباتي" لرؤية سبب الرفض، وتواصل مع الدعم إذا لم يكن السبب واضحاً.`;

                  const systemPrompt = `أنت مساعد متخصص حصرياً لمتجر "${storeName?.value || "سراقب ستور"}" الإلكتروني — منصة شحن التطبيقات والألعاب.
هويتك: مساعد ذكي محترف يعمل على مدار الساعة لخدمة عملاء المتجر.
${aiCfg.training_text ? "\n== تعليمات خاصة من الإدارة ==\n" + aiCfg.training_text : ""}
${storeContext}
${paymentContext}
${contactContext}
${pagesContext}
${ordersContext}
${userContext}

== أسلوب التعامل مع العميل ==
- استخدم لغة عربية واضحة وودية ومهنية في كل الأوقات.
- رحّب بالعميل باسمه إذا كانت البيانات متاحة.
- أجب بشكل مباشر ومختصر دون حشو أو تكرار.
- عند شرح خطوات، استخدم قوائم مرقّمة واضحة.
- أبدِ تعاطفك مع العميل عند وجود مشكلة ("أفهم موقفك، سأساعدك الآن").
- في نهاية الرد، تحقق دائماً: "هل هناك شيء آخر يمكنني مساعدتك به؟"

== قواعد حل المشاكل ==
1. عند مشكلة في طلب: اطلب رقم الطلب، راجع بيانات طلبات المستخدم، واشرح السبب الدقيق بناءً على البيانات.
2. عند مشكلة في الشحن: أوجّه العميل خطوة بخطوة لطريقة الشحن الصحيحة مع اسم الزر الحقيقي.
3. عند مشكلة في الرصيد: افحص آخر معاملات المستخدم وأعطِ شرحاً واضحاً.
4. عند عدم توفر المنتج: أخبر العميل بوضوح وأقترح بديلاً إن أمكن.
5. إذا لم تجد حلاً قاطعاً: قل بصراحة "هذه المسألة تحتاج تدخل فريق الدعم" واطلب منه الانتظار.

== قيود صارمة لا تُكسر أبداً ==
- ❌ لا ترد على أي سؤال خارج نطاق المتجر (سياسة، أخبار، برمجة، معلومات عامة، ذكاء اصطناعي...إلخ).
- ❌ عند أي سؤال خارجي قل حرفياً: "أنا مساعد متخصص لمتجر ${storeName?.value || "سراقب ستور"} فقط، ولا أستطيع المساعدة في هذا الموضوع. هل لديك سؤال حول خدمات المتجر؟"
- ❌ لا تكشف بيانات مستخدم آخر أبداً ولا تؤكد وجود مستخدم معين.
- ❌ لا تختلق معلومات أو أسعاراً غير موجودة في البيانات أعلاه.
- ❌ لا تكشف أنك ذكاء اصطناعي من أي شركة، أنت فقط "مساعد ${storeName?.value || "سراقب ستور"}".
- ✅ عند السؤال عن رابط البوت: أعطِ "${botLink}" مباشرة.
- ✅ استخدم البيانات الحقيقية الواردة أعلاه فقط (أسعار، أقسام، طرق دفع، روابط).`;

                  const model = aiCfg.model;
                  // [FIX] تحديد المزود بشكل دقيق حسب بادئة اسم الموديل الفعلية
                  // gpt-* / o1-* / o3-* / o4-* → OpenAI | gemini-* → Google | claude-* → Anthropic
                  const provider = /^(gpt-|o[0-9])/i.test(model)
                    ? "openai"
                    : /^gemini-/i.test(model)
                      ? "google"
                      : /^claude-/i.test(model)
                        ? "anthropic"
                        : "unknown";

                  let aiReplyText = "";
                  // معلومات تشخيصية مفصّلة تُستخدم فقط في اللوغ عند الفشل (لا تُرسل للمستخدم)
                  let aiDebugInfo: { provider: string; model: string; status?: number; statusText?: string; body?: string } = {
                    provider, model
                  };

                  if (provider === "unknown") {
                    console.error(
                      `[AI CHAT] ❌ موديل غير معروف ولا يمكن تحديد مزوّده: "${model}". ` +
                      `يجب أن يبدأ الاسم بـ gpt- أو gemini- أو claude-. تحقق من إعدادات الذكاء الاصطناعي في لوحة الأدمن.`
                    );
                  } else if (provider === "openai") {
                    // بناء رسائل المحادثة مع السجل التاريخي
                    const openaiMessages: any[] = [{ role: "system", content: systemPrompt }];
                    // أضف سجل المحادثة السابقة (بدون آخر رسالة المستخدم لتجنب التكرار)
                    const histForApi = conversationHistory.filter((m: any) => m.content !== content);
                    openaiMessages.push(...histForApi.slice(-6));
                    openaiMessages.push({ role: "user", content });

                    const aiRes = await fetch("https://api.openai.com/v1/chat/completions", {
                      method: "POST",
                      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${realApiKey}` },
                      body: JSON.stringify({
                        model,
                        messages: openaiMessages,
                        max_completion_tokens: 800
                      })
                    });
                    const rawBody = await aiRes.text();
                    aiDebugInfo = { provider, model, status: aiRes.status, statusText: aiRes.statusText, body: rawBody.slice(0, 2000) };
                    if (!aiRes.ok) {
                      console.error(`[AI CHAT] ❌ OpenAI API فشل — status: ${aiRes.status} ${aiRes.statusText} | model: ${model} | response: ${rawBody.slice(0, 1500)}`);
                    } else {
                      try {
                        const aiData = JSON.parse(rawBody);
                        aiReplyText = aiData?.choices?.[0]?.message?.content || "";
                        if (!aiReplyText) {
                          console.error(`[AI CHAT] ⚠️ OpenAI رجّع استجابة ناجحة لكن بدون نص رد. الاستجابة الكاملة: ${rawBody.slice(0, 1500)}`);
                        }
                      } catch (parseErr: any) {
                        console.error(`[AI CHAT] ❌ فشل تحليل JSON من استجابة OpenAI: ${parseErr.message} | raw: ${rawBody.slice(0, 1500)}`);
                      }
                    }
                  } else if (provider === "google") {
                    // بناء سجل المحادثة لـ Gemini
                    const geminiContents: any[] = [];
                    const histForGemini = conversationHistory.filter((m: any) => m.content !== content);
                    for (const hm of histForGemini.slice(-6)) {
                      geminiContents.push({ role: hm.role === "assistant" ? "model" : "user", parts: [{ text: hm.content }] });
                    }
                    geminiContents.push({ role: "user", parts: [{ text: content }] });

                    const aiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json", "x-goog-api-key": realApiKey },
                      body: JSON.stringify({
                        system_instruction: { parts: [{ text: systemPrompt }] },
                        contents: geminiContents
                      })
                    });
                    const rawBody = await aiRes.text();
                    aiDebugInfo = { provider, model, status: aiRes.status, statusText: aiRes.statusText, body: rawBody.slice(0, 2000) };
                    if (!aiRes.ok) {
                      console.error(`[AI CHAT] ❌ Gemini API فشل — status: ${aiRes.status} ${aiRes.statusText} | model: ${model} | response: ${rawBody.slice(0, 1500)}`);
                    } else {
                      try {
                        const aiData = JSON.parse(rawBody);
                        aiReplyText = aiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
                        if (!aiReplyText) {
                          const blockReason = aiData?.promptFeedback?.blockReason;
                          console.error(`[AI CHAT] ⚠️ Gemini رجّع استجابة ناجحة لكن بدون نص رد. blockReason: ${blockReason || "غير محدد"} | الاستجابة الكاملة: ${rawBody.slice(0, 1500)}`);
                        }
                      } catch (parseErr: any) {
                        console.error(`[AI CHAT] ❌ فشل تحليل JSON من استجابة Gemini: ${parseErr.message} | raw: ${rawBody.slice(0, 1500)}`);
                      }
                    }
                  } else if (provider === "anthropic") {
                    // بناء سجل المحادثة لـ Anthropic
                    const anthropicMessages: any[] = [];
                    const histForAnthropic = conversationHistory.filter((m: any) => m.content !== content);
                    anthropicMessages.push(...histForAnthropic.slice(-6));
                    anthropicMessages.push({ role: "user", content });

                    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        "x-api-key": realApiKey,
                        "anthropic-version": "2023-06-01"
                      },
                      body: JSON.stringify({
                        model,
                        system: systemPrompt,
                        messages: anthropicMessages,
                        max_tokens: 800
                      })
                    });
                    const rawBody = await aiRes.text();
                    aiDebugInfo = { provider, model, status: aiRes.status, statusText: aiRes.statusText, body: rawBody.slice(0, 2000) };
                    if (!aiRes.ok) {
                      console.error(`[AI CHAT] ❌ Anthropic API فشل — status: ${aiRes.status} ${aiRes.statusText} | model: ${model} | response: ${rawBody.slice(0, 1500)}`);
                    } else {
                      try {
                        const aiData = JSON.parse(rawBody);
                        aiReplyText = aiData?.content?.[0]?.text || "";
                        if (!aiReplyText) {
                          console.error(`[AI CHAT] ⚠️ Anthropic رجّع استجابة ناجحة لكن بدون نص رد. الاستجابة الكاملة: ${rawBody.slice(0, 1500)}`);
                        }
                      } catch (parseErr: any) {
                        console.error(`[AI CHAT] ❌ فشل تحليل JSON من استجابة Anthropic: ${parseErr.message} | raw: ${rawBody.slice(0, 1500)}`);
                      }
                    }
                  }

                  if (aiReplyText) {
                    await supabase.from("messages").insert({
                      user_id, guest_id, sender_role: "admin", content: aiReplyText, type: "bot_reply"
                    });
                  } else {
                    // [FIX] لا يجوز ترك المستخدم بدون أي رد عند فشل الذكاء الاصطناعي.
                    // نسجّل اللوغ المفصّل أعلاه للأدمن/المطوّر، ونرسل رسالة احتياطية مهذّبة للمستخدم
                    // كي لا يبقى منتظراً بصمت لرد لن يأتي أبداً.
                    console.error(`[AI CHAT] ⚠️ لم يصل رد من الذكاء الاصطناعي — تم إرسال رد احتياطي للمستخدم. تفاصيل كاملة: ${JSON.stringify(aiDebugInfo)}`);
                    await supabase.from("messages").insert({
                      user_id, guest_id, sender_role: "admin",
                      content: "عذراً، تعذّر الحصول على رد تلقائي حالياً. فريق الدعم الفني سيتواصل معك في أقرب وقت 🙏",
                      type: "bot_reply"
                    });
                  }
                } catch (aiErr: any) {
                  // [FIX] لوغ مفصّل يشمل الرسالة والـ stack الكامل، بدل console.error(aiErr) المختصر سابقاً
                  console.error(
                    `[AI CHAT] ❌ خطأ غير متوقع في معالجة رد الذكاء الاصطناعي:\n` +
                    `الرسالة: ${aiErr?.message || aiErr}\n` +
                    `Stack: ${aiErr?.stack || "غير متاح"}`
                  );
                  // رد احتياطي حتى في حالة الاستثناء الكامل (مثل فشل فك تشفير المفتاح)
                  try {
                    await supabase.from("messages").insert({
                      user_id, guest_id, sender_role: "admin",
                      content: "عذراً، تعذّر الحصول على رد تلقائي حالياً. فريق الدعم الفني سيتواصل معك في أقرب وقت 🙏",
                      type: "bot_reply"
                    });
                  } catch (insertErr: any) {
                    console.error(`[AI CHAT] ❌ فشل أيضاً في إرسال الرد الاحتياطي: ${insertErr?.message || insertErr}`);
                  }
                }
              }
            }
          }
        }
      } else if (user_id) {
        sendPushNotification(user_id, "رد من الدعم", "لقد تلقيت رداً جديداً.");
        sendTelegramToUser(user_id, `💬 رد جديد من الدعم الفني:\n${content || "[صورة]"}`);
      }

      res.json({ success: true, id: msg.id });
    } catch (e: any) {
      safeError(res, e, "فشل إرسال الرسالة، حاول مرة أخرى");
    }
  });

  app.get("/api/chat/messages", async (req, res) => {
    try {
      const { user_id, guest_id } = req.query;

      if (user_id) {
        // [SEC-FIX] IDOR: كان يتحقق من وجود توكن فقط دون مطابقته مع user_id المطلوب.
        const auth = req.headers.authorization || "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : (req.headers["x-user-token"] as string || "");
        if (!token) return res.status(401).json({ error: "يجب تسجيل الدخول" });
        const payload = verifyUserToken(token);
        if (!payload) return res.status(401).json({ error: "الجلسة منتهية، يرجى تسجيل الدخول مجدداً" });
        if (String(payload.sub) !== String(user_id)) {
          logSecurityEvent("chat-idor-attempt", req, `token-user:${payload.sub} requested-user:${user_id}`);
          return res.status(403).json({ error: "غير مصرح بالوصول لهذه المحادثة" });
        }
        const { data: msgs, error } = await supabase
          .from("messages").select("*")
          .eq("user_id", user_id as string)
          .order("created_at");
        if (error) throw error;
        return res.json(Array.isArray(msgs) ? msgs : []);
      }

      if (guest_id) {
        const { data: msgs, error } = await supabase
          .from("messages").select("*")
          .eq("guest_id", guest_id as string)
          .order("created_at");
        if (error) throw error;
        return res.json(Array.isArray(msgs) ? msgs : []);
      }

      res.json([]);
    } catch (e: any) {
      res.json([]);
    }
  });

  // Legacy endpoint: /api/chat/messages/:id
  app.get("/api/chat/messages/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { guest } = req.query;

      if (guest !== "true") {
        // [SEC-FIX] كان هذا المسار مفتوحاً بالكامل بدون أي مصادقة (CWE-306 + IDOR/CWE-639) —
        // أي زائر يستطيع قراءة محادثة أي مستخدم بمجرد تخمين/تعداد الـ id في الرابط.
        const auth = req.headers.authorization || "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : (req.headers["x-user-token"] as string || "");
        if (!token) return res.status(401).json({ error: "يجب تسجيل الدخول" });
        const payload = verifyUserToken(token);
        if (!payload) return res.status(401).json({ error: "الجلسة منتهية، يرجى تسجيل الدخول مجدداً" });
        if (String(payload.sub) !== String(id)) {
          logSecurityEvent("chat-idor-attempt", req, `token-user:${payload.sub} requested-user:${id}`);
          return res.status(403).json({ error: "غير مصرح بالوصول لهذه المحادثة" });
        }
      }

      let query = supabase.from("messages").select("*").order("created_at");
      if (guest === "true") {
        query = query.eq("guest_id", id).is("user_id", null);
      } else {
        query = query.eq("user_id", id);
      }
      const { data, error } = await query;
      if (error) throw error;
      res.json(Array.isArray(data) ? data : []);
    } catch (e: any) {
      res.json([]);
    }
  });

  app.post("/api/chat/mark-read", authenticate, async (req, res) => {
    try {
      const userId = (req as any).userId;
      await supabase.from("messages").update({ is_read: true }).eq("user_id", userId).eq("sender_role", "admin");
      res.json({ success: true });
    } catch (e: any) {
      res.json([]); // safe fallback
    }
  });

  app.post("/api/report-error", generalLimiter, async (req, res) => {
    // طباعة الخطأ بشكل محدود (منع log injection)
    const msg = sanitizeText(String(req.body?.message || ""), 500);
    const stack = sanitizeText(String(req.body?.stack || ""), 1000);
    console.error("Client error:", { message: msg, stack });
    res.json({ ok: true });
  });
  app.get("/api/faqs", async (req, res) => {
    try {
      const { data, error } = await supabase.from("auto_replies").select("id,trigger_text,reply_text").eq("is_faq", true).order("created_at", { ascending: true });
      if (error) throw error;
      res.json(Array.isArray(data) ? data : []);
    } catch (e: any) {
      safeError(res, e, "فشل تحميل الأسئلة الشائعة");
    }
  });
  app.get("/api/currencies", async (req, res) => {
    try {
      const { data, error } = await supabase
        .from("currencies")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const defaultCurrency = (data || []).find((c: any) => c.is_default) || null;
      res.json({ currencies: data || [], defaultCurrency });
    } catch (e: any) {
      safeError(res, e, "فشل تحميل قائمة العملات");
    }
  });

  // 404 for API routes
  app.all("/api/*", (req, res) => {
    res.status(404).json({ error: `Route ${req.method} ${req.url} not found` });
  });

  // [NEW] صمام الأمان — الشبكة الأخيرة: أي خطأ يُفلت من كل try/catch الموجودة
  // في الراوترات أعلاه (استثناء متزامن، next(err)...) يُمسَك هنا بدل أن يُسقط
  // الطلب بلا استجابة أو يُظهر صفحة HTML افتراضية من Express. يجب أن يبقى بعد
  // كل راوترات /api مباشرة (Express يتعرف عليه كـ error handler بسبب 4 معاملات).
  app.use(globalErrorHandler);

  // ============================================================
  // [SEO/GEO] robots.txt — ديناميكي، يسمح صراحة لروبوتات الذكاء
  // الاصطناعي (GPTBot, ClaudeBot, PerplexityBot...) بالإضافة إلى
  // Googlebot، ويحدد رابط sitemap.xml. انظر seo.ts للتفاصيل.
  // ============================================================
  // manifest.json ديناميكي — أيقونات التطبيق من لوغو المتجر في قاعدة البيانات
  // (يجب أن يبقى قبل express.static / vite حتى لا يُخدَّم الملف الثابت بدلاً منه)
  app.get("/manifest.json", async (req, res) => {
    try {
      const manifest = await buildDynamicManifest();
      res.set({ "Content-Type": "application/manifest+json; charset=utf-8", "Cache-Control": "public, max-age=300" });
      res.send(JSON.stringify(manifest));
    } catch (e) {
      res.status(500).json({ error: "manifest unavailable" });
    }
  });

  app.get("/robots.txt", (req, res) => {
    res.type("text/plain").send(buildRobotsTxt());
  });

  // ============================================================
  // [SEO/GEO] sitemap.xml — يُبنى ديناميكياً من قاعدة البيانات
  // الحية (أقسام، أقسام فرعية، منتجات) في كل طلب، لذا يبقى محدَّثاً
  // دائماً بلا الحاجة لإعادة توليده يدوياً بعد كل تعديل في المتجر.
  // ============================================================
  app.get("/sitemap.xml", async (req, res) => {
    try {
      const xml = await buildSitemapXml(supabase);
      res.type("application/xml").send(xml);
    } catch (e: any) {
      safeError(res, e, "فشل توليد خريطة الموقع");
    }
  });

  /**
   * renderIndexWithSeo — يقرأ index.html (من dist في الإنتاج، أو
   * عبر vite.transformIndexHtml في التطوير)، ثم يحقن فيه meta
   * tags/JSON-LD مخصصة لمسار الطلب الحالي قبل الإرسال. هذا يجعل
   * أول HTML يصل لمحركات البحث وروبوتات الذكاء الاصطناعي يحتوي
   * فعلياً على عنوان ووصف وstructured data خاصة بالصفحة، بدل
   * عنوان ووصف ثابتين واحدين لكل صفحات الموقع.
   */
  async function renderIndexWithSeo(req: express.Request, res: express.Response, rawHtml: string) {
    try {
      const [seo, logo] = await Promise.all([resolveSeoForPath(supabase, req.path), getStoreLogoUrl()]);
      const finalHtml = injectSeoIntoHtml(rawHtml, { ...seo, iconUrl: logo });
      res.status(200).set({ "Content-Type": "text/html; charset=utf-8" }).end(finalHtml);
    } catch (e) {
      // في حال أي عطل في محرك الـ SEO، لا نكسر الموقع أبداً — نُرجع الـ HTML الخام
      res.status(200).set({ "Content-Type": "text/html; charset=utf-8" }).end(rawHtml);
    }
  }

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    app.get("*", async (req, res, next) => {
      try {
        const templatePath = path.join(__dirname, "index.html");
        let template = fs.readFileSync(templatePath, "utf-8");
        template = await vite.transformIndexHtml(req.originalUrl, template);
        await renderIndexWithSeo(req, res, template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    app.use(express.static(path.join(__dirname, "dist"), { index: false }));
    app.get("*", async (req, res) => {
      const indexPath = path.join(__dirname, "dist", "index.html");
      const rawHtml = fs.readFileSync(indexPath, "utf-8");
      await renderIndexWithSeo(req, res, rawHtml);
    });
  }

  
  // ============================================================
  // AUTO-REFRESH: تحديث تلقائي لحالة طلبات API كل دقيقتين
  // ============================================================

  /**
   * runAutoRefreshOrders — تجلب كل الطلبات غير المكتملة التي لها UUID وتحدّث حالتها
   */
  const runAutoRefreshOrders = async () => {
    try {
      // [FIX] توحيد المهمة عبر العمليتين (saraqib-user + saraqib-admin): من يحصل على القفل الموزّع
      // فقط يُنفّذ هذه الدورة والآخر يتخطّاها — يمنع التكرار ونداءات المزوّد المضاعفة.
      // القفل ذاتي التعافي عبر TTL، فإن سقطت العملية الحائزة يلتقطها الطرف الآخر لاحقاً.
      const { data: __gotRefreshLock } = await supabase.rpc("try_acquire_job_lock", {
        p_job: "auto_refresh_orders", p_ttl_seconds: 115, p_holder: `saraqib-user:${process.pid}`
      });
      if (!__gotRefreshLock) return;
      // جلب كل الطلبات التي ليست في حالة نهائية
      const { data: pendingOrders } = await supabase
        .from("orders")
        .select("id, meta, user_id, status, total_amount, created_at")
        .not("status", "in", "(completed,cancelled,failed,rejected,pending_admin)");

      if (!pendingOrders?.length) return;

      // نصفّي فقط الطلبات التي لها UUID في الـ meta
      const ordersWithUuid = pendingOrders.filter((order: any) => {
        try {
          const meta = typeof order.meta === "string" ? JSON.parse(order.meta) : (order.meta || {});
          return !!(meta?.ahminix_order_id || meta?.ahminix_order_uuid);
        } catch { return false; }
      });

      if (!ordersWithUuid.length) return;

      console.log(`[AUTO-REFRESH] فحص ${ordersWithUuid.length} طلب لهم UUID...`);

      for (const order of ordersWithUuid) {
        try {
          const meta = typeof order.meta === "string" ? JSON.parse(order.meta) : (order.meta || {});
          const ahminixId   = meta?.ahminix_order_id;
          const ahminixUuid = meta?.ahminix_order_uuid;
          if (!ahminixId && !ahminixUuid) continue;

          // جلب المزود المرتبط
          let autoProvider: any = null;
          if (meta?.provider_id) autoProvider = await getProvider(Number(meta.provider_id));
          if (!autoProvider) {
            const { data: autoOi } = await supabase.from("order_items").select("product_id").eq("order_id", order.id).single();
            if (autoOi?.product_id) autoProvider = await getProviderForProduct(autoOi.product_id);
          }
          if (!autoProvider) continue;

          // دالة الجلب مع fallback
          const doCheck = async () => {
            let r: any = null;
            if (autoProvider.provider_type === "megaapi") {
              if (ahminixUuid) {
                r = await megaApiCheckOrderByUuid(autoProvider.base_url, autoProvider.api_token, ahminixUuid);
                if (!r?.data?.[0]) r = null;
              }
              if (!r && ahminixId) r = await megaApiCheckOrder(autoProvider.base_url, autoProvider.api_token, ahminixId);
            } else {
              if (ahminixUuid && ahminixUuid !== String(ahminixId)) {
                r = await providerCheckOrder(autoProvider.base_url, autoProvider.api_token, ahminixUuid, true);
                if (r?.status !== "OK" || !r?.data?.[0]) r = null;
              }
              if (!r && ahminixId) {
                r = await providerCheckOrder(autoProvider.base_url, autoProvider.api_token, ahminixId, String(ahminixId).includes("-"));
              }
            }
            return r;
          };

          // استخدام getFinalOrderStatus — لا نحكم بالرفض إلا بعد 3 محاولات
          const { status: newStatus, raw: rawStatus, data: ext } = await getFinalOrderStatus(doCheck, 3, 1000);

          if (!ext) continue;

          // إذا لا يزال في معالجة ولم يتغير → تخطَّ
          const currentIsProcessing = ["processing", "pending"].includes(order.status);
          if (newStatus === "processing" && currentIsProcessing) continue;

          const normalizedReplay = normalizeReplayApi(ext.replay_api);

          // تحديث الطلب في قاعدة البيانات إذا تغيرت الحالة
          if (newStatus !== order.status) {
            const updatedMeta = {
              ...meta,
              ahminix_status: rawStatus,
              ahminix_replay: normalizedReplay,
              completed_at: new Date().toISOString(),
              ...(RESPONSE_TIME_FINAL_STATUSES.has(newStatus)
                ? { response_time_seconds: meta?.response_time_seconds ?? calcResponseTimeSeconds(order.created_at) }
                : {})
            };
            await supabase.from("orders").update({
              status: newStatus,
              meta: JSON.stringify(updatedMeta)
            }).eq("id", order.id);

            // إعادة الرصيد إذا ألغي — استرجاع ذرّي وحيد (idempotent)
            if (newStatus === "cancelled") {
              await supabase.rpc("refund_order_once", { p_order_id: order.id });
            }

            // إشعار push للمستخدم
            if (order.user_id) {
              const notifTitle = newStatus === "completed" ? "✅ تم تنفيذ طلبك!" : "❌ تم إلغاء طلبك";
              const notifBody = newStatus === "completed"
                ? `تم تنفيذ طلب ${meta?.product_name || ""} بنجاح`
                : `تم إلغاء طلب ${meta?.product_name || ""} وإعادة رصيدك`;
              await sendPushNotification(String(order.user_id), notifTitle, notifBody, "/");
              await supabase.from("notifications").insert({
                user_id: order.user_id,
                title: notifTitle,
                message: notifBody,
                type: newStatus === "completed" ? "success" : "warning"
              });
            }

            // إشعار تلجرام للمستخدم
            const { data: userTg } = await supabase
              .from("users").select("telegram_chat_id, name").eq("id", order.user_id).single();

            if (userTg?.telegram_chat_id && userBot) {
              if (newStatus === "completed") {
                let msg = `✅ تم تنفيذ طلبك!\n\nالطلب: #ORD${order.id}\nالمنتج: ${meta?.product_name || ""}`;
                if (normalizedReplay.length > 0) {
                  msg += `\n\n🎁 بيانات التفعيل:\n${normalizedReplay.join("\n")}`;
                }
                userBot.sendMessage(userTg.telegram_chat_id, msg).catch(() => {});
              } else {
                userBot.sendMessage(
                  userTg.telegram_chat_id,
                  `❌ تم إلغاء طلبك #ORD${order.id} وتم إعادة رصيدك.`
                ).catch(() => {});
              }
            }

            console.log(`[AUTO-REFRESH] Order #${order.id}: ${order.status} → ${newStatus} (API: ${rawStatus}), replay=${normalizedReplay.length}`);
          }
        } catch (e: any) {
          console.error(`[AUTO-REFRESH] Error on order #${order.id}:`, e.message);
        }
      }
    } catch (e: any) {
      console.error("[AUTO-REFRESH] Error:", e.message);
    }
  };

  // AUTO-REFRESH يعمل دائماً — المزودين يُجلَبون ديناميكياً من DB
  setTimeout(runAutoRefreshOrders, 8000);
  setInterval(runAutoRefreshOrders, 2 * 60 * 1000);
  console.log("[AUTO-REFRESH] Started — checking pending orders every 2 minutes");

  // =================== MEGAAPI WEBHOOK ===================
  // Rate-limit بسيط للـ webhook: max 60 طلب/دقيقة لتجنب DoS
  const webhookCallTimes: number[] = [];
  app.post("/api/webhook/megaapi", async (req, res) => {
    // رد فوري على mega-game.net لتجنب timeout
    res.json({ received: true });
    try {
      const now = Date.now();
      // نظّف الطلبات الأقدم من دقيقة
      while (webhookCallTimes.length && now - webhookCallTimes[0] > 60_000) webhookCallTimes.shift();
      if (webhookCallTimes.length >= 60) {
        console.warn("[WEBHOOK:MEGAAPI] Rate limit exceeded");
        return;
      }
      webhookCallTimes.push(now);

      const payload = req.body;
      const order = payload?.data?.order || payload?.order || payload;
      const orderNumber: string = String(order?.order_number || order?.order_id || "").trim();
      const uuid: string = String(order?.uuid || "").trim();

      if (!orderNumber && !uuid) return;

      // -------- البحث الدقيق عبر JSON في meta (بدل تحميل كل الطلبات) --------
      let matchOrder: any = null;
      if (orderNumber) {
        const { data: rows } = await supabase
          .from("orders")
          .select("id, user_id, status, total_amount, meta, created_at")
          .not("status", "in", "(completed,cancelled,failed,rejected)")
          .ilike("meta", `%${orderNumber}%`)
          .limit(5);
        matchOrder = rows?.find((o: any) => {
          try {
            const m = typeof o.meta === "string" ? JSON.parse(o.meta) : (o.meta || {});
            return m?.ahminix_order_id === orderNumber;
          } catch { return false; }
        }) ?? null;
      }
      if (!matchOrder && uuid) {
        const { data: rows } = await supabase
          .from("orders")
          .select("id, user_id, status, total_amount, meta, created_at")
          .not("status", "in", "(completed,cancelled,failed,rejected)")
          .ilike("meta", `%${uuid}%`)
          .limit(5);
        matchOrder = rows?.find((o: any) => {
          try {
            const m = typeof o.meta === "string" ? JSON.parse(o.meta) : (o.meta || {});
            return m?.ahminix_order_uuid === uuid;
          } catch { return false; }
        }) ?? null;
      }

      if (!matchOrder) {
        console.log(`[WEBHOOK:MEGAAPI] Order not found: number=${orderNumber} uuid=${uuid}`);
        return;
      }

      const meta = typeof matchOrder.meta === "string" ? JSON.parse(matchOrder.meta) : (matchOrder.meta || {});

      // -------- التحقق من الحالة عبر API مباشرة (لا نثق بالـ payload وحده) --------
      const webhookProviderId = meta?.provider_id;
      if (!webhookProviderId) return;
      const webhookProvider = await getProvider(Number(webhookProviderId));
      if (!webhookProvider || webhookProvider.provider_type !== "megaapi") return;

      const verifyUuid = meta?.ahminix_order_uuid || uuid;
      const verifyId   = meta?.ahminix_order_id || orderNumber;
      let verified: any = null;
      if (verifyUuid) {
        verified = await megaApiCheckOrderByUuid(webhookProvider.base_url, webhookProvider.api_token, verifyUuid);
        if (!verified?.data?.[0]) verified = null;
      }
      if (!verified && verifyId) {
        verified = await megaApiCheckOrder(webhookProvider.base_url, webhookProvider.api_token, verifyId);
      }
      if (!verified?.data?.[0]) {
        console.warn(`[WEBHOOK:MEGAAPI] Could not verify order from API: ${orderNumber}`);
        return;
      }

      const ext = verified.data[0];
      const verifiedStatus = normalizeOrderStatus(ext.status || "");
      if (verifiedStatus === "processing") return;
      if (matchOrder.status === verifiedStatus) return;

      const replayApi = normalizeReplayApi(ext.replay_api);
      const updatedMeta = {
        ...meta,
        ahminix_status: ext.status,
        ahminix_replay: replayApi,
        completed_at: new Date().toISOString(),
        response_time_seconds: meta?.response_time_seconds ?? calcResponseTimeSeconds(matchOrder.created_at),
      };

      await supabase.from("orders").update({
        status: verifiedStatus,
        meta: JSON.stringify(updatedMeta)
      }).eq("id", matchOrder.id);

      if (verifiedStatus === "cancelled") {
        // استرجاع ذرّي وحيد (idempotent) — يمنع الاسترجاع المزدوج
        await supabase.rpc("refund_order_once", { p_order_id: matchOrder.id });
      }

      if (matchOrder.user_id) {
        const notifTitle = verifiedStatus === "completed" ? "✅ تم تنفيذ طلبك!" : "❌ تم إلغاء طلبك";
        const notifBody = verifiedStatus === "completed"
          ? `تم تنفيذ طلب ${meta?.product_name || ""} بنجاح`
          : `تم إلغاء طلب ${meta?.product_name || ""} وإعادة رصيدك`;
        await sendPushNotification(String(matchOrder.user_id), notifTitle, notifBody, "/").catch(() => {});
        await supabase.from("notifications").insert({
          user_id: matchOrder.user_id,
          title: notifTitle,
          message: notifBody,
          type: verifiedStatus === "completed" ? "success" : "warning"
        });
      }
      console.log(`[WEBHOOK:MEGAAPI] Order #${matchOrder.id} (${orderNumber}): → ${verifiedStatus} (verified)`);
    } catch (e: any) {
      console.error("[WEBHOOK:MEGAAPI] Error:", e.message);
    }
  });
  // =======================================================


  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // [FIX] مزامنة المزوّدين الدورية (autoSyncProducts) أُزيلت من هذا المشروع — كانت نسخة أبسط
  // مكررة حرفياً من saraqib-admin تعمل بشكل مستقل كل 5 دقائق على نفس جدولي providers/products
  // وتستدعي نفس API المزوّدين الخارجي بشكل متزامن مع نسخة saraqib-admin (التي كانت تعمل كل ساعة) —
  // ضغط مضاعف على القاعدة وAPI المزوّدين لنفس الغرض بالضبط. وُحّدت المزامنة في saraqib-admin فقط
  // (نسختها أكمل: فيها حساب هامش الربح وتزامن الكميات/الباقات)، ورُفع ترددها إلى 5 دقائق لتبقى
  // نفس درجة حداثة المخزون للمتجر كما كانت تماماً — لا تغيير وظيفي من منظور هذا المتجر.

  // Graceful shutdown
  const shutdown = () => {
    console.log("Shutting down gracefully...");
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  // [NEW] uncaughtException/unhandledRejection أصبحا مُعالَجين مركزياً عبر
  // installGlobalCrashGuards() في بداية startServer (صمام الأمان + تنبيه تيليجرام)
}


// ============================================================
// HELPER: حذف مستخدم مع كل بياناته المرتبطة
// ============================================================
async function deleteUserCompletely(userId: string) {
  // الترتيب مهم - نحذف الجداول الفرعية أولاً قبل الجداول الرئيسية
  await supabase.from("order_items").delete().in(
    "order_id",
    (await supabase.from("orders").select("id").eq("user_id", userId)).data?.map((o: any) => o.id) || []
  );
  await supabase.from("orders").delete().eq("user_id", userId);
  await supabase.from("transactions").delete().eq("user_id", userId);
  await supabase.from("notifications").delete().eq("user_id", userId);
  await supabase.from("messages").delete().eq("user_id", userId);
  await supabase.from("voucher_uses").delete().eq("user_id", userId);
  await supabase.from("push_subscriptions").delete().eq("user_id", userId);
  await supabase.from("daily_message_counts").delete().eq("user_id", userId);
  await supabase.from("telegram_linking_codes").delete().eq("user_id", userId);
  await supabase.from("user_stats").delete().eq("user_id", userId);
  // أخيراً نحذف المستخدم نفسه
  const { error } = await supabase.from("users").delete().eq("id", userId);
  if (error) throw error;
}

// ============================================================
// BOTS STARTUP
// ============================================================

startServer();
