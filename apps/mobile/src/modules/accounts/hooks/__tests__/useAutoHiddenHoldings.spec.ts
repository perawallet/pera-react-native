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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type {
    AccountHoldingSource,
    WalletAccount,
} from '@perawallet/wallet-core-accounts'
import { useAssetPreferencesStore } from '@perawallet/wallet-core-assets'
import type { ChainScope } from '@perawallet/wallet-core-chain-contract'
import {
    registerEthereumChain,
    restoreAlgorandOnlyChains,
} from '@test-utils/chain-fixtures'
import { useAssetListViewStore } from '../useAssetListViewStore'
import { useAutoHiddenHoldings } from '../useAutoHiddenHoldings'

const ETHEREUM: ChainScope = { chainId: 'ethereum', networkId: 'mainnet' }
const ALGORAND: ChainScope = { chainId: 'algorand', networkId: 'mainnet' }
const ETH_ADDRESS = `0x${'a'.repeat(40)}`

const mocks = vi.hoisted(() => ({
    sources: [] as AccountHoldingSource[],
    calls: [] as { sources: unknown; options: unknown }[],
    hideZeroBalance: false,
}))

vi.mock('@perawallet/wallet-core-accounts', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-accounts')
    >()),
    useAccountHoldingSources: () => mocks.sources,
    useAccountAssetsQuery: (sources: unknown, options: unknown) => {
        mocks.calls.push({ sources, options })
        return { holdings: [{ assetId: '0xspam' }], isPending: false }
    },
}))

const account = {
    id: 'two-chains',
    name: '',
    custody: { kind: 'watch' },
    chains: {
        algorand: { address: 'ALGO_ADDRESS' },
        ethereum: { address: ETH_ADDRESS },
    },
} as WalletAccount

describe('useAutoHiddenHoldings', () => {
    beforeEach(() => {
        registerEthereumChain()
        mocks.sources = [
            { address: 'ALGO_ADDRESS', scope: ALGORAND },
            { address: ETH_ADDRESS, scope: ETHEREUM },
        ]
        mocks.calls = []
        mocks.hideZeroBalance = false
        useAssetListViewStore.getState().setSelectedChainId(null)
        vi.mocked(useAssetPreferencesStore).mockImplementation(selector =>
            selector({
                hideZeroBalance: mocks.hideZeroBalance,
            } as ReturnType<typeof useAssetPreferencesStore.getState>),
        )
    })

    afterEach(() => {
        restoreAlgorandOnlyChains()
    })

    it('reads the auto-hidden holdings of the chains that receive tokens unasked', () => {
        const { result } = renderHook(() => useAutoHiddenHoldings(account))

        expect(result.current.holdings).toEqual([{ assetId: '0xspam' }])
        expect(mocks.calls.at(-1)).toEqual({
            sources: [{ address: ETH_ADDRESS, scope: ETHEREUM }],
            options: expect.objectContaining({
                filters: expect.objectContaining({ onlyAutoHidden: true }),
            }),
        })
    })

    it('narrows to the network the asset list shows', () => {
        mocks.sources = [
            { address: ETH_ADDRESS, scope: ETHEREUM },
            {
                address: ETH_ADDRESS,
                scope: { chainId: 'base', networkId: 'mainnet' },
            },
        ]
        useAssetListViewStore.getState().setSelectedChainId('ethereum')

        renderHook(() => useAutoHiddenHoldings(account))

        expect(mocks.calls.at(-1)?.sources).toEqual([
            { address: ETH_ADDRESS, scope: ETHEREUM },
        ])
    })

    it('leaves out zero balances when the asset list does', () => {
        mocks.hideZeroBalance = true

        renderHook(() => useAutoHiddenHoldings(account))

        expect(mocks.calls.at(-1)?.options).toEqual(
            expect.objectContaining({
                filters: expect.objectContaining({ hideZeroBalance: true }),
            }),
        )
    })
})
