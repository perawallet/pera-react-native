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
import type { ChainId } from '@perawallet/wallet-core-chain-contract'
import { swapPairLabel, swapPairLabelWithNetworks } from '../swapPairLabel'

vi.mock('@perawallet/wallet-core-chain-shared', async importOriginal => ({
    ...(await importOriginal<
        typeof import('@perawallet/wallet-core-chain-shared')
    >()),
    chainDisplayNameOf: (chainId: string) =>
        ({
            base: 'Base',
            arbitrum: 'Arbitrum One',
            algorand: 'Algorand',
        })[chainId],
}))

const ref = {
    chainId: 'algorand',
    networkId: 'mainnet',
    assetId: '31566704',
} as const

describe('swapPairLabel', () => {
    it('names each side by unit name', () => {
        expect(
            swapPairLabel({
                assetIn: { ref, unitName: 'USDC' },
                assetOut: { ref, unitName: 'ALGO' },
            }),
        ).toBe('USDC → ALGO')
    })

    it('falls back to the asset id when a side has no unit name', () => {
        expect(
            swapPairLabel({
                assetIn: { ref, unitName: null },
                assetOut: { ref, unitName: 'ALGO' },
            }),
        ).toBe('31566704 → ALGO')
    })
})

describe('swapPairLabelWithNetworks', () => {
    const on = (chainId: ChainId, unitName: string | null) => ({
        ref: { chainId, networkId: 'mainnet', assetId: '0' } as const,
        unitName,
    })

    it('tells a pair that shares a symbol apart by network', () => {
        expect(
            swapPairLabelWithNetworks({
                assetIn: on('base', 'ETH'),
                assetOut: on('arbitrum', 'ETH'),
            }),
        ).toBe('ETH (Base) → ETH (Arbitrum One)')
    })

    it('names Algorand on an Algorand to EVM pair', () => {
        expect(
            swapPairLabelWithNetworks({
                assetIn: on('algorand', 'ALGO'),
                assetOut: on('base', 'USDC'),
            }),
        ).toBe('ALGO (Algorand) → USDC (Base)')
    })

    it('falls back to the chain id for a chain the registry does not know', () => {
        expect(
            swapPairLabelWithNetworks({
                assetIn: on('polygon', 'ETH'),
                assetOut: on('base', 'ETH'),
            }),
        ).toBe('ETH (polygon) → ETH (Base)')
    })

    it('falls back to the asset id when a side has no unit name', () => {
        expect(
            swapPairLabelWithNetworks({
                assetIn: on('base', null),
                assetOut: on('arbitrum', 'ETH'),
            }),
        ).toBe('0 (Base) → ETH (Arbitrum One)')
    })
})
