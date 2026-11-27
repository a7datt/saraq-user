import React, { useEffect, useState } from "react";
import { ArrowRight, MapPin, Phone, Globe, Store } from "lucide-react";

interface Props {
  setView: (v: any) => void;
}

interface Agent { id: number; name: string; image_url: string | null; website_url: string | null; phone: string | null; location: string | null; description: string | null }

const mapsLink = (loc: string) => /^https?:\/\//i.test(loc) ? loc : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(loc)}`;

/** [AGENTS] صفحة "وكلائنا": وكلاء المتجر المعتمدون مع الصورة والهاتف والموقع والرابط. */
export default function OurAgentsPage({ setView }: Props) {
  const [list, setList] = useState<Agent[] | null>(null);

  useEffect(() => {
    fetch("/api/agents/directory").then(r => r.json()).then(d => setList(Array.isArray(d) ? d : [])).catch(() => setList([]));
  }, []);

  return (
    <div className="px-4 space-y-4 pb-20" dir="rtl">
      <div className="flex items-center gap-2 mb-2">
        <button onClick={() => setView({ type: "main" })} className="p-2 bg-gray-100 rounded-full active:scale-95"><ArrowRight size={20} className="text-gray-600" /></button>
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2"><Store size={20} className="text-brand" /> وكلائنا</h2>
      </div>

      {!list ? <p className="text-center text-sm text-gray-400 py-10">جاري التحميل...</p>
        : list.length === 0 ? <p className="text-center text-sm text-gray-500 bg-gray-50 rounded-xl p-6">لا يوجد وكلاء معروضون حالياً.</p>
        : (
          <div className="space-y-3">
            {list.map(a => (
              <div key={a.id} className="bg-white border border-gray-100 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  {a.image_url
                    ? <img src={a.image_url} alt={a.name} className="w-16 h-16 rounded-xl object-cover bg-gray-100 shrink-0" loading="lazy" />
                    : <div className="w-16 h-16 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 shrink-0"><Store size={26} /></div>}
                  <div className="min-w-0">
                    <p className="text-base font-black text-gray-800">{a.name}</p>
                    {a.location && <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><MapPin size={12} className="shrink-0" /><span className="truncate">{a.location}</span></p>}
                  </div>
                </div>
                {a.description && <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{a.description}</p>}
                <div className="flex flex-wrap gap-2">
                  {a.phone && (
                    <a href={`tel:${a.phone.replace(/[^\d+]/g, "")}`} className="flex items-center gap-1.5 text-xs font-bold bg-green-50 text-green-700 rounded-lg px-3 py-2" dir="ltr"><Phone size={14} />{a.phone}</a>
                  )}
                  {a.phone && (
                    <a href={`https://wa.me/${a.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-bold bg-emerald-50 text-emerald-700 rounded-lg px-3 py-2">واتساب</a>
                  )}
                  {a.location && (
                    <a href={mapsLink(a.location)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-bold bg-sky-50 text-sky-700 rounded-lg px-3 py-2"><MapPin size={14} />الموقع على الخريطة</a>
                  )}
                  {a.website_url && (
                    <a href={a.website_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-bold bg-gray-100 text-gray-700 rounded-lg px-3 py-2"><Globe size={14} />زيارة الموقع</a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}
