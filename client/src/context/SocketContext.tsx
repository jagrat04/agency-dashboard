import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";
import { getAccessToken, refreshAccessToken } from "../api/client";
import { useAuth } from "./AuthContext";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

const SocketContext = createContext<Socket | null>(null);

export function SocketProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const retriedRef = useRef(false);

  useEffect(() => {
    if (!user) {
      setSocket(null);
      return;
    }

    const s = io(API_URL, {
      auth: (cb) => cb({ token: getAccessToken() }),
      withCredentials: true,
    });

    s.on("connect_error", async () => {
      if (retriedRef.current) return;
      retriedRef.current = true;
      const result = await refreshAccessToken();
      if (result) s.connect();
    });

    s.on("connect", () => {
      retriedRef.current = false;
    });

    setSocket(s);
    return () => {
      s.disconnect();
    };
  }, [user]);

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}
