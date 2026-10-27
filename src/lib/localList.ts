"use client";

import { useSyncExternalStore } from "react";

// A list persisted in localStorage, shared by every component that reads it.
export function createLocalList<T>(key: string, isItem: (v: unknown) => v is T) {
  const empty: T[] = [];
  const listeners = new Set<() => void>();
  let cache: T[] | null = null;

  function read(): T[] {
    if (cache) return cache;
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
      cache = Array.isArray(parsed) ? parsed.filter(isItem) : [];
    } catch {
      cache = [];
    }
    return cache;
  }

  function save(next: T[]) {
    cache = next;
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // storage unavailable (private mode / quota): keep in memory only
    }
    listeners.forEach((l) => l());
  }

  function useList() {
    return useSyncExternalStore(
      (cb) => {
        listeners.add(cb);
        return () => listeners.delete(cb);
      },
      read,
      () => empty,
    );
  }

  return { save, useList };
}
