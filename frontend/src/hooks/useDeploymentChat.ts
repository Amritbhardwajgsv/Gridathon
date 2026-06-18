"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ChatMessage = {
  id: string;
  deployment_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;   // "admin" | "operator" | "viewer"
  message: string;
  sent_at: string;       // ISO string
};

type State = {
  messages: ChatMessage[];
  connected: boolean;
  error: string | null;
};

const WS_BASE =
  (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000")
    .replace(/^http/, "ws");   // http→ws, https→wss

export function useDeploymentChat(deploymentId: string | null) {
  const [state, setState] = useState<State>({
    messages: [],
    connected: false,
    error: null,
  });

  const wsRef        = useRef<WebSocket | null>(null);
  const retryRef     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef   = useRef(true);
  const retryCount   = useRef(0);

  const connect = useCallback(() => {
    if (!deploymentId || !mountedRef.current) return;

    const token = typeof window !== "undefined"
      ? localStorage.getItem("drishti_access_token")
      : null;
    if (!token) return;

    const url = `${WS_BASE}/ws/chat/${encodeURIComponent(deploymentId)}?token=${encodeURIComponent(token)}`;
    const ws  = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      retryCount.current = 0;
      setState(s => ({ ...s, connected: true, error: null }));
    };

    ws.onmessage = (evt) => {
      if (!mountedRef.current) return;
      try {
        const data = JSON.parse(evt.data as string) as
          | { type: "history"; messages: ChatMessage[] }
          | { type: "message" } & ChatMessage;

        if (data.type === "history") {
          setState(s => ({ ...s, messages: data.messages }));
        } else if (data.type === "message") {
          const msg = data as unknown as ChatMessage;
          setState(s => ({ ...s, messages: [...s.messages, msg] }));
        }
      } catch { /* ignore malformed frames */ }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setState(s => ({ ...s, connected: false }));
      // Exponential back-off: 1s, 2s, 4s … capped at 16s
      const delay = Math.min(1000 * 2 ** retryCount.current, 16_000);
      retryCount.current += 1;
      retryRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      if (!mountedRef.current) return;
      setState(s => ({ ...s, error: "Connection error — retrying…" }));
    };
  }, [deploymentId]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (retryRef.current) clearTimeout(retryRef.current);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  const send = useCallback((message: string) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({ message }));
  }, []);

  return { ...state, send };
}
