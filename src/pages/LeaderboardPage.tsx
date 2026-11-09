import React, { useState, useEffect } from "react";
import { PartyPopper,
  ArrowRight, Wallet, Trophy, Share2, Zap, HelpCircle, Info, User,
} from "lucide-react";
import { UserData } from "../types";
import OptimizedImage from "../components/OptimizedImage";

interface Theme {
  bgLight: string;
  icon: string;
}

export interface LeaderboardPageProps {
  user: UserData | null;
  theme: Theme;
  setView: (val: any) => void;
}

export default function LeaderboardPage({ user, theme, setView }: LeaderboardPageProps) {
  const [tab, setTab] = useState<'topup'|'referral'|'activity'>('topup');
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInfo, setShowInfo] = useState<string|null>(null);

  useEffect(() => {
    setLoading(true);
    setData([]);
    fetch(`/api/leaderboard/${tab}`)
      .then(r => r.json())
      .then(d => setData(Array.isArray(d) ? d : []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [tab]);

  const tabs = [
    {
      key: 'topup',
      label: 'أكثر شحناً',
      icon: <Wallet size={18}/>,
      color: 'text-green-600',
      activeBg: 'bg-green-50 border-green-200',
      desc: 'ترتيب المستخدمين حسب إجمالي مبالغ الشحن التي أضافوها لحساباتهم منذ تسجيلهم وحتى الآن.'
    },
    {
      key: 'referral',
      label: 'أكثر إحالةً',
      icon: <Share2 size={18}/>,
      color: 'text-blue-600',
      activeBg: 'bg-blue-50 border-blue-200',
      desc: 'ترتيب المستخدمين حسب عدد الأصدقاء الذين دعوهم للمنصة عبر رابط الإحالة الخاص بهم.'
    },
    {
      key: 'activity',
      label: 'الأكثر نشاطاً',
      icon: <Zap size={18}/>,
      color: 'text-amber-600',
      activeBg: 'bg-amber-50 border-amber-200',
      desc: 'ترتيب المستخدمين حسب إجمالي عدد الطلبات التي أجروها في المتجر منذ انضمامهم.'
    },
  ] as const;

  const medalIcons = [
    <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center"><Trophy size={16} className="text-amber-500"/></div>,
    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center"><Trophy size={16} className="text-gray-400"/></div>,
    <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center"><Trophy size={16} className="text-orange-400"/></div>,
  ];

  const activeTab = tabs.find(t => t.key === tab)!;

  return (
    <div className="px-4 space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center gap-3 pt-2">
        <button onClick={() => setView({ type: 'main' })} className="p-2 bg-gray-100 rounded-lg text-gray-600 active:scale-90 transition-all">
          <ArrowRight size={20} />
        </button>
        <div className="flex-1">
          <h2 className="font-bold text-gray-800 text-lg flex items-center gap-2">
            <Trophy size={20} className="text-amber-500" />لوحة الترتيب
          </h2>
          <p className="text-xs text-gray-400">ترتيب مدى الحياة · بدون جوائز</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 gap-2">
        {tabs.map(t => (
          <div key={t.key} className="relative">
            <button onClick={() => { setTab(t.key); setShowInfo(null); }}
              className={`w-full p-3 rounded-lg border text-center transition-all active:scale-95 ${tab === t.key ? t.activeBg : 'bg-white border-gray-100'}`}>
              <div className={`flex justify-center mb-1 ${tab === t.key ? t.color : 'text-gray-400'}`}>{t.icon}</div>
              <p className={`text-[10px] font-bold ${tab === t.key ? t.color : 'text-gray-400'}`}>{t.label}</p>
            </button>
            <button
              onClick={() => setShowInfo(showInfo === t.key ? null : t.key)}
              className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              <HelpCircle size={11}/>
            </button>
          </div>
        ))}
      </div>

      {/* Info tooltip */}
      {showInfo && (
        <div className={`p-3 rounded-lg border text-xs text-gray-600 leading-relaxed ${tabs.find(t=>t.key===showInfo)?.activeBg || 'bg-gray-50 border-gray-100'}`}>
          <div className="flex items-start gap-2">
            <Info size={14} className="mt-0.5 shrink-0 text-gray-400"/>
            <p>{tabs.find(t => t.key === showInfo)?.desc}</p>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin"/></div>
      ) : data.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Trophy size={40} className="mx-auto mb-3 opacity-20"/>
          <p className="text-sm">لا توجد بيانات بعد</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((entry: any, i: number) => (
            <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
              i === 0 ? 'bg-amber-50 border-amber-200 shadow-sm' :
              i === 1 ? 'bg-gray-50 border-gray-200' :
              i === 2 ? 'bg-orange-50 border-orange-100' :
              'bg-white border-gray-100'
            }`}>
              {/* Rank */}
              <div className="w-8 shrink-0 flex justify-center">
                {i < 3
                  ? medalIcons[i]
                  : <span className="text-xs font-black text-gray-400">#{i+1}</span>
                }
              </div>
              {/* Avatar */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden ${theme.bgLight}`}>
                {entry.avatar_url
                  ? <OptimizedImage src={entry.avatar_url} width={80} height={80} className="w-full h-full object-cover"/>
                  : <User size={20} className={theme.icon}/>}
              </div>
              {/* Name */}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm text-gray-800 truncate">{entry.name || 'مجهول'}</p>
                {entry.badge && (
                  <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">{entry.badge}</span>
                )}
              </div>
              {/* Value */}
              <div className="text-right shrink-0 flex items-center gap-1">
                <div className={i < 3 ? activeTab.color : 'text-gray-400'}>
                  {activeTab.icon}
                </div>
                <div>
                  <p className={`font-black text-sm ${i < 3 ? activeTab.color : 'text-gray-700'}`}>{entry.value}</p>
                  <p className="text-[9px] text-gray-400">{entry.unit}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Current user position */}
      {user && data.length > 0 && (() => {
        const myIdx = data.findIndex((e:any) => String(e.user_id) === String(user.id));
        return (
          <div className={`rounded-lg p-3 text-center border ${myIdx >= 0 ? 'bg-brand-light border-brand-soft' : 'bg-gray-50 border-gray-100'}`}>
            {myIdx >= 0
              ? <p className="text-xs font-bold text-brand">أنت في المركز #{myIdx + 1} <PartyPopper size={14} /></p>
              : <p className="text-xs text-gray-400">أنت لست في الترتيب حتى الآن · استمر!</p>
            }
          </div>
        );
      })()}
    </div>
  );
}
