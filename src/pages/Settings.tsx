import { useState } from "react";
import { parseMoney } from "../../shared/format";
import type { PersonView, Restriction, RestrictionKind, Settings as SettingsData } from "../../shared/types";
import { Button, Card, ErrorText, Field, inputClass, Loaded, Page } from "../components/ui";
import { api, useApi } from "../lib/api";

export function Settings() {
  const settings = useApi<{ settings: SettingsData }>("/api/settings");
  const people = useApi<{ people: PersonView[] }>("/api/people");
  const restrictions = useApi<{ restrictions: Restriction[] }>("/api/restrictions");
  return (
    <Page title="Settings">
      <Loaded
        data={settings.data && people.data && restrictions.data ? { ...settings.data, ...people.data, ...restrictions.data } : undefined}
        error={settings.error ?? people.error ?? restrictions.error}
      >
        {(data) => (
          <>
            <HouseholdForm settings={data.settings} />
            {data.people.map((p) => (
              <PersonForm key={p.id} person={p} restrictions={data.restrictions} onSaved={people.reload} />
            ))}
            <NewRestriction onCreated={restrictions.reload} />
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

type Choice = RestrictionKind | "none";

function PersonForm({ person, restrictions, onSaved }: { person: PersonView; restrictions: Restriction[]; onSaved: () => void }) {
  const initial = Object.fromEntries(restrictions.map((r) => {
    const own = person.restrictions.find((p) => p.restrictionId === r.id);
    return [r.id, { kind: (own?.kind ?? "none") as Choice, weight: own?.weight ?? 1 }];
  }));
  const [choices, setChoices] = useState(initial);
  const [preferences, setPreferences] = useState(person.preferences);
  const [save, status] = useSave();
  const body = () => ({
    preferences,
    restrictions: Object.entries(choices)
      .filter(([, c]) => c.kind !== "none")
      .map(([id, c]) => ({ restrictionId: Number(id), kind: c.kind as RestrictionKind, weight: c.weight })),
  });

  return (
    <Card className="space-y-3">
      <h2 className="font-medium">
        {person.name} <span className="text-sm font-normal text-stone-500">{person.email}</span>
      </h2>
      {restrictions.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="w-24">{r.name}</span>
          <select className={`${inputClass} w-28`} value={choices[r.id].kind} onChange={(e) => setChoices({ ...choices, [r.id]: { ...choices[r.id], kind: e.target.value as Choice } })}>
            <option value="none">no restriction</option>
            <option value="hard">hard (never)</option>
            <option value="soft">soft (avoid)</option>
          </select>
          {choices[r.id].kind === "soft" && (
            <label className="flex items-center gap-1">
              weight
              <input className={`${inputClass} w-16`} type="number" min={1} max={5} value={choices[r.id].weight} onChange={(e) => setChoices({ ...choices, [r.id]: { ...choices[r.id], weight: Number(e.target.value) } })} />
            </label>
          )}
        </div>
      ))}
      <Field label="Preferences">
        <textarea className={inputClass} rows={2} value={preferences} onChange={(e) => setPreferences(e.target.value)} />
      </Field>
      <div className="flex items-center gap-2">
        <Button onClick={() => save(async () => { await api.put(`/api/people/${person.id}`, body()); onSaved(); })}>Save</Button>
        {status}
      </div>
    </Card>
  );
}

function NewRestriction({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [save, status] = useSave();
  return (
    <Card className="flex flex-wrap items-end gap-2">
      <Field label="New restriction">
        <input className={inputClass} placeholder="e.g. lactose" value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Button disabled={!name.trim()} onClick={() => save(async () => { await api.post("/api/restrictions", { name }); setName(""); onCreated(); })}>Add</Button>
      {status}
    </Card>
  );
}
