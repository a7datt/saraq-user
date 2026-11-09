/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from "react";
import { Phone, Search, ChevronDown } from "lucide-react";

// قائمة رموز الدول (عربية + أوروبية + عالمية شائعة) مع طول الرقم المحلي الثابت
// digits = عدد الأرقام المطلوب بالضبط بعد رمز الدولة (لا يزيد ولا ينقص)
export const COUNTRY_CODES = [
  // الدول العربية
  { code: "+963", label: "سوريا", digits: 9 },
  { code: "+966", label: "السعودية", digits: 9 },
  { code: "+971", label: "الإمارات", digits: 9 },
  { code: "+20",  label: "مصر", digits: 10 },
  { code: "+962", label: "الأردن", digits: 9 },
  { code: "+961", label: "لبنان", digits: 8 },
  { code: "+964", label: "العراق", digits: 10 },
  { code: "+974", label: "قطر", digits: 8 },
  { code: "+965", label: "الكويت", digits: 8 },
  { code: "+968", label: "عُمان", digits: 8 },
  { code: "+973", label: "البحرين", digits: 8 },
  { code: "+970", label: "فلسطين", digits: 9 },
  { code: "+218", label: "ليبيا", digits: 9 },
  { code: "+216", label: "تونس", digits: 8 },
  { code: "+213", label: "الجزائر", digits: 9 },
  { code: "+212", label: "المغرب", digits: 9 },
  { code: "+249", label: "السودان", digits: 9 },
  { code: "+967", label: "اليمن", digits: 9 },
  { code: "+222", label: "موريتانيا", digits: 8 },
  { code: "+252", label: "الصومال", digits: 8 },
  { code: "+253", label: "جيبوتي", digits: 8 },
  { code: "+269", label: "جزر القمر", digits: 7 },
  // تركيا وإيران
  { code: "+90",  label: "تركيا", digits: 10 },
  { code: "+98",  label: "إيران", digits: 10 },
  // أوروبا
  { code: "+49",  label: "ألمانيا", digits: 11 },
  { code: "+33",  label: "فرنسا", digits: 9 },
  { code: "+44",  label: "بريطانيا", digits: 10 },
  { code: "+39",  label: "إيطاليا", digits: 10 },
  { code: "+34",  label: "إسبانيا", digits: 9 },
  { code: "+31",  label: "هولندا", digits: 9 },
  { code: "+32",  label: "بلجيكا", digits: 9 },
  { code: "+41",  label: "سويسرا", digits: 9 },
  { code: "+43",  label: "النمسا", digits: 10 },
  { code: "+46",  label: "السويد", digits: 9 },
  { code: "+47",  label: "النرويج", digits: 8 },
  { code: "+45",  label: "الدنمارك", digits: 8 },
  { code: "+358", label: "فنلندا", digits: 9 },
  { code: "+351", label: "البرتغال", digits: 9 },
  { code: "+30",  label: "اليونان", digits: 10 },
  { code: "+48",  label: "بولندا", digits: 9 },
  { code: "+420", label: "التشيك", digits: 9 },
  { code: "+36",  label: "المجر", digits: 9 },
  { code: "+40",  label: "رومانيا", digits: 9 },
  { code: "+380", label: "أوكرانيا", digits: 9 },
  { code: "+7",   label: "روسيا", digits: 10 },
  { code: "+353", label: "إيرلندا", digits: 9 },
  { code: "+352", label: "لوكسمبورغ", digits: 9 },
  // أمريكا وأخرى
  { code: "+1",   label: "أمريكا/كندا", digits: 10 },
  { code: "+61",  label: "أستراليا", digits: 9 },
  { code: "+86",  label: "الصين", digits: 11 },
  { code: "+91",  label: "الهند", digits: 10 },
  { code: "+92",  label: "باكستان", digits: 10 },
  { code: "+81",  label: "اليابان", digits: 10 },
  { code: "+82",  label: "كوريا الجنوبية", digits: 10 },
  { code: "+60",  label: "ماليزيا", digits: 9 },
  { code: "+62",  label: "إندونيسيا", digits: 10 },
  { code: "+27",  label: "جنوب أفريقيا", digits: 9 },
  { code: "+55",  label: "البرازيل", digits: 11 },
];

// الحد الأدنى الافتراضي (يُستخدم فقط كقيمة احتياطية إن لم توجد دولة مطابقة)
export const MIN_PHONE_DIGITS = 9;

/** يعيد عدد الأرقام المطلوب بالضبط لرمز دولة معيّن */
export function getRequiredDigits(countryCode: string): number {
  const match = COUNTRY_CODES.find((c) => c.code === countryCode);
  return match ? match.digits : MIN_PHONE_DIGITS;
}

