import crypto from "crypto";

// نسبة عمولة/بونص طريقة الدفع: تُطبَّق على مبلغ الشحن (بالدولار) قبل إضافته لرصيد المستخدم.
// commission: تخصم من المبلغ (شحن 100$ بعمولة 10% => يحصل المستخدم على 90$)
// bonus: تُضاف للمبلغ (شحن 100$ ببونص 10% => يحصل المستخدم على 110$)
export function applyPaymentMethodBonus(amount: number, method: { bonus_type?: string | null; bonus_percent?: number | null } | null | undefined): number {
  if (!method || !method.bonus_type || !method.bonus_percent) return amount;
  const pct = parseFloat(String(method.bonus_percent));
  if (isNaN(pct) || pct <= 0) return amount;
  if (method.bonus_type === "commission") {
    return parseFloat((amount * (1 - pct / 100)).toFixed(4));
  } else if (method.bonus_type === "bonus") {
    return parseFloat((amount * (1 + pct / 100)).toFixed(4));
  }
  return amount;
}

export const AUTO_CHARGE_CODE_CHARS = "0123456789";
/** يولّد رمزاً عشوائياً آمناً تشفيرياً من 6 خانات أرقام فقط (بلا أي أحرف إنجليزية) —
 * أرقام فقط لتجنّب التباس حروف صعبة الكتابة/القراءة بملاحظة التحويل لدى المستخدم. */
export function generateAutoChargeCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

/** مقارنة ثابتة الزمن تتجنّب تسريب معلومات عبر فروقات التوقيت، وتتعامل بأمان مع الأطوال المختلفة */
export function timingSafeEqualStrings(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // نقارن مع نفسه لإبقاء زمن التنفيذ شبه ثابت حتى عند اختلاف الطول، بدل الرجوع فوراً
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

const ENCRYPT_ALGO = "aes-256-gcm";

/**
 * تشفير نص باستخدام AES-256-GCM
 * الناتج: iv:authTag:ciphertext (كل جزء base64)
 */
export function encryptProviderData(plaintext: string, keyHex: string = process.env.PROVIDER_ENCRYPTION_KEY || ""): string {
  if (!keyHex) throw new Error("PROVIDER_ENCRYPTION_KEY غير مضبوط");
  const key = Buffer.from(keyHex, "hex");
  const iv = crypto.randomBytes(12); // 96-bit IV for GCM
  const cipher = crypto.createCipheriv(ENCRYPT_ALGO, key, iv) as any;
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

/**
 * فك تشفير نص مشفر بـ AES-256-GCM
 */
export function decryptProviderData(ciphertext: string, keyHex: string = process.env.PROVIDER_ENCRYPTION_KEY || ""): string {
  if (!keyHex) throw new Error("PROVIDER_ENCRYPTION_KEY غير مضبوط");
  const parts = ciphertext.split(":");
  if (parts.length !== 3) throw new Error("تنسيق التشفير غير صحيح");
  const [ivB64, tagB64, dataB64] = parts;
  const key = Buffer.from(keyHex, "hex");
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const encrypted = Buffer.from(dataB64, "base64");
  const decipher = crypto.createDecipheriv(ENCRYPT_ALGO, key, iv) as any;
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

/**
 * يتحقق هل القيمة مشفرة بتنسيق iv:tag:data
 */
export function isEncrypted(value: string): boolean {
  if (!value) return false;
  const parts = value.split(":");
  return parts.length === 3 && parts.every(p => /^[A-Za-z0-9+/=]+$/.test(p));
}
