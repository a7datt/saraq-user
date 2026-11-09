/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X, Trophy, Globe2, Users, Star, ShieldCheck, Swords, Crown, Calendar,
  Clock, Award, Heart, Shirt, Flag, Sparkles, BadgeCheck, Copy, Check,
} from "lucide-react";
import { FreeFireItemCard, FFItemResolved } from "./FreeFireItemCard";

/* ============================================================================
 * نظام الألوان — مستوحى من هوية Free Fire الرسمية (ذهبي/كهرماني على خلفية
 * داكنة عميقة قريبة من البنفسجي)، بديل كامل عن الثيم البرتقالي/السماوي القديم.
 * ========================================================================== */
const C = {
  bg: "#0a0a12",
  bgSoft: "#0f0f1a",
  panel: "#141420",
  panelAlt: "#191925",
  line: "rgba(255,255,255,0.07)",
  lineSoft: "rgba(255,255,255,0.045)",
  gold: "#ffc845",
  goldDeep: "#e79a1f",
  ember: "#ff5d3a",
  cyan: "#37d6e0",
  violet: "#a06bff",
  text: "#f5f4f2",
  dim: "rgba(245,244,242,0.5)",
  dim2: "rgba(245,244,242,0.32)",
};

/* ============================================================================
 * أدوات مساعدة
 * ========================================================================== */
const ARABIC_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function formatArabicDate(unixSeconds?: string | number | null): string {
  if (!unixSeconds) return "—";
  const n = typeof unixSeconds === "string" ? parseInt(unixSeconds, 10) : unixSeconds;
  if (!n || Number.isNaN(n)) return "—";
  const d = new Date(n * 1000);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getDate()} ${ARABIC_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function formatCompactNumber(n?: number | null): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  if (Math.abs(n) < 1000) return String(n);
  const units = [
    { v: 1_000_000_000, s: "B" },
    { v: 1_000_000, s: "M" },
    { v: 1_000, s: "K" },
  ];
  for (const u of units) {
    if (Math.abs(n) >= u.v) {
      const val = n / u.v;
      return `${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}${u.s}`;
    }
  }
  return String(n);
}

const CLOTHES_LABELS = ["الرأس", "الجزء العلوي", "الجزء السفلي", "الحذاء", "القفازات", "الإكسسوار"];

/* ============================================================================
 * أنواع البيانات القادمة من الـ API الخام (data.raw لـ Free Fire)
 * ملاحظة: تم استبعاد بيانات قائد الكلان والرفيق (Pet) بالكامل بحسب الطلب —
 * لا تُعرض ولا تُجلب صورها لتقليل الحمل على الواجهة.
 * ========================================================================== */
interface FFRawData {
  basicInfo?: Record<string, any>;
  profileInfo?: Record<string, any>;
  clanBasicInfo?: Record<string, any>;
  socialInfo?: Record<string, any>;
  creditScoreInfo?: Record<string, any>;
  diamondCostRes?: Record<string, any>;
}

export interface VerifiedPlayerInfo {
  accountId: string | null;
  nickname: string | null;
  region: string | null;
  level: number | null;
  clanName: string | null;
  raw?: FFRawData;
}

interface FreeFireProfileModalProps {
  player: VerifiedPlayerInfo;
  onClose: () => void;
}

/* ============================================================================
 * عناصر واجهة مشتركة — لغة تصميم جديدة بالكامل
 * ========================================================================== */

