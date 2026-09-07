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

// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest'

// Module-level registration state: a fresh module per test keeps the
// "nothing registered" case honest.
const load = async (): Promise<typeof import('../engineKeySource')> => {
    vi.resetModules()
    return import('../engineKeySource')
}

const SESSION_KEY = Uint8Array.from({ length: 32 }, (_, i) => i + 1)

describe('engineKeySource', () => {
    beforeEach(() => {
        vi.resetModules()
    })

    // Not VaultLockedError: a missing registration is a wiring bug in the
    // surface that booted, not something a password fixes.
    it('rejects with a wiring error while no source is registered', async () => {
        const { resolveEngineKey } = await load()

        await expect(resolveEngineKey()).rejects.toThrow(
            /setEngineKeySource/,
        )
    })

    it('imports the source bytes as a non-extractable AES-GCM key and wipes them', async () => {
        const { resolveEngineKey, setEngineKeySource } = await load()
        const bytes = Uint8Array.from(SESSION_KEY)
        setEngineKeySource(async () => bytes)

        const key = await resolveEngineKey()

        expect(key.algorithm).toEqual({ name: 'AES-GCM', length: 256 })
        expect(key.extractable).toBe(false)
        expect(key.usages).toEqual(['encrypt', 'decrypt'])
        expect(Array.from(bytes)).toEqual(new Array(32).fill(0))
    })

    // AES-GCM `importKey` accepts 16 and 24 bytes too; a truncated session
    // read must not quietly become AES-128.
    it('rejects a source that returns anything but 32 bytes', async () => {
        const { resolveEngineKey, setEngineKeySource } = await load()
        setEngineKeySource(async () => new Uint8Array(16))

        await expect(resolveEngineKey()).rejects.toThrow(/32 bytes/)
    })

    it('asks the source on every resolve and propagates its rejection', async () => {
        const { resolveEngineKey, setEngineKeySource } = await load()
        const locked = new Error('locked')
        const source = vi.fn(async () => Uint8Array.from(SESSION_KEY))
        setEngineKeySource(source)

        await resolveEngineKey()
        await resolveEngineKey()
        expect(source).toHaveBeenCalledTimes(2)

        source.mockRejectedValue(locked)
        await expect(resolveEngineKey()).rejects.toBe(locked)
    })

    it('imports a key that opens what it sealed', async () => {
        const { resolveEngineKey, setEngineKeySource } = await load()
        setEngineKeySource(async () => Uint8Array.from(SESSION_KEY))
        const iv = new Uint8Array(12)
        const data = Uint8Array.of(7, 7, 7)

        const sealed = await globalThis.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            await resolveEngineKey(),
            data,
        )
        const opened = await globalThis.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            await resolveEngineKey(),
            sealed,
        )

        expect(Array.from(new Uint8Array(opened))).toEqual([7, 7, 7])
    })
})
