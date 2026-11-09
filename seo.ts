/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * ============================================================
 *  seo.ts — محرك الـ SEO / GEO (تصدّر نتائج بحث جوجل ومحركات
 *  الذكاء الاصطناعي مثل ChatGPT وPerplexity وGemini وGoogle AI
 *  Overviews) الخاص بمتجر Saraqib Store.
 * ============================================================
 *
 * هذا الملف مسؤول عن:
 *   1) توليد <title> / meta description ديناميكية لكل صفحة (SSR-lite)
 *      قبل إرسال index.html — ضروري لأن الزواحف (Googlebot، وأغلب
 *      روبوتات الذكاء الاصطناعي مثل GPTBot و ClaudeBot و PerplexityBot)
 *      لا تُنفّذ جافاسكربت React بشكل موثوق، فيجب أن يكون المحتوى
 *      الأساسي + الـ meta موجودَين في أول HTML يصل إليها.
 *   2) حقن JSON-LD (Schema.org) مناسب لكل نوع صفحة:
 *      Organization, WebSite+SearchAction, BreadcrumbList,
 *      Product/Offer, ItemList, FAQPage.
 *   3) توليد robots.txt ديناميكي (يسمح صراحة لروبوتات الذكاء
 *      الاصطناعي الرئيسية إضافة لـ Googlebot).
 *   4) توليد sitemap.xml ديناميكي من قاعدة البيانات (أقسام،
 *      أقسام فرعية، منتجات) بدل ملف ثابت يصبح قديماً.
 *
 * كل شيء هنا يعتمد على بيانات حقيقية من Supabase — لا توجد أي
 * بيانات وهمية أو placeholder يظهر للمستخدم النهائي أو للروبوتات.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ------------------------------------------------------------------
// الإعدادات الأساسية القابلة للتعديل عبر متغيرات البيئة
// ------------------------------------------------------------------
// SITE_URL يجب ضبطه في .env على الدومين الحقيقي بدون / في النهاية
// مثال: SITE_URL="https://saraqib.store"
export const SITE_URL = (process.env.SITE_URL || process.env.FRONTEND_URL || "https://saraqib.store").replace(/\/+$/, "");
export const DEFAULT_STORE_NAME = "سراقب ستور";
export const DEFAULT_LOCALE = "ar_SY";

// صورة افتراضية للمشاركة الاجتماعية (Open Graph) في حال لم يوجد شعار مخصص
const DEFAULT_OG_IMAGE = `${SITE_URL}/logo.svg`; // احتياطي أخير فقط — اللوغو الفعلي يُجلب من store_appearance

/** يحوّل رابط نسبي (مثل /uploads/x.png) إلى رابط مطلق، لأن og:image وJSON-LD يتطلبان رابطاً مطلقاً */
export function absUrl(u: string): string {
  if (!u) return u;
  if (/^https?:\/\//i.test(u)) return u;
  return `${SITE_URL}${u.startsWith("/") ? "" : "/"}${u}`;
}

export interface SeoMeta {
  title: string;
  description: string;
  keywords?: string;
  canonical: string;
  ogImage?: string;
  /** لوغو المتجر (من قاعدة البيانات) — يُستخدم لأيقونات الصفحة favicon/apple-touch-icon */
  iconUrl?: string;
  jsonLd?: Record<string, any>[];
  noindex?: boolean;
}

function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function truncate(s: string, max: number): string {
  const clean = String(s ?? "").replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return clean.slice(0, max - 1).trimEnd() + "…";
}

/** يحوّل نص HTML بسيط أو نص خام إلى نص عادي صالح لوصف ميتا */
function stripHtml(s: string): string {
  return String(s ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

// ------------------------------------------------------------------
// Organization + WebSite JSON-LD — يظهر في كل الصفحات (ثابت للهوية)
// هذا ما يسمح لجوجل ولمحركات الذكاء الاصطناعي بالتعرف على الكيان
// (Entity) "Saraqib Store" وربطه بمعرفة موثوقة (Knowledge Graph)
// ------------------------------------------------------------------
export function buildOrganizationJsonLd(storeName: string, logoUrl?: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: storeName,
    alternateName: "Saraqib Store",
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: logoUrl || DEFAULT_OG_IMAGE,
    },
    image: logoUrl || DEFAULT_OG_IMAGE,
    description:
      "سراقب ستور منصة عربية متخصصة في شحن الألعاب والتطبيقات وبطاقات الهدايا الرقمية، مثل شحن شدات ببجي، جواهر فري فاير، شام كاش، سيرياتيل كاش، وبطاقات هدايا عالمية، بتسليم فوري وأسعار منافسة ودعم فني على مدار الساعة.",
    sameAs: [] as string[],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      areaServed: "SY",
      availableLanguage: ["Arabic", "ar"],
    },
  };
}

