const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const rm = require("./roomManager");

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3001;

const io = new Server(server, {
  cors: {
    origin: true,
    methods: ["GET", "POST"],
    credentials: true,
  },
  maxHttpBufferSize: 10e6, // 10 MB for image/PDF uploads
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "10mb" }));

app.get("/health", (req, res) => res.json({ status: "ok" }));

// Serve static files in production
const distPath = path.join(__dirname, "../client/dist");
if (process.env.NODE_ENV === "production" || fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get("*", (req, res) =>
    res.sendFile(path.join(distPath, "index.html"))
  );
}

io.on("connection", (socket) => {
  console.log(`[socket] connected: ${socket.id}`);
  let currentRoomCode = null;

  // ─── JOIN ROOM ────────────────────────────────────────────────────────────
  socket.on("join-room", ({ roomCode, role, userName }) => {
    if (!roomCode || !role) return;
    const code = roomCode.toUpperCase().trim();
    currentRoomCode = code;
    socket.join(code);

    const { room, userId } = rm.addUser(code, socket.id, role, userName || role);
    const users = rm.getUsersArray(room);
    const state = rm.getRoomState(room);

    // Send full room state to the joiner
    socket.emit("room:joined", { userId, users, state });

    // Notify others
    socket.to(code).emit("user:joined", { userId, role, userName: userName || role });

    console.log(`[room] ${userName || role} (${role}) joined room ${code}`);
  });

  // ─── LIVE STROKE STREAMING (Real-time inking point-by-point) ──────────────
  socket.on("stroke:start", ({ roomCode, pageIndex, strokeId, point, tool, color, size }) => {
    socket.to(roomCode).emit("stroke:start", { pageIndex, strokeId, point, tool, color, size });
  });

  socket.on("stroke:points", ({ roomCode, pageIndex, strokeId, points }) => {
    socket.to(roomCode).emit("stroke:points", { pageIndex, strokeId, points });
  });

  socket.on("stroke:end", ({ roomCode, pageIndex, strokeId, object }) => {
    const room = rm.getRoom(roomCode);
    if (room && object) {
      rm.applyObjectAdd(room, pageIndex, object);
    }
    socket.to(roomCode).emit("stroke:end", { pageIndex, strokeId, object });
  });

  // ─── DRAWING: ADD ─────────────────────────────────────────────────────────
  socket.on("draw:add", ({ roomCode, pageIndex, object }) => {
    const room = rm.getRoom(roomCode);
    if (!room) return;
    rm.applyObjectAdd(room, pageIndex, object);
    socket.to(roomCode).emit("draw:add", { pageIndex, object });
  });

  // ─── DRAWING: MODIFY ──────────────────────────────────────────────────────
  socket.on("draw:modify", ({ roomCode, pageIndex, id, object }) => {
    const room = rm.getRoom(roomCode);
    if (!room) return;
    rm.applyObjectModify(room, pageIndex, id, object);
    socket.to(roomCode).emit("draw:modify", { pageIndex, id, object });
  });

  // ─── DRAWING: REMOVE ──────────────────────────────────────────────────────
  socket.on("draw:remove", ({ roomCode, pageIndex, id }) => {
    const room = rm.getRoom(roomCode);
    if (!room) return;
    rm.applyObjectRemove(room, pageIndex, id);
    socket.to(roomCode).emit("draw:remove", { pageIndex, id });
  });

  // ─── CLEAR PAGE ───────────────────────────────────────────────────────────
  socket.on("draw:clear", ({ roomCode, pageIndex }) => {
    const room = rm.getRoom(roomCode);
    if (!room) return;
    rm.clearPage(room, pageIndex);
    socket.to(roomCode).emit("draw:clear", { pageIndex });
  });

  // ─── CURSOR MOVE ──────────────────────────────────────────────────────────
  socket.on("cursor:move", ({ roomCode, x, y, userId, role }) => {
    socket.to(roomCode).emit("cursor:move", { userId, role, x, y });
  });

  // ─── PAGE: ADD ────────────────────────────────────────────────────────────
  // ─── PAGE: ADD ────────────────────────────────────────────────────
  socket.on("page:add", ({ roomCode }) => {
    const code = (roomCode || currentRoomCode || "").toUpperCase().trim();
    const room = rm.getRoom(code);
    if (!room) return;
    const newIndex = rm.addPage(room);
    room.currentPageIndex = newIndex;
    const bg = room.pages[newIndex]?.background || "whiteboard";
    io.to(code).emit("page:added", {
      pageIndex: newIndex,
      page: room.pages[newIndex],
    });
    io.to(code).emit("page:navigated", { pageIndex: newIndex, background: bg });
  });

  // ─── PAGE: DELETE ─────────────────────────────────────────────────────────
  socket.on("page:delete", ({ roomCode, pageIndex }) => {
    const code = (roomCode || currentRoomCode || "").toUpperCase().trim();
    const room = rm.getRoom(code);
    if (!room) return;
    const ok = rm.deletePage(room, pageIndex);
    if (ok) {
      const newIndex = room.currentPageIndex;
      const bg = room.pages[newIndex]?.background || "whiteboard";
      io.to(code).emit("page:deleted", {
        pageIndex,
        newIndex,
      });
      io.to(code).emit("page:navigated", { pageIndex: newIndex, background: bg });
    }
  });

  // ─── PAGE: NAVIGATE ───────────────────────────────────────────────────────
  socket.on("page:navigate", ({ roomCode, pageIndex }) => {
    const code = (roomCode || currentRoomCode || "").toUpperCase().trim();
    const room = rm.getRoom(code);
    if (!room) return;
    if (pageIndex >= 0 && pageIndex < room.pages.length) {
      room.currentPageIndex = pageIndex;
      const bg = room.pages[pageIndex]?.background || "whiteboard";
      socket.to(code).emit("page:navigated", { pageIndex, background: bg });
    }
  });

  // ─── BACKGROUND CHANGE ────────────────────────────────────────────────────
  socket.on("background:change", ({ roomCode, pageIndex, background }) => {
    const code = (roomCode || currentRoomCode || "").toUpperCase().trim();
    const room = rm.getRoom(code);
    if (!room) return;
    if (!room.pages[pageIndex]) {
      room.pages[pageIndex] = { objects: [], background };
    } else {
      room.pages[pageIndex].background = background;
    }
    socket.to(code).emit("background:changed", { pageIndex, background });
  });

  // ─── QUESTION UPDATE ──────────────────────────────────────────────────────
  socket.on("question:update", ({ roomCode, text }) => {
    const room = rm.getRoom(roomCode);
    if (!room) return;
    room.question = text;
    socket.to(roomCode).emit("question:updated", { text });
  });

  // ─── STUDENT LOCK ─────────────────────────────────────────────────────────
  socket.on("student:lock", ({ roomCode, locked }) => {
    const room = rm.getRoom(roomCode);
    if (!room) return;
    room.studentLocked = locked;
    io.to(roomCode).emit("student:locked", { locked });
  });

  // ─── IMAGE ADD ────────────────────────────────────────────────────────────
  socket.on("image:add", ({ roomCode, pageIndex, object }) => {
    const room = rm.getRoom(roomCode);
    if (!room) return;
    rm.applyObjectAdd(room, pageIndex, object);
    socket.to(roomCode).emit("draw:add", { pageIndex, object });
  });

  // ─── DISCONNECT ───────────────────────────────────────────────────────────
  socket.on("disconnect", () => {
    if (currentRoomCode) {
      const room = rm.getRoom(currentRoomCode);
      if (room) {
        const userInfo = room.users.get(socket.id);
        if (userInfo) {
          socket.to(currentRoomCode).emit("user:left", { userId: userInfo.userId });
        }
      }
      rm.removeUser(currentRoomCode, socket.id);
    }
    console.log(`[socket] disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`MathBoard server running on port ${PORT}`);
});