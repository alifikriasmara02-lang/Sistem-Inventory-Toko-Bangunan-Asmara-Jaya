const SUPABASE_CONFIG = Object.freeze({
  url: "https://aavsksbezoaemlgguoau.supabase.co",
  publishableKey: "sb_publishable_y28_mJLe5YtrXu82TrLT8w_pLDToQRj",
});

if (typeof window !== 'undefined') window.SUPABASE_CONFIG = SUPABASE_CONFIG;
if (typeof module !== 'undefined') module.exports = SUPABASE_CONFIG;