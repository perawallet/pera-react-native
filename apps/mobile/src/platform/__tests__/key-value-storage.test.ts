import { RNKeyValueStorageService } from '../key-value-storage';

describe('RNKeyValueStorageService', () => {
  test('get/set item and JSON helpers', () => {
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
});