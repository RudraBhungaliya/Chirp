// Simple deduplicating emitter for message events
const recentEmits = new Map();
const WINDOW_MS = 3000; // dedupe window

function cleanup() {
  const now = Date.now();
  for (const [key, ts] of recentEmits) {
    if (now - ts > WINDOW_MS) recentEmits.delete(key);
  }
}

setInterval(cleanup, WINDOW_MS).unref?.();

export function emitNewMessage(io, chatId, message) {
  if (!message || !message._id) {
    io.to(chatId).emit("new_message", message);
    return;
  }

  const id = String(message._id);
  const now = Date.now();
  if (recentEmits.has(id)) return; // already emitted recently

  recentEmits.set(id, now);
  io.to(chatId).emit("new_message", message);
}

export default { emitNewMessage };
