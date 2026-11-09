import React, { useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";

export interface PrivacyPolicyPageProps {
  setView: (val: any) => void;
}

const PrivacyPolicyPage: React.FC<PrivacyPolicyPageProps> = ({ setView }) => {
  const [policy, setPolicy] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then(res => res.json())
      .then(data => {
        const p = data.find((s: any) => s.key === 'privacy_policy');
        setPolicy(p ? p.value : "سيتم إضافة سياسة الخصوصية قريباً.");
      })
      .catch(console.error);
  }, []);

  return (
    <div className="px-4 space-y-6 pb-20">
      <div className="flex items-center gap-2 mb-6">
        <button onClick={() => setView({ type: "main" })} className="p-2 bg-gray-100 rounded-full">
          <ArrowRight size={20} className="text-gray-600" />
        </button>
        <h2 className="text-xl font-bold text-gray-800">سياسة الخصوصية</h2>
      </div>

      <div className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm">
        <div className="prose prose-sm max-w-none text-gray-600 leading-relaxed whitespace-pre-wrap">
          {policy}
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
