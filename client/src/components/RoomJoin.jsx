import { useState } from "react";

const COLORS = ["#6366f1", "#ec4899", "#10b981", "#f59e0b", "#3b82f6"];
const ROOM_CODE_REGEX = /^[A-Z0-9]{4,8}$/;

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

export default function RoomJoin({ onJoin }) {
  const [mode, setMode] = useState("home"); // home | create | join
  const [role, setRole] = useState("teacher");
  const [roomCode, setRoomCode] = useState("");
  const [userName, setUserName] = useState("");
  const [generatedCode, setGeneratedCode] = useState("");
  const [error, setError] = useState("");

  const handleCreate = () => {
    if (!userName.trim()) { setError("Please enter your name."); return; }
    const code = generateCode();
    setGeneratedCode(code);
    setMode("created");
  };

  const handleJoinCreated = () => {
    onJoin({ roomCode: generatedCode, role: "teacher", userName: userName.trim() });
  };

  const handleJoin = () => {
    setError("");
    if (!userName.trim()) { setError("Please enter your name."); return; }
    const code = roomCode.toUpperCase().trim();
    if (!ROOM_CODE_REGEX.test(code)) {
      setError("Enter a valid 4-8 character room code.");
      return;
    }
    onJoin({ roomCode: code, role, userName: userName.trim() });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {COLORS.map((c, i) => (
          <div key={i} className="absolute rounded-full opacity-10 blur-3xl"
            style={{ background: c, width: 300, height: 300,
              left: `${[10,70,20,60,40][i]}%`, top: `${[10,20,60,70,40][i]}%`,
              transform: "translate(-50%,-50%)" }} />
        ))}
      </div>

      <div className="relative w-full max-w-md animate-fadeIn">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-600 mb-4 shadow-lg shadow-indigo-900/50">
            <svg className="w-9 h-9 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white">MathBoard</h1>
          <p className="text-slate-400 mt-1 text-sm">Real-time collaborative math teaching</p>
        </div>

        {/* Card */}
        <div className="bg-slate-800/80 backdrop-blur rounded-2xl border border-slate-700/50 p-6 shadow-2xl">

          {mode === "home" && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Your Name</label>
                <input
                  type="text" value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Enter your name..."
                  className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button onClick={handleCreate}
                  className="flex flex-col items-center gap-2 p-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl transition-colors text-white font-medium">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                  <span>Create Room</span>
                  <span className="text-xs opacity-70 font-normal">As Teacher</span>
                </button>
                <button onClick={() => { if (!userName.trim()) { setError("Enter your name first."); return; } setError(""); setMode("join"); }}
                  className="flex flex-col items-center gap-2 p-4 bg-slate-700 hover:bg-slate-600 rounded-xl transition-colors text-white font-medium">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3"/>
                  </svg>
                  <span>Join Room</span>
                  <span className="text-xs opacity-70 font-normal">As Student</span>
                </button>
              </div>
            </div>
          )}

          {mode === "created" && (
            <div className="text-center space-y-5">
              <div>
                <p className="text-slate-400 text-sm mb-2">Your classroom room code</p>
                <div className="inline-block bg-slate-700 border border-slate-600 rounded-xl px-8 py-4">
                  <span className="text-4xl font-bold tracking-widest text-indigo-300 font-mono">{generatedCode}</span>
                </div>
                <p className="text-slate-500 text-xs mt-2">Share this code with your students</p>
              </div>
              <button
                onClick={() => navigator.clipboard?.writeText(generatedCode)}
                className="text-sm text-indigo-400 hover:text-indigo-300 flex items-center gap-1.5 mx-auto">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
                Copy code
              </button>
              <button onClick={handleJoinCreated}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-semibold transition-colors">
                Enter Classroom →
              </button>
              <button onClick={() => setMode("home")} className="text-slate-500 hover:text-slate-400 text-sm">← Back</button>
            </div>
          )}

          {mode === "join" && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-white mb-2">Join a Classroom</h2>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Room Code</label>
                <input
                  type="text" value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  placeholder="e.g. ABC123"
                  maxLength={8}
                  className="w-full px-3 py-2.5 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 text-center text-2xl font-mono tracking-widest uppercase focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1.5">Join As</label>
                <div className="grid grid-cols-2 gap-2">
                  {["student", "teacher"].map((r) => (
                    <button key={r} onClick={() => setRole(r)}
                      className={`py-2 rounded-lg text-sm font-medium capitalize transition-colors ${role === r ? "bg-indigo-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"}`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button onClick={handleJoin}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-white font-semibold transition-colors">
                Join Classroom →
              </button>
              <button onClick={() => setMode("home")} className="text-slate-500 hover:text-slate-400 text-sm block mx-auto">← Back</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}