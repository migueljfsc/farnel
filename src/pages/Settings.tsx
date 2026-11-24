import { useState } from "react";
import { parseMoney } from "../../shared/format";
import { holdsName } from "../../shared/names";
import type { IngredientView, PersonView, RestrictionKind, Settings as SettingsData } from "../../shared/types";
import { Button, Card, ErrorText, Field, Loaded, Page, SaveStatus } from "../components/ui";
import { inputBase, inputClass } from "../components/styles";
import { api, useApi } from "../lib/api";
import { useAutosave } from "../lib/autosave";
import { useApp } from "../lib/app-context";
import { LocaleSwitch } from "../components/LocaleSwitch";
import { ThemeSwitch } from "../components/ThemeSwitch";
import { useI18n } from "../i18n/context";

export function Settings() {
  const { t } = useI18n();
  const settings = useApi<{ settings: SettingsData }>("/api/settings");
  const people = useApi<{ people: PersonView[] }>("/api/people");
  const ingredients = useApi<{ ingredients: IngredientView[] }>("/api/ingredients");
  return (
    <Page title={t("nav.settings")}>
      <Loaded
        data={settings.data && people.data && ingredients.data ? { ...settings.data, ...people.data, ...ingredients.data } : undefined}
        error={settings.error ?? people.error ?? ingredients.error}
      >
        {(data) => (
          <>
            <div className="flex flex-wrap items-center gap-3 sm:hidden">
              <ThemeSwitch />
              <LocaleSwitch />
            </div>
            <HouseholdForm settings={data.settings} />
            {data.people.map((p) => (
              <PersonForm key={p.id} person={p} ingredientNames={data.ingredients.map((i) => i.name)} />
            ))}
            <NewPerson onCreated={people.reload} />
          </>
        )}
      </Loaded>
    </Page>
  );
}

/** Saves through `action`, showing "Saved" or the error. */
function useSave(): [(action: () => Promise<unknown>) => Promise<void>, React.ReactNode] {
  const { t } = useI18n();
  const [state, setState] = useState<{ saved?: boolean; failure?: unknown }>({});
  const save = async (action: () => Promise<unknown>) => {
    try {
      await action();
      setState({ saved: true });
    } catch (failure) {
      setState({ failure });
    }
  };
  const feedback = state.failure !== undefined ? <ErrorText error={state.failure} /> : state.saved ? <span className="text-sm text-mar">{t("common.saved")}</span> : null;
  return [save, feedback];
}

function HouseholdForm({ settings }: { settings: SettingsData }) {
  const { t } = useI18n();
  const [budget, setBudget] = useState((settings.weeklyBudgetCents / 100).toFixed(2));
  const [lunches, setLunches] = useState(String(settings.lunchesPerWeek));
  const [protein, setProtein] = useState(String(settings.minProteinGrams));
  const body = { weeklyBudgetCents: parseMoney(budget) ?? 0, lunchesPerWeek: Number(lunches), minProteinGrams: Number(protein) };
  const state = useAutosave(body, (b) => api.put("/api/settings", b), parseMoney(budget) !== null && lunches.trim() !== "" && protein.trim() !== "");
  return (
    <Card className="grid gap-3 sm:grid-cols-4 sm:items-end">
      <Field label={t("settings.budget")}>
        <input className={inputClass} inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} />
      </Field>
      <Field label={t("settings.lunches")}>
        <input className={inputClass} type="number" min={0} max={14} value={lunches} onChange={(e) => setLunches(e.target.value)} />
      </Field>
      <Field label={t("settings.minProtein")}>
        <input className={inputClass} type="number" min={0} max={1000} step={10} value={protein} onChange={(e) => setProtein(e.target.value)} />
      </Field>
      <div className="flex h-10 items-center">
        <SaveStatus state={state} />
      </div>
    </Card>
  );
}

/** A part of a person's card, set off from the one above. */
const SECTION = "space-y-2 border-t border-linha pt-3";
const HEADING = "text-sm font-semibold text-tinta";

interface RestrictionRow {
  name: string;
  kind: RestrictionKind;
  weight: number;
}

