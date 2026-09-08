/**
 * Canvas sync utilities for serializing/deserializing Fabric.js objects
 * and handling delta-based real-time synchronization.
 */

// Properties to include when serializing Fabric objects
export const SERIALIZABLE_PROPS = [
  "id", "type", "left", "top", "width", "height", "scaleX", "scaleY",
  "angle", "fill", "stroke", "strokeWidth", "opacity", "path",
  "x1", "y1", "x2", "y2", "rx", "ry", "radius",
  "text", "fontSize", "fontFamily", "fontWeight", "fontStyle",
  "src", "crossOrigin", "_isHighlighter", "_isMath", "_latex",
  "selectable", "evented", "lockMovementX", "lockMovementY",
  "originX", "originY", "flipX", "flipY", "skewX", "skewY",
  "strokeLineCap", "strokeLineJoin", "strokeDashArray",
  "shadow", "visible", "backgroundColor",
];

/**
 * Serialize a Fabric object to a plain JSON object.
 */
export function serializeObject(obj) {
  return obj.toJSON(SERIALIZABLE_PROPS);
}

/**
 * Apply a remotely received "add" event to the Fabric canvas.
 */
export function applyRemoteAdd(canvas, fabricLib, objectData, onDone) {
  if (!objectData) return;
  fabricLib.util.enlivenObjects([objectData], (objects) => {
    objects.forEach((obj) => {
      // Avoid duplicate IDs
      const existing = canvas.getObjects().find((o) => o.id === obj.id);
      if (!existing) {
        obj.selectable = true;
        obj.evented = true;
        canvas.add(obj);
      }
    });
    canvas.renderAll();
    if (onDone) onDone();
  });
}

/**
 * Apply a remotely received "modify" event to the Fabric canvas.
 */
export function applyRemoteModify(canvas, fabricLib, id, objectData) {
  const existing = canvas.getObjects().find((o) => o.id === id);
  if (existing) {
    existing.set(objectData);
    existing.setCoords();
    canvas.renderAll();
  } else {
    // Object not found locally, add it
    applyRemoteAdd(canvas, fabricLib, objectData);
  }
}

/**
 * Apply a remotely received "remove" event to the Fabric canvas.
 */
export function applyRemoteRemove(canvas, id) {
  const obj = canvas.getObjects().find((o) => o.id === id);
  if (obj) {
    canvas.remove(obj);
    canvas.renderAll();
  }
}

/**
 * Load a full page state (array of object JSON) onto the canvas.
 */
export function loadPageObjects(canvas, fabricLib, objects, onDone) {
  const nonBgObjects = canvas.getObjects().filter((o) => !o._isBg);
  nonBgObjects.forEach((o) => canvas.remove(o));

  if (!objects || objects.length === 0) {
    canvas.renderAll();
    if (onDone) onDone();
    return;
  }

  fabricLib.util.enlivenObjects(objects, (enlivened) => {
    enlivened.forEach((obj) => canvas.add(obj));
    canvas.renderAll();
    if (onDone) onDone();
  });
}

/**
 * Get all non-background objects as serialized JSON array.
 */
export function getPageObjects(canvas) {
  return canvas
    .getObjects()
    .filter((o) => !o._isBg)
    .map((o) => serializeObject(o));
}