/** بطاقة قسم زجاجية بحد علوي رفيع ملوّن + رأس بعنوان وأيقونة كبسولية */
const Section: React.FC<{
  title: string;
  icon: React.ReactNode;
  accent: string;
  children: React.ReactNode;
  tag?: string;
}> = ({ title, icon, accent, children, tag }) => (
  <section
    className="relative rounded-[18px] overflow-hidden"
    style={{ background: C.panel, border: `1px solid ${C.line}` }}
  >
    <div className="absolute top-0 right-0 left-0 h-[2px]" style={{ background: `linear-gradient(90deg, ${accent}, transparent 75%)` }} />
    <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-3">
      <div className="flex items-center gap-2.5">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${accent}1f`, color: accent, boxShadow: `inset 0 0 0 1px ${accent}33` }}
        >
          {icon}
        </div>
        <h3 className="text-[12.5px] font-black tracking-wide" style={{ color: C.text }}>{title}</h3>
      </div>
      {tag && (
        <span className="text-[9.5px] font-bold px-2 py-[3px] rounded-full" style={{ color: C.dim, background: "rgba(255,255,255,0.04)" }}>
          {tag}
        </span>
      )}
    </div>
    <div style={{ borderTop: `1px solid ${C.lineSoft}` }}>{children}</div>
  </section>
);

/** خانة إحصائية واحدة داخل شبكة — تصميم بطاقة صغيرة بدل الجدول المسطّح */
const Stat: React.FC<{ label: string; value: React.ReactNode; icon?: React.ReactNode; accent?: string }> = ({
  label, value, icon, accent = C.cyan,
}) => (
  <div className="flex items-center gap-2.5 px-3.5 py-3 border-b border-l last:border-l-0" style={{ borderColor: C.lineSoft }}>
    {icon && (
      <span className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center" style={{ color: accent, background: `${accent}17` }}>
        {icon}
      </span>
    )}
    <div className="min-w-0">
      <p className="text-[9px] uppercase tracking-wider font-bold leading-none mb-1" style={{ color: C.dim2 }}>{label}</p>
      <p className="text-[13.5px] font-black truncate leading-tight" style={{ color: C.text }}>{value}</p>
    </div>
  </div>
);

/* ============================================================================
 * المكوّن الرئيسي
 * ========================================================================== */
export const FreeFireProfileModal: React.FC<FreeFireProfileModalProps> = ({ player, onClose }) => {
  const raw = player.raw;
  const basic = raw?.basicInfo || {};
  const profile = raw?.profileInfo || {};
  const clan = raw?.clanBasicInfo || {};
  const social = raw?.socialInfo || {};

  const [imageMap, setImageMap] = useState<Record<string, FFItemResolved>>({});
  const [copied, setCopied] = useState(false);

  // فقط المعرّفات المرتبطة بالحساب الرئيسي — لا يوجد قائد كلان ولا رفيق (Pet)
  const allIds = useMemo(() => {
    const ids: (number | string)[] = [];
    if (basic.bannerId) ids.push(basic.bannerId);
    if (basic.headPic) ids.push(basic.headPic);
    if (basic.pinId) ids.push(basic.pinId);
    if (basic.title) ids.push(basic.title);
    if (basic.badgeId) ids.push(basic.badgeId);
    if (Array.isArray(basic.weaponSkinShows)) ids.push(...basic.weaponSkinShows);
    if (profile.avatarId) ids.push(profile.avatarId);
    if (Array.isArray(profile.clothes)) ids.push(...profile.clothes);
    return Array.from(new Set(ids.filter(Boolean)));
  }, [raw]);

  useEffect(() => {
    let cancelled = false;
    if (allIds.length === 0) return;

    // دفعات صغيرة عبر وقت فراغ المتصفح لتفادي أي تجميد للواجهة
    const chunks: (number | string)[][] = [];
    for (let i = 0; i < allIds.length; i += 8) chunks.push(allIds.slice(i, i + 8));

    const fetchChunk = async (chunk: (number | string)[]) => {
      try {
        const res = await fetch("/api/name-verification/item-images", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`,
          },
          body: JSON.stringify({ ids: chunk }),
        });
        const data = await res.json().catch(() => null);
        if (!cancelled && data?.success) setImageMap((prev) => ({ ...prev, ...data.data }));
      } catch {
        /* تجاهل — يبقى placeholder لهذه الدفعة */
      }
    };

    const runIdle = (cb: () => void) => {
      const w = window as any;
      if (typeof w.requestIdleCallback === "function") w.requestIdleCallback(cb, { timeout: 800 });
      else setTimeout(cb, 60);
    };

    let idx = 0;
    const step = async () => {
      if (cancelled || idx >= chunks.length) return;
      await fetchChunk(chunks[idx]);
      idx += 1;
      runIdle(step);
    };
    runIdle(step);

    return () => { cancelled = true; };
  }, [allIds]);

  const getResolved = (id?: number | string | null): FFItemResolved | undefined => {
    if (!id) return undefined;
    return imageMap[String(id)];
  };

  const handleCopyId = () => {
    if (!player.accountId) return;
    navigator.clipboard?.writeText(player.accountId).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const bannerImg = getResolved(basic.bannerId)?.image;
  const avatarImg = getResolved(profile.avatarId)?.image;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-3"
        style={{ background: "rgba(4,4,8,0.86)", backdropFilter: "blur(3px)" }}
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 14 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.96, opacity: 0, y: 10 }}
          transition={{ type: "spring", damping: 26, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          dir="rtl"
          className="w-full max-w-xl max-h-[92vh] overflow-hidden rounded-[22px] flex flex-col shadow-2xl"
          style={{ background: C.bg, border: `1px solid rgba(255,200,69,0.16)`, boxShadow: "0 30px 70px -20px rgba(0,0,0,0.7)" }}
        >
          {/* ═══════════════════════ بطاقة الهوية ═══════════════════════ */}
          <div className="relative shrink-0">
            {/* البانر */}
            <div
              className="relative h-[104px] overflow-hidden"
              style={{ background: `linear-gradient(135deg, ${C.violet}33, ${C.bg} 75%)` }}
            >
              {bannerImg && (
                <img src={bannerImg} alt="بانر" className="absolute inset-0 w-full h-full object-cover opacity-45" loading="eager" />
              )}
              {/* شريط ذهبي قطري — إشارة إلى هوية Free Fire البصرية */}
              <div
                className="absolute -top-8 -right-16 w-56 h-16 rotate-[-32deg] opacity-90"
                style={{ background: `linear-gradient(90deg, ${C.gold}, ${C.ember})` }}
              />
              <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, rgba(10,10,18,0.15) 0%, ${C.bg} 92%)` }} />

              {/* شعار اللعبة */}
              <div className="absolute top-3 right-3.5 flex items-center gap-1.5 z-[1]">
                <span
                  className="text-[10px] font-black tracking-[0.14em] px-2.5 py-1 rounded-md"
                  style={{ background: "rgba(10,10,18,0.55)", color: C.gold, border: `1px solid ${C.gold}44` }}
                >
                  FREE FIRE
                </span>
              </div>

              <button
                onClick={onClose}
                aria-label="إغلاق"
                className="absolute top-3 left-3.5 w-8 h-8 rounded-full flex items-center justify-center z-[1] transition-colors hover:bg-white/10"
                style={{ background: "rgba(10,10,18,0.55)", color: C.text, border: `1px solid ${C.line}` }}
              >
                <X size={16} />
              </button>
            </div>

            {/* صف الهوية: صورة رمزية + الاسم + المستوى */}
            <div className="px-4 -mt-10 relative z-[1] flex items-end gap-3.5">
              <div
                className="relative w-[76px] h-[76px] rounded-2xl overflow-hidden shrink-0 flex items-center justify-center"
                style={{
                  background: `linear-gradient(160deg, ${C.panelAlt}, ${C.bgSoft})`,
                  border: `2px solid ${C.gold}`,
                  boxShadow: `0 8px 22px -6px ${C.gold}55, 0 0 0 4px ${C.bg}`,
                }}
              >
                {avatarImg ? (
                  <img src={avatarImg} alt="أفاتار" className="w-full h-full object-contain p-1.5" loading="eager" />
                ) : (
                  <Crown size={30} style={{ color: C.gold }} />
                )}
                <div
                  className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9.5px] font-black px-2 py-[2px] rounded-full whitespace-nowrap"
                  style={{ background: C.gold, color: "#241a02" }}
                >
                  Lv.{basic.level ?? player.level ?? "—"}
                </div>
              </div>

              <div className="min-w-0 flex-1 pb-1.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="font-black text-[18px] leading-tight truncate" style={{ color: C.text }}>
                    {player.nickname || "—"}
                  </p>
                  {basic.primeInfo?.primeLevel ? (
                    <span
                      className="text-[9px] font-black px-1.5 py-[3px] rounded-md flex items-center gap-0.5 shrink-0"
                      style={{ background: `${C.ember}26`, color: C.ember }}
                    >
                      <Sparkles size={9} /> Prime {basic.primeInfo.primeLevel}
                    </span>
                  ) : null}
                </div>
                <button
                  onClick={handleCopyId}
                  className="flex items-center gap-1.5 text-[11px] font-mono mt-1 transition-colors"
                  style={{ color: C.dim }}
                >
                  UID {player.accountId || "—"}
                  {copied ? <Check size={11} style={{ color: "#4ade80" }} /> : <Copy size={11} />}
                </button>
              </div>
            </div>

            {/* شارات سريعة */}
            <div className="px-4 mt-3 flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1" style={{ background: `${C.cyan}1a`, color: C.cyan, border: `1px solid ${C.cyan}30` }}>
                <Globe2 size={10} /> {basic.region || player.region || "—"}
              </span>
              {clan.clanName && (
                <span className="text-[10px] font-black px-2.5 py-1 rounded-full flex items-center gap-1" style={{ background: `${C.violet}1a`, color: C.violet, border: `1px solid ${C.violet}30` }}>
                  <Flag size={10} /> {clan.clanName}
                </span>
              )}
              {basic.badgeId && getResolved(basic.badgeId)?.image && (
                <span className="w-[26px] h-[26px] rounded-full overflow-hidden shrink-0" style={{ border: `1px solid ${C.gold}55` }} title={`الشارة\nID: ${basic.badgeId}`}>
                  <img src={getResolved(basic.badgeId)!.image!} className="w-full h-full object-contain" alt="شارة" />
                </span>
              )}
              {basic.pinId && getResolved(basic.pinId)?.image && (
                <span className="w-[26px] h-[26px] rounded-lg overflow-hidden shrink-0" style={{ border: `1px solid ${C.ember}55` }} title={`الدبوس\nID: ${basic.pinId}`}>
                  <img src={getResolved(basic.pinId)!.image!} className="w-full h-full object-contain" alt="دبوس" />
                </span>
              )}
              {basic.title && getResolved(basic.title)?.image && (
                <span className="w-[26px] h-[26px] rounded-lg overflow-hidden shrink-0" style={{ border: `1px solid ${C.violet}55` }} title={`اللقب\nID: ${basic.title}`}>
                  <img src={getResolved(basic.title)!.image!} className="w-full h-full object-contain" alt="لقب" />
                </span>
              )}
            </div>

            <div className="mt-3.5 h-px" style={{ background: `linear-gradient(90deg, transparent, ${C.line}, transparent)` }} />
          </div>

          {/* ═══════════════════════ المحتوى القابل للتمرير ═══════════════════════ */}
          <div className="overflow-y-auto p-3.5 flex-1 space-y-3">
            {/* الإحصائيات العامة */}
            <Section title="الإحصائيات العامة" icon={<Trophy size={14} />} accent={C.gold}>
              <div className="grid grid-cols-2 sm:grid-cols-4">
                <Stat label="الترتيب" value={basic.rank ?? "—"} icon={<Trophy size={14} />} accent={C.gold} />
                <Stat label="نقاط الترتيب" value={formatCompactNumber(basic.rankingPoints)} icon={<Star size={14} />} accent={C.gold} />
                <Stat label="ترتيب CS" value={basic.csRank ?? "—"} icon={<Swords size={14} />} accent={C.ember} />
                <Stat label="نقاط CS" value={formatCompactNumber(basic.csRankingPoints)} icon={<ShieldCheck size={14} />} accent={C.ember} />
                <Stat label="الإعجابات" value={formatCompactNumber(basic.liked)} icon={<Heart size={14} />} accent={C.violet} />
                <Stat label="الشارات" value={basic.badgeCnt ?? "—"} icon={<Award size={14} />} accent={C.violet} />
                <Stat label="تاريخ الإنشاء" value={formatArabicDate(basic.createAt)} icon={<Calendar size={14} />} accent={C.cyan} />
                <Stat label="آخر دخول" value={formatArabicDate(basic.lastLoginAt)} icon={<Clock size={14} />} accent={C.cyan} />
              </div>
            </Section>

            {/* الأسلحة المعروضة */}
            {Array.isArray(basic.weaponSkinShows) && basic.weaponSkinShows.length > 0 && (
              <Section title="جلود الأسلحة المعروضة" icon={<Swords size={14} />} accent={C.ember} tag={`${basic.weaponSkinShows.length}`}>
                <div className="p-3.5 flex flex-wrap gap-3">
                  {basic.weaponSkinShows.map((id: number, idx: number) => (
                    <FreeFireItemCard key={id} label={`سلاح ${idx + 1}`} itemId={id} resolved={getResolved(id)} accent={C.ember} size="lg" />
                  ))}
                </div>
              </Section>
            )}

            {/* الملابس والمظهر */}
            {Array.isArray(profile.clothes) && profile.clothes.length > 0 && (
              <Section title="الملابس والمظهر" icon={<Shirt size={14} />} accent={C.violet}>
                <div className="grid grid-cols-2">
                  <Stat label="لون البشرة" value={profile.skinColor ?? "—"} icon={<Sparkles size={13} />} accent={C.violet} />
                  <Stat
                    label="مفعّل / متطور"
                    value={`${profile.isSelected ? "نعم" : "لا"} / ${profile.isSelectedAwaken ? "نعم" : "لا"}`}
                    icon={<BadgeCheck size={13} />}
                    accent={C.violet}
                  />
                </div>
                <div className="p-3.5 flex flex-wrap gap-3" style={{ borderTop: `1px solid ${C.lineSoft}` }}>
                  {profile.clothes.map((id: number, idx: number) => (
                    <FreeFireItemCard
                      key={id}
                      label={CLOTHES_LABELS[idx] || `عنصر ${idx + 1}`}
                      itemId={id}
                      resolved={getResolved(id)}
                      accent={C.violet}
                    />
                  ))}
                </div>
              </Section>
            )}

            {/* العشيرة (بدون معلومات القائد) */}
            {Object.keys(clan).length > 0 && (
              <Section title="العشيرة" icon={<Users size={14} />} accent={C.violet}>
                <div className="grid grid-cols-2 sm:grid-cols-4">
                  <Stat label="اسم العشيرة" value={clan.clanName || "بدون عشيرة"} icon={<Flag size={13} />} accent={C.violet} />
                  <Stat label="المستوى" value={clan.clanLevel ?? "—"} icon={<Star size={13} />} accent={C.violet} />
                  <Stat label="الأعضاء" value={`${clan.memberNum ?? "—"}/${clan.capacity ?? "—"}`} icon={<Users size={13} />} accent={C.violet} />
                  <Stat label="المعرّف" value={clan.clanId ?? "—"} accent={C.violet} />
                </div>
              </Section>
            )}

            {/* معلومات إضافية */}
            <Section title="معلومات إضافية" icon={<ShieldCheck size={14} />} accent={C.cyan}>
              <div className="grid grid-cols-2 sm:grid-cols-3">
                <Stat label="المنطقة" value={basic.region || player.region || "—"} icon={<Globe2 size={13} />} accent={C.cyan} />
                <Stat label="اللغة" value={social.language?.replace("Language_", "") || "—"} icon={<Globe2 size={13} />} accent={C.cyan} />
              </div>
              {social.signature && (
                <div className="m-3.5 mt-3 rounded-xl p-3.5" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${C.cyan}2a` }}>
                  <p className="text-[9px] uppercase tracking-wider font-bold mb-1.5" style={{ color: C.dim2 }}>التوقيع</p>
                  <p className="text-[12.5px] leading-relaxed whitespace-pre-line break-words" style={{ color: "rgba(245,244,242,0.85)" }}>{social.signature}</p>
                </div>
              )}
            </Section>
          </div>

          {/* ═══════════════════════ التذييل ═══════════════════════ */}
          <div className="p-3.5 shrink-0" style={{ borderTop: `1px solid ${C.line}`, background: C.bgSoft }}>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl font-black text-sm transition-transform active:scale-[0.98]"
              style={{ background: `linear-gradient(90deg, ${C.gold}, ${C.ember})`, color: "#221604" }}
            >
              إغلاق
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default FreeFireProfileModal;
