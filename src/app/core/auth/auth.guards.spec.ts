import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import {
  createFakeSupabase,
  provideFakeSupabase,
  sessionFor,
} from '../../../testing/fake-supabase';
import { authGuard, guestGuard, safeReturnUrl } from './auth.guards';
import { AuthService } from './auth.service';

async function run(guard: typeof authGuard, signedIn: boolean, url = '/collection') {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      provideFakeSupabase(createFakeSupabase(signedIn ? sessionFor() : null)),
    ],
  });
  await TestBed.inject(AuthService).init();
  return TestBed.runInInjectionContext(() =>
    guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot),
  );
}

describe('guards', () => {
  it('lets a signed-in user through authGuard', async () => {
    expect(await run(authGuard, true)).toBe(true);
  });

  it('sends a signed-out user to /login with the return url', async () => {
    const result = (await run(authGuard, false, '/account')) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/login?returnUrl=%2Faccount');
  });

  it('keeps signed-in users off the login page', async () => {
    const result = (await run(guestGuard, true)) as UrlTree;
    expect(TestBed.inject(Router).serializeUrl(result)).toBe('/collection');
  });

  it('lets guests see the login page', async () => {
    expect(await run(guestGuard, false)).toBe(true);
  });
});

describe('safeReturnUrl', () => {
  it('accepts in-app paths only', () => {
    expect(safeReturnUrl('/account')).toBe('/account');
    expect(safeReturnUrl('//evil.test')).toBeNull();
    expect(safeReturnUrl('https://evil.test')).toBeNull();
    expect(safeReturnUrl(undefined)).toBeNull();
  });
});
