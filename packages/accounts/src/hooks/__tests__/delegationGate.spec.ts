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
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useNetworkStore } from '@perawallet/wallet-core-chain-shared'
import type { HardwareWalletDerivedAccount } from '@perawallet/wallet-core-hardware-wallet'
import { useAccountChainStateStore, useAccountsStore } from '../../store'
import {
    FAKE_CHAIN_ID,
    MAINNET_SCOPE,
    fakeAccountStateSnapshot,
    fakeAccountsChain,
    registerFakeAccountsChain,
    seedAuthority,
} from '../../__tests__/fakeAccountsChain'
import { testAccount } from '../../__tests__/accountFactory'
import { prefetchLedgerAccountPreview } from '../prefetchLedgerAccountPreview'
import { useAccountDiscovery } from '../useAccountDiscovery'
import { useAccountsDelegatedTo } from '../useAccountsDelegatedTo'
import { useAuthorityTargetCategories } from '../useAuthorityTargets'
import { useDelegatedAccount } from '../useDelegatedAccount'
import { useDelegatedAddressesQuery } from '../useDelegatedAddressesQuery'
import { useDelegatedTransition } from '../useDelegatedTransition'
import { useIsDelegationAvailable } from '../useIsDelegationAvailable'
import { useLedgerDelegatedScan } from '../useLedgerDelegatedScan'
import { useRescanDelegatedAccounts } from '../useRescanDelegatedAccounts'

const gate = vi.hoisted(() => ({ isOn: true }))

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    useChainCapabilityCheck: () => () => gate.isOn,
}))

type GateState = {
    name: string
    hasMember: boolean
    isOn: boolean
}

const STATES: GateState[] = [
    { name: 'the chain declares no delegation', hasMember: false, isOn: true },
    { name: 'the capability is off', hasMember: true, isOn: false },
    { name: 'the capability is on', hasMember: true, isOn: true },
]

const AUTHORITY = 'AUTH'
const derived: HardwareWalletDerivedAccount = {
    address: AUTHORITY,
    publicKey: new Uint8Array([1]),
    accountIndex: 0,
}

const wrapper = ({ children }: { children: React.ReactNode }) => {
    const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    })
    return React.createElement(QueryClientProvider, { client }, children)
}

