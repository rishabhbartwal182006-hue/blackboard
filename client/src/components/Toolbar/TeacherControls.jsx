export default function TeacherControls({ studentLocked, onLockToggle }) {
  return (
    <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
      <button
        onClick={() => onLockToggle(!studentLocked)}
        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors font-medium ${
          studentLocked
            ? "bg-red-900/80 border-red-700/50 text-red-200 hover:bg-red-800/80"
            : "bg-slate-800/80 border-slate-700/50 text-slate-300 hover:bg-slate-700/80"
        }`}
        title={studentLocked ? "Unlock student writing" : "Lock student writing"}
      >
        {studentLocked ? (
          <>
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/>
            </svg>
            Student Locked
          </>
        ) : (
          <>
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 1C9.24 1 7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2H9V6c0-1.66 1.34-3 3-3 1.18 0 2.19.68 2.68 1.68l1.65-1.65C15.36 1.87 13.78 1 12 1zm0 13c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/>
            </svg>
            Lock Student
          </>
        )}
      </button>
    </div>
  );
}