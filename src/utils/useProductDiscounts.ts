import { useEffect, useMemo, useState } from "react";

/**
 * [PHASE-2] نسبة الخصم الفعلية (VIP/رتبة/...) لكل منتج للمستخدم الحالي — تأتي من السيرفر
 * (محرك قواعد الخصم). للعرض فقط؛ الخصم الحقيقي يُحسب دائماً عند الشراء من السيرفر.
 */
export function useProductDiscounts(productIds: Array<number | string | undefined | null>, enabled: boolean): Record<string, number> {
  const [map, setMap] = useState<Record<string, number>>({});
  const key = useMemo(
    () => Array.from(new Set(productIds.map(Number).filter(n => Number.isInteger(n) && n > 0))).sort((a, b) => a - b).join(","),
    [productIds]
  );
  useEffect(() => {
    if (!enabled || !key) { setMap({}); return; }
    let cancelled = false;
    const ids = key.split(",").map(Number);
    const token = (() => { try { return localStorage.getItem("authToken") || ""; } catch { return ""; } })();
    (async () => {
      const merged: Record<string, number> = {};
      for (let i = 0; i < ids.length; i += 300) {
        try {
          const res = await fetch("/api/discount/quote", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ productIds: ids.slice(i, i + 300) }),
          });
          if (res.ok) Object.assign(merged, await res.json());
        } catch { /* العرض فقط — نتجاهل الفشل */ }
      }
      if (!cancelled) setMap(merged);
    })();
    return () => { cancelled = true; };
  }, [key, enabled]);
  return map;
}
