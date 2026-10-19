// Runs supabase/migrations and supabase/tests/database/*.test.sql against an in-memory Postgres
// (PGlite) when Docker and the Supabase CLI stack are not available. It stubs the pieces Supabase
// provides (roles anon/authenticated, auth.users, auth.uid) and a minimal pgTAP look-alike.
// It is a fast guard, not a replacement for `supabase test db` on the real stack.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../supabase/', import.meta.url).pathname;

const supabaseStub = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::uuid
  $$;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
`;

const tapShim = `
  create schema tap;
  create table tap.results (n serial, ok boolean not null, descr text, detail text);
  create table tap.plan (n int);
  grant usage on schema tap to public;
  grant all on tap.results, tap.plan to public;
  grant usage on sequence tap.results_n_seq to public;

  create function plan(n int) returns text language plpgsql as $$
  begin insert into tap.plan values (n); return 'plan'; end $$;

  create function ok(cond boolean, descr text default null) returns text language plpgsql as $$
  begin insert into tap.results (ok, descr) values (coalesce(cond, false), descr); return 'ok'; end $$;

  create function is(got anyelement, want anyelement, descr text default null)
  returns text language plpgsql as $$
  begin
    insert into tap.results (ok, descr, detail)
    values (got is not distinct from want, descr, format('got %s, want %s', got, want));
    return 'is';
  end $$;

  create function lives_ok(sql text, descr text default null) returns text language plpgsql as $$
  begin
    execute sql;
    insert into tap.results (ok, descr) values (true, descr);
    return 'lives_ok';
  exception when others then
    insert into tap.results (ok, descr, detail) values (false, descr, sqlstate || ' ' || sqlerrm);
    return 'lives_ok failed';
  end $$;

  create function throws_ok(sql text, code text, msg text default null, descr text default null)
  returns text language plpgsql as $$
  begin
    execute sql;
    insert into tap.results (ok, descr, detail) values (false, descr, 'no error raised');
    return 'throws_ok failed';
  exception when others then
    insert into tap.results (ok, descr, detail) values (sqlstate = code, descr, 'sqlstate ' || sqlstate || ': ' || sqlerrm);
    return 'throws_ok';
  end $$;

  create function finish() returns setof text language sql as $$ select 'finish'::text $$;
`;

let failed = 0;
const db = new PGlite();
await db.exec(supabaseStub);

for (const file of readdirSync(join(root, 'migrations')).sort()) {
  await db.exec(readFileSync(join(root, 'migrations', file), 'utf8'));
  console.log(`migrated  ${file}`);
}

for (const file of readdirSync(join(root, 'tests/database')).filter((f) =>
  f.endsWith('.test.sql'),
)) {
  await db.exec(tapShim);
  // The pgTAP file ends with ROLLBACK; commit instead so the results can be read back.
  const sql = readFileSync(join(root, 'tests/database', file), 'utf8').replace(
    /rollback;\s*$/i,
    'commit;',
  );
  await db.exec(sql);
  const { rows } = await db.query('select ok, descr, detail from tap.results order by n');
  const plan = (await db.query('select n from tap.plan')).rows[0]?.n;
  for (const r of rows) {
    console.log(`${r.ok ? 'ok    ' : 'NOT OK'}  ${r.descr}${r.ok ? '' : `  [${r.detail}]`}`);
    if (!r.ok) failed++;
  }
  if (plan !== rows.length) {
    console.log(`NOT OK  ${file}: planned ${plan} tests, ran ${rows.length}`);
    failed++;
  }
  await db
    .exec(
      'drop schema tap cascade; drop function plan, ok, is, lives_ok, throws_ok, finish cascade;',
    )
    .catch(() => {});
}

console.log(failed ? `\n${failed} failure(s)` : '\nall SQL checks passed');
process.exit(failed ? 1 : 0);
