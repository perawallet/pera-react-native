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
import type {
    ExecuteSwapParams,
    SwapExecutionContext,
} from '@perawallet/wallet-core-swaps'
import { BASE, ETHEREUM, evmScopeOf } from '../../__tests__/evm-chains'
import { createEvmSwapAdapter } from '../adapter'

const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'

describe('createEvmSwapAdapter', () => {
    const adapter = createEvmSwapAdapter(ETHEREUM)
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
        const baseId = createEvmSwapAdapter(BASE).toRouterAssetId(
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

    it('receives only: refuses to run a swap from this chain', async () => {
        const result = await adapter.executeSwap(
            {} as ExecuteSwapParams,
            {} as SwapExecutionContext,
        )

        expect(result).toEqual({
            kind: 'failed',
            failure: { phase: 'prepare', reason: 'unsupported-steps' },
        })
        expect(adapter.supportsCosignedSwaps).toBe(false)
    })

    it('reserves nothing and links nowhere', () => {
        expect(adapter.chainId).toBe('ethereum')
        expect(adapter.defaultReceiveAssetId).toBe(adapter.nativeAssetId)
        expect(adapter.maxAmountFeeReserve.isZero()).toBe(true)
        expect(adapter.swapExplorerUrl(scope, {} as never)).toBeUndefined()
    })
})
