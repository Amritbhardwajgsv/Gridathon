"use client";

import { MessageSquare, Send, Wifi, WifiOff } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useDeploymentChat } from "@/hooks/useDeploymentChat";

type Props = {
  deploymentId: string;
  /** Role of the current user — determines message bubble alignment */
  myRole: string;
  /** Display name of the current user */
  myName: string;
};

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function ChatPanel({ deploymentId, myRole, myName }: Props) {
  const { messages, connected, error, send } = useDeploymentChat(deploymentId);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleSend() {
    const text = draft.trim();
    if (!text) return;
    send(text);
    setDraft("");
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const isAdmin = myRole === "admin";

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-[#f2c9b6] bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[#f2d8ca] bg-[#fff8f2] px-4 py-3">
        <MessageSquare className="h-3.5 w-3.5 text-[#f47f5f]" />
        <span className="mono-id text-[#9b604b]">
          {isAdmin ? "COMMAND CENTRE CHAT" : "FIELD CHAT — COMMAND CENTRE"}
        </span>
        <span className="ml-auto flex items-center gap-1 text-[10px]">
          {connected ? (
            <>
              <Wifi className="h-3 w-3 text-[#169b68]" />
              <span className="font-semibold text-[#169b68]">Live</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3 text-[#707987]" />
              <span className="text-[#707987]">Reconnecting…</span>
            </>
          )}
        </span>
      </div>

      {/* Messages */}
      <div className="flex h-52 flex-col gap-3 overflow-y-auto bg-white px-4 py-4">
        {error && (
          <div className="text-center text-[11px] text-[#e05252]">{error}</div>
        )}

        {messages.length === 0 && !error && (
          <div className="m-auto text-center text-[11px] leading-5 text-[#a88778]">
            No messages yet.
            <br />
            {isAdmin
              ? "Send a brief to the field officer."
              : "Command Centre messages will appear here."}
          </div>
        )}

        {messages.map((msg) => {
          const isMine = msg.sender_name === myName;
          const isCommand = msg.sender_role === "admin";

          return (
            <div
              className={`flex flex-col gap-0.5 ${isMine ? "items-end" : "items-start"}`}
              key={msg.id}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-[10px] font-semibold ${
                    isCommand ? "text-[#d66a45]" : "text-[#16866c]"
                  }`}
                >
                  {isCommand ? "Command Centre" : msg.sender_name}
                </span>
                <span className="text-[9px] text-[#a88778]">
                  {formatTime(msg.sent_at)}
                </span>
              </div>
              <div
                className={`max-w-[85%] whitespace-pre-wrap break-words rounded-xl border px-3 py-2 text-[12px] leading-5 ${
                  isMine
                    ? "border-[#f47f5f]/35 bg-[#fff0e8] text-[#342018]"
                    : isCommand
                    ? "border-[#e8c850]/45 bg-[#fff8d8] text-[#342018]"
                    : "border-[#7dcdb1]/45 bg-[#eefbf6] text-[#244b3d]"
                }`}
              >
                {msg.message}
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex items-end gap-2 border-t border-[#f2d8ca] bg-[#fff8f2] p-3">
        <textarea
          className="min-h-[40px] flex-1 resize-none rounded-lg border border-[#e8b9a1] bg-white px-3 py-2.5 text-[12px] text-[#342018] placeholder:text-[#a88778] outline-none transition focus:border-[#f47f5f] focus:ring-2 focus:ring-[#f47f5f]/10"
          disabled={!connected}
          maxLength={500}
          onKeyDown={handleKey}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={connected ? "Type a message… (Enter to send)" : "Connecting…"}
          rows={1}
          value={draft}
        />
        <button
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#f47f5f] text-white transition hover:bg-[#df6d4f] disabled:opacity-40"
          disabled={!connected || !draft.trim()}
          onClick={handleSend}
          type="button"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
