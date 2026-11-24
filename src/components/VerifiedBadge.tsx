import React from "react";

/** [PHASE-3] علامة التوثيق الزرقاء بجانب اسم المستخدم الموثّق الهوية. */
export default function VerifiedBadge({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className="inline-block align-middle shrink-0 mr-1" role="img" aria-label="حساب موثّق">
      <title>حساب موثّق</title>
      <path fill="#1d9bf0" d="M12 1.5l2.6 1.9 3.2-.1 1 3.1 2.6 1.9-1 3.1 1 3.1-2.6 1.9-1 3.1-3.2-.1L12 22.5l-2.6-1.9-3.2.1-1-3.1-2.6-1.9 1-3.1-1-3.1 2.6-1.9 1-3.1 3.2.1z" />
      <path fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" d="M7.8 12.4l3 3 5.6-6" />
    </svg>
  );
}

/** سطر اسم المستخدم + العلامة الزرقاء (يظهر أعلى صفحتي الطلبات والمدفوعات). */
export function UserNameBar({ user }: { user: { name?: string; identity_verified?: boolean } | null | undefined }) {
  if (!user?.name) return null;
  return (
    <p className="text-sm font-bold text-gray-500 flex items-center gap-1 px-1">
      {user.name}{user.identity_verified && <VerifiedBadge />}
    </p>
  );
}
