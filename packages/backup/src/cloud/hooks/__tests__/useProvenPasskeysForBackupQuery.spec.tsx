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
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'

const { useListPasskeyMetadataMock, listPasskeysMock, provenMock } = vi.hoisted(
    () => ({
        useListPasskeyMetadataMock: vi.fn(),
        listPasskeysMock: vi.fn(),
        provenMock: { current: [] as { credentialId: string }[] },
    }),
)

vi.mock('../useListPasskeysForBackup', () => ({
    useListPasskeyMetadataForBackup: (chainId: ChainId) => {
        useListPasskeyMetadataMock(chainId)
        return listPasskeysMock
    },
}))

vi.mock('../../store/provenPasskeysStore', () => ({
    useProvenPasskeysStore: (selector: (s: unknown) => unknown) =>
        selector({ provenPasskeys: provenMock.current }),
}))

import { useProvenPasskeysForBackupQuery } from '../useProvenPasskeysForBackupQuery'

const CHAIN_ID = 'algorand' as ChainId

const renderWithClient = () => {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    return {
        client,
        ...renderHook(() => useProvenPasskeysForBackupQuery(CHAIN_ID), {
            wrapper,
        }),
    }
}

describe('useProvenPasskeysForBackupQuery', () => {
    beforeEach(() => {
        listPasskeysMock.mockReset()
        useListPasskeyMetadataMock.mockReset()
        provenMock.current = []
    })

    it('sweeps the given chain and caches a count, never the credentials', async () => {
        listPasskeysMock.mockResolvedValue([{ credentialId: 'a' }])

        const { client, result } = renderWithClient()

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(useListPasskeyMetadataMock).toHaveBeenCalledWith(CHAIN_ID)
        expect(
            client.getQueryData(['cloud-backup', 'proven-passkeys', CHAIN_ID]),
        ).toBe(1)
    })

    it('reads the credentials from the store', async () => {
        provenMock.current = [{ credentialId: 'a' }]
        listPasskeysMock.mockResolvedValue([])

        const { result } = renderWithClient()

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.passkeys).toEqual([{ credentialId: 'a' }])
        expect(result.current.isResolved).toBe(true)
    })

    it('stays unresolved when the sweep fails with nothing cached', async () => {
        listPasskeysMock.mockRejectedValue(new Error('keychain locked'))

        const { result } = renderWithClient()

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.isResolved).toBe(false)
    })

    it('stays resolved when the sweep fails but an earlier sync left passkeys', async () => {
        provenMock.current = [{ credentialId: 'a' }]
        listPasskeysMock.mockRejectedValue(new Error('keychain locked'))

        const { result } = renderWithClient()

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(result.current.isResolved).toBe(true)
    })

    it('is loading and unresolved while the sweep is in flight', () => {
        listPasskeysMock.mockReturnValue(new Promise(() => undefined))

        const { result } = renderWithClient()

        expect(result.current.isLoading).toBe(true)
        expect(result.current.isResolved).toBe(false)
    })
})
