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
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, beforeEach, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
    getAssetHolderAddresses: vi.fn(),
    selectedAccountAddress: 'SELECTED',
    accounts: [
        { address: 'SELECTED' },
        { address: 'HOLDER_A' },
        { address: 'HOLDER_B' },
    ] as Array<{ address: string }>,
}))

vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

vi.mock('../../db', () => ({
    getAssetHolderAddresses: mocks.getAssetHolderAddresses,
}))

vi.mock('../useSelectedAccountAddress', () => ({
    useSelectedAccountAddress: () => ({
        selectedAccountAddress: mocks.selectedAccountAddress,
    }),
}))

vi.mock('../useAllAccounts', () => ({
    useAllAccounts: () => mocks.accounts,
}))

import { useResolveAssetHolderAddress } from '../useResolveAssetHolderAddress'

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

const renderResolver = () =>
    renderHook(() => useResolveAssetHolderAddress(), {
        wrapper: createWrapper(),
    })

describe('useResolveAssetHolderAddress', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.selectedAccountAddress = 'SELECTED'
        mocks.accounts = [
            { address: 'SELECTED' },
            { address: 'HOLDER_A' },
            { address: 'HOLDER_B' },
        ]
    })

    it('resolves the holding account when the selected one does not hold the asset', async () => {
        mocks.getAssetHolderAddresses.mockResolvedValue(['HOLDER_A'])

        const { result } = renderResolver()

        await expect(result.current('123')).resolves.toBe('HOLDER_A')
    })

    it('keeps the selected account when it is one of the holders', async () => {
        mocks.getAssetHolderAddresses.mockResolvedValue([
            'HOLDER_A',
            'SELECTED',
        ])

        const { result } = renderResolver()

        await expect(result.current('123')).resolves.toBe('SELECTED')
    })

    it('resolves null when no account holds the asset', async () => {
        mocks.getAssetHolderAddresses.mockResolvedValue([])

        const { result } = renderResolver()

        await expect(result.current('123')).resolves.toBeNull()
    })

    it('ignores holdings rows left behind by a removed account', async () => {
        mocks.getAssetHolderAddresses.mockResolvedValue([
            'REMOVED_ACCOUNT',
            'HOLDER_B',
        ])

        const { result } = renderResolver()

        await expect(result.current('123')).resolves.toBe('HOLDER_B')
    })

    it('reads the holders table once per asset', async () => {
        mocks.getAssetHolderAddresses.mockResolvedValue(['HOLDER_A'])

        const { result } = renderResolver()

        await result.current('123')
        await result.current('123')

        expect(mocks.getAssetHolderAddresses).toHaveBeenCalledTimes(1)
    })
})
