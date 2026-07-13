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

import type { KeyValueStorageService } from '@perawallet/wallet-extension-platform'

// Namespaces app KV entries apart from other extension storage (device id,
// dapp permissions, vault) sharing chrome.storage.local.
const KV_PREFIX = 'kv:'

/**
 * KeyValueStorageService backed by chrome.storage.local behind a synchronous
 * in-memory cache. `hydrate()` must complete before any sync read/write —
 * the web bootstrap awaits it before mounting the app. Writes go through to
 * chrome.storage.local; `chrome.storage.onChanged` keeps concurrently open
 * extension contexts (popup + approval window) coherent.
 */
export class ChromeKeyValueStorageService implements KeyValueStorageService {
    private cache: Map<string, string> | null = null

    async hydrate(): Promise<void> {
        if (this.cache !== null) return
        const all = await chrome.storage.local.get(null)
        this.cache = new Map(
            Object.entries(all)
                .filter(([key]) => key.startsWith(KV_PREFIX))
                .map(([key, value]) => [
                    key.slice(KV_PREFIX.length),
                    String(value),
                ]),
        )
        chrome.storage.onChanged.addListener((changes, areaName) => {
            if (areaName !== 'local' || !this.cache) return
            for (const [key, change] of Object.entries(changes)) {
                if (!key.startsWith(KV_PREFIX)) continue
                const cacheKey = key.slice(KV_PREFIX.length)
                if (change.newValue === undefined) {
                    this.cache.delete(cacheKey)
                } else {
                    this.cache.set(cacheKey, String(change.newValue))
                }
            }
        })
        // chrome fires onChanged for same-context writes too; the echo re-sets
        // the value already in the cache (idempotent) — do NOT filter "self"
        // events, the same listener is what keeps other contexts coherent.
    }

    private ensureCache(): Map<string, string> {
        if (!this.cache) {
            throw new Error(
                'ChromeKeyValueStorageService used before hydrate() resolved. ' +
                    'Await hydratePlatform() during bootstrap.',
            )
        }
        return this.cache
    }

    getItem(key: string): string | null {
        return this.ensureCache().get(key) ?? null
    }

    setItem(key: string, value: string): void {
        this.ensureCache().set(key, value)
        void chrome.storage.local.set({ [KV_PREFIX + key]: value })
    }

    removeItem(key: string): void {
        this.ensureCache().delete(key)
        void chrome.storage.local.remove(KV_PREFIX + key)
    }

    setJSON<T>(key: string, value: T): void {
        this.setItem(key, JSON.stringify(value))
    }

    getJSON<T>(key: string): T | null {
        const raw = this.getItem(key)
        if (raw === null) return null
        try {
            return JSON.parse(raw) as T
        } catch {
            return null
        }
    }

    getAllKeys(): string[] {
        return [...this.ensureCache().keys()]
    }
}
