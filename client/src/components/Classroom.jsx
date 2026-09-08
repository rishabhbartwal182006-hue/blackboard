import { useEffect, useRef, useState, useCallback } from "react";
import { useSocket } from "../hooks/useSocket.js";
import { useRoom } from "../hooks/useRoom.js";
import Canvas from "./Board/Canvas.jsx";
import DrawingToolbar from "./Toolbar/DrawingToolbar.jsx";
import ToolPropertiesBar from "./Toolbar/ToolPropertiesBar.jsx";
import TeacherControls from "./Toolbar/TeacherControls.jsx";
import PageManager from "./Board/PageManager.jsx";
import QuestionPanel from "./QuestionBox/QuestionPanel.jsx";
import CursorOverlay from "./CursorOverlay.jsx";

export default function Classroom({ roomCode, role, userName, onLeave }) {
  const { socket, connected, userId, users } = useSocket(roomCode, role, userName);
  const room = useRoom(null);
  const roomRef = useRef(room);
  roomRef.current = room;

  const [tool, setTool] = useState("pen");
  const [color, setColor] = useState(role === "teacher" ? "#000000" : "#1a56db");
  const [size, setSize] = useState(5);
  const [eraserSize, setEraserSize] = useState(36);
  const [zoom, setZoom] = useState(1);
  const [showQuestion, setShowQuestion] = useState(true);
  const [remoteCursors, setRemoteCursors] = useState({});
  const [notification, setNotification] = useState("");
  const canvasRef = useRef(null);
  const loadFileRef = useRef(null);

  // ─── Load initial room state after joining ────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    socket.on("room:joined", ({ state }) => {
      roomRef.current.loadState(state);
    });

    socket.on("page:added", ({ page }) => {
      roomRef.current.addPage(page);
    });

    socket.on("page:deleted", ({ pageIndex, newIndex }) => {
      roomRef.current.deletePage(pageIndex);
      roomRef.current.navigatePage(newIndex);
    });

    socket.on("page:navigated", ({ pageIndex, background: bg }) => {
      roomRef.current.navigatePage(pageIndex, bg);
    });

    socket.on("background:changed", ({ pageIndex, background: bg }) => {
      roomRef.current.updatePageBackground(pageIndex, bg);

      // OpenBoard smart contrast: auto-switch stylus color if contrasting board selected
      if (bg === "blackboard") {
        setColor((cur) => (cur.toLowerCase() === "#000000" || cur.toLowerCase() === "#1e293b" ? "#ffffff" : cur));
      } else if (bg !== "blackboard") {
        setColor((cur) => (cur.toLowerCase() === "#ffffff" ? "#000000" : cur));
      }
    });

    socket.on("question:updated", ({ text }) => {
      roomRef.current.setQuestion(text);
      if (text && !showQuestion) setShowQuestion(true);
    });

    socket.on("student:locked", ({ locked }) => {
      roomRef.current.setStudentLocked(locked);
      showNotif(locked ? "✋ Writing locked by teacher" : "✅ Writing enabled");
    });

    socket.on("cursor:move", ({ userId: uid, role: r, x, y }) => {
      if (uid === userId) return;
      setRemoteCursors((prev) => ({ ...prev, [uid]: { x, y, role: r } }));
    });

    socket.on("user:joined", (u) => showNotif(`${u.userName} joined`));
    socket.on("user:left", ({ userId: uid }) => {
      setRemoteCursors((prev) => { const n = { ...prev }; delete n[uid]; return n; });
    });

    return () => {
      ["room:joined","page:added","page:deleted","page:navigated","background:changed",
       "question:updated","student:locked","cursor:move","user:joined","user:left"]
        .forEach(ev => socket.off(ev));
    };
  }, [socket, userId]);

  function showNotif(msg) {
    setNotification(msg);
    setTimeout(() => setNotification(""), 3000);
  }

  // ─── Canvas actions ────────────────────────────────────────────────────────
  const handleClearPage = useCallback(() => {
    if (!socket) return;
    const curIdx = roomRef.current.currentPageIndex;
    socket.emit("draw:clear", { roomCode, pageIndex: curIdx });
    canvasRef.current?.clearPage();
  }, [socket, roomCode]);

  const handleUndo = useCallback(() => canvasRef.current?.undo(), []);
  const handleRedo = useCallback(() => canvasRef.current?.redo(), []);
  const handleZoomIn = useCallback(() => canvasRef.current?.zoomBy(1.2), []);
  const handleZoomOut = useCallback(() => canvasRef.current?.zoomBy(1 / 1.2), []);
  const handleZoomReset = useCallback(() => canvasRef.current?.zoomReset(), []);

  // ─── Page actions ──────────────────────────────────────────────────────────
  const handleAddPage = useCallback(() => {
    if (socket) socket.emit("page:add", { roomCode });
  }, [socket, roomCode]);

  const handleDeletePage = useCallback((i) => {
    if (socket) socket.emit("page:delete", { roomCode, pageIndex: i });
  }, [socket, roomCode]);

  const handleNavigatePage = useCallback((i) => {
    const bg = roomRef.current.pages[i]?.background || "whiteboard";
    roomRef.current.navigatePage(i, bg);
    if (socket) socket.emit("page:navigate", { roomCode, pageIndex: i });
  }, [socket, roomCode]);

  const handleBackgroundChange = useCallback((bg) => {
    const curIdx = roomRef.current.currentPageIndex;
    roomRef.current.updatePageBackground(curIdx, bg);
    if (socket) socket.emit("background:change", { roomCode, pageIndex: curIdx, background: bg });

    // OpenBoard smart contrast: use white chalk on blackboard, black ink on light boards
    if (bg === "blackboard" && (color.toLowerCase() === "#000000" || color.toLowerCase() === "#1e293b")) {
      setColor("#ffffff");
      showNotif("🎨 Switched to white chalk for blackboard");
    } else if (bg !== "blackboard" && color.toLowerCase() === "#ffffff") {
      setColor("#000000");
      showNotif("🎨 Switched to black ink for light board");
    }
  }, [socket, roomCode, color]);

  // ─── Teacher controls ──────────────────────────────────────────────────────
  const handleLockToggle = useCallback((locked) => {
    if (socket) socket.emit("student:lock", { roomCode, locked });
  }, [socket, roomCode]);

  const handleQuestionUpdate = useCallback((text) => {
    room.setQuestion(text);
    if (socket) socket.emit("question:update", { roomCode, text });
  }, [socket, roomCode]);

  // ─── Save board to JSON file ───────────────────────────────────────────────
  const handleSaveBoard = useCallback(() => {
    // Grab current canvas objects to include latest strokes
    const currentData = canvasRef.current?.getCurrentPageData();
    const allPages = room.pages.map((p, i) =>
      i === room.currentPageIndex && currentData
        ? { ...p, objects: currentData.objects, background: currentData.background }
        : p
    );

    const saveData = {
      version: "1.0",
      savedAt: new Date().toISOString(),
      roomCode,
      currentPageIndex: room.currentPageIndex,
      question: room.question,
      pages: allPages,
    };

    const json = JSON.stringify(saveData, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    a.download = `mathboard-${roomCode}-${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotif("💾 Board saved to your PC!");
  }, [room, roomCode]);

  // ─── Load board from JSON file ────────────────────────────────────────────
  const handleLoadBoardFile = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.pages || !Array.isArray(data.pages)) throw new Error("Invalid format");

        // Restore room state
        room.loadState(data);
        const targetPage = data.currentPageIndex || 0;
        room.setCurrentPageIndex(targetPage);

        // Load the target page onto canvas
        const pageData = data.pages[targetPage];
        if (pageData) {
          const bg = pageData.background || "whiteboard";
          room.setBackground(bg);
          canvasRef.current?.loadPageData(pageData.objects || [], bg);
        }
        showNotif("📂 Board loaded successfully!");
      } catch (err) {
        showNotif("❌ Could not load this file. Please select a valid .json board file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }, [room]);

  // ─── Export PNG ───────────────────────────────────────────────────────────
  const handleExportPNG = useCallback(() => {
    canvasRef.current?.exportAsPNG();
    showNotif("🖼️ Board exported as PNG!");
  }, []);

  // ─── Keyboard shortcuts (Digital Pen & Tablet Express Keys) ─────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept when typing in inputs/textareas/contenteditable
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || document.activeElement?.isContentEditable) return;

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const mod = isMac ? e.metaKey : e.ctrlKey;

      if (mod && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) {
          canvasRef.current?.redo();
        } else {
          canvasRef.current?.undo();
        }
      } else if (mod && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        canvasRef.current?.redo();
      } else if (mod && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        handleZoomIn();
      } else if (mod && (e.key === "-" || e.key === "_")) {
        e.preventDefault();
        handleZoomOut();
      } else if (mod && e.key === "0") {
        e.preventDefault();
        handleZoomReset();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        canvasRef.current?.deleteSelected();
      } else if (!mod && !e.altKey) {
        if (e.key === "b" || e.key === "B" || e.key === "p" || e.key === "P") {
          setTool("pen");
          showNotif("✏️ Pen");
        } else if (e.key === "e" || e.key === "E") {
          setTool("eraser");
          showNotif("🧹 Eraser");
        } else if (e.key === "s" || e.key === "S" || e.key === "v" || e.key === "V") {
          setTool("select");
          showNotif("👆 Select");
        } else if (e.key === "t" || e.key === "T") {
          setTool("text");
        } else if (e.key === "m" || e.key === "M") {
          setTool("math");
        } else if (e.key === "[") {
          setSize((prev) => {
            const next = Math.max(1, prev - 1);
            showNotif(`Brush size: ${next}px`);
            return next;
          });
        } else if (e.key === "]") {
          setSize((prev) => {
            const next = Math.min(40, prev + 1);
            showNotif(`Brush size: ${next}px`);
            return next;
          });
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleZoomIn, handleZoomOut, handleZoomReset]);

  const isLocked = role === "student" && room.studentLocked;

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-900 overflow-hidden" style={{ userSelect: "none" }}>

      {/* ─── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 h-11 bg-slate-900/95 backdrop-blur border-b border-slate-800 flex items-center px-3 gap-2 z-20">
        {/* Logo + room info */}
        <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center flex-shrink-0">
            <svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
            </svg>
          </div>
          <span className="text-white font-semibold text-sm hidden sm:block">MathBoard</span>
          <div className="h-4 w-px bg-slate-700 hidden sm:block" />
          <span className="text-slate-400 text-xs font-mono tracking-wider">{roomCode}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0 ${role === "teacher" ? "bg-amber-500/20 text-amber-400" : "bg-blue-500/20 text-blue-400"}`}>
            {role}
          </span>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1 mx-auto">
          <button onClick={handleZoomOut} title="Zoom out"
            className="w-7 h-7 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"/></svg>
          </button>
          <button onClick={handleZoomReset}
            className="text-xs text-slate-400 hover:text-white px-1 font-mono min-w-[3.5rem] text-center">
            {Math.round(zoom * 100)}%
          </button>
          <button onClick={handleZoomIn} title="Zoom in"
            className="w-7 h-7 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6M7 10h6"/></svg>
          </button>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-1.5 ml-auto flex-shrink-0">

          {/* ── Export PNG ── */}
          <button
            onClick={handleExportPNG}
            title="Export page as PNG image"
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-700/40 transition-colors font-medium"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
            </svg>
            <span className="hidden sm:inline">Export PNG</span>
          </button>

          {/* ── Save board ── */}
          <button
            onClick={handleSaveBoard}
            title="Save entire board to your PC (.json)"
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-700/40 transition-colors font-medium"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
              <polyline points="17 21 17 13 7 13 7 21"/>
              <polyline points="7 3 7 8 15 8"/>
            </svg>
            <span className="hidden sm:inline">Save</span>
          </button>

          {/* ── Load board ── */}
          <button
            onClick={() => loadFileRef.current?.click()}
            title="Load a saved board from your PC"
            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-600/60 text-slate-300 border border-slate-600/50 transition-colors font-medium"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
            </svg>
            <span className="hidden sm:inline">Load</span>
          </button>
          <input ref={loadFileRef} type="file" accept=".json" className="hidden" onChange={handleLoadBoardFile} />

          {/* Question toggle */}
          <button onClick={() => setShowQuestion(v => !v)}
            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${showQuestion ? "bg-indigo-500/25 text-indigo-300" : "text-slate-400 hover:text-white hover:bg-white/10"}`}
            title="Question panel">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </button>

          {/* Users count */}
          <div className="flex items-center gap-1 text-slate-400 text-xs">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
            </svg>
            {users.length}
          </div>

          {/* Connection dot */}
          <div className={`w-2 h-2 rounded-full ${connected ? "bg-emerald-500" : "bg-red-500"}`}
            title={connected ? "Connected" : "Disconnected"} />

          {/* Leave */}
          <button onClick={onLeave}
            className="text-xs text-slate-400 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-red-500/10">
            Leave
          </button>
        </div>
      </div>

      {/* ─── OpenBoard Tool Properties Bar (Always Visible Colors & Sizes) ─── */}
      <ToolPropertiesBar
        tool={tool}
        color={color}
        setColor={setColor}
        size={size}
        setSize={setSize}
        eraserSize={eraserSize}
        setEraserSize={setEraserSize}
        background={room.background}
        onBackgroundChange={handleBackgroundChange}
        isTeacher={role === "teacher"}
        isLocked={isLocked}
      />

      {/* ─── Main content ──────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Left toolbar — wider (80px), NO overflow-y-auto to prevent tooltip clipping */}
        <div className="flex-shrink-0 w-20 bg-slate-900/95 backdrop-blur border-r border-slate-800 flex flex-col items-center pb-4 z-10 overflow-y-scroll overflow-x-visible"
          style={{ scrollbarWidth: "none" }}>
          <DrawingToolbar
            tool={tool} setTool={setTool}
            color={color} setColor={setColor}
            size={size} setSize={setSize}
            eraserSize={eraserSize} setEraserSize={setEraserSize}
            background={room.background}
            onBackgroundChange={handleBackgroundChange}
            onUndo={handleUndo} onRedo={handleRedo}
            onClear={handleClearPage}
            isTeacher={role === "teacher"}
            isLocked={isLocked}
            socket={socket} roomCode={roomCode}
            pageIndex={room.currentPageIndex}
            canvasRef={canvasRef}
          />
        </div>

        {/* Canvas area */}
        <div className="flex-1 relative min-w-0 overflow-hidden">
          <Canvas
            ref={canvasRef}
            socket={socket}
            roomCode={roomCode}
            role={role}
            tool={tool}
            color={color}
            size={size}
            eraserSize={eraserSize}
            pageIndex={room.currentPageIndex}
            pages={room.pages}
            background={room.background}
            studentLocked={room.studentLocked}
            onZoomChange={setZoom}
            onToolChange={setTool}
            onCursorMove={(x, y) => {
              if (socket && userId)
                socket.emit("cursor:move", { roomCode, x, y, userId, role });
            }}
          />

          {/* Remote cursors */}
          <CursorOverlay cursors={remoteCursors} users={users} />

          {/* Question panel */}
          {showQuestion && (
            <QuestionPanel
              question={room.question}
              onUpdate={role === "teacher" ? handleQuestionUpdate : null}
              isTeacher={role === "teacher"}
              onClose={() => setShowQuestion(false)}
            />
          )}

          {/* Teacher controls (top-right) */}
          {role === "teacher" && (
            <TeacherControls
              studentLocked={room.studentLocked}
              onLockToggle={handleLockToggle}
            />
          )}

          {/* Student locked notice */}
          {isLocked && (
            <div className="absolute top-3 right-3 bg-red-900/80 backdrop-blur text-red-200 text-xs px-3 py-1.5 rounded-lg border border-red-700/50 flex items-center gap-1.5 z-20">
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
              </svg>
              Board locked
            </div>
          )}
        </div>
      </div>

      {/* ─── Page navigation ───────────────────────────────────────────────────── */}
      <PageManager
        pages={room.pages}
        currentPageIndex={room.currentPageIndex}
        onNavigate={handleNavigatePage}
        onAdd={role === "teacher" ? handleAddPage : null}
        onDelete={role === "teacher" ? handleDeletePage : null}
        canvasRef={canvasRef}
      />

      {/* Toast notification */}
      {notification && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-700 text-white text-sm px-4 py-2 rounded-full shadow-xl z-50 animate-fadeIn pointer-events-none">
          {notification}
        </div>
      )}
    </div>
  );
}