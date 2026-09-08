import { useRef } from "react";

const QUICK_COLORS = [
  { label: "Black",  hex: "#000000", border: "#475569" },
  { label: "White",  hex: "#ffffff", border: "#94a3b8" },
  { label: "Red",    hex: "#ef4444", border: "transparent" },
  { label: "Blue",   hex: "#2563eb", border: "transparent" },
  { label: "Green",  hex: "#16a34a", border: "transparent" },
  { label: "Yellow", hex: "#eab308", border: "transparent" },
  { label: "Purple", hex: "#9333ea", border: "transparent" },
  { label: "Orange", hex: "#ea580c", border: "transparent" },
];

const PEN_SIZES = [
  { label: "Fine",   size: 2,  dot: 4 },
  { label: "Medium", size: 5,  dot: 7 },
  { label: "Bold",   size: 9,  dot: 10 },
  { label: "Thick",  size: 16, dot: 14 },
];

const ERASER_SIZES = [
  { label: "Small",  size: 18, dot: 8 },
  { label: "Medium", size: 36, dot: 14 },
  { label: "Large",  size: 72, dot: 20 },
];

export default function ToolPropertiesBar({
  tool,
  color,
  setColor,
  size,
  setSize,
  eraserSize,
  setEraserSize,
  isLocked,
  background,
  onBackgroundChange,
  isTeacher,
}) {
  const colorInputRef = useRef(null);

  const isEraser = tool === "eraser";
  const isSelect = tool === "select";

  const BOARDS = [
    { id: "whiteboard", label: "White", bg: "#ffffff", border: "#94a3b8" },
    { id: "blackboard", label: "Black", bg: "#1a3c2e", border: "#166534" },
    { id: "grid",       label: "Grid",  bg: "#f8f9fa", border: "#94a3b8" },
    { id: "ruled",      label: "Ruled", bg: "#fffef0", border: "#93c5fd" },
  ];

  return (
    <div className="flex-shrink-0 h-10 bg-slate-900 border-b border-slate-800 flex items-center px-4 gap-4 z-10 select-none overflow-x-auto justify-between">
      <div className="flex items-center gap-4 flex-shrink-0">
      
      {/* ─── COLOR PALETTE (Visible when drawing / text / shapes) ─── */}
      {!isEraser && !isSelect && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-1">
            Color:
          </span>
          <div className="flex items-center gap-1">
            {QUICK_COLORS.map((c) => {
              const active = color.toLowerCase() === c.hex.toLowerCase();
              return (
                <button
                  key={c.hex}
                  onClick={() => setColor(c.hex)}
                  disabled={isLocked}
                  title={c.label}
                  className={`w-6 h-6 rounded-full transition-all flex items-center justify-center flex-shrink-0
                    ${active
                      ? "ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-900 scale-110 shadow-md"
                      : "hover:scale-105 opacity-85 hover:opacity-100"}`}
                  style={{
                    backgroundColor: c.hex,
                    border: `1.5px solid ${c.border}`,
                  }}
                >
                  {active && (
                    <div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        backgroundColor: c.hex === "#ffffff" ? "#000000" : "#ffffff",
                      }}
                    />
                  )}
                </button>
              );
            })}

            {/* Custom Color Picker Button */}
            <div className="relative flex items-center ml-1">
              <button
                onClick={() => colorInputRef.current?.click()}
                disabled={isLocked}
                title="Custom color..."
                className="w-6 h-6 rounded-full bg-gradient-to-tr from-rose-500 via-emerald-400 to-indigo-500 p-[1.5px] hover:scale-105 transition-transform flex items-center justify-center"
              >
                <div className="w-full h-full rounded-full bg-slate-800 flex items-center justify-center text-[10px] text-white font-bold">
                  +
                </div>
              </button>
              <input
                ref={colorInputRef}
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-6 h-6 pointer-events-auto"
              />
            </div>
          </div>
        </div>
      )}

      {/* Divider */}
      {!isEraser && !isSelect && <div className="h-4 w-px bg-slate-700 flex-shrink-0" />}

      {/* ─── PEN SIZE (Visible when drawing) ─── */}
      {!isEraser && !isSelect && (
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Pen Size:
          </span>
          <div className="flex items-center gap-1">
            {PEN_SIZES.map((ps) => {
              const active = size === ps.size;
              return (
                <button
                  key={ps.label}
                  onClick={() => setSize(ps.size)}
                  disabled={isLocked}
                  title={`${ps.label} (${ps.size}px)`}
                  className={`px-2 py-0.5 h-6 rounded text-xs flex items-center gap-1.5 transition-all
                    ${active
                      ? "bg-indigo-600 text-white font-semibold shadow-sm"
                      : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"}`}
                >
                  <span
                    className="rounded-full bg-current inline-block"
                    style={{ width: ps.dot, height: ps.dot }}
                  />
                  <span>{ps.label}</span>
                </button>
              );
            })}
          </div>

          {/* Slider */}
          <div className="flex items-center gap-1.5 ml-1">
            <input
              type="range"
              min="1"
              max="35"
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              disabled={isLocked}
              className="w-20 accent-indigo-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg appearance-none"
              title={`Size: ${size}px`}
            />
            <span className="text-xs font-mono text-slate-400 w-7">{size}px</span>
          </div>
        </div>
      )}

      {/* ─── ERASER SIZE (Visible when eraser tool active) ─── */}
      {isEraser && (
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider flex items-center gap-1">
            <span>🧹</span> Eraser Size:
          </span>
          <div className="flex items-center gap-1.5">
            {ERASER_SIZES.map((es) => {
              const active = eraserSize === es.size;
              return (
                <button
                  key={es.label}
                  onClick={() => setEraserSize(es.size)}
                  disabled={isLocked}
                  title={`${es.label} Eraser (${es.size}px)`}
                  className={`px-2.5 py-0.5 h-6 rounded text-xs flex items-center gap-1.5 transition-all
                    ${active
                      ? "bg-rose-600 text-white font-semibold shadow-sm"
                      : "bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"}`}
                >
                  <span
                    className="rounded-full border border-current inline-block"
                    style={{ width: es.dot, height: es.dot }}
                  />
                  <span>{es.label}</span>
                </button>
              );
            })}
          </div>

          {/* Eraser Slider */}
          <div className="flex items-center gap-1.5 ml-1">
            <input
              type="range"
              min="8"
              max="100"
              value={eraserSize}
              onChange={(e) => setEraserSize(Number(e.target.value))}
              disabled={isLocked}
              className="w-24 accent-rose-500 cursor-pointer h-1.5 bg-slate-700 rounded-lg appearance-none"
              title={`Eraser: ${eraserSize}px`}
            />
            <span className="text-xs font-mono text-slate-400 w-8">{eraserSize}px</span>
          </div>

          <div className="h-4 w-px bg-slate-700 flex-shrink-0 ml-1" />
          <span className="text-[11px] text-slate-400 italic">
            💡 Stylus barrel button also erases while writing
          </span>
        </div>
      )}

      {/* ─── SELECT TOOL HELPER ─── */}
      {isSelect && (
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="font-semibold text-slate-300">Selection Tool:</span>
          <span>Click any object or stroke to move, resize, rotate, or press <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded font-mono text-[10px] text-slate-200">Delete</kbd> to remove.</span>
        </div>
      )}
      </div>

      {/* ─── QUICK BOARD SWITCHER (Teacher & Overview) ─── */}
      <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto pl-4 border-l border-slate-800">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mr-0.5">
          Board:
        </span>
        <div className="flex items-center gap-1">
          {BOARDS.map((b) => {
            const active = (background || "whiteboard") === b.id;
            return (
              <button
                key={b.id}
                onClick={() => onBackgroundChange?.(b.id)}
                disabled={!isTeacher}
                title={isTeacher ? `Switch board to ${b.label}` : `Current board: ${b.label}`}
                className={`px-2 py-0.5 h-6 rounded text-[11px] font-medium transition-all flex items-center gap-1.5
                  ${active
                    ? "bg-indigo-600 text-white font-semibold shadow-sm ring-1 ring-indigo-400"
                    : isTeacher
                      ? "bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700"
                      : "bg-slate-800/60 text-slate-400 cursor-default"}`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full inline-block border flex-shrink-0"
                  style={{ backgroundColor: b.bg, borderColor: b.border }}
                />
                <span>{b.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}