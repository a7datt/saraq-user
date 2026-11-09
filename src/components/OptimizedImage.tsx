import React from "react";

/**
 * مكون صورة محسّن لتسريع التحميل:
 * - يمرر الصورة عبر خدمة images.weserv.nl لإعادة ضغطها وتصغيرها
 *   حسب حجم العرض الفعلي على الشاشة (بدل تحميل الصورة بحجمها الأصلي الكامل).
 * - يدعم lazy loading + decoding async بشكل تلقائي.
 * - في حال فشل خدمة الضغط (أو رابط محلي / data: / svg) يتم استخدام الرابط الأصلي تلقائياً كـ fallback.
 */

export interface OptimizedImageProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, "src" | "loading"> {
  src?: string | null;
  /** العرض المستهدف بالبكسل (يُستخدم لتحديد جودة/حجم الضغط) */
  width?: number;
  /** الارتفاع المستهدف بالبكسل */
  height?: number;
  /** جودة الصورة الناتجة 1-100 (افتراضي 75) */
  quality?: number;
  /** تعطيل التحميل الكسول (lazy) عند الحاجة لعرض فوري */
  eager?: boolean;
}

const shouldSkipOptimization = (url: string) => {
  return (
    url.startsWith("data:") ||
    url.startsWith("blob:") ||
    url.endsWith(".svg") ||
    url.includes("weserv.nl") ||
    // [FIX] صور حسابات Google (avatar عبر تسجيل الدخول بـ Google) غالباً ما ترفضها
    // خدمة weserv.nl بـ 404 (Google تمنع الجلب من طرف ثالث بلا referrer صحيح)، فنعرض
    // الرابط الأصلي مباشرة بدل المرور بالخدمة والانتظار للفشل أولاً.
    url.includes("googleusercontent.com")
  );
};

export const getOptimizedSrc = (
  url?: string | null,
  width: number = 400,
  height?: number,
  quality: number = 75
): string => {
  if (!url) return "";
  if (shouldSkipOptimization(url)) return url;

  try {
    // إزالة البروتوكول لأن weserv يتطلب رابطاً بدون http(s)://
    const cleanUrl = url.replace(/^https?:\/\//, "");
    const params = new URLSearchParams();
    params.set("url", cleanUrl);
    params.set("w", String(Math.round(width)));
    if (height) params.set("h", String(Math.round(height)));
    params.set("q", String(quality));
    params.set("fit", "cover");
    params.set("output", "webp");
    params.set("we", ""); // without enlargement خارج هذا السياق - يحافظ على جودة جيدة
    return `https://images.weserv.nl/?${params.toString()}`;
  } catch {
    return url;
  }
};

const OptimizedImage = React.forwardRef<HTMLImageElement, OptimizedImageProps>(
  ({ src, width = 400, height, quality = 75, eager = false, className, alt = "", referrerPolicy, onError, ...rest }, ref) => {
    const [failed, setFailed] = React.useState(false);
    React.useEffect(() => { setFailed(false); }, [src]);
    const optimizedSrc = React.useMemo(() => getOptimizedSrc(src, width, height, quality), [src, width, height, quality]);
    const finalSrc = failed ? (src || "") : optimizedSrc;

    if (!src) return null;

    return (
      <img
        ref={ref}
        src={finalSrc}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        referrerPolicy={referrerPolicy ?? "no-referrer"}
        className={className}
        onError={(e) => {
          if (!failed) {
            setFailed(true);
          }
          onError?.(e);
        }}
        {...rest}
      />
    );
  }
);

OptimizedImage.displayName = "OptimizedImage";

export default OptimizedImage;
