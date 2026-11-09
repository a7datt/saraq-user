/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FaqPage — صفحة الأسئلة الشائعة العامة للمتجر.
 *
 * [SEO/GEO] هذه الصفحة مهمة جداً لسببين:
 *  1) تُغذّي Schema.org/FAQPage عبر SeoHead، وهو من أقوى الأشكال التي
 *     تُقتبس مباشرة داخل "AI Overviews" في جوجل وداخل إجابات
 *     ChatGPT/Perplexity/Gemini لأنها أسئلة وأجوبة جاهزة الصياغة.
 *  2) تمنح محتوى نصياً حقيقياً (وليس فقط واجهة تفاعلية) يمكن لمحركات
 *     البحث فهرسته والاستشهاد به، وهو ما تفتقر إليه غالباً متاجر الـ SPA.
 *
 * البيانات تأتي من /api/faqs الموجود مسبقاً في السيرفر (جدول
 * auto_replies بفلتر is_faq=true) — نفس المصدر المستخدم في نظام
 * الردود الآلية للشات، فلا يوجد ازدواجية بيانات.
 */
import React, { useState, useEffect } from "react";
import { ArrowRight, ChevronDown, HelpCircle } from "lucide-react";
import SeoHead from "../components/SeoHead";

export interface FaqPageProps {
  setView: (val: any) => void;
}

interface FaqItem {
  id: number | string;
  trigger_text: string;
  reply_text: string;
}

const FaqPage: React.FC<FaqPageProps> = ({ setView }) => {
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | string | null>(null);

  useEffect(() => {
    fetch("/api/faqs")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setFaqs(Array.isArray(data) ? data : []))
      .catch(() => setFaqs([]))
      .finally(() => setLoading(false));
  }, []);

  // بناء JSON-LD FAQPage من نفس البيانات المعروضة — يبقى متزامناً
  // دوماً مع المحتوى الظاهر فعلياً على الصفحة (لا فرق بين ما يراه
  // المستخدم وما تراه محركات البحث/الذكاء الاصطناعي).
  const faqJsonLd =
    faqs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.trigger_text,
            acceptedAnswer: {
              "@type": "Answer",
              text: f.reply_text,
            },
          })),
        }
      : undefined;

  return (
    <div className="px-4 space-y-6 pb-20">
      <SeoHead
        title="الأسئلة الشائعة — إجابات عن الشحن والدفع والضمان | Saraqib Store"
        description="إجابات مباشرة عن أكثر الأسئلة شيوعاً حول شحن الألعاب والتطبيقات، طرق الدفع، مدة التسليم، والضمان في متجر saraqib store."
        jsonLd={faqJsonLd}
      />

      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => setView({ type: "main" })} className="p-2 bg-gray-100 rounded-full" aria-label="عودة">
          <ArrowRight size={20} className="text-gray-600" />
        </button>
        <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
          <HelpCircle size={20} className="text-gray-500" />
          الأسئلة الشائعة
        </h1>
      </div>

      {loading && <div className="text-center text-gray-400 py-10 text-sm">جارِ التحميل...</div>}

      {!loading && faqs.length === 0 && (
        <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm text-center text-gray-500 text-sm">
          لا توجد أسئلة شائعة مضافة بعد.
        </div>
      )}

      {!loading && faqs.length > 0 && (
        <div className="space-y-3">
          {faqs.map((f) => {
            const isOpen = openId === f.id;
            return (
              <div key={f.id} className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
                <button
                  onClick={() => setOpenId(isOpen ? null : f.id)}
                  className="w-full flex items-center justify-between gap-3 p-4 text-right"
                  aria-expanded={isOpen}
                >
                  <span className="font-semibold text-gray-800 text-sm">{f.trigger_text}</span>
                  <ChevronDown
                    size={18}
                    className={`text-gray-400 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                    {f.reply_text}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FaqPage;
