import { TestBed } from '@angular/core/testing';
import { FakeSwUpdate, provideFakeSwUpdate } from '../../../testing/fake-pwa';
import { UPDATE_CHECK_INTERVAL_MS, UpdateService } from './update.service';

function setup(options: { enabled?: boolean } = {}) {
  const sw = new FakeSwUpdate();
  sw.isEnabled = options.enabled ?? true;
  const reload = vi.fn();
  TestBed.configureTestingModule({ providers: provideFakeSwUpdate(sw, reload) });
  return { sw, reload, service: TestBed.inject(UpdateService) };
}

describe('UpdateService', () => {
  afterEach(() => vi.useRealTimers());

  it('reports an update once a new version is ready, not while it is only detected', () => {
    const { sw, service } = setup();
    expect(service.updateReady()).toBe(false);
    sw.versionUpdates.next({ type: 'VERSION_DETECTED' });
    expect(service.updateReady()).toBe(false);
    sw.versionUpdates.next({ type: 'VERSION_READY' });
    expect(service.updateReady()).toBe(true);
  });

  it('asks to reload when the cache is unrecoverable', () => {
    const { sw, service } = setup();
    sw.unrecoverable.next({ reason: 'hash mismatch' });
    expect(service.updateReady()).toBe(true);
  });

  it('checks for updates periodically', () => {
    vi.useFakeTimers();
    const { sw } = setup();
    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS * 2);
    expect(sw.checkForUpdate).toHaveBeenCalledTimes(2);
  });

  it('checks again when the app returns to the foreground', () => {
    const { sw } = setup();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(sw.checkForUpdate).toHaveBeenCalledTimes(1);
  });

  it('swallows a failing check (offline)', async () => {
    const { sw, service } = setup();
    sw.checkForUpdate.mockRejectedValueOnce(new Error('offline'));
    await expect(service.check()).resolves.toBeUndefined();
  });

  it('activates the waiting version, then reloads', async () => {
    const { sw, reload, service } = setup();
    await service.reload();
    expect(sw.activateUpdate).toHaveBeenCalledTimes(1);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the service worker is disabled (dev mode)', async () => {
    const { sw, service } = setup({ enabled: false });
    sw.versionUpdates.next({ type: 'VERSION_READY' });
    await service.check();
    expect(service.updateReady()).toBe(false);
    expect(sw.checkForUpdate).not.toHaveBeenCalled();
  });
});
