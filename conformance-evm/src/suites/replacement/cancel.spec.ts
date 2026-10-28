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
import type { EthereumTransactionPayload } from '@perawallet/wallet-core-chain-ethereum/signing/adapter'
import {
    CANCEL_GAS,
    meetsReplacementBump,
} from '@perawallet/wallet-core-chain-ethereum/transfer/replacement'

import {
    createRawKeyEvmAccount,
    fundEvmAccount,
    nativeBalanceOf,
} from '../../harness/accounts'
import { expectEvmConformant } from '../../harness/assert/roundTrip'
import { createEvmConformanceEnv } from '../../harness/context'
import { EVMNET, mine } from '../../harness/evmnet'
import {
    chargedFee,
    expectGethPriceBump,
    feesOf,
    nodeReceipt,
    nodeTransaction,
    pooledHashes,
    signedReplacement,
    signedTransfer,
    submitAndRecord,
    transactionOf,
    withPendingPool,
} from '../submission/support'

const RECIPIENT = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'
const AMOUNT = 10n ** 17n
// A plain transfer's intrinsic gas, declared here rather than read from the app.
const TRANSFER_GAS = 21_000n

/**
 * Proves a cancel against a node's pending pool: the app's cancel is a
 * zero-value send to the sender at the pending nonce, the node swaps it in
 * and mines it, the original never lands, and the sender pays only the
 * cancel's fee. A mock cannot show the original's value staying put.
 */
describe('evm cancel', () => {
    it('cancels a pending send: the cancel mines, the original never does, only its fee is paid', async () => {
        const env = await createEvmConformanceEnv('ethereum')
        const sender = await createRawKeyEvmAccount(env)
        await fundEvmAccount(env, sender.address, 10n ** 18n)
        const senderBefore = await nativeBalanceOf(env, sender.address)
        const recipientBefore = await nativeBalanceOf(env, RECIPIENT)

        const { cancel, cancelHash, originalHash } = await withPendingPool(
            env.chain,
            async () => {
                const original = await signedTransfer(
                    env,
                    sender,
                    RECIPIENT,
                    AMOUNT,
                )
                const originalHash = await submitAndRecord(env, original.raw)
                const cancel = await signedReplacement(
                    env,
                    sender,
                    'cancel',
                    original.raw,
                )

                const { from, transaction } = cancel.unsigned
                    .payload as EthereumTransactionPayload
                expect(from).toBe(sender.address)
                expect(transaction.to).toBe(sender.address)
                expect(transaction.value).toBe(0n)
                expect(transaction.data).toBeUndefined()
                expect(transaction.nonce).toBe(0)
                expect(CANCEL_GAS).toBe(TRANSFER_GAS)
                expect(transaction.gas).toBe(TRANSFER_GAS)
                expectGethPriceBump(feesOf(original.raw), feesOf(cancel.raw))
                expect(
                    meetsReplacementBump(
                        feesOf(original.raw),
                        feesOf(cancel.raw),
                    ),
                ).toBe(true)

                const cancelHash = await submitAndRecord(env, cancel.raw)
                // Node acceptance: the node evicted the original for the cancel.
                expect(await pooledHashes(env.chain)).toEqual([
                    cancelHash.toLowerCase(),
                ])
                await mine(env.chain)
                return { cancel, cancelHash, originalHash }
            },
        )

        expect(await nodeReceipt(env.chain, originalHash)).toBeNull()
        expect(await nodeTransaction(env.chain, originalHash)).toBeNull()
        const app = transactionOf(cancel.raw)
        // Round-trip: the fee caps are the app's choice; the rest is what a cancel must be.
        await expectEvmConformant({
            env,
            intent: {
                chainId: EVMNET.ethereum.eip155ChainId,
                from: sender.address,
                nonce: 0,
                to: sender.address,
                value: 0n,
                gas: TRANSFER_GAS,
                maxFeePerGas: app.maxFeePerGas!,
                maxPriorityFeePerGas: app.maxPriorityFeePerGas!,
            },
            raw: cancel.raw,
            hash: cancelHash,
        })
        expect(
            senderBefore - (await nativeBalanceOf(env, sender.address)),
        ).toBe(await chargedFee(env.chain, cancelHash))
        expect(await nativeBalanceOf(env, RECIPIENT)).toBe(recipientBefore)
    })
})
