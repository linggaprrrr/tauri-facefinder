import { useReducer, useCallback } from 'react';

// Generic undo/redo stack for the canvas editor.
// T is the shape of the state snapshot (e.g. Konva layer JSON).
function historyReducer(history, action) {
  switch (action.type) {
    case 'PUSH': {
      // Discard any redo states when a new action is taken
      const past = [...history.past, history.present];
      return { past, present: action.payload, future: [] };
    }
    case 'UNDO': {
      if (history.past.length === 0) return history;
      const previous = history.past[history.past.length - 1];
      return {
        past: history.past.slice(0, -1),
        present: previous,
        future: [history.present, ...history.future],
      };
    }
    case 'REDO': {
      if (history.future.length === 0) return history;
      const next = history.future[0];
      return {
        past: [...history.past, history.present],
        present: next,
        future: history.future.slice(1),
      };
    }
    case 'RESET':
      return { past: [], present: action.payload, future: [] };
    default:
      return history;
  }
}

export function useHistory(initialState) {
  const [history, dispatch] = useReducer(historyReducer, {
    past: [],
    present: initialState,
    future: [],
  });

  const push  = useCallback((s) => dispatch({ type: 'PUSH',  payload: s }), []);
  const undo  = useCallback(() => dispatch({ type: 'UNDO' }), []);
  const redo  = useCallback(() => dispatch({ type: 'REDO' }), []);
  const reset = useCallback((s) => dispatch({ type: 'RESET', payload: s }), []);

  return {
    state: history.present,
    push,
    undo,
    redo,
    reset,
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
  };
}
