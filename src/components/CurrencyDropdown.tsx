import React, { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

export interface CurrencyDropdownOption {
  value: string;
  label: string;
}

interface CurrencyDropdownProps {
  value: string;
  options: CurrencyDropdownOption[];
  onChange: (val: string) => void;
  className?: string;
  // [DRAWER-RESTYLE] يسمح باستبدال شكل الزر المحفّز الافتراضي (حدّ/خلفية رمادية) عند
  // تضمين القائمة داخل حاوية مُصمَّمة مسبقاً (مثل فقّاعة العملة في القائمة الجانبية)
  // بدل تكرار خلفية/حدّ متنافسين. باقي الاستخدامات تبقى كما هي دون أي تغيير.
  triggerClassName?: string;
  // [DRAWER-RESTYLE] محتوى يُعرض داخل زر المحفّز نفسه (أيقونة/تسمية) قبل القيمة المختارة —
  // بهذا يكون الضغط على أي جزء من الزر الواحد (بما فيه التسمية) فاتحاً للقائمة، بدل أن تكون
  // التسمية عنصراً مجاوراً خارج الزر لا يستجيب للضغط.
  leading?: React.ReactNode;
}

// قائمة منسدلة مبرمجة داخلياً (بدون استخدام select المتصفح الافتراضي)
export const CurrencyDropdown = ({ value, options, onChange, className = "", triggerClassName, leading }: CurrencyDropdownProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={triggerClassName ?? "flex items-center gap-1.5 border border-gray-200 dark:border-gray-700 rounded-md px-3 py-1 font-black text-sm cursor-pointer outline-none bg-gray-50 text-gray-700 active:scale-95 transition-transform"}
      >
        {leading}
        <span>{selected ? selected.label : "—"}</span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          dir="rtl"
          className="absolute left-0 top-full mt-1.5 min-w-[110px] bg-white rounded-lg border border-gray-100 dark:border-gray-700 shadow-lg overflow-hidden z-50 py-1"
        >
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`w-full text-right px-3 py-2 text-sm font-bold transition-colors ${
                opt.value === value
                  ? "bg-[var(--brand)]/10 text-[var(--brand)]"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CurrencyDropdown;
