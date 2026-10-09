/// <reference types="vite/client" />

/* The two variables the browser reads (src/auth.ts), named here so a typo is a
 * type error instead of an `undefined` at sign-in time. They are the same
 * Supabase project as the server's SUPABASE_URL / SUPABASE_ANON_KEY — named
 * again for Vite, which inlines anything with the VITE_ prefix into the built
 * JavaScript. That is exactly why they are public, and why `.env.example` says
 * so: an anon key is publishable, and row-level security is what protects the
 * data. Nothing secret may ever carry this prefix. */
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}
