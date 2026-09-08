const SIZES = [1, 2, 3, 5, 8, 12, 18, 24];

export default function SizePicker({ size, onChange }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 shadow-2xl w-44">
      <p className="text-slate-400 text-xs mb-2 font-medium">Brush Size: {size}px</p>
      <input
        type="range" min="1" max="40" value={size}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 mb-3"
      />
      <div className="flex items-center justify-between gap-1">
        {SIZES.map((s) => (
          <button
            key={s}
            onClick={() => onChange(s)}
            className={`flex items-center justify-center rounded-full transition-all ${size === s ? "ring-2 ring-indigo-500" : "hover:bg-slate-700"}`}
            style={{ width: 28, height: 28 }}
            title={`${s}px`}
          >
            <div
              className="rounded-full bg-slate-300"
              style={{ width: Math.min(s + 3, 22), height: Math.min(s + 3, 22) }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}