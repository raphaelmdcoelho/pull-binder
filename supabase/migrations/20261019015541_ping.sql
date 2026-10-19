-- Keep-alive target for the weekly GitHub Actions ping. Touches nothing and returns nothing private.

create function public.ping()
returns boolean
language sql
stable
set search_path = ''
as $$ select true $$;

revoke all on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;
