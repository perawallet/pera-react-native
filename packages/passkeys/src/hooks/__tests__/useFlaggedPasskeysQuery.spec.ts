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

// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import type { Passkey } from '../../models/passkey'

const KEYSTORE_SUBTLE = vi.hoisted(() => ({ sentinel: 'keystore-subtle' }))

const mocks = vi.hoisted(() => ({
    readFlaggedPasskeyCredentials: vi.fn(),
}))

vi.mock('../../native/readFlaggedPasskeyCredentials', () => ({
    readFlaggedPasskeyCredentials: mocks.readFlaggedPasskeyCredentials,
}))

vi.mock('@perawallet/wallet-extension-provider', () => ({
    keystoreSubtle: KEYSTORE_SUBTLE,
    getKeystoreStore: vi.fn(),
    getProvider: vi.fn(),
}))

import { passkeysQueryKeyRoot } from '../usePasskeysQuery'
import { useFlaggedPasskeysQuery } from '../useFlaggedPasskeysQuery'

const flagged = (id: string) => ({ id, keyId: id }) as unknown as Passkey

const setup = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    const wrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(
            QueryClientProvider,
            { client: queryClient },
            children,
        )
    return { queryClient, wrapper }
}

describe('useFlaggedPasskeysQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('reads the flat records through the keystore subtle', async () => {
        mocks.readFlaggedPasskeyCredentials.mockResolvedValue({
            flagged: [],
            isComplete: true,
        })
        const { wrapper } = setup()

        renderHook(() => useFlaggedPasskeysQuery(), { wrapper })

        await waitFor(() =>
            expect(mocks.readFlaggedPasskeyCredentials).toHaveBeenCalledWith({
                subtle: KEYSTORE_SUBTLE,
            }),
        )
    })

    it('returns the flagged credentials of a complete scan', async () => {
        mocks.readFlaggedPasskeyCredentials.mockResolvedValue({
            flagged: [flagged('a')],
            isComplete: true,
        })
        const { wrapper } = setup()

        const { result } = renderHook(() => useFlaggedPasskeysQuery(), {
            wrapper,
        })

        await waitFor(() => expect(result.current.isComplete).toBe(true))
        expect(result.current.flaggedPasskeys).toEqual([flagged('a')])
    })

    it('is not complete while the read is in flight', () => {
        mocks.readFlaggedPasskeyCredentials.mockReturnValue(
            new Promise(() => undefined),
        )
        const { wrapper } = setup()

        const { result } = renderHook(() => useFlaggedPasskeysQuery(), {
            wrapper,
        })

        expect(result.current.isComplete).toBe(false)
        expect(result.current.flaggedPasskeys).toEqual([])
    })

    it('is not complete after the read rejects', async () => {
        mocks.readFlaggedPasskeyCredentials.mockRejectedValue(
            new Error('keychain locked'),
        )
        const { queryClient, wrapper } = setup()

        const { result } = renderHook(() => useFlaggedPasskeysQuery(), {
            wrapper,
        })

        await waitFor(() =>
            expect(
                queryClient.getQueryState(['passkeys', 'needs-migration'])
                    ?.status,
            ).toBe('error'),
        )
        expect(result.current.isComplete).toBe(false)
    })

    it('keeps the flagged list of a scan that did not examine every record', async () => {
        mocks.readFlaggedPasskeyCredentials.mockResolvedValue({
            flagged: [flagged('a')],
            isComplete: false,
        })
        const { wrapper } = setup()

        const { result } = renderHook(() => useFlaggedPasskeysQuery(), {
            wrapper,
        })

        await waitFor(() =>
            expect(result.current.flaggedPasskeys).toEqual([flagged('a')]),
        )
        expect(result.current.isComplete).toBe(false)
    })

    it('re-reads when the passkeys root is invalidated', async () => {
        mocks.readFlaggedPasskeyCredentials
            .mockResolvedValueOnce({
                flagged: [flagged('a')],
                isComplete: true,
            })
            .mockResolvedValueOnce({ flagged: [], isComplete: true })
        const { queryClient, wrapper } = setup()

        const { result } = renderHook(() => useFlaggedPasskeysQuery(), {
            wrapper,
        })
        await waitFor(() =>
            expect(result.current.flaggedPasskeys).toHaveLength(1),
        )

        await queryClient.invalidateQueries({
            queryKey: [...passkeysQueryKeyRoot],
        })

        await waitFor(() => expect(result.current.flaggedPasskeys).toEqual([]))
        expect(mocks.readFlaggedPasskeyCredentials).toHaveBeenCalledTimes(2)
    })

    it('keeps the same empty list reference across rerenders while unresolved', () => {
        mocks.readFlaggedPasskeyCredentials.mockReturnValue(
            new Promise(() => undefined),
        )
        const { wrapper } = setup()

        const { result, rerender } = renderHook(
            () => useFlaggedPasskeysQuery(),
            {
                wrapper,
            },
        )
        const first = result.current.flaggedPasskeys
        rerender()

        expect(result.current.flaggedPasskeys).toBe(first)
    })
})
