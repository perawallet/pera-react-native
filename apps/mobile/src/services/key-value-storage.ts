import { KeyValueStorageService } from '@perawallet/core';
import { MMKV } from 'react-native-mmkv';

export class RNKeyValueStorageService implements KeyValueStorageService {
  mmkv = new MMKV();

  getItem(key: string): string | null {
    return this.mmkv.getString(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.mmkv.set(key, value);
  }

  removeItem(key: string) {
    this.mmkv.delete(key);
  }

  setJSON<T>(key: string, value: T) {
    this.mmkv.set(key, JSON.stringify(value));
  }

  getJSON<T>(key: string): T | null {
    const v = this.mmkv.getString(key);
    if (!v) return null;
    try {
      return JSON.parse(v) as T;
    } catch {
      return null;
    }
  }
}
