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

  useEffect(() => {
    if (!token) return;
    const socket: Socket = io({
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
  }, [token, eventsKey]);
}
