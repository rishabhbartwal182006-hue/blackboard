# MathBoard — Real-Time Collaborative Math Teaching Platform

A real-time collaborative whiteboard platform inspired by OpenBoard, built for mathematics teaching.

## Features

- **Real-time collaboration** via Socket.IO — teacher and students on the same board simultaneously
- **Drawing tools**: Pen, Pencil, Highlighter, Eraser with pressure-sensitive support (Apple Pencil, stylus, tablet)
- **Shapes**: Rectangle, Circle, Triangle, Line, Arrow
- **Text and Math**: Text tool + LaTeX math rendering via KaTeX
- **Question Panel**: Teacher types questions with `$LaTeX$` support; students see rendered math in real time
- **4 Board Backgrounds**: Whiteboard, Blackboard, Grid Paper, Ruled Paper
- **Infinite canvas** with zoom (mouse wheel / pinch) and pan (alt+drag)
- **Multi-page support** with page thumbnails and navigation
- **Undo/Redo** per page
- **Image & PDF upload**: drag-and-drop or file picker (PDF rendered page-by-page)
- **Teacher Controls**: Lock/unlock student writing, clear page
- **Real-time cursors**: See other users' cursor positions
- **Auto-save**: Room state saved every 30s to disk, restored on rejoin
- **Room codes**: 6-character codes for easy classroom access

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite |
| Canvas | Fabric.js v5 |
| Real-time | Socket.IO v4 |
| Math | KaTeX |
| PDF | PDF.js |
| Styling | Tailwind CSS |
| Backend | Node.js + Express |
| Deployment | Render.com |

## Getting Started

### Development

1. **Install server dependencies:**
   ```bash
   cd server
   npm install
   ```

2. **Install client dependencies:**
   ```bash
   cd client
   npm install
   ```

3. **Start the server:**
   ```bash
   cd server
   npm run dev
   ```

4. **Start the client (new terminal):**
   ```bash
   cd client
   npm run dev
   ```

5. Open [http://localhost:5173](http://localhost:5173)

### Using the Platform

1. **Teacher**: Click "Create Room" → enter your name → share the 6-letter room code with students
2. **Student**: Click "Join Room" → enter the room code → join as Student
3. Both users land on the shared whiteboard in real time

## Drawing Tools

| Tool | Description |
|---|---|
| Select | Select and move objects |
| Pen | Smooth freehand drawing |
| Pencil | Lighter, textured stroke |
| Highlighter | Semi-transparent wide stroke |
| Eraser | Erase objects on contact |
| Rectangle/Circle/Triangle | Shape tools |
| Line/Arrow | Line drawing tools |
| Text | Click to add editable text |
| Math | Click to add LaTeX math as image |

## Question Panel

- Teacher clicks the **?** button in the top bar to open the question panel
- Type plain text or LaTeX math: `$\frac{1}{2}$` or `$$x^2 + y^2 = r^2$$`
- Click math symbols in the symbol toolbar for quick insertion
- Copy-paste from any source (ChatGPT, websites, documents) works natively
- Click **Publish** to send the question to all students
- Students see the rendered math in real time

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Alt+Drag` | Pan canvas |
| `Scroll` | Zoom in/out |
| `Ctrl+Enter` (in question) | Publish question |
| `Escape` (in question) | Cancel edit |

## Deployment on Render

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → New → Blueprint
3. Connect your GitHub repo
4. Render will detect `render.yaml` and deploy both services automatically
5. Set `CLIENT_URL` environment variable on the server service to your client's Render URL

## Project Structure

```
math-board/
├── client/               # React + Vite frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Board/         # Canvas, PageManager
│   │   │   ├── Toolbar/       # DrawingToolbar, ColorPicker, SizePicker, TeacherControls
│   │   │   ├── QuestionBox/   # QuestionPanel
│   │   │   ├── Classroom.jsx  # Main classroom layout
│   │   │   ├── RoomJoin.jsx   # Join/create room screen
│   │   │   └── CursorOverlay.jsx
│   │   ├── hooks/
│   │   │   ├── useSocket.js   # Socket.IO connection
│   │   │   └── useRoom.js     # Room state management
│   │   └── utils/
│   │       ├── mathRenderer.js # KaTeX helpers
│   │       └── canvasSync.js   # Fabric.js delta sync
│   └── package.json
└── server/
    ├── index.js          # Express + Socket.IO server
    ├── roomManager.js    # Room state + auto-save
    └── package.json
```