import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { OwnedCard } from '../../collection/owned-card.model';
import { OwnedCardsError } from '../../collection/owned-cards.repository';
import { LanguageService } from '../../core/i18n/language.service';
import { FakeOwnedCards, provideFakeOwnedCards } from '../../../testing/fake-owned-cards';
import { provideTestI18n } from '../../../testing/transloco';
import { CollectionPage } from './collection-page';

const owned: OwnedCard = {
  id: '1',
  cardId: 'base1-4',
  language: 'pt',
  condition: 'lightly_played',
  finish: 'holo',
  quantity: 3,
  cardName: 'Charizard',
  cardNumber: '4',
  setId: 'base1',
  setName: 'Base Set',
  imageBase: 'https://img.test/base1-4',
  updatedAt: '2026-10-19T00:00:00Z',
};

async function setup(fake: FakeOwnedCards) {
  localStorage.clear();
  TestBed.configureTestingModule({
    imports: [CollectionPage],
    providers: [provideRouter([]), provideTestI18n(), provideFakeOwnedCards(fake)],
  });
  await TestBed.inject(LanguageService).set('en');
  const fixture = TestBed.createComponent(CollectionPage);
  fixture.detectChanges();
  await fixture.whenStable();
  await new Promise((resolve) => setTimeout(resolve));
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('CollectionPage', () => {
  it('shows the empty state with a link to search', async () => {
    const el = await setup(new FakeOwnedCards());
    expect(el.textContent).toContain('No cards yet');
    expect(el.querySelector('a[href="/search"]')).toBeTruthy();
  });

  it('lists Owned cards with quantity, condition, language and finish', async () => {
    const fake = new FakeOwnedCards();
    fake.rows = [owned];
    const el = await setup(fake);
    const text = el.textContent?.replace(/\s+/g, ' ');
    expect(text).toContain('Charizard');
    expect(text).toContain('Base Set · #4');
    expect(text).toContain('×3');
    expect(text).toContain('Lightly Played');
    expect(text).toContain('Português');
    expect(text).toContain('Holo');
    expect(text).toContain('1 entries, 3 cards in total');
    expect(el.querySelector('img')?.getAttribute('alt')).toBe('Charizard 4');
  });

  it('shows an alert with a retry button when loading fails', async () => {
    const fake = new FakeOwnedCards();
    fake.listImpl = async () => {
      throw new OwnedCardsError('network');
    };
    const el = await setup(fake);
    expect(el.querySelector('[role="alert"]')?.textContent).toContain("Can't reach the server");
    expect(
      Array.from(el.querySelectorAll('button')).some((b) => b.textContent?.includes('Try again')),
    ).toBe(true);
  });
});
