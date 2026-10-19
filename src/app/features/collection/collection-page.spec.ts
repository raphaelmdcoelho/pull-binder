import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CollectionStore, PAGE_SIZE } from '../../collection/collection.store';
import { OwnedCard } from '../../collection/owned-card.model';
import { OwnedCardsError } from '../../collection/owned-cards.repository';
import { LanguageService } from '../../core/i18n/language.service';
import { polyfillDialog } from '../../../testing/dialog-polyfill';
import {
  FakeOwnedCards,
  ownedCard,
  provideFakeOwnedCards,
} from '../../../testing/fake-owned-cards';
import { provideTestI18n } from '../../../testing/transloco';
import { CollectionPage } from './collection-page';

const owned: OwnedCard = ownedCard({
  id: '1',
  language: 'pt',
  condition: 'lightly_played',
  quantity: 3,
});

async function setup(fake: FakeOwnedCards) {
  localStorage.clear();
  polyfillDialog();
  TestBed.configureTestingModule({
    imports: [CollectionPage],
    providers: [provideRouter([]), provideTestI18n(), provideFakeOwnedCards(fake)],
  });
  await TestBed.inject(LanguageService).set('en');
  const fixture = TestBed.createComponent(CollectionPage);
  fixture.detectChanges();
  const settle = async () => {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve));
    fixture.detectChanges();
  };
  await settle();
  const el = fixture.nativeElement as HTMLElement;
  const select = async (id: string, value: string) => {
    const s = el.querySelector<HTMLSelectElement>(`#${id}`)!;
    s.value = value;
    s.dispatchEvent(new Event('change'));
    await settle();
  };
  const buttons = () => Array.from(el.querySelectorAll('button'));
  const button = (text: string) => buttons().find((b) => b.textContent?.includes(text));
  return { fixture, el, settle, select, button, store: TestBed.inject(CollectionStore) };
}

describe('CollectionPage', () => {
  it('shows the empty state with a link to search and no filter controls', async () => {
    const { el } = await setup(new FakeOwnedCards());
    expect(el.textContent).toContain('No cards yet');
    expect(el.querySelector('a[href="/search"]')).toBeTruthy();
    expect(el.querySelector('.pb-filters')).toBeNull();
  });

  it('lists Owned cards with quantity, condition, language and finish, plus the summary', async () => {
    const fake = new FakeOwnedCards();
    fake.rows = [owned];
    const { el } = await setup(fake);
    const text = el.textContent?.replace(/\s+/g, ' ');
    expect(text).toContain('Charizard');
    expect(text).toContain('Base Set · #4');
    expect(text).toContain('×3');
    expect(text).toContain('Lightly Played');
    expect(text).toContain('Português');
    expect(text).toContain('1 different cards, 3 copies in total');
    expect(el.querySelector('img')?.getAttribute('alt')).toBe('Charizard 4');
  });

  it('shows an alert with a retry button when loading fails', async () => {
    const fake = new FakeOwnedCards();
    fake.listImpl = async () => {
      throw new OwnedCardsError('network');
    };
    const { el, button } = await setup(fake);
    expect(el.querySelector('[role="alert"]')?.textContent).toContain("Can't reach the server");
    expect(button('Try again')).toBeTruthy();
  });

  it('filters by set, condition, language and finish through the server query', async () => {
    const fake = new FakeOwnedCards();
    fake.rows = [
      owned,
      ownedCard({
        id: '2',
        cardId: 'b',
        cardName: 'Pikachu',
        setId: 'b',
        setName: 'Beta',
        quantity: 2,
      }),
    ];
    const { el, select, store } = await setup(fake);
    expect(el.querySelectorAll('#f-set option')).toHaveLength(3); // Any + two sets
    await select('f-set', 'b');
    expect(fake.listCalls.at(-1)?.query.setId).toBe('b');
    expect(el.textContent).toContain('1 different cards, 2 copies match your filters');
    expect(el.querySelectorAll('.pb-owned-list > li')).toHaveLength(1);
    expect(el.querySelector('summary')?.textContent).toContain('(1)');
    await select('f-condition', 'damaged');
    await select('f-language', 'ja');
    await select('f-finish', 'holo');
    expect(store.filters()).toMatchObject({ condition: 'damaged', language: 'ja', finish: 'holo' });
  });

  it('explains when filters hide everything and clears them', async () => {
    const fake = new FakeOwnedCards();
    fake.rows = [owned];
    const { el, select, button, settle } = await setup(fake);
    await select('f-condition', 'damaged');
    expect(el.textContent).toContain('No cards match');
    expect(el.textContent).not.toContain('No cards yet');
    button('Clear filters')!.click();
    await settle();
    expect(el.textContent).toContain('Charizard');
    expect(el.querySelector('summary')?.textContent).not.toContain('(');
  });

  it('sorts through the server query', async () => {
    const fake = new FakeOwnedCards();
    fake.rows = [owned, ownedCard({ id: '2', cardId: 'b', cardName: 'Abra', quantity: 9 })];
    const { el, select } = await setup(fake);
    await select('sort', 'name');
    expect(fake.listCalls.at(-1)?.query.sort).toBe('name');
    expect(el.querySelector('.pb-owned-list h2')?.textContent).toBe('Abra');
    await select('sort', 'quantity');
    expect(el.querySelector('.pb-owned-list h2')?.textContent).toBe('Abra');
  });

  it('searches by name after the debounce and clears at once', async () => {
    const fake = new FakeOwnedCards();
    fake.rows = [owned];
    const { el, store } = await setup(fake);
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    try {
      const input = el.querySelector<HTMLInputElement>('input[type="search"]')!;
      input.value = 'char';
      input.dispatchEvent(new Event('input'));
      expect(store.filters().text).toBe('');
      await vi.advanceTimersByTimeAsync(300);
      expect(store.filters().text).toBe('char');
      input.value = '';
      input.dispatchEvent(new Event('input'));
      await vi.advanceTimersByTimeAsync(0);
      expect(store.filters().text).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });

  it('loads more pages with a button', async () => {
    const fake = new FakeOwnedCards();
    fake.rows = Array.from({ length: PAGE_SIZE + 2 }, (_, i) =>
      ownedCard({
        id: `r${i}`,
        cardId: `c${i}`,
        cardName: `Card ${i}`,
        updatedAt: `2026-01-01T00:00:${String(59 - i).padStart(2, '0')}Z`,
      }),
    );
    const { el, button, settle } = await setup(fake);
    expect(el.querySelectorAll('.pb-owned-list > li')).toHaveLength(PAGE_SIZE);
    button('Load more')!.click();
    await settle();
    expect(el.querySelectorAll('.pb-owned-list > li')).toHaveLength(PAGE_SIZE + 2);
    expect(button('Load more')).toBeUndefined();
  });

  it('opens the edit and remove dialogs for the right card with named buttons', async () => {
    const fake = new FakeOwnedCards();
    fake.rows = [owned];
    const { el, fixture } = await setup(fake);
    const edit = el.querySelector<HTMLButtonElement>('[aria-label="Edit: Charizard"]')!;
    const remove = el.querySelector<HTMLButtonElement>('[aria-label="Remove: Charizard"]')!;
    edit.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('#edit-condition')).toBeTruthy();
    remove.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).toContain('Remove from collection?');
  });
});
