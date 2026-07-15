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
import { act, renderHook } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useSyncNewAccounts } from '../useSyncNewAccounts'
import { useAccountsStore } from '../../store'
import type { WalletAccount } from '../../models'

const mockSyncAndEnrichNewAccount = vi.fn(() => Promise.resolve())

vi.mock('../../sync/account-syncer', () => ({
    syncAndEnrichNewAccount: (...args: unknown[]) =>
        mockSyncAndEnrichNewAccount(...args),
}))
vi.mock('@perawallet/wallet-core-blockchain', () => ({
    useNetwork: () => ({ network: 'mainnet' }),
}))

const makeAccount = (address: string): WalletAccount =>
    ({ type: 'watch', address, name: address }) as unknown as WalletAccount

const makeWrapper = () => {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client }, children)
}

describe('useSyncNewAccounts', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useAccountsStore.getState().resetState()
    })

    it('does not sync the accounts already present at mount', () => {
        useAccountsStore.getState().setAccounts([makeAccount('ADDR1')])

        renderHook(() => useSyncNewAccounts(), { wrapper: makeWrapper() })

        expect(mockSyncAndEnrichNewAccount).not.toHaveBeenCalled()
    })

    it('syncs only the addresses added after mount', () => {
        useAccountsStore.getState().setAccounts([makeAccount('ADDR1')])

        renderHook(() => useSyncNewAccounts(), { wrapper: makeWrapper() })

        act(() => {
            useAccountsStore
                .getState()
                .setAccounts([makeAccount('ADDR1'), makeAccount('ADDR2')])
        })

        expect(mockSyncAndEnrichNewAccount).toHaveBeenCalledTimes(1)
        expect(mockSyncAndEnrichNewAccount).toHaveBeenCalledWith(
            'ADDR2',
            'mainnet',
            expect.any(QueryClient),
        )
    })

    it('ignores store writes that do not change the address set', () => {
        useAccountsStore.getState().setAccounts([makeAccount('ADDR1')])

        renderHook(() => useSyncNewAccounts(), { wrapper: makeWrapper() })

        act(() => {
            // Same membership, new array/object references (e.g. a rename or
            // a background-sync rekey write).
            useAccountsStore.getState().setAccounts([makeAccount('ADDR1')])
        })

        expect(mockSyncAndEnrichNewAccount).not.toHaveBeenCalled()
    })

    it('treats a removed-then-re-imported address as new again', () => {
        useAccountsStore
            .getState()
            .setAccounts([makeAccount('ADDR1'), makeAccount('ADDR2')])

        renderHook(() => useSyncNewAccounts(), { wrapper: makeWrapper() })

        act(() => {
            useAccountsStore.getState().setAccounts([makeAccount('ADDR1')])
        })
        act(() => {
            useAccountsStore
                .getState()
                .setAccounts([makeAccount('ADDR1'), makeAccount('ADDR2')])
        })

        expect(mockSyncAndEnrichNewAccount).toHaveBeenCalledTimes(1)
        expect(mockSyncAndEnrichNewAccount).toHaveBeenCalledWith(
            'ADDR2',
            'mainnet',
            expect.any(QueryClient),
        )
    })
})
