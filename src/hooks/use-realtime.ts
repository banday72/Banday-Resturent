"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";

type Options = {
  token?: string | null;
  events: string[];
  onEvent: (event: string, payload: unknown) => void;
};

export function useRealtime({ token, events, onEvent }: Options) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;
  const eventsKey = events.join(",");
  const realtimeUrl = process.env.NEXT_PUBLIC_REALTIME_URL;

  useEffect(() => {
    if (!token || !realtimeUrl) return;
    const socket: Socket = io(realtimeUrl, {
      auth: { token },
      transports: ["websocket", "polling"],
    });
    const list = eventsKey ? eventsKey.split(",") : [];
    list.forEach((event) => {
      socket.on(event, (payload: unknown) => handlerRef.current(event, payload));
    });
    return () => {
      socket.disconnect();
    };
  }, [token, eventsKey, realtimeUrl]);
}
