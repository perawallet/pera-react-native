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

import { describe, expect, it, vi } from 'vitest'
import { Decimal } from 'decimal.js'
import type { ChainAssetBalance } from '@perawallet/wallet-core-accounts'
import { rankSwapPayAssets } from '../rankSwapPayAssets'

vi.mock('@perawallet/wallet-core-chain-contract', () => ({
    toScopeKey: ({
        chainId,
        networkId,
    }: {
        chainId: string
        networkId: string
    }) => `${chainId}:${networkId}`,
}))

vi.mock('@perawallet/wallet-core-assets', () => ({
    nativeAssetFor: (chainId: string) => ({
        assetId: chainId === 'algorand' ? '0' : 'native',
    }),
}))

const holding = (
    chainId: string,
    assetId: string,
    amount: number,
    fiatValue: number | null,
    restriction: string | null = null,
): ChainAssetBalance =>
    ({
        assetId,
        amount: new Decimal(amount),
        nativeValue: null,
        fiatValue: fiatValue === null ? null : new Decimal(fiatValue),
        restriction,
        scope: { chainId, networkId: 'mainnet' },
    }) as unknown as ChainAssetBalance

const anyChain = () => true
const ETHEREUM = { chainId: 'ethereum', networkId: 'mainnet' } as const

describe('rankSwapPayAssets', () => {
    it('offers native coins only, never a token worth more', () => {
        const usdc = holding('algorand', '31566704', 100, 100)
        const algo = holding('algorand', '0', 1, 0.2)

        expect(rankSwapPayAssets([usdc, algo], ETHEREUM, anyChain)).toEqual([
            algo,
        ])
    })

    it('offers nothing for a token on a chain with no native coin to pay its fee', () => {
        const balances = [
            holding('base', 'native', 0, 0),
            holding('base', '0xusdc', 50, 50),
        ]

        expect(rankSwapPayAssets(balances, ETHEREUM, anyChain)).toEqual([])
    })

    it('ranks native coins by value, unpriced last', () => {
        const unpriced = holding('bsc', 'native', 10, null)
        const algo = holding('algorand', '0', 10, 2)
        const baseEth = holding('base', 'native', 1, 3000)

        expect(
            rankSwapPayAssets([unpriced, algo, baseEth], ETHEREUM, anyChain),
        ).toEqual([baseEth, algo, unpriced])
    })

    it('skips the target network, empty and transfer-blocked holdings', () => {
        const balances = [
            holding('ethereum', 'native', 1, 3000),
            holding('algorand', '0', 0, 0),
            holding('base', 'native', 1, 3000, 'transferBlocked'),
        ]

        expect(rankSwapPayAssets(balances, ETHEREUM, anyChain)).toEqual([])
    })

    it('skips a network the account cannot pay from', () => {
        const balances = [holding('algorand', '0', 5, 1)]

        expect(
            rankSwapPayAssets(
                balances,
                ETHEREUM,
                chainId => chainId !== 'algorand',
            ),
        ).toEqual([])
    })
})
