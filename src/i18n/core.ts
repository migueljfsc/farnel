/**
 * The translation runtime: pure, no React and no storage.
 *
 * `en` is the source of truth for which keys exist; `pt` is typed against it, so a key added to
 * one and forgotten in the other does not compile.
 */

import { en } from "./en";

export { LOCALES, isLocale, type Locale } from "../../shared/locale";

export type MessageKey = keyof typeof en;
export type Dictionary = Record<MessageKey, string>;

/** Values substituted into `{name}` placeholders. */
export type Vars = Record<string, string | number>;

/** Prefixes that have `.one` and `.other` forms. */
type PluralPrefix<K> = K extends `${infer P}.one` ? P : never;
export type PluralKey = PluralPrefix<MessageKey>;

export type Translate = (key: MessageKey, vars?: Vars) => string;

const FIELD = /\{(\w+)\}/g;

/** `key` in `dict`, with its placeholders filled; falls back to English, then to the key. */
export function translate(dict: Dictionary, key: MessageKey, vars?: Vars): string {
  const text = dict[key] ?? en[key] ?? key;
  return vars ? text.replace(FIELD, (whole, name: string) => (name in vars ? String(vars[name]) : whole)) : text;
}

/** The `.one` or `.other` form of `key`, by `count`; English and Portuguese split plurals alike. */
export function plural(dict: Dictionary, key: PluralKey, count: number, vars?: Vars): string {
  return translate(dict, `${key}.${count === 1 ? "one" : "other"}` as MessageKey, { count, ...vars });
}

export const translator =
  (dict: Dictionary): Translate =>
  (key, vars) =>
    translate(dict, key, vars);

export const isMessageKey = (key: string): key is MessageKey => key in en;