export function buildWebSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL,
    name: DEFAULT_STORE_NAME,
    inLanguage: "ar",
    publisher: { "@id": `${SITE_URL}/#organization` },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function buildBreadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.url,
    })),
  };
}

// ------------------------------------------------------------------
// توليد الميتا لكل نوع صفحة — القلب النابض لهذا الملف
// ------------------------------------------------------------------
export async function resolveSeoForPath(
  supabase: SupabaseClient,
  pathname: string
): Promise<SeoMeta> {
  const path = pathname.replace(/\/+$/, "") || "/";
  const canonical = `${SITE_URL}${path === "/" ? "" : path}`;

  // اسم المتجر الحقيقي من قاعدة البيانات إن وُجد
  let storeName = DEFAULT_STORE_NAME;
  let logoUrl: string | undefined;
  try {
    const { data } = await supabase
      .from("settings")
      .select("key,value")
      .in("key", ["store_name", "logo_url", "site_description"]);
    const map: Record<string, string> = {};
    (data || []).forEach((r: any) => (map[r.key] = r.value));
    if (map.store_name) storeName = map.store_name;
    if (map.logo_url) logoUrl = map.logo_url;
  } catch {
    /* تجاهل — استخدم الافتراضي */
  }
  // اللوغو الحقيقي يضبطه الأدمن من "مظهر المتجر" ويُحفظ في store_appearance (له الأولوية)
  try {
    const { data: ap } = await supabase.from("store_appearance").select("logo_url").eq("id", 1).maybeSingle();
    if (ap?.logo_url) logoUrl = String(ap.logo_url).trim();
  } catch {
    /* تجاهل */
  }
  if (logoUrl) logoUrl = absUrl(logoUrl);
  const fallbackImage = logoUrl || DEFAULT_OG_IMAGE;

  const orgLd = buildOrganizationJsonLd(storeName, logoUrl);
  const siteLd = buildWebSiteJsonLd();

  // -------------------- الصفحة الرئيسية --------------------
  if (path === "/" || path === "/home") {
    return {
      title: `${storeName} — أفضل متجر عربي لشحن الألعاب وبطاقات الهدايا | شحن فوري`,
      description:
        "سراقب ستور: شحن فوري لشدات ببجي، جواهر فري فاير، شام كاش، سيرياتيل كاش، وبطاقات هدايا Google Play وiTunes وPlayStation. أسعار منافسة، تسليم آلي خلال دقائق، ودعم فني عربي على مدار الساعة.",
      keywords:
        "شحن العاب, شحن ببجي, شحن شدات ببجي, شحن جواهر فري فاير, شام كاش, سيرياتيل كاش, بطاقات هدايا, متجر شحن سوري, شحن تطبيقات, اقرب اليك",
      canonical: `${SITE_URL}/`,
      ogImage: fallbackImage,
      jsonLd: [orgLd, siteLd],
    };
  }

  // -------------------- تصنيف رئيسي: /category/:id --------------------
  let m = path.match(/^\/category\/(\d+)$/);
  if (m) {
    const id = m[1];
    try {
      const { data: cat } = await supabase.from("categories").select("id,name,description,image_url").eq("id", id).single();
      if (cat) {
        const name = cat.name as string;
        const desc = stripHtml(cat.description || "");
        return {
          title: `${name} — شحن فوري وأسعار منافسة | ${storeName}`,
          description: truncate(
            desc || `تسوّق أقسام ${name} في ${storeName} بأسعار منافسة وتسليم فوري وآمن. جميع المنتجات مضمونة ودعم فني متواصل.`,
            160
          ),
          keywords: `${name}, شحن ${name}, ${storeName}, شحن العاب, بطاقات هدايا`,
          canonical,
          ogImage: absUrl(cat.image_url || "") || fallbackImage,
          jsonLd: [
            orgLd,
            siteLd,
            buildBreadcrumbJsonLd([
              { name: "الرئيسية", url: `${SITE_URL}/` },
              { name, url: canonical },
            ]),
          ],
        };
      }
    } catch {
      /* fallthrough للافتراضي أدناه */
    }
  }

  // -------------------- تصنيف فرعي-فرعي: /category/:catId/:id --------------------
  m = path.match(/^\/category\/(\d+)\/(\d+)$/);
  if (m) {
    const [, catId, subId] = m;
    try {
      const [{ data: cat }, { data: sub }] = await Promise.all([
        supabase.from("categories").select("id,name").eq("id", catId).single(),
        supabase.from("sub_sub_categories").select("id,name,description,image_url").eq("id", subId).single(),
      ]);
      if (sub) {
        const name = sub.name as string;
        const desc = stripHtml(sub.description || "");
        return {
          title: `${name}${cat?.name ? ` — ${cat.name}` : ""} | ${storeName}`,
          description: truncate(
            desc || `اطلب ${name} الآن من ${storeName} بأسعار منافسة وتسليم فوري وآمن مع ضمان استرجاع في حال الفشل.`,
            160
          ),
          keywords: `${name}, ${cat?.name || ""}, شحن ${name}, ${storeName}`,
          canonical,
          ogImage: absUrl(sub.image_url || "") || fallbackImage,
          jsonLd: [
            orgLd,
            siteLd,
            buildBreadcrumbJsonLd([
              { name: "الرئيسية", url: `${SITE_URL}/` },
              ...(cat?.name ? [{ name: cat.name, url: `${SITE_URL}/category/${catId}` }] : []),
              { name, url: canonical },
            ]),
          ],
        };
      }
    } catch {
      /* fallthrough */
    }
  }

  // -------------------- صفحة منتج/باقة: /products/:id --------------------
  m = path.match(/^\/products\/(\d+)$/);
  if (m) {
    const id = m[1];
    try {
      // id هنا هو معرّف القسم الفرعي أو الفرعي-الفرعي (بحسب منطق الواجهة الحالي)
      const [{ data: sub }, { data: subSub }] = await Promise.all([
        supabase.from("subcategories").select("id,name,description,image_url").eq("id", id).maybeSingle(),
        supabase.from("sub_sub_categories").select("id,name,description,image_url").eq("id", id).maybeSingle(),
      ]);
      const entity = subSub || sub;
      if (entity) {
        const name = entity.name as string;
        const desc = stripHtml(entity.description || "");
        const { data: products } = await supabase
          .from("products")
          .select("id,name,price,image_url")
          .eq(subSub ? "sub_sub_category_id" : "subcategory_id", id)
          .limit(20);

        const itemListLd =
          products && products.length
            ? {
                "@context": "https://schema.org",
                "@type": "ItemList",
                itemListElement: products.map((p: any, i: number) => ({
                  "@type": "ListItem",
                  position: i + 1,
                  item: {
                    "@type": "Product",
                    name: p.name,
                    image: p.image_url || undefined,
                    url: canonical,
                    offers: {
                      "@type": "Offer",
                      price: p.price,
                      priceCurrency: "USD",
                      availability: "https://schema.org/InStock",
                    },
                  },
                })),
              }
            : null;

        return {
          title: `شحن ${name} — تسليم فوري | ${storeName}`,
          description: truncate(
            desc || `اشحن ${name} الآن عبر ${storeName} بأسعار منافسة وتسليم آلي فوري خلال دقائق مع ضمان كامل.`,
            160
          ),
          keywords: `شحن ${name}, ${name}, ${storeName}, بطاقات ${name}`,
          canonical,
          ogImage: absUrl(entity.image_url || "") || fallbackImage,
          jsonLd: [orgLd, siteLd, ...(itemListLd ? [itemListLd] : [])],
        };
      }
    } catch {
      /* fallthrough */
    }
  }

  // -------------------- صفحات ثابتة معروفة --------------------
  const staticPages: Record<string, { title: string; description: string; noindex?: boolean }> = {
    "/privacy-policy": {
      title: `سياسة الخصوصية | ${storeName}`,
      description: `تعرّف على سياسة الخصوصية وحماية البيانات الخاصة بمستخدمي ${storeName} وكيفية التعامل مع معلوماتك الشخصية.`,
    },
    "/faq": {
      title: `الأسئلة الشائعة — إجابات عن الشحن والدفع والضمان | ${storeName}`,
      description: `إجابات مباشرة عن أكثر الأسئلة شيوعاً حول شحن الألعاب والتطبيقات، طرق الدفع، مدة التسليم، والضمان في ${storeName}.`,
    },
    "/api-docs": {
      title: `توثيق واجهة برمجة التطبيقات (API) | ${storeName}`,
      description: `دليل مطوّرين شامل لاستخدام API الخاص بـ ${storeName} لإتمام عمليات الشحن وإدارة الطلبات برمجياً.`,
    },
    "/wallet": { title: `المحفظة | ${storeName}`, description: `إدارة رصيد محفظتك في ${storeName}.`, noindex: true },
    "/orders": { title: `طلباتي | ${storeName}`, description: `متابعة حالة طلباتك في ${storeName}.`, noindex: true },
    "/profile": { title: `حسابي | ${storeName}`, description: `إدارة بيانات حسابك في ${storeName}.`, noindex: true },
    "/login": { title: `تسجيل الدخول | ${storeName}`, description: `سجّل الدخول إلى حسابك في ${storeName} للاستفادة من كل الخدمات.` },
    "/checkout": { title: `إتمام الطلب | ${storeName}`, description: `أكمل عملية الشراء بأمان عبر ${storeName}.`, noindex: true },
    "/settings": { title: `الإعدادات | ${storeName}`, description: `تخصيص إعدادات حسابك.`, noindex: true },
  };
  if (staticPages[path]) {
    const p = staticPages[path];
    const extraLd: Record<string, any>[] = [];
    if (path === "/faq") {
      const faqLd = await buildFaqJsonLd(supabase);
      if (faqLd) extraLd.push(faqLd);
    }
    return {
      title: p.title,
      description: p.description,
      canonical,
      ogImage: fallbackImage,
      noindex: p.noindex,
      jsonLd: [orgLd, siteLd, ...extraLd],
    };
  }

  // -------------------- افتراضي --------------------
  return {
    title: `${storeName} — شحن ألعاب وبطاقات هدايا رقمية`,
    description:
      "شحن: منصة شحن الألعاب والتطبيقات وبطاقات الهدايا الرقمية بتسليم فوري وأسعار منافسة.",
    canonical,
    ogImage: fallbackImage,
    jsonLd: [orgLd, siteLd],
  };
}

