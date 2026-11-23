import { useState } from "react";

export const toggled = (selected: Set<number>, id: number): Set<number> => {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
};

/** Every visible row, or none when they are all selected already. */
export const selectAll = (selected: Set<number>, visible: number[]): Set<number> =>
  visible.every((id) => selected.has(id)) ? new Set() : new Set(visible);

export interface Selection {
  selected: Set<number>;
  toggle: (id: number) => void;
  toggleAll: (visible: number[]) => void;
  clear: () => void;
}

/** A selection that belongs to one view (`scope`); switching view leaves nothing selected out of sight. */
export function useSelection(scope: string): Selection {
  const [state, setState] = useState<{ scope: string; ids: Set<number> }>({ scope, ids: new Set() });
  const selected = state.scope === scope ? state.ids : new Set<number>();
  const update = (change: (current: Set<number>) => Set<number>) =>
    setState((s) => ({ scope, ids: change(s.scope === scope ? s.ids : new Set()) }));
  return {
    selected,
    toggle: (id) => update((s) => toggled(s, id)),
    toggleAll: (visible) => update((s) => selectAll(s, visible)),
    clear: () => update(() => new Set()),
  };
}
