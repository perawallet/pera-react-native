import { RNKeyValueStorageService } from '../key-value-storage';
vi.mock('react-native-mmkv', () => {
  class MMKV {
    private store = new Map<string, string>();
    getString(key: string) {
      return this.store.get(key) ?? null;
    }
    set(key: string, value: string) {
      this.store.set(key, String(value));
    }
    delete(key: string) {
      this.store.delete(key);
    }
  }
  return { MMKV };
});

describe('RNKeyValueStorageService', () => {
  it('get/set item and JSON helpers', () => {
    const kv = new RNKeyValueStorageService();
    expect(kv.getItem('k')).toBeNull();
    kv.setItem('k', 'v');
    expect(kv.getItem('k')).toBe('v');

    kv.setJSON('obj', { a: 1 });
    const obj = kv.getJSON<{ a: number }>('obj');
    expect(obj?.a).toBe(1);

    kv.removeItem('k');
    expect(kv.getItem('k')).toBeNull();
  });

  it('should handle invalid JSON gracefully', () => {
    const kv = new RNKeyValueStorageService();

    // Set invalid JSON manually by mocking the underlying storage
    kv.mmkv.set('invalid-json', '{invalid json}');

    // getJSON should return null for invalid JSON
    const result = kv.getJSON('invalid-json');
    expect(result).toBeNull();
  });

  it('should return null for non-existent JSON keys', () => {
    const kv = new RNKeyValueStorageService();

    const result = kv.getJSON('non-existent-key');
    expect(result).toBeNull();
  });
});
