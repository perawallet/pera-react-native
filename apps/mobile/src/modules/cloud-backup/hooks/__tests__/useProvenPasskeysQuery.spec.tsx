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
import { useProvenPasskeysQuery } from '../useProvenPasskeysQuery'

const { listPasskeysMock, provenMock } = vi.hoisted(() => ({
    listPasskeysMock: vi.fn(),
    provenMock: { current: [] as { credentialId: string }[] },
}))

vi.mock('@perawallet/wallet-core-backup', () => ({
    useListPasskeyMetadataForBackup: () => listPasskeysMock,
    useProvenPasskeysStore: (selector: (s: unknown) => unknown) =>
        selector({ provenPasskeys: provenMock.current }),
}))

const renderWithClient = () => {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    const wrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
    )
    return {
        client,
        ...renderHook(() => useProvenPasskeysQuery(), { wrapper }),
    }
}

describe('useProvenPasskeysQuery', () => {
    beforeEach(() => {
        listPasskeysMock.mockReset()
        provenMock.current = []
    })

    it('caches a count, never the credentials', async () => {
        listPasskeysMock.mockResolvedValue([{ credentialId: 'a' }])

        const { client, result } = renderWithClient()

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        expect(client.getQueryData(['cloud-backup', 'proven-passkeys'])).toBe(1)
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
})
