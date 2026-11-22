import { useState } from "react";
import { parseMoney } from "../../shared/format";
import type { PersonView, RestrictionKind, Settings as SettingsData } from "../../shared/types";
import { Button, Card, ErrorText, Field, Loaded, Page } from "../components/ui";
import { inputClass } from "../components/styles";
import { api, useApi } from "../lib/api";

export function Settings() {
  const settings = useApi<{ settings: SettingsData }>("/api/settings");
  const people = useApi<{ people: PersonView[] }>("/api/people");
  return (
    <Page title="Settings">
      <Loaded data={settings.data && people.data ? { ...settings.data, ...people.data } : undefined} error={settings.error ?? people.error}>
        {(data) => (
          <>
            <HouseholdForm settings={data.settings} />
            {data.people.map((p) => (
              <PersonForm key={p.id} person={p} onSaved={people.reload} />
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
  const [state, setState] = useState<{ saved?: boolean; failure?: unknown }>({});
  const save = async (action: () => Promise<unknown>) => {
    try {
      await action();
      setState({ saved: true });
    } catch (failure) {
      setState({ failure });
    }
  };
  const feedback = state.failure !== undefined ? <ErrorText error={state.failure} /> : state.saved ? <span className="text-sm text-emerald-700">Saved</span> : null;
  return [save, feedback];
}

function HouseholdForm({ settings }: { settings: SettingsData }) {
  const [budget, setBudget] = useState((settings.weeklyBudgetCents / 100).toFixed(2));
  const [lunches, setLunches] = useState(String(settings.lunchesPerWeek));
  const [save, status] = useSave();
  return (
    <Card className="grid gap-3 sm:grid-cols-3 sm:items-end">
      <Field label="Weekly budget (€)">
        <input className={inputClass} inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} />
      </Field>
      <Field label="Lunches per week">
        <input className={inputClass} type="number" min={0} max={14} value={lunches} onChange={(e) => setLunches(e.target.value)} />
      </Field>
      <div className="flex items-center gap-2">
        <Button onClick={() => save(() => api.put("/api/settings", { weeklyBudgetCents: parseMoney(budget) ?? 0, lunchesPerWeek: Number(lunches) }))}>Save</Button>
        {status}
      </div>
    </Card>
  );
}

interface RestrictionRow {
  name: string;
  kind: RestrictionKind;
  weight: number;
}

function PersonForm({ person, onSaved }: { person: PersonView; onSaved: () => void }) {
  const [rows, setRows] = useState<RestrictionRow[]>(person.restrictions.map(({ name, kind, weight }) => ({ name, kind, weight })));
  const [adding, setAdding] = useState("");
  const [preferences, setPreferences] = useState(person.preferences);
  const [save, status] = useSave();
  const setRow = (index: number, patch: Partial<RestrictionRow>) => setRows(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  const add = () => {
    const name = adding.trim().toLowerCase();
    if (name && !rows.some((r) => r.name === name)) setRows([...rows, { name, kind: "hard", weight: 1 }]);
    setAdding("");
  };

  return (
    <Card className="space-y-3">
      <h2 className="font-medium">
        {person.name} <span className="text-sm font-normal text-stone-500">{person.email}</span>
      </h2>
      <div className="space-y-2">
        <p className="text-sm font-medium text-stone-700">Restrictions</p>
        {rows.length === 0 && <p className="text-sm text-stone-500">None.</p>}
        {rows.map((r, index) => (
          <div key={r.name} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-24">{r.name}</span>
            <select className={`${inputClass} w-32`} value={r.kind} onChange={(e) => setRow(index, { kind: e.target.value as RestrictionKind })}>
              <option value="hard">hard (never)</option>
              <option value="soft">soft (avoid)</option>
            </select>
            {r.kind === "soft" && (
              <label className="flex items-center gap-1">
                weight
                <input className={`${inputClass} w-16`} type="number" min={1} max={5} value={r.weight} onChange={(e) => setRow(index, { weight: Number(e.target.value) })} />
              </label>
            )}
            <Button variant="secondary" aria-label={`Remove ${r.name}`} onClick={() => setRows(rows.filter((_, i) => i !== index))}>✕</Button>
          </div>
        ))}
        <div className="flex flex-wrap gap-2">
          <input
            className={`${inputClass} max-w-48`}
            placeholder="e.g. gluten, lactose"
            value={adding}
            onChange={(e) => setAdding(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
          />
          <Button variant="secondary" disabled={!adding.trim()} onClick={add}>Add restriction</Button>
        </div>
      </div>
      <Field label="Preferences">
        <textarea className={inputClass} rows={2} value={preferences} onChange={(e) => setPreferences(e.target.value)} />
      </Field>
      <div className="flex items-center gap-2">
        <Button onClick={() => save(async () => { await api.put(`/api/people/${person.id}`, { restrictions: rows, preferences }); onSaved(); })}>Save</Button>
        {status}
      </div>
    </Card>
  );
}

function NewPerson({ onCreated }: { onCreated: () => void }) {
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
        <Field label="Add person: name">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Email they sign in with">
          <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Button disabled={!name.trim() || !email.trim()} onClick={add}>Add</Button>
        {status}
      </div>
      <p className="text-xs text-stone-500">Online, they also need to be on the sign-in list (Access) to open the app.</p>
    </Card>
  );
}
