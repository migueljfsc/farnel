import { useState } from "react";
import type { CookingView, FeedbackView, PersonView } from "../../shared/types";
import { Badge, ErrorText, Link, Loaded, Page, Stars, List, Row } from "../components/ui";
import { inputClass } from "../components/styles";
import { api, useApi } from "../lib/api";
import { useApp } from "../lib/app-context";
import { useI18n } from "../i18n/context";

export function History() {
  const { t } = useI18n();
  const cookings = useApi<{ cookings: CookingView[] }>("/api/history");
  const people = useApi<{ people: PersonView[] }>("/api/people");
  return (
    <Page title={t("nav.history")}>
      <Loaded data={cookings.data && people.data ? { ...cookings.data, ...people.data } : undefined} error={cookings.error ?? people.error}>
        {(data) =>
          data.cookings.length === 0 ? (
            <p className="text-sm text-tinta-soft">{t("history.empty")}</p>
          ) : (
            <List>
              {data.cookings.map((c) => (
                <HistoryRow key={c.id} cooking={c} people={data.people} onChange={cookings.reload} />
              ))}
            </List>
          )
        }
      </Loaded>
    </Page>
  );
}

function HistoryRow({ cooking, people, onChange }: { cooking: CookingView; people: PersonView[]; onChange: () => void }) {
  const { t, tn, day } = useI18n();
  const skipped = cooking.status === "skipped";
  return (
    <Row className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm">
          <span className="text-tinta-soft">{day(cooking.cookDate)}</span>{" "}
          <Link to={{ page: "dish", id: cooking.dishId }} className="font-medium">
            {cooking.dish}
          </Link>{" "}
          <span className="text-tinta-soft">({tn("dish.portions", cooking.portions)})</span>
        </p>
        {cooking.status !== "done" && <Badge tone="neutral">{t(`status.${cooking.status}`)}</Badge>}
      </div>
      {!skipped &&
        people.map((p) => (
          <PersonFeedback key={p.id} cookingId={cooking.id} person={p} feedback={cooking.feedback.find((f) => f.personId === p.id)} onChange={onChange} />
        ))}
    </Row>
  );
}

function PersonFeedback({ cookingId, person, feedback, onChange }: { cookingId: number; person: PersonView; feedback?: FeedbackView; onChange: () => void }) {
  const { me } = useApp();
  const { t } = useI18n();
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
      <span className="w-16 font-medium text-tinta">{person.name}</span>
      <Stars value={feedback?.rating} onChange={mine ? (r) => save(r, comment) : undefined} />
      {mine ? (
        <input
          className={`${inputClass} min-w-40 flex-1`}
          placeholder={t(feedback ? "history.commentHint" : "history.rateFirst")}
          value={comment}
          disabled={!feedback}
          onChange={(e) => setComment(e.target.value)}
          onBlur={() => comment !== (feedback?.comment ?? "") && save(feedback?.rating, comment)}
        />
      ) : (
        feedback?.comment && <span className="text-tinta-soft">"{feedback.comment}"</span>
      )}
      {failure !== undefined && <ErrorText error={failure} />}
    </div>
  );
}
