// src/lib/supabase/server.ts

import { createClient } from "@supabase/supabase-js";
import { env } from "@/config/env/server";

export function createSupabaseServerClient() {
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY);
}
