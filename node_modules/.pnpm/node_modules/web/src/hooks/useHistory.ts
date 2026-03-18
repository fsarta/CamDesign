import { useState, useCallback, useRef } from 'react';

const MAX_HISTORY = 50;

export interface HistoryState<T> {
  current: T;
  canUndo: boolean;
  canRedo: boolean;
  set: (value: T | ((prev: T) => T)) => void;
  undo: () => void;
  redo: () => void;
}

/**
 * Generic state history hook — supports undo/redo up to MAX_HISTORY steps.
 * Usage: const { current, set, undo, redo, canUndo, canRedo } = useHistory(initialValue);
 */
export function useHistory<T>(initialValue: T): HistoryState<T> {
  const [current, setCurrent] = useState<T>(initialValue);
  const pastRef = useRef<T[]>([]);
  const futureRef = useRef<T[]>([]);

  const set = useCallback((value: T | ((prev: T) => T)) => {
    setCurrent(prev => {
      const next = typeof value === 'function' ? (value as (p: T) => T)(prev) : value;
      pastRef.current = [...pastRef.current.slice(-MAX_HISTORY + 1), prev];
      futureRef.current = []; // Clear redo stack on new change
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    setCurrent(prev => {
      if (pastRef.current.length === 0) return prev;
      const previous = pastRef.current[pastRef.current.length - 1];
      pastRef.current = pastRef.current.slice(0, -1);
      futureRef.current = [prev, ...futureRef.current];
      return previous;
    });
  }, []);

  const redo = useCallback(() => {
    setCurrent(prev => {
      if (futureRef.current.length === 0) return prev;
      const next = futureRef.current[0];
      futureRef.current = futureRef.current.slice(1);
      pastRef.current = [...pastRef.current, prev];
      return next;
    });
  }, []);

  return {
    current,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
    set,
    undo,
    redo,
  };
}
