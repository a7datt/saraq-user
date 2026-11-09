/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, Component, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { 
  Home, 
  Wallet, 
  ShoppingBag, 
  User, 
  UserCircle,
  Bell, 
  Menu, 
  ChevronRight, 
  ChevronLeft,
  Plus, 
  Image as ImageIcon,
  CheckCircle,
  XCircle,
  Clock,
  ArrowRight,
  ArrowLeft,
  LogOut,
  Settings,
  Key,
  History,
  MessageSquare,
  Ticket,
  Search,
  Lock,
  Copy,
  ExternalLink,
  Pencil,
  Database,
  Upload,
  Download,
  Trash2,
  PlusCircle,
  ShieldCheck,
  RefreshCw,
  FileJson,
  Eraser,
  Star,

  Award,
  Crown,
  ChevronDown,
  ChevronUp,
  Palette,
  Send,
  X,
  Paperclip,
  Bot,
  Zap,
  Trophy,
  Share2,
  Info,
  Tag,
  BarChart2,
  TrendingUp,
  Calendar,
  ChevronDown as ChevronDownIcon,
  MessageCircle,
  Filter,
  RefreshCcw,
  Sun,
  Moon,
  Gift,
  Headphones,
  Link2,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const ChargeIcon = ({ size = 22, className = "" }: { size?: number; className?: string }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={1.5}
    stroke="currentColor"
    width={size}
    height={size}
    className={className}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z"
    />
  </svg>
);

import { createClient } from "@supabase/supabase-js";
import { 
  Category, 
  Subcategory, 
  SubSubCategory, 
  Product, 
  UserData, 
  Order, 
  Transaction, 
  PaymentMethod, 
  Banner, 
  Offer,
} from "./types";
import { ToastContainer, showToast } from "./components/ToastContainer";
import { CustomDialogContainer, showDialog, showConfirm, showPromptDialog } from "./components/CustomDialogContainer";
import OrderPollingStatus from "./components/OrderPollingStatus";
import VoucherRedeemPage from "./pages/VoucherRedeemPage";
import { useStoreAppearance, gridColsClass, ratioToClass, applyThemeToDocument } from "./utils/useStoreAppearance";
import { uploadImage } from "./utils/uploadImage";
import HomePage from "./pages/HomePage";
import EntryPopupModal from "./components/EntryPopupModal";
import GooglePhoneGateModal from "./components/GooglePhoneGateModal";
import SubcategoriesPage from "./pages/SubcategoriesPage";
import SubSubCategoriesPage from "./pages/SubSubCategoriesPage";
import ProductsPage from "./pages/ProductsPage";
import QuickOrderPage from "./pages/QuickOrderPage";
import CheckoutPage from "./pages/CheckoutPage";
import WalletPage from "./pages/WalletPage";
import PaymentsPage from "./pages/PaymentsPage";
import OrdersPage from "./pages/OrdersPage";
import ProfilePage from "./pages/ProfilePage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import LoginPage from "./pages/LoginPage";
import ProfileDetailsPage from "./pages/ProfileDetailsPage";
import ActiveSessionsPage from "./pages/ActiveSessionsPage";
import ActivityLogPage from "./pages/ActivityLogPage";
import UserApiPage from "./pages/UserApiPage";
import SessionsActivityPage from "./pages/SessionsActivityPage";
import LeaderboardPage from "./pages/LeaderboardPage";
import EditProfilePage from "./pages/EditProfilePage";
import ReferralPage from "./pages/ReferralPage";
import ChatPage from "./pages/ChatPage";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage";
import SettingsPage from "./pages/SettingsPage";
import SuccessPage from "./pages/SuccessPage";
import ApiDocsPage from "./pages/ApiDocsPage";
import FaqPage from "./pages/FaqPage";
import OptimizedImage from "./components/OptimizedImage";
import SeoHead from "./components/SeoHead";
import { CurrencyDropdown } from "./components/CurrencyDropdown";

// -- Currency option shape (dynamic multi-currency system, managed from admin DB) --
export interface CurrencyOption {
  id: number;
  name: string;
  symbol: string;
  exchange_rate: number;
  is_active: boolean;
  is_default: boolean;
}

// --- Supabase Configuration ---
const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);



// --- Error Boundary ---
interface ErrorBoundaryProps {
  children: React.ReactNode;
}
interface ErrorBoundaryState {
  hasError: boolean;
  error: any;
}
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
    const userStr = localStorage.getItem("userId");
    const user = userStr ? JSON.parse(userStr) : null;
    fetch("/api/report-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        error: error?.toString(),
        stack: errorInfo?.componentStack,
        userInfo: user ? { id: user.id, name: user.name } : "Guest"
      })
    }).catch(console.error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center bg-gray-50">
          <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6">
            <XCircle size={48} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">عذراً، حدث خطأ ما</h1>
          <p className="text-gray-600 mb-8 max-w-md">
            لقد واجه التطبيق مشكلة غير متوقعة. يرجى أخذ لقطة شاشة (Screenshot) والتواصل مع الدعم الفني لمساعدتك.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="px-8 py-3 bg-brand text-white rounded-lg font-bold shadow-lg shadow-brand-soft"
          >
            إعادة تحميل التطبيق
          </button>
          {process.env.NODE_ENV === 'development' && (
            <pre className="mt-8 p-4 bg-gray-100 rounded-md text-left text-xs overflow-auto max-w-full">
              {this.state.error?.toString()}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}


// Toast system (ToastContainer + showToast) extracted to ./components/ToastContainer
// Custom dialog system (CustomDialogContainer + showDialog/showConfirm/showPromptDialog) extracted to ./components/CustomDialogContainer

// WalletChargeView extracted (together with WalletView, its sole consumer) to src/pages/WalletPage.tsx

// ===== PIXEL MORPH SPINNER =====
const pixelMorphStyles = `
  @keyframes pixMorph {
    0%, 100% { transform: scale(1); opacity: 1; border-radius: 2px; }
    40%       { transform: scale(0.2); opacity: 0.2; border-radius: 50%; }
    70%       { transform: scale(1.2); opacity: 0.9; border-radius: 3px; }
  }
  .spinner-pixel {
    display: grid;
    grid-template-columns: repeat(5, 12px);
    grid-template-rows: repeat(5, 12px);
    gap: 2px;
  }
  .px {
    width: 12px;
    height: 12px;
    border-radius: 2px;
    background-color: var(--c1);
    animation: pixMorph 2.4s ease-in-out infinite;
  }
  .px:nth-child(3n)  { background-color: var(--c2); animation-delay: 0.2s; }
  .px:nth-child(5n)  { background-color: var(--c3); animation-delay: 0.5s; }
  .px:nth-child(7n)  { animation-delay: 0.8s; }
  .px:nth-child(11n) { animation-delay: 1.1s; }
`;

// ===== SESSION SYNC SPINNER (used only for the post-refresh auth-check overlay) =====
const sessionSyncStyles = `
  @keyframes sessionSyncRotate {
    to { transform: rotate(360deg); }
  }
  @keyframes sessionSyncDotPulse {
    0%   { transform: scale(0.8); opacity: 0.35; }
    50%  { transform: scale(1.15); opacity: 1; }
    100% { transform: scale(0.8); opacity: 0.35; }
  }
`;

function SessionSyncSpinner() {
  const dots = [
    { angle: 0, delay: "0s" },
    { angle: 120, delay: "-0.6s" },
    { angle: 240, delay: "-1.2s" },
  ];
  const [gradient, setGradient] = React.useState("linear-gradient(135deg, hsl(0, 0%, 35%), hsl(0, 0%, 70%))");

  React.useEffect(() => {
    const hexToHsl = (hex: string): [number, number, number] | null => {
      const clean = hex.replace("#", "").trim();
      if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
      const r = parseInt(clean.slice(0, 2), 16) / 255;
      const g = parseInt(clean.slice(2, 4), 16) / 255;
      const b = parseInt(clean.slice(4, 6), 16) / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h = 0, s = 0;
      const l = (max + min) / 2;
      const d = max - min;
      if (d !== 0) {
        s = d / (1 - Math.abs(2 * l - 1));
        switch (max) {
          case r: h = 60 * (((g - b) / d) % 6); break;
          case g: h = 60 * ((b - r) / d + 2); break;
          case b: h = 60 * ((r - g) / d + 4); break;
        }
      }
      if (h < 0) h += 360;
      return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
    };

    const applyFromBrand = () => {
      const brand = getComputedStyle(document.documentElement).getPropertyValue("--brand").trim() || "#000000";
      const hsl = hexToHsl(brand);
      if (!hsl) {
        setGradient("linear-gradient(135deg, hsl(0, 0%, 35%), hsl(0, 0%, 70%))");
        return;
      }
      const [h, s] = hsl;
      setGradient(`linear-gradient(135deg, hsl(${h}, ${s}%, 35%), hsl(${h}, ${s}%, 70%))`);
    };

    applyFromBrand();
    const observer = new MutationObserver(applyFromBrand);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <style>{sessionSyncStyles}</style>
      <div
        style={{
          position: "relative",
          width: 52,
          height: 52,
          background: "transparent",
          animation: "sessionSyncRotate 1.8s linear infinite",
        }}
      >
        {dots.map((dot, i) => {
          const rad = (dot.angle * Math.PI) / 180;
          const x = 26 + 26 * Math.cos(rad) - 3.5;
          const y = 26 + 26 * Math.sin(rad) - 3.5;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: x,
                top: y,
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: gradient,
                animation: "sessionSyncDotPulse 1.8s ease-in-out infinite",
                animationDelay: dot.delay,
              }}
            />
          );
        })}
      </div>
    </>
  );
}
// ===== END SESSION SYNC SPINNER =====

