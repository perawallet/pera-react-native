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

import type { KeyValueStorageService } from '../storage'

export class MemoryKeyValueStorage implements KeyValueStorageService {
    private store = new Map<string, string>()

    getItem(key: string): string | null {
        return this.store.get(key) ?? null
    }

    setItem(key: string, value: string): void {
        this.store.set(key, value)
    }

    removeItem(key: string): void {
        this.store.delete(key)
    }

    setJSON<T>(key: string, value: T): void {
        this.setItem(key, JSON.stringify(value))
    }

    getJSON<T>(key: string): T | null {
        const v = this.getItem(key)
        return v ? (JSON.parse(v) as T) : null
    }

    getAllKeys(): string[] {
        return Array.from(this.store.keys())
    }
}

export const createMemoryKV = () => new MemoryKeyValueStorage()
