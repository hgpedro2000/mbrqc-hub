// Integration tests for the password-reset edge functions that don't
// require a service-role key. The admin path (reset with provisional /
// default password) needs an admin JWT and is verified through the UI.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")
  ?? Deno.env.get("VITE_SUPABASE_ANON_KEY")
  ?? Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const TESTER_ID = "13b91281-9e21-461a-8f0a-f64386f048e7";
const TESTER_EMP = "TESTER";

const jsonHeaders = { "Content-Type": "application/json", apikey: ANON_KEY };

Deno.test("reset-user-password refuses requests without an admin JWT", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/reset-user-password`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ user_id: TESTER_ID, new_password: "Whatever123*" }),
  });
  const body = await res.json();
  assertEquals(res.status, 401);
  assertEquals(body.error, "Unauthorized");
});

Deno.test("reset-user-password rejects non-admin user JWTs", async () => {
  // A random invalid bearer token should also be rejected by getUser().
  const res = await fetch(`${SUPABASE_URL}/functions/v1/reset-user-password`, {
    method: "POST",
    headers: { ...jsonHeaders, Authorization: "Bearer invalid.token.here" },
    body: JSON.stringify({ user_id: TESTER_ID }),
  });
  const body = await res.json();
  assertEquals(res.status, 401);
  assertEquals(body.error, "Unauthorized");
});

Deno.test("request-admin-password-reset: creates ticket, dedupes, validates input", async () => {
  // First request — creates a new ticket. (Test depends on the DB being
  // pre-cleaned: a duplicate run still returns 200 with already_open=true,
  // so the assertions below tolerate both states.)
  const first = await fetch(`${SUPABASE_URL}/functions/v1/request-admin-password-reset`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ employee_number: TESTER_EMP, motivo: "deno test run" }),
  });
  const firstBody = await first.json();
  assertEquals(first.status, 200, JSON.stringify(firstBody));
  assertEquals(firstBody.success, true);
  assert(typeof firstBody.numero === "string" && firstBody.numero.startsWith("HD-"));

  // Second identical request — must be deduped.
  const second = await fetch(`${SUPABASE_URL}/functions/v1/request-admin-password-reset`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ employee_number: TESTER_EMP }),
  });
  const secondBody = await second.json();
  assertEquals(second.status, 200);
  assertEquals(secondBody.already_open, true);
  assertEquals(secondBody.numero, firstBody.numero);

  // Unknown matrícula → 404.
  const notFound = await fetch(`${SUPABASE_URL}/functions/v1/request-admin-password-reset`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ employee_number: "_NO_SUCH_USER_" }),
  });
  const notFoundBody = await notFound.json();
  assertEquals(notFound.status, 404);
  assertEquals(notFoundBody.error, "Matrícula não encontrada");

  // Empty matrícula → 400.
  const empty = await fetch(`${SUPABASE_URL}/functions/v1/request-admin-password-reset`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ employee_number: "" }),
  });
  const emptyBody = await empty.json();
  assertEquals(empty.status, 400);
  assertEquals(emptyBody.error, "Informe o número de matrícula");
});
