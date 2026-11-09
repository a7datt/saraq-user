/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { ImageOff } from "lucide-react";

export interface FFItemResolved {
  id: string;
  image: string | null;
  source: "itemid" | "none";
  name: string | null;
  type: string | null;
}

interface FreeFireItemCardProps {
  label: string;
  itemId: number | string;
  resolved?: FFItemResolved;
  size?: "sm" | "md" | "lg";
  rounded?: "square" | "circle";
  accent?: string;
}

const SIZES: Record<string, string> = {
  sm: "w-14 h-14",
  md: "w-20 h-20",
  lg: "w-28 h-28",
};

export const FreeFireItemCard: React.FC<FreeFireItemCardProps> = ({
  label,
  itemId,
  resolved,
  size = "md",
  rounded = "square",
  accent = "#ff6b35",
}) => {
  const [errored, setErrored] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const src = resolved?.image || undefined;
  const sourceLabel = resolved?.source === "itemid" ? "ItemID" : "غير متوفرة";
  const title = `${label}\nID: ${itemId}\nالمصدر: ${sourceLabel}`;

  return (
    <div
      className="flex flex-col items-center gap-1.5 group"
      title={title}
    >
      <div
        className={`relative ${SIZES[size]} ${rounded === "circle" ? "rounded-full" : "rounded-xl"} overflow-hidden border-2 flex items-center justify-center transition-transform duration-200 group-hover:scale-105`}
        style={{
          borderColor: accent,
          background: "linear-gradient(145deg, #1a1a2e, #16213e)",
          boxShadow: `0 0 14px -4px ${accent}66`,
        }}
      >
        {!loaded && !errored && (
          <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-white/5 to-white/10" />
        )}
        {src && !errored ? (
          <img
            src={src}
            alt={label}
            loading="lazy"
            decoding="async"
            onLoad={() => setLoaded(true)}
            onError={() => setErrored(true)}
            className={`w-full h-full object-contain p-1.5 transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-gray-500">
            <ImageOff size={18} />
          </div>
        )}
      </div>
      <span className="text-[10px] font-bold text-white/70 text-center leading-tight max-w-[80px] truncate">
        {label}
      </span>
    </div>
  );
};

export default FreeFireItemCard;
