const ROLE_COLORS = {
  teacher: { dot: "#f59e0b", label: "bg-amber-500" },
  student: { dot: "#6366f1", label: "bg-indigo-500" },
};

export default function CursorOverlay({ cursors, users }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-40">
      {Object.entries(cursors).map(([uid, { x, y, role }]) => {
        const user = users.find((u) => u.userId === uid);
        const name = user?.userName || role || "User";
        const colors = ROLE_COLORS[role] || ROLE_COLORS.student;

        return (
          <div
            key={uid}
            className="remote-cursor"
            style={{ left: x, top: y }}
          >
            {/* Cursor pointer SVG */}
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M4 2L16 10L10 11L8 18L4 2Z"
                fill={colors.dot}
                stroke="white"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
            {/* Name label */}
            <div className={`remote-cursor-label ${colors.label} text-white text-xs`}>
              {name}
            </div>
          </div>
        );
      })}
    </div>
  );
}