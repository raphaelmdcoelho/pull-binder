import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Card } from '../../catalog/card.model';
import { CatalogError } from '../../catalog/catalog.service';
import { LanguageService } from '../../core/i18n/language.service';
import { FakeCatalog, provideFakeCatalog } from '../../../testing/fake-catalog';
import { FakeOwnedCards, provideFakeOwnedCards } from '../../../testing/fake-owned-cards';
import { provideTestI18n } from '../../../testing/transloco';
import { CardDetailPage } from './card-detail-page';

const card: Card = {
  id: 'base1-4',
  number: '4',
  name: 'Charizard',
  imageBase: 'https://img.test/base1-4',
  setId: 'base1',
  setName: 'Base Set',
  rarity: 'Rare',
  illustrator: null,
  finishes: ['holo', 'other'],
  lang: 'en',
};

async function setup(fake: FakeCatalog) {
  localStorage.clear();
  TestBed.configureTestingModule({
    imports: [CardDetailPage],
    providers: [
      provideRouter([]),
      provideTestI18n(),
      provideFakeCatalog(fake),
      provideFakeOwnedCards(new FakeOwnedCards()),
    ],
  });
  await TestBed.inject(LanguageService).set('en');
  const fixture = TestBed.createComponent(CardDetailPage);
  fixture.componentRef.setInput('id', 'base1-4');
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('CardDetailPage', () => {
  it('shows the card, its set and finishes', async () => {
    const fake = new FakeCatalog();
    fake.getCardImpl = async () => card;
    const el = await setup(fake);
    expect(el.querySelector('h1')?.textContent).toBe('Charizard');
    expect(el.textContent).toContain('Base Set');
    expect(el.textContent?.replace(/\s+/g, ' ')).toContain('Holo, Other');
    expect(el.querySelector('img')?.getAttribute('src')).toBe('https://img.test/base1-4/high.webp');
  });

  it('shows a translated error', async () => {
    const fake = new FakeCatalog();
    fake.getCardImpl = async () => {
      throw new CatalogError('not-found');
    };
    const el = await setup(fake);
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('not in the catalog');
  });
});