function PersonForm({ person, ingredientNames }: { person: PersonView; ingredientNames: string[] }) {
  const { refreshMe } = useApp();
  const { t } = useI18n();
  const [rows, setRows] = useState<RestrictionRow[]>(person.restrictions.map(({ name, kind, weight }) => ({ name, kind, weight })));
  const [adding, setAdding] = useState("");
  const [preferences, setPreferences] = useState(person.preferences);
  const [never, setNever] = useState(person.never);
  const state = useAutosave({ restrictions: rows, preferences, never }, async (body) => {
    await api.put(`/api/people/${person.id}`, body);
    refreshMe();
  });
  const setRow = (index: number, patch: Partial<RestrictionRow>) => setRows(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  const add = () => {
    const name = adding.trim().toLowerCase();
    if (name && !rows.some((r) => r.name === name)) setRows([...rows, { name, kind: "hard", weight: 1 }]);
    setAdding("");
  };

  return (
    <Card className="space-y-3">
      <h2 className="flex flex-wrap items-baseline gap-2">
        <span className="display text-3xl text-mar">{person.name}</span> <span className="text-sm text-tinta-soft">{person.email}</span>
      </h2>
      <div className={SECTION}>
        <h3 className={HEADING}>{t("dish.restrictions")}</h3>
        {rows.length === 0 && <p className="text-sm text-tinta-soft">{t("settings.none")}</p>}
        {rows.map((r, index) => (
          <div key={r.name} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-24">{r.name}</span>
            <select className={`${inputBase} w-44`} value={r.kind} onChange={(e) => setRow(index, { kind: e.target.value as RestrictionKind })}>
              <option value="hard">{t("settings.hard")}</option>
              <option value="soft">{t("settings.soft")}</option>
            </select>
            {r.kind === "soft" && (
              <label className="flex items-center gap-1">
                {t("settings.weight")}
                <input className={`${inputBase} w-16`} type="number" min={1} max={5} value={r.weight} onChange={(e) => setRow(index, { weight: Number(e.target.value) })} />
              </label>
            )}
            <Button variant="secondary" aria-label={t("common.remove", { name: r.name })} onClick={() => setRows(rows.filter((_, i) => i !== index))}>✕</Button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <input
            className={`${inputClass} max-w-48`}
            placeholder={t("settings.restrictionHint")}
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Button variant="secondary" disabled={!adding.trim()} onClick={add}>{t("settings.addRestriction")}</Button>
        </div>
      </div>
      <NeverEats names={never} ingredientNames={ingredientNames} onChange={setNever} />
      <label className={`block ${SECTION}`}>
        <span className={`block ${HEADING}`}>{t("settings.preferences")}</span>
        <textarea className={inputClass} rows={2} value={preferences} onChange={(e) => setPreferences(e.target.value)} />
      </label>
      <SaveStatus state={state} />
    </Card>
  );
}

/** Ingredients the person never eats, each with the catalogue ingredients its name catches. */
function NeverEats({ names, ingredientNames, onChange }: { names: string[]; ingredientNames: string[]; onChange: (names: string[]) => void }) {
  const { t } = useI18n();
  const [adding, setAdding] = useState("");
  const add = () => {
    const name = adding.trim();
    if (name && !names.some((n) => holdsName(n, name) && holdsName(name, n))) onChange([...names, name]);
    setAdding("");
  };
  return (
    <div className={SECTION}>
      <h3 className={HEADING}>{t("settings.never")}</h3>
      {names.length === 0 && <p className="text-sm text-tinta-soft">{t("settings.none")}</p>}
      {names.map((name) => {
        const caught = ingredientNames.filter((i) => holdsName(i, name));
        return (
          <div key={name} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-24">{name}</span>
            <span className="min-w-0 flex-1 text-xs text-tinta-soft">
              {caught.length ? t("settings.neverCatches", { names: caught.join(", ") }) : t("settings.neverNoMatch")}
            </span>
            <Button variant="secondary" aria-label={t("common.remove", { name })} onClick={() => onChange(names.filter((n) => n !== name))}>
              ✕
            </Button>
          </div>
        );
      })}
      <div className="flex flex-wrap gap-2">
        <input
          className={`${inputClass} max-w-48`}
          placeholder={t("settings.neverHint")}
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <Button variant="secondary" disabled={!adding.trim()} onClick={add}>
          {t("settings.addNever")}
        </Button>
      </div>
    </div>
  );
}

function NewPerson({ onCreated }: { onCreated: () => void }) {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [save, status] = useSave();
  const add = () =>
    save(async () => {
      await api.post("/api/people", { name, email: email.trim() });
      setName("");
      setEmail("");
      onCreated();
    });
  return (
    <Card className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <Field label={t("settings.addPerson")}>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label={t("settings.email")}>
          <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Button disabled={!name.trim() || !email.trim()} onClick={add}>{t("common.add")}</Button>
        {status}
      </div>
      <p className="text-xs text-tinta-soft">{t("settings.accessNote")}</p>
    </Card>
  );
}
