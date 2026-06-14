import { useState, useCallback } from 'react';

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
 * Uses useState for past/future so canUndo/canRedo are reactive.
 */
export function useHistory<T>(initialValue: T): HistoryState<T> {
  const [current, setCurrent] = useState<T>(initialValue);
  const [past, setPast] = useState<T[]>([]);
  const [future, setFuture] = useState<T[]>([]);

  const set = useCallback((value: T | ((prev: T) => T)) => {
    setCurrent(prev => {
      const next = typeof value === 'function' ? (value as (p: T) => T)(prev) : value;
      setPast(p => [...p.slice(-MAX_HISTORY + 1), prev]);
      setFuture([]); // Clear redo stack on new change
      return next;
    });
  }, []);

  const undo = useCallback(() => {
    setPast(prevPast => {
      if (prevPast.length === 0) return prevPast;
      const previous = prevPast[prevPast.length - 1];
      const newPast = prevPast.slice(0, -1);
      setCurrent(curr => {
        setFuture(f => [curr, ...f]);
        return previous;
      });
      return newPast;
    });
  }, []);

  const redo = useCallback(() => {
    setFuture(prevFuture => {
      if (prevFuture.length === 0) return prevFuture;
      const next = prevFuture[0];
      const newFuture = prevFuture.slice(1);
      setCurrent(curr => {
        setPast(p => [...p, curr]);
        return next;
      });
      return newFuture;
    });
  }, []);

  return {
    current,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    set,
    undo,
    redo,
  };
}

