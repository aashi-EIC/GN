type Progress = Readonly<{
  text: string;
  status: string;
  interrupted?: boolean;
  restored?: boolean;
}>;
const idle: Progress = { text: "", status: "Analyzing your data" };

/** Per-workspace, in-memory previews. Token updates never touch conversation history. */
export function createStreamProgress() {
  const snapshots = new Map<string, Progress>();
  const pending = new Map<
    string,
    { text: string; visibleLength: number; revealUntil: number; timer?: number }
  >();
  const listeners = new Map<string, Set<() => void>>();
  const notify = (id: string) => listeners.get(id)?.forEach((listener) => listener());
  const store = {
    getSnapshot: (id: string): Progress => snapshots.get(id) ?? idle,
    subscribe(id: string, listener: () => void) {
      const subscribers = listeners.get(id) ?? new Set();
      subscribers.add(listener);
      listeners.set(id, subscribers);
      return () => {
        subscribers.delete(listener);
        if (!subscribers.size) listeners.delete(id);
      };
    },
    append(id: string, delta: string) {
      if (!delta) return;
      let buffer = pending.get(id);
      if (!buffer) {
        buffer = { text: "", visibleLength: 0, revealUntil: 0 };
        pending.set(id, buffer);
      }
      buffer.text += delta;
      if (buffer.timer !== undefined) return;
      const batch = buffer;
      // Small deltas remain immediate on the next batch. Large bursts catch up in
      // three batches, without delaying completion or increasing the render rate.
      batch.revealUntil = performance.now() + 150;
      const flush = () => {
        if (pending.get(id) !== batch) return;
        batch.timer = undefined;
        const remaining = batch.text.length - batch.visibleLength;
        const batchesLeft = Math.max(
          1,
          Math.round((batch.revealUntil - performance.now()) / 50) + 1,
        );
        let end = Math.min(
          batch.text.length,
          batch.visibleLength + Math.max(120, Math.ceil(remaining / batchesLeft)),
        );
        if (end < batch.text.length) {
          // Prefer a nearby word boundary and never cut a UTF-16 surrogate pair.
          const boundary = batch.text.slice(end, end + 24).search(/\s/);
          if (boundary >= 0) end += boundary + 1;
          const previous = batch.text.charCodeAt(end - 1);
          const next = batch.text.charCodeAt(end);
          if (previous >= 0xd800 && previous <= 0xdbff && next >= 0xdc00 && next <= 0xdfff) end++;
        }
        batch.visibleLength = end;
        snapshots.set(id, { ...store.getSnapshot(id), text: batch.text.slice(0, end) });
        // Schedule before notifying so a re-entrant clear/dispose cancels this too.
        if (end < batch.text.length) batch.timer = window.setTimeout(flush, 50);
        notify(id);
      };
      batch.timer = window.setTimeout(flush, 50);
    },
    setStatus(id: string, status: string) {
      const current = store.getSnapshot(id);
      if (current.status === status) return;
      snapshots.set(id, { ...current, status });
      notify(id);
    },
    interrupt(id: string, messageId: string, restored = false) {
      // Preserve received text only in memory, including the last queued batch.
      // A failed regeneration restores the original answer instead of showing two answers.
      const text = restored ? "" : (pending.get(id)?.text ?? store.getSnapshot(id).text);
      if (!text.trim() && !restored) return;
      snapshots.set(messageId, {
        text,
        status: restored
          ? "Unable to regenerate response. Please try asking a specific metric question."
          : "Unable to complete request. This preview has not been saved.",
        interrupted: true,
        restored,
      });
      store.clear(id);
      notify(messageId);
    },
    clear(id: string) {
      window.clearTimeout(pending.get(id)?.timer);
      pending.delete(id);
      snapshots.delete(id);
      notify(id);
    },
    dispose() {
      pending.forEach(({ timer }) => window.clearTimeout(timer));
      pending.clear();
      snapshots.clear();
    },
  };
  return store;
}

export type StreamProgressStore = ReturnType<typeof createStreamProgress>;
