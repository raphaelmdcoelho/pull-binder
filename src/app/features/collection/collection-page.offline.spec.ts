import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CollectionSnapshots } from '../../collection/collection-snapshot';
import { AuthService } from '../../core/auth/auth.service';
import { LanguageService } from '../../core/i18n/language.service';
import { polyfillDialog } from '../../../testing/dialog-polyfill';
import {
  FakeOwnedCards,
  ownedCard,
  provideFakeOwnedCards,
} from '../../../testing/fake-owned-cards';
import {
  FakeConnectivity,
  MemorySnapshotStorage,
  provideFakeConnectivity,
  provideMemorySnapshots,
} from '../../../testing/fake-pwa';
import {
  createFakeSupabase,
  provideFakeSupabase,
  sessionFor,
} from '../../../testing/fake-supabase';
import { provideTestI18n } from '../../../testing/transloco';
import { CollectionPage } from './collection-page';

async function setup(options: { saved: boolean }) {
  localStorage.clear();
  polyfillDialog();
  const connectivity = new FakeConnectivity();
  const fake = new FakeOwnedCards();
  TestBed.configureTestingModule({
    imports: [CollectionPage],
    providers: [
      provideRouter([]),
      provideTestI18n(),
      provideFakeOwnedCards(fake),
      provideFakeConnectivity(connectivity),
      provideMemorySnapshots(new MemorySnapshotStorage()),
      provideFakeSupabase(createFakeSupabase(sessionFor())),
    ],
  });
  await TestBed.inject(AuthService).init();
  await TestBed.inject(LanguageService).set('en');
  if (options.saved) {
    await TestBed.inject(CollectionSnapshots).save({
      userId: 'user-1',
      cards: [ownedCard({ id: 'a', cardName: 'Charizard', quantity: 2 })],
      hasMore: true,
      summary: { entries: 1, copies: 2 },
      sets: [{ id: 'base1', name: 'Base Set' }],
    });
  }
  connectivity.set(false);
  const fixture = TestBed.createComponent(CollectionPage);
  fixture.detectChanges();
  await fixture.whenStable();
  await new Promise((resolve) => setTimeout(resolve));
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement, connectivity, fake };
}

describe('CollectionPage offline', () => {
  it('shows the saved Collection with a note and disabled Edit and Remove', async () => {
    const { el, fake } = await setup({ saved: true });
    expect(el.textContent).toContain('Charizard');
    expect(el.querySelector('#collection-offline-note')?.textContent).toContain(
      'Showing your collection as saved on',
    );
    expect(el.querySelector('#collection-offline-note')?.textContent).toContain(
      'Only the cards you had scrolled through are saved.',
    );
    expect(el.querySelector('#collection-offline-note')?.textContent).toContain(
      'adding, editing and removing cards are paused',
    );
    const actions = Array.from(el.querySelectorAll<HTMLButtonElement>('.pb-owned__actions button'));
    expect(actions).toHaveLength(2);
    expect(actions.every((b) => b.disabled)).toBe(true);
    expect(actions[0].getAttribute('aria-describedby')).toBe('collection-offline-note');
    expect(fake.listCalls).toHaveLength(0);
  });

  it('enables the buttons again and drops the note once the live list is back', async () => {
    const { fixture, el, connectivity, fake } = await setup({ saved: true });
    fake.rows = [ownedCard({ id: 'a', cardName: 'Charizard', quantity: 2 })];
    connectivity.set(true);
    TestBed.tick();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
    expect(el.querySelector('#collection-offline-note')).toBeNull();
    const actions = Array.from(el.querySelectorAll<HTMLButtonElement>('.pb-owned__actions button'));
    expect(actions.every((b) => !b.disabled)).toBe(true);
  });

  it('tells the user to open it once online when nothing is saved', async () => {
    const { el } = await setup({ saved: false });
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'no saved copy of your collection',
    );
  });
});
