import { useState } from "react";
import { parseMoney } from "../../shared/format";
import type { PersonView, RestrictionKind, Settings as SettingsData } from "../../shared/types";
import { Button, Card, ErrorText, Field, Loaded, Page, SaveStatus } from "../components/ui";
import { inputBase, inputClass } from "../components/styles";
import { api, useApi } from "../lib/api";
import { useAutosave } from "../lib/autosave";
import { useApp } from "../lib/app-context";
import { useI18n } from "../i18n/context";

export function Settings() {
  const { t } = useI18n();
  const settings = useApi<{ settings: SettingsData }>("/api/settings");
  const people = useApi<{ people: PersonView[] }>("/api/people");
  return (
    <Page title={t("nav.settings")}>
      <Loaded data={settings.data && people.data ? { ...settings.data, ...people.data } : undefined} error={settings.error ?? people.error}>
        {(data) => (
          <>
            <HouseholdForm settings={data.settings} />
            {data.people.map((p) => (
              <PersonForm key={p.id} person={p} />
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
  const feedback = state.failure !== undefined ? <ErrorText error={state.failure} /> : state.saved ? <span className="text-sm text-manjericao">{t("common.saved")}</span> : null;
  return [save, feedback];
}

function HouseholdForm({ settings }: { settings: SettingsData }) {
  const { t } = useI18n();
  const [budget, setBudget] = useState((settings.weeklyBudgetCents / 100).toFixed(2));
  const [lunches, setLunches] = useState(String(settings.lunchesPerWeek));
  const body = { weeklyBudgetCents: parseMoney(budget) ?? 0, lunchesPerWeek: Number(lunches) };
  const state = useAutosave(body, (b) => api.put("/api/settings", b), parseMoney(budget) !== null && lunches.trim() !== "");
  return (
    <Card className="grid gap-3 sm:grid-cols-3 sm:items-end">
      <Field label={t("settings.budget")}>
        <input className={inputClass} inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} />
      </Field>
      <Field label={t("settings.lunches")}>
        <input className={inputClass} type="number" min={0} max={14} value={lunches} onChange={(e) => setLunches(e.target.value)} />
      </Field>
      <div className="flex h-10 items-center">
        <SaveStatus state={state} />
      </div>
    </Card>
  );
}

interface RestrictionRow {
  name: string;
  kind: RestrictionKind;
  weight: number;
}

function PersonForm({ person }: { person: PersonView }) {
  const { refreshMe } = useApp();
  const { t } = useI18n();
  const [rows, setRows] = useState<RestrictionRow[]>(person.restrictions.map(({ name, kind, weight }) => ({ name, kind, weight })));
  const [adding, setAdding] = useState("");
  const [preferences, setPreferences] = useState(person.preferences);
  const state = useAutosave({ restrictions: rows, preferences }, async (body) => {
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
        <span className="display text-2xl">{person.name}</span> <span className="text-sm text-terra-soft">{person.email}</span>
      </h2>
      <div className="space-y-2">
        <p className="text-sm font-medium text-terra-soft">{t("dish.restrictions")}</p>
        {rows.length === 0 && <p className="text-sm text-terra-soft">{t("settings.none")}</p>}
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
      <Field label={t("settings.preferences")}>
        <textarea className={inputClass} rows={2} value={preferences} onChange={(e) => setPreferences(e.target.value)} />
      </Field>
      <SaveStatus state={state} />
    </Card>
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
      <p className="text-xs text-terra-soft">{t("settings.accessNote")}</p>
    </Card>
  );
}
