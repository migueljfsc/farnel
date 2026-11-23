import { useI18n } from "../i18n/context";
import type { PluralKey } from "../i18n/core";
import { api } from "./api";
import { useApp } from "./app-context";
import { errorMessage } from "./errors";
import type { Selection } from "./selection";
import { useToast } from "./toast";

/** Bulk actions on a selection, each reporting its outcome as a toast and refreshing after. */
export function useBulk(selection: Selection, refresh: () => void) {
  const { t, tn } = useI18n();
  const { refreshMe } = useApp();
  const toast = useToast();
  const ids = [...selection.selected];
  const after = () => {
    selection.clear();
    refresh();
    refreshMe();
  };
  const run = async (action: () => Promise<string>) => {
    try {
      toast({ message: await action() });
      after();
    } catch (error) {
      toast({ message: errorMessage(t, error), tone: "error" });
    }
  };
  return {
    status: (path: string, done: PluralKey) =>
      run(async () => {
        await api.post(path, { ids });
        return tn(done, ids.length);
      }),
    remove: (path: string, kept: PluralKey) =>
      run(async () => {
        const { deleted, blocked } = await api.post<{ deleted: number[]; blocked: number[] }>(path, { ids });
        return [deleted.length && tn("delete.done", deleted.length), blocked.length && tn(kept, blocked.length)].filter(Boolean).join(" · ");
      }),
  };
}
