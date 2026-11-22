/** The API's route table plumbing: matching, JSON bodies, and service outcomes as responses. */

import type { z } from "zod";
import type { PersonCaller } from "../lib/access";
import { fail, json, noContent, readJson } from "../lib/http";

export interface ApiCtx {
  env: Env;
  db: D1Database;
  request: Request;
  url: URL;
  caller: PersonCaller;
  today: string;
  now: string;
  /** Captures from the route's pattern. */
  params: string[];
}

export interface Route {
  method: "GET" | "POST" | "PUT";
  pattern: RegExp;
  handle: (ctx: ApiCtx) => Promise<Response>;
}

export const route = (method: Route["method"], pattern: RegExp, handle: Route["handle"]): Route => ({ method, pattern, handle });

/** A handler whose JSON body is parsed by `schema`; anything else is 400 `invalid`. */
export function withBody<S extends z.ZodType>(schema: S, handle: (ctx: ApiCtx, body: z.output<S>) => Promise<Response>): Route["handle"] {
  return async (ctx) => {
    const parsed = schema.safeParse(await readJson(ctx.request));
    return parsed.success ? handle(ctx, parsed.data) : fail("invalid", 400);
  };
}

const STATUS: Record<string, number> = { not_found: 404, invalid: 400, name_taken: 409 };

/** A service's string outcome: `ok` is 204, anything else an error code. */
export const outcome = (result: string): Response => (result === "ok" ? noContent() : fail(result, STATUS[result] ?? 400));

/** A refused `{ ok: false, error }` result: 404 for `not_found`, 409 otherwise, with its details. */
export function refused({ error, ...details }: { ok: false; error: string }): Response {
  return fail(error, error === "not_found" ? 404 : 409, details);
}

export const idParam = (ctx: ApiCtx, index = 0): number => Number(ctx.params[index]);

export const found = <T>(key: string, value: T | null): Response => (value === null ? fail("not_found", 404) : json({ [key]: value }));

export async function dispatch(routes: Route[], ctx: Omit<ApiCtx, "params">): Promise<Response> {
  for (const r of routes) {
    if (r.method !== ctx.request.method) continue;
    const match = r.pattern.exec(ctx.url.pathname);
    if (match) return r.handle({ ...ctx, params: match.slice(1) });
  }
  return fail("not_found", 404);
}
