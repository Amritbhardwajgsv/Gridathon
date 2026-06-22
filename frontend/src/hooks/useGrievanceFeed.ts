import { useEffect, useRef, useCallback } from "react";

interface GrievanceEvent {
  type: string;
  tracking_id?: string;
  complaint_type?: string;
  severity?: string;
  location?: string;
  zone?: string;
  created_at?: string;
}

export function useGrievanceFeed(onNew: (event: GrievanceEvent) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const onNewRef = useRef(onNew);
  onNewRef.current = onNew;

  const connect = useCallback(() => {
    const token = localStorage.getItem("token") || "";
    const base = (process.env.NEXT_PUBLIC_API_URL || "https://gridathon-production.up.railway.app")
      .replace(/^https/, "wss")
      .replace(/^http/, "ws");
    const ws = new WebSocket(`${base}/ws/grievances?token=${token}`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const data: GrievanceEvent = JSON.parse(e.data);
        if (data.type === "new_grievance") onNewRef.current(data);
      } catch {}
    };

    ws.onclose = () => {
      setTimeout(connect, 3000);
    };

    const ping = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
    }, 25000);

    ws.onerror = () => {
      clearInterval(ping);
      ws.close();
    };

    return () => {
      clearInterval(ping);
      ws.close();
    };
  }, []);

  useEffect(() => {
    const cleanup = connect();
    return cleanup;
  }, [connect]);
}
