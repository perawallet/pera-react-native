/*
 Copyright 2022-2026 Pera Wallet, LDA
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
import { logger, type Nullable } from '@perawallet/wallet-core-shared'
import { openKvRecord, sealKvRecord } from '../kv-record'

/**
 * Seals the values under `authenticatedKeys` with an HMAC so a record written
 * by anything but the unlocked wallet reads as absent. With no auth key (vault
 * locked) such a key reads as absent and a write to it is dropped, so a locked
 * context can't overwrite the user's record either.
 */
export class AuthenticatedKeyValueStorage implements KeyValueStorageService {
    private authKey: Nullable<Uint8Array> = null
    private readonly authenticatedKeys: ReadonlySet<string>

    constructor(
        private readonly inner: KeyValueStorageService,
        authenticatedKeys: readonly string[],
    ) {
        this.authenticatedKeys = new Set(authenticatedKeys)
    }

    setAuthKey(key: Nullable<Uint8Array>): void {
        this.authKey?.fill(0)
        this.authKey = key === null ? null : new Uint8Array(key)
    }

    hasAuthKey(): boolean {
        return this.authKey !== null
    }

    getItem(key: string): Nullable<string> {
        const raw = this.inner.getItem(key)
        if (raw === null || !this.authenticatedKeys.has(key)) return raw
        return this.authKey === null
            ? null
            : openKvRecord(this.authKey, key, raw)
    }

    setItem(key: string, value: string): void {
        if (!this.authenticatedKeys.has(key)) {
            this.inner.setItem(key, value)
            return
        }
        if (this.authKey === null) {
            logger.warn('[kv] dropped a write to an authenticated key', { key })
            return
        }
        this.inner.setItem(key, sealKvRecord(this.authKey, key, value))
    }

    removeItem(key: string): void {
        this.inner.removeItem(key)
    }

    setJSON<T>(key: string, value: T): void {
        this.setItem(key, JSON.stringify(value))
    }

    getJSON<T>(key: string): Nullable<T> {
        const raw = this.getItem(key)
        if (raw === null) return null
        try {
            return JSON.parse(raw) as T
        } catch {
            return null
        }
    }

    getAllKeys(): string[] {
        return this.inner.getAllKeys()
    }

    trim(): void {
        this.inner.trim?.()
    }
}
