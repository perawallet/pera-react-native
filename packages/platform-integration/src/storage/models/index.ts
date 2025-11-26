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

export interface KeyValueStorageService {
    getItem(key: string): string | null
    setItem(key: string, value: string): void
    removeItem(key: string): void
    setJSON<T>(key: string, value: T): void
    getJSON<T>(key: string): T | null
}

export interface SecureStorageService {
    setItem(key: string, value: Buffer): Promise<void>
    getItem(key: string): Promise<Buffer | null>
    removeItem(key: string): Promise<void>
    authenticate(): Promise<boolean>
}

export class MemoryKeyValueStorage implements KeyValueStorageService {
    private storage: Record<string, string> = {}

    getItem(key: string): string | null {
        return this.storage[key] ?? null
    }

    setItem(key: string, value: string): void {
        this.storage[key] = value
    }

    removeItem(key: string): void {
        delete this.storage[key]
    }

    setJSON<T>(key: string, value: T): void {
        this.storage[key] = JSON.stringify(value)
    }

    getJSON<T>(key: string): T | null {
        const value = this.storage[key]
        return value ? JSON.parse(value) : null
    }
}