/** يتحقق من أن رقم الهاتف يطابق العدد المطلوب بالضبط لرمز الدولة المحدد */
export function isValidPhoneForCountry(countryCode: string, digitsOnly: string): boolean {
  return digitsOnly.length === getRequiredDigits(countryCode);
}

/**
 * يفصل رقم هاتف مخزَّن مسبقاً (قد يحتوي على رمز دولة أو لا) إلى
 * { countryCode, digits } لتعبئة الحقلين عند فتح نموذج التعديل.
 */
export function splitStoredPhone(stored: string | null | undefined): { countryCode: string; digits: string } {
  const raw = (stored || "").trim();
  if (!raw) return { countryCode: "+963", digits: "" };
  const match = COUNTRY_CODES
    .filter((c) => raw.startsWith(c.code))
    .sort((a, b) => b.code.length - a.code.length)[0];
  if (match) {
    return { countryCode: match.code, digits: raw.slice(match.code.length).replace(/\D/g, "") };
  }
  return { countryCode: "+963", digits: raw.replace(/\D/g, "") };
}

interface CountryCodePhoneInputProps {
  countryCode: string;
  onCountryCodeChange: (code: string) => void;
  phone: string;
  onPhoneChange: (digitsRaw: string) => void;
  disabled?: boolean;
  showCounter?: boolean;
}

const CountryCodePhoneInput: React.FC<CountryCodePhoneInputProps> = ({
  countryCode, onCountryCodeChange, phone, onPhoneChange, disabled, showCounter = true,
}) => {
  const digitsOnly = phone.replace(/\D/g, "");
  const requiredDigits = getRequiredDigits(countryCode);
  const isValid = digitsOnly.length === requiredDigits;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const selected = COUNTRY_CODES.find((c) => c.code === countryCode);

  const normalizedQuery = query.trim().replace(/^\+/, "");
  const filtered = normalizedQuery
    ? COUNTRY_CODES.filter(
        (c) =>
          c.code.replace("+", "").includes(normalizedQuery) ||
          c.label.includes(query.trim())
      )
    : COUNTRY_CODES;

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 0);
  }, [open]);

  return (
    <div>
      <div className="flex gap-2">
        <div className="relative w-36" ref={wrapRef}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setOpen((o) => !o)}
            className="w-full flex items-center justify-between gap-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-light/40 shadow-sm disabled:opacity-60"
          >
            <span className="truncate">
              {selected ? `${selected.code} ${selected.label}` : countryCode}
            </span>
            <ChevronDown size={14} className="text-gray-400 shrink-0" />
          </button>

          {open && (
            <div className="absolute z-50 mt-1 w-64 max-h-72 overflow-hidden bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg flex flex-col">
              <div className="relative p-2 border-b border-gray-100 dark:border-gray-700">
                <Search size={14} className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-300" />
                <input
                  ref={searchRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="ابحث بالاسم أو الرمز (مثال: +963 أو سوريا)"
                  className="w-full bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-lg pr-8 pl-2 py-2 text-xs outline-none focus:border-brand"
                />
              </div>
              <div className="overflow-y-auto">
                {filtered.length === 0 && (
                  <div className="px-3 py-3 text-xs text-gray-400 text-center">لا توجد نتائج</div>
                )}
                {filtered.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => {
                      onCountryCodeChange(c.code);
                      setOpen(false);
                      setQuery("");
                    }}
                    className={`w-full text-right px-3 py-2 text-xs flex items-center justify-between hover:bg-brand/5 dark:hover:bg-brand/10 ${
                      c.code === countryCode ? "bg-brand/10 text-brand font-bold" : "text-gray-800 dark:text-gray-200"
                    }`}
                  >
                    <span>{c.label}</span>
                    <span className="text-gray-400 ltr:font-mono">{c.code}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="relative flex-1">
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none">
            <Phone size={18} />
          </span>
          <input
            type="tel"
            inputMode="numeric"
            placeholder={`رقم الهاتف (${requiredDigits} أرقام)`}
            value={phone}
            onChange={(e) => {
              const v = e.target.value;
              if (/^[\d\s\-]{0,20}$/.test(v)) onPhoneChange(v);
            }}
            disabled={disabled}
            maxLength={requiredDigits + 4}
            className="w-full bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 border border-gray-200 dark:border-gray-700 rounded-xl pr-12 pl-4 py-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand-light/40 shadow-sm"
          />
        </div>
      </div>

      {showCounter && phone.length > 0 && (
        <p className={`text-[11px] mt-1.5 px-1 ${isValid ? "text-green-600" : "text-gray-400"}`}>
          {digitsOnly.length} / {requiredDigits} أرقام بالضبط
        </p>
      )}
    </div>
  );
};

export default CountryCodePhoneInput;
