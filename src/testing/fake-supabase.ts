import { Provider } from '@angular/core';
import { AuthChangeEvent, Session, SupabaseClient, User } from '@supabase/supabase-js';
import { SUPABASE } from '../app/core/supabase/supabase.client';

export const TEST_USER = {
  id: 'user-1',
  email: 'ash@example.test',
  user_metadata: { full_name: 'Ash Ketchum' },
} as unknown as User;

export function sessionFor(user: User = TEST_USER): Session {
  return {
    access_token: 'a',
    refresh_token: 'r',
    expires_in: 3600,
    token_type: 'bearer',
    user,
  } as Session;
}

type AuthListener = (event: AuthChangeEvent, session: Session | null) => void;

/** A stand-in for the parts of the Supabase auth client the app uses. */
export function createFakeSupabase(initial: Session | null = null) {
  let listener: AuthListener | null = null;
  const auth = {
    getSession: vi.fn(async () => ({ data: { session: initial }, error: null })),
    onAuthStateChange: vi.fn((cb: AuthListener) => {
      listener = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }),
    signUp: vi
      .fn<
        (
          credentials: unknown,
        ) => Promise<{ data: { session: Session | null; user: null }; error: unknown }>
      >()
      .mockResolvedValue({ data: { session: null, user: null }, error: null }),
    signInWithPassword: vi
      .fn<(credentials: unknown) => Promise<{ data: object; error: unknown }>>()
      .mockResolvedValue({ data: {}, error: null }),
    signInWithOAuth: vi
      .fn<(options: unknown) => Promise<{ data: object; error: unknown }>>()
      .mockResolvedValue({ data: {}, error: null }),
    signOut: vi.fn(async () => ({ error: null as unknown })),
  };
  return {
    auth,
    client: { auth } as unknown as SupabaseClient,
    emit: (event: AuthChangeEvent, session: Session | null) => listener?.(event, session),
  };
}

export function provideFakeSupabase(fake: ReturnType<typeof createFakeSupabase>): Provider {
  return { provide: SUPABASE, useValue: fake.client };
}
