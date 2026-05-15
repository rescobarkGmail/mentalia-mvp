import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://abtgfdodyxbozcykyjjy.supabase.co";
const supabaseAnonKey = "sb_publishable_nBQTvM2Lm-wP4bYZVb8iOg_PSggE9wa";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);