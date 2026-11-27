import React from "react";
import { Star } from "lucide-react";

interface Props {
  baseTotal: number;
  finalPrice: number;
  percent: number; // نسبة الخصم (مثلاً 3.5)
  isVip?: boolean;
  fmtPrice: (n: number) => string;
  textClass?: string;
  mutedClass?: string;
}

/** ملخص السعر عند وجود خصم: السعر الأصلي، نوع ونسبة الخصم، مقدار الخصم، والسعر النهائي. */
export default function DiscountSummary({ baseTotal, finalPrice, percent, isVip, fmtPrice, textClass = "", mutedClass = "" }: Props) {
  const amount = Math.max(0, baseTotal - finalPrice);
  return (
    <div className="w-full mt-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl px-3.5 py-3 space-y-1.5 text-xs">
      <div className="flex items-center justify-between">
        <span className={mutedClass}>السعر الأصلي</span>
        <span className={`font-bold line-through ${mutedClass}`}>{fmtPrice(baseTotal)}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-amber-500 font-bold">
          <Star size={12} fill="currentColor" /> {isVip ? "خصم VIP" : "خصمك"} ({+percent.toFixed(2)}%)
        </span>
        <span className="text-amber-500 font-bold">- {fmtPrice(amount)}</span>
      </div>
      <div className="border-t border-dashed border-amber-500/30 my-1" />
      <div className="flex items-center justify-between">
        <span className={`font-black text-sm ${textClass}`}>السعر النهائي</span>
        <span className="font-black text-base text-green-600">{fmtPrice(finalPrice)}</span>
      </div>
    </div>
  );
}