/**
 * يحقن meta الديناميكي داخل قالب index.html الخام.
 * يستبدل الـ title/description الافتراضيين ويضيف JSON-LD وcanonical
 * ووسوم Open Graph/Twitter كاملة.
 */
export function injectSeoIntoHtml(html: string, seo: SeoMeta): string {
  let out = html;

  // 0) تنظيف القيم الثابتة من index.html التي سيُعاد حقنها ديناميكياً (لمنع التكرار)
  if (seo.jsonLd && seo.jsonLd.length) {
    out = out.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>\s*/g, "");
  }
  if (seo.ogImage) {
    out = out.replace(/<meta name="twitter:image"[^>]*>\s*/g, "");
  }
  const icon = seo.iconUrl ? absUrl(seo.iconUrl) : "";
  if (icon) {
    out = out.replace(/<link rel="apple-touch-icon"[^>]*>\s*/g, "");
    out = out.replace(/<link rel="icon"[^>]*>\s*/g, "");
  }

  // 1) العنوان
  out = out.replace(/<title>[^<]*<\/title>/, `<title>${esc(seo.title)}</title>`);

  // 2) meta description الحالية (نستبدلها بدل تكرارها)
  out = out.replace(
    /<meta\s+name="description"[^>]*>/,
    `<meta name="description" content="${esc(seo.description)}">`
  );

  if (seo.keywords) {
    out = out.replace(
      /<meta\s+name="keywords"[^>]*>/,
      `<meta name="keywords" content="${esc(seo.keywords)}">`
    );
  }

  // 3) OG title/description/image/url
  out = out.replace(/<meta property="og:title"[^>]*>/, `<meta property="og:title" content="${esc(seo.title)}">`);
  out = out.replace(
    /<meta property="og:description"[^>]*>/,
    `<meta property="og:description" content="${esc(seo.description)}">`
  );
  if (seo.ogImage) {
    out = out.replace(/<meta property="og:image"[^>]*>/, `<meta property="og:image" content="${esc(seo.ogImage)}">`);
  }

  // 4) إدراج canonical + og:url + robots + twitter + JSON-LD قبل إغلاق </head>
  const jsonLdBlocks = (seo.jsonLd || [])
    .map((obj) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`)
    .join("\n    ");

  const extraHead = `
    <link rel="canonical" href="${esc(seo.canonical)}">
    <meta property="og:url" content="${esc(seo.canonical)}">
    <meta property="og:type" content="website">
    <meta property="og:locale" content="${DEFAULT_LOCALE}">
    <meta name="robots" content="${seo.noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"}">
    <meta name="googlebot" content="${seo.noindex ? "noindex, nofollow" : "index, follow"}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${esc(seo.title)}">
    <meta name="twitter:description" content="${esc(seo.description)}">
    ${seo.ogImage ? `<meta name="twitter:image" content="${esc(seo.ogImage)}">` : ""}
    <meta name="author" content="${esc(DEFAULT_STORE_NAME)}">
    ${icon ? `<link rel="icon" href="${esc(icon)}">\n    <link rel="apple-touch-icon" href="${esc(icon)}">` : ""}
    ${jsonLdBlocks}
  </head>`;

  out = out.replace(/<\/head>/, extraHead);
  return out;
}

// ------------------------------------------------------------------
// robots.txt — يسمح صراحة لروبوتات الذكاء الاصطناعي الرئيسية (GEO)
// بالإضافة إلى Googlebot، ويمنع الزحف لمسارات API/لوحة التحكم
// الخاصة والصفحات الشخصية (لا فائدة SEO منها وتهدر ميزانية الزحف)
// ------------------------------------------------------------------
export function buildRobotsTxt(): string {
  return `# ============================================================
