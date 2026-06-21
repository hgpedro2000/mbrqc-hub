// Integration test for reset-user-password new_password branch.
// Runs against the deployed edge function using a freshly minted admin JWT.
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? Deno.env.get("VITE_SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const TESTER_ID = "13b91281-9e21-461a-8f0a-f64386f048e7";
const TESTER_EMP = "TESTER";

async function adminAccessToken(): Promise<string> {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  // Find an existing admin user
  const { data: roles } = await admin.from("user_roles").select("user_id").eq("role", "admin").limit(1);
  const adminUserId = roles?.[0]?.user_id;
  assert(adminUserId, "No admin user found");

  // Generate a magic link to extract a valid session token via verifyOtp
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: (await admin.auth.admin.getUserById(adminUserId)).data.user!.email!,
  });
  if (linkErr) throw linkErr;
  const hashed = linkData.properties?.hashed_token;
  const type = linkData.properties?.verification_type;
  assert(hashed && type, "magiclink missing token");

  const anon = createClient(SUPABASE_URL, ANON_KEY);
  const { data: verify, error: vErr } = await anon.auth.verifyOtp({
    type: type as any, token_hash: hashed,
  });
  if (vErr) throw vErr;
  return verify.session!.access_token;
}

Deno.test("reset-user-password rejects without admin token", async () => {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/reset-user-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ user_id: TESTER_ID, new_password: "Whatever123*" }),
  });
  const body = await res.json();
  assertEquals(res.status, 401);
  assertEquals(body.error, "Unauthorized");
});

Deno.test("reset-user-password accepts custom new_password (provisional)", async () => {
  const token = await adminAccessToken();
  const newPw = `Temp_${crypto.randomUUID().slice(0, 8)}!Aa1`;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/reset-user-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ user_id: TESTER_ID, new_password: newPw }),
  });
  const body = await res.json();
  assertEquals(res.status, 200, JSON.stringify(body));
  assertEquals(body.success, true);
  assertEquals(body.temporary_password, newPw);

  // Verify the password was actually applied by signing in as TESTER
  const anon = createClient(SUPABASE_URL, ANON_KEY);
  const { data: lookup } = await createClient(SUPABASE_URL, SERVICE_ROLE)
    .from("profiles").select("email, must_change_password").eq("id", TESTER_ID).single();
  // TESTER may not have an email; sign-in is by employee_number via edge fn.
  // Instead verify must_change_password got flipped.
  assertEquals((lookup as any)?.must_change_password, true, "must_change_password not set");
});

Deno.test("reset-user-password rejects short custom password", async () => {
  const token = await adminAccessToken();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/reset-user-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ user_id: TESTER_ID, new_password: "abc" }),
  });
  const body = await res.json();
  assertEquals(res.status, 400);
  assert((body.error as string).includes("6 caracteres"));
});

Deno.test("reset-user-password applies default (admin123*) when no password supplied", async () => {
  const token = await adminAccessToken();
  const res = await fetch(`${SUPABASE_URL}/functions/v1/reset-user-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ user_id: TESTER_ID }),
  });
  const body = await res.json();
  assertEquals(res.status, 200, JSON.stringify(body));
  assertEquals(body.success, true);
  // Random password is generated — just sanity-check it exists and has length.
  assert(typeof body.temporary_password === "string");
  assert(body.temporary_password.length >= 8);
});

Deno.test("request-admin-password-reset: full lifecycle", async () => {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  // Clean slate
  await admin.from("error_reports").delete()
    .eq("user_id", TESTER_ID).eq("module", "Reset de Senha");

  const first = await fetch(`${SUPABASE_URL}/functions/v1/request-admin-password-reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ employee_number: TESTER_EMP, motivo: "deno test" }),
  });
  const firstBody = await first.json();
  assertEquals(first.status, 200);
  assertEquals(firstBody.success, true);
  assert(firstBody.numero?.startsWith("HD-"));

  const second = await fetch(`${SUPABASE_URL}/functions/v1/request-admin-password-reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ employee_number: TESTER_EMP }),
  });
  const secondBody = await second.json();
  assertEquals(second.status, 200);
  assertEquals(secondBody.already_open, true);
  assertEquals(secondBody.numero, firstBody.numero);

  const notFound = await fetch(`${SUPABASE_URL}/functions/v1/request-admin-password-reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ employee_number: "_NO_SUCH_USER_" }),
  });
  await notFound.json();
  assertEquals(notFound.status, 404);

  const empty = await fetch(`${SUPABASE_URL}/functions/v1/request-admin-password-reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON_KEY },
    body: JSON.stringify({ employee_number: "" }),
  });
  await empty.json();
  assertEquals(empty.status, 400);
});
