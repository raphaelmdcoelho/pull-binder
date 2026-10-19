// Exercises the owned_cards table through supabase-js against the LOCAL stack, as two real users.
// Usage: eval "$(npx supabase status -o env | sed 's/^/export /')" && \
//   SUPABASE_URL=$API_URL SUPABASE_PUBLISHABLE_KEY=$PUBLISHABLE_KEY node scripts/verify-local-rls.mjs
// Refuses to run against anything but localhost.
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_PUBLISHABLE_KEY;
if (!url || !key || !/^https?:\/\/(127\.0\.0\.1|localhost)/.test(url)) {
  console.error(
    'Set SUPABASE_URL (local) and SUPABASE_PUBLISHABLE_KEY. Refusing to touch a non-local project.',
  );
  process.exit(2);
}

let failed = 0;
const check = (ok, name, detail = '') => {
  console.log(`${ok ? 'ok    ' : 'NOT OK'}  ${name}${ok ? '' : `  [${detail}]`}`);
  if (!ok) failed++;
};

const stamp = Date.now();
async function user(label) {
  const client = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signUp({
    email: `${label}-${stamp}@example.test`,
    password: 'correct-horse-battery',
  });
  if (error || !data.session)
    throw new Error(
      `sign-up failed for ${label}: ${error?.message ?? 'no session (confirmations on?)'}`,
    );
  return { client, id: data.user.id };
}

const snapshot = {
  card_name: 'Charizard',
  card_number: '4',
  set_id: 'base1',
  set_name: 'Base Set',
  image_url: 'https://img.test/base1-4',
};
const identity = { card_id: 'base1-4', language: 'en', condition: 'near_mint', finish: 'holo' };

const a = await user('a');
const b = await user('b');
const anon = createClient(url, key, { auth: { persistSession: false } });

const profile = await a.client.from('profiles').select('id').single();
check(
  profile.data?.id === a.id,
  'profile row was created for the new user',
  profile.error?.message,
);

const first = await a.client
  .from('owned_cards')
  .insert({ ...identity, ...snapshot, quantity: 2 })
  .select()
  .single();
check(
  !first.error && first.data.user_id === a.id,
  'A inserts an Owned card, user_id comes from the session',
  first.error?.message,
);

const dup = await a.client.from('owned_cards').insert({ ...identity, ...snapshot, quantity: 1 });
check(dup.error?.code === '23505', 'the same identity key conflicts (23505)', dup.error?.code);

const swap = await a.client
  .from('owned_cards')
  .update({ quantity: 5 })
  .eq('id', first.data.id)
  .eq('quantity', 2)
  .select();
check(
  swap.data?.length === 1 && swap.data[0].quantity === 5,
  'compare-and-swap update applies when the quantity matches',
  JSON.stringify(swap),
);
const stale = await a.client
  .from('owned_cards')
  .update({ quantity: 9 })
  .eq('id', first.data.id)
  .eq('quantity', 2)
  .select();
check(
  stale.data?.length === 0,
  'compare-and-swap update is a no-op when the quantity changed',
  JSON.stringify(stale),
);

const zero = await a.client.from('owned_cards').update({ quantity: 10000 }).eq('id', first.data.id);
check(zero.error?.code === '23514', 'quantity above 9999 is rejected (23514)', zero.error?.code);

const bad = await a.client
  .from('owned_cards')
  .insert({ ...identity, ...snapshot, finish: 'normal', quantity: 1, user_id: b.id });
check(bad.error?.code === '42501', 'A cannot insert a row owned by B (42501)', bad.error?.code);

const bSees = await b.client.from('owned_cards').select('id');
check(bSees.data?.length === 0, "B sees none of A's cards", JSON.stringify(bSees));
const bUpd = await b.client
  .from('owned_cards')
  .update({ quantity: 1 })
  .eq('id', first.data.id)
  .select();
check(bUpd.data?.length === 0, "B cannot update A's card", JSON.stringify(bUpd));
const bDel = await b.client.from('owned_cards').delete().eq('id', first.data.id).select();
check(bDel.data?.length === 0, "B cannot delete A's card", JSON.stringify(bDel));
const bProfiles = await b.client.from('profiles').select('id');
check(
  bProfiles.data?.length === 1 && bProfiles.data[0].id === b.id,
  "B sees only B's profile",
  JSON.stringify(bProfiles),
);

const anonRead = await anon.from('owned_cards').select('id');
check(
  !!anonRead.error && anonRead.error.code === '42501',
  'anon cannot read owned_cards (42501)',
  JSON.stringify(anonRead),
);
const ping = await anon.rpc('ping');
check(ping.data === true, 'anon can call ping()', JSON.stringify(ping));

const still = await a.client
  .from('owned_cards')
  .select('quantity')
  .eq('id', first.data.id)
  .single();
check(
  still.data?.quantity === 5,
  "A's card is untouched after all of B's attempts",
  JSON.stringify(still),
);

const del = await a.client.from('owned_cards').delete().eq('id', first.data.id).select();
check(del.data?.length === 1, 'A deletes own card', JSON.stringify(del));

console.log(failed ? `\n${failed} failure(s)` : '\nall local-stack checks passed');
process.exit(failed ? 1 : 0);
