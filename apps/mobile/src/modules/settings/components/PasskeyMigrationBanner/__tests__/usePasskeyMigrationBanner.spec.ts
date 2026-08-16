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
let queryClient: QueryClient

const createWrapper = () => {
    queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )
}

const render = ({ isManaging = true }: { isManaging?: boolean } = {}) =>
    renderHook(
        () =>
            usePasskeyMigrationBanner({
                isManaging,
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
    //
    // The surviving row must be the keystore one. `useRemovePasskeyMutation`
    // gates keystore removal on `source === 'keystore'`, so letting the flat
    // copy win for a credential that still has a k/ record would skip
    // `provider.key.store.remove` and strand the k/+m/ pair.
    it('lists a credential once when both sources report it, keeping the keystore attribution', async () => {
        mocks.usePasskeysQuery.mockReturnValue({
            passkeys: [passkey({ keyId: 'both', source: 'keystore' })],
        })
        mocks.readFlaggedPasskeyCredentials.mockResolvedValue([
            passkey({ keyId: 'both', source: 'provider' }),
            passkey({ keyId: 'flat-only', source: 'provider' }),
        ])

        const { result } = render()

        await waitFor(() => expect(result.current.affected).toHaveLength(2))
        expect(result.current.affected.map(p => p.keyId)).toEqual([
            'both',
            'flat-only',
        ])
        expect(result.current.affected.map(p => p.source)).toEqual([
            'keystore',
            'provider',
        ])
    })

    // The banner's query key is a sibling of `passkeysQueryKey`, not a
    // descendant, so only an invalidation of the shared `['passkeys']` root
    // reaches it — which is what `useRemovePasskeyMutation` now issues. Without
    // it the banner keeps offering "Remove" for a credential already gone.
    it('re-reads the flat store when a delete invalidates the shared passkeys root', async () => {
        mocks.readFlaggedPasskeyCredentials.mockResolvedValue([
            passkey({ keyId: 'flat-1' }),
        ])

        const { result } = render()
        await waitFor(() => expect(result.current.isVisible).toBe(true))

        mocks.readFlaggedPasskeyCredentials.mockResolvedValue([])
        await act(async () => {
            await queryClient.invalidateQueries({ queryKey: ['passkeys'] })
        })

        await waitFor(() => expect(result.current.affected).toEqual([]))
        expect(mocks.readFlaggedPasskeyCredentials).toHaveBeenCalledTimes(2)
        expect(result.current.isVisible).toBe(false)
    })

    // Same predicate the screen's prerequisite callouts use. `disabled` is the
    // one that matters: re-registration is impossible while Pera is not the
    // active credential provider, so offering delete-and-recreate there is an
    // invitation to lock yourself out.
    it('stays hidden while the screen is not managing passkeys', async () => {
        mocks.readFlaggedPasskeyCredentials.mockResolvedValue([
            passkey({ keyId: 'flat-1' }),
        ])

        const { result } = render({ isManaging: false })

        await waitFor(() => expect(result.current.affected).toHaveLength(1))
        expect(result.current.isVisible).toBe(false)
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
