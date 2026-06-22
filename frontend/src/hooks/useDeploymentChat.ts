"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import api from "@/lib/api";
import { getStoredToken } from "@/lib/auth";

export type ChatMessage = {
  id: string;
  deployment_id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  message: string;
  sent_at: string;
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

  const wsRef      = useRef<WebSocket | null>(null);
  const retryRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);
  const retryCount = useRef(0);

  const connectWithToken = useCallback((token: string | null) => {
    if (!deploymentId || !mountedRef.current) return;

    const qs  = token ? `?token=${encodeURIComponent(token)}` : "";
    const url = `${WS_BASE}/ws/chat/${encodeURIComponent(deploymentId)}${qs}`;
    const ws  = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      retryCount.current = 0;
      setState(s => ({ ...s, connected: true, error: null }));
      // Keep Render's proxy alive — it kills idle WS after ~55s
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
      }, 30_000);
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
          setState(s => {
            if (s.messages.some(m => m.id === msg.id)) return s;
            return { ...s, messages: [...s.messages, msg] };
          });
        }
      } catch { /* ignore malformed frames */ }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      if (pingRef.current) { clearInterval(pingRef.current); pingRef.current = null; }
      setState(s => ({ ...s, connected: false }));
      const delay = Math.min(1000 * 2 ** retryCount.current, 16_000);
      retryCount.current += 1;
      retryRef.current = setTimeout(connect, delay);
    };

    ws.onerror = () => {
      if (!mountedRef.current) return;
      setState(s => ({ ...s, error: "Connection error — retrying…" }));
    };
  }, [deploymentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const connect = useCallback(() => {
    if (!deploymentId || !mountedRef.current) return;

    // Prefer the token belonging to the currently validated cookie session.
    // localStorage can outlive a JWT and otherwise cause endless 403 retries.
    api.get<{ token: string | null }>("/auth/ws-token")
      .then(r => { if (mountedRef.current) connectWithToken(r.data.token); })
      .catch(() => {
        if (mountedRef.current) connectWithToken(getStoredToken());
      });
  }, [deploymentId, connectWithToken]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (retryRef.current) clearTimeout(retryRef.current);
      if (pingRef.current) clearInterval(pingRef.current);
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
