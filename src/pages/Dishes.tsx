import { useState } from "react";
import { formatDay, formatMoney } from "../../shared/format";
import type { DishStatus, DishSummary } from "../../shared/types";
import { Badge, Button, Card, inputClass, Link, Loaded, Page } from "../components/ui";
import { useApi } from "../lib/api";
import { useApp } from "../lib/app-context";
import type { Route } from "../lib/router";

type Filter = Extract<Route, { page: "dishes" }>["filter"];

const TABS: { filter: Filter; label: string; status: DishStatus }[] = [
  { filter: undefined, label: "Validated", status: "validated" },
  { filter: "to-validate", label: "To validate", status: "pending" },
  { filter: "archived", label: "Archived", status: "archived" },
];

export function Dishes({ filter }: { filter: Filter }) {
  const { navigate, me } = useApp();
  const [tag, setTag] = useState("");
  const tab = TABS.find((t) => t.filter === filter)!;
  const { data, error } = useApi<{ dishes: DishSummary[] }>(`/api/dishes?status=${tab.status}${tag.trim() ? `&tag=${encodeURIComponent(tag.trim().toLowerCase())}` : ""}`);

  return (
    <Page title="Dishes" actions={<Button onClick={() => navigate({ page: "dish", id: "new" })}>New dish</Button>}>
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <Button key={t.label} variant={t === tab ? "primary" : "secondary"} onClick={() => navigate({ page: "dishes", filter: t.filter })}>
            {t.label}
            {t.status === "pending" && me.pendingDishes > 0 && ` (${me.pendingDishes})`}
          </Button>
        ))}
        <input className={`${inputClass} max-w-40`} placeholder="Tag" value={tag} onChange={(e) => setTag(e.target.value)} />
      </div>
      <Loaded data={data} error={error}>
        {({ dishes }) =>
          dishes.length === 0 ? (
            <p className="text-sm text-stone-500">No dishes here.</p>
          ) : (
            <div className="space-y-2">
              {dishes.map((d) => (
                <Card key={d.id} className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Link to={{ page: "dish", id: d.id }} className="font-medium">
                      {d.name}
                    </Link>
                    <p className="text-xs text-stone-500">
                      {d.portions} portions · {formatMoney(d.costPerPortionCents)}/portion{d.missingPrice && " (prices missing)"} · every{" "}
                      {d.repeatIntervalDays} days · last {d.lastCooked ? formatDay(d.lastCooked) : "never"}
                    </p>
                  </div>
                  <span className="flex flex-wrap gap-1">
                    {d.createdBy === "claude" && <Badge>by Claude</Badge>}
                    {d.tags.map((t) => (
                      <Badge key={t}>{t}</Badge>
                    ))}
                  </span>
                </Card>
              ))}
            </div>
          )
        }
      </Loaded>
    </Page>
  );
}
