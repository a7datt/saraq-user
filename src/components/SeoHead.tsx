/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * SeoHead — يحدّث <title> ووسوم meta الأساسية على جهة العميل عند
 * تنقّل المستخدم بين الصفحات داخل الـ SPA (بعد التحميل الأول).
 *
 * التحميل الأول (أهم حالة لمحركات البحث وروبوتات الذكاء الاصطناعي)
 * تتم معالجته على مستوى السيرفر في seo.ts + server.ts، وهذا المكوّن
 * يكمّل التجربة فقط لتنقلات المستخدم الحقيقي داخل المتصفح (مثال:
 * عند فتح المنتج من الصفحة الرئيسية بدون إعادة تحميل الصفحة)، بحيث
 * يبقى عنوان التبويب ووسوم المشاركة الاجتماعية صحيحين طوال الجلسة.
 */
import { useEffect } from "react";

interface SeoHeadProps {
  title?: string;
  description?: string;
  /** رابط الصورة المستخدمة عند مشاركة الصفحة (Open Graph) */
  image?: string;
  /** كائن أو مصفوفة كائنات JSON-LD إضافية خاصة بهذه الصفحة (مثلاً Product/ItemList) */
  jsonLd?: Record<string, any> | Record<string, any>[];
}

function setMeta(selector: string, attr: "content", value: string) {
  const el = document.querySelector(selector);
  if (el) el.setAttribute(attr, value);
}

export default function SeoHead({ title, description, image, jsonLd }: SeoHeadProps) {
  useEffect(() => {
    if (title) {
      document.title = title;
      setMeta('meta[property="og:title"]', "content", title);
      setMeta('meta[name="twitter:title"]', "content", title);
    }
    if (description) {
      setMeta('meta[name="description"]', "content", description);
      setMeta('meta[property="og:description"]', "content", description);
      setMeta('meta[name="twitter:description"]', "content", description);
    }
    if (image) {
      setMeta('meta[property="og:image"]', "content", image);
      setMeta('meta[name="twitter:image"]', "content", image);
    }

    // canonical
    if (typeof window !== "undefined") {
      let canonicalEl = document.querySelector('link[rel="canonical"]');
      if (canonicalEl) canonicalEl.setAttribute("href", window.location.href.split("#")[0]);
    }

    // حقن JSON-LD خاص بالصفحة الحالية (نزيل أي كتلة سابقة أضفناها نحن فقط
    // عبر data-attribute مميز، حتى لا نتراكم أو نمس الكتل الأصلية في index.html)
    const existing = document.querySelectorAll('script[data-seo-dynamic="true"]');
    existing.forEach((n) => n.remove());

    if (jsonLd) {
      const blocks = Array.isArray(jsonLd) ? jsonLd : [jsonLd];
      blocks.forEach((obj) => {
        const script = document.createElement("script");
        script.type = "application/ld+json";
        script.setAttribute("data-seo-dynamic", "true");
        script.textContent = JSON.stringify(obj);
        document.head.appendChild(script);
      });
    }

    return () => {
      // عند مغادرة الصفحة نترك الوسوم كما هي (ستُحدَّث بالصفحة التالية)
      // لكن ننظّف كتل JSON-LD الديناميكية الخاصة بهذه الصفحة تحديداً
      const dynamicBlocks = document.querySelectorAll('script[data-seo-dynamic="true"]');
      dynamicBlocks.forEach((n) => n.remove());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, image, JSON.stringify(jsonLd)]);

  return null;
}
