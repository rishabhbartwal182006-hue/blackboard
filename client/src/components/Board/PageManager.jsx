import { useRef, useEffect } from "react";

export default function PageManager({ pages, currentPageIndex, onNavigate, onAdd, onDelete, canvasRef }) {
  const thumbsRef = useRef({});

  // Generate thumbnail preview from canvas for current page
  useEffect(() => {
    // Thumbnails are simplified colored indicators for now
  }, [pages, currentPageIndex]);

  const bgColors = {
    whiteboard: "#ffffff",
    blackboard: "#1a3c2e",
    grid: "#f0f4f8",
    ruled: "#fffef0",
  };

  return (
    <div className="flex-shrink-0 h-16 bg-slate-900/95 backdrop-blur border-t border-slate-800 flex items-center gap-2 px-3 overflow-x-auto z-10">
      {pages.map((page, i) => (
        <button
          key={i}
          onClick={() => onNavigate(i)}
          className={`page-thumb flex-shrink-0 relative group ${i === currentPageIndex ? "active" : ""}`}
          style={{ background: bgColors[page.background] || "#fff" }}
          title={`Page ${i + 1}`}
        >
          <span className="absolute inset-0 flex items-center justify-center text-slate-500 text-xs font-medium">
            {i + 1}
          </span>
          {/* Delete button (teacher only) */}
          {onDelete && pages.length > 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(i); }}
              className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              title="Delete page"
            >
              <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                <path d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          )}
        </button>
      ))}

      {/* Add page button (teacher only) */}
      {onAdd && (
        <button
          onClick={onAdd}
          className="flex-shrink-0 w-16 h-12 rounded border-2 border-dashed border-slate-700 hover:border-indigo-500 text-slate-500 hover:text-indigo-400 transition-colors flex items-center justify-center"
          title="Add page"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        </button>
      )}

      <div className="ml-auto text-slate-600 text-xs whitespace-nowrap">
        {currentPageIndex + 1} / {pages.length}
      </div>
    </div>
  );
}