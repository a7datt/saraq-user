/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { Megaphone, X } from "lucide-react";

interface EntryPopupModalProps {
  text: string;
  link?: string;
  onClose: () => void;
}

/**
 * إشعار الدخول (Entry Popup) — مودال منبثق في منتصف الشاشة يظهر بالصفحة الرئيسية
 * فقط، بحسب ما يحدده الأدمن من لوحة التحكم (تفعيل/تعطيل، النص، الرابط، وعدد
 * الجلسات بين كل ظهور). التصميم يتبع ألوان المتجر (brand) القادمة من قاعدة البيانات.
 */
const EntryPopupModal: React.FC<EntryPopupModalProps> = ({ text, link, onClose }) => {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-5 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-white dark:bg-gray-900 rounded-3xl shadow-2xl border border-brand/20 p-6 text-center relative animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        <button
          onClick={onClose}
          aria-label="إغلاق"
          className="absolute top-3 left-3 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-300 active:scale-90 transition-transform"
        >
          <X size={16} />
        </button>

        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-brand/10 flex items-center justify-center">
          <Megaphone size={28} className="text-brand" />
        </div>

        <p className="text-[15px] leading-relaxed text-gray-700 dark:text-gray-200 whitespace-pre-wrap mb-6">
          {text}
        </p>

        <div className="space-y-2">
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="block w-full bg-brand rounded-xl py-3 text-sm font-bold active:scale-[0.98] transition-transform"
            >
              فتح الرابط
            </a>
          )}
          <button
            onClick={onClose}
            className="block w-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-xl py-3 text-sm font-bold active:scale-[0.98] transition-transform"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

export default EntryPopupModal;
