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

import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
    secretStore,
    commitSecret,
    removeSecret,
    withSecret,
    refreshTokenRequest,
    setRefreshHandler,
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
        withSecret: vi.fn(
            async (id: string, handler: (bytes: Uint8Array) => unknown) => {
                const value = secretStore.get(id)
                if (value === undefined) return null
                return handler(new TextEncoder().encode(value))
            },
        ),
        refreshTokenRequest: vi.fn(),
        setRefreshHandler: vi.fn(),
    }
})

vi.mock('@perawallet/wallet-core-kms', () => ({
    commitSecret,
    removeSecret,
    withSecret,
}))
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetworkStore: { getState: () => ({ network: 'mainnet' }) },
}))
vi.mock('../../api/auth', () => ({ refreshTokenRequest }))
vi.mock('../../api/transport', () => ({ setRefreshHandler }))
vi.mock('@perawallet/wallet-core-shared', async importOriginal => {
    const original =
        await importOriginal<typeof import('@perawallet/wallet-core-shared')>()
    return { ...original, registerStore: vi.fn() }
})

import {
    setCardSession,
    clearCardSession,
    refreshSession,
    initCardSession,
} from '../session'
import { getAccessToken } from '../token-cache'
import { useCardSessionStore } from '../../store/session-store'

describe('card session', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        secretStore.clear()
        useCardSessionStore.getState().resetState()
    })

    it('stores both tokens in the keystore and flips the session flags', async () => {
        await setCardSession({
            accessToken: 'a',
            refreshToken: 'r',
            expiresAt: 123,
        })

        expect(commitSecret).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'baanx-access-token' }),
        )
        expect(commitSecret).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'baanx-refresh-token' }),
        )
        expect(getAccessToken()).toBe('a')
        expect(useCardSessionStore.getState().isAuthenticated).toBe(true)
        expect(useCardSessionStore.getState().expiresAt).toBe(123)
    })

    it('does not store a refresh secret when none is provided', async () => {
        await setCardSession({
            accessToken: 'a',
            refreshToken: '',
            expiresAt: 1,
        })

        expect(commitSecret).toHaveBeenCalledTimes(1)
        expect(commitSecret).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'baanx-access-token' }),
        )
    })

    it('never writes tokens to the persisted session store', async () => {
        await setCardSession({
            accessToken: 'super-secret-token',
            refreshToken: 'r',
            expiresAt: 1,
        })

        const state = useCardSessionStore.getState()
        expect(JSON.stringify(state)).not.toContain('super-secret-token')
        expect('accessToken' in state).toBe(false)
    })

    it('clears both secrets, the cache and the session flags on logout', async () => {
        await setCardSession({
            accessToken: 'a',
            refreshToken: 'r',
            expiresAt: 1,
        })

        await clearCardSession()

        expect(removeSecret).toHaveBeenCalledWith('baanx-access-token')
        expect(removeSecret).toHaveBeenCalledWith('baanx-refresh-token')
        expect(getAccessToken()).toBeNull()
        expect(useCardSessionStore.getState().isAuthenticated).toBe(false)
    })

    it('registers the refresh handler and hydrates the cache at bootstrap', async () => {
        secretStore.set('baanx-access-token', 'hydrated')
        useCardSessionStore
            .getState()
            .setSession({ isAuthenticated: true, expiresAt: 999 })

        await initCardSession()

        expect(setRefreshHandler).toHaveBeenCalledTimes(1)
        expect(typeof setRefreshHandler.mock.calls[0][0]).toBe('function')
        expect(getAccessToken()).toBe('hydrated')
    })

    it('exchanges the refresh token and returns true on success', async () => {
        secretStore.set('baanx-refresh-token', 'refresh-1')
        refreshTokenRequest.mockResolvedValue({
            accessToken: 'new',
            refreshToken: 'refresh-2',
            expiresAt: 5000,
        })

        const refreshed = await refreshSession()

        expect(refreshed).toBe(true)
        expect(refreshTokenRequest).toHaveBeenCalledWith(
            expect.objectContaining({
                refreshToken: 'refresh-1',
                network: 'mainnet',
            }),
        )
        expect(getAccessToken()).toBe('new')
        expect(useCardSessionStore.getState().isAuthenticated).toBe(true)
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
        expect(getAccessToken()).toBeNull()
        expect(useCardSessionStore.getState().isAuthenticated).toBe(false)
    })
})
