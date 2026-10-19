import { TestBed } from '@angular/core/testing';
import { MemorySnapshotStorage, provideMemorySnapshots } from '../../testing/fake-pwa';
import { ownedCard } from '../../testing/fake-owned-cards';
import { CollectionSnapshots } from './collection-snapshot';

const body = (userId: string) => ({
  userId,
  cards: [ownedCard({ id: 'a' })],
  hasMore: false,
  summary: { entries: 1, copies: 1 },
  sets: [{ id: 'base1', name: 'Base Set' }],
});

function setup() {
  const storage = new MemorySnapshotStorage();
  TestBed.configureTestingModule({ providers: [provideMemorySnapshots(storage)] });
  return { storage, snapshots: TestBed.inject(CollectionSnapshots) };
}

describe('CollectionSnapshots', () => {
  it('returns what was saved for the same user, with a timestamp', async () => {
    const { snapshots } = setup();
    await snapshots.save(body('u1'));
    const loaded = await snapshots.load('u1');
    expect(loaded?.cards.map((c) => c.id)).toEqual(['a']);
    expect(loaded?.savedAt).toBeGreaterThan(0);
  });

  it('never serves one user the snapshot of another', async () => {
    const { snapshots } = setup();
    await snapshots.save(body('u1'));
    expect(await snapshots.load('u2')).toBeNull();
  });

  it('is replaced when another user saves, and gone after clear', async () => {
    const { storage, snapshots } = setup();
    await snapshots.save(body('u1'));
    await snapshots.save(body('u2'));
    expect(await snapshots.load('u1')).toBeNull();
    expect(await snapshots.load('u2')).not.toBeNull();
    await snapshots.clear();
    expect(storage.data.size).toBe(0);
  });

  it('ignores malformed or outdated records', async () => {
    const { storage, snapshots } = setup();
    storage.data.set('snapshot', { userId: 'u1', cards: 'nope' });
    expect(await snapshots.load('u1')).toBeNull();
    storage.data.set('snapshot', { ...body('u1'), version: 0, savedAt: 1 });
    expect(await snapshots.load('u1')).toBeNull();
  });

  it('never throws when storage fails or is missing', async () => {
    const { storage, snapshots } = setup();
    storage.get = () => Promise.reject(new Error('blocked'));
    storage.set = () => Promise.reject(new Error('quota'));
    storage.delete = () => Promise.reject(new Error('blocked'));
    await expect(snapshots.load('u1')).resolves.toBeNull();
    await expect(snapshots.save(body('u1'))).resolves.toBeUndefined();
    await expect(snapshots.clear()).resolves.toBeUndefined();
  });
});
