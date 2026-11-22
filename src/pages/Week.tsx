import { useState } from "react";
import { APP_NAME } from "../../shared/app";
import { formatDay, formatMoney } from "../../shared/format";
import { addDays, todayLisbon, weekStartOf } from "../../shared/time";
import type { CookingView, DishSummary, PlanView, ShoppingList } from "../../shared/types";
import { Badge, Button, Card, ErrorText, Field, Link, Loaded, Page } from "../components/ui";
import { buttonClass, inputClass } from "../components/styles";
import { claudeLinks, planPrompt } from "../lib/claude";
import { api, useApi } from "../lib/api";
import { useApp } from "../lib/app-context";

const STATUS_TONE = { planned: "emerald", done: "stone", skipped: "amber", replaced: "amber" } as const;

export function Week({ weekStart }: { weekStart?: string }) {
  const { navigate } = useApp();
  const thisWeek = weekStartOf(todayLisbon(new Date()));
  const week = weekStart ?? thisWeek;
  const { data, error, reload } = useApi<{ plan: PlanView | null; shopping: ShoppingList }>(`/api/weeks/${week}`);
  const go = (days: number) => navigate({ page: "week", weekStart: addDays(week, days) });

  return (
    <Page
      title={`Week of ${formatDay(week)}`}
      actions={
        <>
          <Button variant="secondary" onClick={() => go(-7)}>← Previous</Button>
          <Button variant="secondary" onClick={() => go(7)}>Next →</Button>
        </>
      }
    >
      {week >= thisWeek && <PlanWithClaude weekStart={week} hasPlan={!!data?.plan} onRefresh={reload} />}
      <Loaded data={data} error={error}>
        {({ plan, shopping }) =>
          plan ? (
            <>
              <p className="text-sm text-stone-600">
                Planned {formatMoney(plan.totalCents)} of {formatMoney(plan.budgetCents)} {plan.overBudget && <Badge tone="red">over budget</Badge>}
              </p>
              {plan.notes && <p className="text-sm italic text-stone-600">{plan.notes}</p>}
              <div className="space-y-2">
                {plan.cookings.map((c) => (
                  <CookingCard key={c.id} cooking={c} onChange={reload} />
                ))}
              </div>
              <Shopping list={shopping} />
            </>
          ) : (
            <Card>
              <p className="text-sm text-stone-600">No plan for this week yet.</p>
            </Card>
          )
        }
      </Loaded>
    </Page>
  );
}

function PlanWithClaude({ weekStart, hasPlan, onRefresh }: { weekStart: string; hasPlan: boolean; onRefresh: () => void }) {
  const [notes, setNotes] = useState("");
  const [copied, setCopied] = useState(false);
  const prompt = planPrompt({ weekStart, notes });
  const links = claudeLinks(prompt);
  const copy = async () => {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
  };

  return (
    <Card className="space-y-2">
      <h2 className="font-medium">{hasPlan ? "Re-plan with Claude" : "Plan with Claude"}</h2>
      <Field label="Anything special this week?">
        <input className={inputClass} placeholder="e.g. we eat out Thursday, guests on Saturday" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <a className={buttonClass("primary")} href={links.app}>Open in Claude app</a>
        <a className={buttonClass("secondary")} href={links.web} target="_blank" rel="noreferrer">Open claude.ai</a>
        <Button variant="secondary" onClick={copy}>{copied ? "Copied" : "Copy prompt"}</Button>
        <Button variant="secondary" onClick={onRefresh}>Refresh</Button>
      </div>
      <p className="text-xs text-stone-500">Claude saves the plan here through the {APP_NAME} connector; press Refresh when it is done.</p>
    </Card>
  );
}

function CookingCard({ cooking, onChange }: { cooking: CookingView; onChange: () => void }) {
  const [replacing, setReplacing] = useState(false);
  const [failure, setFailure] = useState<unknown>();
  const setStatus = async (body: unknown) => {
    try {
      await api.put(`/api/cookings/${cooking.id}/status`, body);
      setReplacing(false);
      onChange();
    } catch (e) {
      setFailure(e);
    }
  };
  const replacedBy = cooking.replacedBy && ("dish" in cooking.replacedBy ? cooking.replacedBy.dish : cooking.replacedBy.text);

  return (
    <Card className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <Link to={{ page: "dish", id: cooking.dishId }} className="font-medium">
            {cooking.dish}
          </Link>
          <p className="text-xs text-stone-500">
            Cook {formatDay(cooking.cookDate)} · {cooking.portions} portions · {formatMoney(cooking.costCents)}
          </p>
          <p className="text-xs text-stone-500">Eat {cooking.meals.map((m) => `${formatDay(m.date)} ${m.slot}`).join(", ")}</p>
        </div>
        <Badge tone={STATUS_TONE[cooking.status]}>{replacedBy ? `replaced by ${replacedBy}` : cooking.status}</Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        {cooking.status === "skipped" || cooking.status === "replaced" ? (
          <Button variant="secondary" onClick={() => setStatus({ status: "planned" })}>Undo</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={() => setStatus({ status: "skipped" })}>Skipped</Button>
            <Button variant="secondary" onClick={() => setReplacing(!replacing)}>Replaced…</Button>
          </>
        )}
      </div>
      {replacing && <ReplaceForm onReplace={(by) => setStatus({ status: "replaced", ...by })} />}
      {failure !== undefined && <ErrorText error={failure} />}
    </Card>
  );
}

function ReplaceForm({ onReplace }: { onReplace: (by: { dishId: number } | { text: string }) => void }) {
  const { data } = useApi<{ dishes: DishSummary[] }>("/api/dishes?status=validated");
  const [text, setText] = useState("");
  return (
    <div className="flex flex-wrap gap-2">
      <select className={inputClass} defaultValue="" onChange={(e) => e.target.value && onReplace({ dishId: Number(e.target.value) })}>
        <option value="">A dish from the catalogue…</option>
        {data?.dishes.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
      <input className={inputClass} placeholder="…or something else" value={text} onChange={(e) => setText(e.target.value)} />
      <Button disabled={!text.trim()} onClick={() => onReplace({ text })}>Save</Button>
    </div>
  );
}

function Shopping({ list }: { list: ShoppingList }) {
  if (list.items.length === 0) return null;
  return (
    <Card>
      <h2 className="mb-2 font-medium">Shopping list</h2>
      <ul className="divide-y divide-stone-100 text-sm">
        {list.items.map((i) => (
          <li key={i.ingredientId} className="flex justify-between py-1">
            <span>
              {i.name} — {i.quantity} {i.unit}
            </span>
            <span className="text-stone-500">{i.costCents === null ? "no price" : formatMoney(i.costCents)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-sm font-medium">
        Total {formatMoney(list.totalCents)}
        {list.missingPrices > 0 && <span className="font-normal text-stone-500"> · {list.missingPrices} prices missing</span>}
      </p>
    </Card>
  );
}
