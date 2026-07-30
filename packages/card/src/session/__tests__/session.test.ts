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

import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
    secretStore,
    commitSecret,
    removeSecret,
    hasSecret,
    withSecret,
    refreshTokenRequest,
    setRefreshHandler,
    zeroBytes,
} = vi.hoisted(() => {
    const secretStore = new Map<string, string>()
    return {
        secretStore,
        commitSecret: vi.fn(
            async ({ id, bytes }: { id: string; bytes: Uint8Array }) => {
                secretStore.set(id, new TextDecoder().decode(bytes))
            },
        ),
        removeSecret: vi.fn(async (id: string) => {
            secretStore.delete(id)
        }),
        hasSecret: vi.fn((id: string) => secretStore.has(id)),
        // Mirrors the real withSecret: runs the handler with the secret bytes,
        // returns null (without invoking the handler) when the secret is absent.
        withSecret: vi.fn(
            async (id: string, handler: (bytes: Uint8Array) => unknown) => {
                const value = secretStore.get(id)
                if (value === undefined) return null
                return handler(new TextEncoder().encode(value))
            },
        ),
        refreshTokenRequest: vi.fn(),
        setRefreshHandler: vi.fn(),
        zeroBytes: vi.fn(),
    }
})

vi.mock('@perawallet/wallet-core-kms', () => ({
    commitSecret,
    removeSecret,
    hasSecret,
    withSecret,
    zeroBytes,
}))
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetworkStore: { getState: () => ({ network: 'mainnet' }) },
}))
vi.mock('../../api/auth', () => ({ refreshTokenRequest }))
vi.mock('../../api/transport', () => ({ setRefreshHandler }))

import {
    setCardSession,
    clearCardSession,
    refreshSession,
    hasCardSession,
} from '../session'
import { useCardSessionStore } from '../../store/session-store'

describe('card session', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        secretStore.clear()
        useCardSessionStore.getState().resetState()
    })

    it('stores both tokens in the keystore and flips the auth flag', async () => {
        await setCardSession({ accessToken: 'a', refreshToken: 'r' })

        expect(commitSecret).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'baanx-access-token' }),
        )
        expect(commitSecret).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'baanx-refresh-token' }),
        )
        expect(useCardSessionStore.getState().isAuthenticated).toBe(true)
    })

    it('does not store a refresh secret when none is provided', async () => {
        await setCardSession({ accessToken: 'a', refreshToken: '' })

        expect(commitSecret).toHaveBeenCalledTimes(1)
        expect(commitSecret).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'baanx-access-token' }),
        )
    })

    it('removes a stale refresh secret when the new session has none', async () => {
        // A fallback (refresh-less) session must not leave an earlier
        // session's refresh token behind — refreshSession would otherwise
        // exchange a stale credential against the new access token.
        await setCardSession({ accessToken: 'a1', refreshToken: 'r1' })

        await setCardSession({ accessToken: 'a2', refreshToken: '' })

        expect(removeSecret).toHaveBeenCalledWith('baanx-refresh-token')
        expect(hasSecret('baanx-refresh-token')).toBe(false)
    })

    it('never writes tokens to the persisted session store', async () => {
        await setCardSession({ accessToken: 'super-secret', refreshToken: 'r' })

        const state = useCardSessionStore.getState()
        expect(JSON.stringify(state)).not.toContain('super-secret')
        expect('accessToken' in state).toBe(false)
    })

    it('clears both secrets and resets the auth flag on logout', async () => {
        await setCardSession({ accessToken: 'a', refreshToken: 'r' })

        await clearCardSession()

        expect(removeSecret).toHaveBeenCalledWith('baanx-access-token')
        expect(removeSecret).toHaveBeenCalledWith('baanx-refresh-token')
        expect(useCardSessionStore.getState().isAuthenticated).toBe(false)
    })

    it('reports a live session only while the access token is in the keystore', async () => {
        expect(hasCardSession()).toBe(false)

        await setCardSession({ accessToken: 'a', refreshToken: 'r' })
        expect(hasCardSession()).toBe(true)

        await clearCardSession()
        expect(hasCardSession()).toBe(false)
    })

    it('exchanges the refresh token (read via withSecret) and returns true', async () => {
        secretStore.set('baanx-refresh-token', 'refresh-1')
        refreshTokenRequest.mockResolvedValue({
            accessToken: 'new',
            refreshToken: 'refresh-2',
        })

        const refreshed = await refreshSession()

        expect(refreshed).toBe(true)
        expect(refreshTokenRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                refreshToken: 'refresh-1',
                network: 'mainnet',
            }),
        )
        expect(useCardSessionStore.getState().isAuthenticated).toBe(true)
        expect(secretStore.get('baanx-access-token')).toBe('new')
    })

    it('clears the session and returns false when there is no refresh token', async () => {
        const refreshed = await refreshSession()

        expect(refreshed).toBe(false)
        expect(refreshTokenRequest).not.toHaveBeenCalled()
        expect(useCardSessionStore.getState().isAuthenticated).toBe(false)
    })

    it('clears the session and returns false when the exchange fails', async () => {
        secretStore.set('baanx-refresh-token', 'refresh-1')
        refreshTokenRequest.mockRejectedValue(new Error('boom'))

        const refreshed = await refreshSession()

        expect(refreshed).toBe(false)
        expect(useCardSessionStore.getState().isAuthenticated).toBe(false)
    })
})
