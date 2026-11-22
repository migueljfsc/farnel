import { useState } from "react";
import type { DecidedStatus, Restriction, RestrictionStatus } from "../../shared/types";
import { api } from "../lib/api";
import { useApp } from "../lib/app-context";
import { ErrorText, StatusToggle } from "./ui";

/** One safe/forbidden toggle per restriction for an ingredient, saved as soon as it changes. */
export function IngredientStatuses({
  ingredientId,
  statuses,
  restrictions,
  onChange,
}: {
  ingredientId: number;
  statuses: Record<number, RestrictionStatus>;
  restrictions: Restriction[];
  onChange: () => void;
}) {
  const { refreshMe } = useApp();
  const [failure, setFailure] = useState<unknown>();
  const decide = async (restrictionId: number, status: DecidedStatus) => {
    try {
      await api.put(`/api/ingredients/${ingredientId}`, { statuses: { [restrictionId]: status } });
      onChange();
      refreshMe();
    } catch (e) {
      setFailure(e);
    }
  };
  return (
    <span className="inline-flex flex-wrap gap-2">
      {restrictions.map((r) => (
        <StatusToggle key={r.id} label={r.name} status={statuses[r.id]} onChange={(s) => decide(r.id, s)} />
      ))}
      {failure !== undefined && <ErrorText error={failure} />}
    </span>
  );
}
