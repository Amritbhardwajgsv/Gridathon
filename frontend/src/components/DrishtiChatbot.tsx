"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Send, X, ChevronDown, Sparkles } from "lucide-react";

type Message = { role: "user" | "bot"; text: string };

const QUICK = [
  "How do I report a traffic incident?",
  "How does the AI triage work?",
  "How do I track my complaint?",
  "What is DRISHTI?",
];

const WELCOME: Message = {
  role: "bot",
  text: "Hi! I'm DRISHTI AI 👋 Ask me how this system works, how to report an incident, or anything about Bengaluru Traffic Police operations.",
};

export default function DrishtiChatbot() {
  const [open,     setOpen]     = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME]);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(false);
  const bottomRef              = useRef<HTMLDivElement>(null);
  const inputRef               = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 250);
  }, [open]);

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || loading) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: msg }]);
    setLoading(true);

    try {
      const base = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");
      const res  = await fetch(`${base}/citizen/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json();
      setMessages((m) => [...m, { role: "bot", text: data.reply ?? "Sorry, I couldn't get a response." }]);
    } catch {
      setMessages((m) => [...m, { role: "bot", text: "Network error — please try again." }]);
    } finally {
      setLoading(false);
    }
  }

  const showQuick = messages.length === 1;

  return (
    <>
      {/* ── Floating trigger button ───────────────────────────────────────── */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close DRISHTI Assistant" : "Open DRISHTI Assistant"}
        className="fixed bottom-6 left-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-xl transition-all duration-200 hover:scale-105 active:scale-95"
        style={{ background: "#FFE600", border: "2.5px solid rgba(0,0,0,0.08)" }}
      >
        {open
          ? <ChevronDown className="h-5 w-5 text-[#08080F]" />
          : <Bot className="h-6 w-6 text-[#08080F]" />
        }
      </button>

      {/* ── Chat panel ───────────────────────────────────────────────────── */}
      {open && (
        <div
          className="chat-panel-enter fixed bottom-24 left-6 z-50 flex w-[340px] flex-col overflow-hidden rounded-2xl shadow-2xl"
          style={{
            background: "#FFFAF6",
            border: "2px solid #F2D8CA",
            maxHeight: "520px",
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ background: "#FFE600", borderBottom: "2px solid rgba(0,0,0,0.08)" }}
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#08080F]" />
              <div>
                <div className="font-mono text-[11px] font-black uppercase tracking-[0.16em] text-[#08080F]">
                  DRISHTI AI
                </div>
                <div className="text-[9px] font-semibold text-[#08080F]/60 uppercase tracking-[0.1em]">
                  Bengaluru Traffic Ops
                </div>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-full transition hover:bg-black/10"
              aria-label="Close chat"
            >
              <X className="h-4 w-4 text-[#08080F]" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2" style={{ minHeight: 0 }}>
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className="max-w-[82%] rounded-2xl px-3 py-2 text-[12px] leading-[1.55]"
                  style={
                    m.role === "user"
                      ? { background: "#FFE600", color: "#08080F", fontWeight: 600, borderBottomRightRadius: 4 }
                      : { background: "#FFF0E8", color: "#342018", border: "1.5px solid #F2D8CA", borderBottomLeftRadius: 4 }
                  }
                >
                  {m.text}
                </div>
              </div>
            ))}

            {/* Quick suggestions */}
            {showQuick && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {QUICK.map((q) => (
                  <button
                    key={q}
                    onClick={() => send(q)}
                    className="rounded-full px-3 py-1 text-[10px] font-semibold transition hover:bg-[#f47f5f]/10"
                    style={{ border: "1.5px solid #F2D8CA", color: "#795b4e", background: "#fff" }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Typing indicator */}
            {loading && (
              <div className="flex justify-start">
                <div
                  className="flex items-center gap-1 rounded-2xl px-3 py-2"
                  style={{ background: "#FFF0E8", border: "1.5px solid #F2D8CA", borderBottomLeftRadius: 4 }}
                >
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[#f47f5f]" />
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[#f47f5f]" />
                  <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[#f47f5f]" />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input bar */}
          <div
            className="flex items-center gap-2 px-3 py-2.5"
            style={{ borderTop: "2px solid #F2D8CA", background: "#FFFAF6" }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send(input)}
              placeholder="Ask about DRISHTI…"
              disabled={loading}
              className="flex-1 rounded-full border-2 bg-white px-3 py-1.5 text-[12px] outline-none transition"
              style={{
                borderColor: "#F2D8CA",
                color: "#342018",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#FFE600")}
              onBlur={(e) => (e.target.style.borderColor = "#F2D8CA")}
            />
            <button
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition hover:opacity-80 active:scale-95 disabled:opacity-40"
              style={{ background: "#FFE600" }}
              aria-label="Send"
            >
              <Send className="h-3.5 w-3.5 text-[#08080F]" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
