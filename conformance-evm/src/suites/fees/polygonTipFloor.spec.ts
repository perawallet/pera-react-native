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

import type { Address, Hex } from 'viem'
import { describe, expect, it } from 'vitest'

import { createRawKeyEvmAccount, fundEvmAccount } from '../../harness/accounts'
import { createEvmConformanceEnv } from '../../harness/context'
import { EVMNET, anvilRpc, mine } from '../../harness/evmnet'
import {
    buildTransfer,
    expectEvmConformant,
    signAndSend,
} from '../construction/support'

// Polygon's validators drop a transaction tipping under 25 gwei, on Amoy as on mainnet.
const POLYGON_MIN_TIP = 25n * 10n ** 9n

const RECIPIENT: Address = '0x000000000000000000000000000000000000dEaD'

/**
 * Proves the app raises Polygon's tip to the 25 gwei floor when the fee
 * history offers less, and that a transfer at that tip lands paying it. On a
 * quiet chain every history row is empty, so the percentile tip is zero and
 * only the floor can produce the tip; a mock can't show the node then charges
 * base fee plus exactly that tip.
 */
describe('evm polygon tip floor', () => {
    it('raises the tip of a quiet chain to 25 gwei and the transfer lands with it', async () => {
        const env = await createEvmConformanceEnv('polygon')
        const sender = await createRawKeyEvmAccount(env)
        await fundEvmAccount(env, sender.address, 10n ** 18n)
        // Ten empty blocks push every tipped block out of the app's history window.
        await mine(env.chain, 10)
        const history = await anvilRpc<{ gasUsedRatio: number[] }>(
            env.chain,
            'eth_feeHistory',
            ['0xa', 'latest', [50]],
        )
        expect(history.gasUsedRatio.every(ratio => ratio === 0)).toBe(true)

        const { unsigned, fees } = await buildTransfer(env, {
            from: sender.address,
            to: RECIPIENT,
            assetRef: env.evmChain.descriptor.nativeAsset.ref,
            amount: 1n,
        })
        expect(fees.maxPriorityFeePerGas).toBe(POLYGON_MIN_TIP)

        const { raw, hash } = await signAndSend(env, sender, unsigned)
        const receipt = await expectEvmConformant({
            env,
            intent: {
                chainId: EVMNET.polygon.eip155ChainId,
                from: sender.address,
                nonce: 0,
                to: RECIPIENT,
                value: 1n,
                // App-chosen: gas and fee caps; the tip is pinned above.
                ...fees,
            },
            raw,
            hash,
        })

        // Node acceptance: the whole floor tip is paid on top of the base fee.
        const block = await anvilRpc<{ baseFeePerGas: Hex }>(
            env.chain,
            'eth_getBlockByNumber',
            [`0x${receipt.blockNumber.toString(16)}`, false],
        )
        expect(receipt.effectiveGasPrice).toBe(
            BigInt(block.baseFeePerGas) + POLYGON_MIN_TIP,
        )
    })
})
