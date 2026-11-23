import { useEffect, useRef, useState } from "react";
import type { DishDetail, DishSummary, IngredientView, Restriction } from "../../shared/types";
import { ContainsPicker } from "../components/ContainsPicker";
import { Badge, Button, Link, List, Loaded, Page, Row } from "../components/ui";
import { useI18n } from "../i18n/context";
import { api, useApi } from "../lib/api";
import { errorMessage } from "../lib/errors";
import { useApp } from "../lib/app-context";
import { isUndecided } from "../lib/catalogue";
import { useToast } from "../lib/toast";

/** One inbox for what needs a person: Claude's new dishes, then ingredients nobody has decided. */
export function Review() {
  const { t } = useI18n();
  const pending = useApi<{ dishes: DishSummary[] }>("/api/dishes?status=pending");
  const ingredients = useApi<{ ingredients: IngredientView[] }>("/api/ingredients");
  const restrictions = useApi<{ restrictions: Restriction[] }>("/api/restrictions");
  /** Ingredients of the dish on screen; they are decided in its card, not listed again below. */
  const [inCard, setInCard] = useState<number[]>([]);
  const seen = useRef(new Set<number>());
  const reload = () => {
    pending.reload();
    ingredients.reload();
  };

  return (
    <Page title={t("nav.review")}>
      <Loaded
        data={pending.data && ingredients.data && restrictions.data ? { ...pending.data, ...ingredients.data, ...restrictions.data } : undefined}
        error={pending.error ?? ingredients.error ?? restrictions.error}
      >
        {(data) => {
          const undecided = data.ingredients.filter((i) => isUndecided(i, data.restrictions) && (data.dishes.length === 0 || !inCard.includes(i.id)));
          // Rows decided on this visit stay, marked done, so nothing moves under the pointer.
          seen.current = new Set([...seen.current, ...undecided.map((i) => i.id)]);
          const rows = data.ingredients.filter((i) => seen.current.has(i.id) && !(data.dishes.length > 0 && inCard.includes(i.id)));
          if (data.dishes.length === 0 && rows.length === 0) return <AllReviewed />;
          return (
            <div className="space-y-8">
              {data.dishes.length > 0 && <DishQueue dishes={data.dishes} restrictions={data.restrictions} onChange={reload} onShow={setInCard} />}
              {rows.length > 0 && (
                <section className="space-y-3">
                  <div>
                    <h2 className="display text-2xl">{t("review.ingredients")}</h2>
                    <p className="text-sm text-cafe-soft">{t("review.ingredientsHint")}</p>
                  </div>
                  <List>
                    {rows.map((i) => (
                      <Row key={i.id} className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{i.name}</span>
                        <ContainsPicker ingredientId={i.id} statuses={i.statuses} restrictions={data.restrictions} onChange={reload} />
                      </Row>
                    ))}
                  </List>
                </section>
              )}
            </div>
          );
        }}
      </Loaded>
    </Page>
  );
}

function DishQueue({
  dishes,
  restrictions,
  onChange,
  onShow,
}: {
  dishes: DishSummary[];
  restrictions: Restriction[];
  onChange: () => void;
  onShow: (ingredientIds: number[]) => void;
}) {
  const { t } = useI18n();
  const [position, setPosition] = useState(0);
  const index = position % dishes.length;
  const current = dishes[index];
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="display text-2xl">{t("review.dishes")}</h2>
        <span className="text-sm text-cafe-soft">{t("review.position", { index: index + 1, total: dishes.length })}</span>
      </div>
      <DishReview
        key={current.id}
        dishId={current.id}
        restrictions={restrictions}
        onNext={() => setPosition(index + 1)}
        onDone={onChange}
        onShow={onShow}
        single={dishes.length === 1}
      />
    </section>
  );
}

function DishReview({
  dishId,
  restrictions,
  onNext,
  onDone,
  onShow,
  single,
}: {
  dishId: number;
  restrictions: Restriction[];
  onNext: () => void;
  onDone: () => void;
  onShow: (ingredientIds: number[]) => void;
  single: boolean;
}) {
  const { t, tn, money } = useI18n();
  const { refreshMe } = useApp();
  const toast = useToast();
  const { data, reload } = useApi<{ dish: DishDetail }>(`/api/dishes/${dishId}`);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (data) onShow(data.dish.ingredients.map((i) => i.ingredientId));
  }, [data, onShow]);
  const act = async (path: "validate" | "archive", done: "review.validated" | "review.archived") => {
    if (!data) return;
    setBusy(true);
    try {
      await api.post(`/api/dishes/${dishId}/${path}`);
      toast({ message: t(done, { dish: data.dish.name }) });
      refreshMe();
      onDone();
    } catch (error) {
      toast({ message: errorMessage(t, error), tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <div className="skeleton h-64" />;
  const { dish } = data;
  return (
    <article className="animate-tin space-y-4 rounded-2xl border-[3px] border-rosa bg-louca p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h3 className="display text-3xl">{dish.name}</h3>
          <p className="text-sm text-cafe-soft">
            {t("dishes.summary", { portions: tn("dish.portions", dish.portions), cost: money(dish.costPerPortionCents), days: dish.repeatIntervalDays, last: t("dishes.never") })}
          </p>
        </div>
        <span className="flex flex-wrap gap-1">
          {dish.createdBy === "claude" && <Badge>{t("dishes.byClaude")}</Badge>}
          {dish.tags.map((tag) => (
            <Badge key={tag}>{tag}</Badge>
          ))}
        </span>
      </header>
      {dish.notes && <p className="max-w-prose whitespace-pre-line text-sm">{dish.notes}</p>}
      <ul className="divide-y divide-linha rounded-xl border border-linha">
        {dish.ingredients.map((i) => (
          <li key={i.ingredientId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
            <span>
              <span className="font-medium">{i.name}</span>{" "}
              <span className="text-cafe-soft">
                {i.quantity} {t(`unit.${i.unit}`)}
              </span>
            </span>
            <ContainsPicker ingredientId={i.ingredientId} statuses={i.statuses} restrictions={restrictions} onChange={() => {
              reload();
              onDone();
            }} />
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => act("validate", "review.validated")}>
          {t("review.validate")}
        </Button>
        {!single && (
          <Button variant="secondary" disabled={busy} onClick={onNext}>
            {t("review.skip")}
          </Button>
        )}
        <Link to={{ page: "dish", id: dish.id }} className="self-center px-2 text-sm font-semibold">
          {t("review.edit")}
        </Link>
        <Button variant="danger" className="ml-auto" disabled={busy} onClick={() => act("archive", "review.archived")}>
          {t("dish.archive")}
        </Button>
      </div>
    </article>
  );
}

function AllReviewed() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-linha px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-full bg-salva-soft text-2xl text-salva" aria-hidden>
        ✓
      </span>
      <p className="max-w-sm text-cafe-soft">{t("review.empty")}</p>
      <Link to={{ page: "week" }} className="font-semibold">
        {t("nav.week")}
      </Link>
    </div>
  );
}
