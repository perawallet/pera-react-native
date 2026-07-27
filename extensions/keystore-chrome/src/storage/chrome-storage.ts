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

import { KEYSTORE_PREFIX } from '../storage-keys'

export type SecureEntryStorage = {
    getString(key: string): string | undefined
    set(key: string, value: string): Promise<void>
    remove(key: string): void
    getAllKeys(): string[]
    clearAll(): void
    contains(key: string): boolean
}

/**
 * MMKV-shaped synchronous store over chrome.storage.local, following the
 * ChromeKeyValueStorageService pattern: hydrate() must resolve before any
 * sync access (the web bootstrap awaits hydrateKeystoreStorage()); writes go
 * through to chrome.storage.local; chrome.storage.onChanged keeps
 * concurrently open extension contexts coherent.
 */
export class ChromeSecureEntryStorage implements SecureEntryStorage {
    private cache: Map<string, string> | null = null

    async hydrate(): Promise<void> {
        if (this.cache !== null) return
        const all = await chrome.storage.local.get(null)
        this.cache = new Map(
            Object.entries(all)
                .filter(([key]) => key.startsWith(KEYSTORE_PREFIX))
                .map(([key, value]) => [
                    key.slice(KEYSTORE_PREFIX.length),
                    String(value),
                ]),
        )
        // chrome fires onChanged for same-context writes too; the echo re-sets
        // the value already in the cache (idempotent) — do NOT filter "self"
        // events, the same listener is what keeps other contexts coherent.
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== 'local' || !this.cache) return
            for (const [key, change] of Object.entries(changes)) {
                if (!key.startsWith(KEYSTORE_PREFIX)) continue
                const cacheKey = key.slice(KEYSTORE_PREFIX.length)
                if (change.newValue === undefined) {
                    this.cache.delete(cacheKey)
                } else {
                    this.cache.set(cacheKey, String(change.newValue))
                }
            }
        })
    }

    private ensureCache(): Map<string, string> {
        if (!this.cache) {
            throw new Error(
                'ChromeSecureEntryStorage used before hydrate() resolved. ' +
                    'Await hydrateKeystoreStorage() during bootstrap.',
            )
        }
        return this.cache
    }

    getString(key: string): string | undefined {
        return this.ensureCache().get(key)
    }

    set(key: string, value: string): Promise<void> {
        this.ensureCache().set(key, value)
        return chrome.storage.local.set({ [KEYSTORE_PREFIX + key]: value })
    }

    remove(key: string): void {
        this.ensureCache().delete(key)
        void chrome.storage.local.remove(KEYSTORE_PREFIX + key)
    }

    getAllKeys(): string[] {
        return [...this.ensureCache().keys()]
    }

    clearAll(): void {
        const keys = this.getAllKeys()
        this.ensureCache().clear()
        void chrome.storage.local.remove(keys.map(key => KEYSTORE_PREFIX + key))
    }

    contains(key: string): boolean {
        return this.ensureCache().has(key)
    }

    /** @internal test-only: resets the in-memory cache so hydrate() re-reads chrome.storage.local */
    resetForTesting(): void {
        this.cache = null
    }
}

export const storage: ChromeSecureEntryStorage = new ChromeSecureEntryStorage()

export const hydrateKeystoreStorage = (): Promise<void> => storage.hydrate()
