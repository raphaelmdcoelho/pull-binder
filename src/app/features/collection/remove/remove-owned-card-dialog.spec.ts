import { Component, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { OwnedCard } from '../../../collection/owned-card.model';
import { OwnedCardsError } from '../../../collection/owned-cards.repository';
import { CollectionStore } from '../../../collection/collection.store';
import { LanguageService } from '../../../core/i18n/language.service';
import { polyfillDialog } from '../../../../testing/dialog-polyfill';
import {
  FakeOwnedCards,
  ownedCard,
  provideFakeOwnedCards,
} from '../../../../testing/fake-owned-cards';
import { provideTestI18n } from '../../../../testing/transloco';
import { StatusService } from '../../../shared/ui/status-region/status.service';
import { RemoveOwnedCardDialog } from './remove-owned-card-dialog';

@Component({ imports: [RemoveOwnedCardDialog], template: `<pb-remove-owned-card-dialog />` })
class Host {
  readonly dialog = viewChild.required(RemoveOwnedCardDialog);
}

async function setup(rows: OwnedCard[]) {
  localStorage.clear();
  polyfillDialog();
  const fake = new FakeOwnedCards();
  fake.rows = rows;
  TestBed.configureTestingModule({
    imports: [Host],
    providers: [provideTestI18n(), provideFakeOwnedCards(fake)],
  });
  await TestBed.inject(LanguageService).set('en');
  const store = TestBed.inject(CollectionStore);
  await store.reload();
  const fixture = TestBed.createComponent(Host);
  fixture.detectChanges();
  const el = fixture.nativeElement as HTMLElement;
  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  fixture.componentInstance.dialog().openFor(store.cards()[0]);
  await settle();
  return { fake, store, el, settle };
}

const confirmButton = (el: HTMLElement) =>
  el.querySelector<HTMLButtonElement>('button[type="submit"]')!;

describe('RemoveOwnedCardDialog', () => {
  it('names the card and the copies, warns it is permanent and focuses Cancel first', async () => {
    const { el } = await setup([ownedCard({ id: '1', quantity: 4 })]);
    expect(el.textContent).toContain('Charizard (all 4 copies)');
    expect(el.textContent).toContain('cannot be undone');
    const cancel = el.querySelector('button[type="button"]')!;
    expect(cancel.hasAttribute('autofocus')).toBe(true);
    expect(confirmButton(el).getAttribute('data-variant')).toBe('danger');
  });

  it('removes only after confirming, then announces it', async () => {
    const { fake, store, el, settle } = await setup([ownedCard({ id: '1', quantity: 2 })]);
    expect(fake.rows).toHaveLength(1);
    el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
    expect(fake.rows).toHaveLength(0);
    expect(store.cards()).toEqual([]);
    expect(TestBed.inject(StatusService).message()?.text).toBe(
      'Removed Charizard (2 copies) from your collection.',
    );
    expect(el.querySelector('dialog')?.hasAttribute('open')).toBe(false);
  });

  it('Cancel removes nothing', async () => {
    const { fake, el, settle } = await setup([ownedCard({ id: '1' })]);
    el.querySelector<HTMLButtonElement>('button[type="button"]')!.click();
    await settle();
    expect(fake.rows).toHaveLength(1);
    expect(TestBed.inject(StatusService).message()).toBeNull();
  });

  it('shows an alert and stays open when removing fails', async () => {
    const { fake, el, settle } = await setup([ownedCard({ id: '1' })]);
    fake.removeImpl = async () => {
      throw new OwnedCardsError('network');
    };
    el.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain("Can't reach the server");
    expect(el.querySelector('dialog')?.hasAttribute('open')).toBe(true);
    expect(TestBed.inject(StatusService).message()).toBeNull();
  });
});
