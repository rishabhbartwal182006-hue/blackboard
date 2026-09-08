const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");

const SAVE_DIR = path.join(__dirname, "saveData");
const AUTOSAVE_INTERVAL = 30000; // 30s
const SESSION_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

if (!fs.existsSync(SAVE_DIR)) fs.mkdirSync(SAVE_DIR, { recursive: true });

const rooms = new Map();

function createPage(background = "whiteboard") {
  return { objects: [], background };
}

function createRoom(code) {
  return {
    code,
    pages: [createPage()],
    currentPageIndex: 0,
    question: "",
    studentLocked: false,
    users: new Map(),
    lastActivity: Date.now(),
    autosaveTimer: null,
  };
}

function getRoom(code) {
  return rooms.get(code) || null;
}

function getOrCreateRoom(code) {
  if (!rooms.has(code)) {
    const saved = loadRoom(code);
    const room = saved ? saved : createRoom(code);
    room.users = new Map();
    room.autosaveTimer = setInterval(() => saveRoom(code), AUTOSAVE_INTERVAL);
    rooms.set(code, room);
  }
  return rooms.get(code);
}

function addUser(roomCode, socketId, role, userName) {
  const room = getOrCreateRoom(roomCode);
  const userId = uuidv4();
  room.users.set(socketId, { userId, role, userName, socketId });
  room.lastActivity = Date.now();
  return { room, userId };
}

function removeUser(roomCode, socketId) {
  const room = rooms.get(roomCode);
  if (!room) return;
  room.users.delete(socketId);
  room.lastActivity = Date.now();
  if (room.users.size === 0) {
    saveRoom(roomCode);
    if (room.autosaveTimer) clearInterval(room.autosaveTimer);
    // Keep room data in memory briefly, but remove after timeout
    setTimeout(() => {
      if (rooms.has(roomCode) && rooms.get(roomCode).users.size === 0) {
        rooms.delete(roomCode);
      }
    }, 5 * 60 * 1000); // 5 min grace period
  }
}

function getUsersArray(room) {
  return Array.from(room.users.values()).map(({ userId, role, userName }) => ({
    userId, role, userName,
  }));
}

// Page management
function addPage(room) {
  const bg = room.pages[room.currentPageIndex]?.background || "whiteboard";
  room.pages.push(createPage(bg));
  return room.pages.length - 1;
}

function deletePage(room, pageIndex) {
  if (room.pages.length <= 1) return false;
  room.pages.splice(pageIndex, 1);
  room.currentPageIndex = Math.max(0, Math.min(room.currentPageIndex, room.pages.length - 1));
  return true;
}

// Object-level sync helpers
function applyObjectAdd(room, pageIndex, object) {
  if (!room.pages[pageIndex]) return;
  const page = room.pages[pageIndex];
  page.objects.push(object);
}

function applyObjectModify(room, pageIndex, id, object) {
  if (!room.pages[pageIndex]) return;
  const page = room.pages[pageIndex];
  const idx = page.objects.findIndex((o) => o.id === id);
  if (idx !== -1) page.objects[idx] = object;
  else page.objects.push(object);
}

function applyObjectRemove(room, pageIndex, id) {
  if (!room.pages[pageIndex]) return;
  const page = room.pages[pageIndex];
  page.objects = page.objects.filter((o) => o.id !== id);
}

function clearPage(room, pageIndex) {
  if (room.pages[pageIndex]) room.pages[pageIndex].objects = [];
}

// Serialise room state for save/restore (exclude users and timers)
function getRoomState(room) {
  return {
    code: room.code,
    pages: room.pages,
    currentPageIndex: room.currentPageIndex,
    question: room.question,
    studentLocked: room.studentLocked,
    lastActivity: room.lastActivity,
  };
}

function saveRoom(code) {
  const room = rooms.get(code);
  if (!room) return;
  const filePath = path.join(SAVE_DIR, `${code}.json`);
  try {
    fs.writeFileSync(filePath, JSON.stringify(getRoomState(room)), "utf8");
  } catch (e) {
    console.error("Save error:", e.message);
  }
}

function loadRoom(code) {
  const filePath = path.join(SAVE_DIR, `${code}.json`);
  if (!fs.existsSync(filePath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (Date.now() - data.lastActivity > SESSION_EXPIRY) {
      fs.unlinkSync(filePath);
      return null;
    }
    return { ...data, users: new Map(), autosaveTimer: null };
  } catch (e) {
    return null;
  }
}

module.exports = {
  getRoom,
  getOrCreateRoom,
  addUser,
  removeUser,
  getUsersArray,
  addPage,
  deletePage,
  applyObjectAdd,
  applyObjectModify,
  applyObjectRemove,
  clearPage,
  saveRoom,
  getRoomState,
};