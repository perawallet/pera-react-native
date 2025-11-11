/*
 Copyright 2022-2025 Pera Wallet, LDA
 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License
 */

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
