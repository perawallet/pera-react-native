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

import { beforeEach, describe, expect, it } from 'vitest'
import { renderHook } from '@test-utils/render'
import type { AccountHoldingSource } from '@perawallet/wallet-core-accounts'
import { useAssetListViewStore } from '../useAssetListViewStore'
import { useSelectedNetworkSource } from '../useSelectedNetworkSource'

const algorand: AccountHoldingSource = {
    address: 'ALGO_ADDRESS',
    scope: { chainId: 'algorand', networkId: 'mainnet' },
}
const base: AccountHoldingSource = {
    address: '0xabc',
    scope: { chainId: 'base', networkId: 'mainnet' },
}

describe('useSelectedNetworkSource', () => {
    beforeEach(() => {
        useAssetListViewStore.setState({
            selectedChainId: null,
            expandedGroupIds: [],
        })
    })

    it('returns the source on the selected chain', () => {
        useAssetListViewStore.getState().setSelectedChainId('base')

        const { result } = renderHook(() =>
            useSelectedNetworkSource([algorand, base]),
        )

        expect(result.current).toBe(base)
    })

    it('returns null on All', () => {
        const { result } = renderHook(() =>
            useSelectedNetworkSource([algorand, base]),
        )

        expect(result.current).toBeNull()
    })

    it('returns null, and keeps the selection, when the account is not on the selected chain', () => {
        useAssetListViewStore.getState().setSelectedChainId('base')

        const { result } = renderHook(() =>
            useSelectedNetworkSource([algorand]),
        )

        expect(result.current).toBeNull()
        expect(useAssetListViewStore.getState().selectedChainId).toBe('base')
    })
})
