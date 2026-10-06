// Site configuration for the v2 features (circles, teachers, admin).
// These values are public by design: the anon key only allows what the
// database functions allow (see supabase/migrations). Leave them empty and
// the v2 features stay hidden; see tech/v2-setup.md.
window.SITE_CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  turnstileSiteKey: ""
};
