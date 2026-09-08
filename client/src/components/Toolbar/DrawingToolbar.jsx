import { useRef } from "react";

const TOOLS = [
  {
    group: "Draw",
    items: [
      { id: "select", label: "Select", icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
          <path d="M5 3l14 9-7 1-3 7z"/>
        </svg>
      )},
      { id: "pen", label: "Pen", icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
          <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
        </svg>
      )},
      { id: "pencil", label: "Pencil", icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
          <path d="M15.232 5.232l3.536 3.536-7.07 7.07-4.243.708.707-4.243 7.07-7.071z"/>
          <path d="M17.5 2.5a2.121 2.121 0 013 3"/>
        </svg>
      )},
      { id: "highlighter", label: "Hi-lite", icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
          <path d="M9 11l-6 6v3h3l6-6m2-2l2.5-2.5a2 2 0 000-2.83l-1.17-1.17a2 2 0 00-2.83 0L11 9"/>
          <path d="M18 2l4 4"/>
        </svg>
      )},
      { id: "eraser", label: "Eraser", icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
          <path d="M20 20H7L3 16l9.5-9.5 7.5 7.5L20 20z"/>
          <path d="M6.5 17.5l5-5"/>
        </svg>
      )},
    ],
  },
  {
    group: "Shapes",
    items: [
      { id: "rect", label: "Rect", icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
          <rect x="3" y="5" width="18" height="14" rx="1"/>
        </svg>
      )},
      { id: "circle", label: "Circle", icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
          <circle cx="12" cy="12" r="9"/>
        </svg>
      )},
      { id: "triangle", label: "Triangle", icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
          <path d="M12 3L22 21H2L12 3z"/>
        </svg>
      )},
      { id: "line", label: "Line", icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
          <path d="M5 19L19 5"/>
        </svg>
      )},
      { id: "arrow", label: "Arrow", icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
          <path d="M5 19L19 5M19 5H11M19 5v8"/>
        </svg>
      )},
    ],
  },
  {
    group: "Text",
    items: [
      { id: "text", label: "Text", icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
          <path d="M4 6h16M12 6v12M8 18h8"/>
        </svg>
      )},
      { id: "math", label: "Math", icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
          <path d="M3 10h6M3 14h6M14 6l4 12M18 6l-4 12"/>
        </svg>
      )},
    ],
  },
];

const SIDEBAR_COLORS = [
  { label: "Black",  hex: "#000000", border: "#475569" },
  { label: "White",  hex: "#ffffff", border: "#94a3b8" },
  { label: "Red",    hex: "#ef4444", border: "transparent" },
  { label: "Blue",   hex: "#2563eb", border: "transparent" },
  { label: "Green",  hex: "#16a34a", border: "transparent" },
  { label: "Yellow", hex: "#eab308", border: "transparent" },
  { label: "Purple", hex: "#9333ea", border: "transparent" },
  { label: "Orange", hex: "#ea580c", border: "transparent" },
];

const BACKGROUNDS = [
  {
    id: "whiteboard",
    label: "White",
    previewStyle: { background: "#ffffff", border: "1px solid #cbd5e1" },
    textColor: "#334155",
  },
  {
    id: "blackboard",
    label: "Black",
    previewStyle: { background: "#1a3c2e" },
    textColor: "#d1fae5",
  },
  {
    id: "grid",
    label: "Grid",
    previewStyle: {
      background: "#f8f9fa",
      backgroundImage:
        "linear-gradient(rgba(0,0,0,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.12) 1px, transparent 1px)",
      backgroundSize: "7px 7px",
    },
    textColor: "#334155",
  },
  {
    id: "ruled",
    label: "Ruled",
    previewStyle: {
      background: "#fff",
      backgroundImage:
        "linear-gradient(transparent calc(100% - 1px), #93c5fd 1px)",
      backgroundSize: "100% 8px",
    },
    textColor: "#1e3a5f",
  },
];

