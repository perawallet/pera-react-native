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

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createChromeFake, type ChromeFake } from '../../test-utils/chrome'
import {
    INTEGRITY_TOKEN_SESSION_KEY,
    clearSessionIntegrityToken,
    getSessionIntegrityToken,
    putSessionIntegrityToken,
} from '../session-token'

const TOKEN = {
    integrityToken: 'jwt-value',
    expiresAt: '2026-08-04T12:00:00.000Z',
    mintedAt: '2026-08-04T11:45:00.000Z',
    deviceInstallationId: 'install-1',
}

describe('session integrity token', () => {
    let fake: ChromeFake

    beforeEach(() => {
        fake = createChromeFake()
        globalThis.chrome = fake.chrome
    })

    it('returns null when nothing is stored', async () => {
        expect(await getSessionIntegrityToken()).toBeNull()
    })

    it('round-trips the token through the session area', async () => {
        await putSessionIntegrityToken(TOKEN)

        expect(await getSessionIntegrityToken()).toEqual(TOKEN)
    })

    it('never touches the local area', async () => {
        await putSessionIntegrityToken(TOKEN)

        expect(fake.data.has(INTEGRITY_TOKEN_SESSION_KEY)).toBe(false)
        expect(fake.sessionData.has(INTEGRITY_TOKEN_SESSION_KEY)).toBe(true)
    })

    // `accessLevelSet` is a module-scope latch; a static import would carry
    // an earlier test's state into this one and make the call-count
    // assertion meaningless — mirrors keystore-chrome's session.test.ts.
    it('restricts the session area to trusted contexts, once', async () => {
        vi.resetModules()
        const session = await import('../session-token')

        await session.putSessionIntegrityToken(TOKEN)
        await session.putSessionIntegrityToken(TOKEN)

        expect(fake.accessLevels).toEqual(['TRUSTED_CONTEXTS'])
    })

    it('clears the token', async () => {
        await putSessionIntegrityToken(TOKEN)
        await clearSessionIntegrityToken()

        expect(await getSessionIntegrityToken()).toBeNull()
    })

    it('returns null for a malformed stored record', async () => {
        fake.sessionData.set(INTEGRITY_TOKEN_SESSION_KEY, { nonsense: true })

        expect(await getSessionIntegrityToken()).toBeNull()
    })

    it('returns null when a required field is missing', async () => {
        fake.sessionData.set(INTEGRITY_TOKEN_SESSION_KEY, {
            ...TOKEN,
            deviceInstallationId: undefined,
        })

        expect(await getSessionIntegrityToken()).toBeNull()
    })
})
