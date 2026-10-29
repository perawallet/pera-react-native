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
import React from 'react'
import { act, renderHook } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import { getProvider } from '@perawallet/wallet-extension-provider'
import { useSyncCandidateAccounts } from '../useSyncCandidateAccounts'
import { useAccountsStore } from '../../store'
import type { WalletAccount } from '../../models'
import { buildTestAccount } from '../../__tests__/accountFactory'
import {
    ALGORAND,
    BASE,
    ETHEREUM,
    registerChainFamilies,
} from '../../__tests__/chainFamilies'

const mockSyncAndEnrichNewAccount = vi.fn((..._args: unknown[]) =>
    Promise.resolve(),
)
const mockCleanupRemovedAccountData = vi.fn((..._args: unknown[]) =>
    Promise.resolve(),
)

vi.mock('../../sync/account-syncer', () => ({
    syncAndEnrichNewAccount: (...args: unknown[]) =>
        mockSyncAndEnrichNewAccount(...args),
}))
vi.mock('../../cleanup', () => ({
    cleanupRemovedAccountData: (...args: unknown[]) =>
        mockCleanupRemovedAccountData(...args),
}))

const EVM_ADDRESS = `0x${'ab'.repeat(20)}`
const ALGORAND_ADDRESS = 'B'.repeat(58)

const scopeOf = (chainId: string): ChainScope => ({
    chainId: chainId as ChainScope['chainId'],
    networkId: 'mainnet',
})

const candidate = (chains: Record<string, string>): WalletAccount =>
    buildTestAccount(
        { kind: 'local', seed: 'bip39', hd: { account: 0, keyIndex: 0 } },
        Object.fromEntries(
            Object.entries(chains).map(([chainId, address]) => [
                chainId,
                { address, keyPairId: `${chainId}-key` },
            ]),
        ),
        { id: 'candidate' },
    )

const makeWrapper = () => {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client }, children)
}

describe('useSyncCandidateAccounts', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useAccountsStore.getState().resetState()
    })

    it("syncs each entry the wallet doesn't hold on its own chain's scope", () => {
        registerChainFamilies([ALGORAND, ETHEREUM, BASE])
        const accounts = [
            candidate({
                [ALGORAND]: ALGORAND_ADDRESS,
                [ETHEREUM]: EVM_ADDRESS,
                [BASE]: EVM_ADDRESS,
            }),
        ]

        renderHook(() => useSyncCandidateAccounts(accounts), {
            wrapper: makeWrapper(),
        })

        expect(
            mockSyncAndEnrichNewAccount.mock.calls.map(([address, scope]) => [
                address,
                scope,
            ]),
        ).toEqual([
            [ALGORAND_ADDRESS, scopeOf(ALGORAND)],
            [EVM_ADDRESS, scopeOf(ETHEREUM)],
            [EVM_ADDRESS, scopeOf(BASE)],
        ])
    })

    it('skips an entry a stored account already holds', () => {
        registerChainFamilies([ALGORAND, ETHEREUM])
        useAccountsStore
            .getState()
            .setAccounts([candidate({ [ETHEREUM]: EVM_ADDRESS })])
        const accounts = [
            candidate({
                [ALGORAND]: ALGORAND_ADDRESS,
                [ETHEREUM]: EVM_ADDRESS,
            }),
        ]

        renderHook(() => useSyncCandidateAccounts(accounts), {
            wrapper: makeWrapper(),
        })

        expect(mockSyncAndEnrichNewAccount).toHaveBeenCalledExactlyOnceWith(
            ALGORAND_ADDRESS,
            scopeOf(ALGORAND),
            expect.any(QueryClient),
        )
    })

    it('skips a switched-off chain', () => {
        registerChainFamilies([ALGORAND, ETHEREUM])
        getProvider().chains.setCapabilityOverrides(() => ({
            chainEnabled: { [ETHEREUM]: false },
        }))
        const accounts = [
            candidate({
                [ALGORAND]: ALGORAND_ADDRESS,
                [ETHEREUM]: EVM_ADDRESS,
            }),
        ]

        renderHook(() => useSyncCandidateAccounts(accounts), {
            wrapper: makeWrapper(),
        })

        expect(
            mockSyncAndEnrichNewAccount.mock.calls.map(([address]) => address),
        ).toEqual([ALGORAND_ADDRESS])
    })

    it('on unmount deletes the unheld addresses, keeping one a stored account gained meanwhile', () => {
        registerChainFamilies([ALGORAND, ETHEREUM])
        const accounts = [
            candidate({
                [ALGORAND]: ALGORAND_ADDRESS,
                [ETHEREUM]: EVM_ADDRESS,
            }),
        ]
        const { unmount } = renderHook(
            () => useSyncCandidateAccounts(accounts),
            { wrapper: makeWrapper() },
        )

        act(() => {
            useAccountsStore
                .getState()
                .setAccounts([candidate({ [ALGORAND]: ALGORAND_ADDRESS })])
        })
        unmount()

        expect(mockCleanupRemovedAccountData).toHaveBeenCalledExactlyOnceWith({
            accountAddress: EVM_ADDRESS,
        })
    })
})
