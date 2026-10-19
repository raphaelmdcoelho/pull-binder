import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { AuthApiError } from '@supabase/supabase-js';
import { createFakeSupabase, provideFakeSupabase } from '../../../testing/fake-supabase';
import { provideTestI18n } from '../../../testing/transloco';
import { LanguageService } from '../../core/i18n/language.service';
import { AuthPage } from './auth-page';

async function setup(mode: 'login' | 'sign-up', returnUrl?: string) {
  const fake = createFakeSupabase();
  TestBed.configureTestingModule({
    imports: [AuthPage],
    providers: [provideRouter([]), provideTestI18n(), provideFakeSupabase(fake)],
  });
  await TestBed.inject(LanguageService).set('en');
  const router = TestBed.inject(Router);
  const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
  const fixture = TestBed.createComponent(AuthPage);
  fixture.componentRef.setInput('mode', mode);
  if (returnUrl) fixture.componentRef.setInput('returnUrl', returnUrl);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const fill = (id: string, value: string) => {
    const input = el.querySelector<HTMLInputElement>(`#${id}`)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new Event('blur'));
  };
  const submit = async () => {
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    fixture.detectChanges();
  };
  return { fake, fixture, el, fill, submit, navigate };
}

describe('AuthPage', () => {
  beforeEach(() => localStorage.clear());

  it('shows required errors as alerts and does not call Supabase', async () => {
    const { fake, el, submit } = await setup('login');
    await submit();
    const alerts = Array.from(el.querySelectorAll('[role="alert"]')).map((e) =>
      e.textContent?.trim(),
    );
    expect(alerts).toEqual(['This field is required.', 'This field is required.']);
    expect(el.querySelector('#auth-email')?.getAttribute('aria-describedby')).toContain(
      'auth-email-error',
    );
    expect(fake.auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('logs in and goes to the return url', async () => {
    const { fake, fill, submit, navigate } = await setup('login', '/account');
    fill('auth-email', 'ash@example.test');
    fill('auth-password', 'secret');
    await submit();
    expect(fake.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'ash@example.test',
      password: 'secret',
    });
    expect(navigate).toHaveBeenCalledWith('/account');
  });

  it('ignores an unsafe return url', async () => {
    const { fill, submit, navigate } = await setup('login', '//evil.test');
    fill('auth-email', 'a@b.c');
    fill('auth-password', 'secret');
    await submit();
    expect(navigate).toHaveBeenCalledWith('/collection');
  });

  it('shows a translated server error', async () => {
    const { fake, el, fill, submit, navigate } = await setup('login');
    fake.auth.signInWithPassword.mockResolvedValueOnce({
      data: {},
      error: new AuthApiError('bad', 400, 'invalid_credentials'),
    });
    fill('auth-email', 'a@b.c');
    fill('auth-password', 'wrong');
    await submit();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Wrong email or password.');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('requires 8 characters on sign-up only', async () => {
    const signUp = await setup('sign-up');
    signUp.fill('auth-email', 'a@b.c');
    signUp.fill('auth-password', 'short');
    await signUp.submit();
    expect(signUp.el.textContent).toContain('Use at least 8 characters.');
    expect(signUp.fake.auth.signUp).not.toHaveBeenCalled();
  });

  it('asks to confirm the email after sign-up', async () => {
    const { el, fill, submit, navigate } = await setup('sign-up');
    fill('auth-email', 'a@b.c');
    fill('auth-password', 'longenough');
    await submit();
    expect(el.textContent).toContain('Check your email');
    expect(navigate).not.toHaveBeenCalled();
  });

  it('starts Google sign-in', async () => {
    const { fake, el, fixture } = await setup('login');
    el.querySelector<HTMLButtonElement>('button')!.click();
    await fixture.whenStable();
    expect(fake.auth.signInWithOAuth).toHaveBeenCalled();
  });
});