export default function DrawingToolbar({
  tool, setTool,
  color, setColor,
  size, setSize,
  eraserSize, setEraserSize,
  background, onBackgroundChange,
  onUndo, onRedo, onClear,
  isTeacher, isLocked,
  socket, roomCode, pageIndex, canvasRef,
}) {
  const fileInputRef  = useRef(null);
  const colorInputRef = useRef(null);

  const isEraser = tool === "eraser";

  const handleFileImport = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    if (file.type === "application/pdf") {
      reader.onload = async (ev) => {
        try {
          const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
          GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;
          const pdf = await getDocument({ data: ev.target.result }).promise;
          for (let i = 1; i <= Math.min(pdf.numPages, 5); i++) {
            const page = await pdf.getPage(i);
            const vp = page.getViewport({ scale: 1.5 });
            const tmpCanvas = document.createElement("canvas");
            tmpCanvas.width = vp.width;
            tmpCanvas.height = vp.height;
            await page.render({ canvasContext: tmpCanvas.getContext("2d"), viewport: vp }).promise;
            canvasRef.current?.addImageFromDataUrl(tmpCanvas.toDataURL("image/png"), 40 + i * 10, 40 + i * 10);
          }
        } catch (err) {
          console.error("PDF error:", err);
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (file.type.startsWith("image/")) {
      reader.onload = (ev) => canvasRef.current?.addImageFromDataUrl(ev.target.result);
      reader.readAsDataURL(file);
    }
    e.target.value = "";
  };

  return (
    <div className="w-full flex flex-col gap-0 select-none pb-2">

      {/* ─── Drawing Tools ───────────────────────────────────── */}
      {TOOLS.map(({ group, items }) => (
        <div key={group} className="w-full">
          <div className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider text-center pt-2 pb-0.5 leading-none">
            {group}
          </div>
          {items.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => { if (!isLocked) setTool(id); }}
              disabled={isLocked}
              title={label}
              className={`w-full flex flex-col items-center justify-center py-1.5 rounded-lg mx-0.5 transition-all duration-100
                ${tool === id
                  ? "bg-indigo-500/25 text-indigo-300 ring-1 ring-indigo-500/60"
                  : "text-slate-400 hover:text-white hover:bg-white/8"}
                ${isLocked ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
              style={{ width: "calc(100% - 4px)" }}
            >
              {icon}
              <span className={`text-[9px] leading-none mt-0.5 font-medium ${tool === id ? "text-indigo-300" : "text-slate-500"}`}>
                {label}
              </span>
            </button>
          ))}
          <div className="mx-2 my-1 h-px bg-slate-800" />
        </div>
      ))}

      {/* ─── Color (Always Visible 8 Swatches + Custom) ──────── */}
      {!isEraser && (
        <div className="w-full px-1">
          <div className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider text-center pt-1 pb-1 leading-none">
            Color
          </div>
          <div className="grid grid-cols-4 gap-1 px-0.5 mb-1.5">
            {SIDEBAR_COLORS.map((c) => {
              const active = color.toLowerCase() === c.hex.toLowerCase();
              return (
                <button
                  key={c.hex}
                  onClick={() => setColor(c.hex)}
                  disabled={isLocked}
                  title={c.label}
                  className={`w-4 h-4 rounded-full mx-auto transition-transform flex items-center justify-center
                    ${active ? "ring-2 ring-indigo-400 scale-110 shadow-sm" : "hover:scale-105 opacity-80 hover:opacity-100"}`}
                  style={{ backgroundColor: c.hex, border: `1px solid ${c.border}` }}
                />
              );
            })}
          </div>
          
          {/* Custom color picker input */}
          <div className="flex items-center justify-center mb-1">
            <button
              onClick={() => colorInputRef.current?.click()}
              disabled={isLocked}
              className="w-full flex items-center justify-center gap-1 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[9px] transition-colors border border-slate-700"
              title="More colors"
            >
              <span className="w-2.5 h-2.5 rounded-full border border-slate-500" style={{ background: color }} />
              <span>More...</span>
            </button>
            <input
              ref={colorInputRef}
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="sr-only"
            />
          </div>
          <div className="mx-1 my-1 h-px bg-slate-800" />
        </div>
      )}

      {/* ─── Size (Always Visible Quick Presets + Slider) ────── */}
      <div className="w-full px-1.5">
        <div className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider text-center pt-1 pb-1 leading-none">
          {isEraser ? "Eraser Size" : "Pen Size"}
        </div>

        {isEraser ? (
          /* Eraser sizes */
          <div className="flex flex-col gap-1">
            <div className="grid grid-cols-3 gap-1">
              {[
                { label: "S", s: 18 },
                { label: "M", s: 36 },
                { label: "L", s: 72 },
              ].map(({ label, s }) => (
                <button
                  key={label}
                  onClick={() => setEraserSize(s)}
                  disabled={isLocked}
                  className={`h-5 rounded text-[9px] font-bold transition-all
                    ${eraserSize === s
                      ? "bg-rose-600 text-white shadow-sm"
                      : "bg-slate-800 text-slate-400 hover:text-white"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              type="range"
              min="8"
              max="100"
              value={eraserSize || 36}
              onChange={(e) => setEraserSize(Number(e.target.value))}
              disabled={isLocked}
              className="w-full accent-rose-500 cursor-pointer h-1 bg-slate-700 rounded-lg appearance-none mt-0.5"
              title={`Eraser: ${eraserSize}px`}
            />
            <span className="text-[9px] text-center text-slate-500 font-mono leading-none">
              {eraserSize}px
            </span>
          </div>
        ) : (
          /* Pen sizes */
          <div className="flex flex-col gap-1">
            <div className="grid grid-cols-4 gap-0.5">
              {[
                { label: "S", s: 2 },
                { label: "M", s: 5 },
                { label: "L", s: 9 },
                { label: "XL", s: 16 },
              ].map(({ label, s }) => (
                <button
                  key={label}
                  onClick={() => setSize(s)}
                  disabled={isLocked}
                  className={`h-5 rounded text-[9px] font-bold transition-all
                    ${size === s
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-slate-800 text-slate-400 hover:text-white"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <input
              type="range"
              min="1"
              max="35"
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              disabled={isLocked}
              className="w-full accent-indigo-500 cursor-pointer h-1 bg-slate-700 rounded-lg appearance-none mt-0.5"
              title={`Size: ${size}px`}
            />
            <span className="text-[9px] text-center text-slate-500 font-mono leading-none">
              {size}px
            </span>
          </div>
        )}
        <div className="mx-0.5 my-1.5 h-px bg-slate-800" />
      </div>

      {/* ─── Board Background (always visible) ───────────────── */}
      <div className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider text-center pt-0 pb-1 leading-none">
        Board
      </div>
      <div className="grid grid-cols-2 gap-1 px-1 mb-1">
        {BACKGROUNDS.map((bg) => (
          <button
            key={bg.id}
            onClick={() => onBackgroundChange(bg.id)}
            title={bg.label}
            className={`relative h-9 rounded border-2 transition-all overflow-hidden flex items-end pb-0.5 justify-center
              ${background === bg.id
                ? "border-indigo-400 ring-1 ring-indigo-500/40"
                : "border-slate-700 hover:border-slate-500"}`}
            style={bg.previewStyle}
          >
            <span
              className="text-[8px] font-bold leading-none px-0.5 rounded"
              style={{ color: bg.textColor, background: "rgba(255,255,255,0.55)" }}
            >
              {bg.label}
            </span>
          </button>
        ))}
      </div>
      <div className="mx-2 my-1 h-px bg-slate-800" />

      {/* ─── Actions ─────────────────────────────────────────── */}
      <div className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider text-center pt-1 pb-0.5">Actions</div>

      {/* Undo */}
      <button onClick={onUndo} title="Undo (Ctrl+Z)"
        className="w-full flex flex-col items-center justify-center py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-all"
        style={{ width: "calc(100% - 4px)", marginLeft: 2 }}>
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>
        </svg>
        <span className="text-[9px] mt-0.5 text-slate-500 font-medium leading-none">Undo</span>
      </button>

      {/* Redo */}
      <button onClick={onRedo} title="Redo (Ctrl+Y)"
        className="w-full flex flex-col items-center justify-center py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-all"
        style={{ width: "calc(100% - 4px)", marginLeft: 2 }}>
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path d="M15 14l5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 000 11H13"/>
        </svg>
        <span className="text-[9px] mt-0.5 text-slate-500 font-medium leading-none">Redo</span>
      </button>

      {/* Clear (teacher only) */}
      {isTeacher && (
        <button
          onClick={onClear}
          title="Clear page (Ctrl+Z to undo)"
          className="w-full flex flex-col items-center justify-center py-1.5 rounded-lg text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
          style={{ width: "calc(100% - 4px)", marginLeft: 2 }}>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
          </svg>
          <span className="text-[9px] mt-0.5 font-medium leading-none">Clear</span>
        </button>
      )}

      <div className="mx-2 my-1 h-px bg-slate-800" />

      {/* Upload */}
      <div className="text-[9px] font-semibold text-slate-600 uppercase tracking-wider text-center pt-1 pb-0.5">Import</div>
      <button onClick={() => fileInputRef.current?.click()} title="Upload image or PDF"
        className="w-full flex flex-col items-center justify-center py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/8 transition-all"
        style={{ width: "calc(100% - 4px)", marginLeft: 2 }}>
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <span className="text-[9px] mt-0.5 text-slate-500 font-medium leading-none">Upload</span>
      </button>
      <input ref={fileInputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileImport} />
    </div>
  );
}