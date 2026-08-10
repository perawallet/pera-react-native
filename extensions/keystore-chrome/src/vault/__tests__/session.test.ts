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

// The module that holds the decrypted master key for the life of an unlocked
// session. Previously untested despite being the single place that key is
// readable from.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createChromeFake, type ChromeFake } from '../../test-utils/chrome'
import {
    SESSION_MASTER_KEY,
    clearSessionMasterKey,
    getSessionMasterKey,
    hasSessionMasterKey,
    putSessionMasterKey,
} from '../session'

const KEY = Uint8Array.from({ length: 32 }, (_, i) => i)

describe('session master key', () => {
    let fake: ChromeFake

    beforeEach(() => {
        vi.resetModules()
        fake = createChromeFake()
        globalThis.chrome = fake.chrome
    })

    it('round-trips a 32-byte key through hex', async () => {
        await putSessionMasterKey(KEY)

        expect(await getSessionMasterKey()).toEqual(KEY)
    })

    // The hex encoding must be lossless for every byte value, including the
    // ones that need zero-padding — a naive toString(16) drops the leading
    // nibble for anything under 0x10 and silently shifts the whole key.
    it('preserves low bytes that need zero-padding', async () => {
        const lowBytes = Uint8Array.from({ length: 32 }, () => 0x05)
        await putSessionMasterKey(lowBytes)

        const stored = fake.sessionData.get(SESSION_MASTER_KEY)
        expect(stored).toBe('05'.repeat(32))
        expect(await getSessionMasterKey()).toEqual(lowBytes)
    })

    it('reports presence and absence', async () => {
        expect(await hasSessionMasterKey()).toBe(false)

        await putSessionMasterKey(KEY)
        expect(await hasSessionMasterKey()).toBe(true)

        await clearSessionMasterKey()
        expect(await hasSessionMasterKey()).toBe(false)
        expect(await getSessionMasterKey()).toBeNull()
    })

    // A truncated or corrupted entry must read as "locked" rather than
    // yielding a short key that would silently decrypt nothing correctly.
    it.each([
        ['too short', 'ab'],
        ['not hex-length', '0'.repeat(63)],
        ['not a string', 12345],
    ])('treats a %s entry as absent', async (_label, value) => {
        fake.sessionData.set(SESSION_MASTER_KEY, value)

        expect(await getSessionMasterKey()).toBeNull()
    })

    // chrome.storage.session defaults to TRUSTED_CONTEXTS, but saying so
    // explicitly is what keeps a content script from ever reading the key.
    //
    // These re-import the module per test: `accessLevelSet` is a module-scope
    // latch, so a static import would carry the first test's state into the
    // rest and make the call-count assertions meaningless.
    describe('session storage access level', () => {
        const freshSession = async (): Promise<typeof import('../session')> => {
            vi.resetModules()
            return import('../session')
        }

        it('restricts session storage to trusted contexts before writing', async () => {
            const session = await freshSession()

            await session.putSessionMasterKey(KEY)

            expect(
                fake.chrome.storage.session.setAccessLevel,
            ).toHaveBeenCalledWith({ accessLevel: 'TRUSTED_CONTEXTS' })
        })

        it('only sets the access level once across writes', async () => {
            const session = await freshSession()

            await session.putSessionMasterKey(KEY)
            await session.putSessionMasterKey(KEY)
            await session.putSessionMasterKey(KEY)

            expect(
                fake.chrome.storage.session.setAccessLevel,
            ).toHaveBeenCalledTimes(1)
        })

        // Older Chromium has no setAccessLevel; TRUSTED_CONTEXTS is already
        // the default there, so a throw must not block the unlock.
        it('still stores the key when setAccessLevel is unavailable', async () => {
            fake.chrome.storage.session.setAccessLevel = vi
                .fn()
                .mockRejectedValue(new Error('not supported'))
            const session = await freshSession()

            await session.putSessionMasterKey(KEY)

            expect(await session.getSessionMasterKey()).toEqual(KEY)
        })
    })
})
