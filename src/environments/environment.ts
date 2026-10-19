/**
 * Public configuration. The publishable key is designed to ship in the browser: it only grants what
 * Row Level Security allows. Never put the service_role key or any OAuth client secret in this repo.
 *
 * To use the local Supabase stack (`npx supabase start`), replace these two values with the URL and
 * publishable key printed by `npx supabase status` (do not commit that change).
 */
export const environment = {
  supabaseUrl: 'https://cfqqwlggqybyjhtkkiha.supabase.co',
  catalogApiUrl: 'https://api.tcgdex.net/v2',
  supabasePublishableKey: 'sb_publishable_K86lMQGxzUrc45wh8EJuwQ_0S_Ny9fa',
};
