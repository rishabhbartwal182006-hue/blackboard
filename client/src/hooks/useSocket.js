import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "";

export function useSocket(roomCode, role, userName) {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [userId, setUserId] = useState(null);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (!roomCode) return;

    const socket = io(SERVER_URL, {
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      socket.emit("join-room", { roomCode, role, userName });
    });

    socket.on("disconnect", () => setConnected(false));

    socket.on("room:joined", ({ userId: uid, users: u }) => {
      setUserId(uid);
      setUsers(u);
    });

    socket.on("user:joined", (user) => {
      setUsers((prev) => {
        if (prev.find((u) => u.userId === user.userId)) return prev;
        return [...prev, user];
      });
    });

    socket.on("user:left", ({ userId: uid }) => {
      setUsers((prev) => prev.filter((u) => u.userId !== uid));
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [roomCode, role, userName]);

  return { socket: socketRef.current, connected, userId, users };
}