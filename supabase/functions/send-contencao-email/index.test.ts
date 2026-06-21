// Integration tests for send-contencao-email
// Validates: preview, error path, missing config_id
import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const ANON = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FN_URL = `${SUPABASE_URL}/functions/v1/send-contencao-email`;

async function call(body: unknown) {
  const r = await fetch(FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: ANON,
      Authorization: `Bearer ${ANON}`,
    },
    body: JSON.stringify(body),
  });
  const text = await r.text();
  let json: any = null;
  try { json = JSON.parse(text); } catch { /* keep raw */ }
  return { status: r.status, json, text };
}

Deno.test("returns 400 when config_id is missing", async () => {
  const { status, json } = await call({});
  assertEquals(status, 400);
  assertEquals(json?.error, "config_id required");
});

Deno.test("returns error when config_id is invalid (unknown uuid)", async () => {
  const { status, json } = await call({
    config_id: "00000000-0000-0000-0000-000000000000",
    subtipo: "iniciada",
    preview: true,
  });
  assertEquals(status, 500);
  assert(typeof json?.error === "string");
});

Deno.test("returns CORS preflight", async () => {
  const r = await fetch(FN_URL, { method: "OPTIONS" });
  await r.text();
  assertEquals(r.status, 200);
  assertEquals(r.headers.get("access-control-allow-origin"), "*");
});

// Optional: real preview test against a seeded config. Skipped when env var not present.
const CFG_ID = Deno.env.get("TEST_CONTENCAO_CONFIG_ID");
Deno.test({
  name: "preview returns subject+html for a real config",
  ignore: !CFG_ID,
  fn: async () => {
    const { status, json } = await call({
      config_id: CFG_ID,
      subtipo: "iniciada",
      preview: true,
    });
    assertEquals(status, 200);
    assert(typeof json?.subject === "string" && json.subject.length > 0);
    assert(typeof json?.html === "string" && json.html.includes("<html"));
  },
});
