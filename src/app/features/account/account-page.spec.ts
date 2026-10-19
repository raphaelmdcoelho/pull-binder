import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import {
  createFakeSupabase,
  provideFakeSupabase,
  sessionFor,
} from '../../../testing/fake-supabase';
import { provideTestI18n } from '../../../testing/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { LanguageService } from '../../core/i18n/language.service';
import { AccountPage } from './account-page';

describe('AccountPage', () => {
  async function setup() {
    localStorage.clear();
    const fake = createFakeSupabase(sessionFor());
    TestBed.configureTestingModule({
      imports: [AccountPage],
      providers: [provideRouter([]), provideTestI18n(), provideFakeSupabase(fake)],
    });
    await TestBed.inject(AuthService).init();
    await TestBed.inject(LanguageService).set('en');
    const fixture = TestBed.createComponent(AccountPage);
    fixture.detectChanges();
    return { fake, fixture, el: fixture.nativeElement as HTMLElement };
  }

  it('shows who is signed in', async () => {
    const { el } = await setup();
    expect(el.textContent).toContain('Ash Ketchum');
    expect(el.textContent).toContain('ash@example.test');
  });

  it('signs out and goes to /login', async () => {
    const { fake, fixture, el } = await setup();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    Array.from(el.querySelectorAll('button'))
      .find((b) => b.textContent?.includes('Log out'))!
      .click();
    await fixture.whenStable();
    expect(fake.auth.signOut).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/login');
  });
});
