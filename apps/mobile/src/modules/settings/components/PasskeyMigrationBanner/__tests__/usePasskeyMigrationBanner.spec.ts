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

import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Passkey } from '@perawallet/wallet-core-passkeys'

const mocks = vi.hoisted(() => ({
    usePasskeysQuery: vi.fn(),
    readFlaggedPasskeyCredentials: vi.fn(),
}))

vi.mock('@perawallet/wallet-core-passkeys', () => ({
    usePasskeysQuery: mocks.usePasskeysQuery,
    readFlaggedPasskeyCredentials: mocks.readFlaggedPasskeyCredentials,
}))

vi.mock('react-native-quick-crypto', () => ({ subtle: {} }))

import { usePasskeyMigrationBanner } from '../usePasskeyMigrationBanner'

const passkey = (overrides: Partial<Passkey>): Passkey => ({
    id: 'id',
    keyId: 'id',
    displayName: 'alice',
    origin: 'webauthn.io',
    userHandle: 'alice',
    algorithm: 'P256',
    createdAt: 100,
    source: 'provider',
    needsMigration: true,
    ...overrides,
})

let onRequestDelete: ReturnType<typeof vi.fn>

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )
}

const render = () =>
    renderHook(
        () =>
            usePasskeyMigrationBanner({
                onRequestDelete: onRequestDelete as (p: Passkey) => void,
            }),
        { wrapper: createWrapper() },
    )

describe('usePasskeyMigrationBanner', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        onRequestDelete = vi.fn()
        mocks.usePasskeysQuery.mockReturnValue({ passkeys: [] })
        mocks.readFlaggedPasskeyCredentials.mockResolvedValue([])
    })

    it('stays hidden when nothing is flagged', async () => {
        mocks.usePasskeysQuery.mockReturnValue({
            passkeys: [passkey({ keyId: 'ok', needsMigration: false })],
        })

        const { result } = render()

        await waitFor(() =>
            expect(mocks.readFlaggedPasskeyCredentials).toHaveBeenCalled(),
        )
        expect(result.current.affected).toEqual([])
        expect(result.current.isVisible).toBe(false)
    })

    it('surfaces a credential the flat provider store flags, which the passkey list never sees', async () => {
        mocks.readFlaggedPasskeyCredentials.mockResolvedValue([
            passkey({ keyId: 'flat-1' }),
        ])

        const { result } = render()

        await waitFor(() => expect(result.current.isVisible).toBe(true))
        expect(result.current.affected.map(p => p.keyId)).toEqual(['flat-1'])
    })

    it('also surfaces a flagged row that kept its k/ record and so is still in the list', async () => {
        mocks.usePasskeysQuery.mockReturnValue({
            passkeys: [
                passkey({ keyId: 'declined', source: 'keystore' }),
                passkey({ keyId: 'fine', needsMigration: false }),
            ],
        })

        const { result } = render()

        await waitFor(() => expect(result.current.isVisible).toBe(true))
        expect(result.current.affected.map(p => p.keyId)).toEqual(['declined'])
    })

    // The second flagged credential is what makes this test non-vacuous:
    // waiting on `isVisible` alone would settle on the keystore row before the
    // flat read resolves, and never observe the union at all.
    it('lists a credential once when both sources report it', async () => {
        mocks.usePasskeysQuery.mockReturnValue({
            passkeys: [passkey({ keyId: 'both', source: 'keystore' })],
        })
        mocks.readFlaggedPasskeyCredentials.mockResolvedValue([
            passkey({ keyId: 'both' }),
            passkey({ keyId: 'flat-only' }),
        ])

        const { result } = render()

        await waitFor(() => expect(result.current.affected).toHaveLength(2))
        expect(result.current.affected.map(p => p.keyId)).toEqual([
            'both',
            'flat-only',
        ])
    })

    it('hides on dismiss without deleting anything', async () => {
        mocks.readFlaggedPasskeyCredentials.mockResolvedValue([
            passkey({ keyId: 'flat-1' }),
        ])

        const { result } = render()
        await waitFor(() => expect(result.current.isVisible).toBe(true))

        act(() => result.current.onDismiss())

        expect(result.current.isVisible).toBe(false)
        expect(result.current.affected).toHaveLength(1)
        expect(onRequestDelete).not.toHaveBeenCalled()
    })

    // Deleting a passkey the relying party still trusts locks the user out of
    // that account, so the banner only ever hands the credential to the
    // screen's existing confirmation flow.
    it('routes recreate through the confirming delete flow rather than deleting directly', async () => {
        const flagged = passkey({ keyId: 'flat-1' })
        mocks.readFlaggedPasskeyCredentials.mockResolvedValue([flagged])

        const { result } = render()
        await waitFor(() => expect(result.current.isVisible).toBe(true))

        act(() => result.current.onRecreate(result.current.affected[0]))

        expect(onRequestDelete).toHaveBeenCalledWith(
            expect.objectContaining({ keyId: 'flat-1' }),
        )
    })

    it('stays hidden when the flat read fails', async () => {
        mocks.readFlaggedPasskeyCredentials.mockRejectedValue(
            new Error('keychain unavailable'),
        )

        const { result } = render()

        await waitFor(() =>
            expect(mocks.readFlaggedPasskeyCredentials).toHaveBeenCalled(),
        )
        expect(result.current.isVisible).toBe(false)
    })
})
