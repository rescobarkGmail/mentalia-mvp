import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Faltan variables de configuración de la aplicación.",
  );
}

const authStorage = typeof window !== "undefined"
  ? {
      getItem(key) {
        try {
          return window.localStorage.getItem(key) ?? window.sessionStorage.getItem(key);
        } catch {
          return window.sessionStorage.getItem(key);
        }
      },
      setItem(key, value) {
        try {
          window.localStorage.setItem(key, value);
        } catch {
          // sessionStorage mantiene el flujo OAuth si localStorage está bloqueado.
        }
        try {
          window.sessionStorage.setItem(key, value);
        } catch {
          // El cliente reportará el error de autenticación si ningún storage está disponible.
        }
      },
      removeItem(key) {
        try {
          window.localStorage.removeItem(key);
        } catch {
          // Continúa con sessionStorage.
        }
        try {
          window.sessionStorage.removeItem(key);
        } catch {
          // No hay nada más que limpiar.
        }
      },
    }
  : undefined;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: "pkce",
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
    storage: authStorage,
  },
});
