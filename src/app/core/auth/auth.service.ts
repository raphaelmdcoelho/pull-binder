import { DOCUMENT } from '@angular/common';
import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthError, AuthRetryableFetchError, Session } from '@supabase/supabase-js';
import { SUPABASE } from '../supabase/supabase.client';

export type AuthErrorCode =
  | 'invalid_credentials'
  | 'email_not_confirmed'
  | 'weak_password'
  | 'rate_limited'
  | 'network'
  | 'unknown';

export type AuthResult<T = void> = { ok: true; value: T } | { ok: false; code: AuthErrorCode };

/** `confirm-email`: the account exists but the user must open the link we emailed. */
export type SignUpOutcome = 'signed-in' | 'confirm-email';

export function toAuthErrorCode(error: AuthError): AuthErrorCode {
  if (error instanceof AuthRetryableFetchError) return 'network';
  switch (error.code) {
    case 'invalid_credentials':
      return 'invalid_credentials';
    case 'email_not_confirmed':
      return 'email_not_confirmed';
    case 'weak_password':
      return 'weak_password';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'rate_limited';
    default:
      return 'unknown';
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SUPABASE);
  private readonly document = inject(DOCUMENT);

  private readonly _session = signal<Session | null>(null);
  private readonly _ready = signal(false);

  readonly session = this._session.asReadonly();
  /** False until the stored session has been read (or exchanged after an OAuth redirect). */
  readonly ready = this._ready.asReadonly();
  readonly user = computed(() => this._session()?.user ?? null);
  readonly isAuthenticated = computed(() => this._session() !== null);
  readonly displayName = computed(() => {
    const user = this.user();
    const meta = user?.user_metadata ?? {};
    return (meta['full_name'] ?? meta['name'] ?? user?.email ?? null) as string | null;
  });

  /** Restores the session and keeps it in sync. Awaited at startup so guards see the truth. */
  async init(): Promise<void> {
    try {
      const { data } = await this.supabase.auth.getSession();
      this._session.set(data.session);
    } catch {
      this._session.set(null);
    }
    // The callback must not await Supabase calls (it runs inside the client's lock).
    this.supabase.auth.onAuthStateChange((_event, session) => this._session.set(session));
    this._ready.set(true);
  }

  async signUpWithEmail(email: string, password: string): Promise<AuthResult<SignUpOutcome>> {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: this.origin('/collection') },
    });
    if (error) return { ok: false, code: toAuthErrorCode(error) };
    // With confirmations on there is no session; an already-registered address looks the same on
    // purpose, so we never reveal whether an email has an account.
    return { ok: true, value: data.session ? 'signed-in' : 'confirm-email' };
  }

  async signInWithEmail(email: string, password: string): Promise<AuthResult> {
    const { error } = await this.supabase.auth.signInWithPassword({ email, password });
    return error ? { ok: false, code: toAuthErrorCode(error) } : { ok: true, value: undefined };
  }

  /** Leaves the page for Google; the session is created when Google redirects back. */
  async signInWithGoogle(): Promise<AuthResult> {
    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: this.origin('/collection') },
    });
    return error ? { ok: false, code: toAuthErrorCode(error) } : { ok: true, value: undefined };
  }

  async signOut(): Promise<AuthResult> {
    const { error } = await this.supabase.auth.signOut();
    // Even if the server call fails, the local session is cleared by the client.
    return error ? { ok: false, code: toAuthErrorCode(error) } : { ok: true, value: undefined };
  }

  private origin(path: string): string {
    return `${this.document.location.origin}${path}`;
  }
}
