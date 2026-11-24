import { useState } from "react";
import type { DishStatus, DishSummary, Settings } from "../../shared/types";
import { Badge, Button, Link, Loaded, Page, List, Row } from "../components/ui";
import { cx, inputBase } from "../components/styles";
import { useApi } from "../lib/api";
import { useApp } from "../lib/app-context";
import { useBulk } from "../lib/bulk";
import { useSelection } from "../lib/selection";
import { TIN_STRIP, tinTone } from "../lib/tins";
import { Check, SelectionBar } from "../components/SelectionBar";
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
  const selection = useSelection(`${tab.status}:${tag.trim().toLowerCase()}`);
  const { data, error, reload } = useApi<{ dishes: DishSummary[] }>(`/api/dishes?status=${tab.status}${tag.trim() ? `&tag=${encodeURIComponent(tag.trim().toLowerCase())}` : ""}`);

  const settings = useApi<{ settings: Settings }>("/api/settings");
  const minProtein = settings.data?.settings.minProteinGrams ?? 0;
  const bulk = useBulk(selection, reload);
  return (
    <Page title={t("nav.dishes")} actions={<Button onClick={() => navigate({ page: "dish", id: "new" })}>{t("dishes.new")}</Button>}>
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((option) => (
          <button
            key={option.label}
            type="button"
            aria-pressed={option === tab}
            onClick={() => navigate({ page: "dishes", filter: option.filter })}
            className={cx(
              "rounded-[3px] px-2.5 py-1 text-xs font-semibold transition",
              option === tab ? "bg-tinta text-papel" : "text-tinta-soft shadow-[inset_0_0_0_1.5px_var(--linha)] hover:text-tinta",
            )}
          >
            {t(option.label)}
            {option.status === "pending" && me.pendingDishes > 0 && ` (${me.pendingDishes})`}
          </button>
        ))}
        <input className={`${inputBase} ml-auto max-w-40 py-1`} placeholder={t("dishes.tag")} value={tag} onChange={(e) => setTag(e.target.value)} />
      </div>
      <Loaded data={data} error={error}>
        {({ dishes }) =>
          dishes.length === 0 ? (
            <p className="text-sm text-tinta-soft">{t("dishes.empty")}</p>
          ) : (
            <div className="space-y-2">
              <SelectionBar
                selection={selection}
                visible={dishes.map((d) => d.id)}
                confirmKey="delete.confirmDishes"
                onDelete={() => bulk.remove("/api/dishes/delete", "delete.keptDishes")}
                actions={
                  tab.status === "archived" ? (
                    <Button variant="secondary" onClick={() => bulk.status("/api/dishes/unarchive", "unarchive.done")}>
                      {t("dish.unarchive")}
                    </Button>
                  ) : (
                    <Button variant="secondary" onClick={() => bulk.status("/api/dishes/archive", "archive.done")}>
                      {t("dish.archive")}
                    </Button>
                  )
                }
              />
            <List>
              {dishes.map((d) => (
                <Row key={d.id} className={cx("flex flex-wrap items-center gap-3", selection.selected.has(d.id) && "bg-mar-soft/60")}>
                  <Check checked={selection.selected.has(d.id)} onChange={() => selection.toggle(d.id)} label={t("selection.select", { name: d.name })} />
                  <span aria-hidden className={cx("h-9 w-2.5 shrink-0 rounded-[2px]", TIN_STRIP[tinTone(d.tags)])} />
                  <div className="min-w-0 flex-1">
                    <Link to={{ page: "dish", id: d.id }} className="font-semibold">
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
                  <span className="flex flex-wrap justify-end gap-1">
                    {d.proteinPerPortionGrams < minProtein && <Badge tone="tomate">{t("dishes.lowProtein", { grams: d.proteinPerPortionGrams })}</Badge>}
                    {d.createdBy === "claude" && <Badge>{t("dishes.byClaude")}</Badge>}
                    {d.tags.map((label) => (
                      <Badge key={label}>{label}</Badge>
                    ))}
                  </span>
                </Row>
              ))}
            </List>
            </div>
          )
        }
      </Loaded>
    </Page>
  );
}
