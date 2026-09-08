import { useState } from "react";
import RoomJoin from "./components/RoomJoin.jsx";
import Classroom from "./components/Classroom.jsx";

export default function App() {
  const [session, setSession] = useState(() => {
    try {
      const saved = localStorage.getItem("mathboard_session");
      const parsed = saved ? JSON.parse(saved) : null;
      if (parsed && parsed.roomCode && parsed.role) return parsed;
      return null;
    } catch {
      return null;
    }
  });

  const handleJoin = (newSession) => {
    try {
      localStorage.setItem("mathboard_session", JSON.stringify(newSession));
    } catch {}
    setSession(newSession);
  };

  const handleLeave = () => {
    try {
      localStorage.removeItem("mathboard_session");
    } catch {}
    setSession(null);
  };

  if (!session) {
    return <RoomJoin onJoin={handleJoin} />;
  }

  return (
    <Classroom
      roomCode={session.roomCode}
      role={session.role}
      userName={session.userName}
      onLeave={handleLeave}
    />
  );
}