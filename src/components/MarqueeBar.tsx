import React from "react";

interface MarqueeBarProps {
  text?: string | null;
}

/**
 * [PHASE-1] شريط نص عربي متحرك: يدخل من يسار الشاشة ويتحرك لليمين، فتظهر أول كلمة أولاً ثم
 * بقية الكلمات بالترتيب، بحركة مستمرة وناعمة بلا قفزات. اللون = لون الموقع الأساسي (--brand).
 * مبدأ التكرار السلس: مجموعتان متطابقتان تتحركان من -50% إلى 0، والمجموعة الواحدة تحوي نسخاً
 * كافية لتغطية عرض الشاشة حتى مع النص القصير. السرعة ثابتة (px/s) فلا يتسارع النص الطويل.
 */
const SPEED_PX_PER_SEC = 60;

const MarqueeBar: React.FC<MarqueeBarProps> = ({ text }) => {
  const value = (text || "").trim();
  const groupRef = React.useRef<HTMLDivElement>(null);
  const [duration, setDuration] = React.useState(20);
  const [copies, setCopies] = React.useState(4);

  React.useEffect(() => {
    const el = groupRef.current;
    if (!el || !value) return;
    const measure = () => {
      const total = el.scrollWidth;
      // عرض نسخة واحدة تقريبي = العرض الكلي / عدد النسخ الحالي
      const one = total / copies;
      const viewport = window.innerWidth || 360;
      if (one > 0) {
        const need = Math.max(1, Math.ceil(viewport / one));
        if (need !== copies) { setCopies(need); return; }
      }
      if (total > 0) setDuration(Math.max(8, total / SPEED_PX_PER_SEC));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [value, copies]);

  if (!value) return null;

  const group = (hidden: boolean) => (
    <div
      ref={hidden ? undefined : groupRef}
      className="flex shrink-0 items-center"
      aria-hidden={hidden || undefined}
    >
      {Array.from({ length: copies }).map((_, i) => (
        <span key={i} dir="rtl" className="whitespace-nowrap px-6 text-sm font-bold">{value}</span>
      ))}
    </div>
  );

  return (
    <div
      className="px-4"
      role="marquee"
      aria-label={value}
    >
      <div
        dir="ltr"
        className="overflow-hidden rounded-xl py-2 text-brand"
        style={{ background: "color-mix(in srgb, var(--brand) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--brand) 25%, transparent)" }}
      >
        <div
          className="saraqib-marquee-track flex w-max"
          style={{ animationDuration: `${duration}s` }}
        >
          {group(false)}
          {group(true)}
        </div>
      </div>
    </div>
  );
};

export default MarqueeBar;
