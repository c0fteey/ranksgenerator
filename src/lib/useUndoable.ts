import { useState } from "react";

const LIMIT = 50;

export function useUndoable<T extends object>(initial: T) {
  const [h, setH] = useState({ past: [] as T[], present: initial, future: [] as T[] });

  const set = (patch: Partial<T>) =>
    setH((s) => ({ past: [...s.past, s.present].slice(-LIMIT), present: { ...s.present, ...patch }, future: [] }));

  return {
    value: h.present,
    set,
    reset: () => set(initial),
    undo: () =>
      setH((s) =>
        s.past.length ? { past: s.past.slice(0, -1), present: s.past[s.past.length - 1], future: [s.present, ...s.future] } : s,
      ),
    redo: () =>
      setH((s) => (s.future.length ? { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) } : s)),
    canUndo: h.past.length > 0,
    canRedo: h.future.length > 0,
  };
}

export type Undoable<T extends object> = ReturnType<typeof useUndoable<T>>;
