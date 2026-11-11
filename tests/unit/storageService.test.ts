import { describe, expect, it, vi } from 'vitest';
import {
  STORAGE_KEY,
  clearAppState,
  createDefaultAppState,
  loadAppState,
  saveAppState,
} from '../../src/services/storageService';

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

describe('storageService', () => {
  it('returns clean default state when storage is empty', () => {
    const storage = createMemoryStorage();
    const state = loadAppState(storage);

    expect(state.schemaVersion).toBe(1);
    expect(state.totalStars).toBe(0);
    expect(state.skills['clock-parts'].unlocked).toBe(true);
    expect(state.skills.oclock.unlocked).toBe(false);
    expect(state.settings.minuteLabelMode).toBe('all');
  });

  it('persists and reloads valid application state', () => {
    const storage = createMemoryStorage();
    const state = createDefaultAppState();
    state.totalStars = 12;
    state.settings.soundEnabled = false;
    state.skills.oclock.unlocked = true;
    state.skills.oclock.starsEarned = 3;

    expect(saveAppState(state, storage)).toBe(true);

    const reloaded = loadAppState(storage);
    expect(reloaded.totalStars).toBe(12);
    expect(reloaded.settings.soundEnabled).toBe(false);
    expect(reloaded.skills.oclock.unlocked).toBe(true);
    expect(reloaded.skills.oclock.starsEarned).toBe(3);
  });

  it('recovers safely from corrupted JSON (EC-STR-01)', () => {
    const storage = createMemoryStorage();
    storage.setItem(STORAGE_KEY, '{not-valid-json');

    const state = loadAppState(storage);
    expect(state).toEqual(createDefaultAppState());
  });

  it('recovers safely from unsupported schemaVersion or invalid fields (EC-STR-01)', () => {
    const storage = createMemoryStorage();
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 99,
        totalStars: 'invalid',
      })
    );

    expect(loadAppState(storage)).toEqual(createDefaultAppState());

    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        schemaVersion: 1,
        totalStars: -5,
        settings: { minuteLabelMode: 'bogus', soundEnabled: 'yes' },
        skills: { 'clock-parts': { unlocked: false, starsEarned: -2 } },
      })
    );

    const sanitized = loadAppState(storage);
    expect(sanitized.totalStars).toBe(0);
    expect(sanitized.settings.minuteLabelMode).toBe('all');
    expect(sanitized.settings.soundEnabled).toBe(true);
    expect(sanitized.skills['clock-parts'].unlocked).toBe(true);
    expect(sanitized.skills['clock-parts'].starsEarned).toBe(0);
  });

  it('handles QuotaExceededError and SecurityError gracefully (EC-STR-02)', () => {
    const throwingStorage = {
      getItem: vi.fn(() => {
        throw new DOMException('Blocked', 'SecurityError');
      }),
      setItem: vi.fn(() => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      }),
      removeItem: vi.fn(() => {
        throw new DOMException('Blocked', 'SecurityError');
      }),
      clear: vi.fn(),
      key: vi.fn(),
      length: 0,
    } as unknown as Storage;

    expect(loadAppState(throwingStorage)).toEqual(createDefaultAppState());
    expect(saveAppState(createDefaultAppState(), throwingStorage)).toBe(false);
    expect(clearAppState(throwingStorage)).toBe(false);
  });
});

