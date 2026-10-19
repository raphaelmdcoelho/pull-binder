import { TestBed } from '@angular/core/testing';
import {
  FakeConnectivity,
  FakeSwUpdate,
  provideFakeConnectivity,
  provideFakeSwUpdate,
} from '../../../../testing/fake-pwa';
import { provideTestI18n } from '../../../../testing/transloco';
import { SystemBanners } from './system-banners';

function setup() {
  const connectivity = new FakeConnectivity();
  const sw = new FakeSwUpdate();
  const reload = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      provideTestI18n(),
      provideFakeConnectivity(connectivity),
      ...provideFakeSwUpdate(sw, reload),
    ],
  });
  const fixture = TestBed.createComponent(SystemBanners);
  const el = fixture.nativeElement as HTMLElement;
  return { connectivity, sw, reload, fixture, el };
}

describe('SystemBanners', () => {
  it('keeps an empty polite live region while everything is fine', async () => {
    const { fixture, el } = setup();
    await fixture.whenStable();
    expect(el.querySelector('[aria-live="polite"]')).toBeTruthy();
    expect(el.querySelector('.pb-banner')).toBeNull();
  });

  it('shows the offline notice only while offline', async () => {
    const { connectivity, fixture, el } = setup();
    connectivity.set(false);
    await fixture.whenStable();
    expect(el.querySelector('[data-kind="offline"]')?.textContent).toContain("You're offline");
    connectivity.set(true);
    await fixture.whenStable();
    expect(el.querySelector('[data-kind="offline"]')).toBeNull();
  });

  it('offers Reload and Later when an update is ready', async () => {
    const { sw, reload, fixture, el } = setup();
    sw.versionUpdates.next({ type: 'VERSION_READY' });
    await fixture.whenStable();
    const buttons = Array.from(
      el.querySelectorAll<HTMLButtonElement>('[data-kind="update"] button'),
    );
    expect(buttons.map((b) => b.textContent?.trim())).toEqual(['Reload', 'Later']);
    buttons[0].click();
    await fixture.whenStable();
    expect(sw.activateUpdate).toHaveBeenCalled();
    expect(reload).toHaveBeenCalled();
  });

  it('hides the update notice after Later', async () => {
    const { sw, fixture, el } = setup();
    sw.versionUpdates.next({ type: 'VERSION_READY' });
    await fixture.whenStable();
    el.querySelectorAll<HTMLButtonElement>('[data-kind="update"] button')[1].click();
    await fixture.whenStable();
    expect(el.querySelector('[data-kind="update"]')).toBeNull();
  });
});
