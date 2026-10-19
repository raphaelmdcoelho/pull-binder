import { Provider } from '@angular/core';
import { Card, CardPage, CardSummary, SearchRequest } from '../app/catalog/card.model';
import { CatalogService } from '../app/catalog/catalog.service';

export function summary(id: string, name: string, number = '1'): CardSummary {
  return { id, number, name, imageBase: `https://img.test/${id}` };
}

export function page(cards: CardSummary[], extra: Partial<CardPage> = {}): CardPage {
  return { cards, page: 1, hasMore: false, lang: 'en', fellBackToEnglish: false, ...extra };
}

/** A Catalog with scripted answers; nothing touches the network. */
export class FakeCatalog extends CatalogService {
  readonly searches: SearchRequest[] = [];
  searchImpl: (request: SearchRequest) => Promise<CardPage> = async () => page([]);
  getCardImpl: (id: string, lang: string) => Promise<Card> = async (id) => {
    throw new Error(`no card scripted for ${id}`);
  };

  override searchCards(request: SearchRequest): Promise<CardPage> {
    this.searches.push(request);
    return this.searchImpl(request);
  }

  override getCard(id: string, lang: string): Promise<Card> {
    return this.getCardImpl(id, lang);
  }
}

export function provideFakeCatalog(fake: FakeCatalog): Provider {
  return { provide: CatalogService, useValue: fake };
}
