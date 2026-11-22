import { env } from "cloudflare:workers";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type JWK } from "jose";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { addPerson, resetDb } from "../test/fixtures";
import { authenticate, verifyAccessJwt } from "./access";

const TEAM = "https://test.cloudflareaccess.com";
let privateKey: CryptoKey;
let keys: ReturnType<typeof createLocalJWKSet>;

beforeAll(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  const jwk: JWK = { ...(await exportJWK(pair.publicKey)), kid: "k1", alg: "RS256" };
  keys = createLocalJWKSet({ keys: [jwk] });
});

beforeEach(() => resetDb(env.DB));

const token = (claims: { aud?: string; iss?: string; email?: string; exp?: number }) =>
  new SignJWT({ email: claims.email })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setIssuer(claims.iss ?? TEAM)
    .setAudience(claims.aud ?? "aud-web")
    .setIssuedAt()
    .setExpirationTime(claims.exp ?? "1h")
    .sign(privateKey);

const opts = (audience = "aud-web") => ({ teamDomain: TEAM, audience, keys });

describe("verifyAccessJwt", () => {
  it("accepts a token for the application", async () => {
    expect(await verifyAccessJwt(await token({ email: "a@example.com" }), opts())).toMatchObject({ email: "a@example.com" });
  });

  it("rejects the wrong audience, issuer, an expired token or another algorithm", async () => {
    expect(await verifyAccessJwt(await token({}), opts("aud-mcp"))).toBeNull();
    expect(await verifyAccessJwt(await token({ iss: "https://evil.cloudflareaccess.com" }), opts())).toBeNull();
    expect(await verifyAccessJwt(await token({ exp: Math.floor(Date.now() / 1000) - 60 }), opts())).toBeNull();
    const hs = await new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setIssuer(TEAM).setAudience("aud-web").sign(new Uint8Array(32));
    expect(await verifyAccessJwt(hs, opts())).toBeNull();
  });
});

describe("authenticate", () => {
  const request = (host: string, jwt?: string) =>
    new Request(`https://${host}/api/me`, { headers: jwt ? { "cf-access-jwt-assertion": jwt } : {} });

  it("signs in a known person by their Access token", async () => {
    const id = await addPerson(env.DB, "a@example.com", "Ana");
    const jwt = await token({ email: "A@example.com" });
    expect(await authenticate(request("farnel.example.com", jwt), env, "web", keys)).toEqual({ kind: "person", personId: id, email: "a@example.com" });
  });

  it("refuses an unknown person, a missing token, and the dev email off localhost", async () => {
    await addPerson(env.DB, "a@example.com", "Ana");
    expect(await authenticate(request("farnel.example.com", await token({ email: "b@example.com" })), env, "web", keys)).toBeNull();
    expect(await authenticate(request("farnel.example.com"), env, "web", keys)).toBeNull();
  });

  it("uses the dev email on localhost", async () => {
    const id = await addPerson(env.DB, "a@example.com", "Ana");
    expect(await authenticate(request("localhost"), env, "web")).toEqual({ kind: "person", personId: id, email: "a@example.com" });
    expect(await authenticate(request("127.0.0.1"), env, "mcp")).toEqual({ kind: "mcp" });
  });

  it("accepts the MCP application's audience only for MCP", async () => {
    const jwt = await token({ aud: "aud-mcp" });
    expect(await authenticate(request("farnel.example.com", jwt), env, "mcp", keys)).toEqual({ kind: "mcp" });
    expect(await authenticate(request("farnel.example.com", jwt), env, "web", keys)).toBeNull();
  });
});
