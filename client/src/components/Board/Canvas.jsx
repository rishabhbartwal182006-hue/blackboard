import {
  useEffect, useRef, useImperativeHandle, forwardRef, useState, useCallback
} from "react";
import { fabric } from "fabric";
import { nanoid } from "nanoid";
import { getStroke } from "perfect-freehand";
import {
  serializeObject, applyRemoteAdd, applyRemoteModify,
  applyRemoteRemove, loadPageObjects, getPageObjects,
} from "../../utils/canvasSync.js";
import { mathToDataUrl } from "../../utils/mathRenderer.js";
import MathInputModal from "./MathInputModal.jsx";

const MAX_HISTORY = 60;
const CURSOR_THROTTLE = 40;

// Convert perfect-freehand polygon outline into an SVG path string
function getSvgPathFromStroke(stroke) {
  if (!stroke || stroke.length === 0) return "";
  const d = stroke.reduce(
    (acc, [x0, y0], i, arr) => {
      const [x1, y1] = arr[(i + 1) % arr.length];
      acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
      return acc;
    },
    ["M", ...stroke[0], "Q"]
  );
  d.push("Z");
  return d.join(" ");
}

// Calibrate pressure so line thickness remains steady, natural, and never balloons or vanishes
function calibratePressure(p) {
  if (typeof p !== "number" || p <= 0) return 0.5;
  // Natural gentle compression curve: range comfortably between 0.38 and 0.68
  return 0.38 + 0.30 * Math.min(Math.max(p, 0), 1);
}

// OpenBoard-grade stroke tuning: velocity & pressure smoothing
function getStrokeOptions(tool, size, isPenDevice) {
  if (tool === "highlighter") {
    return {
      size: Math.max(12, size * 4),
      thinning: 0.02,       // Flat marker ribbon
      smoothing: 0.65,
      streamline: 0.5,
      simulatePressure: false,
      start: { taper: 0, cap: true },
      end: { taper: 0, cap: true },
    };
  }
  if (tool === "pencil") {
    return {
      size: Math.max(1, size * 0.9),
      thinning: 0.28,        // Subtle natural pencil texture
      smoothing: 0.55,
      streamline: 0.45,
      simulatePressure: !isPenDevice,
      start: { taper: 2, cap: true },
      end: { taper: 2, cap: true },
    };
  }
  // Default: "pen" (Gentle OpenBoard-style handwriting, consistent controlled line width)
  return {
    size: Math.max(1.8, size * 1.35),
    thinning: 0.20,          // Gentle, natural variation (no wild spikes or oversized blobbing!)
    smoothing: 0.65,         // Eliminates digitizer jitter
    streamline: 0.52,        // Stabilizes freehand curves
    simulatePressure: !isPenDevice,
    easing: (t) => t,
    start: { taper: 2, cap: true },
    end: { taper: 2, cap: true },
  };
}

