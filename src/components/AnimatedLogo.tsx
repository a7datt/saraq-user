import React from "react";
import OptimizedImage from "./OptimizedImage";

interface AnimatedLogoProps {
  imageUrl?: string;
  size?: number;
  showText?: boolean;
  onClick?: () => void;
}

/** شعار سراقب ستور المتحرك: حلقة دوّارة بلون الموقع + نبض خفيف + وميض ضوئي يمرّ على الاسم. */
export default function AnimatedLogo({ imageUrl, size = 40, showText = true, onClick }: AnimatedLogoProps) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-2 select-none group" aria-label="سراقب ستور">
      <span className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
        <span className="sq-logo-ring" />
        <span className="sq-logo-ring sq-logo-ring--inner" />
        <span className="sq-logo-core">
          {imageUrl ? (
            <OptimizedImage src={imageUrl} width={size * 2} height={size * 2} alt="Logo" className="w-full h-full object-cover" eager />
          ) : (
            <svg viewBox="0 0 64 64" className="w-[62%] h-[62%]" aria-hidden="true">
              <defs>
                <linearGradient id="sq-s" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#ffffff" />
                  <stop offset="1" stopColor="#fecaca" />
                </linearGradient>
              </defs>
              <path
                d="M46 18c-3-5-9-7-15-6-7 1-12 6-11 12 1 6 7 8 13 9 6 1 12 3 12 9 0 7-7 11-14 10-6-1-10-4-12-8"
                fill="none"
                stroke="url(#sq-s)"
                strokeWidth="7"
                strokeLinecap="round"
                className="sq-logo-stroke"
              />
            </svg>
          )}
        </span>
      </span>
      {showText && (
        <span className="hidden sm:flex flex-col leading-none text-right">
          <span className="sq-logo-text font-black text-[15px] tracking-tight">سراقب ستور</span>
          <span className="text-[9px] font-bold tracking-[0.25em] text-[var(--brand)] uppercase">SARAQIB</span>
        </span>
      )}
    </button>
  );
}
