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

/**
 * Minimal key-value storage interface matching KeyValueStorageService from
 * @perawallet/wallet-extension-platform. Defined inline to avoid a circular
 * workspace dependency between platform and platform-resources.
 */
interface KeyValueStorage {
    getItem(key: string): string | null
    setItem(key: string, value: string): void
    removeItem(key: string): void
    setJSON<T>(key: string, value: T): void
    getJSON<T>(key: string): T | null
    getAllKeys(): string[]
}

/**
 * No-op implementation of KeyValueStorage.
 *
 * This is the default "dumb" platform — stores import from this package at the
 * TypeScript level, but at build time the mobile app's Metro config aliases
 * this package to the React Native implementation which provides a real
 * MMKV-backed singleton.
 */
class NoopKeyValueStorageService implements KeyValueStorage {
    getItem(_key: string): string | null {
        return null
    }
    setItem(_key: string, _value: string): void {}
    removeItem(_key: string): void {}
    setJSON<T>(_key: string, _value: T): void {}
    getJSON<T>(_key: string): T | null {
        return null
    }
    getAllKeys(): string[] {
        return []
    }
}

export const keyValueStorage: KeyValueStorage = new NoopKeyValueStorageService()
