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

import { Decimal } from 'decimal.js'
import type { Hex } from 'viem'
import { describe, expect, it } from 'vitest'
import { fetchAndPersistAccount } from '@perawallet/wallet-core-accounts'
import { createEvmTransferAdapter } from '@perawallet/wallet-core-chain-ethereum/transfer/builder'

import {
    createRawKeyEvmAccount,
    fundEvmAccount,
    nativeBalanceOf,
} from '../../harness/accounts'
import { createEvmConformanceEnv } from '../../harness/context'
import { EVMNET, anvilRpc } from '../../harness/evmnet'
import { buildTransfer, expectEvmConformant, signAndSend } from './support'

/**
 * Proves "send max" on a chain with no reserve: the amount the spendable
 * balance offers (synced balance less the fee the app prices at its cap) lands
 * on the node, and what remains is the unspent part of that fee headroom, never
 * negative. A mocked balance can't show the node accepts a send that leaves
 * the account holding less than its cap-priced fee.
 */
describe('evm max send', () => {
    it('sends the spendable balance and leaves only unspent fee headroom', async () => {
        const env = await createEvmConformanceEnv('ethereum')
        const sender = await createRawKeyEvmAccount(env)
        const recipient = await createRawKeyEvmAccount(env)
        const funded = 10n ** 18n + 123_456_789n
        await fundEvmAccount(env, sender.address, funded)
        // The spendable balance reads the synced store, as the send screen does.
        await fetchAndPersistAccount(sender.address, env.scope)

        const adapter = createEvmTransferAdapter(env.ctx, env.evmChain)
        const nativeRef = env.evmChain.descriptor.nativeAsset.ref
        const estimate = await adapter.getFeeEstimate(
            {
                kind: 'transfer',
                from: sender.address,
                to: recipient.address,
                assetRef: nativeRef,
                amount: new Decimal(1),
            },
            { scope: env.scope },
        )
        const capFee = estimate.presets!.normal.maxAmount
        const spendable = await adapter.spendableBalance({
            account: sender.walletAccount,
            asset: nativeRef,
            scope: env.scope,
            fee: capFee,
        })

        // Node-read inputs: the balance is the funding, the reserve formula is balance - fee.
        expect(spendable.balance.toFixed()).toBe(funded.toString())
        expect(spendable.max.toFixed()).toBe(
            (funded - BigInt(capFee.toFixed())).toString(),
        )
        const max = BigInt(spendable.max.toFixed())

        const { unsigned, fees } = await buildTransfer(env, {
            from: sender.address,
            to: recipient.address,
            assetRef: nativeRef,
            amount: max,
        })
        const { raw, hash } = await signAndSend(env, sender, unsigned)
        await expectEvmConformant({
            env,
            intent: {
                chainId: EVMNET.ethereum.eip155ChainId,
                from: sender.address,
                nonce: 0,
                to: recipient.address,
                value: max,
                ...fees,
            },
            raw,
            hash,
        })

        // The reserve covers the worst case the built transaction can be charged.
        expect(fees.gas * fees.maxFeePerGas).toBeLessThanOrEqual(
            BigInt(capFee.toFixed()),
        )
        const receipt = await anvilRpc<{
            gasUsed: Hex
            effectiveGasPrice: Hex
        }>(env.chain, 'eth_getTransactionReceipt', [hash])
        const feePaid =
            BigInt(receipt.gasUsed) * BigInt(receipt.effectiveGasPrice)
        const remaining = await nativeBalanceOf(env, sender.address)
        expect(remaining).toBe(funded - max - feePaid)
        expect(remaining).toBeGreaterThanOrEqual(0n)
        expect(await nativeBalanceOf(env, recipient.address)).toBe(max)
    })
})
