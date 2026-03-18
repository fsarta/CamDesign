import { useEffect } from 'react';

interface ShortcutActions {
  undo: () => void;
  redo: () => void;
  save: () => void;
  recalculate: () => void;
  importFile: () => void;
}

/**
 * Registers global keyboard shortcuts:
 * Ctrl+Z = Undo, Ctrl+Y / Ctrl+Shift+Z = Redo
 * Ctrl+S = Export/Save, Ctrl+R = Recalculate, Ctrl+O = Import
 */
export function useKeyboardShortcuts(actions: ShortcutActions) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;

      switch (e.key.toLowerCase()) {
        case 'z':
          e.preventDefault();
          if (e.shiftKey) actions.redo();
          else actions.undo();
          break;
        case 'y':
          e.preventDefault();
          actions.redo();
          break;
        case 's':
          e.preventDefault();
          actions.save();
          break;
        case 'r':
          e.preventDefault();
          actions.recalculate();
          break;
        case 'o':
          e.preventDefault();
          actions.importFile();
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [actions]);
}
