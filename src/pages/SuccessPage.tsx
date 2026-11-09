import React from "react";
import { CheckCircle } from "lucide-react";
import { motion } from "motion/react";

export interface SuccessPageProps {
  setView: (val: any) => void;
  setActiveTab: (val: string) => void;
  viewData?: any;
  // [INVOICE-RESTYLE] وضع داكن بأيقونة صح متحركة (انميشن خفيف) — يُستخدم فقط لحظة نجاح شحن
  // الرصيد؛ بقية مسارات النجاح في الموقع تبقى بالمظهر الفاتح الافتراضي كما كانت تماماً.
  dark?: boolean;
  // [FIX] خلفية هذه الشاشة يجب أن تطابق وضع الموقع الفعلي (ليلي/نهاري)، لا أن تكون سوداء دائماً.
  isDarkMode?: boolean;
}

const SuccessPage = ({ setView, setActiveTab, viewData, dark = false, isDarkMode = true }: SuccessPageProps) => {
  if (dark) {
    return (
      <div className={`fixed inset-0 z-[95] flex flex-col items-center justify-center text-center px-6 space-y-6 ${isDarkMode ? "bg-black" : "bg-white"}`}>
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 18 }}
          className={`w-24 h-24 rounded-full flex items-center justify-center ${isDarkMode ? "bg-emerald-500/15 text-emerald-400" : "bg-emerald-50 text-emerald-500"}`}
        >
          <motion.svg
            viewBox="0 0 52 52"
            className="w-14 h-14"
            initial="hidden"
            animate="visible"
          >
            <motion.circle
              cx="26" cy="26" r="24" fill="none" stroke="currentColor" strokeWidth="2.5"
              variants={{ hidden: { pathLength: 0, opacity: 0 }, visible: { pathLength: 1, opacity: 1 } }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
            <motion.path
              d="M14 27l7 7 17-17" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
              variants={{ hidden: { pathLength: 0, opacity: 0 }, visible: { pathLength: 1, opacity: 1 } }}
              transition={{ duration: 0.4, delay: 0.35, ease: "easeOut" }}
            />
          </motion.svg>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.35 }}
        >
          <h2 className={`text-xl font-bold mb-1.5 ${isDarkMode ? "text-white" : "text-gray-800"}`}>تم شحن الرصيد بنجاح</h2>
          <p className={`text-sm ${isDarkMode ? "text-white/60" : "text-gray-400"}`}>{viewData || "تمت إضافة المبلغ إلى رصيدك."}</p>
        </motion.div>
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45, duration: 0.35 }}
          onClick={() => { setView({ type: "main" }); setActiveTab("home"); }}
          className={`px-8 py-3.5 rounded-full font-bold w-full max-w-xs ${isDarkMode ? "bg-zinc-800 text-white" : "bg-gray-900 text-white"}`}
        >
          العودة للرئيسية
        </motion.button>
      </div>
    );
  }

  return (
    <div className="px-6 flex flex-col items-center justify-center min-h-[70vh] text-center space-y-6">
      <div className="w-24 h-24 bg-brand-light text-brand rounded-full flex items-center justify-center shadow-inner">
        <CheckCircle size={64} />
      </div>
      <div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">عملية ناجحة</h2>
        <p className="text-gray-400">{viewData}</p>
      </div>
      <button
        onClick={() => { setView({ type: "main" }); setActiveTab("home"); }}
        className="bg-brand text-white px-8 py-3 rounded-lg font-bold"
      >
        العودة للرئيسية
      </button>
    </div>
  );
};

export default SuccessPage;
