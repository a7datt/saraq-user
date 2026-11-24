import { describe, it, expect } from "vitest";
import { resolveDiscountPercent, pickMostSpecificRule, maxDiscountPercentForCost, sanitizeRulesInput, DiscountRule } from "./discountEngine";

const rule = (scope_type: any, scope_id: number | null, percent: number): DiscountRule =>
  ({ owner_type: "vip", owner_id: null, scope_type, scope_id, percent });

// منتج 10 داخل: فرع فرعي 30 ← قسم فرعي 20 ← قسم رئيسي 2
const product = { id: 10, price: 100, store_type: "fixed", sub_sub_category_id: 30, subcategory_id: 20, subcategories: { category_id: 2 } };

describe("discount rules engine", () => {
  it("منتج + قسم + عام: القاعدة الأدق (المنتج) هي المطبّقة", () => {
    const rules = [rule("all", null, 5), rule("category", 2, 3), rule("product", 10, 0.5)];
    expect(resolveDiscountPercent(rules, product).percent).toBe(0.5);
  });
  it("بدون قاعدة منتج: يفوز الفرع الفرعي ثم الفرعي ثم الرئيسي ثم الكل", () => {
    expect(resolveDiscountPercent([rule("all", null, 5), rule("category", 2, 3), rule("subcategory", 20, 2), rule("sub_sub_category", 30, 1)], product).percent).toBe(1);
    expect(resolveDiscountPercent([rule("all", null, 5), rule("category", 2, 3), rule("subcategory", 20, 2)], product).percent).toBe(2);
    expect(resolveDiscountPercent([rule("all", null, 5), rule("category", 2, 3)], product).percent).toBe(3);
    expect(resolveDiscountPercent([rule("all", null, 5)], product).percent).toBe(5);
  });
  it("الأدق يفوز حتى لو كانت نسبته أقل (لا تُجمع ولا يُؤخذ الأعلى)", () => {
    expect(resolveDiscountPercent([rule("all", null, 9), rule("product", 10, 0.5)], product).percent).toBe(0.5);
  });
  it("قاعدة لمنتج آخر/قسم آخر لا تنطبق", () => {
    expect(pickMostSpecificRule([rule("product", 11, 4), rule("category", 3, 4)], product)).toBeNull();
  });
  it("حماية التكلفة: لا ينزل السعر تحت التكلفة", () => {
    const p = { ...product, store_type: "external_api", price: 101, price_per_unit: 100 }; // ربح ~0.99%
    const r = resolveDiscountPercent([rule("all", null, 5)], p);
    expect(r.capped).toBe(true);
    expect(101 * (1 - r.percent / 100)).toBeGreaterThanOrEqual(100 - 1e-6);
    expect(maxDiscountPercentForCost(p)).toBeCloseTo(0.9901, 3);
  });
  it("التكلفة مجهولة: لا سقف", () => {
    expect(resolveDiscountPercent([rule("all", null, 5)], product).capped).toBe(false);
  });
  it("تنظيف المدخلات", () => {
    expect(() => sanitizeRulesInput([{ scope_type: "all", percent: 100 }])).toThrow();
    expect(() => sanitizeRulesInput([{ scope_type: "category", scope_id: 1, percent: 1 }, { scope_type: "category", scope_id: 1, percent: 2 }])).toThrow();
    expect(() => sanitizeRulesInput([{ scope_type: "product", percent: 1 }])).toThrow();
    expect(sanitizeRulesInput([{ scope_type: "all", percent: "2.5" }])[0].percent).toBe(2.5);
  });
});
