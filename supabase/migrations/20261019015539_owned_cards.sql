-- Owned card: a user holds one or more copies of a Card in the same condition, language and finish.
-- Identical copies are merged into one row with a quantity (see GLOSSARY.md).

create type public.card_condition as enum (
  'near_mint',
  'lightly_played',
  'moderately_played',
  'heavily_played',
  'damaged'
);

create type public.card_finish as enum ('normal', 'holo', 'reverse_holo', 'other');

create table public.owned_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id text not null,
  language text not null check (language ~ '^[a-z]{2}(-[a-z]{2})?$'),
  condition public.card_condition not null,
  finish public.card_finish not null,
  quantity integer not null check (quantity between 1 and 9999),
  -- Snapshot of Catalog data (ADR 0003): a cache, refreshed when the Card is fetched again.
  card_name text not null,
  card_number text,
  set_id text not null,
  set_name text not null,
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint owned_cards_identity unique (user_id, card_id, language, condition, finish)
);

comment on table public.owned_cards is 'A user''s Owned cards; their Collection. Private to the user.';
comment on column public.owned_cards.card_id is 'TCGdex card id, e.g. base1-4.';
comment on column public.owned_cards.language is 'Language printed on the card (TCGdex code, lowercase), not the app language.';

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger owned_cards_set_updated_at
  before update on public.owned_cards
  for each row execute function public.set_updated_at();

create index owned_cards_user_set_idx on public.owned_cards (user_id, set_id);
create index owned_cards_user_name_idx on public.owned_cards (user_id, lower(card_name) text_pattern_ops);
create index owned_cards_user_updated_idx on public.owned_cards (user_id, updated_at desc);

alter table public.owned_cards enable row level security;

revoke all on public.owned_cards from anon, authenticated;
grant select, insert, update, delete on public.owned_cards to authenticated;

create policy owned_cards_select_own on public.owned_cards
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy owned_cards_insert_own on public.owned_cards
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy owned_cards_update_own on public.owned_cards
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy owned_cards_delete_own on public.owned_cards
  for delete to authenticated
  using ((select auth.uid()) = user_id);
