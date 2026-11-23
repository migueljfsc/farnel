import { useState } from "react";
import type { DishStatus, DishSummary } from "../../shared/types";
import { Badge, Button, Link, Loaded, Page, List, Row } from "../components/ui";
import { inputClass } from "../components/styles";
import { useApi } from "../lib/api";
import { useApp } from "../lib/app-context";
import type { Route } from "../lib/router";
import { useI18n } from "../i18n/context";
import type { MessageKey } from "../i18n/core";

type Filter = Extract<Route, { page: "dishes" }>["filter"];

const TABS: { filter: Filter; label: MessageKey; status: DishStatus }[] = [
  { filter: undefined, label: "dishes.tab.validated", status: "validated" },
  { filter: "to-validate", label: "nav.toValidate", status: "pending" },
  { filter: "archived", label: "dishes.tab.archived", status: "archived" },
];

export function Dishes({ filter }: { filter: Filter }) {
  const { navigate, me } = useApp();
  const { t, tn, day, money } = useI18n();
  const [tag, setTag] = useState("");
  const tab = TABS.find((candidate) => candidate.filter === filter)!;
  const { data, error } = useApi<{ dishes: DishSummary[] }>(`/api/dishes?status=${tab.status}${tag.trim() ? `&tag=${encodeURIComponent(tag.trim().toLowerCase())}` : ""}`);

  return (
    <Page title={t("nav.dishes")} actions={<Button onClick={() => navigate({ page: "dish", id: "new" })}>{t("dishes.new")}</Button>}>
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((option) => (
          <Button key={option.label} variant={option === tab ? "primary" : "secondary"} onClick={() => navigate({ page: "dishes", filter: option.filter })}>
            {t(option.label)}
            {option.status === "pending" && me.pendingDishes > 0 && ` (${me.pendingDishes})`}
          </Button>
        ))}
        <input className={`${inputClass} max-w-40`} placeholder={t("dishes.tag")} value={tag} onChange={(e) => setTag(e.target.value)} />
      </div>
      <Loaded data={data} error={error}>
        {({ dishes }) =>
          dishes.length === 0 ? (
            <p className="text-sm text-tinta-soft">{t("dishes.empty")}</p>
          ) : (
            <List>
              {dishes.map((d) => (
                <Row key={d.id} className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Link to={{ page: "dish", id: d.id }} className="font-medium">
                      {d.name}
                    </Link>
                    <p className="text-xs text-tinta-soft">
                      {t("dishes.summary", {
                        portions: tn("dish.portions", d.portions),
                        cost: money(d.costPerPortionCents),
                        days: d.repeatIntervalDays,
                        last: d.lastCooked ? day(d.lastCooked) : t("dishes.never"),
                      })}
                      {d.missingPrice && ` ${t("dishes.missingPrice")}`}
                    </p>
                  </div>
                  <span className="flex flex-wrap gap-1">
                    {d.createdBy === "claude" && <Badge>{t("dishes.byClaude")}</Badge>}
                    {d.tags.map((label) => (
                      <Badge key={label}>{label}</Badge>
                    ))}
                  </span>
                </Row>
              ))}
            </List>
          )
        }
      </Loaded>
    </Page>
  );
}