describe.each(STATES)('delegation gate when $name', state => {
    const isNetworkGated = state.hasMember && state.isOn

    const fetchDelegated = () =>
        fakeAccountsChain().adapter.authority?.fetchDelegatedAddresses
    const callsToFetch = () =>
        fetchDelegated() ? vi.mocked(fetchDelegated()!).mock.calls.length : 0

    beforeEach(() => {
        vi.restoreAllMocks()
        vi.clearAllMocks()
        gate.isOn = state.isOn
        useAccountsStore.getState().resetState()
        useAccountChainStateStore.getState().resetState()
        useNetworkStore.getState().setNetwork('mainnet')
        registerFakeAccountsChain(
            state.hasMember ? {} : { authority: undefined },
        )
        const fetchDelegatedAddresses = fetchDelegated()
        if (fetchDelegatedAddresses) {
            vi.mocked(fetchDelegatedAddresses).mockResolvedValue(['D1'])
        }
        vi.mocked(
            fakeAccountsChain().adapter.fetchAccountState,
        ).mockResolvedValue(fakeAccountStateSnapshot())
    })

    it('reports availability from the member and its capability', () => {
        const { result } = renderHook(() =>
            useIsDelegationAvailable(FAKE_CHAIN_ID),
        )

        expect(result.current).toBe(isNetworkGated)
    })

    it('scans the Ledger accounts only when delegation is available', async () => {
        const { result } = renderHook(
            () => useLedgerDelegatedScan([derived], MAINNET_SCOPE),
            { wrapper },
        )

        if (isNetworkGated) {
            await waitFor(() => expect(result.current.isScanning).toBe(false))
            expect(result.current.delegated).toEqual([
                { kind: 'delegated', address: 'D1', authAccount: derived },
            ])
            expect(callsToFetch()).toBe(1)
        } else {
            expect(result.current).toEqual({ delegated: [], isScanning: false })
            expect(callsToFetch()).toBe(0)
        }
    })

    it('rescans only when delegation is available', async () => {
        const { result } = renderHook(
            () => useRescanDelegatedAccounts(MAINNET_SCOPE),
            { wrapper },
        )

        const scan = await result.current.scan(AUTHORITY)
        const sweep = await result.current.scanAll([AUTHORITY])

        if (isNetworkGated) {
            expect(scan.notImportedAddresses).toEqual(['D1'])
            expect(sweep.candidates).toEqual([
                { address: 'D1', sourceAddress: AUTHORITY },
            ])
            expect(callsToFetch()).toBe(2)
        } else {
            expect(scan).toEqual({
                importedAddresses: [],
                notImportedAddresses: [],
            })
            expect(sweep).toEqual({
                importedAddresses: [],
                candidates: [],
                failedSources: [],
            })
            expect(callsToFetch()).toBe(0)
        }
    })

    it('discovers delegated accounts only when delegation is available', async () => {
        const { result } = renderHook(
            () => useAccountDiscovery(MAINNET_SCOPE),
            {
                wrapper,
            },
        )

        const found = await result.current.discoverDelegatedAccounts({
            accountAddresses: [AUTHORITY],
        })

        expect(found).toHaveLength(isNetworkGated ? 1 : 0)
        expect(callsToFetch()).toBe(isNetworkGated ? 1 : 0)
    })

    // Read-only lookups keep answering with the capability off, as signing
    // does, and send nothing on a chain that declares no delegation.
    it('looks addresses up whenever the chain declares delegation', async () => {
        const fetchSpy = vi.spyOn(globalThis, 'fetch')
        const { result } = renderHook(
            () => useDelegatedAddressesQuery(AUTHORITY, MAINNET_SCOPE),
            { wrapper },
        )

        await waitFor(() => expect(result.current.isLoading).toBe(false))
        const client = new QueryClient()
        await prefetchLedgerAccountPreview(client, AUTHORITY, MAINNET_SCOPE)

        expect(result.current.delegatedAddresses).toEqual(
            state.hasMember ? ['D1'] : [],
        )
        expect(callsToFetch()).toBe(state.hasMember ? 2 : 0)
        expect(fetchSpy).not.toHaveBeenCalled()
    })

    it('keeps resolving held delegations from the store', () => {
        const signer = testAccount('local', 'S', { id: 'S' })
        const delegated = testAccount('watch', 'A', { id: 'A' })
        useAccountsStore.getState().setAccounts([delegated, signer])
        seedAuthority('A', 'S')
        const { adapter } = fakeAccountsChain()
        vi.mocked(adapter.resolveSigner).mockReturnValue({
            kind: 'ok',
            signer,
        })
        vi.mocked(adapter.getAuthAccount).mockReturnValue(signer)
        vi.mocked(
            adapter.authority?.accountsDelegatedTo ?? vi.fn(),
        ).mockReturnValue([delegated])

        const account = renderHook(() =>
            useDelegatedAccount('A', FAKE_CHAIN_ID),
        )
        const transition = renderHook(() =>
            useDelegatedTransition('A', FAKE_CHAIN_ID),
        )
        const dependents = renderHook(() =>
            useAccountsDelegatedTo('S', FAKE_CHAIN_ID),
        )
        const categories = renderHook(() =>
            useAuthorityTargetCategories(MAINNET_SCOPE),
        )

        if (state.hasMember) {
            expect(account.result.current).toEqual(signer)
            expect(transition.result.current).toEqual({
                from: delegated,
                to: signer,
            })
            expect(dependents.result.current).toEqual([delegated])
            expect(categories.result.current).toEqual(['standard', 'hardware'])
        } else {
            expect(account.result.current).toBeNull()
            expect(transition.result.current).toBeNull()
            expect(dependents.result.current).toEqual([])
            expect(categories.result.current).toEqual([])
        }
    })
})
