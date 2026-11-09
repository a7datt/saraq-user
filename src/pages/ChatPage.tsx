import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { uploadImage } from "../utils/uploadImage";
import {
  ArrowRight,
  ArrowLeft,
  User,
  Send,
  X,
  Image as ImageIcon,
  MessageSquare,
  Bot,
  Star,
  CheckCheck,
  ChevronUp,
} from "lucide-react";
import { showToast } from "../components/ToastContainer";
import { UserData } from "../types";
import OptimizedImage from "../components/OptimizedImage";

interface Theme {
  button: string;
}

export interface ChatPageProps {
  user: UserData | null;
  theme: Theme;
  setView: (val: any) => void;
  fetchUser: (id: number) => void;
}

interface Message {
  id: number | string;
  sender_role: "user" | "admin";
  content: string;
  image_url?: string;
  type?: string;
  created_at: string;
  is_read?: boolean;
}

export default function ChatPage({ user, theme, setView, fetchUser }: ChatPageProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rating, setRating] = useState(0);
  const [faqs, setFaqs] = useState<any[]>([]);
  const [showFaqs, setShowFaqs] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCountRef = useRef<number>(0);

  const getGuestId = () => {
    let gid = localStorage.getItem("guest_id");
    if (!gid) {
      // [SECURITY FIX — CWE-330] guest_id يُستخدم كتوكن وصول وحيد لقراءة محادثة الضيف بلا أي
      // مصادقة أخرى، فيجب أن يكون غير قابل للتنبؤ (CSPRNG) بدل Math.random
      gid = `guest_${crypto.randomUUID()}`;
      localStorage.setItem("guest_id", gid);
    }
    return gid;
  };

  const scrollToBottom = useCallback((smooth = false) => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    }
  }, []);

  const fetchMessages = useCallback(async (silent = false) => {
    try {
      const token = localStorage.getItem("authToken") || "";
      const guestId = getGuestId();
      const url = user
        ? `/api/chat/messages?user_id=${user.id}`
        : `/api/chat/messages?guest_id=${guestId}`;
      const res = await fetch(url, {
        headers: user && token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return;
      const raw = await res.json();
      const data: Message[] = Array.isArray(raw) ? raw : [];

      setMessages((prev) => {
        const prevIds = prev.map((m) => m.id).join(",");
        const newIds = data.map((m) => m.id).join(",");
        if (prevIds === newIds) return prev;
        lastCountRef.current = data.length;
        return data;
      });

      // mark read
      const hasUnread = data.some(
        (m) => m.sender_role === "admin" && !m.is_read
      );
      if (hasUnread && user) {
        fetch("/api/chat/mark-read", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ userId: user.id }),
        }).catch(() => {});
        fetchUser(user.id);
      }
    } catch {
      // silent network errors
    }
  }, [user, fetchUser]);

  const fetchFaqs = useCallback(async () => {
    try {
      const res = await fetch("/api/faqs");
      if (!res.ok) return;
      const data = await res.json();
      setFaqs(Array.isArray(data) ? data : []);
    } catch {}
  }, []);

  // initial load
  useEffect(() => {
    fetchMessages(false);
    fetchFaqs();
  }, []);

  // smart polling — only updates state if IDs changed
  useEffect(() => {
    pollRef.current = setInterval(() => fetchMessages(true), 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchMessages]);

  // auto-show FAQs when no messages
  useEffect(() => {
    if (messages.length === 0 && faqs.length > 0) {
      setShowFaqs(true);
    }
  }, [faqs]);

  // scroll to bottom: instant on first load, smooth on new messages
  const isFirstLoad = useRef(true);
  useLayoutEffect(() => {
    if (messages.length > 0) {
      if (isFirstLoad.current) {
        // instant scroll before first paint — no animation
        if (messagesEndRef.current) {
          messagesEndRef.current.scrollIntoView({ behavior: "instant" as ScrollBehavior });
        }
        isFirstLoad.current = false;
      } else {
        scrollToBottom(true);
      }
    }
  }, [messages.length]);

  const handleSend = useCallback(
    async (
      content?: string,
      imageUrl?: string,
      type = "text",
      ratingVal?: number
    ) => {
      const guestId = getGuestId();
      if (!user && !guestId) return;
      if (!content && !imageUrl && type === "text") return;

      // optimistic: add temp message
      const tempId = `temp_${Date.now()}`;
      const tempMsg: Message = {
        id: tempId,
        sender_role: "user",
        content: content || "",
        image_url: imageUrl,
        type,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempMsg]);
      setNewMessage("");
      setSending(true);
      setIsTyping(true);

      try {
        const res = await fetch("/api/chat/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`,
          },
          body: JSON.stringify({
            user_id: user ? user.id : null,
            guest_id: user ? null : guestId,
            sender_role: "user",
            content: content || "",
            image_url: imageUrl || "",
            type,
            rating: ratingVal,
          }),
        });

        if (res.ok) {
          // small delay so typing indicator is visible even on fast responses
          await new Promise((r) => setTimeout(r, 600));
          setIsTyping(false);
          // replace temp with real data
          await fetchMessages(true);
        } else {
          setIsTyping(false);
          // remove temp on failure
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
          const data = await res.json().catch(() => ({}));
          showToast(data.error || "فشل الإرسال", "error");
        }
      } catch {
        setIsTyping(false);
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        showToast("خطأ في الاتصال", "error");
      } finally {
        setSending(false);
      }
    },
    [user, fetchMessages]
  );

  const handleFaqClick = async (faq: any) => {
    setShowFaqs(false);
    const guestId = getGuestId();

    const tempUser: Message = {
      id: `tmp_faq_u_${Date.now()}`,
      sender_role: "user",
      content: faq.trigger_text,
      created_at: new Date().toISOString(),
    };
    const tempBot: Message = {
      id: `tmp_faq_b_${Date.now()}`,
      sender_role: "admin",
      content: faq.reply_text,
      type: "bot_reply",
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUser, tempBot]);

    try {
      await fetch("/api/chat/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`,
        },
        body: JSON.stringify({
          user_id: user ? user.id : null,
          guest_id: user ? null : guestId,
          sender_role: "user",
          content: faq.trigger_text,
          image_url: "",
          type: "text",
        }),
      });
      await fetch("/api/chat/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`,
        },
        body: JSON.stringify({
          user_id: user ? user.id : null,
          guest_id: user ? null : guestId,
          sender_role: "admin",
          content: faq.reply_text,
          image_url: "",
          type: "bot_reply",
        }),
      });
      await fetchMessages(true);
    } catch {}
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const confirmAndSendImage = async () => {
    if (!selectedFile) return;
    setUploading(true);
    try {
      const url = await uploadImage(selectedFile);
      setImagePreview(null);
      setSelectedFile(null);
      await handleSend("", url);
    } catch {
      showToast("فشل رفع الصورة", "error");
    } finally {
      setUploading(false);
    }
  };

  const formatTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const hh = String(d.getHours()).padStart(2, "0");
      const min = String(d.getMinutes()).padStart(2, "0");
      return `${yyyy}/${mm}/${dd} ${hh}:${min}`;
    } catch {
      return "";
    }
  };

  return createPortal(
    <div className="fixed inset-0 bottom-16 z-[60] flex flex-col bg-[#F0F2F5] overflow-hidden" dir="rtl">
      {/* ─── Header ─── */}
      <div className="bg-white flex items-center gap-3 px-4 py-3 shadow-sm shrink-0 border-b border-gray-100" dir="rtl">
        <button
          onClick={() => setView({ type: "main" })}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center shrink-0">
          <User size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-800 text-sm leading-tight">
            الدعم الفني
          </h3>
          <p className="text-[11px] text-green-500 font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse inline-block" />
            متصل الآن
          </p>
        </div>
      </div>

      {/* ─── Messages ─── */}
      <div
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-2"
        style={{ overscrollBehavior: "contain" }}
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-16 text-gray-400">
            <MessageSquare size={48} className="mb-3 opacity-20" />
            <p className="font-bold text-sm">ابدأ محادثتك مع الدعم الفني</p>
          </div>
        )}

        {messages.map((m) => {
          const isUser = m.sender_role === "user";
          const isTemp = String(m.id).startsWith("temp_") || String(m.id).startsWith("tmp_");

          return (
            <div
              key={m.id}
              className={`flex ${isUser ? "justify-start" : "justify-end"} items-start gap-2`}
            >
              {/* avatar for admin */}
              {!isUser && (
                <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center shrink-0 mt-1">
                  <User size={14} />
                </div>
              )}

              <div
                className={`
                  max-w-[78%] px-3 py-2 rounded-2xl shadow-sm
                  ${isUser
                    ? "bg-[var(--brand)] text-white rounded-bl-sm"
                    : "bg-white text-gray-800 rounded-br-sm"
                  }
                  ${isTemp ? "opacity-75" : "opacity-100"}
                `}
                style={{ transition: "opacity 0.2s" }}
              >
                {/* bot label */}
                {m.type === "bot_reply" && (
                  <div className="flex items-center gap-1 mb-1 opacity-60">
                    <Bot size={10} />
                    <span className="text-[9px] font-bold">رد تلقائي</span>
                  </div>
                )}

                {/* image */}
                {m.image_url && (
                  <OptimizedImage
                    src={m.image_url}
                    width={320}
                    quality={80}
                    alt="صورة"
                    className="rounded-xl mb-1.5 max-w-full max-h-64 object-contain bg-black/5"
                  />
                )}

                {/* rating widget */}
                {m.type === "rating_request" ? (
                  <div className="text-center py-1">
                    <p className="text-xs font-bold mb-2 leading-snug">
                      {m.content}
                    </p>
                    <div className="flex items-center justify-center gap-1.5 mb-3">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => setRating(star)}
                          className={`transition-transform active:scale-110 ${
                            rating >= star
                              ? "text-yellow-400"
                              : "text-gray-300"
                          }`}
                        >
                          <Star
                            size={22}
                            fill={rating >= star ? "currentColor" : "none"}
                          />
                        </button>
                      ))}
                    </div>
                    <button
                      disabled={rating === 0}
                      onClick={() => {
                        handleSend(
                          `تم تقييم الدردشة بـ ${rating} نجوم`,
                          "",
                          "rating_response",
                          rating
                        );
                        setRating(0);
                      }}
                      className="w-full py-1.5 bg-white text-[var(--brand)] rounded-lg text-xs font-bold disabled:opacity-40 active:scale-95 transition-all"
                    >
                      تأكيد التقييم
                    </button>
                  </div>
                ) : (
                  m.content && (
                    <p className="text-sm leading-relaxed break-words">
                      {m.content}
                    </p>
                  )
                )}

                {/* time + tick */}
                <div
                  className={`flex items-center gap-1 mt-0.5 ${isUser ? "justify-start" : "justify-end"}`}
                >
                  <span
                    className={`text-[10px] ${
                      isUser ? "text-white/60" : "text-gray-400"
                    }`}
                  >
                    {formatTime(m.created_at)}
                  </span>
                  {isUser && !isTemp && (
                    <CheckCheck size={12} className="text-white/70" />
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* ─── Typing Indicator ─── */}
        {isTyping && (
          <div className="flex justify-end items-end gap-2 animate-fade-in">
            <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center shrink-0">
              <User size={14} />
            </div>
            <div className="bg-white text-gray-800 px-4 py-3 rounded-2xl rounded-br-sm shadow-sm flex items-center gap-1.5">
              <span
                className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                style={{ animationDelay: "0ms" }}
              />
              <span
                className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                style={{ animationDelay: "150ms" }}
              />
              <span
                className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                style={{ animationDelay: "300ms" }}
              />
            </div>
          </div>
        )}

        {/* scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* ─── FAQ Panel ─── */}
      {showFaqs && faqs.length > 0 && (
        <div className="mx-3 mb-2 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden shrink-0">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50/80">
            <span className="font-bold text-sm text-gray-700 flex items-center gap-2">
              <MessageSquare size={14} className="text-[var(--brand)]" />
              الأسئلة الشائعة
            </span>
            <button
              onClick={() => setShowFaqs(false)}
              className="text-gray-400 hover:text-gray-600 p-1"
            >
              <X size={16} />
            </button>
          </div>
          <div className="p-2 max-h-52 overflow-y-auto space-y-1">
            {faqs.map((faq: any) => (
              <button
                key={faq.id}
                onClick={() => handleFaqClick(faq)}
                className="w-full text-right px-3 py-2.5 bg-gray-50 hover:bg-blue-50 hover:text-[var(--brand)] rounded-xl text-sm font-bold text-gray-700 transition-colors active:scale-[0.98]"
              >
                {faq.trigger_text}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── Input Bar ─── */}
      <div className="bg-white border-t border-gray-100 px-3 py-2.5 flex items-center gap-2 shrink-0" dir="rtl">
        {/* FAQ toggle */}
        {faqs.length > 0 && (
          <button
            onClick={() => setShowFaqs((v) => !v)}
            className={`p-2 rounded-full transition-colors shrink-0 ${
              showFaqs
                ? "bg-[var(--brand)] text-white"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
            title="الأسئلة الشائعة"
          >
            <ChevronUp size={18} />
          </button>
        )}

        {/* image upload */}
        <label className="p-2 rounded-full bg-gray-100 text-gray-500 cursor-pointer hover:bg-gray-200 transition-colors shrink-0">
          <ImageIcon size={18} />
          <input
            type="file"
            className="hidden"
            accept="image/*"
            onChange={handleImageSelect}
            disabled={uploading}
          />
        </label>

        {/* text input */}
        <input
          ref={inputRef}
          type="text"
          dir="rtl"
          placeholder="اكتب رسالتك..."
          className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-[var(--brand)]/30 transition-all min-w-0"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend(newMessage);
            }
          }}
          disabled={sending}
        />

        {/* send */}
        <button
          onClick={() => handleSend(newMessage)}
          disabled={sending || uploading || !newMessage.trim()}
          className={`p-2.5 ${theme.button} text-white rounded-full shadow-sm disabled:opacity-40 active:scale-90 transition-all shrink-0`}
        >
          {sending ? (
            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <Send size={16} />
          )}
        </button>
      </div>

      {/* ─── Image Preview Modal ─── */}
      {imagePreview && (
        <div className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-800 text-sm">معاينة الصورة</h3>
              <button
                onClick={() => {
                  setImagePreview(null);
                  setSelectedFile(null);
                }}
                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4">
              <img
                src={imagePreview}
                alt="معاينة"
                className="w-full max-h-64 object-contain rounded-xl bg-gray-50"
              />
            </div>
            <div className="px-4 pb-4">
              <button
                onClick={confirmAndSendImage}
                disabled={uploading}
                className={`w-full py-3 ${theme.button} text-white rounded-xl font-bold flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.98] transition-all`}
              >
                {uploading ? (
                  <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Send size={16} />
                    إرسال الصورة
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
