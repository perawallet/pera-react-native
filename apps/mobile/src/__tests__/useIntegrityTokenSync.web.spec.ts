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

import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    INTEGRITY_TOKEN_SESSION_KEY,
    clearSessionIntegrityToken,
    putSessionIntegrityToken,
} from '@perawallet/wallet-extension-platform-chrome'
import { config } from '@perawallet/wallet-core-config'
import { setIntegrityTokenProvider } from '@perawallet/wallet-core-shared'
import {
    getValidIntegrityToken,
    useAppIntegrityStore,
} from '@perawallet/wallet-core-app-integrity'
import { createSessionChromeFake } from '../test-utils/chrome-session'
import { useIntegrityTokenSync } from '../useIntegrityTokenSync.web'

vi.mock('@perawallet/wallet-core-config', () => ({
    config: { webIntegrityBearerEnabled: false },
}))

const TOKEN = {
    integrityToken: 'jwt-value',
    expiresAt: '2026-08-04T12:00:00.000Z',
    mintedAt: '2026-08-04T11:45:00.000Z',
    deviceInstallationId: 'install-1',
}

// Deterministic microtask drain (not a timer — no macrotask, no real delay):
// every chrome-fake storage call in this file is a plain async function with
// no internal await, so its whole promise chain settles within a handful of
// microtask ticks. Draining more ticks than that chain is deep makes "did
// this NOT happen" assertions reliable without racing a setTimeout.
const flushMicrotasks = async (): Promise<void> => {
    for (let i = 0; i < 10; i++) {
        await Promise.resolve()
    }
}

describe('useIntegrityTokenSync', () => {
    let chromeFake: ReturnType<typeof createSessionChromeFake>

    beforeEach(() => {
        chromeFake = createSessionChromeFake()
        globalThis.chrome = chromeFake.chrome
        useAppIntegrityStore.getState().resetState()
    })

    // The global setup's afterEach only clears mock call history, not spy
    // implementations — and zustand's Object.assign-based state merge carries
    // a spied action forward across resetState() (which only overwrites data
    // fields). Without restoring here, a spy installed in one test silently
    // becomes the "real" setRegistration for every later test in this file.
    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('hydrates the store from session storage on mount', async () => {
        config.webIntegrityBearerEnabled = true
        await putSessionIntegrityToken(TOKEN)

        const { unmount } = renderHook(() => useIntegrityTokenSync())

        await waitFor(() =>
            expect(useAppIntegrityStore.getState().integrityToken).toBe(
                'jwt-value',
            ),
        )
        unmount()
    })

    it('updates the store when the session token changes', async () => {
        config.webIntegrityBearerEnabled = true
        const { unmount } = renderHook(() => useIntegrityTokenSync())

        await putSessionIntegrityToken({
            ...TOKEN,
            integrityToken: 'rotated-value',
        })

        await waitFor(() =>
            expect(useAppIntegrityStore.getState().integrityToken).toBe(
                'rotated-value',
            ),
        )
        unmount()
    })

    it('clears the store when the session token is removed (revocation)', async () => {
        config.webIntegrityBearerEnabled = true
        await putSessionIntegrityToken(TOKEN)
        const { unmount } = renderHook(() => useIntegrityTokenSync())
        await waitFor(() =>
            expect(useAppIntegrityStore.getState().integrityToken).toBe(
                'jwt-value',
            ),
        )

        // The SW removes the session token on a 403; this realm must drop its
        // now-revoked copy, not keep serving it until expiresAt. Asserting the
        // raw store field (not getValidIntegrityToken, which also reads null
        // once expiresAt passes) is what keeps this falsifiable.
        await clearSessionIntegrityToken()

        await waitFor(() =>
            expect(useAppIntegrityStore.getState().integrityToken).toBeNull(),
        )
        unmount()
    })

    it('registers the integrity token provider when the flag is on', async () => {
        config.webIntegrityBearerEnabled = true
        const { unmount } = renderHook(() => useIntegrityTokenSync())

        expect(setIntegrityTokenProvider).toHaveBeenCalledWith(
            getValidIntegrityToken,
        )
        unmount()
    })

    // Spy + microtask-drain instead of racing a zero-delay timer against
    // "nothing happened" — deterministic, and still catches a missing/
    // inverted flag guard (adopt() would reach setRegistration well within
    // the drained tick budget).
    it('writes nothing and registers no provider when the flag is off', async () => {
        config.webIntegrityBearerEnabled = false
        await putSessionIntegrityToken(TOKEN)
        const setRegistration = vi.spyOn(
            useAppIntegrityStore.getState(),
            'setRegistration',
        )

        const { unmount } = renderHook(() => useIntegrityTokenSync())
        await flushMicrotasks()

        expect(setRegistration).not.toHaveBeenCalled()
        expect(setIntegrityTokenProvider).not.toHaveBeenCalled()
        unmount()
    })

    it('stops updating the store after unmount', async () => {
        config.webIntegrityBearerEnabled = true
        await putSessionIntegrityToken(TOKEN)
        const { unmount } = renderHook(() => useIntegrityTokenSync())
        await waitFor(() =>
            expect(useAppIntegrityStore.getState().integrityToken).toBe(
                'jwt-value',
            ),
        )
        unmount()
        const setRegistration = vi.spyOn(
            useAppIntegrityStore.getState(),
            'setRegistration',
        )

        await putSessionIntegrityToken({
            ...TOKEN,
            integrityToken: 'after-unmount',
        })
        await flushMicrotasks()

        expect(setRegistration).not.toHaveBeenCalled()
        unmount()
    })

    it('ignores local-area changes', async () => {
        config.webIntegrityBearerEnabled = true
        await putSessionIntegrityToken(TOKEN)
        const { unmount } = renderHook(() => useIntegrityTokenSync())
        // Let mount's own adopt() land first, so the spy below only ever
        // sees calls caused by the local-area write that follows.
        await waitFor(() =>
            expect(useAppIntegrityStore.getState().integrityToken).toBe(
                'jwt-value',
            ),
        )
        const setRegistration = vi.spyOn(
            useAppIntegrityStore.getState(),
            'setRegistration',
        )

        await chromeFake.chrome.storage.local.set({
            [INTEGRITY_TOKEN_SESSION_KEY]: 'not-the-session-area',
        })
        await flushMicrotasks()

        expect(setRegistration).not.toHaveBeenCalled()
        unmount()
    })
})
