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

import type { FeeValuesEIP1559 } from 'viem'
import { describe, expect, it } from 'vitest'
import { EvmErrorCode } from '@perawallet/wallet-core-chain-ethereum/blockchain/errors'
import type { EthereumTransactionPayload } from '@perawallet/wallet-core-chain-ethereum/signing/adapter'
import {
    bumpReplacementFee,
    meetsReplacementBump,
} from '@perawallet/wallet-core-chain-ethereum/transfer/replacement'
import { SubmissionError } from '@perawallet/wallet-core-signing'

import { createRawKeyEvmAccount, fundEvmAccount } from '../../harness/accounts'
import { expectEvmConformant } from '../../harness/assert/roundTrip'
import { createEvmConformanceEnv } from '../../harness/context'
import { EVMNET, anvilRpc, mine } from '../../harness/evmnet'
import { rejectionOf } from '../../harness/submit'
import {
    feesOf,
    minedReceipt,
    nodeReceipt,
    nodeTransaction,
    pooledHashes,
    rowsAtNonce,
    signedReplacement,
    signedTransfer,
    submitAndRecord,
    transactionOf,
    withPendingPool,
} from '../submission/support'

const RECIPIENT = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'
const AMOUNT = 10n ** 15n + 7n
const GWEI = 10n ** 9n

// Round numbers, so a +5% replacement is exact rather than rounded.
const ORIGINAL_FEES: FeeValuesEIP1559 = {
    maxFeePerGas: 2n * GWEI,
    maxPriorityFeePerGas: GWEI,
}
const PLUS_FIVE_PERCENT: FeeValuesEIP1559 = {
    maxFeePerGas: (ORIGINAL_FEES.maxFeePerGas * 105n) / 100n,
    maxPriorityFeePerGas: (ORIGINAL_FEES.maxPriorityFeePerGas * 105n) / 100n,
}

const setUp = async () => {
    const env = await createEvmConformanceEnv('ethereum')
    const sender = await createRawKeyEvmAccount(env)
    await fundEvmAccount(env, sender.address, 10n ** 18n)
    return { env, sender }
}

/**
 * Proves a speed-up against a node's pending pool: the app's replacement
 * outbids the original by the minimum bump, the node swaps it in at the same
 * nonce and mines it while the original never lands; an under-bumped one is
 * refused before broadcast; a speed-up of an already-mined send reports that
 * the original confirmed. A mock has no pool to evict from or nonce to burn.
 */
