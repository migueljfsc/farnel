import { isMessageKey, type Translate } from "../i18n/core";
import { ApiError } from "./api";

/** An API error as a sentence in the reader's language; unknown codes get the generic one. */
export function errorMessage(t: Translate, error: unknown): string {
  const key = error instanceof ApiError ? `error.${error.code}` : "";
  return isMessageKey(key) ? t(key, error instanceof ApiError ? (error.details as Record<string, string>) : undefined) : t("error.generic");
}