#  robots.txt — Saraqib Store
#  يسمح صراحة لمحركات البحث التقليدية ولروبوتات الذكاء الاصطناعي
#  (GEO — Generative Engine Optimization) بالزحف والاستشهاد بالمحتوى
# ============================================================

User-agent: *
Allow: /
Disallow: /api/
Disallow: /wallet
Disallow: /orders
Disallow: /profile
Disallow: /profile/
Disallow: /checkout
Disallow: /success
Disallow: /settings
Disallow: /settings/
Disallow: /login
Disallow: /forgot-password
Disallow: /profile-forgot-password
Disallow: /chat
Disallow: /voucher
Disallow: /quick-order

# --- محركات البحث الرئيسية ---
User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

# --- روبوتات الذكاء الاصطناعي (GEO) — يُسمح لها صراحة بالقراءة
#     والاقتباس حتى تظهر إجابات Saraqib Store داخل ردود الذكاء الاصطناعي ---
User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: OAI-SearchBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Claude-User
Allow: /

User-agent: anthropic-ai
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Perplexity-User
Allow: /

User-agent: Google-Extended
Allow: /

User-agent: GoogleOther
Allow: /

User-agent: Applebot
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: Bytespider
Allow: /

User-agent: meta-externalagent
Allow: /

Sitemap: ${SITE_URL}/sitemap.xml
`;
}

// ------------------------------------------------------------------
// sitemap.xml ديناميكي — يُبنى من قاعدة البيانات الحية في كل طلب
// (بسيطة وسريعة كفاية لعدد صفحات المتجر، ولا تحتاج كاش لهذا الحجم)
// ------------------------------------------------------------------
export async function buildSitemapXml(supabase: SupabaseClient): Promise<string> {
  const urls: { loc: string; changefreq: string; priority: string; lastmod?: string }[] = [];

  const now = new Date().toISOString();

  // الصفحة الرئيسية والصفحات الثابتة المفهرسة
  urls.push({ loc: `${SITE_URL}/`, changefreq: "daily", priority: "1.0", lastmod: now });
  urls.push({ loc: `${SITE_URL}/privacy-policy`, changefreq: "monthly", priority: "0.3" });
  urls.push({ loc: `${SITE_URL}/faq`, changefreq: "weekly", priority: "0.6" });
  urls.push({ loc: `${SITE_URL}/api-docs`, changefreq: "monthly", priority: "0.4" });
  urls.push({ loc: `${SITE_URL}/login`, changefreq: "yearly", priority: "0.2" });

  try {
    const { data: categories } = await supabase
      .from("categories")
      .select("id,updated_at")
      .eq("active", true);
    (categories || []).forEach((c: any) => {
      urls.push({
        loc: `${SITE_URL}/category/${c.id}`,
        changefreq: "daily",
        priority: "0.8",
        lastmod: c.updated_at || now,
      });
    });

    const { data: subcats } = await supabase
      .from("subcategories")
      .select("id,category_id,updated_at")
      .eq("active", true);
    (subcats || []).forEach((s: any) => {
      urls.push({
        loc: `${SITE_URL}/category/${s.category_id}/${s.id}`,
        changefreq: "daily",
        priority: "0.7",
        lastmod: s.updated_at || now,
      });
      // كل قسم فرعي هو أيضاً صفحة منتجات مباشرة (/products/:id) بحسب منطق الواجهة
      urls.push({
        loc: `${SITE_URL}/products/${s.id}`,
        changefreq: "daily",
        priority: "0.9",
        lastmod: s.updated_at || now,
      });
    });

    const { data: subSubs } = await supabase
      .from("sub_sub_categories")
      .select("id,updated_at")
      .eq("active", true);
    (subSubs || []).forEach((s: any) => {
      urls.push({
        loc: `${SITE_URL}/products/${s.id}`,
        changefreq: "daily",
        priority: "0.9",
        lastmod: s.updated_at || now,
      });
    });
  } catch {
    /* في حال فشل الاستعلام، نُرجع خريطة الموقع الثابتة على الأقل بدل خطأ 500 */
  }

  const body = urls
    .map(
      (u) => `  <url>
    <loc>${esc(u.loc)}</loc>
    ${u.lastmod ? `<lastmod>${u.lastmod.slice(0, 10)}</lastmod>` : ""}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

// ------------------------------------------------------------------
// FAQPage JSON-LD — يُبنى من جدول auto_replies (is_faq = true)
// نفس البيانات التي تُقدَّم عبر /api/faqs، تُستخدم هنا لتوليد
// Schema.org/FAQPage الذي يظهر كأسئلة شائعة قابلة للطي مباشرة في
// نتائج جوجل، وهو من أقوى مصادر الاقتباس لمحركات الذكاء الاصطناعي.
// ------------------------------------------------------------------
export async function buildFaqJsonLd(supabase: SupabaseClient): Promise<Record<string, any> | null> {
  try {
    const { data } = await supabase
      .from("auto_replies")
      .select("trigger_text,reply_text")
      .eq("is_faq", true)
      .order("created_at", { ascending: true })
      .limit(30);
    if (!data || !data.length) return null;
    return {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: data.map((f: any) => ({
        "@type": "Question",
        name: stripHtml(f.trigger_text || ""),
        acceptedAnswer: {
          "@type": "Answer",
          text: stripHtml(f.reply_text || ""),
        },
      })),
    };
  } catch {
    return null;
  }
}
