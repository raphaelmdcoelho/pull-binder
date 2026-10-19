-- Run with: npx supabase test db   (needs the local stack: Docker)
begin;
select plan(18);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@example.test'),
  ('00000000-0000-0000-0000-00000000000b', 'b@example.test');

-- profile trigger
select is((select count(*)::int from public.profiles), 2, 'a profile is created per auth user');

-- as user A
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
set local role authenticated;

select is((select count(*)::int from public.profiles), 1, 'A sees only their profile');
select lives_ok($$update public.profiles set display_name = 'A' where id = '00000000-0000-0000-0000-00000000000a'$$, 'A updates own profile');
select throws_ok($$insert into public.profiles (id) values (gen_random_uuid())$$, '42501', null, 'A cannot insert profiles');
select throws_ok($$update public.profiles set id = gen_random_uuid()$$, '42501', null, 'A cannot change the profile id column');

select lives_ok($$
  insert into public.owned_cards (card_id, language, condition, finish, quantity, card_name, set_id, set_name)
  values ('base1-4', 'en', 'near_mint', 'holo', 1, 'Charizard', 'base1', 'Base Set')
$$, 'A inserts an owned card (user_id defaults to auth.uid())');
select is((select user_id::text from public.owned_cards), '00000000-0000-0000-0000-00000000000a', 'user_id is A');
select throws_ok($$
  insert into public.owned_cards (card_id, language, condition, finish, quantity, card_name, set_id, set_name)
  values ('base1-4', 'en', 'near_mint', 'holo', 1, 'Charizard', 'base1', 'Base Set')
$$, '23505', null, 'the identity key merges duplicates');
select throws_ok($$
  insert into public.owned_cards (user_id, card_id, language, condition, finish, quantity, card_name, set_id, set_name)
  values ('00000000-0000-0000-0000-00000000000b', 'x', 'en', 'near_mint', 'normal', 1, 'x', 'x', 'x')
$$, '42501', null, 'A cannot insert a row for B');
select throws_ok($$
  insert into public.owned_cards (card_id, language, condition, finish, quantity, card_name, set_id, set_name)
  values ('x', 'en', 'near_mint', 'normal', 0, 'x', 'x', 'x')
$$, '23514', null, 'quantity 0 is rejected');

-- as user B
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);
select is((select count(*)::int from public.owned_cards), 0, 'B sees none of A''s cards');
select lives_ok($$update public.owned_cards set quantity = 99$$, 'B updating A''s card affects nothing');
select lives_ok($$delete from public.owned_cards$$, 'B deleting A''s card affects nothing');

-- back to A: the card is untouched
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);
select is((select quantity from public.owned_cards), 1, 'A''s card survived B''s update and delete');

-- anon
reset role;
set local role anon;
select throws_ok($$select * from public.owned_cards$$, '42501', null, 'anon cannot read owned_cards');
select throws_ok($$select * from public.profiles$$, '42501', null, 'anon cannot read profiles');
select ok(public.ping(), 'anon can call ping()');
select throws_ok($$select public.handle_new_user()$$, '42501', null, 'handle_new_user is not callable by the API');

select * from finish();
rollback;
