import { describe, it, expect } from "vitest";
import {
  applyPaymentMethodBonus,
  generateAutoChargeCode,
  AUTO_CHARGE_CODE_CHARS,
  timingSafeEqualStrings,
  encryptProviderData,
  decryptProviderData,
  isEncrypted,
} from "./paymentMath.ts";
import { isValidAmount, isValidTxNumber } from "./security.ts";

describe("applyPaymentMethodBonus", () => {
  it("returns the amount unchanged when method has no bonus config", () => {
    expect(applyPaymentMethodBonus(100, null)).toBe(100);
    expect(applyPaymentMethodBonus(100, undefined)).toBe(100);
    expect(applyPaymentMethodBonus(100, {})).toBe(100);
    expect(applyPaymentMethodBonus(100, { bonus_type: "bonus", bonus_percent: 0 })).toBe(100);
  });

  it("applies a commission (deducted from the amount)", () => {
    expect(applyPaymentMethodBonus(100, { bonus_type: "commission", bonus_percent: 10 })).toBe(90);
  });

  it("applies a bonus (added to the amount)", () => {
    expect(applyPaymentMethodBonus(100, { bonus_type: "bonus", bonus_percent: 10 })).toBe(110);
  });

  it("ignores a negative or non-numeric bonus_percent", () => {
    expect(applyPaymentMethodBonus(100, { bonus_type: "bonus", bonus_percent: -5 })).toBe(100);
    expect(applyPaymentMethodBonus(100, { bonus_type: "bonus", bonus_percent: NaN as any })).toBe(100);
  });

  it("ignores an unknown bonus_type", () => {
    expect(applyPaymentMethodBonus(100, { bonus_type: "unknown", bonus_percent: 10 })).toBe(100);
  });

  it("rounds to 4 decimal places", () => {
    const result = applyPaymentMethodBonus(33.333, { bonus_type: "bonus", bonus_percent: 7 });
    expect(result).toBe(35.6663);
  });
});

describe("generateAutoChargeCode", () => {
  it("generates a 7-character code using only the allowed charset", () => {
    const code = generateAutoChargeCode();
    expect(code).toHaveLength(7);
    for (const ch of code) expect(AUTO_CHARGE_CODE_CHARS).toContain(ch);
  });

  it("generates different codes across calls (collision astronomically unlikely)", () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateAutoChargeCode()));
    expect(codes.size).toBe(200);
  });
});

describe("timingSafeEqualStrings", () => {
  it("returns true for identical strings", () => {
    expect(timingSafeEqualStrings("secret123", "secret123")).toBe(true);
  });

  it("returns false for different strings of the same length", () => {
    expect(timingSafeEqualStrings("secret123", "secret456")).toBe(false);
  });

  it("returns false for strings of different lengths without throwing", () => {
    expect(timingSafeEqualStrings("short", "a-much-longer-string")).toBe(false);
  });

  it("returns false against an empty string", () => {
    expect(timingSafeEqualStrings("nonempty", "")).toBe(false);
    expect(timingSafeEqualStrings("", "")).toBe(true);
  });
});

describe("encryptProviderData / decryptProviderData (AES-256-GCM)", () => {
  const testKey = "0".repeat(64); // 32-byte hex key, test-only

  it("round-trips plaintext through encrypt then decrypt", () => {
    const plaintext = "my-secret-api-token-123";
    const encrypted = encryptProviderData(plaintext, testKey);
    expect(encrypted).not.toBe(plaintext);
    expect(decryptProviderData(encrypted, testKey)).toBe(plaintext);
  });

  it("produces output recognized by isEncrypted", () => {
    const encrypted = encryptProviderData("hello", testKey);
    expect(isEncrypted(encrypted)).toBe(true);
    expect(isEncrypted("hello")).toBe(false);
    expect(isEncrypted("")).toBe(false);
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encryptProviderData("same-plaintext", testKey);
    const b = encryptProviderData("same-plaintext", testKey);
    expect(a).not.toBe(b);
  });

  it("fails to decrypt with the wrong key", () => {
    const encrypted = encryptProviderData("secret", testKey);
    const wrongKey = "1".repeat(64);
    expect(() => decryptProviderData(encrypted, wrongKey)).toThrow();
  });

  it("fails to decrypt tampered ciphertext (GCM auth tag check)", () => {
    const encrypted = encryptProviderData("secret", testKey);
    const [iv, tag, data] = encrypted.split(":");
    const tampered = `${iv}:${tag}:${data.slice(0, -4)}AAAA`;
    expect(() => decryptProviderData(tampered, testKey)).toThrow();
  });

  it("throws when no key is configured", () => {
    expect(() => encryptProviderData("x", "")).toThrow();
    expect(() => decryptProviderData("a:b:c", "")).toThrow();
  });
});

describe("isValidAmount (security.ts)", () => {
  it("accepts a normal positive amount within range", () => {
    expect(isValidAmount(50)).toBe(true);
    expect(isValidAmount("50")).toBe(true);
  });

  it("rejects zero, negative, NaN, and out-of-range amounts", () => {
    expect(isValidAmount(0)).toBe(false);
    expect(isValidAmount(-5)).toBe(false);
    expect(isValidAmount("not-a-number")).toBe(false);
    expect(isValidAmount(100_000.01)).toBe(false);
  });

  it("respects custom min/max bounds", () => {
    expect(isValidAmount(5, 10, 20)).toBe(false);
    expect(isValidAmount(15, 10, 20)).toBe(true);
  });
});

describe("isValidTxNumber (security.ts)", () => {
  it("accepts typical transaction numbers", () => {
    expect(isValidTxNumber("TX123456")).toBe(true);
  });

  it("accepts long on-chain hashes (TRC20/BEP20) up to 100 chars", () => {
    expect(isValidTxNumber("a".repeat(100))).toBe(true);
    expect(isValidTxNumber("a".repeat(101))).toBe(false);
  });

  it("rejects too-short values", () => {
    expect(isValidTxNumber("ab")).toBe(false);
  });

  it("rejects non-string input", () => {
    expect(isValidTxNumber(12345 as any)).toBe(false);
    expect(isValidTxNumber(null as any)).toBe(false);
  });
});
