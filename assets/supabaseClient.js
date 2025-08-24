// assets/supabaseClient.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// TODO: Reemplaza con tus credenciales públicas
const SUPABASE_URL = window.ENV_SUPABASE_URL || "https://zxkswjdghlarqiaqiodl.supabase.co";
const SUPABASE_ANON_KEY = window.ENV_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4a3N3amRnaGxhcnFpYXFpb2RsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzNzgxNjMsImV4cCI6MjA3MDk1NDE2M30.AZj-ByEb-3i-R9sgKMvixayIbxkE_Vhhgt9I_5wXS-Y";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
  global: { headers: { "X-Client-Info": "camaron-web/1.0" } }
});

export async function fetchSingle(table){
  const { data, error } = await supabase.from(table).select("*").order("created_at",{ascending:false}).limit(1).maybeSingle();
  if (error) throw error;
  return data;
}
export async function fetchAll(table, select="*", opts={}){
  const q = supabase.from(table).select(select);
  if (opts.order) q.order(opts.order.col, { ascending: !!opts.order.asc });
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}


