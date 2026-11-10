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

import { describe, it, expect, vi } from 'vitest'
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { swapAssetSearchPlaceholderKey } from '../swapAssetSearchPlaceholderKey'

const FAMILY_OF: Record<string, string> = {
    algorand: 'algorand',
    ethereum: 'evm',
    base: 'evm',
    other: 'other',
}

const PLACEHOLDER_OF: Record<string, string> = {
    algorand: 'algorand.key',
    evm: 'evm.key',
}

vi.mock('@perawallet/wallet-core-chain-shared', () => ({
    getChainDescriptor: (chainId: string) => ({ family: FAMILY_OF[chainId] }),
}))

vi.mock('@modules/chain-ui', () => ({
    chainUiFor: (family: string) => ({
        swapAssetSearchPlaceholder: PLACEHOLDER_OF[family],
    }),
}))

const keyFor = (...chainIds: string[]) =>
    swapAssetSearchPlaceholderKey(chainIds as ChainId[])

describe('swapAssetSearchPlaceholderKey', () => {
    it('uses the family key for a single chain', () => {
        expect(keyFor('ethereum')).toBe('evm.key')
    })

    it('uses the shared key for two chains of one family', () => {
        expect(keyFor('ethereum', 'base')).toBe('evm.key')
    })

    it('uses the all-formats key across families', () => {
        expect(keyFor('algorand', 'ethereum')).toBe(
            'swap.asset_selection.search_placeholder_all',
        )
    })

    it('uses the all-formats key for a family with no slot', () => {
        expect(keyFor('other')).toBe(
            'swap.asset_selection.search_placeholder_all',
        )
    })

    it('uses the all-formats key for an empty list', () => {
        expect(keyFor()).toBe('swap.asset_selection.search_placeholder_all')
    })
})
