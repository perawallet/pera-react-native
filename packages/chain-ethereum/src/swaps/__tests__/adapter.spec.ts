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

import { describe, expect, it } from 'vitest'
import type { SwapHistoryItem } from '@perawallet/wallet-core-swaps'
import { testChainContext } from '../../__tests__/context'
import { BASE, BSC, ETHEREUM, evmScopeOf } from '../../__tests__/evm-chains'
import { createEvmSwapAdapter } from '../adapter'

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'

describe('createEvmSwapAdapter', () => {
    const ctx = testChainContext()
    const adapter = createEvmSwapAdapter(ctx, ETHEREUM)
    const scope = evmScopeOf(ETHEREUM)

    it('round-trips the native asset through its router id', () => {
        const routerId = adapter.toRouterAssetId(adapter.nativeAssetId, scope)

        expect(routerId).toBe('eip155:1/slip44:60')
        expect(adapter.fromRouterAssetId(routerId, scope)).toBe(
            ETHEREUM.nativeAsset.assetId,
        )
    })

    it('round-trips an ERC-20 through its router id', () => {
        const routerId = adapter.toRouterAssetId(USDC, scope)

        expect(routerId).toBe(`eip155:1/erc20:${USDC.toLowerCase()}`)
        expect(adapter.fromRouterAssetId(routerId, scope)).toBe(USDC)
    })

    it("reads another chain's router id as nothing", () => {
        const baseId = createEvmSwapAdapter(ctx, BASE).toRouterAssetId(
            BASE.nativeAsset.assetId,
            evmScopeOf(BASE),
        )

        expect(adapter.fromRouterAssetId(baseId, scope)).toBeNull()
        expect(
            adapter.fromRouterAssetId(
                'algorand:wGHE2Pwdvd7S12BL5FaOP20EGYesN73k/slip44:283',
                scope,
            ),
        ).toBeNull()
    })

    it("defaults the receive side to the row's asset, or the native one", () => {
        expect(adapter.defaultReceiveAssetId).toBe(USDC)
        expect(createEvmSwapAdapter(ctx, BSC).defaultReceiveAssetId).toBe(
            BSC.nativeAsset.assetId,
        )
    })

    it('holds back 0.005 of the native unit, and no holding reserve', () => {
        expect(adapter.chainId).toBe('ethereum')
        expect(adapter.maxAmountFeeReserve.toString()).toBe('5000000000000000')
        expect(adapter.holdingReserve(scope).isZero()).toBe(true)
        expect(adapter.supportsCosignedSwaps).toBe(false)
        expect(adapter.useEnsureReceivable).toBeUndefined()
    })

    it("links the item's swap transaction on this chain", () => {
        const swapTx = { role: 'swap', scope, txHash: '0xabc' }
        const url = adapter.swapExplorerUrl(scope, {
            transactions: [
                { role: 'approval', scope, txHash: '0xdef' },
                swapTx,
            ],
        } as unknown as SwapHistoryItem)

        expect(url).toContain('0xabc')
    })

    it('links nowhere when no swap transaction is on this chain', () => {
        const url = adapter.swapExplorerUrl(scope, {
            transactions: [
                {
                    role: 'swap',
                    scope: { chainId: 'algorand', networkId: 'mainnet' },
                    txHash: 'ALGO',
                },
            ],
        } as unknown as SwapHistoryItem)

        expect(url).toBeUndefined()
    })
})