function PixelMorphSpinner() {
  React.useEffect(() => {
    const hexToHsl = (hex: string): [number, number, number] | null => {
      const clean = hex.replace("#", "").trim();
      if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
      const r = parseInt(clean.slice(0, 2), 16) / 255;
      const g = parseInt(clean.slice(2, 4), 16) / 255;
      const b = parseInt(clean.slice(4, 6), 16) / 255;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h = 0, s = 0;
      const l = (max + min) / 2;
      const d = max - min;
      if (d !== 0) {
        s = d / (1 - Math.abs(2 * l - 1));
        switch (max) {
          case r: h = 60 * (((g - b) / d) % 6); break;
          case g: h = 60 * ((b - r) / d + 2); break;
          case b: h = 60 * ((r - g) / d + 4); break;
        }
      }
      if (h < 0) h += 360;
      return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
    };

    const applyFromBrand = () => {
      const root = document.documentElement;
      const brand = getComputedStyle(root).getPropertyValue("--brand").trim() || "#000000";
      const hsl = hexToHsl(brand);
      if (!hsl) {
        // القيمة ليست hex صالح (مثلاً متغير CSS آخر)، نستخدم الأسود كافتراضي آمن بدل الأزرق الثابت
        root.style.setProperty("--c1", "hsl(0, 0%, 75%)");
        root.style.setProperty("--c2", "hsl(0, 0%, 45%)");
        root.style.setProperty("--c3", "hsl(0, 0%, 20%)");
        return;
      }
      const [h, s] = hsl;
      // نفس تدرجات الفاتح/المتوسط/الغامق لكن مبنية على لون المتجر الفعلي من قاعدة البيانات
      root.style.setProperty("--c1", `hsl(${h}, ${s}%, 75%)`);
      root.style.setProperty("--c2", `hsl(${h}, ${s}%, 50%)`);
      root.style.setProperty("--c3", `hsl(${h}, ${s}%, 30%)`);
    };

    applyFromBrand();
    // إذا تغيّر لون المتجر بعد جلبه من قاعدة البيانات (بعد أول رسم)، نحدّث الألوان فوراً
    const observer = new MutationObserver(applyFromBrand);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <style>{pixelMorphStyles}</style>
      <div className="spinner-pixel">
        {Array.from({ length: 25 }).map((_, i) => (
          <div key={i} className="px" />
        ))}
      </div>
    </>
  );
}
// ===== END PIXEL MORPH SPINNER =====

// ===== LOGO PULSE SPINNER (شعار ينبض خفيفاً من الأسفل للأعلى مع لمعة خفيفة) =====
const logoPulseStyles = `
  @keyframes logoPulseMove {
    0%, 100% { opacity: 0; transform: scale(0.88); filter: drop-shadow(0 0 0 transparent); }
    50%      { opacity: 1; transform: scale(1); filter: drop-shadow(0 6px 10px var(--brand-pulse-glow)); }
  }
  @keyframes logoPulseShine {
    0%   { transform: translateX(-130%) rotate(20deg); opacity: 0; }
    15%  { opacity: 0.55; }
    50%  { opacity: 0.55; }
    65%  { opacity: 0; }
    100% { transform: translateX(130%) rotate(20deg); opacity: 0; }
  }
  .logo-pulse-wrap {
    position: relative;
    width: 76px;
    height: 76px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .logo-pulse-img {
    width: 60px;
    height: 60px;
    object-fit: contain;
    animation: logoPulseMove 1.9s ease-in-out infinite;
    position: relative;
    z-index: 1;
  }
  .logo-pulse-shine {
    position: absolute;
    top: 0;
    left: 0;
    width: 40%;
    height: 160%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.75), transparent);
    animation: logoPulseShine 1.9s ease-in-out infinite;
    pointer-events: none;
    z-index: 2;
    mix-blend-mode: overlay;
  }
`;

function LogoPulseSpinner({ logoUrl }: { logoUrl?: string }) {
  React.useEffect(() => {
    const root = document.documentElement;
    const brand = getComputedStyle(root).getPropertyValue("--brand").trim() || "#000000";
    root.style.setProperty("--brand-pulse-glow", `${brand}66`);
  }, []);

  if (!logoUrl) return <PixelMorphSpinner />;

  return (
    <>
      <style>{logoPulseStyles}</style>
      <div className="logo-pulse-wrap">
        <img src={logoUrl} alt="" className="logo-pulse-img" />
        <div className="logo-pulse-shine" />
      </div>
    </>
  );
}
// ===== END LOGO PULSE SPINNER =====

// ===== LOGO RING SPINNER (دائرة تحميل داخلها شعار الموقع) =====
const logoRingStyles = `
  @keyframes logoRingSpin { to { transform: rotate(360deg); } }
  .logo-ring-wrap {
    position: relative;
    width: 76px;
    height: 76px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .logo-ring-track {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 4px solid color-mix(in srgb, var(--brand) 18%, transparent);
  }
  .logo-ring-spin {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 4px solid transparent;
    border-top-color: var(--brand);
    border-right-color: var(--brand);
    animation: logoRingSpin 0.9s linear infinite;
  }
  .logo-ring-img {
    width: 44px;
    height: 44px;
    object-fit: contain;
    border-radius: 50%;
    position: relative;
    z-index: 1;
  }
`;

function LogoRingSpinner({ logoUrl }: { logoUrl?: string }) {
  return (
    <>
      <style>{logoRingStyles}</style>
      <div className="logo-ring-wrap">
        <div className="logo-ring-track" />
        <div className="logo-ring-spin" />
        {logoUrl && <img src={logoUrl} alt="" className="logo-ring-img" />}
      </div>
    </>
  );
}
// ===== END LOGO RING SPINNER =====

export default function App() {
  const [activeTab, setActiveTab] = useState("home");
  const [user, setUser] = useState<UserData | null>(null);
  // [FIX] عند وجود جلسة محفوظة، نبقي التطبيق بحالة "تحقق من الجلسة" حتى تصل بيانات المستخدم
  // فعلاً، بدل أن تظهر الواجهة كزائر للحظات ثم تتحول فجأة لمستخدم مسجّل
  const [authLoading, setAuthLoading] = useState<boolean>(() => {
    const savedUserId = localStorage.getItem("userId");
    return !!savedUserId && !isNaN(Number(savedUserId));
  });
  const [userStats, setUserStats] = useState<any>(null);
  const [view, setView] = useState<{ type: string; id?: number; data?: any; catId?: number; fromSubSub?: boolean; fromCategory?: boolean; subId?: number; subName?: string; fromFav?: boolean; dark?: boolean }>({ type: "main" });
  const [pageLoading, setPageLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [categoryDirectProducts, setCategoryDirectProducts] = useState<Product[]>([]);
  const [subSubCategories, setSubSubCategories] = useState<SubSubCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [checkoutQuantity, setCheckoutQuantity] = useState<number>(0);
  const [checkoutOrderResult, setCheckoutOrderResult] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const { appearance } = useStoreAppearance();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [themeModal, setThemeModal] = useState({ isOpen: false, color: "#10b981" });
  const [showAllRewards, setShowAllRewards] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [siteSettings, setSiteSettings] = useState<any[]>([]);
  const [entryPopup, setEntryPopup] = useState<{ show: boolean; text: string; link?: string }>({ show: false, text: "" });
  const [maintenanceIpAllowed, setMaintenanceIpAllowed] = useState(false);
  // Dark mode is controlled by the user's own choice in the UI, saved locally
  // so it persists across refreshes regardless of the admin's default setting.
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") return true;
    if (saved === "light") return false;
    return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  // -- Currency state (dynamic multi-currency system) --
  const [availableCurrencies, setAvailableCurrencies] = useState<CurrencyOption[]>([]);
  const [currency, setCurrency] = useState<"USD" | number>(() => {
    const stored = localStorage.getItem("currencyId");
    return stored ? Number(stored) : "USD";
  });
  const [sypRate, setSypRate] = useState<number>(() => {
    const stored = localStorage.getItem("sypRate");
    return stored ? parseFloat(stored) : 0;
  });
  const [currentCurrencySymbol, setCurrentCurrencySymbol] = useState<string>(() => localStorage.getItem("currencySymbol") || "ل.س");
  const [sypRateUpdatedAt, setSypRateUpdatedAt] = useState<string>(() => localStorage.getItem("sypRateUpdatedAt") || "");
  const [showRateTooltip, setShowRateTooltip] = useState(false);
  const [userPickedCurrency, setUserPickedCurrency] = useState<boolean>(() => localStorage.getItem("userPickedCurrency") === "1");
  const [voucherCode, setVoucherCode] = useState("");
  // ── Wallet charge form states (رُفعت هنا لمنع ضياع البيانات عند إعادة الرسم) ──
  // wallet state moved inside WalletChargeView for keyboard stability
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockCountdown, setBlockCountdown] = useState(0);
  const [isPermanentlyBanned, setIsPermanentlyBanned] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [linkingModal, setLinkingModal] = useState<{ isOpen: boolean; code: string; timeLeft: number }>({
    isOpen: false,
    code: "",
    timeLeft: 0
  });
  const [telegramBotStatus, setTelegramBotStatus] = useState<{ available: boolean; bot_username: string }>({
    available: true,
    bot_username: "saraqib_store_bot"
  });

  // ===== GOOGLE OAUTH LOADING OVERLAY =====
  // نُهيّئه فوراً بناءً على الـ hash عند أول تحميل لتفادي أي وميض قبل ظهور شاشة "جاري تسجيل الدخول"
  const [googleAuthLoading, setGoogleAuthLoading] = useState<boolean>(() => {
    const h = window.location.hash;
    return h.includes('access_token') && h.includes('google_oauth');
  });

  // ===== [PHONE-GATE] رقم الهاتف إجباري بعد تسجيل الدخول عبر Google =====
  // عندما يرد الخادم بـ requiresPhone نخزّن هنا التوكن المؤقت لعرض مودال
  // إجباري لتعبئة رمز الدولة ورقم الهاتف قبل إتمام الدخول للواجهة.
  const [googlePhoneGate, setGooglePhoneGate] = useState<{ googleTempToken: string; name?: string; avatarUrl?: string | null } | null>(null);

  // ===== HOME SORT MODE & FAVORITES =====
  // [HOME-MODE] اختيار المستخدم الصريح (المحفوظ محلياً من القائمة المنسدلة في الصفحة الرئيسية)
  // يتغلّب دائماً على الأسلوب الافتراضي الذي يضبطه الأدمن — تماماً كنظام الوضع الليلي/النهاري
  // أدناه. طالما لم يختر المستخدم شيئاً بنفسه بعد، تُطبَّق قيمة الأدمن (appearance.default_home_mode)
  // عبر الأثر الجانبي أسفله فور وصولها، حتى لو لم تكن قد حُمِّلت بعد عند هذا الـ useState الأول.
  const [homeSortMode, setHomeSortMode] = useState<"strip" | "categories" | "most_purchased" | "favorites">(() => {
    const saved = localStorage.getItem("saraqib_store_home_mode");
    if (saved === "strip" || saved === "categories" || saved === "most_purchased" || saved === "favorites") return saved;
    return "categories";
  });
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [mostPurchased, setMostPurchased] = useState<any[]>([]);
  const [mostPurchasedLoading, setMostPurchasedLoading] = useState(false);
  const [favorites, setFavorites] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem("saraqib_store_favorites") || "[]"); } catch { return []; }
  });
  const [longPressTarget, setLongPressTarget] = useState<any | null>(null);
  const [longPressPos, setLongPressPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });


  // ===== CUSTOM DIALOG STATE =====
  const [dialogOpen, setDialogOpen] = useState(false);

  // ===== NAVIGATION HISTORY STACK =====
  const [viewHistory, setViewHistory] = useState<any[]>([]);

  const navigate = useNavigate();
  const location = useLocation();

  const navigateTo = useCallback((newView: any) => {
    setViewHistory(prev => [...prev, newView]);
    setView(newView);
  }, []);

  const navigateBack = useCallback(() => {
    try { sessionStorage.removeItem("checkoutPageProduct"); } catch {}
    setViewHistory(prev => {
      if (prev.length <= 1) {
        setView({ type: "main" });
        setActiveTab("home");
        return [];
      }
      const currentView = prev[prev.length - 1];
      // إذا وصلنا للصفحة الحالية عبر most_purchased نرجع للرئيسية مباشرة
      if (currentView?.fromMostPurchased) {
        setView({ type: "main" });
        setActiveTab("home");
        setHomeSortMode("categories");
        return [];
      }
      const newHistory = prev.slice(0, -1);
      const prevView = newHistory[newHistory.length - 1];
      setView(prevView);
      // [FIX] عند الرجوع لصفحة قسم فرعي-فرعي (sub_sub_categories) القادمة من صفحة منتجات،
      // كانت مصفوفة products لا تزال تحمل منتجات الصفحة السابقة (القسم الفرعي-الفرعي المحدد)
      // بدل منتجات القسم الفرعي نفسه المباشرة، فتظهر الصفحة بدون منتجات. نعيد جلبها هنا.
      if (prevView?.type === "sub_sub_categories" && prevView.id) {
        fetchProducts(prevView.id, false);
      } else if (prevView?.type === "subcategories" && prevView.id) {
        fetchCategoryDirectProducts(prevView.id).then(setProducts);
      }
      return newHistory;
    });
  }, []);

  // عند فتح تأكيد الطلب كمودل، يجب أن تبقى الصفحة الخلفية (رئيسية/أقسام/منتجات) ظاهرة
  // كما هي ولا تُستبدل بصفحة تأكيد الطلب — فقط عندما يختار الأدمن وضع "صفحة" يتم استبدال المحتوى فعلياً
  const isModalCheckoutActive =
    appearance?.checkout_mode === "modal" &&
    (view.type === "checkout" || view.type === "quick_order") &&
    !checkoutOrderResult;
  const bgView = isModalCheckoutActive
    ? (viewHistory.length >= 2 ? viewHistory[viewHistory.length - 2] : { type: "main" })
    : view;

  // ===== ROUTER SYNC BRIDGE =====
  // Map view.type / activeTab → URL (runs whenever state changes)
  const _routerSyncSkip = useRef(false);
  // [FIX] عند التحميل الأول، الحالة الافتراضية للـ view تكون "main" قبل أن تتم قراءة
  // المسار الفعلي من العنوان. كانت أفكت المزامنة (view -> url) تعمل بهذه الحالة الافتراضية
  // وتستبدل المسار الحقيقي في المتصفح بـ "/home" قبل أن تتاح الفرصة لقراءة المسار الصحيح،
  // فيبقى العنوان عالقاً على "/home" رغم أن الصفحة المعروضة فعلياً مختلفة.
  // هذا الـ ref يمنع تلك المزامنة من العمل حتى تكتمل قراءة المسار الأولية من العنوان.
  const _hasHydratedFromUrl = useRef(false);
  // حفظ الـ hash فوراً عند mount قبل أن يستدعي أي navigate() ويمسحه
  const _initialHash = useRef(window.location.hash);
  useEffect(() => {
    fetch("/api/telegram-bot/user-status")
      .then(res => res.json())
      .then(data => setTelegramBotStatus({ available: !!data.available, bot_username: data.bot_username || "saraqib_store_bot" }))
      .catch(() => setTelegramBotStatus({ available: false, bot_username: "saraqib_store_bot" }));
  }, []);

  // ═══ تحليلات ذاتية (بدون أي خدمة خارجية) + تتبّع أخطاء العميل ═══
  const analyticsSessionId = useRef<string>((() => {
    try {
      let sid = sessionStorage.getItem("analytics_sid");
      if (!sid) { sid = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem("analytics_sid", sid); }
      return sid;
    } catch { return ""; }
  })());
  const getDeviceType = () => (window.innerWidth < 768 ? "mobile" : window.innerWidth < 1024 ? "tablet" : "desktop");
  const trackEvent = (event_type: string, path: string) => {
    try {
      const token = localStorage.getItem("authToken") || "";
      fetch("/api/analytics/track", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ event_type, path, session_id: analyticsSessionId.current, device_type: getDeviceType(), referrer: document.referrer || null }),
      }).catch(() => {});
    } catch {}
  };
  useEffect(() => { trackEvent("pageview", `/${view.type}`); }, [view.type]);
  useEffect(() => {
    const reportError = (message: string, stack?: string) => {
      try {
        const token = localStorage.getItem("authToken") || "";
        fetch("/api/analytics/error", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ message, stack, url: window.location.href }),
        }).catch(() => {});
      } catch {}
    };
    const onError = (e: ErrorEvent) => reportError(e.message || "خطأ غير معروف", e.error?.stack);
    const onRejection = (e: PromiseRejectionEvent) => reportError(String(e.reason?.message || e.reason || "Unhandled rejection"), e.reason?.stack);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  useEffect(() => {
    if (!_hasHydratedFromUrl.current) return;
    if (window.location.hash.includes('access_token')) return;
    if (_routerSyncSkip.current) { _routerSyncSkip.current = false; return; }
    if (location.pathname === "/api-docs" || location.pathname === "/api-docs/") return;
    // [FIX] صفحة 404: لا نغيّر مسار العنوان أبداً، يبقى كما كتبه المستخدم
    if (view.type === "not_found") return;
    let url = "/home";
    if (view.type === "voucher_redeem") {
      url = "/voucher";
    } else if (view.type === "login") {
      url = "/login";
    } else if (view.type === "forgot_password") {
      url = "/forgot-password";
    } else if (view.type === "profile_forgot_password") {
      url = "/profile-forgot-password";
    } else if (view.type === "checkout") {
      url = "/checkout";
    } else if (view.type === "quick_order") {
      url = "/quick-order";
    } else if (view.type === "success") {
      url = "/success";
    } else if (view.type === "chat") {
      url = "/chat";
    } else if (view.type === "privacy_policy") {
      url = "/privacy-policy";
    } else if (view.type === "faq") {
      url = "/faq";
    } else if (view.type === "settings") {
      url = "/settings";
    } else if (view.type === "user_api") {
      url = "/profile/api";
    } else if (view.type === "subcategories") {
      url = `/category/${view.id ?? 0}`;
    } else if (view.type === "sub_sub_categories") {
      url = `/category/${view.catId ?? view.id ?? 0}/${view.id ?? 0}`;
    } else if (view.type === "products") {
      // [FIX] معرّفات الأقسام الفرعية والفرعية-الفرعية والرئيسية هي 3 تسلسلات مستقلة بقاعدة
      // البيانات (قد تتشارك نفس الرقم) — ترميز النوع بالمسار يمنع التباساً عند تحديث الصفحة
      // (راجع منطق استعادة المسار أدناه لمزيد من التفاصيل).
      const kind = view.fromSubSub ? "subsub" : (view as any).fromCategory ? "cat" : "sub";
      url = `/products/${kind}/${view.id ?? 0}`;
    } else if (view.type === "profile_details") {
      url = "/profile/details";
    } else if (view.type === "leaderboard") {
      url = "/profile/leaderboard";
    } else if (view.type === "edit_profile") {
      url = "/profile/edit";
    } else if (view.type === "referral") {
      url = "/profile/referral";
    } else if (view.type === "active_sessions") {
      url = "/profile/active-sessions";
    } else if (view.type === "activity_log") {
      url = "/settings/activity-log";
    } else if (view.type === "sessions_activity") {
      url = "/profile/sessions-activity";
    } else if (view.type === "payments") {
      url = "/wallet/payments";
    } else if (activeTab === "wallet") {
      url = "/wallet";
    } else if (activeTab === "orders") {
      url = "/orders";
    } else if (activeTab === "profile" && view.type === "main") {
      url = "/profile";
    } else if (activeTab === "home" && view.type === "main") {
      url = "/home";
    }
    if (location.pathname !== url) {
      navigate(url, { replace: false });
    }
  }, [view, activeTab]);

  // On mount: read URL and set matching state
  useEffect(() => {
    const path = location.pathname;
    if (path === "/api-docs" || path === "/api-docs/") return;
    const setFromUrl = () => {
      _routerSyncSkip.current = true;
      if (path === "/" || path === "/home") {
        setActiveTab("home"); setView({ type: "main" });
      } else if (path === "/wallet") {
        setActiveTab("wallet"); setView({ type: "main" });
      } else if (path === "/orders") {
        setActiveTab("orders"); setView({ type: "main" });
      } else if (path === "/profile") {
        setActiveTab("profile"); setView({ type: "main" });
      } else if (path === "/wallet/payments") {
        setActiveTab("profile"); setView({ type: "payments" });
      } else if (path === "/quick-order") {
        setActiveTab("home"); setView({ type: "quick_order" });
      } else if (path === "/checkout") {
        setActiveTab("home"); setView({ type: "checkout" });
      } else if (path === "/success") {
        setActiveTab("home"); setView({ type: "success" });
      } else if (path === "/login") {
        setActiveTab("home"); setView({ type: "login" });
      } else if (path === "/forgot-password") {
        setActiveTab("home"); setView({ type: "forgot_password" });
      } else if (path === "/profile-forgot-password") {
        setActiveTab("profile"); setView({ type: "profile_forgot_password" });
      } else if (path === "/chat") {
        setActiveTab("profile"); setView({ type: "chat" });
      } else if (path === "/privacy-policy") {
        setActiveTab("profile"); setView({ type: "privacy_policy" });
      } else if (path === "/faq") {
        setActiveTab("profile"); setView({ type: "faq" });
      } else if (path === "/settings") {
        setActiveTab("profile"); setView({ type: "settings" });
      } else if (path === "/profile/api") {
        setActiveTab("profile"); setView({ type: "user_api" });
      } else if (path === "/voucher") {
        setView({ type: "voucher_redeem" });
      } else if (path === "/profile/details") {
        setActiveTab("profile"); setView({ type: "profile_details" });
      } else if (path === "/profile/leaderboard") {
        setActiveTab("profile"); setView({ type: "leaderboard" });
      } else if (path === "/profile/edit") {
        setActiveTab("profile"); setView({ type: "edit_profile" });
      } else if (path === "/profile/referral") {
        setActiveTab("profile"); setView({ type: "referral" });
      } else if (path === "/profile/active-sessions") {
        setActiveTab("profile"); setView({ type: "active_sessions" });
      } else if (path === "/settings/activity-log") {
        setActiveTab("profile"); setView({ type: "activity_log" });
      } else if (path === "/profile/sessions-activity") {
        setActiveTab("profile"); setView({ type: "sessions_activity" });
      } else if (path.startsWith("/category/")) {
        const parts = path.split("/").filter(Boolean);
        if (parts.length === 2) {
          const catId = Number(parts[1]);
          setActiveTab("home");
          setView({ type: "subcategories", id: catId });
          // نجلب فقط أقسام هذا التصنيف الفرعية عند التحديث المباشر، حتى لا تظهر
          // أقسام تصنيفات أخرى مدموجة معها.
          setPageLoading(true);
          (async () => {
            try {
              const cats = await fetch("/api/categories").then(r => r.json()).catch(() => []);
              const matched = Array.isArray(cats) ? cats.find((c: any) => c.id === catId) : null;
              if (matched?.name) setView(v => v.type === "subcategories" && v.id === catId ? { ...v, data: matched.name } : v);
              await fetchSubcategories(catId);
            } finally {
              setPageLoading(false);
            }
          })();
        } else if (parts.length === 3) {
          const catId = Number(parts[1]);
          const subId = Number(parts[2]);
          setActiveTab("home");
          setView({ type: "sub_sub_categories", id: subId, catId });
          // نجلب فقط الأقسام الفرعية-الفرعية التابعة لهذا القسم بالذات، ومنتجاته،
          // بدل ترك الحالة القديمة/الفارغة التي تسبب دمج كل الأقسام معاً بعد التحديث.
          setPageLoading(true);
          (async () => {
            try {
              const subsFetch = fetch(`/api/categories/${catId}/subcategories`).then(r => r.json()).catch(() => []);
              await Promise.all([
                fetchSubcategories(catId),
                fetchSubSubCategories(subId),
                fetchProducts(subId, false),
              ]);
              const subs = await subsFetch;
              const matched = Array.isArray(subs) ? subs.find((s: any) => s.id === subId) : null;
              if (matched?.name) setView(v => v.type === "sub_sub_categories" && v.id === subId ? { ...v, data: matched.name } : v);
            } finally {
              setPageLoading(false);
            }
          })();
        }
      } else if (path.startsWith("/products/")) {
        // [FIX] معرّفات الأقسام الفرعية والفرعية-الفرعية والرئيسية هي 3 تسلسلات id مستقلة —
        // قد يتشارك قسم فرعي وقسم فرعي-فرعي نفس الرقم صدفةً. الرابط القديم /products/:id وحده
        // لا يكفي لمعرفة أيّهما فعلاً، وكان التخمين (جرّب فرعي-فرعي، ثم فرعي، ثم رئيسي، وخذ أوّل
        // نتيجة غير فارغة) يفتح أحياناً منتجات قسم آخر تماماً عند تحديث الصفحة بعد إضافة أقسام
        // جديدة بنفس الرقم. الحل: الرابط الجديد يحمل النوع صراحة /products/<sub|subsub|cat>/:id
        // (تُنتجه آلية المزامنة view->url تلقائياً)، فلا حاجة للتخمين إطلاقاً. الرابط القديم بلا
        // نوع يبقى يعمل عبر نفس التخمين السابق فقط للتوافق مع روابط محفوظة قديمة.
        const segs = path.split("/").filter(Boolean); // ["products", id] أو ["products", kind, id]
        const kindSeg = segs.length >= 3 ? segs[1] : null;
        const idSeg = segs.length >= 3 ? segs[2] : segs[1];
        const id = Number(idSeg);
        setActiveTab("home");

        if (kindSeg === "sub" || kindSeg === "subsub" || kindSeg === "cat") {
          const fromSubSub = kindSeg === "subsub";
          const fromCategory = kindSeg === "cat";
          setView({ type: "products", id, fromSubSub, fromCategory });
          setPageLoading(true);
          (async () => {
            try {
              const endpoint = fromCategory
                ? `/api/categories/${id}/products`
                : fromSubSub
                ? `/api/sub-sub-categories/${id}/products`
                : `/api/subcategories/${id}/products`;
              const nameEndpoint = fromCategory ? "/api/categories" : fromSubSub ? "/api/sub-sub-categories" : "/api/subcategories";
              const [items, names] = await Promise.all([
                fetch(endpoint).then(r => (r.ok ? r.json() : [])).catch(() => []),
                fetch(nameEndpoint).then(r => (r.ok ? r.json() : [])).catch(() => []),
              ]);
              setProducts(Array.isArray(items) ? items : []);
              const match = Array.isArray(names) ? names.find((x: any) => x.id === id) : null;
              setView(prev => (prev.type === "products" && prev.id === id) ? { ...prev, data: match?.name } : prev);
            } finally {
              setPageLoading(false);
            }
          })();
        } else {
          setView({ type: "products", id });
          setPageLoading(true);
          (async () => {
            try {
              const [subSubProducts, subProducts, catProducts, allSubSubs, allSubs, allCats] = await Promise.all([
                fetch(`/api/sub-sub-categories/${id}/products`).then(r => (r.ok ? r.json() : [])).catch(() => []),
                fetch(`/api/subcategories/${id}/products`).then(r => (r.ok ? r.json() : [])).catch(() => []),
                fetch(`/api/categories/${id}/products`).then(r => (r.ok ? r.json() : [])).catch(() => []),
                fetch("/api/sub-sub-categories").then(r => (r.ok ? r.json() : [])).catch(() => []),
                fetch("/api/subcategories").then(r => (r.ok ? r.json() : [])).catch(() => []),
                fetch("/api/categories").then(r => (r.ok ? r.json() : [])).catch(() => []),
              ]);
              const isSubSub = Array.isArray(subSubProducts) && subSubProducts.length > 0;
              const isSub = !isSubSub && Array.isArray(subProducts) && subProducts.length > 0;
              const isCatDirect = !isSubSub && !isSub;
              const items = isSubSub ? subSubProducts : isSub ? subProducts : catProducts;
              setProducts(items || []);
              const nameSource = isSubSub ? allSubSubs : isSub ? allSubs : allCats;
              const match = Array.isArray(nameSource) ? nameSource.find((x: any) => x.id === id) : null;
              setView(prev => (prev.type === "products" && prev.id === id) ? { ...prev, data: match?.name, fromSubSub: isSubSub, fromCategory: isCatDirect } : prev);
            } finally {
              setPageLoading(false);
            }
          })();
        }
      } else {
        // [FIX] مسار غير معروف: نعرض صفحة 404 حقيقية بدل إعادة التوجيه الصامت للرئيسية.
        // لا نغيّر activeTab ولا نلمس العنوان، فقط نُظهر واجهة 404 فوق المسار كما هو.
        setView({ type: "not_found" });
      }
    };
    setFromUrl();
    // بعد اكتمال قراءة المسار الأولي وتحديد الحالة المطابقة له، نسمح لمزامنة (view -> url)
    // بالعمل بشكل طبيعي بدل أن تعمل على الحالة الافتراضية القديمة وتُبدّل المسار الصحيح بـ "/home"
    _hasHydratedFromUrl.current = true;

    // ===== HARDWARE / BROWSER BACK BUTTON =====
    // زر الرجوع في الهاتف (وزر رجوع المتصفح) يُطلق popstate فقط، وكانت setFromUrl تُستدعى
    // مرة واحدة عند mount فقط، لذا كان المسار (URL) يتغيّر لكن الواجهة المعروضة (view) لا تتحدث.
    // هنا نعيد استدعاء نفس منطق قراءة المسار (setFromUrl) عند كل popstate، فيعمل زر رجوع
    // الهاتف بنفس تصرف سهم الرجوع داخل التطبيق تماماً، بدل الاعتماد فقط على الأسهم.
    const onPopState = () => {
      setFromUrl();
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []); // run once on mount only

  // ===== PULL TO REFRESH =====
  const pullStartY = useRef(0);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // حفظ المفضلة في localStorage عند التغيير
  useEffect(() => {
    localStorage.setItem("saraqib_store_favorites", JSON.stringify(favorites));
  }, [favorites]);

  const addToFavorites = (item: any) => {
    setFavorites(prev => {
      const exists = prev.some(f => f._fav_key === item._fav_key);
      if (exists) return prev;
      return [...prev, item];
    });
    setLongPressTarget(null);
  };

  const removeFromFavorites = (favKey: string) => {
    setFavorites(prev => prev.filter(f => f._fav_key !== favKey));
  };

  const isFavorite = (favKey: string) => favorites.some(f => f._fav_key === favKey);

  // ===== مشاركة رابط المنتج/القسم عبر Long Press =====
  const buildShareUrl = (item: any): string => {
    const origin = window.location.origin;
    const type = item._fav_type;
    if (type === "product") return `${origin}/?product=${item.id}`;
    if (type === "category") return `${origin}/?category=${item.id}`;
    if (type === "subcategory") return `${origin}/?subcategory=${item.id}`;
    if (type === "sub_sub_category") return `${origin}/?subsub=${item.id}`;
    return origin;
  };

  const shareItem = async (item: any) => {
    const url = buildShareUrl(item);
    const shareData = { title: item._fav_label || "Saraqib Store", text: item._fav_label || "", url };
    try {
      const nav = navigator as any;
      if (nav.share) {
        await nav.share(shareData);
      } else {
        await navigator.clipboard.writeText(url);
        showToast("تم نسخ رابط المشاركة", "success");
      }
    } catch {
      // تجاهل إلغاء المستخدم لمربع المشاركة
    }
    setLongPressTarget(null);
  };
  // ===== END SHARE =====

  const fetchMostPurchased = async () => {
    if (mostPurchasedLoading) return;
    setMostPurchasedLoading(true);
    try {
      const token = localStorage.getItem("authToken") || "";
      const res = await fetch("/api/most-purchased", { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setMostPurchased(data || []);
      }
    } catch {}
    setMostPurchasedLoading(false);
  };

  // useLongPress helper داخلي
  const useLongPressHandlers = (item: any, e: React.TouchEvent | React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    setLongPressTarget(item);
    setLongPressPos({ x: rect.left + rect.width / 2, y: rect.top });
  };
  // ===== END HOME SORT MODE & FAVORITES =====

  // Theme effect
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // أظهر الإشعار كل 5 جلسات فقط وليس كل جلسة
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
      if (!isStandalone) {
        const sessionKey = "saraqib_store_install_session";
        const lastShownKey = "saraqib_store_install_last_session";
        // رقم الجلسة الحالية
        const currentSession = parseInt(sessionStorage.getItem(sessionKey) || "0");
        if (currentSession === 0) {
          // جلسة جديدة — زد العداد في localStorage
          const totalSessions = parseInt(localStorage.getItem(lastShownKey) || "0") + 1;
          localStorage.setItem(lastShownKey, String(totalSessions));
          sessionStorage.setItem(sessionKey, String(totalSessions));
          // أظهر فقط إذا كانت الجلسة مضاعف 5
          if (totalSessions % 5 === 1 || totalSessions === 1) {
            setTimeout(() => setShowInstallBanner(true), 2000);
          }
        }
      }
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    setShowInstallBanner(false);
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  // [FIX] زر "الإشعارات" بالإعدادات كان وهمياً بالكامل (يكتب فقط لـ localStorage دون أي أثر
  // فعلي) — أصبح يتحكم فعلياً بالاشتراك/إلغاء الاشتراك بإشعارات الدفع (Push) عبر الدالتين أدناه.
  const subscribeToPush = async (userId: number): Promise<boolean> => {
    try {
      if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return false;
      if (Notification.permission === "default") await Notification.requestPermission();
      if (Notification.permission !== "granted") return false;

      const registration = await navigator.serviceWorker.ready;
      const keyRes = await fetch("/api/push/key");
      if (!keyRes.ok) return false;
      const { publicKey } = await keyRes.json();
      if (!publicKey) return false;

      // إلغاء الـ subscription القديم دائماً لضمان الـ key الصحيح
      const existingSub = await registration.pushManager.getSubscription();
      if (existingSub) await existingSub.unsubscribe();

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: publicKey
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("authToken") || ""}` },
        body: JSON.stringify({ userId, subscription })
      });
      return res.ok;
    } catch (e: any) {
      // تجاهل كل أخطاء Push بصمت - لا تؤثر على عمل التطبيق
      return false;
    }
  };

  const unsubscribeFromPush = async (): Promise<boolean> => {
    try {
      if ('serviceWorker' in navigator && 'PushManager' in window) {
        const registration = await navigator.serviceWorker.ready;
        const existingSub = await registration.pushManager.getSubscription();
        if (existingSub) await existingSub.unsubscribe();
      }
      const res = await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("authToken") || ""}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  };

  useEffect(() => {
    // نحترم تفضيل المستخدم المحفوظ — لا نشترك تلقائياً إن كان قد عطّل الإشعارات صراحة من الإعدادات
    const notifPref = localStorage.getItem("notifications_enabled");
    if (user && notifPref !== "false" && 'serviceWorker' in navigator && 'PushManager' in window) {
      subscribeToPush(user.id);
    }
  }, [user?.id]);

  useEffect(() => {
    // The user's own choice always wins on the <html> element, overriding
    // whatever class useStoreAppearance applied from the admin's DB setting.
    // This re-applies whenever the appearance settings load/change, so the
    // admin's value can never silently take back over after a refresh.
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", isDarkMode ? "dark" : "light");
    // Recompute --brand-contrast (and the other brand CSS vars) for the new
    // mode right away, so contrast updates instantly on toggle instead of
    // only after a page refresh re-runs useStoreAppearance's mount effect.
    applyThemeToDocument(appearance);
  }, [isDarkMode, appearance.theme_mode, appearance]);

  // [HOME-MODE] يطبّق أسلوب الصفحة الرئيسية الافتراضي الذي يضبطه الأدمن، لكن فقط إن لم يكن
  // المستخدم قد اختار أسلوباً بنفسه من قبل (لا كتابة هنا إطلاقاً — القراءة فقط). يُعاد تنفيذه
  // كلما وصلت/تغيّرت إعدادات المظهر، حتى لا يبقى الموقع عالقاً على القيمة الافتراضية المؤقتة
  // ("categories") إلى أن يصل رد الخادم الفعلي.
  useEffect(() => {
    const saved = localStorage.getItem("saraqib_store_home_mode");
    if (saved === "strip" || saved === "categories" || saved === "most_purchased" || saved === "favorites") return;
    const adminDefault = appearance.default_home_mode;
    if (adminDefault === "strip" || adminDefault === "categories" || adminDefault === "most_purchased" || adminDefault === "favorites") {
      setHomeSortMode(adminDefault);
      // عند اختيار المستخدم اليدوي من القائمة المنسدلة يُستدعى fetchMostPurchased معه مباشرة —
      // وبما أن هذا التطبيق هنا تلقائي (بدون تلك النقرة)، نكرّر نفس الاستدعاء هنا حتى لا تبقى
      // القائمة فارغة لكل زائر جديد لم يختر شيئاً بعد والأدمن ضبط "الأكثر شراءً" كافتراضي.
      if (adminDefault === "most_purchased") fetchMostPurchased();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appearance.default_home_mode]);

  // Supabase Realtime Subscriptions
  useEffect(() => {
    const channels = [
      supabase.channel('categories-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, fetchCategories).subscribe(),
      supabase.channel('products-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
        // Refresh products if we are in a product view
        if (view.type === "products" && view.id) {
          fetchProducts(view.id, view.fromSubSub, (view as any).fromCategory);
        }
      }).subscribe(),
      supabase.channel('banners-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'banners' }, fetchBanners).subscribe(),
      supabase.channel('offers-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'offers' }, fetchOffers).subscribe(),
      supabase.channel('settings-changes').on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, () => {
        // لا نعيد تحميل الصفحة أبداً - نكتفي بتحديث الإعدادات بهدوء
        // window.location.reload() محذوف نهائياً لأنه يُخرج المستخدم من صفحة الدفع
        fetchSiteSettings();
      }).subscribe(),
    ];

    if (user) {
      channels.push(
        supabase.channel(`user-${user.id}-changes`).on('postgres_changes', { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'users', 
          filter: `id=eq.${user.id}` 
        }, (payload) => {
          setUser(prev => prev ? { ...prev, ...payload.new } : null);
          // بيانات المستخدم تبقى في React state فقط
        }).subscribe()
      );
      
      channels.push(
        supabase.channel(`user-stats-${user.id}-changes`).on('postgres_changes', { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'user_stats', 
          filter: `user_id=eq.${user.id}` 
        }, (payload) => {
          setUserStats(payload.new);
        }).subscribe()
      );

      channels.push(
        supabase.channel(`user-notifications-${user.id}`).on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        }, fetchNotifications).subscribe()
      );
    }

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [user?.id]);

  // Block countdown effect
  useEffect(() => {
    let interval: any;
    if (isBlocked && blockCountdown > 0) {
      interval = setInterval(() => {
        setBlockCountdown(prev => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isBlocked, blockCountdown]);

  // Telegram linking timer effect
  useEffect(() => {
    let interval: any;
    if (linkingModal.isOpen && linkingModal.timeLeft > 0) {
      interval = setInterval(() => {
        setLinkingModal(prev => ({ ...prev, timeLeft: Math.max(0, prev.timeLeft - 1) }));
      }, 1000);
    } else if (linkingModal.timeLeft === 0 && linkingModal.isOpen) {
      setLinkingModal(prev => ({ ...prev, isOpen: false }));
    }
    return () => clearInterval(interval);
  }, [linkingModal.isOpen, linkingModal.timeLeft]);

  // ===== BACK BUTTON =====
  // react-router-dom's BrowserRouter now manages browser back/forward.
  // The old manual popstate + pushState handler is removed to avoid conflicts.

  // ===== PULL TO REFRESH (DISABLED) =====
  useEffect(() => {
    if (activeTab !== 'home') return;
    const onTouchStart = (_e: TouchEvent) => {};
    const onTouchMove = (_e: TouchEvent) => {};
    const onTouchEnd = async () => {
      if (false) {
        setPullDistance(0);
        setIsPulling(false);
      }
    };
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd);
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
    };
  }, [activeTab, pullDistance, isRefreshing]);

  // إعادة فحص وضع الصيانة دورياً حتى تنعكس التفعيل/الإيقاف على الجلسات المفتوحة فوراً تقريباً
  useEffect(() => {
    const interval = setInterval(() => {
      fetchSiteSettings();
      fetchMaintenanceStatus();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Fetch initial data
  useEffect(() => {
    fetchCategories();
    // [FIX] عند تحديث الصفحة داخل قسم فرعي أو قسم فرعي-فرعي أو صفحة منتجات، لا يجب استدعاء
    // fetchSubcategories()/fetchSubSubCategories() بدون معرّف هنا، لأنها تجلب القائمة الكاملة
    // غير المُصفّاة لكل أقسام المتجر وتكتب فوق البيانات الخاصة بالقسم الحالي (المُحمَّلة عبر
    // منطق الـ hydration الخاص بالمسار)، فتظهر كل الأقسام والمنتجات مدموجة بعد التحديث.
    // نستدعيها فقط عندما لا نكون داخل مسار /category/ أو /products/ عميق.
    const initialPath = window.location.pathname;
    const isDeepCategoryLink = initialPath.startsWith("/category/") || initialPath.startsWith("/products/");
    if (!isDeepCategoryLink) {
      fetchSubcategories();
      fetchSubSubCategories();
    }
    fetchPaymentMethods();
    fetchBanners();
    fetchOffers();
    fetchSiteSettings();
    fetchMaintenanceStatus();
    fetchCurrencies(); // جلب العملات الديناميكية من قاعدة البيانات
    const savedUserId = localStorage.getItem("userId");
    if (savedUserId && !isNaN(Number(savedUserId))) {
      // [FIX] ننتظر وصول بيانات المستخدم قبل إخفاء شارة التحقق من الجلسة
      // لمنع "وميض" ظهور الواجهة كزائر ثم تحوّلها فجأة لمستخدم مسجّل
      fetchUser(Number(savedUserId)).finally(() => setAuthLoading(false));
    } else {
      setAuthLoading(false);
    }

    // Handle Google OAuth redirect callback (hash fragment contains access_token)
    const handleGoogleRedirectCallback = async () => {
      // استخدم النسخة المحفوظة من الـ hash عند الـ mount قبل أن يمسحها navigate()
      const hash = _initialHash.current;
      _initialHash.current = ''; // امسحه بعد أول قراءة
      if (!hash.includes('access_token')) return;
      const params = new URLSearchParams(hash.replace('#', ''));
      const accessToken = params.get('access_token');
      const state = params.get('state');
      if (!accessToken || state !== 'google_oauth') return;

      // Clean URL immediately
      window.history.replaceState(null, '', window.location.pathname);
      setGoogleAuthLoading(true);

      try {
        const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (!profileRes.ok) {
          showToast("فشل تسجيل الدخول عبر Google، حاول مجدداً", "error");
          return;
        }
        const profile = await profileRes.json();

        const res = await fetch('/api/auth/google', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accessToken, googleId: profile.sub, email: profile.email, name: profile.name, picture: profile.picture })
        });
        const data = await res.json();
        if (res.ok && data.requiresPhone) {
          // ── [PHONE-GATE] الحساب (جديد أو بدون رقم هاتف) — نعرض المودال الإجباري
          //    ولا نُدخل المستخدم للواجهة قبل تعبئته ──
          setGooglePhoneGate({ googleTempToken: data.googleTempToken, name: data.name, avatarUrl: data.avatarUrl });
          return;
        }
        if (res.ok) {
          setUser(data);
          if (data.token) localStorage.setItem('authToken', data.token);
          localStorage.setItem('userId', String(data.id));
          setView({ type: 'main' });
          setActiveTab('home');
          if (data.isNew) {
            // إذا دخل المستخدم عبر رابط إحالة وسجّل حساباً جديداً عبر Google، نطبّق كود الإحالة مباشرة
            const pendingReferralCode = localStorage.getItem("referralCode");
            if (pendingReferralCode && data.token) {
              try {
                const refRes = await fetch('/api/referrals/apply', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
                  body: JSON.stringify({ referralCode: pendingReferralCode })
                });
                if (refRes.ok) localStorage.removeItem("referralCode");
              } catch { /* لا نمنع تسجيل الدخول إن فشل تطبيق الإحالة */ }
            }
          }
        } else {
          showToast(data.error || "فشل تسجيل الدخول عبر Google، حاول مجدداً", "error");
        }
      } catch {
        showToast("فشل الاتصال بالخادم أثناء تسجيل الدخول عبر Google", "error");
      } finally {
        setGoogleAuthLoading(false);
      }
    };
    handleGoogleRedirectCallback();


    // Handle referral code from URL
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');
    if (ref) {
      localStorage.setItem("referralCode", ref);
      if (!savedUserId) {
        setView({ type: "login" });
      }
    }

    // ===== Handle deep-link share query params (?category=, ?subcategory=, ?subsub=, ?product=) =====
    // روابط المشاركة (من زر/مودال المشاركة) تُبنى بصيغة query param وليس مسار /category/..،
    // لذلك يجب معالجتها هنا وتحويلها لنفس منطق فتح القسم/المنتج المستخدم في مسارات /category/ و /products/
    const qCategory = urlParams.get('category');
    const qSubcategory = urlParams.get('subcategory');
    const qSubsub = urlParams.get('subsub');
    const qProduct = urlParams.get('product');
    if (qProduct) {
      const id = Number(qProduct);
      if (!isNaN(id)) {
        setActiveTab("home");
        setView({ type: "products", id });
        setPageLoading(true);
        (async () => {
          try {
            const [subSubProducts, subProducts, catProducts, allSubSubs, allSubs, allCats] = await Promise.all([
              fetch(`/api/sub-sub-categories/${id}/products`).then(r => (r.ok ? r.json() : [])).catch(() => []),
              fetch(`/api/subcategories/${id}/products`).then(r => (r.ok ? r.json() : [])).catch(() => []),
              fetch(`/api/categories/${id}/products`).then(r => (r.ok ? r.json() : [])).catch(() => []),
              fetch("/api/sub-sub-categories").then(r => (r.ok ? r.json() : [])).catch(() => []),
              fetch("/api/subcategories").then(r => (r.ok ? r.json() : [])).catch(() => []),
              fetch("/api/categories").then(r => (r.ok ? r.json() : [])).catch(() => []),
            ]);
            const isSubSub = Array.isArray(subSubProducts) && subSubProducts.length > 0;
            const isSub = !isSubSub && Array.isArray(subProducts) && subProducts.length > 0;
            const isCatDirect = !isSubSub && !isSub;
            const items = isSubSub ? subSubProducts : isSub ? subProducts : catProducts;
            setProducts(items || []);
            const nameSource = isSubSub ? allSubSubs : isSub ? allSubs : allCats;
            const match = Array.isArray(nameSource) ? nameSource.find((x: any) => x.id === id) : null;
            setView(prev => (prev.type === "products" && prev.id === id) ? { ...prev, data: match?.name, fromSubSub: isSubSub, fromCategory: isCatDirect } : prev);
            // [FIX] نكتب المسار الصريح (sub|subsub|cat) بدل الرقم وحده، حتى لا يلتبس تحديث
            // الصفحة لاحقاً بقسم آخر يتشارك نفس الرقم من تسلسل id مختلف.
            const kindSeg = isSubSub ? "subsub" : isCatDirect ? "cat" : "sub";
            window.history.replaceState(null, '', `/products/${kindSeg}/${id}`);
          } finally {
            setPageLoading(false);
          }
        })();
      }
    } else if (qSubsub) {
      const subId = Number(qSubsub);
      if (!isNaN(subId)) {
        setActiveTab("home");
        setPageLoading(true);
        (async () => {
          try {
            const subs = await fetch("/api/subcategories").then(r => r.json()).catch(() => []);
            const matched = Array.isArray(subs) ? subs.find((s: any) => s.id === subId) : null;
            const catId = matched?.category_id ?? 0;
            setView({ type: "sub_sub_categories", id: subId, catId, data: matched?.name });
            await Promise.all([
              fetchSubcategories(catId),
              fetchSubSubCategories(subId),
              fetchProducts(subId, false),
            ]);
            window.history.replaceState(null, '', `/category/${catId}/${subId}`);
          } finally {
            setPageLoading(false);
          }
        })();
      }
    } else if (qSubcategory) {
      const subId = Number(qSubcategory);
      if (!isNaN(subId)) {
        setActiveTab("home");
        setPageLoading(true);
        (async () => {
          try {
            const subSubs = await fetchSubSubCategories(subId);
            const cats = await fetch("/api/categories").then(r => r.json()).catch(() => []);
            // نحتاج معرف القسم الرئيسي التابع له هذا القسم الفرعي
            const catsSubsPairs = await Promise.all(
              (Array.isArray(cats) ? cats : []).map((c: any) =>
                fetch(`/api/categories/${c.id}/subcategories`).then(r => r.json()).then((subs: any[]) => ({ catId: c.id, subs })).catch(() => ({ catId: c.id, subs: [] }))
              )
            );
            const owner = catsSubsPairs.find(p => Array.isArray(p.subs) && p.subs.some((s: any) => s.id === subId));
            const catId = owner?.catId ?? 0;
            const matched = owner?.subs?.find((s: any) => s.id === subId);
            if (Array.isArray(subSubs) && subSubs.length > 0) {
              setView({ type: "sub_sub_categories", id: subId, catId, data: matched?.name });
              await fetchProducts(subId, false);
              window.history.replaceState(null, '', `/category/${catId}/${subId}`);
            } else {
              setView({ type: "products", id: subId, data: matched?.name, fromSubSub: false });
              await fetchProducts(subId, false);
              window.history.replaceState(null, '', `/products/sub/${subId}`);
            }
          } finally {
            setPageLoading(false);
          }
        })();
      }
    } else if (qCategory) {
      const catId = Number(qCategory);
      if (!isNaN(catId)) {
        setActiveTab("home");
        setView({ type: "subcategories", id: catId });
        setPageLoading(true);
        (async () => {
          try {
            const cats = await fetch("/api/categories").then(r => r.json()).catch(() => []);
            const matched = Array.isArray(cats) ? cats.find((c: any) => c.id === catId) : null;
            if (matched?.name) setView(v => v.type === "subcategories" && v.id === catId ? { ...v, data: matched.name } : v);
            await fetchSubcategories(catId);
            window.history.replaceState(null, '', `/category/${catId}`);
          } finally {
            setPageLoading(false);
          }
        })();
      }
    }

    return () => {};
  }, []);

  // إشعار الدخول (Entry Popup): يظهر بالصفحة الرئيسية فقط، بحسب إعدادات الأدمن
  // (تفعيل/تعطيل، النص، الرابط، وعدد الجلسات بين كل ظهور). العدّاد يُحفظ في
  // localStorage بحيث يستمر بين الجلسات، ويُحدَّث مرة واحدة فقط لكل جلسة متصفح
  // (sessionStorage) لتفادي تكرار الزيادة عند كل إعادة عرض للمكوّن.
  useEffect(() => {
    if (!siteSettings || siteSettings.length === 0) return;
    const enabled = siteSettings.find((s: any) => s.key === "entry_popup_enabled")?.value === "true";
    if (!enabled) return;
    const text = siteSettings.find((s: any) => s.key === "entry_popup_text")?.value || "";
    if (!text.trim()) return;
    const link = siteSettings.find((s: any) => s.key === "entry_popup_link")?.value || "";
    const frequencyRaw = parseInt(siteSettings.find((s: any) => s.key === "entry_popup_frequency")?.value || "1", 10);
    const frequency = Number.isFinite(frequencyRaw) && frequencyRaw >= 1 && frequencyRaw <= 4 ? frequencyRaw : 1;

    try {
      // إذا كانت هذه الجلسة قد اتُّخذ فيها قرار العرض من قبل (سواء بالعرض أو
      // بعدمه)، لا نُعيد الحساب ولا نُظهر النافذة مجددًا — حتى لو أعاد هذا
      // الـ effect التشغيل بسبب تحديث siteSettings عند التنقل بين الصفحات
      // أو تحديث المتصفح لنفس الجلسة.
      if (sessionStorage.getItem("entryPopupSessionMarked")) return;

      let sessionCount = parseInt(localStorage.getItem("entryPopupSessionCount") || "0", 10);
      if (!Number.isFinite(sessionCount)) sessionCount = 0;
      sessionCount += 1;
      localStorage.setItem("entryPopupSessionCount", String(sessionCount));
      sessionStorage.setItem("entryPopupSessionMarked", "1");

      if (sessionCount % frequency === 0) {
        setEntryPopup({ show: true, text, link: link || undefined });
      }
    } catch {
      // فشل صامت (وضع تصفح خاص أو تعطيل التخزين المحلي) — لا نعرض الإشعار حينها
    }
  }, [siteSettings]);

  useEffect(() => {
    if (user?.stats?.custom_theme_color && user.stats.custom_theme_color.startsWith('#')) {
      document.documentElement.style.setProperty('--custom-primary', user.stats.custom_theme_color);
      document.documentElement.style.setProperty('--custom-primary-light', `${user.stats.custom_theme_color}1a`);
    } else {
      document.documentElement.style.removeProperty('--custom-primary');
      document.documentElement.style.removeProperty('--custom-primary-light');
    }
  }, [user?.stats?.custom_theme_color]);

  const fetchNotifications = async () => {
    if (!user) return;
    try {
      const token = localStorage.getItem("authToken") || "";
      const res = await fetch(`/api/notifications/${user.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error(`Failed to fetch notifications: ${res.status}`);
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Expected JSON response from notifications API");
      }
      const data = await res.json();
      const serverNotifs = (Array.isArray(data) ? data : []).map((n: any) => ({
        id: n.id,
        title: n.title,
        message: n.message,
        type: n.type,
        created_at: n.created_at,
        is_read: n.is_read
      }));

      // Add the TG link warning if needed
      if (user.telegram_chat_id) {
        serverNotifs.unshift({
          id: 'tg-link',
          title: 'تم ربط حسابك ببوت تلجرام',
          message: 'لقد تم ربط حسابك ببوت تلجرام. إن لم تكن أنت، يرجى الضغط على فك الارتباط وتغيير بياناتك.',
          type: 'warning',
          is_read: false
        } as any);
      }
      setNotifications(serverNotifs);
    } catch (e: any) {
      if (e.name === 'TypeError' && e.message === 'Failed to fetch') return;
      console.error("Fetch notifications error:", e);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 30000); // Refresh every 30s
      return () => clearInterval(interval);
    } else {
      setNotifications([]);
    }
  }, [user]);

  const markNotificationRead = async (id: number | string) => {
    // Optimistic update - mark as read in local state immediately
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    if (typeof id === 'string') return; // Local notifs - no API call needed
    try {
      await fetch("/api/notifications/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("authToken") || ""}` },
        body: JSON.stringify({ notificationId: id })
      });
      // Re-fetch to sync with server
      fetchNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  const markAllNotificationsRead = async () => {
    const unread = (Array.isArray(notifications) ? notifications : []).filter(n => !n.is_read);
    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    for (const n of unread) {
      if (typeof n.id !== 'string') {
        try {
          await fetch("/api/notifications/mark-read", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("authToken") || ""}` },
            body: JSON.stringify({ notificationId: n.id })
          });
        } catch {}
      }
    }
    fetchNotifications();
  };

  const handleUnlinkTelegram = async () => {
    if (!user) return;
    try {
      const token = localStorage.getItem("authToken") || "";
      const res = await fetch("/api/user/unlink-telegram", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ userId: user.id })
      });
      if (res.ok) {
        fetchUser(user.id);
        showToast("تم فك الارتباط بنجاح.", 'success');
      } else {
        const data = await res.json().catch(() => ({}));
        showToast(data.error || "فشل فك الارتباط، حاول مجدداً", 'error');
      }
    } catch (e) {
      console.error(e);
      showToast("فشل الاتصال بالخادم", 'error');
    }
  };

  // [NEW] زرّا إشعار "لديك فاتورة شحن غير مكتملة" (action === 'shamcash_invoice_pending'،
  // action_ref = رقم الفاتورة) — "العودة للفاتورة" ينقل لتبويب المحفظة ويطلق حدثاً مخصّصاً
  // تلتقطه WalletPage لجلب الفاتورة المعلّقة وعرضها فوراً حتى لو كانت الصفحة مفتوحة أصلاً؛
  // "إلغاء الفاتورة" يستدعي نفس مسار الإلغاء المُستخدَم بشاشة المحفظة نفسها.
  const handleReturnToPendingInvoice = (notif: any) => {
    setNotificationsOpen(false);
    setActiveTab("wallet");
    setView({ type: "main" });
    setTimeout(() => window.dispatchEvent(new CustomEvent("restore-pending-invoice")), 150);
  };

  const handleCancelPendingInvoiceFromNotification = async (notif: any) => {
    const invoiceNumber = notif.action_ref;
    if (!invoiceNumber) return;
    try {
      const res = await fetch(`/api/transactions/shamcash-invoice/${encodeURIComponent(invoiceNumber)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("authToken") || ""}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        showToast("تم إلغاء الفاتورة", "success");
        markNotificationRead(notif.id);
        setNotifications(prev => prev.filter(n => n.id !== notif.id));
      } else {
        showToast(data.error || "تعذّر إلغاء الفاتورة", "error");
      }
    } catch {
      showToast("فشل الاتصال بالخادم", "error");
    }
  };

  const handleGenerateLinkingCode = async () => {
    if (!user) return;
    if (!telegramBotStatus.available) {
      showToast("لم يتم اضافة بوت بعد", 'error');
      return;
    }
    try {
      const res = await fetch("/api/user/generate-linking-code", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("authToken") || ""}` },
        body: JSON.stringify({ userId: user.id })
      });
      const data = await res.json();
      if (res.ok) {
        setLinkingModal({
          isOpen: true,
          code: data.code,
          timeLeft: 600 // 10 minutes
        });
      } else if (res.status === 503) {
        setTelegramBotStatus(prev => ({ ...prev, available: false }));
        showToast(data.error || "لم يتم اضافة بوت بعد", 'error');
      } else {
        showToast(data.error || "فشل توليد الكود", 'error');
      }
    } catch (e) {
      console.error(e);
      showToast("خطأ في الاتصال بالسيرفر", 'error');
    }
  };

  const handleUpdateTheme = async (color: string) => {
    if (!user) return;
    try {
      const res = await fetch("/api/user/update-theme", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("authToken") || ""}` },
        body: JSON.stringify({ color })
      });
      if (res.ok) {
        fetchUser(user.id);
        setThemeModal({ ...themeModal, isOpen: false });
      }
    } catch (e) {
      showToast("فشل تحديث الثيم", 'error');
    }
  };

  // Helper: يجيب الـ auth token من localStorage
  const getAuthToken = (): string => localStorage.getItem("authToken") || "";

  // [FIX] اعتراض عام لكل طلبات fetch: أي رد 403 مع banned:true من السيرفر
  // يعني أن الحساب محظور الآن (تم فحصه في middleware الـ authenticate على كل طلب)
  // هذا يضمن التوجيه الفوري لصفحة الحظر بغض النظر عن الصفحة أو الجهاز المستخدم
  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const response = await originalFetch(...args);
      if (response.status === 403) {
        try {
          const cloned = response.clone();
          const data = await cloned.json();
          if (data && data.banned) {
            setIsBlocked(true);
            setIsPermanentlyBanned(true);
            setBlockCountdown(0);
          }
        } catch {
          // تجاهل استجابات غير JSON
        }
      }
      return response;
    };
    return () => { window.fetch = originalFetch; };
  }, []);

  const fetchUser = useCallback(async (id: number) => {
    if (!id || isNaN(id)) return;
    try {
      const token = getAuthToken();
      const res = await fetch(`/api/user/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) {
        if (res.status === 404) {
          console.warn(`User ${id} not found`);
          return;
        }
        throw new Error(`Failed to fetch user: ${res.status}`);
      }
      
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        console.error("Expected JSON but got:", text.substring(0, 100));
        return;
      }

      const data = await res.json();
      if (data) {
        setUser(data);
        if (data.token) localStorage.setItem("authToken", data.token);
        
        // [FIX] دعم الحظر الدائم (is_banned بدون تاريخ انتهاء) وليس فقط الحظر المؤقت
        if (data.blocked_until) {
          const until = new Date(data.blocked_until);
          const now = new Date();
          if (until > now) {
            setIsBlocked(true);
            setIsPermanentlyBanned(false);
            setBlockCountdown(Math.floor((until.getTime() - now.getTime()) / 1000));
          } else {
            setIsBlocked(false);
            setIsPermanentlyBanned(false);
          }
        } else if (data.is_banned) {
          setIsBlocked(true);
          setIsPermanentlyBanned(true);
          setBlockCountdown(0);
        } else {
          setIsBlocked(false);
          setIsPermanentlyBanned(false);
        }
      }
    } catch (e: any) {
      if (e.name === 'TypeError' && e.message === 'Failed to fetch') {
        // Silent network error (likely server restarting)
        return;
      }
      console.error("Fetch user error:", e);
    }
  }, []);

  const handleRedeemVoucher = async () => {
    if (!user || !voucherCode) return;
    try {
      const res = await fetch("/api/vouchers/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("authToken") || ""}` },
        body: JSON.stringify({ code: voucherCode })
      });
      
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Expected JSON response from redeem voucher API");
      }

      const data = await res.json();
      if (res.ok) {
        showToast(`تم شحن ${data.amount}$ بنجاح!`, 'success');
        setVoucherCode("");
        fetchUser(user.id);
      } else {
        showToast(`${data.error}`, 'error');
      }
    } catch (e: any) {
      if (e.name === 'TypeError' && e.message === 'Failed to fetch') {
        showToast("فشل الاتصال بالخادم (تأكد من اتصالك بالإنترنت)", 'error');
      } else {
        showToast("فشل الاتصال بالخادم", 'error');
      }
    }
  };

  const fetchSiteSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      if (!res.ok) return;
      const data = await res.json();
      const settingsArray = Array.isArray(data) ? data : [];
      setSiteSettings(settingsArray);
    } catch (e) { console.error("Fetch settings error:", e); }
  };

  const fetchMaintenanceStatus = async () => {
    try {
      const res = await fetch("/api/maintenance-status");
      if (!res.ok) { setMaintenanceIpAllowed(false); return; } // فشل التحقق = عدم السماح (أكثر أماناً)
      const data = await res.json();
      setMaintenanceIpAllowed(!!data?.allowed);
    } catch (e) { setMaintenanceIpAllowed(false); } // لا نسمح بالدخول إن تعذّر التحقق أثناء تفعيل الصيانة
  };

  const fetchCurrencies = async () => {
    try {
      const res = await fetch("/api/currencies");
      if (res.ok) {
        const data = await res.json();
        const list: CurrencyOption[] = Array.isArray(data.currencies) ? data.currencies : [];
        setAvailableCurrencies(list);

        const defaultCur = data.defaultCurrency || null;
        const pickedManually = localStorage.getItem("userPickedCurrency") === "1";

        if (defaultCur) {
          setSypRate(parseFloat(defaultCur.exchange_rate));
          setCurrentCurrencySymbol(defaultCur.symbol);
          localStorage.setItem("sypRate", String(defaultCur.exchange_rate));
          localStorage.setItem("currencySymbol", defaultCur.symbol);
          const now = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
          setSypRateUpdatedAt(now);
          localStorage.setItem("sypRateUpdatedAt", now);

          // إذا لم يختر المستخدم عملة يدوياً، نفعّل العملة الافتراضية تلقائياً بدلاً من الدولار
          if (!pickedManually) {
            setCurrency(defaultCur.id);
            localStorage.setItem("currencyId", String(defaultCur.id));
          } else {
            // إذا كانت العملة المختارة يدوياً هي نفسها، حدّث سعر صرفها
            const storedId = localStorage.getItem("currencyId");
            if (storedId && Number(storedId) === defaultCur.id) {
              setCurrency(defaultCur.id);
            }
          }
        } else if (!pickedManually) {
          setCurrency("USD");
          localStorage.removeItem("currencyId");
        }
      }
    } catch (e) { /* silent */ }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch(`/api/categories`);
      if (!res.ok) throw new Error(`Failed to fetch categories: ${res.status}`);
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Expected JSON response from categories API");
      }
      const data = await res.json();
      setCategories(data || []);
    } catch (e: any) {
      if (e.name === 'TypeError' && e.message === 'Failed to fetch') return;
      console.error("Fetch categories error:", e);
    } finally {
      setCategoriesLoading(false);
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      const res = await fetch(`/api/payment-methods`);
      if (!res.ok) throw new Error(`Failed to fetch payment methods: ${res.status}`);
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Expected JSON response from payment methods API");
      }
      const data = await res.json();
      setPaymentMethods(data || []);
    } catch (e: any) {
      if (e.name === 'TypeError' && e.message === 'Failed to fetch') return;
      console.error("Fetch payment methods error:", e);
    }
  };

  const fetchBanners = async () => {
    try {
      const res = await fetch(`/api/banners`);
      if (!res.ok) throw new Error(`Failed to fetch banners: ${res.status}`);
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Expected JSON response from banners API");
      }
      const data = await res.json();
      setBanners(data || []);
    } catch (e: any) {
      if (e.name === 'TypeError' && e.message === 'Failed to fetch') return;
      console.error("Fetch banners error:", e);
    }
  };

  const fetchOffers = async () => {
    try {
      const res = await fetch(`/api/offers`);
      if (!res.ok) throw new Error(`Failed to fetch offers: ${res.status}`);
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Expected JSON response from offers API");
      }
      const data = await res.json();
      setOffers(data || []);
    } catch (e: any) {
      if (e.name === 'TypeError' && e.message === 'Failed to fetch') return;
      console.error("Fetch offers error:", e);
    }
  };

  const fetchSubcategories = async (catId?: number) => {
    try {
      const base = catId ? `/api/categories/${catId}/subcategories` : "/api/subcategories";
      const res = await fetch(base);
      if (!res.ok) throw new Error(`Failed to fetch subcategories: ${res.status}`);
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Expected JSON response from subcategories API");
      }
      const data = await res.json();
      setSubcategories(data || []);
      // نجلب أيضاً منتجات القسم الرئيسي نفسه (بدون قسم فرعي) لعرضها كبلاطة "منتجات القسم نفسه"
      if (catId) {
        setCategoryDirectProducts(await fetchCategoryDirectProducts(catId));
      } else {
        setCategoryDirectProducts([]);
      }
    } catch (e: any) {
      if (e.name === 'TypeError' && e.message === 'Failed to fetch') return;
      console.error("Fetch subcategories error:", e);
    }
  };

  const fetchSubSubCategories = async (subId?: number): Promise<SubSubCategory[]> => {
    try {
      const base = subId ? `/api/subcategories/${subId}/sub-sub-categories` : "/api/sub-sub-categories";
      const res = await fetch(base);
      if (!res.ok) throw new Error(`Failed to fetch sub-sub-categories: ${res.status}`);
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Expected JSON response from sub-sub-categories API");
      }
      const data = await res.json();
      setSubSubCategories(data || []);
      return data || [];
    } catch (e: any) {
      if (e.name === 'TypeError' && e.message === 'Failed to fetch') return [];
      console.error("Fetch sub-sub-categories error:", e);
      return [];
    }
  };

  // fromCategory: عند true، subId هو معرّف القسم الرئيسي نفسه — يُستخدم لجلب المنتجات
  // المرتبطة مباشرة بقسم رئيسي (بدون قسم فرعي) بنفس نظام الترتيب وعدد الأعمدة.
  const fetchProducts = async (subId: number, isSubSub: boolean = false, fromCategory: boolean = false) => {
    try {
      const url = fromCategory
        ? `/api/categories/${subId}/products`
        : isSubSub
        ? `/api/sub-sub-categories/${subId}/products`
        : `/api/subcategories/${subId}/products`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Failed to fetch products: ${res.status}`);
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Expected JSON response from products API");
      }
      const data = await res.json();
      setProducts(data || []);
    } catch (e: any) {
      if (e.name === 'TypeError' && e.message === 'Failed to fetch') return;
      console.error("Fetch products error:", e);
    }
  };

  // منتجات مرتبطة مباشرة بقسم رئيسي (بدون قسم فرعي) — تُستخدم لعرض بلاطة "منتجات القسم نفسه"
  const fetchCategoryDirectProducts = async (catId: number): Promise<Product[]> => {
    try {
      const res = await fetch(`/api/categories/${catId}/products`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  };

  const fetchOrders = async () => {
    if (!user) return;
    try {
      const res = await fetch(`/api/orders/user/${user.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("authToken") || ""}` }
      });
      if (!res.ok) throw new Error(`Failed to fetch orders: ${res.status}`);
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Expected JSON response from orders API");
      }
      const data = await res.json();
      setOrders(data || []);
    } catch (e: any) {
      if (e.name === 'TypeError' && e.message === 'Failed to fetch') return;
      console.error("Fetch orders error:", e);
    }
  };

  const fetchTransactions = useCallback(async () => {
    if (!user) return;
    try {
      const token = localStorage.getItem("authToken") || "";
      const res = await fetch(`/api/transactions/user/${user.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      if (!res.ok) throw new Error(`Failed to fetch transactions: ${res.status}`);
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Expected JSON response from transactions API");
      }
      const data = await res.json();
      setTransactions(data || []);
    } catch (e: any) {
      if (e.name === 'TypeError' && e.message === 'Failed to fetch') return;
      console.error("Fetch transactions error:", e);
    }
  }, [user]);

  useEffect(() => {
    if (activeTab === "orders") fetchOrders();
    if ((activeTab === "wallet" || view.type === "payments") && transactions.length === 0) fetchTransactions();
  }, [activeTab, view.type, user]);

  // نجلب الطلبات فور تسجيل الدخول (وليس فقط عند فتح صفحة الطلبات) حتى يعمل بادج الطلبات
  // المعلّقة في الشريط السفلي، وحتى يظهر "إجمالي الرصيد المصروف" بشكل صحيح في صفحة الدفعات
  // من أول لحظة بدل أن يظهر صفر لحين زيارة صفحة الطلبات.
  useEffect(() => {
    if (user && orders.length === 0) fetchOrders();
  }, [user]);

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("authToken");
    localStorage.removeItem("userId");
    setIsDrawerOpen(false);
    setActiveTab("home");
    setView({ type: "main" });
  };

  // --- Theme Helper ---
  const getTheme = () => {
    if (user?.stats?.custom_theme_color && user.stats.custom_theme_color.startsWith('#')) {
      return {
        primary: "bg-[var(--custom-primary)]",
        primaryHover: "opacity-90",
        text: "text-[var(--custom-primary)]",
        textDark: "text-[var(--custom-primary)]",
        bgLight: "bg-[var(--custom-primary-light)]",
        border: "border-[var(--custom-primary-light)]",
        shadow: "shadow-[var(--custom-primary-light)]",
        gradient: "from-[var(--custom-primary)] to-[var(--custom-primary)]",
        icon: "text-[var(--custom-primary)]",
        button: "bg-[var(--custom-primary)]",
        buttonHover: "opacity-90"
      };
    }
    if (user?.stats?.custom_theme_color === 'brand') {
      return {
        primary: "bg-brand",
        primaryHover: "hover:opacity-90",
        text: "text-brand",
        textDark: "text-brand",
        bgLight: "bg-brand-light",
        border: "border-brand-soft",
        shadow: "shadow-brand-soft",
        gradient: "from-brand to-brand",
        icon: "text-brand",
        button: "bg-brand",
        buttonHover: "hover:opacity-90"
      };
    }
    if (user?.is_vip || user?.stats?.custom_theme_color === 'yellow') {
      return {
        primary: "bg-amber-500",
        primaryHover: "hover:bg-amber-600",
        text: "text-amber-600",
        textDark: "text-amber-700",
        bgLight: "bg-amber-50",
        border: "border-amber-100",
        shadow: "shadow-amber-100",
        gradient: "from-amber-500 to-yellow-600",
        icon: "text-amber-600",
        button: "bg-amber-600",
        buttonHover: "hover:bg-amber-700"
      };
    }
    return {
      primary: "bg-[var(--brand)]",
      primaryHover: "hover:bg-[var(--brand-dark)]",
      text: "text-[var(--brand)]",
      textDark: "text-[var(--brand-dark)]",
      bgLight: "bg-red-50",
      border: "border-red-100",
      shadow: "shadow-red-100",
      gradient: "from-[var(--brand)] to-[var(--brand-dark)]",
      icon: "text-[var(--brand)]",
      button: "bg-[var(--brand)]",
      buttonHover: "hover:bg-[var(--brand-dark)]"
    };
  };

  const theme = getTheme();

  // دالة تنسيق السعر حسب العملة المختارة (ديناميكية) - موحّدة بثلاث خانات عشرية دائمًا
  const fmtPrice = (usd: number, decimals?: number) => {
    const d = decimals !== undefined ? decimals : 3;
    const num = typeof usd === "number" && !isNaN(usd) ? usd : 0;
    if (currency !== "USD" && sypRate > 0) {
      return `${(num * sypRate).toFixed(d)} ${currentCurrencySymbol}`;
    }
    return `${num.toFixed(d)} $`;
  };

  // --- UI Components ---

  const Header = () => (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 z-40">
      <div className="flex items-center gap-3">
        <button onClick={() => setIsDrawerOpen(true)} className="p-2 hover:bg-gray-50 rounded-full">
          <Menu size={24} className="text-gray-700" />
        </button>
      </div>

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2">
        <div className="w-10 h-10 flex items-center justify-center overflow-hidden">
          <OptimizedImage
            src={appearance.logo_url}
            width={80}
            height={80}
            alt="Logo"
            className="w-full h-full object-contain"
            eager
          />
        </div>
        <span className={`font-bold text-gray-800 hidden sm:block ${user?.is_vip ? 'text-amber-600' : ''}`}>
          سراقب ستور {user?.is_vip && 'VIP'}
        </span>
      </div>
      
      <div className="flex items-center gap-4">
        {user && (
          <div className="relative flex items-center select-none">
            <span
              className={`font-bold cursor-pointer ${theme.textDark}`}
              onMouseDown={() => { if (currency !== "USD") setShowRateTooltip(true); }}
              onMouseUp={() => setShowRateTooltip(false)}
              onMouseLeave={() => setShowRateTooltip(false)}
              onTouchStart={() => { if (currency !== "USD") setShowRateTooltip(true); }}
              onTouchEnd={() => setShowRateTooltip(false)}
            >
              {currency !== "USD" && sypRate > 0
                ? `${Math.round(user.balance * sypRate).toLocaleString("en-US")} ${currentCurrencySymbol}`
                : `${user.balance.toFixed(3)} $`}
            </span>
            {showRateTooltip && currency !== "USD" && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 z-50 bg-gray-900 text-white rounded-lg px-3 py-2 shadow-xl text-center whitespace-nowrap pointer-events-none"
                style={{ fontSize: "11px", minWidth: "160px" }}>
                <p className="font-bold text-yellow-300 text-xs mb-0.5">1$ = {sypRate.toLocaleString("en-US")} {currentCurrencySymbol}</p>
                {sypRateUpdatedAt && <p className="text-gray-300 text-[10px]">آخر تحديث: {sypRateUpdatedAt}</p>}
                <p className="text-gray-400 text-[9px] mt-0.5">* السعر وفق سعر الصرف الحالي</p>
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45" />
              </div>
            )}
          </div>
        )}
        <div className="relative inline-flex">
          <button onClick={() => setNotificationsOpen(true)} className="p-2 hover:bg-gray-50 rounded-full">
            <Bell size={22} className="text-gray-600" />
          </button>
          {(Array.isArray(notifications) ? notifications : []).filter(n => !n.is_read).length > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full border-2 border-white flex items-center justify-center pointer-events-none z-10">
              <span className="text-white text-[9px] font-bold leading-none px-0.5">
                {(Array.isArray(notifications) ? notifications : []).filter(n => !n.is_read).length > 9 ? "9+" : (Array.isArray(notifications) ? notifications : []).filter(n => !n.is_read).length}
              </span>
            </span>
          )}
        </div>
      </div>
    </header>
  );

  const NotificationPanel = () => (
    <AnimatePresence>
      {notificationsOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setNotificationsOpen(false)}
            className="fixed inset-0 bg-black/20 z-50"
          />
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            className="fixed bottom-0 left-0 right-0 bg-white z-50 rounded-t-lg shadow-2xl max-h-[80vh] flex flex-col"
          >
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-bold text-lg text-gray-800">الإشعارات</h3>
              <div className="flex items-center gap-2">
                {(Array.isArray(notifications) ? notifications : []).some(n => !n.is_read) && (
                  <button
                    onClick={markAllNotificationsRead}
                    className="text-xs font-bold text-brand bg-brand-light px-3 py-1.5 rounded-full"
                  >
                    تمييز الكل كمقروء
                  </button>
                )}
                <button onClick={() => setNotificationsOpen(false)} className="p-2 bg-gray-100 rounded-full">
                  <XCircle size={20} className="text-gray-400" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {notifications.length > 0 ? (
                (Array.isArray(notifications) ? notifications : []).map(notif => (
                  <div 
                    key={notif.id} 
                    className={`p-4 rounded-lg border transition-all cursor-pointer ${notif.is_read ? 'opacity-60' : 'shadow-sm'} ${
                      notif.type === 'warning' ? 'bg-amber-50 border-amber-100' : 
                      notif.type === 'success' ? 'bg-brand-light border-brand-soft' : 'bg-blue-50 border-blue-100'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h4 className={`font-bold ${
                        notif.type === 'warning' ? 'text-amber-800' : 
                        notif.type === 'success' ? 'text-brand' : 'text-blue-800'
                      }`}>{notif.title}</h4>
                      <div className="flex items-center gap-1.5 flex-shrink-0 mr-2">
                        {notif.created_at && <span className="text-[9px] text-gray-400">{new Date(notif.created_at).toLocaleTimeString("ar-EG")}</span>}
                        {!notif.is_read && (
                          <button
                            onClick={(e) => { e.stopPropagation(); markNotificationRead(notif.id); }}
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                              notif.type === 'warning' ? 'bg-amber-200 text-amber-800' :
                              notif.type === 'success' ? 'bg-brand text-white' : 'bg-blue-200 text-blue-800'
                            }`}
                          >
                            مقروء
                          </button>
                        )}
                      </div>
                    </div>
                    <p className={`text-sm leading-relaxed ${
                      notif.type === 'warning' ? 'text-amber-700' : 
                      notif.type === 'success' ? 'text-brand' : 'text-blue-700'
                    }`}>{notif.message}</p>
                    {notif.action === 'unlink' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleUnlinkTelegram(); }}
                        className="mt-3 bg-amber-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm"
                      >
                        فك الارتباط الآن
                      </button>
                    )}
                    {notif.action === 'shamcash_invoice_pending' && (
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleReturnToPendingInvoice(notif); }}
                          className="bg-amber-600 text-white px-4 py-2 rounded-lg text-xs font-bold shadow-sm"
                        >
                          العودة للفاتورة
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleCancelPendingInvoiceFromNotification(notif); }}
                          className="bg-white border border-amber-300 text-amber-700 px-4 py-2 rounded-lg text-xs font-bold"
                        >
                          إلغاء الفاتورة
                        </button>
                      </div>
                    )}
                    {(() => {
                      const urlMatch = (notif.message || '').match(/https:\/\/[^\s]+/);
                      if (!urlMatch) return null;
                      return (
                        <button
                          onClick={(e) => { e.stopPropagation(); window.open(urlMatch[0], '_blank', 'noopener,noreferrer'); }}
                          className={`mt-3 flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold shadow-sm ${
                            notif.type === 'warning' ? 'bg-amber-600 text-white' :
                            notif.type === 'success' ? 'bg-brand text-white' : 'bg-blue-600 text-white'
                          }`}
                        >
                          <ExternalLink size={12} />
                          فتح الرابط
                        </button>
                      );
                    })()}
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                  <Bell size={48} className="mb-4 opacity-20" />
                  <p>لا توجد إشعارات حالياً</p>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  const BottomNav = () => {
    const pendingOrders = orders.filter((o: any) => o.status === "pending" || o.status === "pending_admin" || o.status === "processing").length;
    const unreadMsgs = user?.unread_support_count || 0;
    return (
    <nav className="fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-gray-100 flex items-center justify-around z-40">
      <button 
        onClick={() => { try { sessionStorage.removeItem("checkoutPageProduct"); } catch {}; setCheckoutOrderResult(null); setActiveTab("home"); setView({ type: "main" }); setViewHistory([]); }}
        className={`flex flex-col items-center gap-1 ${activeTab === "home" ? theme.text : "text-gray-400"}`}
      >
        <Home size={22} />
        <span className="text-[10px] font-medium">الرئيسية</span>
      </button>
      <button 
        onClick={() => { setCheckoutOrderResult(null); setActiveTab("wallet"); setView({ type: "main" }); }}
        className={`flex flex-col items-center gap-1 ${activeTab === "wallet" ? theme.text : "text-gray-400"}`}
      >
        <ChargeIcon size={25} />
        <span className="text-[10px] font-medium">شحن الرصيد</span>
      </button>
      <button 
        onClick={() => { setCheckoutOrderResult(null); setActiveTab("orders"); setView({ type: "main" }); }}
        className={`flex flex-col items-center gap-1 ${activeTab === "orders" ? theme.text : "text-gray-400"}`}
      >
        <div className="relative">
          <ShoppingBag size={22} />
          {pendingOrders > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold rounded-full w-[18px] h-[18px] flex items-center justify-center leading-none border-2 border-white z-10">
              {pendingOrders > 9 ? "9+" : pendingOrders}
            </span>
          )}
        </div>
        <span className="text-[10px] font-medium">الطلبات</span>
      </button>
      <button 
        onClick={() => { setCheckoutOrderResult(null); setActiveTab("profile"); setView({ type: "main" }); }}
        className={`flex flex-col items-center gap-1 ${activeTab === "profile" ? theme.text : "text-gray-400"}`}
      >
        <div className="relative">
          <User size={22} />
          {unreadMsgs > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[9px] font-bold rounded-full w-[18px] h-[18px] flex items-center justify-center leading-none border-2 border-white z-10">
              {unreadMsgs > 9 ? "9+" : unreadMsgs}
            </span>
          )}
        </div>
        <span className="text-[10px] font-medium">حسابي</span>
      </button>
    </nav>
    );
  };

  // [DRAWER-RESTYLE] large: صفّ مميَّز (خطّ غامق) بحجم مقارب للافتراضي — صُغِّر بعد أن كان
  // كبيراً جداً على شاشات الجوال؛ الفرق عن الافتراضي أصبح طفيفاً (الخط الغامق فقط) بدل القفزة
  // الكبيرة في الحشو وحجم الأيقونة.
  const DrawerItem = ({ icon, label, onClick, className = "", large = false }: any) => (
    <button onClick={onClick} className={`w-full flex items-center gap-3 transition-colors px-5 py-3 ${large ? "text-sm font-bold" : "text-[13px] font-medium"} ${isDarkMode ? "hover:bg-zinc-800" : "hover:bg-gray-50"} ${className}`}>
      <span className={className ? "" : isDarkMode ? "text-zinc-400" : "text-gray-500"}>{icon}</span>
      <span>{label}</span>
    </button>
  );

  const buildWhatsappLink = (raw?: string): string => {
    const fallback = "https://wa.me/message/DELXtdEh9ua5edFTupESNU";
    if (!raw) return fallback;
    const trimmed = raw.trim();
    if (!trimmed) return fallback;
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    const digits = trimmed.replace(/[^\d]/g, "");
    if (!digits) return fallback;
    return `https://wa.me/${digits}`;
  };
  const whatsappLink = buildWhatsappLink(siteSettings?.find((s: any) => s.key === "support_whatsapp")?.value);

  // [DRAWER-RESTYLE] فقّاعة العملة الثابتة (أعلى القائمة، صغيرة) — عنصر واحد مُعاد استخدامه
  // في رأس القائمة لكل من المستخدم المسجَّل والزائر، لتجنّب تكرار منطق onChange مرتين.
  const drawerCurrencyPill = (
    <div className="flex justify-center mt-3">
      <CurrencyDropdown
        value={String(currency)}
        options={[
          { value: "USD", label: "$" },
          ...availableCurrencies.map(c => ({ value: String(c.id), label: c.symbol })),
        ]}
        onChange={(val) => {
          setUserPickedCurrency(true);
          localStorage.setItem("userPickedCurrency", "1");
          if (val === "USD") {
            setCurrency("USD");
            localStorage.removeItem("currencyId");
          } else {
            const picked = availableCurrencies.find(c => String(c.id) === val);
            setCurrency(Number(val));
            localStorage.setItem("currencyId", val);
            if (picked) {
              setSypRate(picked.exchange_rate);
              setCurrentCurrencySymbol(picked.symbol);
              localStorage.setItem("sypRate", String(picked.exchange_rate));
              localStorage.setItem("currencySymbol", picked.symbol);
            }
          }
        }}
        leading={<><RefreshCw size={13} /><span>العملة</span></>}
        triggerClassName="flex items-center gap-1.5 bg-amber-100 text-amber-900 font-black text-xs px-5 py-1.5 rounded-full cursor-pointer outline-none active:scale-95 transition-transform"
      />
    </div>
  );

  // --- Views ---

  // HomeView and SubcategoriesView extracted to src/pages/HomePage.tsx and src/pages/SubcategoriesPage.tsx


  // SubSubCategoriesView extracted to src/pages/SubSubCategoriesPage.tsx
  // ProductsView extracted to src/pages/ProductsPage.tsx

  // QuickOrderView extracted to src/pages/QuickOrderPage.tsx

  // CheckoutView extracted to src/pages/CheckoutPage.tsx

  // WalletView extracted (together with WalletChargeView) to src/pages/WalletPage.tsx

  // PaymentsView extracted to src/pages/PaymentsPage.tsx

  // OrdersView extracted to src/pages/OrdersPage.tsx

  // ProfileView + ProfileItem extracted to src/pages/ProfilePage.tsx

    const ThemeCustomizationModal = () => {
    if (!themeModal.isOpen) return null;
    const colors = [
      "#10b981", "#3b82f6", "#ef4444", "#f59e0b", "#8b5cf6", 
      "#ec4899", "#06b6d4", "#14b8a6", "#f97316", "#6366f1",
      "#000000", "#4b5563", "#1e293b", "#064e3b", "#7c2d12"
    ];

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-brand via-brand to-blue-500"></div>
          <button onClick={() => setThemeModal({ ...themeModal, isOpen: false })} className="absolute top-6 left-6 text-gray-400 hover:text-gray-600 transition-colors">
            <X size={24} />
          </button>
          
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-brand-light rounded-lg flex items-center justify-center text-brand mx-auto mb-4">
              <Palette size={32} />
            </div>
            <h3 className="text-xl font-bold text-gray-800">تخصيص لون الثيم</h3>
            <p className="text-gray-400 text-sm mt-1">اختر لونك المفضل لتمييز حسابك</p>
          </div>

          <div className="grid grid-cols-5 gap-3 mb-8">
            {colors.map(c => (
              <button 
                key={c} 
                onClick={() => setThemeModal({ ...themeModal, color: c })}
                className={`w-full aspect-square rounded-lg transition-all ${themeModal.color === c ? 'ring-4 ring-offset-2 ring-brand scale-110' : 'hover:scale-105'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
              <div className="w-10 h-10 rounded-md shadow-sm" style={{ backgroundColor: themeModal.color }}></div>
              <div className="flex-1">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">اللون المختار</p>
                <p className="text-sm font-mono font-bold text-gray-700">{themeModal.color}</p>
              </div>
            </div>
            
            <button 
              onClick={() => handleUpdateTheme(themeModal.color)}
              className="w-full bg-gray-800 text-white py-4 rounded-lg font-bold shadow-lg shadow-gray-100 transition-all active:scale-95"
            >
              حفظ التغييرات
            </button>
          </div>
        </motion.div>
      </div>
    );
  };


  // VerifyEmailView, ForgotPasswordView, LoginView extracted to src/components/VerifyEmailView.tsx,
  // src/pages/ForgotPasswordPage.tsx, src/pages/LoginPage.tsx (Prompt 13)

  // ProfileDetailsView extracted to src/pages/ProfileDetailsPage.tsx (Prompt 14)

  // LeaderboardView extracted to src/pages/LeaderboardPage.tsx (Prompt 15)
  // EditProfileView extracted to src/pages/EditProfilePage.tsx (Prompt 15)

  // ReferralView extracted to src/pages/ReferralPage.tsx (Prompt 16)
  // ChatView extracted to src/pages/ChatPage.tsx (Prompt 16)

  // PrivacyPolicyView extracted to src/pages/PrivacyPolicyPage.tsx (Prompt 17)

  // SettingsView extracted → src/pages/SettingsPage.tsx

  // SuccessView extracted → src/pages/SuccessPage.tsx


// OrderPollingStatus moved to src/components/OrderPollingStatus.tsx







  if (location.pathname === "/api-docs" || location.pathname === "/api-docs/") {
    return <ApiDocsPage />;
  }

  const isMaintenanceOn = siteSettings?.find((s: any) => s.key === "maintenance_mode")?.value === "true";

  if (isMaintenanceOn && !maintenanceIpAllowed) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gray-50 text-center px-6" dir="rtl">
        <img src="https://i.ibb.co/BVKxGmnq/1000033981.png" alt="الموقع في وضع الصيانة" className="max-w-xs w-full mb-6" />
        <h1 className="text-xl font-bold text-gray-800 mb-2">الموقع في وضع الصيانة</h1>
        <p className="text-sm text-gray-500 mb-5">نعمل حالياً على تحسين الموقع، يرجى المحاولة مرة أخرى بعد قليل.</p>
        <button
          onClick={() => { fetchSiteSettings(); fetchMaintenanceStatus(); }}
          className="text-xs font-bold text-gray-400 underline"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  if (view.type === "not_found") {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-gray-50 text-center px-6" dir="rtl">
        <img src="https://i.ibb.co/FL6Vs0ZS/1000041903-removebg-preview.png" alt="الصفحة غير موجودة" className="w-40 h-40 object-contain mb-4" />
        <p className={`text-7xl font-black ${theme.text} mb-2`}>404</p>
        <h1 className="text-xl font-bold text-gray-800 mb-2">الصفحة غير موجودة</h1>
        <p className="text-sm text-gray-500 mb-6">الرابط الذي حاولت فتحه غير صحيح أو لم يعد متاحاً.</p>
        <button
          onClick={() => { setActiveTab("home"); setView({ type: "main" }); setViewHistory([]); }}
          className={`px-6 py-2.5 rounded-lg font-bold text-sm text-white ${theme.button} ${theme.buttonHover}`}
        >
          العودة للرئيسية
        </button>
      </div>
    );
  }

  // ============================================================
  // [SEO/GEO] حساب عنوان/وصف/صورة الصفحة الحالية على جهة العميل.
  // يُستخدم فقط لتحديث الوسوم أثناء تنقل SPA بعد التحميل الأول —
  // التحميل الأول (وهو الأهم لمحركات البحث) يُعالَج في seo.ts على
  // السيرفر. هذا لا يغيّر أي منطق توجيه موجود، فقط "يقرأ" view.
  // ============================================================
  const storeDisplayName = "سراقب ستور";
  const seoData = (() => {
    try {
      if (view.type === "subcategories") {
        const cat = categories.find((c: any) => c.id === view.id);
        if (cat) {
          return {
            title: `${cat.name} — شحن فوري وأسعار منافسة | ${storeDisplayName}`,
            description: `تسوّق أقسام ${cat.name} في ${storeDisplayName} بأسعار منافسة وتسليم فوري وآمن.`,
            image: cat.image_url,
          };
        }
      } else if (view.type === "sub_sub_categories" || view.type === "products") {
        const sub = subcategories.find((s: any) => s.id === view.id);
        const name = sub?.name || view.data;
        if (name) {
          return {
            title: `شحن ${name} — تسليم فوري | ${storeDisplayName}`,
            description: `اطلب ${name} الآن من ${storeDisplayName} بأسعار منافسة وتسليم فوري وآمن مع ضمان استرجاع في حال الفشل.`,
            image: sub?.image_url,
          };
        }
      } else if (view.type === "main" && activeTab === "home") {
        return {
          title: `${storeDisplayName} — أفضل متجر عربي لشحن الألعاب وبطاقات الهدايا | شحن فوري`,
          description:
            "شحن فوري لشدات ببجي، جواهر فري فاير، شام كاش، سيرياتيل كاش، وبطاقات هدايا Google Play وiTunes وPlayStation. أسعار منافسة وتسليم آلي خلال دقائق.",
        };
      }
    } catch {
      /* تجاهل — الوسوم الافتراضية من index.html تبقى كما هي */
    }
    return null;
  })();

  return (
    <div className="min-h-screen bg-gray-50 text-right" dir="rtl">
      {seoData && <SeoHead title={seoData.title} description={seoData.description} image={seoData.image} />}
      {/* [FIX] شارة تحقق من الجلسة: تظهر فوق الواجهة بشفافية خفيفة أثناء التحديث،
          بدل أن تظهر الصفحة كزائر للحظة ثم تتحول فجأة إلى حساب مسجّل */}
      <AnimatePresence>
        {authLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center gap-3 backdrop-blur-xl ${isDarkMode ? "bg-black/40" : "bg-white/10"}`}
          >
            <SessionSyncSpinner />
            <p className="text-xs font-bold text-gray-500 drop-shadow-sm">جاري تحديث الصفحة...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {view.type !== "chat" && <Header />}

      <AnimatePresence>
        {isDrawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="fixed inset-0 bg-black/40 z-50"
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className={`fixed top-0 right-0 bottom-0 w-72 z-50 shadow-2xl flex flex-col ${isDarkMode ? "bg-zinc-900 text-white" : "bg-white text-gray-800"}`}
            >
              {/* ===== رأس القائمة — معلومات الحساب ===== */}
              <div className="p-5 pt-10" style={{ background: "var(--drawer-header)" }}>
                {user ? (
                  <>
                  <div className="flex items-center gap-3">
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-white/20 flex items-center justify-center flex-shrink-0 border-2 border-white/30">
                      {user.avatar_url
                        ? <OptimizedImage src={user.avatar_url} width={128} height={128} alt="avatar" className="w-full h-full object-cover" />
                        : <User size={28} className="text-white" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white text-sm truncate">{user.name}</p>
                      <p className="text-white/75 text-[11px] truncate">{user.email}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">#{user.id}</span>
                        <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Wallet size={9} /> {user.balance?.toFixed(3) ?? "0.00"} $
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* [DRAWER-RESTYLE] المفضلة وتسجيل الخروج نُقلا إلى هنا كصفّ أيقونات أعلى
                      القائمة بدل تكرارهما كعنصر قائمة عادي — لا يضيف أزراراً جديدة. */}
                  <div className="flex items-center justify-center gap-10 mt-3">
                    <button
                      onClick={() => { setActiveTab("home"); setView({ type: "main" }); setHomeSortMode("favorites"); setIsDrawerOpen(false); }}
                      aria-label="المفضلة"
                      className="text-white active:opacity-70 transition-opacity"
                    >
                      <Star size={20} />
                    </button>
                    <button
                      onClick={handleLogout}
                      aria-label="تسجيل الخروج"
                      className="text-white active:opacity-70 transition-opacity"
                    >
                      <LogOut size={20} />
                    </button>
                  </div>

                  {/* [DRAWER-RESTYLE] فقّاعة العملة ثابتة أسفل المفضلة/تسجيل الخروج —
                      داخل رأس القائمة الثابت، لا الجزء القابل للتمرير. */}
                  {drawerCurrencyPill}
                  </>
                ) : (
                  <div>
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-lg bg-white/20 flex items-center justify-center">
                      <User size={26} className="text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-white text-sm">زائر</p>
                      <p className="text-white/70 text-xs">سجل الدخول للمزيد</p>
                    </div>
                  </div>
                  {drawerCurrencyPill}
                  </div>
                )}
              </div>

              {/* ===== قائمة العناصر ===== */}
              <div className="flex-1 overflow-y-auto py-2">

                {user && (
                  <>
                    {/* ===== الرئيسية ===== */}
                    <DrawerItem
                      large
                      icon={<span className="text-green-600"><Home size={18} /></span>}
                      label="الرئيسية"
                      className={`${isDarkMode ? "bg-zinc-800" : "bg-gray-100"} font-bold`}
                      onClick={() => { setActiveTab("home"); setView({ type: "main" }); setIsDrawerOpen(false); }}
                    />

                    {/* ===== إضافة رصيد ===== */}
                    <DrawerItem large icon={<span className="text-blue-500"><ChargeIcon size={18} /></span>} label="إضافة رصيد" onClick={() => { setActiveTab("wallet"); setView({ type: "main" }); setIsDrawerOpen(false); }} />

                    {/* ===== دفعاتي ===== */}
                    <DrawerItem large icon={<span className="text-blue-500"><History size={18} /></span>} label="دفعاتي" onClick={() => { setActiveTab("profile"); setView({ type: "payments" }); setIsDrawerOpen(false); }} />

                    {/* ===== طلباتي ===== */}
                    <DrawerItem large icon={<span className="text-red-500"><ShoppingBag size={18} /></span>} label="طلباتي" onClick={() => { setActiveTab("orders"); setView({ type: "main" }); setIsDrawerOpen(false); }} />

                    {/* [DRAWER-RESTYLE] أُزيلت الفواصل وعناوين "حسابي"/"اخرى" — العناصر
                        الآن متتالية مباشرة بلا تقسيمات بصرية. */}
                    <DrawerItem large icon={<span className="text-yellow-500"><Trophy size={18} /></span>}   label="الترتيب" onClick={() => { setActiveTab("profile"); setView({ type: "leaderboard" }); setIsDrawerOpen(false); }} />
                    <DrawerItem large icon={<span className="text-yellow-500"><Gift size={18} /></span>}     label="الإحالة" onClick={() => { setActiveTab("profile"); setView({ type: "referral" }); setIsDrawerOpen(false); }} />
                    <DrawerItem large icon={<span className="text-green-600"><Key size={18} /></span>} label="API" onClick={() => { setActiveTab("profile"); setView({ type: "user_api" }); setIsDrawerOpen(false); }} />
                    <DrawerItem icon={<span className="text-green-500"><Headphones size={18} /></span>} label="الدعم الفني"  onClick={() => { setActiveTab("profile"); setView({ type: "chat" }); setIsDrawerOpen(false); }} />

                    <button
                      onClick={() => { window.open(whatsappLink, "_blank"); setIsDrawerOpen(false); }}
                      className={`w-full flex items-center gap-3 px-5 py-3 transition-colors ${isDarkMode ? "hover:bg-zinc-800" : "hover:bg-gray-50"}`}
                    >
                      <span className="text-green-500">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      </span>
                      <span className="font-bold text-sm">دعم واتساب</span>
                    </button>

                    <button
                      onClick={() => {
                        if (user?.telegram_chat_id) {
                          handleUnlinkTelegram();
                        } else {
                          handleGenerateLinkingCode();
                        }
                        setIsDrawerOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-5 py-3 transition-colors ${isDarkMode ? "hover:bg-zinc-800" : "hover:bg-gray-50"}`}
                    >
                      <span className={user?.telegram_chat_id ? "text-blue-500" : "text-orange-400"}>
                        <MessageSquare size={18} />
                      </span>
                      <span className="font-bold text-sm flex-1 text-right">
                        {user?.telegram_chat_id ? "تلجرام مرتبط" : "ربط تلجرام"}
                      </span>
                      {user?.telegram_chat_id && (
                        <span className="text-[10px] text-red-400 font-bold">فك الربط</span>
                      )}
                    </button>
                  </>
                )}

                {/* الوضع الليلي / النهاري - يحدده المستخدم */}
                <div className={`flex items-center justify-between px-5 py-3 ${isDarkMode ? "hover:bg-zinc-800" : "hover:bg-gray-50"} transition-colors`}>
                  <div className="flex items-center gap-3">
                    <span className={isDarkMode ? "text-yellow-400" : "text-gray-500"}>
                      {isDarkMode ? <Moon size={18} /> : <Sun size={18} />}
                    </span>
                    <span className="font-bold text-sm">{isDarkMode ? "الوضع الليلي" : "الوضع النهاري"}</span>
                  </div>
                  <button
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className={`w-12 h-6 rounded-full relative transition-all duration-300 ${isDarkMode ? "bg-brand" : "bg-gray-200"}`}
                  >
                    <div className={`absolute top-1 w-4 h-4 rounded-full shadow transition-all duration-300 flex items-center justify-center ${isDarkMode ? "right-1 bg-[var(--brand-contrast)]" : "left-1 bg-white"}`}>
                      {isDarkMode ? <Moon size={9} className="text-brand" /> : <Sun size={9} className="text-yellow-500" />}
                    </div>
                  </button>
                </div>

                {deferredPrompt && (
                  <DrawerItem
                    large
                    icon={<Download size={18} />}
                    label="تثبيت التطبيق"
                    onClick={() => { handleInstallApp(); setIsDrawerOpen(false); }}
                    className="text-brand"
                  />
                )}

                {!user && (
                  <DrawerItem icon={<ArrowRight size={18} />} label="تسجيل الدخول" onClick={() => { setView({ type: "login" }); setIsDrawerOpen(false); }} />
                )}
              </div>

              <div className={`p-3 text-center text-[10px] border-t ${isDarkMode ? "text-zinc-500 border-zinc-700" : "text-gray-300 border-gray-100"}`}>
                برمجة منصة saraqib.store · الإصدار 1.3
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <NotificationPanel />

      {entryPopup.show && activeTab === "home" && view.type === "main" && (
        <EntryPopupModal
          text={entryPopup.text}
          link={entryPopup.link}
          onClose={() => setEntryPopup((p) => ({ ...p, show: false }))}
        />
      )}
      
      <main className={view.type === "chat" ? "pb-16" : "pt-20 pb-24"}>
        <AnimatePresence mode="wait">
          <motion.div
            key={bgView.type + activeTab}
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -14, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {view.type === "voucher_redeem" && (
              <VoucherRedeemPage 
                voucherCode={voucherCode}
                setVoucherCode={setVoucherCode}
                handleRedeemVoucher={handleRedeemVoucher}
                setView={setView}
              />
            )}
            {view.type !== "voucher_redeem" && (
              <>
                {activeTab === "home" && (
                  <>
                    {bgView.type === "main" && (
                      <HomePage
                        banners={banners}
                        homeSortMode={homeSortMode}
                        setHomeSortMode={setHomeSortMode}
                        showSortDropdown={showSortDropdown}
                        setShowSortDropdown={setShowSortDropdown}
                        categories={categories}
                        categoriesLoading={categoriesLoading}
                        subcategories={subcategories}
                        theme={theme}
                        setPageLoading={setPageLoading}
                        fetchSubcategories={fetchSubcategories}
                        navigateTo={navigateTo}
                        isFavorite={isFavorite}
                        useLongPressHandlers={useLongPressHandlers}
                        mostPurchasedLoading={mostPurchasedLoading}
                        mostPurchased={mostPurchased}
                        user={user}
                        setCheckoutQuantity={setCheckoutQuantity}
                        fmtPrice={fmtPrice}
                        favorites={favorites}
                        setViewHistory={setViewHistory}
                        fetchSubSubCategories={fetchSubSubCategories}
                        fetchProducts={fetchProducts}
                        setView={setView}
                        removeFromFavorites={removeFromFavorites}
                        offers={offers}
                        fetchMostPurchased={fetchMostPurchased}
                        appearance={appearance}
                      />
                    )}
                    {bgView.type === "subcategories" && (
                      <SubcategoriesPage
                        navigateBack={navigateBack}
                        view={bgView}
                        subcategories={subcategories}
                        categoryDirectProducts={categoryDirectProducts}
                        pageLoading={pageLoading}
                        setPageLoading={setPageLoading}
                        fetchSubSubCategories={fetchSubSubCategories}
                        fetchProducts={fetchProducts}
                        navigateTo={navigateTo}
                        isFavorite={isFavorite}
                        useLongPressHandlers={useLongPressHandlers}
                        appearance={appearance}
                        theme={theme}
                        user={user}
                        fmtPrice={fmtPrice}
                        setCheckoutQuantity={setCheckoutQuantity}
                      />
                    )}
                    {bgView.type === "sub_sub_categories" && <SubSubCategoriesPage
                      navigateBack={navigateBack}
                      view={bgView}
                      subSubCategories={subSubCategories}
                      products={products}
                      pageLoading={pageLoading}
                      setPageLoading={setPageLoading}
                      fetchProducts={fetchProducts}
                      navigateTo={navigateTo}
                      isFavorite={isFavorite}
                      useLongPressHandlers={useLongPressHandlers}
                      theme={theme}
                      fmtPrice={fmtPrice}
                      user={user}
                      setView={setView}
                      setCheckoutQuantity={setCheckoutQuantity}
                      appearance={appearance}
                    />}
                    {bgView.type === "products" && <ProductsPage
                      navigateBack={navigateBack}
                      navigateTo={navigateTo}
                      view={bgView}
                      products={products}
                      pageLoading={pageLoading}
                      isFavorite={isFavorite}
                      useLongPressHandlers={useLongPressHandlers}
                      theme={theme}
                      fmtPrice={fmtPrice}
                      user={user}
                      setView={setView}
                      setCheckoutQuantity={setCheckoutQuantity}
                      appearance={appearance}
                      siteSettings={siteSettings}
                    />}
                    {appearance?.checkout_mode !== "modal" && (view.type === "checkout" || (checkoutOrderResult && activeTab === "home")) && <CheckoutPage view={view} user={user} siteSettings={siteSettings} theme={theme} isDarkMode={isDarkMode} isModal={false} fmtPrice={fmtPrice} setView={setView} setActiveTab={setActiveTab} fetchUser={fetchUser} fetchOrders={fetchOrders} checkoutQuantity={checkoutQuantity} setCheckoutQuantity={setCheckoutQuantity} checkoutOrderResult={checkoutOrderResult} setCheckoutOrderResult={setCheckoutOrderResult} navigateBack={navigateBack} isFavorite={isFavorite} addToFavorites={addToFavorites} removeFromFavorites={removeFromFavorites} />}
                    {appearance?.checkout_mode !== "modal" && view.type === "quick_order" && !checkoutOrderResult && <QuickOrderPage view={view} user={user} siteSettings={siteSettings} theme={theme} isDarkMode={isDarkMode} isModal={false} fmtPrice={fmtPrice} setView={setView} setActiveTab={setActiveTab} fetchUser={fetchUser} navigateBack={navigateBack} isFavorite={isFavorite} addToFavorites={addToFavorites} removeFromFavorites={removeFromFavorites} />}
                    {view.type === "success" && !view.dark && !checkoutOrderResult && <SuccessPage setView={setView} setActiveTab={setActiveTab} viewData={view.data} />}
                    {view.type === "login" && <LoginPage theme={theme} setUser={setUser} setView={setView} setActiveTab={setActiveTab} />}
                    {view.type === "forgot_password" && <ForgotPasswordPage setUser={setUser} setView={setView} setActiveTab={setActiveTab} />}
                  </>
                )}
                {activeTab === "wallet" && (user ? <WalletPage user={user} paymentMethods={paymentMethods} setView={setView} fetchUser={fetchUser} fetchTransactions={fetchTransactions} sypRate={sypRate} appearance={appearance} /> : (view.type === "forgot_password" ? <ForgotPasswordPage setUser={setUser} setView={setView} setActiveTab={setActiveTab} /> : <LoginPage theme={theme} setUser={setUser} setView={setView} setActiveTab={setActiveTab} />))}
                {activeTab === "orders" && (user ? <OrdersPage orders={orders} setActiveTab={setActiveTab} fetchOrders={fetchOrders} /> : (view.type === "forgot_password" ? <ForgotPasswordPage setUser={setUser} setView={setView} setActiveTab={setActiveTab} /> : <LoginPage theme={theme} setUser={setUser} setView={setView} setActiveTab={setActiveTab} />))}
                {activeTab === "profile" && (
                  <>
                    {view.type === "main" && <ProfilePage user={user} theme={theme} setView={setView} handleGenerateLinkingCode={handleGenerateLinkingCode} handleLogout={handleLogout} telegramBotAvailable={telegramBotStatus.available} />}
                    {view.type === "profile_details" && <ProfileDetailsPage user={user} theme={theme} orders={orders} setView={setView} setActiveTab={setActiveTab} />}
                    {view.type === "active_sessions" && <ActiveSessionsPage user={user} theme={theme} setView={setView} />}
                    {view.type === "sessions_activity" && <SessionsActivityPage user={user} theme={theme} setView={setView} />}
                    {view.type === "leaderboard" && <LeaderboardPage user={user} theme={theme} setView={setView} />}
                    {view.type === "payments" && <PaymentsPage setView={setView} transactions={transactions} orders={orders} />}
                    {view.type === "edit_profile" && <EditProfilePage user={user} theme={theme} setView={setView} fetchUser={fetchUser} />}
                    {view.type === "profile_forgot_password" && <ForgotPasswordPage setUser={setUser} setView={setView} setActiveTab={setActiveTab} initialEmail={user?.email || ""} lockEmail backView={{ type: "edit_profile" }} />}
                    {view.type === "referral" && <ReferralPage user={user} siteSettings={siteSettings} setView={setView} />}
                    {view.type === "privacy_policy" && <PrivacyPolicyPage setView={setView} />}
                    {view.type === "faq" && <FaqPage setView={setView} />}
                    {view.type === "chat" && <ChatPage user={user} theme={theme} setView={setView} fetchUser={fetchUser} />}
                    {view.type === "settings" && <SettingsPage setView={setView} currency={currency} setCurrency={setCurrency} availableCurrencies={availableCurrencies} setSypRate={setSypRate} setCurrentCurrencySymbol={setCurrentCurrencySymbol} setUserPickedCurrency={setUserPickedCurrency} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} user={user} setThemeModal={setThemeModal} subscribeToPush={subscribeToPush} unsubscribeFromPush={unsubscribeFromPush} />}
                    {view.type === "activity_log" && <ActivityLogPage user={user} theme={theme} setView={setView} />}
                    {view.type === "user_api" && <UserApiPage user={user} theme={theme} setView={setView} />}
                    {view.type === "success" && !view.dark && <SuccessPage setView={setView} setActiveTab={setActiveTab} viewData={view.data} />}
                    {view.type === "login" && <LoginPage theme={theme} setUser={setUser} setView={setView} setActiveTab={setActiveTab} />}
                    {view.type === "forgot_password" && <ForgotPasswordPage setUser={setUser} setView={setView} setActiveTab={setActiveTab} />}
                  </>
                )}
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* نافذة تأكيد الطلب المنبثقة — تُعرض بدلاً من صفحة منفصلة عندما يختار الأدمن وضع "مودل" */}
      <AnimatePresence>
        {appearance?.checkout_mode === "modal" && (
          (view.type === "checkout" || (checkoutOrderResult && activeTab === "home") || (view.type === "quick_order" && !checkoutOrderResult))
        ) && (
          <motion.div
            key="checkout-modal-backdrop"
            initial={false}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[70] bg-transparent flex items-center justify-center p-4"
            onClick={() => { if (!checkoutOrderResult) navigateBack(); }}
          >
            <motion.div
              key="checkout-modal-panel"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              className="bg-transparent w-full sm:max-w-lg max-h-[92vh] overflow-y-auto relative"
            >
              <div>
                {(view.type === "checkout" || (checkoutOrderResult && activeTab === "home")) && (
                  <CheckoutPage view={view} user={user} siteSettings={siteSettings} theme={theme} isDarkMode={isDarkMode} isModal={true} fmtPrice={fmtPrice} setView={setView} setActiveTab={setActiveTab} fetchUser={fetchUser} fetchOrders={fetchOrders} checkoutQuantity={checkoutQuantity} setCheckoutQuantity={setCheckoutQuantity} checkoutOrderResult={checkoutOrderResult} setCheckoutOrderResult={setCheckoutOrderResult} navigateBack={navigateBack} isFavorite={isFavorite} addToFavorites={addToFavorites} removeFromFavorites={removeFromFavorites} />
                )}
                {view.type === "quick_order" && !checkoutOrderResult && (
                  <QuickOrderPage view={view} user={user} siteSettings={siteSettings} theme={theme} isDarkMode={isDarkMode} isModal={true} fmtPrice={fmtPrice} setView={setView} setActiveTab={setActiveTab} fetchUser={fetchUser} navigateBack={navigateBack} isFavorite={isFavorite} addToFavorites={addToFavorites} removeFromFavorites={removeFromFavorites} />
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomNav />

      {/* PWA Install Banner */}
      <AnimatePresence>
        {showInstallBanner && deferredPrompt && (
          <motion.div
            initial={{ opacity: 0, y: -80 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -80 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed top-0 left-0 right-0 z-[110] p-3"
          >
            <div className="bg-gray-900 text-white rounded-lg px-4 py-3 flex items-center gap-3 shadow-2xl max-w-md mx-auto">
              <div className="w-10 h-10 shrink-0 flex items-center justify-center">
                {appearance.logo_url && (
                  <img src={appearance.logo_url} alt="saraqib store" className="w-10 h-10 object-contain" />
                )}
              </div>
              <div className="flex-1 text-right">
                <p className="text-sm font-bold">تثبيت التطبيق</p>
                <p className="text-[11px] text-gray-400">هل تريد تثبيت التطبيق على جهازك؟</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={handleInstallApp}
                  className="bg-brand text-white px-3 py-1.5 rounded-lg text-xs font-bold active:scale-95 transition-all"
                >
                  تأكيد
                </button>
                <button
                  onClick={() => setShowInstallBanner(false)}
                  className="bg-white/10 text-white px-3 py-1.5 rounded-lg text-xs font-bold active:scale-95 transition-all"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Telegram Linking Modal */}
      <AnimatePresence>
        {linkingModal.isOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white dark:bg-gray-900 w-full max-w-sm rounded-lg overflow-hidden shadow-2xl"
            >
              <div className="p-8 text-center space-y-6">
                <div className="w-20 h-20 bg-[var(--brand)]/10 dark:bg-[var(--brand)]/20 text-[var(--brand)] rounded-full flex items-center justify-center mx-auto">
                  <MessageSquare size={40} />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">ربط حساب تليجرام</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">استخدم الكود التالي في البوت لربط حسابك</p>
                </div>

                <div className="flex items-stretch gap-2">
                  <div className="flex-1 bg-gray-50 dark:bg-gray-800 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg p-6 transition-colors flex items-center justify-center">
                    <span className="text-4xl font-black tracking-widest text-gray-900 dark:text-white font-mono">
                      {linkingModal.code}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(linkingModal.code);
                      showToast("تم نسخ الكود", 'success');
                    }}
                    className="shrink-0 bg-[var(--brand)] text-white px-4 rounded-lg shadow-lg hover:bg-[var(--brand-dark)] active:scale-95 transition-all flex items-center justify-center"
                    title="نسخ الكود"
                    aria-label="نسخ الكود"
                  >
                    <Copy size={20} />
                  </button>
                </div>

                <div className="flex items-center justify-center gap-2 text-orange-500 font-bold">
                  <Clock size={18} />
                  <span>
                    {Math.floor(linkingModal.timeLeft / 60)}:
                    {(linkingModal.timeLeft % 60).toString().padStart(2, '0')}
                  </span>
                </div>

                <div className="space-y-3 pt-2">
                  <button 
                    onClick={() => {
                      window.open(`https://t.me/${telegramBotStatus.bot_username}?start=${linkingModal.code}`, '_blank');
                    }}
                    className="w-full bg-[var(--brand)] hover:bg-[var(--brand-dark)] text-white py-4 rounded-lg font-bold shadow-lg shadow-[var(--brand)]/20 dark:shadow-none flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <ExternalLink size={20} />
                    فتح تليجرام
                  </button>
                  <button 
                    onClick={() => setLinkingModal(prev => ({ ...prev, isOpen: false }))}
                    className="w-full text-gray-400 dark:text-gray-500 font-bold text-sm py-2"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
        {themeModal.isOpen && <ThemeCustomizationModal />}
      </AnimatePresence>

      {/* Blocked Overlay */}
      <AnimatePresence>
        {isBlocked && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-red-600 flex flex-col items-center justify-center text-white p-6 text-center"
          >
            <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
              <XCircle size={64} />
            </div>
            <h1 className="text-3xl font-bold mb-4">{isPermanentlyBanned ? "تم إيقاف حسابك" : "لقد تم حظرك مؤقتاً"}</h1>
            <p className="text-red-100 mb-8 max-w-xs">
              {isPermanentlyBanned
                ? "تم إيقاف حسابك بشكل دائم بسبب مخالفة القوانين. يرجى التواصل مع الدعم."
                : "لقد تم تقييد وصولك للموقع بسبب مخالفة القوانين. يرجى الانتظار حتى انتهاء مدة الحظر."}
            </p>

            {!isPermanentlyBanned && (
              <div className="bg-white/10 p-6 rounded-lg border border-white/20 backdrop-blur-sm space-y-2">
                <p className="text-xs uppercase tracking-widest text-red-200 font-bold">الوقت المتبقي</p>
                <p className="text-5xl font-bold font-mono">
                  {Math.floor(blockCountdown / 60)}:{String(blockCountdown % 60).padStart(2, '0')}
                </p>
              </div>
            )}

            <button 
              onClick={() => window.location.reload()}
              className="mt-12 bg-white text-red-600 px-8 py-3 rounded-lg font-bold shadow-xl active:scale-95 transition-all"
            >
              تحديث الصفحة
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== DARK SUCCESS OVERLAY (شحن الرصيد) =====
          عالمي بغضّ النظر عن التبويب الحالي (activeTab) — لأنه overlay كامل الشاشة بالفعل
          (fixed inset-0)، وتدفقات الشحن التلقائي/الفواتير التي تُفعّله تنطلق دائماً من تبويب
          "المحفظة"، الذي لم يكن مُغطّى بأي من موضعَي SuccessPage الأصليَّين (الرئيسية والملف
          الشخصي) — لذلك كانت الشاشة لا تظهر فعلياً من قبل رغم استدعاء setView بنجاح. */}
      {view.type === "success" && view.dark && (
        <SuccessPage setView={setView} setActiveTab={setActiveTab} viewData={view.data} dark isDarkMode={isDarkMode} />
      )}

      {/* Page Loading Spinner */}
      <AnimatePresence>
        {pageLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-[90] backdrop-blur-sm flex items-center justify-center pointer-events-none ${isDarkMode ? "bg-black/70" : "bg-white/70"}`}
          >
            {appearance.loading_spinner_type === "logo_pulse" ? (
              <LogoPulseSpinner logoUrl={appearance.logo_url} />
            ) : appearance.loading_spinner_type === "logo_ring" ? (
              <LogoRingSpinner logoUrl={appearance.logo_url} />
            ) : (
              <PixelMorphSpinner />
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===== LONG PRESS FAVORITE OVERLAY ===== */}
      <AnimatePresence>
        {longPressTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center"
            style={{ background: "rgba(0,0,0,0.45)" }}
            onClick={() => setLongPressTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 22 }}
              className="bg-white rounded-lg shadow-2xl p-5 mx-6 w-72 flex flex-col items-center gap-4"
              onClick={e => e.stopPropagation()}
            >
              {/* صورة العنصر */}
              {longPressTarget._fav_image && (
                <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100">
                  <OptimizedImage
                    src={longPressTarget._fav_image}
                    width={160}
                    height={160}
                    alt={longPressTarget._fav_label}
                    className="w-full h-full object-cover"
                    draggable={false}
                    onDragStart={e => e.preventDefault()}
                    onContextMenu={e => e.preventDefault()}
                  />
                </div>
              )}
              <p className="font-bold text-gray-800 text-center text-sm">{longPressTarget._fav_label}</p>

              {isFavorite(longPressTarget._fav_key) ? (
                <div className="flex flex-col items-center gap-2 w-full">
                  <div className="flex items-center gap-1 text-yellow-500 font-bold text-sm">
                    <Star size={16} fill="currentColor" />
                    <span>موجود في المفضلة</span>
                  </div>
                  <button
                    onClick={() => { removeFromFavorites(longPressTarget._fav_key); setLongPressTarget(null); }}
                    className="w-full py-2.5 rounded-lg bg-red-50 text-red-500 font-bold text-sm"
                  >
                    إزالة من المفضلة
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => addToFavorites(longPressTarget)}
                  className={`w-full py-3 rounded-lg ${theme.button} text-white font-bold text-sm flex items-center justify-center gap-2`}
                >
                  <Star size={16} fill="currentColor" />
                  إضافة إلى المفضلة
                </button>
              )}

              {["product", "category", "subcategory", "sub_sub_category"].includes(longPressTarget._fav_type) && (
                <button
                  onClick={() => shareItem(longPressTarget)}
                  className="w-full py-3 rounded-lg bg-blue-50 text-blue-600 font-bold text-sm flex items-center justify-center gap-2"
                >
                  <Share2 size={16} />
                  {longPressTarget._fav_type === "product" ? "مشاركة رابط المنتج" : "مشاركة رابط القسم"}
                </button>
              )}

              <button
                onClick={() => setLongPressTarget(null)}
                className="text-gray-400 text-sm"
              >
                إلغاء
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* ===== END LONG PRESS OVERLAY ===== */}

      {/* ===== GOOGLE OAUTH LOADING OVERLAY ===== */}
      {/* تظهر من لحظة العودة من صفحة جوجل حتى ينجح تسجيل الدخول أو يفشل */}
      {googleAuthLoading && (
        <div className={`fixed inset-0 z-[9999] backdrop-blur-sm flex flex-col items-center justify-center gap-4 ${isDarkMode ? "bg-black/90" : "bg-white/95"}`}>
          <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-bold text-gray-700">جاري تسجيل الدخول باستخدام Google...</p>
        </div>
      )}

      {/* ===== [PHONE-GATE] مودال رقم الهاتف الإجباري بعد Google OAuth ===== */}
      {googlePhoneGate && (
        <GooglePhoneGateModal
          pending={googlePhoneGate}
          onCancel={() => setGooglePhoneGate(null)}
          onSuccess={(data) => {
            setGooglePhoneGate(null);
            setUser(data);
            if (data.token) localStorage.setItem('authToken', data.token);
            localStorage.setItem('userId', String(data.id));
            setView({ type: 'main' });
            setActiveTab('home');
            if (data.isNew) {
              const pendingReferralCode = localStorage.getItem("referralCode");
              if (pendingReferralCode && data.token) {
                fetch('/api/referrals/apply', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.token}` },
                  body: JSON.stringify({ referralCode: pendingReferralCode })
                }).then(refRes => { if (refRes.ok) localStorage.removeItem("referralCode"); }).catch(() => {});
              }
            }
          }}
        />
      )}

      {/* ===== TOAST CONTAINER ===== */}
      <ToastContainer />

      {/* ===== CUSTOM DIALOG CONTAINER ===== */}
      <CustomDialogContainer />
    </div>
  );
}
