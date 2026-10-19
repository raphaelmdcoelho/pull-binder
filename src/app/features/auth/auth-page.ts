import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { GrButton } from '@grass-ds/angular';
import { GrTextField } from '@grass-ds/angular/text-field';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthErrorCode, AuthService } from '../../core/auth/auth.service';
import { safeReturnUrl } from '../../core/auth/auth.guards';
import { Spinner } from '../../shared/ui/spinner/spinner';

export type AuthMode = 'login' | 'sign-up';

/** One page for both /login and /sign-up; the route's `data.mode` picks the variant. */
@Component({
  selector: 'pb-auth-page',
  imports: [ReactiveFormsModule, RouterLink, GrButton, GrTextField, TranslocoPipe, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (confirmEmail()) {
      <section class="gr-card" aria-labelledby="confirm-title">
        <div class="gr-card__body gr-stack">
          <h1 class="gr-card__title" id="confirm-title">{{ 'auth.confirmTitle' | transloco }}</h1>
          <p>{{ 'auth.confirmBody' | transloco }}</p>
          <a grButton variant="secondary" routerLink="/login">{{ 'auth.toLogIn' | transloco }}</a>
        </div>
      </section>
    } @else {
      <div class="gr-stack">
        <h1 class="gr-display">{{ titleKey() | transloco }}</h1>

        <button grButton variant="secondary" type="button" [disabled]="busy()" (click)="google()">
          {{ 'auth.google' | transloco }}
        </button>
        <p class="gr-text-muted" aria-hidden="true">{{ 'auth.or' | transloco }}</p>

        <form class="gr-stack" [formGroup]="form" (ngSubmit)="submit()" novalidate>
          <div class="gr-field">
            <label class="gr-field__label" for="auth-email">{{ 'auth.email' | transloco }}</label>
            <p class="gr-field__hint" id="auth-email-hint">{{ 'auth.emailHint' | transloco }}</p>
            <input
              grTextField
              id="auth-email"
              type="email"
              autocomplete="email"
              inputmode="email"
              formControlName="email"
              [attr.aria-describedby]="describedBy('email')"
            />
            @if (errorKey('email'); as key) {
              <p class="gr-field__error" id="auth-email-error" role="alert">
                {{ key | transloco }}
              </p>
            }
          </div>

          <div class="gr-field">
            <label class="gr-field__label" for="auth-password">{{
              'auth.password' | transloco
            }}</label>
            @if (mode() === 'sign-up') {
              <p class="gr-field__hint" id="auth-password-hint">
                {{ 'auth.passwordHint' | transloco }}
              </p>
            }
            <input
              grTextField
              id="auth-password"
              type="password"
              formControlName="password"
              [attr.autocomplete]="mode() === 'sign-up' ? 'new-password' : 'current-password'"
              [attr.aria-describedby]="describedBy('password')"
            />
            @if (errorKey('password'); as key) {
              <p class="gr-field__error" id="auth-password-error" role="alert">
                {{ key | transloco }}
              </p>
            }
          </div>

          @if (serverError(); as code) {
            <p class="gr-field__error" role="alert">{{ 'auth.errors.' + code | transloco }}</p>
          }

          <button grButton type="submit" [disabled]="busy()">
            @if (busy()) {
              <pb-spinner [label]="'auth.working' | transloco" />
            } @else {
              {{ (mode() === 'sign-up' ? 'auth.signUp' : 'auth.logIn') | transloco }}
            }
          </button>
        </form>

        <p class="gr-text-muted">
          {{ (mode() === 'sign-up' ? 'auth.haveAccount' : 'auth.noAccount') | transloco }}
          <a
            [routerLink]="mode() === 'sign-up' ? '/login' : '/sign-up'"
            [queryParams]="switchParams()"
          >
            {{ (mode() === 'sign-up' ? 'auth.toLogIn' : 'auth.toSignUp') | transloco }}
          </a>
        </p>
      </div>
    }
  `,
})
export class AuthPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly mode = input<AuthMode>('login');
  /** Bound from the query string by the router. */
  readonly returnUrl = input<string | undefined>();

  protected readonly busy = signal(false);
  protected readonly serverError = signal<AuthErrorCode | null>(null);
  protected readonly confirmEmail = signal(false);
  protected readonly titleKey = computed(() =>
    this.mode() === 'sign-up' ? 'auth.signUpTitle' : 'auth.loginTitle',
  );
  protected readonly switchParams = computed(() => {
    const url = safeReturnUrl(this.returnUrl());
    return url ? { returnUrl: url } : {};
  });

  protected readonly form = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      // Only sign-up enforces a length, so a login never hints at the password policy.
      validators: [
        Validators.required,
        (control) => (this.mode() === 'sign-up' ? Validators.minLength(8)(control) : null),
      ],
    }),
  });

  protected errorKey(name: 'email' | 'password'): string | null {
    const control = this.form.controls[name];
    if (!(control.touched && control.invalid)) return null;
    const errors = control.errors ?? {};
    if (errors['required']) return 'auth.errors.required';
    if (errors['email']) return 'auth.errors.email';
    if (errors['minlength']) return 'auth.errors.minlength';
    return null;
  }

  protected describedBy(name: 'email' | 'password'): string | null {
    const ids: string[] = [];
    if (name === 'email') ids.push('auth-email-hint');
    if (name === 'password' && this.mode() === 'sign-up') ids.push('auth-password-hint');
    if (this.errorKey(name)) ids.push(`auth-${name}-error`);
    return ids.length ? ids.join(' ') : null;
  }

  protected async submit(): Promise<void> {
    this.form.controls.password.updateValueAndValidity();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, password: secret } = this.form.getRawValue();
    this.busy.set(true);
    this.serverError.set(null);
    if (this.mode() === 'sign-up') {
      const result = await this.auth.signUpWithEmail(email, secret);
      this.busy.set(false);
      if (!result.ok) return this.serverError.set(result.code);
      if (result.value === 'confirm-email') return this.confirmEmail.set(true);
    } else {
      const result = await this.auth.signInWithEmail(email, secret);
      this.busy.set(false);
      if (!result.ok) return this.serverError.set(result.code);
    }
    await this.router.navigateByUrl(safeReturnUrl(this.returnUrl()) ?? '/collection');
  }

  protected async google(): Promise<void> {
    this.busy.set(true);
    this.serverError.set(null);
    const result = await this.auth.signInWithGoogle();
    // On success the browser is already leaving for Google.
    if (!result.ok) {
      this.busy.set(false);
      this.serverError.set(result.code);
    }
  }
}
