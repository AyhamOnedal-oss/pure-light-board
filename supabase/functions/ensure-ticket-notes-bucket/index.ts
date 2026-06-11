// One-time setup: create the private "ticket-notes" Storage bucket so note
// attachments can be shared between tenant members.
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data: existing } = await admin.storage.getBucket("ticket-notes");
  if (existing) {
    return new Response(JSON.stringify({ ok: true, created: false }), {
      headers: { ...cors, "content-type": "application/json" },
    });
  }
  const { error } = await admin.storage.createBucket("ticket-notes", {
    public: false,
    fileSizeLimit: 20 * 1024 * 1024,
  });
  if (error) {
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { ...cors, "content-type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ ok: true, created: true }), {
    headers: { ...cors, "content-type": "application/json" },
  });
});