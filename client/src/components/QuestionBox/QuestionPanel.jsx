import { useState, useRef, useEffect } from "react";
import { renderMixedMath, COMMON_SYMBOLS } from "../../utils/mathRenderer.js";

export default function QuestionPanel({ question, onUpdate, isTeacher, onClose }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(question || "");
  const [minimized, setMinimized] = useState(false);
  const [showSymbols, setShowSymbols] = useState(false);
  const textareaRef = useRef(null);
  const panelRef = useRef(null);

  // Draggable panel
  const dragRef = useRef({ dragging: false, offsetX: 0, offsetY: 0, x: 0, y: 0 });
  const [panelPos, setPanelPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    setDraft(question || "");
  }, [question]);

  useEffect(() => {
    if (editing && textareaRef.current) textareaRef.current.focus();
  }, [editing]);

  function handleSave() {
    onUpdate?.(draft);
    setEditing(false);
  }

  function handleKeyDown(e) {
    if (e.key === "Escape") { setDraft(question || ""); setEditing(false); }
    if (e.key === "Enter" && e.ctrlKey) handleSave();
  }

  function insertSymbol(latex) {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart, end = ta.selectionEnd;
    const newVal = draft.slice(0, start) + `$${latex}$` + draft.slice(end);
    setDraft(newVal);
    setTimeout(() => {
      ta.selectionStart = ta.selectionEnd = start + latex.length + 2;
      ta.focus();
    }, 0);
  }

  // Drag logic
  function startDrag(e) {
    const panel = panelRef.current;
    if (!panel || e.target.tagName === "BUTTON" || e.target.tagName === "TEXTAREA") return;
    dragRef.current = {
      dragging: true,
      offsetX: e.clientX - panelPos.x,
      offsetY: e.clientY - panelPos.y,
    };
    const onMove = (me) => {
      if (!dragRef.current.dragging) return;
      setPanelPos({ x: me.clientX - dragRef.current.offsetX, y: me.clientY - dragRef.current.offsetY });
    };
    const onUp = () => { dragRef.current.dragging = false; document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  const renderedMath = renderMixedMath(question || "");

  return (
    <div
      ref={panelRef}
      className="question-panel animate-fadeIn"
      style={{ transform: `translate(calc(-50% + ${panelPos.x}px), ${panelPos.y}px)`, cursor: "grab" }}
      onMouseDown={startDrag}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-700/50">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <span className="text-white text-sm font-semibold">Question</span>
          {isTeacher && (
            <span className="text-xs text-amber-400/70 hidden sm:inline">· supports $LaTeX$</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {isTeacher && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded hover:bg-indigo-500/10 transition-colors"
            >
              Edit
            </button>
          )}
          <button onClick={() => setMinimized(v => !v)} className="toolbar-btn w-7 h-7" title={minimized ? "Expand" : "Minimize"}>
            {minimized
              ? <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M5 15l7-7 7 7"/></svg>
              : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M19 9l-7 7-7-7"/></svg>
            }
          </button>
          <button onClick={onClose} className="toolbar-btn w-7 h-7 hover:text-red-400" title="Close">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
      </div>

      {!minimized && (
        <div className="p-4">
          {/* Edit mode */}
          {editing && isTeacher ? (
            <div className="space-y-3">
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Type your question here...\n\nSupports LaTeX: $\\frac{1}{2}$ or $$x^2 + y^2 = r^2$$\n\nCopy-paste from any source works too.`}
                className="w-full bg-slate-800/50 border border-slate-600 rounded-lg text-white text-sm p-3 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/50 placeholder-slate-500 leading-relaxed"
                rows={4}
              />

              {/* Symbol toolbar */}
              <div>
                <button
                  onClick={() => setShowSymbols(v => !v)}
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mb-2"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path d="M3 10h6M3 14h6M14 6l4 12M18 6l-4 12"/>
                  </svg>
                  {showSymbols ? "Hide" : "Insert"} Math Symbols
                </button>
                {showSymbols && (
                  <div className="flex flex-wrap gap-1 mb-2">
                    {COMMON_SYMBOLS.map((s) => (
                      <button
                        key={s.label}
                        onClick={() => insertSymbol(s.latex)}
                        className="px-1.5 py-0.5 text-xs bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded text-slate-200 transition-colors font-mono"
                        title={s.latex}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Math preview */}
              {draft && (
                <div className="math-preview bg-slate-800/30 border border-slate-700/50 rounded-lg p-3">
                  <p className="text-slate-500 text-xs mb-1.5">Preview:</p>
                  <div
                    className="text-white leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: renderMixedMath(draft) }}
                  />
                </div>
              )}

              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={() => { setDraft(question || ""); setEditing(false); }}
                  className="text-sm text-slate-400 hover:text-slate-300 px-3 py-1.5 rounded-lg hover:bg-slate-700/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg transition-colors font-medium"
                >
                  Publish (Ctrl+Enter)
                </button>
              </div>
            </div>
          ) : (
            /* Display mode */
            <div>
              {question ? (
                <div
                  className="math-preview text-white leading-relaxed text-sm"
                  dangerouslySetInnerHTML={{ __html: renderedMath }}
                />
              ) : (
                <p className="text-slate-500 text-sm italic">
                  {isTeacher ? 'Click "Edit" to type a question for students.' : "Waiting for teacher to post a question..."}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}