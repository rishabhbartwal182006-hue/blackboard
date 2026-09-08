import { useState, useRef, useEffect } from "react";
import katex from "katex";
import { COMMON_SYMBOLS } from "../../utils/mathRenderer.js";

const EXAMPLES = [
  { label: "Fraction", latex: "\\frac{a}{b}" },
  { label: "Quadratic", latex: "x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}" },
  { label: "Pythagorean", latex: "a^2 + b^2 = c^2" },
  { label: "Square root", latex: "\\sqrt{x^2 + y^2}" },
  { label: "Integral", latex: "\\int_0^{\\infty} e^{-x^2}\\,dx" },
  { label: "Euler", latex: "e^{i\\pi} + 1 = 0" },
  { label: "Sum", latex: "\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}" },
  { label: "Limit", latex: "\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1" },
];

export default function MathInputModal({ onPlace, onClose }) {
  const [latex, setLatex] = useState("");
  const [fontSize, setFontSize] = useState(26);
  const inputRef = useRef(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const preview = (() => {
    if (!latex.trim()) return "";
    try { return katex.renderToString(latex.trim(), { throwOnError: false, displayMode: true }); }
    catch { return ""; }
  })();

  function insertSymbol(sym) {
    const ta = inputRef.current;
    if (!ta) return;
    const s = ta.selectionStart, e2 = ta.selectionEnd;
    const next = latex.slice(0, s) + sym + latex.slice(e2);
    setLatex(next);
    setTimeout(() => { ta.selectionStart = ta.selectionEnd = s + sym.length; ta.focus(); }, 0);
  }

  function handleKey(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (latex.trim()) onPlace(latex.trim(), fontSize); }
    if (e.key === "Escape") onClose();
  }

  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onMouseDown={onClose} onTouchStart={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 shadow-2xl animate-fadeIn w-full max-w-lg mx-4"
        onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <span className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-sm font-bold text-white select-none">∑</span>
            Insert Math
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* LaTeX input */}
        <div className="mb-3">
          <label className="text-xs text-slate-400 mb-1.5 block font-medium">LaTeX expression</label>
          <input
            ref={inputRef}
            type="text"
            value={latex}
            onChange={e => setLatex(e.target.value)}
            onKeyDown={handleKey}
            placeholder='\frac{1}{2}  or  x^2 + y^2 = r^2'
            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2.5 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/60 placeholder-slate-500"
          />
        </div>

        {/* Symbol palette */}
        <div className="mb-3">
          <p className="text-xs text-slate-500 mb-1.5 font-medium">Common symbols — click to insert:</p>
          <div className="flex flex-wrap gap-1">
            {COMMON_SYMBOLS.map(s => (
              <button key={s.label} onClick={() => insertSymbol(s.latex)}
                className="px-2 py-0.5 text-xs bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-slate-300 font-mono transition-colors">
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Example formulas */}
        <div className="mb-3">
          <p className="text-xs text-slate-500 mb-1.5 font-medium">Formula templates:</p>
          <div className="flex flex-wrap gap-1">
            {EXAMPLES.map(ex => (
              <button key={ex.label} onClick={() => setLatex(ex.latex)}
                className="px-2 py-0.5 text-xs bg-indigo-900/40 hover:bg-indigo-800/50 border border-indigo-700/40 rounded text-indigo-300 transition-colors">
                {ex.label}
              </button>
            ))}
          </div>
        </div>

        {/* Size */}
        <div className="mb-3 flex items-center gap-3">
          <label className="text-xs text-slate-400 whitespace-nowrap w-24">Size: {fontSize}px</label>
          <input type="range" min="14" max="72" value={fontSize}
            onChange={e => setFontSize(Number(e.target.value))}
            className="flex-1 accent-indigo-500" />
        </div>

        {/* Preview box */}
        <div className="mb-4 min-h-[70px] bg-white rounded-xl flex items-center justify-center p-3 overflow-auto">
          {preview
            ? <div className="text-black math-preview" dangerouslySetInnerHTML={{ __html: preview }} />
            : <span className="text-slate-400 text-sm italic">Preview appears as you type...</span>
          }
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <span className="text-slate-600 text-xs">Press Enter to place · Esc to cancel</span>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-lg hover:bg-slate-700/50 transition-colors">
              Cancel
            </button>
            <button
              onClick={() => { if (latex.trim()) onPlace(latex.trim(), fontSize); }}
              disabled={!latex.trim()}
              className="px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors">
              Place on Board →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}