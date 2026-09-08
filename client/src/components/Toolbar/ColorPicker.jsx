import { useState } from "react";

const PRESETS = [
  "#000000", "#ffffff", "#ef4444", "#f97316", "#eab308",
  "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
  "#78716c", "#94a3b8", "#fbbf24", "#10b981", "#0ea5e9",
  "#6366f1", "#a855f7", "#f43f5e", "#14b8a6", "#84cc16",
];

export default function ColorPicker({ color, onChange }) {
  const [custom, setCustom] = useState(color);

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 shadow-2xl w-52">
      <p className="text-slate-400 text-xs mb-2 font-medium">Color</p>
      <div className="grid grid-cols-5 gap-1.5 mb-3">
        {PRESETS.map((c) => (
          <button
            key={c}
            onClick={() => onChange(c)}
            className={`color-swatch ${color === c ? "selected" : ""}`}
            style={{ background: c, border: c === "#ffffff" ? "2px solid #64748b" : "2px solid transparent" }}
            title={c}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onBlur={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded border border-slate-600 cursor-pointer bg-transparent"
          title="Custom color"
        />
        <input
          type="text"
          value={custom}
          onChange={(e) => {
            setCustom(e.target.value);
            if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) onChange(e.target.value);
          }}
          className="flex-1 text-xs bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-white font-mono"
          placeholder="#000000"
          maxLength={7}
        />
      </div>
    </div>
  );
}