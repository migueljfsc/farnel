import { useState } from "react";
import { formatDay } from "../../shared/format";
import type { CookingView, FeedbackView, PersonView } from "../../shared/types";
import { Badge, Card, ErrorText, inputClass, Link, Loaded, Page, Stars } from "../components/ui";
import { api, useApi } from "../lib/api";
import { useApp } from "../lib/app-context";

export function History() {
  const cookings = useApi<{ cookings: CookingView[] }>("/api/history");
  const people = useApi<{ people: PersonView[] }>("/api/people");
  return (
    <Page title="History">
      <Loaded data={cookings.data && people.data ? { ...cookings.data, ...people.data } : undefined} error={cookings.error ?? people.error}>
        {(data) =>
          data.cookings.length === 0 ? (
            <p className="text-sm text-stone-500">Nothing eaten yet.</p>
          ) : (
            <div className="space-y-2">
              {data.cookings.map((c) => (
                <HistoryRow key={c.id} cooking={c} people={data.people} onChange={cookings.reload} />
              ))}
            </div>
          )
        }
      </Loaded>
    </Page>
  );
}

function HistoryRow({ cooking, people, onChange }: { cooking: CookingView; people: PersonView[]; onChange: () => void }) {
  const skipped = cooking.status === "skipped";
  return (
    <Card className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm">
          <span className="text-stone-500">{formatDay(cooking.cookDate)}</span>{" "}
          <Link to={{ page: "dish", id: cooking.dishId }} className="font-medium">
            {cooking.dish}
          </Link>{" "}
          <span className="text-stone-500">({cooking.portions} portions)</span>
        </p>
        {cooking.status !== "done" && <Badge tone="amber">{cooking.status}</Badge>}
      </div>
      {!skipped &&
        people.map((p) => (
          <PersonFeedback key={p.id} cookingId={cooking.id} person={p} feedback={cooking.feedback.find((f) => f.personId === p.id)} onChange={onChange} />
        ))}
    </Card>
  );
}

function PersonFeedback({ cookingId, person, feedback, onChange }: { cookingId: number; person: PersonView; feedback?: FeedbackView; onChange: () => void }) {
  const { me } = useApp();
  const mine = me.person.id === person.id;
  const [comment, setComment] = useState(feedback?.comment ?? "");
  const [failure, setFailure] = useState<unknown>();
  const save = async (rating: number | undefined, text: string) => {
    if (!rating) return;
    try {
      await api.put(`/api/cookings/${cookingId}/feedback`, { rating, comment: text });
      onChange();
    } catch (e) {
      setFailure(e);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="w-16 font-medium text-stone-700">{person.name}</span>
      <Stars value={feedback?.rating} onChange={mine ? (r) => save(r, comment) : undefined} />
      {mine ? (
        <input
          className={`${inputClass} min-w-40 flex-1`}
          placeholder={feedback ? "What went well or badly?" : "Rate first, then comment"}
          value={comment}
          disabled={!feedback}
          onChange={(e) => setComment(e.target.value)}
          onBlur={() => comment !== (feedback?.comment ?? "") && save(feedback?.rating, comment)}
        />
      ) : (
        feedback?.comment && <span className="text-stone-600">"{feedback.comment}"</span>
      )}
      {failure !== undefined && <ErrorText error={failure} />}
    </div>
  );
}