describe('evm speed-up', () => {
    it('replaces a pending send at its nonce; the replacement mines and the original never does', async () => {
        const { env, sender } = await setUp()

        const { original, replacement, originalHash, replacementHash } =
            await withPendingPool(env.chain, async () => {
                const original = await signedTransfer(
                    env,
                    sender,
                    RECIPIENT,
                    AMOUNT,
                )
                const originalHash = await submitAndRecord(env, original.raw)
                const replacement = await signedReplacement(
                    env,
                    sender,
                    'speed-up',
                    original.raw,
                )
                expect(
                    meetsReplacementBump(
                        feesOf(original.raw),
                        feesOf(replacement.raw),
                    ),
                ).toBe(true)

                const replacementHash = await submitAndRecord(
                    env,
                    replacement.raw,
                )
                // Node acceptance: the node evicted the original for the replacement.
                expect(await pooledHashes(env.chain)).toEqual([
                    replacementHash.toLowerCase(),
                ])
                const [originalRow, replacementRow] = await rowsAtNonce(
                    env,
                    sender.address,
                    0,
                )
                expect(replacementRow.txIds).toEqual([replacementHash])
                expect(replacementRow.replacesAttemptId).toBe(originalRow.id)

                await mine(env.chain)
                return { original, replacement, originalHash, replacementHash }
            })

        expect(await nodeReceipt(env.chain, originalHash)).toBeNull()
        expect(await nodeTransaction(env.chain, originalHash)).toBeNull()
        const app = transactionOf(replacement.raw)
        // The speed-up resends the original's call; only its prices moved.
        expect(app.gas).toBe(transactionOf(original.raw).gas)
        // Round-trip: gas and fee caps are the app's choice; the call is the one the test sent.
        await expectEvmConformant({
            env,
            intent: {
                chainId: EVMNET.ethereum.eip155ChainId,
                from: sender.address,
                nonce: 0,
                to: RECIPIENT,
                value: AMOUNT,
                gas: app.gas!,
                maxFeePerGas: app.maxFeePerGas!,
                maxPriorityFeePerGas: app.maxPriorityFeePerGas!,
            },
            raw: replacement.raw,
            hash: replacementHash,
        })
    })

    it('refuses a +5% replacement locally, which Anvil itself would accept', async () => {
        const { env, sender } = await setUp()

        await withPendingPool(env.chain, async () => {
            const original = await signedTransfer(
                env,
                sender,
                RECIPIENT,
                AMOUNT,
                ORIGINAL_FEES,
            )
            const originalHash = await submitAndRecord(env, original.raw)
            const underBumped = await signedReplacement(
                env,
                sender,
                'speed-up',
                original.raw,
                PLUS_FIVE_PERCENT,
            )
            expect(meetsReplacementBump(ORIGINAL_FEES, PLUS_FIVE_PERCENT)).toBe(
                false,
            )

            const refusal = await rejectionOf(() =>
                submitAndRecord(env, underBumped.raw),
            )
            expect(refusal).toBeInstanceOf(SubmissionError)
            expect(refusal).toMatchObject({
                classification: 'rejected-by-node',
                nodeError: { code: EvmErrorCode.REPLACEMENT_UNDERPRICED },
            })
            // Refused before broadcast: the node still pools the original, the ledger holds it alone.
            expect(await pooledHashes(env.chain)).toEqual([
                originalHash.toLowerCase(),
            ])
            expect(
                (await rowsAtNonce(env, sender.address, 0)).map(
                    row => row.txIds,
                ),
            ).toEqual([[originalHash]])

            // Node acceptance: Anvil prices a replacement by maxFeePerGas alone, so a tip bump
            // under an unchanged fee cap is the refusal it reports.
            const tipOnly = await signedReplacement(
                env,
                sender,
                'speed-up',
                original.raw,
                {
                    maxFeePerGas: ORIGINAL_FEES.maxFeePerGas,
                    maxPriorityFeePerGas: bumpReplacementFee(
                        ORIGINAL_FEES.maxPriorityFeePerGas,
                    ),
                },
            )
            const nodeRefusal = await rejectionOf(() =>
                anvilRpc(env.chain, 'eth_sendRawTransaction', [tipOnly.raw]),
            )
            expect((nodeRefusal as Error).message).toContain(
                'JSON-RPC error -32003: replacement transaction underpriced',
            )

            // Node acceptance: unlike geth's 10% price bump, Anvil takes any higher fee cap.
            const accepted = await anvilRpc<string>(
                env.chain,
                'eth_sendRawTransaction',
                [underBumped.raw],
            )
            expect(await pooledHashes(env.chain)).toEqual([
                accepted.toLowerCase(),
            ])
            await mine(env.chain)
            expect(
                (await nodeReceipt(env.chain, accepted as `0x${string}`))
                    ?.status,
            ).toBe('0x1')
            expect(await nodeReceipt(env.chain, originalHash)).toBeNull()
        })
    })

    it('reports a speed-up of an already-mined send as the original confirmed', async () => {
        const { env, sender } = await setUp()
        const original = await signedTransfer(env, sender, RECIPIENT, AMOUNT)
        // Automine is on, so the original is mined as it is sent.
        const originalHash = await submitAndRecord(env, original.raw)
        expect((await minedReceipt(env.chain, originalHash)).status).toBe('0x1')

        const replacement = await signedReplacement(
            env,
            sender,
            'speed-up',
            original.raw,
        )
        const payload = replacement.unsigned
            .payload as EthereumTransactionPayload
        expect(payload.transaction.nonce).toBe(0)
        const refusal = await rejectionOf(() =>
            submitAndRecord(env, replacement.raw),
        )

        expect(refusal).toBeInstanceOf(SubmissionError)
        const { nodeError } = refusal as SubmissionError
        expect(nodeError).toMatchObject({
            code: EvmErrorCode.REPLACED_TRANSACTION_CONFIRMED,
        })
        // The node's own words, carried in the classified error.
        expect(nodeError.message).toContain('nonce too low')
        expect(
            (await rowsAtNonce(env, sender.address, 0)).map(row => row.status),
        ).toEqual(['submitted', 'failed'])
    })
})
