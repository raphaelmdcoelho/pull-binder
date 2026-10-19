import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CatalogError } from '../../catalog/catalog.service';
import { LanguageService } from '../../core/i18n/language.service';
import { FakeCatalog, page, provideFakeCatalog, summary } from '../../../testing/fake-catalog';
import { FakeOwnedCards, provideFakeOwnedCards } from '../../../testing/fake-owned-cards';
import { FakeConnectivity, provideFakeConnectivity } from '../../../testing/fake-pwa';
import { provideTestI18n } from '../../../testing/transloco';
import { SearchPage } from './search-page';
import { SearchStore } from './search.store';

async function setup() {
  localStorage.clear();
  const catalog = new FakeCatalog();
  const connectivity = new FakeConnectivity();
  TestBed.configureTestingModule({
    imports: [SearchPage],
    providers: [
      provideRouter([]),
      provideTestI18n(),
      provideFakeCatalog(catalog),
      provideFakeOwnedCards(new FakeOwnedCards()),
      provideFakeConnectivity(connectivity),
    ],
  });
  await TestBed.inject(LanguageService).set('en');
  const fixture = TestBed.createComponent(SearchPage);
  fixture.detectChanges();
  const run = async (query: string) => {
    await TestBed.inject(SearchStore).search(query);
    fixture.detectChanges();
  };
  return { catalog, connectivity, fixture, el: fixture.nativeElement as HTMLElement, run };
}

describe('SearchPage offline', () => {
  it('says searches already made still work and disables quick add', async () => {
    const { catalog, connectivity, fixture, el, run } = await setup();
    catalog.searchImpl = async () => page([summary('base1-4', 'Charizard', '4')]);
    await run('char');
    connectivity.set(false);
    fixture.detectChanges();
    expect(el.textContent).toContain("You're offline. Searches you've already made still work");
    expect(el.querySelector<HTMLButtonElement>('li button')!.disabled).toBe(true);
    connectivity.set(true);
    fixture.detectChanges();
    expect(el.querySelector<HTMLButtonElement>('li button')!.disabled).toBe(false);
  });

  it('shows a friendly offline state for a search that is not cached', async () => {
    const { catalog, connectivity, fixture, el, run } = await setup();
    connectivity.set(false);
    catalog.searchImpl = async () => {
      throw new CatalogError('network');
    };
    await run('mew');
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      "You're offline and this search isn't saved on this device",
    );
  });
});
