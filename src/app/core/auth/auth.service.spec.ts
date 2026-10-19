import { TestBed } from '@angular/core/testing';
import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js';
import {
  TEST_USER,
  createFakeSupabase,
  provideFakeSupabase,
  sessionFor,
} from '../../../testing/fake-supabase';
import { AuthService, toAuthErrorCode } from './auth.service';

function setup(initial = null as ReturnType<typeof sessionFor> | null) {
  const fake = createFakeSupabase(initial);
  TestBed.configureTestingModule({ providers: [provideFakeSupabase(fake)] });
  return { fake, service: TestBed.inject(AuthService) };
}

describe('AuthService', () => {
  it('is not ready until the stored session has been read', async () => {
    const { service } = setup();
    expect(service.ready()).toBe(false);
    await service.init();
    expect(service.ready()).toBe(true);
    expect(service.isAuthenticated()).toBe(false);
  });

  it('restores a stored session', async () => {
    const { service } = setup(sessionFor());
    await service.init();
    expect(service.isAuthenticated()).toBe(true);
    expect(service.user()?.email).toBe(TEST_USER.email);
    expect(service.displayName()).toBe('Ash Ketchum');
  });

  it('follows sign-in and sign-out events', async () => {
    const { fake, service } = setup();
    await service.init();
    fake.emit('SIGNED_IN', sessionFor());
    expect(service.isAuthenticated()).toBe(true);
    fake.emit('SIGNED_OUT', null);
    expect(service.isAuthenticated()).toBe(false);
  });

  it('falls back to the email when there is no name', async () => {
    const user = { ...TEST_USER, user_metadata: {} };
    const { service } = setup(sessionFor(user));
    await service.init();
    expect(service.displayName()).toBe('ash@example.test');
  });

  it('signs in with email and maps wrong credentials', async () => {
    const { fake, service } = setup();
    expect(await service.signInWithEmail('a@b.c', 'password1')).toEqual({
      ok: true,
      value: undefined,
    });
    fake.auth.signInWithPassword.mockResolvedValueOnce({
      data: {},
      error: new AuthApiError('bad', 400, 'invalid_credentials'),
    });
    expect(await service.signInWithEmail('a@b.c', 'nope')).toEqual({
      ok: false,
      code: 'invalid_credentials',
    });
  });

  it('asks to confirm the email when sign-up returns no session', async () => {
    const { fake, service } = setup();
    const result = await service.signUpWithEmail('a@b.c', 'password1');
    expect(result).toEqual({ ok: true, value: 'confirm-email' });
    expect(fake.auth.signUp).toHaveBeenCalledWith(
      expect.objectContaining({ options: { emailRedirectTo: `${location.origin}/collection` } }),
    );
  });

  it('reports signed-in when sign-up returns a session', async () => {
    const { fake, service } = setup();
    fake.auth.signUp.mockResolvedValueOnce({
      data: { session: sessionFor(), user: null },
      error: null,
    });
    expect(await service.signUpWithEmail('a@b.c', 'password1')).toEqual({
      ok: true,
      value: 'signed-in',
    });
  });

  it('starts Google OAuth with a redirect back to the app', async () => {
    const { fake, service } = setup();
    await service.signInWithGoogle();
    expect(fake.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: `${location.origin}/collection` },
    });
  });

  it('signs out', async () => {
    const { fake, service } = setup();
    expect(await service.signOut()).toEqual({ ok: true, value: undefined });
    expect(fake.auth.signOut).toHaveBeenCalled();
  });
});

describe('toAuthErrorCode', () => {
  it.each([
    ['email_not_confirmed', 'email_not_confirmed'],
    ['weak_password', 'weak_password'],
    ['over_request_rate_limit', 'rate_limited'],
    ['something_else', 'unknown'],
  ])('maps %s to %s', (code, expected) => {
    expect(toAuthErrorCode(new AuthApiError('x', 400, code))).toBe(expected);
  });

  it('maps a failed fetch to network', () => {
    expect(toAuthErrorCode(new AuthRetryableFetchError('offline', 0))).toBe('network');
  });
});
