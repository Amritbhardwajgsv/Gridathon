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
    <div className="flex flex-col rounded border border-[#252b35] bg-[#10141b]">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[#252b35] px-4 py-2.5">
        <MessageSquare className="h-3.5 w-3.5 text-[#e8a034]" />
        <span className="mono-id text-[#e8a034]">
          {isAdmin ? "COMMAND CENTRE CHAT" : "FIELD CHAT — COMMAND CENTRE"}
        </span>
        <span className="ml-auto flex items-center gap-1 text-[10px]">
          {connected ? (
            <>
              <Wifi className="h-3 w-3 text-[#35b779]" />
              <span className="text-[#35b779]">Live</span>
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
      <div className="flex h-56 flex-col gap-2 overflow-y-auto px-3 py-3">
        {error && (
          <div className="text-center text-[11px] text-[#e05252]">{error}</div>
        )}

        {messages.length === 0 && !error && (
          <div className="m-auto text-center text-[11px] text-[#394252]">
            No messages yet.
            <br />
            {isAdmin
              ? "Send a brief to the field officer."
              : "Command Centre messages will appear here."}
          </div>
        )}

        {messages.map((msg) => {
          const isMine = msg.sender_name === myName || msg.sender_role === myRole;
          const isCommand = msg.sender_role === "admin";

          return (
            <div
              className={`flex flex-col gap-0.5 ${isMine ? "items-end" : "items-start"}`}
              key={msg.id}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-[10px] font-semibold ${
                    isCommand ? "text-[#e8a034]" : "text-[#19b7a5]"
                  }`}
                >
                  {isCommand ? "Command Centre" : msg.sender_name}
                </span>
                <span className="text-[9px] text-[#394252]">
                  {formatTime(msg.sent_at)}
                </span>
              </div>
              <div
                className={`max-w-[80%] rounded px-3 py-1.5 text-[12px] leading-5 ${
                  isMine
                    ? "bg-[#1a2030] text-[#dce2ea]"
                    : isCommand
                    ? "bg-[#17120a] text-[#f5dba0]"
                    : "bg-[#0d1a18] text-[#a5ede5]"
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
      <div className="flex items-end gap-2 border-t border-[#252b35] px-3 py-2">
        <textarea
          className="min-h-[36px] flex-1 resize-none rounded border border-[#252b35] bg-[#181e28] px-3 py-2 text-[12px] text-[#dce2ea] placeholder-[#394252] outline-none focus:border-[#e8a034]/50"
          disabled={!connected}
          maxLength={500}
          onKeyDown={handleKey}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={connected ? "Type a message… (Enter to send)" : "Connecting…"}
          rows={1}
          value={draft}
        />
        <button
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-[#e8a034] text-[#0b0f17] transition-opacity disabled:opacity-40"
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