const Canvas = forwardRef(function Canvas(
  { socket, roomCode, role, tool, color, size, eraserSize = 36, pageIndex, pages,
    background, studentLocked, onZoomChange, onCursorMove, onToolChange },
  ref
) {
  const containerRef     = useRef(null);
  const canvasElRef      = useRef(null);
  const overlayCanvasRef = useRef(null);
  const bgLayerRef       = useRef(null);
  const fabricRef        = useRef(null);

  // Synchronous prop mirrors
  const toolRef           = useRef(tool);
  const colorRef          = useRef(color);
  const sizeRef           = useRef(size);
  const eraserSizeRef     = useRef(eraserSize);
  const pageIndexRef      = useRef(pageIndex);
  const studentLockedRef  = useRef(studentLocked);
  const backgroundRef     = useRef(background);
  const socketRef         = useRef(socket);
  const roomCodeRef       = useRef(roomCode);

  // Active stroke state
  const currentStrokeRef      = useRef(null); // { strokeId, points: [[x,y,pressure]], isPenDevice, tool, color, size }
  const remoteLiveStrokesRef  = useRef({});   // { [strokeId]: { points, tool, color, size } }
  const pendingPointsRef      = useRef([]);
  const lastStrokeEmitRef     = useRef(0);
  const isErasingRef          = useRef(false);
  const prevToolRef           = useRef(null);
  const isPanningRef          = useRef(false);
  const panStartRef       = useRef(null);
  const isSpacePressedRef = useRef(false);
  const isDrawingShapeRef = useRef(false);
  const shapeOriginRef    = useRef(null);
  const activeShapeRef    = useRef(null);
  const cursorLastEmit    = useRef(0);
  const isRemoteRef       = useRef(false);

  // Caches & undo/redo
  const pageObjectsRef = useRef({});
  const historyRef     = useRef({ stacks: {}, redos: {} });

  // Eraser visual cursor
  const eraserCursorRef = useRef(null);

  const updateEraserCursorPosition = useCallback((clientX, clientY) => {
    const el = eraserCursorRef.current;
    const container = containerRef.current;
    const canvas = fabricRef.current;
    if (!el || !container || !canvas) return;

    const isErase = toolRef.current === "eraser" || isErasingRef.current;
    if (!isErase) {
      el.style.display = "none";
      return;
    }

    const rect = container.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    if (x < -20 || x > rect.width + 20 || y < -20 || y > rect.height + 20) {
      el.style.display = "none";
      return;
    }

    const zoom = canvas.getZoom() || 1;
    const sizePx = (eraserSizeRef.current || 36) * zoom;

    el.style.display = "block";
    el.style.width  = `${sizePx}px`;
    el.style.height = `${sizePx}px`;
    el.style.left   = `${x}px`;
    el.style.top    = `${y}px`;
  }, []);

  // Math modal
  const [mathModal, setMathModal] = useState(null);
  const setMathModalRef = useRef(setMathModal);
  setMathModalRef.current = setMathModal;

  // ─── Imperative handle ────────────────────────────────────────────────────
  useImperativeHandle(ref, () => ({
    undo()           { doUndo(); },
    redo()           { doRedo(); },
    clearPage()      { doClear(); },
    zoomBy(f) {
      const c = fabricRef.current; if (!c) return;
      const z = Math.max(0.1, Math.min(5, c.getZoom() * f));
      c.zoomToPoint(new fabric.Point(c.width / 2, c.height / 2), z);
      onZoomChange?.(z); syncBg(c);
    },
    zoomReset() {
      const c = fabricRef.current; if (!c) return;
      c.setViewportTransform([1,0,0,1,0,0]);
      onZoomChange?.(1); syncBg(c);
    },
    addImageFromDataUrl(url, x, y) { addImage(url, x, y); },
    addMathObject(latex, x, y, fs) { placeMath(latex, x, y, fs); },
    getCurrentPageData() {
      const c = fabricRef.current;
      return {
        objects:    c ? getPageObjects(c) : [],
        background: backgroundRef.current || "whiteboard",
      };
    },
    loadPageData(objects, bg) {
      const c = fabricRef.current; if (!c) return;
      if (bg) {
        applyBackground(bg);
      }
      isRemoteRef.current = true;
      loadPageObjects(c, fabric, objects || [], () => {
        isRemoteRef.current = false;
        c.renderAll();
      });
    },
    exportAsPNG() {
      const c = fabricRef.current; if (!c) return;
      const url = c.toDataURL({ format: "png", multiplier: 2 });
      const a = document.createElement("a");
      a.href = url; a.download = `mathboard-${Date.now()}.png`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    },
    deleteSelected() {
      const c = fabricRef.current; if (!c) return;
      const active = c.getActiveObjects();
      if (!active.length) return;
      active.forEach(obj => {
        c.remove(obj);
        if (obj.id) emitRemove(obj.id);
      });
      c.discardActiveObject(); c.renderAll();
      pushHistory(pageIndexRef.current, c);
    },
  }), []);

  // Update prop refs
  toolRef.current          = tool;
  colorRef.current         = color;
  sizeRef.current          = size;
  eraserSizeRef.current    = eraserSize;
  studentLockedRef.current = studentLocked;
  backgroundRef.current    = background;
  socketRef.current        = socket;
  roomCodeRef.current      = roomCode;

  // ─── Initialize Fabric & Overlay Canvas ───────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    const el        = canvasElRef.current;
    const overlayEl = overlayCanvasRef.current;
    if (!container || !el || !overlayEl) return;

    const canvas = new fabric.Canvas(el, {
      isDrawingMode:          false, // We use custom perfect-freehand for OpenBoard smoothness & pressure!
      selection:              false,
      skipTargetFind:         true,  // Critical! Prevents Fabric from intercepting strokes on text/shapes
      preserveObjectStacking: true,
      enableRetinaScaling:    true,
      allowTouchScrolling:    false,
      fireRightClick:         true,
      stopContextMenu:        true,
    });
    fabricRef.current = canvas;

    const resizeCanvases = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      canvas.setWidth(w);
      canvas.setHeight(h);
      canvas.renderAll();
      overlayEl.width  = w * (window.devicePixelRatio || 1);
      overlayEl.height = h * (window.devicePixelRatio || 1);
      overlayEl.style.width  = `${w}px`;
      overlayEl.style.height = `${h}px`;
      syncBg(canvas);
    };

    const ro = new ResizeObserver(resizeCanvases);
    ro.observe(container);
    resizeCanvases();

    // Prevent browser right click context menu on the board so stylus barrel button doesn't trigger menus
    const handleContextMenu = (e) => e.preventDefault();
    container.addEventListener("contextmenu", handleContextMenu);

    // Object modifications
    canvas.on("object:added", (e) => { if (!e.target.id) e.target.id = nanoid(); });
    canvas.on("object:modified", (e) => {
      if (isRemoteRef.current || !e.target) return;
      socketRef.current?.emit("draw:modify", {
        roomCode: roomCodeRef.current, pageIndex: pageIndexRef.current,
        id: e.target.id, object: serializeObject(e.target),
      });
      pushHistory(pageIndexRef.current, canvas);
    });

    // Zoom on mouse wheel
    canvas.on("mouse:wheel", (opt) => {
      let z = canvas.getZoom() * (0.999 ** opt.e.deltaY);
      z = Math.max(0.1, Math.min(5, z));
      canvas.zoomToPoint(new fabric.Point(opt.e.offsetX, opt.e.offsetY), z);
      onZoomChange?.(z); syncBg(canvas);
      opt.e.preventDefault(); opt.e.stopPropagation();
    });

    // Spacebar tracking for easy panning
    const onDocKeyDown = (e) => {
      if (e.code === "Space" && !e.repeat && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        isSpacePressedRef.current = true;
        canvas.defaultCursor = "grab";
      }
    };
    const onDocKeyUp = (e) => {
      if (e.code === "Space") {
        isSpacePressedRef.current = false;
        updateCursor(canvas);
      }
    };
    window.addEventListener("keydown", onDocKeyDown);
    window.addEventListener("keyup", onDocKeyUp);

    // ─── POINTER EVENTS ON UPPER CANVAS (Precision Tablet & Stylus Input) ───
    const upper = canvas.upperCanvasEl;

    const handlePointerDown = (e) => {
      if (studentLockedRef.current && role === "student") return;

      const isStylus = e.pointerType === "pen";
      // Check for stylus barrel button (button 2 or buttons 2 or buttons 32) or eraser tip (button 5)
      const isBarrelOrEraser = e.button === 2 || (e.buttons & 2) !== 0 || e.button === 5 || (e.buttons & 32) !== 0;

      // 1. Middle-click or Spacebar or Alt-key -> Pan
      if (e.button === 1 || (e.buttons & 4) !== 0 || isSpacePressedRef.current || e.altKey) {
        isPanningRef.current = true;
        panStartRef.current  = { x: e.clientX, y: e.clientY };
        canvas.defaultCursor = "grabbing";
        return;
      }

      // 2. Stylus barrel button pressed OR Eraser tool -> Erase!
      if (isBarrelOrEraser || toolRef.current === "eraser") {
        isErasingRef.current = true;
        if (toolRef.current !== "eraser") {
          prevToolRef.current = toolRef.current;
          onToolChange?.("eraser");
        }
        canvas.defaultCursor = "none";
        updateEraserCursorPosition(e.clientX, e.clientY);
        const pt = canvas.getPointer(e);
        eraseAt(canvas, pt, (eraserSizeRef.current || 36) / 2);
        return;
      }

      const t = toolRef.current;
      const pt = canvas.getPointer(e);

      // Deselect any active object when writing or drawing shapes
      if (t !== "select") {
        canvas.discardActiveObject();
      }

      // 3. Text tool
      if (t === "text") { addText(canvas, pt); return; }

      // 4. Math tool
      if (t === "math") { setMathModalRef.current({ x: pt.x, y: pt.y }); return; }

      // 5. Shapes
      if (["rect","circle","triangle","line","arrow"].includes(t)) {
        isDrawingShapeRef.current = true;
        shapeOriginRef.current    = pt;
        const shape = makeShapeStart(t, pt);
        if (shape) { shape.id = nanoid(); canvas.add(shape); activeShapeRef.current = shape; canvas.renderAll(); }
        return;
      }

      // 6. Freehand Drawing: Pen, Pencil, Highlighter
      if (t === "pen" || t === "pencil" || t === "highlighter") {
        // Read & calibrate hardware pressure from stylus
        const rawPr = (isStylus && e.pressure > 0) ? e.pressure : (e.pressure && e.pressure !== 0.5 ? e.pressure : 0.5);
        const pressure = calibratePressure(rawPr);
        const strokeId = nanoid();

        currentStrokeRef.current = {
          strokeId,
          points: [[pt.x, pt.y, pressure]],
          isPenDevice: isStylus,
          tool: t,
          color: colorRef.current,
          size: sizeRef.current,
        };

        pendingPointsRef.current = [];
        lastStrokeEmitRef.current = Date.now();

        // Broadcast initial stroke point immediately so remote students see it start
        socketRef.current?.emit("stroke:start", {
          roomCode: roomCodeRef.current,
          pageIndex: pageIndexRef.current,
          strokeId,
          point: [pt.x, pt.y, pressure],
          tool: t,
          color: colorRef.current,
          size: sizeRef.current,
        });

        // Render initial dot
        renderLiveOverlay();
      }
    };

    const handlePointerMove = (e) => {
      // Keep eraser visual circle locked to cursor/stylus position
      updateEraserCursorPosition(e.clientX, e.clientY);

      // Pan
      if (isPanningRef.current && panStartRef.current) {
        canvas.relativePan(new fabric.Point(e.clientX - panStartRef.current.x, e.clientY - panStartRef.current.y));
        panStartRef.current = { x: e.clientX, y: e.clientY };
        syncBg(canvas);
        return;
      }

      // Cursor broadcast
      const now = Date.now();
      if (now - cursorLastEmit.current > CURSOR_THROTTLE) {
        cursorLastEmit.current = now;
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect) onCursorMove?.(e.clientX - rect.left, e.clientY - rect.top);
      }

      if (studentLockedRef.current && role === "student") return;

      const pt = canvas.getPointer(e);
      const isBarrelOrEraser = e.button === 2 || (e.buttons & 2) !== 0 || e.button === 5 || (e.buttons & 32) !== 0;

      // Erase
      if (isErasingRef.current || (isBarrelOrEraser && (e.buttons > 0))) {
        eraseAt(canvas, pt, (eraserSizeRef.current || 36) / 2);
        return;
      }

      // Shapes resize
      if (isDrawingShapeRef.current && activeShapeRef.current && shapeOriginRef.current) {
        resizeShape(toolRef.current, activeShapeRef.current, shapeOriginRef.current, pt);
        canvas.renderAll();
        return;
      }

      // Freehand drawing: append high-frequency points (coalesced events if supported)
      if (currentStrokeRef.current) {
        const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
        const newBatch = [];
        for (const ev of events) {
          const subPt = canvas.getPointer(ev);
          const rawPr = (ev.pointerType === "pen" && ev.pressure > 0) ? ev.pressure : (ev.pressure && ev.pressure !== 0.5 ? ev.pressure : 0.5);
          const pr = calibratePressure(rawPr);
          const point = [subPt.x, subPt.y, pr];
          currentStrokeRef.current.points.push(point);
          newBatch.push(point);
        }
        pendingPointsRef.current.push(...newBatch);

        // Stream in-progress points every 25ms to students for real-time inking
        const nowMove = Date.now();
        if (nowMove - lastStrokeEmitRef.current > 25 && pendingPointsRef.current.length > 0) {
          lastStrokeEmitRef.current = nowMove;
          socketRef.current?.emit("stroke:points", {
            roomCode: roomCodeRef.current,
            pageIndex: pageIndexRef.current,
            strokeId: currentStrokeRef.current.strokeId,
            points: pendingPointsRef.current,
          });
          pendingPointsRef.current = [];
        }

        renderLiveOverlay();
      }
    };

    const handlePointerUp = (e) => {
      if (isPanningRef.current) {
        isPanningRef.current = false;
        panStartRef.current  = null;
        updateCursor(canvas);
        return;
      }

      if (isErasingRef.current) {
        isErasingRef.current = false;
        if (prevToolRef.current) {
          onToolChange?.(prevToolRef.current);
          prevToolRef.current = null;
        }
        updateCursor(canvas);
        updateEraserCursorPosition(e.clientX, e.clientY);
      }

      if (isDrawingShapeRef.current && activeShapeRef.current) {
        isDrawingShapeRef.current = false;
        const shape = activeShapeRef.current;
        activeShapeRef.current = null;
        shape.setCoords();
        if (shapeTooSmall(shape)) { canvas.remove(shape); canvas.renderAll(); return; }
        emitAdd(serializeObject(shape));
        pushHistory(pageIndexRef.current, canvas);
        canvas.renderAll();
      }

      // Finalize freehand stroke
      if (currentStrokeRef.current) {
        const strokeData = currentStrokeRef.current;
        currentStrokeRef.current = null;
        pendingPointsRef.current = [];

        if (strokeData.points.length >= 2) {
          const strokeOptions = getStrokeOptions(strokeData.tool, strokeData.size, strokeData.isPenDevice);
          const strokeOutline = getStroke(strokeData.points, strokeOptions);
          const svgPath = getSvgPathFromStroke(strokeOutline);

          if (svgPath) {
            const fabricPath = new fabric.Path(svgPath, {
              fill: strokeData.color,
              stroke: null,
              selectable: false,
              evented: false,
              id: strokeData.strokeId || nanoid(),
              opacity: strokeData.tool === "highlighter" ? 0.38 : 1,
            });
            canvas.add(fabricPath);
            canvas.renderAll();

            // Stream stroke:end to remote users so they finalize the stroke smoothly
            socketRef.current?.emit("stroke:end", {
              roomCode: roomCodeRef.current,
              pageIndex: pageIndexRef.current,
              strokeId: strokeData.strokeId,
              object: serializeObject(fabricPath),
            });

            pushHistory(pageIndexRef.current, canvas);
          }
        }
        renderLiveOverlay();
      }
    };

    const handlePointerLeave = () => {
      if (eraserCursorRef.current) eraserCursorRef.current.style.display = "none";
    };
    const handlePointerEnter = (e) => {
      updateEraserCursorPosition(e.clientX, e.clientY);
    };

    upper.addEventListener("pointerdown", handlePointerDown);
    upper.addEventListener("pointermove", handlePointerMove);
    upper.addEventListener("pointerup",   handlePointerUp);
    upper.addEventListener("pointercancel", handlePointerUp);
    container.addEventListener("pointerleave", handlePointerLeave);
    container.addEventListener("pointerenter", handlePointerEnter);
    window.addEventListener("pointerup",   handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      ro.disconnect();
      window.removeEventListener("keydown", onDocKeyDown);
      window.removeEventListener("keyup", onDocKeyUp);
      container.removeEventListener("contextmenu", handleContextMenu);
      upper.removeEventListener("pointerdown", handlePointerDown);
      upper.removeEventListener("pointermove", handlePointerMove);
      upper.removeEventListener("pointerup",   handlePointerUp);
      upper.removeEventListener("pointercancel", handlePointerUp);
      container.removeEventListener("pointerleave", handlePointerLeave);
      container.removeEventListener("pointerenter", handlePointerEnter);
      window.removeEventListener("pointerup",   handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
      canvas.dispose();
      fabricRef.current = null;
    };
  }, []);

  // ─── Live Overlay Renderer (Instant zero-latency drawing) ─────────────────
  function renderLiveOverlay() {
    const canvas     = fabricRef.current;
    const overlayEl  = overlayCanvasRef.current;
    if (!canvas || !overlayEl) return;

    const ctx = overlayEl.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.clearRect(0, 0, overlayEl.width, overlayEl.height);

    // Sync transform with Fabric canvas viewport
    const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0];
    ctx.scale(dpr, dpr);
    ctx.transform(vpt[0], vpt[1], vpt[2], vpt[3], vpt[4], vpt[5]);

    const drawOneStroke = (strokeData) => {
      if (!strokeData || !strokeData.points || strokeData.points.length < 2) return;
      const strokeOptions = getStrokeOptions(strokeData.tool, strokeData.size, strokeData.isPenDevice);
      const strokeOutline = getStroke(strokeData.points, strokeOptions);
      const svgPath       = getSvgPathFromStroke(strokeOutline);
      if (svgPath) {
        ctx.fillStyle   = strokeData.color;
        ctx.globalAlpha = strokeData.tool === "highlighter" ? 0.38 : 1;
        const path2d    = new Path2D(svgPath);
        ctx.fill(path2d);
      }
    };

    // 1. Draw local in-progress stroke
    if (currentStrokeRef.current) {
      drawOneStroke(currentStrokeRef.current);
    }

    // 2. Draw all remote in-progress strokes in real-time
    if (remoteLiveStrokesRef.current) {
      Object.values(remoteLiveStrokesRef.current).forEach(drawOneStroke);
    }

    ctx.restore();
  }

  function clearLiveOverlay() {
    const overlayEl = overlayCanvasRef.current;
    if (!overlayEl) return;
    const ctx = overlayEl.getContext("2d");
    ctx.clearRect(0, 0, overlayEl.width, overlayEl.height);
  }

  function updateCursor(canvas) {
    if (!canvas) return;
    const t = toolRef.current;
    if (studentLockedRef.current && role === "student") {
      canvas.defaultCursor = "not-allowed";
    } else if (t === "select") {
      canvas.defaultCursor = "default";
    } else if (t === "eraser") {
      canvas.defaultCursor = "none";
    } else if (t === "text") {
      canvas.defaultCursor = "text";
    } else {
      canvas.defaultCursor = "crosshair";
    }
  }

  // ─── Socket events ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    // Real-time live inking: remote stroke started
    socket.on("stroke:start", ({ pageIndex: pi, strokeId, point, tool: rTool, color: rColor, size: rSize }) => {
      if (pi !== pageIndexRef.current) return;
      remoteLiveStrokesRef.current[strokeId] = {
        strokeId,
        points: [point],
        tool: rTool,
        color: rColor,
        size: rSize,
        isPenDevice: true,
      };
      renderLiveOverlay();
    });

    // Real-time live inking: continuous stream of points as teacher draws
    socket.on("stroke:points", ({ pageIndex: pi, strokeId, points }) => {
      if (pi !== pageIndexRef.current) return;
      const stroke = remoteLiveStrokesRef.current[strokeId];
      if (stroke && points && points.length) {
        stroke.points.push(...points);
        renderLiveOverlay();
      }
    });

    // Real-time live inking: stroke completed
    socket.on("stroke:end", ({ pageIndex: pi, strokeId, object }) => {
      delete remoteLiveStrokesRef.current[strokeId];
      renderLiveOverlay();

      if (pi !== pageIndexRef.current) {
        (pageObjectsRef.current[pi] = pageObjectsRef.current[pi] || []).push(object);
        return;
      }

      isRemoteRef.current = true;
      applyRemoteAdd(fabricRef.current, fabric, object, () => {
        isRemoteRef.current = false;
      });
    });

    socket.on("draw:add", ({ pageIndex: pi, object }) => {
      if (pi !== pageIndexRef.current) {
        (pageObjectsRef.current[pi] = pageObjectsRef.current[pi] || []).push(object);
        return;
      }
      isRemoteRef.current = true;
      applyRemoteAdd(fabricRef.current, fabric, object, () => { isRemoteRef.current = false; });
    });
    socket.on("draw:modify", ({ pageIndex: pi, id, object }) => {
      if (pi !== pageIndexRef.current) return;
      isRemoteRef.current = true;
      applyRemoteModify(fabricRef.current, fabric, id, object);
      isRemoteRef.current = false;
    });
    socket.on("draw:remove", ({ pageIndex: pi, id }) => {
      if (pi !== pageIndexRef.current) return;
      isRemoteRef.current = true;
      applyRemoteRemove(fabricRef.current, id);
      isRemoteRef.current = false;
    });
    socket.on("draw:clear", ({ pageIndex: pi }) => {
      if (pi !== pageIndexRef.current) return;
      isRemoteRef.current = true;
      doClear(false);
      isRemoteRef.current = false;
    });
    socket.on("background:changed", ({ pageIndex: pi, background: bg }) => {
      if (pi === pageIndexRef.current) {
        applyBackground(bg);
      }
    });
    return () => {
      socket.off("stroke:start");
      socket.off("stroke:points");
      socket.off("stroke:end");
      socket.off("draw:add");
      socket.off("draw:modify");
      socket.off("draw:remove");
      socket.off("draw:clear");
      socket.off("background:changed");
    };
  }, [socket]);

  // ─── Tool selection sync ──────────────────────────────────────────────────
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const isSelect = tool === "select" && !(studentLocked && role === "student");
    canvas.isDrawingMode = false;
    canvas.selection = isSelect;
    canvas.skipTargetFind = !isSelect; // When writing or drawing, completely disable object hit-testing!
    if (!isSelect) {
      canvas.discardActiveObject();
    }
    canvas.getObjects().forEach(o => {
      if (!o._isBg) {
        o.selectable = isSelect;
        o.evented    = isSelect;
      }
    });
    canvas.renderAll();
    updateCursor(canvas);

    if (tool !== "eraser" && !isErasingRef.current && eraserCursorRef.current) {
      eraserCursorRef.current.style.display = "none";
    }
  }, [tool, studentLocked, role]);

  // ─── Eraser size sync ─────────────────────────────────────────────────────
  useEffect(() => {
    eraserSizeRef.current = eraserSize;
    if (toolRef.current === "eraser" && eraserCursorRef.current && eraserCursorRef.current.style.display !== "none") {
      const zoom = fabricRef.current?.getZoom() || 1;
      const sizePx = eraserSize * zoom;
      eraserCursorRef.current.style.width  = `${sizePx}px`;
      eraserCursorRef.current.style.height = `${sizePx}px`;
    }
  }, [eraserSize]);

  // ─── Page switch ───────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = fabricRef.current; if (!canvas) return;
    remoteLiveStrokesRef.current = {};
    clearLiveOverlay();
    pageObjectsRef.current[pageIndexRef.current] = getPageObjects(canvas);
    pageIndexRef.current = pageIndex;
    const targetBg = pages[pageIndex]?.background || backgroundRef.current || "whiteboard";
    applyBackground(targetBg);
    const cached = pageObjectsRef.current[pageIndex];
    const fromServer = pages[pageIndex]?.objects || [];
    const objects = cached?.length ? cached : fromServer;
    isRemoteRef.current = true;
    loadPageObjects(canvas, fabric, objects, () => { isRemoteRef.current = false; canvas.renderAll(); });
  }, [pageIndex]);

  // ─── Background switch ─────────────────────────────────────────────────────
  useEffect(() => {
    applyBackground(background);
  }, [background]);

  function applyBackground(type = "whiteboard") {
    const bg = bgLayerRef.current;
    if (!bg) return;
    const t = type || "whiteboard";
    backgroundRef.current = t;
    bg.className = `absolute inset-0 bg-${t}`;
    if (t === "blackboard") {
      bg.style.backgroundColor = "#1a3c2e";
      bg.style.backgroundImage = "none";
    } else if (t === "whiteboard") {
      bg.style.backgroundColor = "#ffffff";
      bg.style.backgroundImage = "none";
    } else if (t === "grid") {
      bg.style.backgroundColor = "#f8f9fa";
      bg.style.backgroundImage = "linear-gradient(rgba(0,0,0,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.08) 1px, transparent 1px)";
    } else if (t === "ruled") {
      bg.style.backgroundColor = "#ffffff";
      bg.style.backgroundImage = "linear-gradient(transparent calc(100% - 1px), #a8c0e8 1px)";
    }
    syncBg(fabricRef.current);
  }

  // ─── Drag and drop ────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const over  = (e) => { e.preventDefault(); el.classList.add("drop-zone-active"); };
    const leave = ()  => el.classList.remove("drop-zone-active");
    const drop  = async (e) => {
      e.preventDefault(); el.classList.remove("drop-zone-active");
      const file = e.dataTransfer?.files?.[0]; if (!file) return;
      if (file.type === "application/pdf") {
        await handlePdfFile(file);
      } else if (file.type.startsWith("image/")) {
        const r = new FileReader();
        r.onload = (ev) => addImage(ev.target.result);
        r.readAsDataURL(file);
      }
    };
    el.addEventListener("dragover", over);
    el.addEventListener("dragleave", leave);
    el.addEventListener("drop", drop);
    return () => { el.removeEventListener("dragover", over); el.removeEventListener("dragleave", leave); el.removeEventListener("drop", drop); };
  }, []);

  // ─── Background Sync ───────────────────────────────────────────────────────
  function syncBg(canvas) {
    const bg = bgLayerRef.current; if (!canvas || !bg) return;
    const zoom = canvas.getZoom();
    const vpt  = canvas.viewportTransform || [1,0,0,1,0,0];
    const type = backgroundRef.current;
    if (type === "grid") {
      const gs = 30 * zoom;
      const ox = ((vpt[4] % gs) + gs) % gs;
      const oy = ((vpt[5] % gs) + gs) % gs;
      bg.style.backgroundSize     = `${gs}px ${gs}px`;
      bg.style.backgroundPosition = `${ox}px ${oy}px`;
    } else if (type === "ruled") {
      const ls = 32 * zoom;
      const oy = ((vpt[5] % ls) + ls) % ls;
      bg.style.backgroundSize     = `100% ${ls}px`;
      bg.style.backgroundPosition = `0 ${oy}px`;
    } else {
      bg.style.backgroundSize = bg.style.backgroundPosition = "";
    }
  }

  // ─── Shape Builders ───────────────────────────────────────────────────────
  function makeShapeStart(type, p) {
    const opts = {
      left: p.x, top: p.y,
      fill: "transparent",
      stroke: colorRef.current,
      strokeWidth: sizeRef.current,
      selectable: true, evented: true,
    };
    if (type === "rect")     return new fabric.Rect({ ...opts, width: 1, height: 1 });
    if (type === "circle")   return new fabric.Circle({ ...opts, radius: 1, originX:"left", originY:"top" });
    if (type === "triangle") return new fabric.Triangle({ ...opts, width: 1, height: 1 });
    if (type === "line" || type === "arrow")
      return new fabric.Line([p.x,p.y,p.x,p.y], { stroke: colorRef.current, strokeWidth: sizeRef.current, selectable:true, evented:true, strokeLineCap:"round" });
    return null;
  }

  function resizeShape(type, shape, o, p) {
    if (type === "rect" || type === "triangle") {
      const w = p.x-o.x, h = p.y-o.y;
      shape.set({ left: w>=0?o.x:p.x, top: h>=0?o.y:p.y, width: Math.abs(w), height: Math.abs(h) });
    } else if (type === "circle") {
      const r = Math.hypot(p.x-o.x, p.y-o.y)/2;
      shape.set({ left: Math.min(o.x,p.x), top: Math.min(o.y,p.y), radius: r });
    } else if (type === "line" || type === "arrow") {
      shape.set({ x2: p.x, y2: p.y });
    }
    shape.setCoords();
  }

  function shapeTooSmall(s) {
    if (s.width  !== undefined && s.height  !== undefined) return s.width < 3 && s.height < 3;
    if (s.radius !== undefined)                             return s.radius < 2;
    if (s.x1     !== undefined)                             return Math.hypot(s.x2-s.x1, s.y2-s.y1) < 5;
    return false;
  }

  // ─── Text & Math Placement ─────────────────────────────────────────────────
  function addText(canvas, pointer) {
    const itext = new fabric.IText("", {
      left: pointer.x, top: pointer.y,
      fontSize:   Math.max(16, sizeRef.current * 4),
      fill:       colorRef.current,
      fontFamily: "Inter, sans-serif",
      id:         nanoid(),
      selectable: true, evented: true,
    });
    canvas.add(itext);
    canvas.setActiveObject(itext);
    itext.enterEditing();
    canvas.renderAll();
    itext.on("editing:exited", () => {
      const txt = itext.text?.trim();
      if (!txt) { canvas.remove(itext); canvas.renderAll(); return; }
      emitAdd(serializeObject(itext));
      pushHistory(pageIndexRef.current, canvas);
    });
  }

  async function placeMath(latex, x, y, fontSize = 26) {
    const canvas = fabricRef.current; if (!canvas || !latex) return;
    try {
      const dataUrl = await mathToDataUrl(latex, colorRef.current, fontSize);
      fabric.Image.fromURL(dataUrl, (img) => {
        img.set({ left: x, top: y, selectable: true, evented: true, id: nanoid(), _isMath: true, _latex: latex });
        canvas.add(img); canvas.setActiveObject(img); canvas.renderAll();
        emitAdd(serializeObject(img));
        pushHistory(pageIndexRef.current, canvas);
      }, { crossOrigin: "anonymous" });
    } catch (err) { console.error("Math render error:", err); }
  }

  function addImage(dataUrl, x = 80, y = 80) {
    const canvas = fabricRef.current; if (!canvas) return;
    fabric.Image.fromURL(dataUrl, (img) => {
      const maxW = canvas.width * 0.65;
      if (img.width > maxW) { const s = maxW/img.width; img.scaleX = s; img.scaleY = s; }
      img.set({ left: x, top: y, selectable: true, evented: true, id: nanoid() });
      canvas.add(img); canvas.setActiveObject(img); canvas.renderAll();
      socketRef.current?.emit("image:add", { roomCode: roomCodeRef.current, pageIndex: pageIndexRef.current, object: serializeObject(img) });
      pushHistory(pageIndexRef.current, canvas);
    }, { crossOrigin: "anonymous" });
  }

  async function handlePdfFile(file) {
    try {
      const buf = await file.arrayBuffer();
      const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
      GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
      const pdf = await getDocument({ data: buf }).promise;
      for (let i = 1; i <= Math.min(pdf.numPages, 8); i++) {
        const page = await pdf.getPage(i);
        const vp   = page.getViewport({ scale: 1.5 });
        const tmp  = document.createElement("canvas");
        tmp.width = vp.width; tmp.height = vp.height;
        await page.render({ canvasContext: tmp.getContext("2d"), viewport: vp }).promise;
        addImage(tmp.toDataURL("image/png"), 30 + i * 8, 30 + i * 8);
      }
    } catch (err) { console.error("PDF error:", err); }
  }

  // ─── OpenBoard-style Object & Stroke Eraser ───────────────────────────────
  function eraseAt(canvas, pointer, radius) {
    const dummy = new fabric.Rect({
      left: pointer.x - radius, top: pointer.y - radius,
      width: radius * 2, height: radius * 2,
    });
    dummy.setCoords();
    const toRemove = canvas.getObjects().filter(o => {
      if (o._isBg) return false;
      if (o.intersectsWithObject && o.intersectsWithObject(dummy)) return true;
      // Distance check for small or single-point strokes
      const center = o.getCenterPoint ? o.getCenterPoint() : { x: o.left, y: o.top };
      return Math.hypot(center.x - pointer.x, center.y - pointer.y) <= (radius + Math.max(o.width || 0, o.height || 0) / 2);
    });

    if (toRemove.length) {
      toRemove.forEach(o => { canvas.remove(o); if (o.id) emitRemove(o.id); });
      canvas.renderAll();
      pushHistory(pageIndexRef.current, canvas);
    }
  }

  // ─── History (Undo / Redo) ─────────────────────────────────────────────────
  function pushHistory(pi, canvas) {
    const s = (historyRef.current.stacks[pi] = historyRef.current.stacks[pi] || []);
    historyRef.current.redos[pi] = [];
    s.push(JSON.stringify(getPageObjects(canvas)));
    if (s.length > MAX_HISTORY) s.shift();
  }

  function doUndo() {
    const canvas = fabricRef.current;
    const pi     = pageIndexRef.current;
    if (!canvas || !historyRef.current.stacks[pi]?.length) return;
    const cur  = JSON.stringify(getPageObjects(canvas));
    (historyRef.current.redos[pi] = historyRef.current.redos[pi] || []).push(cur);
    restoreSnap(canvas, JSON.parse(historyRef.current.stacks[pi].pop()), pi);
  }

  function doRedo() {
    const canvas = fabricRef.current;
    const pi     = pageIndexRef.current;
    if (!canvas || !historyRef.current.redos[pi]?.length) return;
    (historyRef.current.stacks[pi] = historyRef.current.stacks[pi] || []).push(JSON.stringify(getPageObjects(canvas)));
    restoreSnap(canvas, JSON.parse(historyRef.current.redos[pi].pop()), pi);
  }

  function restoreSnap(canvas, objects, pi) {
    isRemoteRef.current = true;
    loadPageObjects(canvas, fabric, objects, () => {
      isRemoteRef.current = false;
      socketRef.current?.emit("draw:clear", { roomCode: roomCodeRef.current, pageIndex: pi });
      objects.forEach(obj => socketRef.current?.emit("draw:add", { roomCode: roomCodeRef.current, pageIndex: pi, object: obj }));
    });
  }

  function doClear(broadcast = true) {
    const canvas = fabricRef.current; if (!canvas) return;
    const pi     = pageIndexRef.current;
    remoteLiveStrokesRef.current = {};
    clearLiveOverlay();
    if (broadcast) pushHistory(pi, canvas);
    const bgs = canvas.getObjects().filter(o => o._isBg);
    canvas.clear();
    bgs.forEach(o => canvas.add(o));
    canvas.renderAll();
    if (broadcast) socketRef.current?.emit("draw:clear", { roomCode: roomCodeRef.current, pageIndex: pi });
  }

  function emitAdd(obj)    { socketRef.current?.emit("draw:add",    { roomCode: roomCodeRef.current, pageIndex: pageIndexRef.current, object: obj }); }
  function emitRemove(id)  { socketRef.current?.emit("draw:remove", { roomCode: roomCodeRef.current, pageIndex: pageIndexRef.current, id }); }

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
      style={{ touchAction: "none" }}
    >
      {/* Background layer */}
      <div ref={bgLayerRef} className={`absolute inset-0 bg-${background}`} />

      {/* Fabric.js Canvas (persistent objects, selection, serialization) */}
      <canvas ref={canvasElRef} className="absolute inset-0" />

      {/* High-speed hardware-accelerated drawing overlay */}
      <canvas
        ref={overlayCanvasRef}
        className="absolute inset-0 pointer-events-none"
        style={{ zIndex: 4 }}
      />

      {/* High-visibility OpenBoard Eraser Cursor Ring (Never hidden by Windows Ink) */}
      <div
        ref={eraserCursorRef}
        className="pointer-events-none absolute top-0 left-0 rounded-full select-none"
        style={{
          display: "none",
          transform: "translate(-50%, -50%)",
          zIndex: 40,
          border: "2px solid rgba(255, 255, 255, 0.95)",
          boxShadow: "0 0 0 1.5px rgba(0, 0, 0, 0.8), inset 0 0 0 1px rgba(0, 0, 0, 0.5), 0 2px 10px rgba(0, 0, 0, 0.35)",
          backgroundColor: "rgba(239, 68, 68, 0.22)",
        }}
      >
        {/* Precision center crosshair dot */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-1.5 h-1.5 rounded-full bg-white ring-1 ring-black/80" />
        </div>
      </div>

      {/* Math input modal */}
      {mathModal && (
        <MathInputModal
          onPlace={(latex, fontSize) => {
            const pos = mathModal;
            setMathModal(null);
            if (latex) placeMath(latex, pos.x, pos.y, fontSize);
          }}
          onClose={() => setMathModal(null)}
          defaultColor={color}
        />
      )}
    </div>
  );
});

export default Canvas;