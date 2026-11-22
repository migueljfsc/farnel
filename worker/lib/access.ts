/**
 * Cloudflare Access, checked again in the Worker. `ctx.access` is not passed to Workers that serve
 * static assets, so the `Cf-Access-Jwt-Assertion` header is verified here against the team's keys.
 */

import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import { findPersonByEmail } from "./service/people";

export type Surface = "web" | "mcp";
export type PersonCaller = { kind: "person"; personId: number; email: string };
export type Caller = PersonCaller | { kind: "mcp" };

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);
const remoteKeys = new Map<string, JWTVerifyGetKey>();

export async function verifyAccessJwt(
  token: string,
  opts: { teamDomain: string; audience: string; keys: JWTVerifyGetKey },
): Promise<{ email?: string; sub?: string } | null> {
  try {
    const { payload } = await jwtVerify(token, opts.keys, { issuer: opts.teamDomain, audience: opts.audience, algorithms: ["RS256"] });
    return { email: typeof payload.email === "string" ? payload.email : undefined, sub: payload.sub };
  } catch {
    return null;
  }
}

function teamKeys(teamDomain: string): JWTVerifyGetKey {
  let keys = remoteKeys.get(teamDomain);
  if (!keys) {
    keys = createRemoteJWKSet(new URL("/cdn-cgi/access/certs", teamDomain));
    remoteKeys.set(teamDomain, keys);
  }
  return keys;
}

async function asPerson(db: D1Database, email: string | undefined): Promise<PersonCaller | null> {
  const person = email ? await findPersonByEmail(db, email) : null;
  return person ? { kind: "person", personId: person.id, email: person.email } : null;
}

/** Who is calling, or null. `keys` replaces the team's published keys (tests). */
export async function authenticate(request: Request, env: Env, surface: Surface, keys?: JWTVerifyGetKey): Promise<Caller | null> {
  if (env.DEV_ACCESS_EMAIL && LOCAL_HOSTS.has(new URL(request.url).hostname)) {
    return surface === "mcp" ? { kind: "mcp" } : asPerson(env.DB, env.DEV_ACCESS_EMAIL);
  }
  const audience = surface === "mcp" ? env.ACCESS_AUD_MCP : env.ACCESS_AUD_WEB;
  const token = request.headers.get("cf-access-jwt-assertion");
  if (!token || !audience || !env.ACCESS_TEAM_DOMAIN) return null;
  const claims = await verifyAccessJwt(token, { teamDomain: env.ACCESS_TEAM_DOMAIN, audience, keys: keys ?? teamKeys(env.ACCESS_TEAM_DOMAIN) });
  if (!claims) return null;
  return surface === "mcp" ? { kind: "mcp" } : asPerson(env.DB, claims.email);
}
