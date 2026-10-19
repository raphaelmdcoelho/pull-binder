import { Component, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Card } from '../../../catalog/card.model';
import { CatalogError } from '../../../catalog/catalog.service';
import { CollectionStore } from '../../../collection/collection.store';
import { OwnedCardsError } from '../../../collection/owned-cards.repository';
import { LanguageService } from '../../../core/i18n/language.service';
import { FakeCatalog, provideFakeCatalog } from '../../../../testing/fake-catalog';
import { FakeOwnedCards, provideFakeOwnedCards } from '../../../../testing/fake-owned-cards';
import { provideTestI18n } from '../../../../testing/transloco';
import { StatusService } from '../../../shared/ui/status-region/status.service';
import { AddOwnedCardDialog } from './add-owned-card-dialog';

const card: Card = {
  id: 'base1-4',
  number: '4',
  name: 'Charizard',
  imageBase: 'https://img.test/base1-4',
  setId: 'base1',
  setName: 'Base Set',
  rarity: 'Rare',
  illustrator: null,
  finishes: ['holo', 'reverse_holo'],
  lang: 'pt',
};

@Component({ imports: [AddOwnedCardDialog], template: `<pb-add-owned-card-dialog />` })
class Host {
  readonly dialog = viewChild.required(AddOwnedCardDialog);
}

async function setup() {
  localStorage.clear();
  // jsdom has no <dialog> methods
  HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement, value?: string) {
    this.removeAttribute('open');
    this.returnValue = value ?? '';
    this.dispatchEvent(new Event('close'));
  };
  const catalog = new FakeCatalog();
  const owned = new FakeOwnedCards();
  TestBed.configureTestingModule({
    imports: [Host],
    providers: [provideTestI18n(), provideFakeCatalog(catalog), provideFakeOwnedCards(owned)],
  });
  await TestBed.inject(LanguageService).set('en');
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const open = async (target: Card | string) => {
    fixture.componentInstance.dialog().openFor(target);
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const select = (id: string, value: string) => {
    const s = el.querySelector<HTMLSelectElement>(`#${id}`)!;
    s.value = value;
    s.dispatchEvent(new Event('change'));
  };
  const submit = async () => {
    el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
  };
  return { catalog, owned, fixture, el, open, settle, select, submit };
}

describe('AddOwnedCardDialog', () => {
  it('defaults the language to the card language and offers only the finishes the Card has', async () => {
    const { el, open } = await setup();
    await open(card);
    expect(el.querySelector<HTMLSelectElement>('#add-language')!.value).toBe('pt');
    const finishes = Array.from(el.querySelectorAll('#add-finish option')).map((o) =>
      o.getAttribute('value'),
    );
    expect(finishes).toEqual(['holo', 'reverse_holo']);
    expect(el.querySelector('h2')?.textContent).toContain('Add to collection');
  });

  it('adds what was chosen, announces it and refreshes the Collection', async () => {
    const { owned, el, open, select, submit, settle } = await setup();
    const status = TestBed.inject(StatusService);
    const store = TestBed.inject(CollectionStore);
    await store.refresh();
    await open(card);
    select('add-condition', 'damaged');
    select('add-language', 'ja');
    select('add-finish', 'reverse_holo');
    el.querySelector<HTMLButtonElement>('[aria-label="One more"]')!.click();
    await settle();
    await submit();
    expect(owned.added).toHaveLength(1);
    expect(owned.added[0]).toMatchObject({
      language: 'ja',
      condition: 'damaged',
      finish: 'reverse_holo',
      quantity: 2,
      card: { id: 'base1-4' },
    });
    expect(status.message()).toEqual({
      kind: 'success',
      text: 'Added 2 × Charizard to your collection. You now have 2.',
    });
    expect(el.querySelector('dialog')?.hasAttribute('open')).toBe(false);
    await store.ensureLoaded();
    expect(store.cards()).toHaveLength(1);
  });

  it('loads a card by id first', async () => {
    const { catalog, el, open } = await setup();
    catalog.getCardImpl = async () => card;
    await open('base1-4');
    expect(el.querySelector('#add-condition')).toBeTruthy();
  });

  it('shows a translated alert when the card cannot be loaded and does not allow adding', async () => {
    const { catalog, el, open } = await setup();
    catalog.getCardImpl = async () => {
      throw new CatalogError('network');
    };
    await open('base1-4');
    expect(el.querySelector('[role="alert"]')?.textContent).toContain("Can't reach the catalog");
    expect(el.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
  });

  it('keeps the dialog open and shows an alert when saving fails', async () => {
    const { owned, el, open, submit } = await setup();
    owned.addImpl = async () => {
      throw new OwnedCardsError('quantity-limit');
    };
    await open(card);
    await submit();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('at most 9999');
    expect(el.querySelector('dialog')?.hasAttribute('open')).toBe(true);
    expect(TestBed.inject(StatusService).message()).toBeNull();
  });

  it('reads Portuguese labels', async () => {
    const { el, open, settle } = await setup();
    await TestBed.inject(LanguageService).set('pt-BR');
    await open(card);
    await settle();
    expect(el.textContent).toContain('Quantidade');
    expect(el.textContent).toContain('Quase perfeita (NM)');
  });
});
